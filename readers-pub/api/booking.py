from http.server import BaseHTTPRequestHandler
import json
from datetime import datetime
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from lib_availability import build_availability_response
from lib_telegram import send_to_telegram

BOOKINGS_FILE = Path("/tmp/bookings.json")


def _save_booking(record: dict) -> None:
    record["_saved_at"] = datetime.now().isoformat()
    try:
        rows = []
        if BOOKINGS_FILE.exists():
            rows = json.loads(BOOKINGS_FILE.read_text(encoding="utf-8"))
        rows.append(record)
        BOOKINGS_FILE.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass  # На Vercel /tmp сбрасывается между вызовами — это ок


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len) if content_len else b"{}"
        data = json.loads(body.decode("utf-8") or "{}")

        name = data.get("name", "-")
        phone = data.get("phone", "-")
        date = data.get("date", "-")
        time = data.get("time", "-")
        guests = data.get("guests", "-")

        availability = build_availability_response(date, time)
        if not availability.get("ok"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({
                "ok": False,
                "message": availability.get("message", "Некорректные данные."),
            }, ensure_ascii=False).encode("utf-8"))
            return
        if not availability.get("available"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({
                "ok": False,
                "message": availability.get("message", "На это время бронь недоступна."),
                "next_available": availability.get("next_available"),
                "opening_hours_hint": availability.get("opening_hours_hint"),
            }, ensure_ascii=False).encode("utf-8"))
            return

        text = (
            "🪑 <b>Новая бронь стола (Readers Pub)</b>\n\n"
            f"Имя: {name}\n"
            f"Телефон: {phone}\n"
            f"Дата: {date}\n"
            f"Время: {time}\n"
            f"Гостей: {guests}\n"
            f"Статус: ожидает подтверждения"
        )
        ok, _ = send_to_telegram(text)
        _save_booking({
            "type": "booking",
            "status": "pending_confirmation",
            "name": name,
            "phone": phone,
            "date": date,
            "time": time,
            "guests": guests,
        })

        if ok:
            msg = "Заявка на бронь отправлена. Мы подтвердим её по телефону, если всё в порядке по посадке."
        else:
            msg = "Заявка принята! Мы свяжемся с вами для подтверждения. (Уведомление в Telegram временно недоступно — напишите боту /start)"

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True, "message": msg}, ensure_ascii=False).encode("utf-8"))
