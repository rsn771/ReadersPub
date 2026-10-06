#!/usr/bin/env python3
"""
Сервер сайта Readers Pub. Раздаёт статику и принимает заявки на бронь,
отправляя их в Telegram (бот clearlebot / bot.py проекта).
"""
import base64
import json
import os
import re
import ssl
import sys
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import urllib.error
import urllib.request
from http.server import HTTPServer, SimpleHTTPRequestHandler

import lib_store as store

# SSL: на Mac часто падает проверка сертификатов — используем контекст без проверки для Telegram API
_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

BOOKINGS_FILE = Path(__file__).parent / "bookings.json"
AVAILABILITY_FILE = Path(__file__).parent / "availability.json"
CONTENT_FILE = Path(__file__).parent / "content.json"

# Загрузка .env.bot (если есть)
_env_path = os.path.join(os.path.dirname(__file__), "..", ".env.bot")
if os.path.exists(_env_path):
    with open(_env_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

# Пароль админки и токены сессий — в lib_store.py (общие с Vercel)

# Куда складывать фото, что принимать и какой лимит — в lib_store.py


# Токен и получатели берутся ТОЛЬКО из окружения (.env.bot локально,
# переменные окружения на сервере). В коде хранить их нельзя — репозиторий публичный.
BOT_TOKEN = (
    os.environ.get("TELEGRAM_RESTAURANT_BOT_TOKEN") or
    os.environ.get("TELEGRAM_BOT_TOKEN") or
    ""
).strip()
_owner_str = os.environ.get("OWNER_IDS", "")
OWNER_IDS = [int(x.strip()) for x in _owner_str.split(",") if x.strip()]
TELEGRAM_API = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"


def send_to_telegram(text: str):
    """Отправляет сообщение всем владельцам бота. Возвращает (успех, описание_ошибки)."""
    last_err = ""
    sent = False
    for chat_id in OWNER_IDS:
        try:
            req = urllib.request.Request(TELEGRAM_API, data=json.dumps({
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "HTML"
            }).encode("utf-8"), method="POST")
            req.add_header("Content-Type", "application/json")
            with urllib.request.urlopen(req, timeout=15, context=_SSL_CTX) as resp:
                data = json.loads(resp.read().decode())
                if not data.get("ok"):
                    last_err = data.get("description", "Unknown error")
                    print(f"Telegram API error to {chat_id}: {last_err}", file=sys.stderr)
                else:
                    sent = True
                    print(f"[OK] Booking sent to Telegram chat_id={chat_id}", file=sys.stderr)
        except urllib.error.HTTPError as e:
            try:
                body = e.read().decode()
                err = json.loads(body) if body else {}
                last_err = err.get("description", str(e))
            except Exception:
                last_err = str(e)
            print(f"Telegram HTTP error to {chat_id}: {last_err}", file=sys.stderr)
        except Exception as e:
            last_err = str(e)
            print(f"Telegram send error to {chat_id}: {e}", file=sys.stderr)
    if sent:
        return True, ""
    if "initiate conversation" in str(last_err).lower() or "blocked" in str(last_err).lower():
        return False, "Сначала напишите боту @Clearlyoff_bot команду /start"
    return False, last_err or "Ошибка отправки в Telegram"


def _time_minutes(s: str) -> int:
    parts = (s or "0:0").strip().split(":")
    h, m = int(parts[0]) if parts else 0, int(parts[1]) if len(parts) > 1 else 0
    return h * 60 + m


def _minutes_to_time(total_minutes: int) -> str:
    hours = (total_minutes // 60) % 24
    minutes = total_minutes % 60
    return f"{hours:02d}:{minutes:02d}"


def _next_slot_time(time_str: str, step: int = 30) -> str:
    total = _time_minutes(time_str)
    rounded = ((total + step - 1) // step) * step
    return _minutes_to_time(rounded)


def _load_availability_data() -> dict:
    if not AVAILABILITY_FILE.exists():
        return {"slot_interval_minutes": 30, "blocked_periods": []}
    try:
        return json.loads(AVAILABILITY_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"Could not read availability file: {e}", file=sys.stderr)
        return {"slot_interval_minutes": 30, "blocked_periods": []}


def _get_opening_hours_hint(date_str: str) -> str:
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    if dt.weekday() in (4, 5):
        return "В этот день ресторан работает 12:00–02:00."
    return "В этот день ресторан работает 12:00–00:00."


def _is_outside_opening_hours(date_str: str, time_str: str) -> bool:
    """Пн–Чт, Вс: 12:00–00:00. Пт–Сб: 12:00–02:00."""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        day = dt.weekday()  # 0 Mon .. 6 Sun
        t = _time_minutes(time_str)
        from_noon = 12 * 60
        two_am = 2 * 60
        if day in (0, 1, 2, 3, 6):
            return t != 0 and t < from_noon
        return t > two_am and t < from_noon
    except Exception:
        return False


def _get_blocked_periods(date_str: str) -> list[dict]:
    data = _load_availability_data()
    periods = []
    for item in data.get("blocked_periods", []):
        if item.get("date") != date_str:
            continue
        start = item.get("start")
        end = item.get("end")
        if not start or not end:
            continue
        periods.append({
            "date": date_str,
            "start": start,
            "end": end,
            "reason": item.get("reason", "Мероприятие"),
            "message": item.get("message", "На это время ресторан закрыт под мероприятие.").replace("под мероприятием", "под мероприятие")
        })
    periods.sort(key=lambda item: (_time_minutes(item["start"]), _time_minutes(item["end"])))
    return periods


def _get_block_for_time(date_str: str, time_str: str) -> dict | None:
    t = _time_minutes(time_str)
    for block in _get_blocked_periods(date_str):
        if _time_minutes(block["start"]) <= t <= _time_minutes(block["end"]):
            return block
    return None


def _find_next_available_slot(date_str: str, time_str: str, days_ahead: int = 21) -> dict | None:
    availability = _load_availability_data()
    step = int(availability.get("slot_interval_minutes", 30) or 30)
    start_date = datetime.strptime(date_str, "%Y-%m-%d")
    initial_time = _next_slot_time(time_str or "12:00", step)

    for offset in range(days_ahead + 1):
        current_date = start_date + timedelta(days=offset)
        current_date_str = current_date.strftime("%Y-%m-%d")
        candidate = _time_minutes(initial_time if offset == 0 else "00:00")
        for _ in range(int((24 * 60) / step) + 2):
            candidate_time = _minutes_to_time(candidate)
            if not _is_outside_opening_hours(current_date_str, candidate_time) and not _get_block_for_time(current_date_str, candidate_time):
                return {
                    "date": current_date_str,
                    "time": candidate_time,
                    "opening_hours_hint": _get_opening_hours_hint(current_date_str)
                }
            candidate += step
    return None


def _build_availability_response(date_str: str, time_str: str = "") -> dict:
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except Exception:
        return {"ok": False, "message": "Некорректная дата."}

    response = {
        "ok": True,
        "date": date_str,
        "opening_hours_hint": _get_opening_hours_hint(date_str),
        "blocked_periods": _get_blocked_periods(date_str),
        "available": True,
    }

    if not time_str:
        if response["blocked_periods"]:
            response["summary"] = "На выбранную дату есть периоды, когда ресторан закрыт под мероприятие."
        else:
            response["summary"] = "На выбранную дату бронь доступна в стандартные часы работы."
        return response

    if _is_outside_opening_hours(date_str, time_str):
        response["available"] = False
        response["message"] = "Ресторан закрыт в выбранное время. Вс–Чт: 12:00–00:00. Пт–Сб: 12:00–02:00."
        response["next_available"] = _find_next_available_slot(date_str, time_str)
        return response

    block = _get_block_for_time(date_str, time_str)
    if block:
        response["available"] = False
        response["message"] = block["message"]
        response["blocked_by"] = block
        response["next_available"] = _find_next_available_slot(date_str, _next_slot_time(block["end"], 30))
        return response

    response["message"] = "Это время доступно для бронирования."
    return response


def _save_booking(record: dict) -> None:
    """Сохраняет заявку в файл (резервная копия)."""
    record["_saved_at"] = datetime.now().isoformat()
    try:
        rows = []
        if BOOKINGS_FILE.exists():
            rows = json.loads(BOOKINGS_FILE.read_text(encoding="utf-8"))
        rows.append(record)
        BOOKINGS_FILE.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        print(f"Could not save booking: {e}", file=sys.stderr)


class ReadersPubHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(os.path.abspath(__file__)), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/test-telegram":
            self._handle_test_telegram()
            return
        if parsed.path == "/api/availability":
            self._handle_availability(parsed.query)
            return
        if parsed.path == "/api/content":
            self._handle_get_content()
            return
        if parsed.path == "/api/admin/bookings":
            self._handle_admin_bookings()
            return
        if parsed.path == "/api/admin/publish-status":
            self._handle_publish_status()
            return
        super().do_GET()

    def do_POST(self):
        if self.path == "/api/booking":
            self._handle_booking()
        elif self.path == "/api/banquet":
            self._handle_banquet()
        elif self.path == "/api/admin/login":
            self._handle_admin_login()
        elif self.path == "/api/admin/content":
            self._handle_save_content()
        elif self.path == "/api/admin/upload":
            self._handle_upload()
        elif self.path == "/api/admin/photo-delete":
            self._handle_photo_delete()
        elif self.path == "/api/admin/publish":
            self._handle_publish()
        else:
            self.send_error(404)

    # --- Админка: контент и авторизация ---
    def _is_admin_authorized(self) -> bool:
        return store.token_ok((self.headers.get("X-Admin-Password") or "").strip())

    def _handle_get_content(self):
        if not CONTENT_FILE.exists():
            self._send_json({"ok": True, "content": {}})
            return
        try:
            content = json.loads(CONTENT_FILE.read_text(encoding="utf-8"))
            self._send_json({"ok": True, "content": content})
        except Exception as e:
            self._send_json({"ok": False, "message": str(e)}, 500)

    def _handle_admin_login(self):
        try:
            data = self._read_json()
            if store.password_ok(data.get("password") or ""):
                self._send_json({"ok": True, "token": store.make_token()})
            else:
                self._send_json({"ok": False, "message": "Неверный пароль"}, 401)
        except Exception as e:
            self._send_json({"ok": False, "message": str(e)}, 500)

    def _handle_save_content(self):
        if not self._is_admin_authorized():
            self._send_json({"ok": False, "message": "Сессия истекла, войдите заново"}, 401)
            return
        try:
            data = self._read_json()
            content = data.get("content", data)
            if not isinstance(content, dict):
                self._send_json({"ok": False, "message": "Ожидался объект content"}, 400)
                return
            content.setdefault("_meta", {})
            content["_meta"]["updated_at"] = datetime.now().isoformat()
            CONTENT_FILE.write_text(json.dumps(content, ensure_ascii=False, indent=2), encoding="utf-8")
            self._send_json({"ok": True, "message": "Контент сохранён"})
        except Exception as e:
            self._send_json({"ok": False, "message": str(e)}, 500)

    # --- Админка: загрузка фото ---
    def _read_content(self) -> dict:
        if CONTENT_FILE.exists():
            try:
                return json.loads(CONTENT_FILE.read_text(encoding="utf-8"))
            except Exception:
                pass
        return {}

    def _write_content(self, content: dict):
        content.setdefault("_meta", {})
        content["_meta"]["updated_at"] = datetime.now().isoformat()
        CONTENT_FILE.write_text(json.dumps(content, ensure_ascii=False, indent=2), encoding="utf-8")

    def _handle_upload(self):
        """Принимает фото для одной позиции сайта.

        Тело запроса — JSON: {"slot": "hero-1", "type": "image/jpeg", "data": "<base64>"}
        Файл кладётся в assets/uploads/<slot>.<ext>, путь пишется в content.photos[slot].
        Серая заглушка на сайте пропадает сама: content-loader.js видит фото
        и подставляет его вместо заглушки.
        """
        if not self._is_admin_authorized():
            self._send_json({"ok": False, "message": "Сессия истекла, войдите заново"}, 401)
            return
        try:
            slot, mime, blob = store.decode_upload(self._read_json())
            if slot is None:
                self._send_json({"ok": False, "message": blob}, 400)
                return

            rel = store.save_photo(slot, mime, blob)
            content = self._read_content()
            content.setdefault("photos", {})[slot] = rel
            self._write_content(content)

            self._send_json({"ok": True, "slot": slot, "file": rel,
                             "size": len(blob), "message": "Фото загружено"})
        except Exception as e:
            self._send_json({"ok": False, "message": str(e)}, 500)

    def _handle_photo_delete(self):
        """Убирает фото с позиции — на сайте снова появляется серая заглушка."""
        if not self._is_admin_authorized():
            self._send_json({"ok": False, "message": "Сессия истекла, войдите заново"}, 401)
            return
        try:
            data = self._read_json()
            slot = re.sub(r"[^a-z0-9_-]", "", str(data.get("slot") or "").lower())
            if not slot:
                self._send_json({"ok": False, "message": "Не указана позиция (slot)"}, 400)
                return

            store.delete_photo(slot)

            content = self._read_content()
            if content.get("photos", {}).pop(slot, None) is not None:
                self._write_content(content)
            self._send_json({"ok": True, "slot": slot, "message": "Фото убрано"})
        except Exception as e:
            self._send_json({"ok": False, "message": str(e)}, 500)

    def _handle_publish_status(self):
        if not self._is_admin_authorized():
            self._send_json({"ok": False, "message": "Сессия истекла, войдите заново"}, 401)
            return
        try:
            self._send_json({"ok": True, "status": store.publish_status()})
        except Exception as e:
            self._send_json({"ok": False, "message": str(e)}, 500)

    def _handle_publish(self):
        if not self._is_admin_authorized():
            self._send_json({"ok": False, "message": "Сессия истекла, войдите заново"}, 401)
            return
        try:
            res = store.git_publish()
            self._send_json(res, 200 if res.get("ok") else 500)
        except Exception as e:
            self._send_json({"ok": False, "message": str(e)}, 500)

    def _handle_admin_bookings(self):
        if not self._is_admin_authorized():
            self._send_json({"ok": False, "message": "Сессия истекла, войдите заново"}, 401)
            return
        try:
            rows = json.loads(BOOKINGS_FILE.read_text(encoding="utf-8")) if BOOKINGS_FILE.exists() else []
            self._send_json({"ok": True, "bookings": rows})
        except Exception as e:
            self._send_json({"ok": False, "message": str(e)}, 500)

    def _handle_test_telegram(self):
        """Проверка: отправляет тестовое сообщение и показывает результат."""
        text = "🔔 Тестовое сообщение от Readers Pub"
        results = []
        for chat_id in OWNER_IDS:
            try:
                req = urllib.request.Request(TELEGRAM_API, data=json.dumps({
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": "HTML"
                }).encode("utf-8"), method="POST")
                req.add_header("Content-Type", "application/json")
                with urllib.request.urlopen(req, timeout=15, context=_SSL_CTX) as resp:
                    data = json.loads(resp.read().decode())
                    results.append({"chat_id": chat_id, "ok": data.get("ok"), "result": data})
                    if data.get("ok"):
                        print(f"[OK] Test message sent to {chat_id}", file=sys.stderr)
                    else:
                        print(f"[FAIL] Telegram to {chat_id}: {data}", file=sys.stderr)
            except Exception as e:
                results.append({"chat_id": chat_id, "ok": False, "error": str(e)})
                print(f"[FAIL] Telegram to {chat_id}: {e}", file=sys.stderr)
        self._send_json({
            "owners": OWNER_IDS,
            "results": results,
            "hint": "Сообщение приходит в чат с @Clearlyoff_bot — откройте этот чат в Telegram"
        })

    def _read_json(self):
        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len) if content_len else b"{}"
        return json.loads(body.decode("utf-8") or "{}")

    def _send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def _handle_availability(self, query_string: str):
        query = parse_qs(query_string)
        date_str = (query.get("date") or [""])[0].strip()
        time_str = (query.get("time") or [""])[0].strip()
        if not date_str:
            self._send_json({"ok": False, "message": "Параметр date обязателен."}, 400)
            return

        payload = _build_availability_response(date_str, time_str)
        status = 200 if payload.get("ok") else 400
        self._send_json(payload, status)

    def _handle_booking(self):
        try:
            data = self._read_json()
            name = (data.get("name") or "").strip() or "—"
            phone = (data.get("phone") or "").strip() or "—"
            date = (data.get("date") or "").strip()
            # время и гости необязательны: пустая строка = «не указано»
            # (важно: "-" ломает разбор времени в _build_availability_response)
            time = (str(data.get("time") or "")).strip()
            guests = (str(data.get("guests") or "")).strip()

            availability = _build_availability_response(date, time)
            if not availability.get("ok"):
                self._send_json({"ok": False, "message": availability.get("message", "Некорректные данные.")}, 400)
                return
            if not availability.get("available"):
                self._send_json({
                    "ok": False,
                    "message": availability.get("message", "На это время бронь недоступна."),
                    "next_available": availability.get("next_available"),
                    "opening_hours_hint": availability.get("opening_hours_hint"),
                })
                return

            text = (
                "🪑 <b>Новая бронь стола (Бар Читателей)</b>\n\n"
                f"Имя: {name}\n"
                f"Телефон: {phone}\n"
                f"Дата: {date}\n"
                f"Время: {time or 'не указано'}\n"
                f"Гостей: {guests or 'не указано'}\n"
                f"Статус: ожидает подтверждения"
            )
            ok, err = send_to_telegram(text)
            _save_booking({
                "type": "booking",
                "status": "pending_confirmation",
                "name": name,
                "phone": phone,
                "date": date,
                "time": time,
                "guests": guests
            })
            if ok:
                self._send_json({"ok": True, "message": "Заявка на бронь отправлена. Мы подтвердим её по телефону, если всё в порядке по посадке."})
            else:
                self._send_json({
                    "ok": True,
                    "message": "Заявка принята! Мы свяжемся с вами для подтверждения. (Уведомление в Telegram временно недоступно — напишите боту @Clearlyoff_bot /start)"
                })
        except Exception as e:
            self._send_json({"ok": False, "message": str(e)}, 500)

    def _handle_banquet(self):
        try:
            data = self._read_json()
            event_type = data.get("event_type", "-")
            phone = data.get("phone", "-")
            comments = data.get("comments", "-")

            text = (
                "🎉 <b>Заявка на банкет (Readers Pub)</b>\n\n"
                f"Тип: {event_type}\n"
                f"Телефон: {phone}\n"
                f"Комментарии: {comments or '-'}"
            )
            ok, err = send_to_telegram(text)
            _save_booking({"type": "banquet", "event_type": event_type, "phone": phone, "comments": comments})
            if ok:
                self._send_json({"ok": True, "message": "Заявка отправлена!"})
            else:
                self._send_json({
                    "ok": True,
                    "message": "Заявка принята! Мы свяжемся с вами. (Уведомление в Telegram временно недоступно — напишите боту @Clearlyoff_bot /start)"
                })
        except Exception as e:
            self._send_json({"ok": False, "message": str(e)}, 500)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        # HTML и content.json не кэшируем: иначе после правки в админке
        # владелец видит старую страницу и думает, что ничего не сохранилось
        path = urlparse(self.path).path
        if path.endswith((".html", "/")) or path.endswith("content.json"):
            self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


def main():
    port = int(os.environ.get("PORT", 0)) or (int(sys.argv[1]) if len(sys.argv) > 1 else 0)
    start_port = port or 8000
    for try_port in range(start_port, start_port + 100):
        try:
            server = HTTPServer(("", try_port), ReadersPubHandler)
            print(f"Readers Pub server: http://localhost:{try_port}")
            print(f"Брони → Telegram (OWNER_IDS: {OWNER_IDS}), резерв: {BOOKINGS_FILE}")
            server.serve_forever()
            break
        except OSError as e:
            if e.errno == 48:  # Address already in use
                continue
            raise


if __name__ == "__main__":
    main()
