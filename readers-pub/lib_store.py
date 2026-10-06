"""Хранилище контента админки.

Два режима, код один и тот же:

  ЛОКАЛЬНО (python3 server.py) — читаем и пишем файлы проекта.
  НА VERCEL                    — файловая система только для чтения,
                                 поэтому пишем в репозиторий GitHub через его API.
                                 Vercel видит коммит и пересобирает сайт сам.

Что нужно задать в переменных окружения Vercel:
  ADMIN_PASSWORD   — пароль входа в админку
  ADMIN_SECRET     — любая длинная случайная строка (подпись токенов сессии)
  GITHUB_TOKEN     — токен с правом записи в репозиторий (Contents: read and write)
  GITHUB_REPO      — «владелец/репозиторий», например rsn771/ReadersPub
  GITHUB_BRANCH    — ветка, по умолчанию main
  CONTENT_PREFIX   — папка сайта внутри репозитория, по умолчанию readers-pub
"""

import base64
import hashlib
import hmac
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent

ADMIN_PASSWORD = (os.environ.get("ADMIN_PASSWORD") or "832465").strip()
ADMIN_SECRET = (os.environ.get("ADMIN_SECRET") or "readers-pub-dev-secret").strip()
TOKEN_TTL = 12 * 60 * 60  # сессия живёт 12 часов

GITHUB_TOKEN = (os.environ.get("GITHUB_TOKEN") or "").strip()
GITHUB_REPO = (os.environ.get("GITHUB_REPO") or "").strip()
GITHUB_BRANCH = (os.environ.get("GITHUB_BRANCH") or "main").strip()
CONTENT_PREFIX = (os.environ.get("CONTENT_PREFIX") or "readers-pub").strip("/")

CONTENT_FILE = "content.json"
UPLOAD_DIR = "assets/uploads"

ALLOWED_TYPES = {
    "image/jpeg": ".jpg", "image/png": ".png",
    "image/webp": ".webp", "image/gif": ".gif",
}
MAX_UPLOAD_BYTES = 8 * 1024 * 1024   # 8 МБ: у Vercel ограничение на размер запроса


def use_github() -> bool:
    """На Vercel пишем в GitHub, локально — в файлы проекта."""
    return bool(GITHUB_TOKEN and GITHUB_REPO)


# ---------------------------------------------------------------- авторизация

def password_ok(given: str) -> bool:
    return hmac.compare_digest((given or "").strip(), ADMIN_PASSWORD)


def make_token() -> str:
    """Токен сессии: срок + подпись. Пароль по сети больше не гуляет."""
    exp = str(int(time.time()) + TOKEN_TTL)
    sig = hmac.new(ADMIN_SECRET.encode(), exp.encode(), hashlib.sha256).hexdigest()[:32]
    return f"{exp}.{sig}"


def token_ok(token: str) -> bool:
    try:
        exp, sig = (token or "").split(".", 1)
        expected = hmac.new(ADMIN_SECRET.encode(), exp.encode(), hashlib.sha256).hexdigest()[:32]
        return hmac.compare_digest(sig, expected) and int(exp) > time.time()
    except Exception:
        return False


# ------------------------------------------------------------------- GitHub

def _gh(method: str, path: str, payload: dict | None = None):
    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{path}"
    if method == "GET":
        url += f"?ref={GITHUB_BRANCH}"
    req = urllib.request.Request(url, method=method)
    req.add_header("Authorization", f"Bearer {GITHUB_TOKEN}")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("User-Agent", "readers-pub-admin")
    body = None
    if payload is not None:
        body = json.dumps(payload).encode()
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, body, timeout=25) as r:
        return json.loads(r.read().decode() or "{}")


def _repo_path(rel: str) -> str:
    return f"{CONTENT_PREFIX}/{rel}" if CONTENT_PREFIX else rel


def _gh_read(rel: str):
    """Возвращает (bytes, sha) либо (None, None), если файла нет."""
    try:
        data = _gh("GET", _repo_path(rel))
        return base64.b64decode(data.get("content", "")), data.get("sha")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None, None
        raise


def _gh_write(rel: str, blob: bytes, message: str):
    _, sha = _gh_read(rel)
    payload = {
        "message": message,
        "content": base64.b64encode(blob).decode(),
        "branch": GITHUB_BRANCH,
    }
    if sha:
        payload["sha"] = sha
    _gh("PUT", _repo_path(rel), payload)


def _gh_delete(rel: str, message: str):
    _, sha = _gh_read(rel)
    if not sha:
        return False
    _gh("DELETE", _repo_path(rel), {"message": message, "sha": sha, "branch": GITHUB_BRANCH})
    return True


# ------------------------------------------------------- контент и картинки

