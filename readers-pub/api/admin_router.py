"""Админка на Vercel: один обработчик на все действия.

vercel.json переписывает /api/admin/<действие> сюда, действие приходит в ?action=.
Хранилище — репозиторий GitHub (см. lib_store.py), потому что файловая система
на Vercel только для чтения.
"""

from http.server import BaseHTTPRequestHandler
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import json
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import lib_store as store


class handler(BaseHTTPRequestHandler):

    # ---------------------------------------------------------- вспомогательное
    def _json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self) -> dict:
        n = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(n) if n else b"{}"
        try:
            return json.loads(raw.decode("utf-8") or "{}")
        except Exception:
            return {}

    def _action(self) -> str:
        q = parse_qs(urlparse(self.path).query)
        if q.get("action"):
            return q["action"][0]
        # запасной вариант, если rewrite не сработал
        return urlparse(self.path).path.rstrip("/").split("/")[-1]

    def _authorized(self) -> bool:
        return store.token_ok((self.headers.get("X-Admin-Password") or "").strip())

    # ------------------------------------------------------------------ методы
    def do_GET(self):
        action = self._action()
        if action == "publish-status":
            if not self._authorized():
                return self._json({"ok": False, "message": "Не авторизовано"}, 401)
            return self._json({"ok": True, "status": store.publish_status()})

        if action == "bookings":
            if not self._authorized():
                return self._json({"ok": False, "message": "Не авторизовано"}, 401)
            # Заявки на Vercel не хранятся: они уходят в Telegram или Яндекс Форму
            return self._json({"ok": True, "bookings": [], "note": "telegram"})
        return self._json({"ok": False, "message": "Неизвестное действие"}, 404)

    def do_POST(self):
        action = self._action()
        data = self._body()

        try:
            if action == "login":
                if store.password_ok(data.get("password") or ""):
                    return self._json({"ok": True, "token": store.make_token()})
                return self._json({"ok": False, "message": "Неверный пароль"}, 401)

            if not self._authorized():
                return self._json({"ok": False, "message": "Сессия истекла, войдите заново"}, 401)

            if action == "content":
                content = data.get("content", data)
                if not isinstance(content, dict):
                    return self._json({"ok": False, "message": "Ожидался объект content"}, 400)
                content.setdefault("_meta", {})["updated_at"] = datetime.now().isoformat()
                store.save_content(content, "тексты сайта")
                return self._json({"ok": True, "message": "Сохранено",
                                   "published": store.use_github()})

            if action == "upload":
                slot, mime, blob = store.decode_upload(data)
                if slot is None:
                    return self._json({"ok": False, "message": blob}, 400)
                rel = store.save_photo(slot, mime, blob)
                content = store.load_content()
                content.setdefault("photos", {})[slot] = rel
                content.setdefault("_meta", {})["updated_at"] = datetime.now().isoformat()
                store.save_content(content, f"фото «{slot}»")
                return self._json({"ok": True, "slot": slot, "file": rel, "size": len(blob),
                                   "message": "Фото загружено", "published": store.use_github()})

            if action == "publish":
                return self._json(store.git_publish())

            if action == "photo-delete":
                slot = str(data.get("slot") or "").strip()
                if not slot:
                    return self._json({"ok": False, "message": "Не указана позиция"}, 400)
                store.delete_photo(slot)
                content = store.load_content()
                if content.get("photos", {}).pop(slot, None) is not None:
                    store.save_content(content, f"убрал фото «{slot}»")
                return self._json({"ok": True, "slot": slot, "message": "Фото убрано",
                                   "published": store.use_github()})

            return self._json({"ok": False, "message": "Неизвестное действие"}, 404)

        except Exception as e:
            return self._json({"ok": False, "message": f"Ошибка хранилища: {e}"}, 500)
