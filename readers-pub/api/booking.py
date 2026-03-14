from http.server import BaseHTTPRequestHandler
import json
import os
from datetime import datetime
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from lib_telegram import send_to_telegram

BOOKINGS_FILE = Path("/tmp/bookings.json")  # Vercel: только /tmp доступен для записи


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

        text = (
            "🪑 <b>Новая бронь стола (Readers Pub)</b>\n\n"
            f"Имя: {name}\nТелефон: {phone}\nДата: {date}\nВремя: {time}\nГостей: {guests}"
        )
        ok, _ = send_to_telegram(text)
        _save_booking({"type": "booking", "name": name, "phone": phone, "date": date, "time": time, "guests": guests})

        if ok:
            msg = "Бронирование отправлено!"
        else:
            msg = "Заявка принята! Мы свяжемся с вами. (Уведомление в Telegram временно недоступно — напишите боту /start)"

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True, "message": msg}).encode())