def load_content() -> dict:
    if use_github():
        blob, _ = _gh_read(CONTENT_FILE)
        if blob:
            try:
                return json.loads(blob.decode("utf-8"))
            except Exception:
                pass
        return {}
    p = ROOT / CONTENT_FILE
    if p.exists():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def save_content(content: dict, note: str = "контент"):
    blob = (json.dumps(content, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    if use_github():
        _gh_write(CONTENT_FILE, blob, f"admin: {note}")
    else:
        (ROOT / CONTENT_FILE).write_bytes(blob)


def save_photo(slot: str, mime: str, blob: bytes) -> str:
    """Кладёт фото и возвращает путь, по которому сайт его покажет."""
    ext = ALLOWED_TYPES[mime]
    rel = f"{UPLOAD_DIR}/{slot}{ext}"
    stamp = int(time.time())

    if use_github():
        # старые версии той же позиции в других форматах убираем
        for other in ALLOWED_TYPES.values():
            if other != ext:
                try:
                    _gh_delete(f"{UPLOAD_DIR}/{slot}{other}", f"admin: убрал старое фото {slot}")
                except Exception:
                    pass
        _gh_write(rel, blob, f"admin: фото «{slot}»")
    else:
        d = ROOT / UPLOAD_DIR
        d.mkdir(parents=True, exist_ok=True)
        for old in d.glob(f"{slot}.*"):
            try:
                old.unlink()
            except OSError:
                pass
        (d / f"{slot}{ext}").write_bytes(blob)

    return f"{rel}?v={stamp}"


def delete_photo(slot: str):
    if use_github():
        for ext in ALLOWED_TYPES.values():
            try:
                _gh_delete(f"{UPLOAD_DIR}/{slot}{ext}", f"admin: убрал фото «{slot}»")
            except Exception:
                pass
    else:
        d = ROOT / UPLOAD_DIR
        if d.exists():
            for old in d.glob(f"{slot}.*"):
                try:
                    old.unlink()
                except OSError:
                    pass


# ------------------------------------------------- публикация (локальный git)
#
# На Vercel каждая правка уже уходит коммитом через API — публиковать нечего.
# Локально правки лежат в файлах, и кнопка «Опубликовать» в админке делает
# коммит и отправку. Трогаем ТОЛЬКО контент: content.json и загруженные фото,
# чтобы случайно не отправить чужую незаконченную работу.

PUBLISH_PATHS = [CONTENT_FILE, UPLOAD_DIR]


def _git(*args, timeout=90):
    """Возвращает (код, stdout, stderr).

    stdout НЕ обрезаем слева: в выводе `git status --porcelain` первый символ
    строки значащий (' M файл'), и лишний strip съедал бы букву имени файла.
    """
    import subprocess
    r = subprocess.run(["git", *args], cwd=str(ROOT), capture_output=True,
                       text=True, timeout=timeout)
    return r.returncode, (r.stdout or "").rstrip("\n"), (r.stderr or "").strip()


def git_available() -> bool:
    code, _, _ = _git("rev-parse", "--is-inside-work-tree", timeout=10)
    return code == 0


def publish_status() -> dict:
    """Что ждёт отправки на сайт."""
    if use_github():
        return {"mode": "github", "pending": 0, "files": [],
                "message": "Правки уходят на сайт сразу — публиковать отдельно не нужно."}
    if not git_available():
        return {"mode": "none", "pending": 0, "files": [],
                "message": "Папка проекта не подключена к GitHub — публикация недоступна."}

    code, out, _ = _git("status", "--porcelain", "--", *PUBLISH_PATHS, timeout=20)
    # строка вида "XY путь": первые два символа — статус, дальше имя файла
    files = [ln[2:].strip() for ln in out.splitlines() if ln.strip()] if code == 0 else []

    ahead = 0
    code, out, _ = _git("rev-list", "--count", "@{u}..HEAD", timeout=20)
    out = out.strip()
    if code == 0 and out.isdigit():
        ahead = int(out)

    return {"mode": "git", "pending": len(files), "files": files[:20], "ahead": ahead}


def git_publish() -> dict:
    """Коммит контента и отправка на GitHub. Возвращает понятный человеку ответ."""
    if use_github():
        return {"ok": True, "message": "Правки уже на сайте — отдельная публикация не нужна."}
    if not git_available():
        return {"ok": False, "message": "Папка проекта не подключена к GitHub."}

    st = publish_status()
    if not st["pending"] and not st.get("ahead"):
        return {"ok": True, "nothing": True, "message": "Нечего публиковать — всё уже на сайте."}

    if st["pending"]:
        code, _, err = _git("add", "--", *PUBLISH_PATHS, timeout=30)
        if code != 0:
            return {"ok": False, "message": f"Не удалось подготовить файлы: {err}"}

        stamp = time.strftime("%d.%m.%Y %H:%M")
        code, _, err = _git("commit", "-m", f"Правки из админки — {stamp}", timeout=30)
        if code != 0 and "nothing to commit" not in (err or "").lower():
            return {"ok": False, "message": f"Не удалось сохранить правки: {err}"}

    code, _, err = _git("push", timeout=120)
    if code != 0:
        low = (err or "").lower()
        if "could not read" in low or "authentication" in low or "denied" in low:
            hint = ("GitHub не принял доступ. Откройте терминал и выполните один раз "
                    "git push — он спросит логин и токен, дальше кнопка заработает.")
        elif "rejected" in low or "non-fast-forward" in low:
            hint = "На GitHub есть более свежая версия. Нужно сначала забрать её (git pull)."
        else:
            hint = err or "неизвестная ошибка"
        return {"ok": False, "message": f"Не удалось отправить: {hint}"}

    return {"ok": True, "message": "Опубликовано. Сайт обновится через минуту."}


def decode_upload(data: dict):
    """Разбирает тело запроса на загрузку. Возвращает (slot, mime, bytes) либо (None, None, ошибка)."""
    import re
    slot = re.sub(r"[^a-z0-9_-]", "", str(data.get("slot") or "").lower())
    if not slot:
        return None, None, "Не указана позиция (slot)"

    mime = str(data.get("type") or "").split(";")[0].strip().lower()
    if mime not in ALLOWED_TYPES:
        return None, None, "Можно загружать только JPG, PNG, WebP или GIF"

    raw = str(data.get("data") or "")
    if "," in raw[:64]:
        raw = raw.split(",", 1)[1]
    try:
        blob = base64.b64decode(raw, validate=True)
    except Exception:
        return None, None, "Файл повреждён при передаче"

    if not blob:
        return None, None, "Пустой файл"
    if len(blob) > MAX_UPLOAD_BYTES:
        return None, None, f"Файл больше {MAX_UPLOAD_BYTES // (1024 * 1024)} МБ — сожмите его"

    return slot, mime, blob
