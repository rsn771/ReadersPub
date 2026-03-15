from http.server import BaseHTTPRequestHandler
import json
from datetime import datetime
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from lib_telegram import send_to_telegram

BOOKINGS_FILE = Path("/tmp/bookings.json")

# Дни с мероприятиями (март 2026): True = воскресенье (блок 14:00–22:30), False = 18:00–22:30
EVENT_DAYS_2026_03 = {
    "2026-03-01": True, "2026-03-03": False, "2026-03-04": False, "2026-03-05": False,
    "2026-03-06": False, "2026-03-07": False, "2026-03-08": True, "2026-03-09": False,
    "2026-03-10": False, "2026-03-11": False, "2026-03-12": False, "2026-03-13": False,
    "2026-03-15": True, "2026-03-16": False, "2026-03-17": False, "2026-03-18": False,
    "2026-03-19": False, "2026-03-20": False, "2026-03-22": True, "2026-03-23": False,
    "2026-03-24": False, "2026-03-25": False, "2026-03-26": False, "2026-03-27": False,
    "2026-03-29": True, "2026-03-30": False, "2026-03-31": False,
}


def _time_minutes(s):
    parts = (s or "0:0").strip().split(":")
    h = int(parts[0]) if parts else 0
    m = int(parts[1]) if len(parts) > 1 else 0
    return h * 60 + m


def _is_booking_blocked(date_str, time_str):
    is_sunday = EVENT_DAYS_2026_03.get(date_str)
    if is_sunday is None:
        return False
    t = _time_minutes(time_str)
    if is_sunday:
        return 14 * 60 <= t <= 22 * 60 + 30
    return 18 * 60 <= t <= 22 * 60 + 30


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

        if _is_booking_blocked(date, time):
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({
                "ok": False,
                "message": "На выбранное время запланировано мероприятие. Выберите время до 18:00 (по воскресеньям с двумя играми — до 14:00) или другую дату.",
            }).encode())
            return

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
