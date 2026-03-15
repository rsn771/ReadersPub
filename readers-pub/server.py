#!/usr/bin/env python3
"""
Сервер сайта Readers Pub. Раздаёт статику и принимает заявки на бронь,
отправляя их в Telegram (бот clearlebot / bot.py проекта).
"""
import json
import os
import ssl
import sys
from datetime import datetime
from pathlib import Path

import urllib.error
import urllib.request
from http.server import HTTPServer, SimpleHTTPRequestHandler

# SSL: на Mac часто падает проверка сертификатов — используем контекст без проверки для Telegram API
_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

BOOKINGS_FILE = Path(__file__).parent / "bookings.json"

# Загрузка .env.bot (если есть)
_env_path = os.path.join(os.path.dirname(__file__), "..", ".env.bot")
if os.path.exists(_env_path):
    with open(_env_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

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


# Дни с мероприятиями (март 2026): с 22:30 брони разрешены. Вс: блок 14:00–22:29, остальные: 18:00–22:29.
EVENT_DAYS_2026_03 = {
    "2026-03-01": True, "2026-03-03": False, "2026-03-04": False, "2026-03-05": False,
    "2026-03-06": False, "2026-03-07": False, "2026-03-08": True, "2026-03-09": False,
    "2026-03-10": False, "2026-03-11": False, "2026-03-12": False, "2026-03-13": False,
    "2026-03-15": True, "2026-03-16": False, "2026-03-17": False, "2026-03-18": False,
    "2026-03-19": False, "2026-03-20": False, "2026-03-22": True, "2026-03-23": False,
    "2026-03-24": False, "2026-03-25": False, "2026-03-26": False, "2026-03-27": False,
    "2026-03-29": True, "2026-03-30": False, "2026-03-31": False,
}


def _time_minutes(s: str) -> int:
    parts = (s or "0:0").strip().split(":")
    h, m = int(parts[0]) if parts else 0, int(parts[1]) if len(parts) > 1 else 0
    return h * 60 + m


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


def _is_booking_blocked(date_str: str, time_str: str) -> bool:
    is_sunday = EVENT_DAYS_2026_03.get(date_str)
    if is_sunday is None:
        return False
    t = _time_minutes(time_str)
    end_block = 22 * 60 + 29  # 22:30 разрешено
    if is_sunday:
        return 14 * 60 <= t <= end_block
    return 18 * 60 <= t <= end_block


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
        if self.path == "/api/test-telegram":
            self._handle_test_telegram()
            return
        super().do_GET()

    def do_POST(self):
        if self.path == "/api/booking":
            self._handle_booking()
        elif self.path == "/api/banquet":
            self._handle_banquet()
        else:
            self.send_error(404)

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
        self.wfile.write(json.dumps(data).encode())

    def _handle_booking(self):
        try:
            data = self._read_json()
            name = data.get("name", "-")
            phone = data.get("phone", "-")
            date = data.get("date", "-")
            time = data.get("time", "-")
            guests = data.get("guests", "-")

            if _is_outside_opening_hours(date, time):
                self._send_json({
                    "ok": False,
                    "message": "Ресторан в этот день закрыт в выбранное время. Пн–Чт, Вс: 12:00–00:00. Пт–Сб: 12:00–02:00.",
                })
                return
            if _is_booking_blocked(date, time):
                self._send_json({
                    "ok": False,
                    "message": "На выбранное время запланировано мероприятие. Выберите время до 18:00 (по воскресеньям — до 14:00) или с 22:30.",
                })
                return

            text = (
                "🪑 <b>Новая бронь стола (Readers Pub)</b>\n\n"
                f"Имя: {name}\n"
                f"Телефон: {phone}\n"
                f"Дата: {date}\n"
                f"Время: {time}\n"
                f"Гостей: {guests}"
            )
            ok, err = send_to_telegram(text)
            _save_booking({"type": "booking", "name": name, "phone": phone, "date": date, "time": time, "guests": guests})
            if ok:
                self._send_json({"ok": True, "message": "Бронирование отправлено!"})
            else:
                self._send_json({
                    "ok": True,
                    "message": "Заявка принята! Мы свяжемся с вами. (Уведомление в Telegram временно недоступно — напишите боту @Clearlyoff_bot /start)"
                })
        except Exception as e:
            self._send_json({"ok": False, "message": str(e)}, 500)

    def _handle_banquet(self):
        try:
            data = self._read_json()
            event_type = data.get("event_type", "-")
            comments = data.get("comments", "-")

            text = (
                "🎉 <b>Заявка на банкет (Readers Pub)</b>\n\n"
                f"Тип: {event_type}\n"
                f"Комментарии: {comments or '-'}"
            )
            ok, err = send_to_telegram(text)
            _save_booking({"type": "banquet", "event_type": event_type, "comments": comments})
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
