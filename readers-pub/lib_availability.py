"""Общая логика доступности бронирований для локального сервера и Vercel API."""
from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path

AVAILABILITY_FILE = Path(__file__).resolve().parent / "availability.json"


def _time_minutes(value: str) -> int:
    parts = (value or "0:0").strip().split(":")
    hours = int(parts[0]) if parts else 0
    minutes = int(parts[1]) if len(parts) > 1 else 0
    return hours * 60 + minutes


def _minutes_to_time(total_minutes: int) -> str:
    hours = (total_minutes // 60) % 24
    minutes = total_minutes % 60
    return f"{hours:02d}:{minutes:02d}"


def _next_slot_time(time_str: str, step: int = 30) -> str:
    total = _time_minutes(time_str)
    rounded = ((total + step - 1) // step) * step
    return _minutes_to_time(rounded)


def load_availability_data() -> dict:
    if not AVAILABILITY_FILE.exists():
        return {"slot_interval_minutes": 30, "blocked_periods": []}
    try:
        return json.loads(AVAILABILITY_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"slot_interval_minutes": 30, "blocked_periods": []}


def get_opening_hours_hint(date_str: str) -> str:
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    if dt.weekday() in (4, 5):
        return "В этот день ресторан работает 12:00–02:00."
    return "В этот день ресторан работает 12:00–00:00."


def is_outside_opening_hours(date_str: str, time_str: str) -> bool:
    """Пн–Чт, Вс: 12:00–00:00. Пт–Сб: 12:00–02:00."""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        day = dt.weekday()
        total_minutes = _time_minutes(time_str)
        from_noon = 12 * 60
        two_am = 2 * 60
        if day in (0, 1, 2, 3, 6):
            return total_minutes != 0 and total_minutes < from_noon
        return total_minutes > two_am and total_minutes < from_noon
    except Exception:
        return False


def get_blocked_periods(date_str: str) -> list[dict]:
    data = load_availability_data()
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
            "message": item.get("message", "На это время ресторан закрыт под мероприятие.").replace("под мероприятием", "под мероприятие"),
        })
    periods.sort(key=lambda item: (_time_minutes(item["start"]), _time_minutes(item["end"])))
    return periods


def get_block_for_time(date_str: str, time_str: str) -> dict | None:
    current = _time_minutes(time_str)
    for block in get_blocked_periods(date_str):
        if _time_minutes(block["start"]) <= current <= _time_minutes(block["end"]):
            return block
    return None


def find_next_available_slot(date_str: str, time_str: str, days_ahead: int = 21) -> dict | None:
    availability = load_availability_data()
    step = int(availability.get("slot_interval_minutes", 30) or 30)
    start_date = datetime.strptime(date_str, "%Y-%m-%d")
    initial_time = _next_slot_time(time_str or "12:00", step)

    for offset in range(days_ahead + 1):
        current_date = start_date + timedelta(days=offset)
        current_date_str = current_date.strftime("%Y-%m-%d")
        candidate = _time_minutes(initial_time if offset == 0 else "00:00")
        for _ in range(int((24 * 60) / step) + 2):
            candidate_time = _minutes_to_time(candidate)
            if not is_outside_opening_hours(current_date_str, candidate_time) and not get_block_for_time(current_date_str, candidate_time):
                return {
                    "date": current_date_str,
                    "time": candidate_time,
                    "opening_hours_hint": get_opening_hours_hint(current_date_str),
                }
            candidate += step
    return None


def build_availability_response(date_str: str, time_str: str = "") -> dict:
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except Exception:
        return {"ok": False, "message": "Некорректная дата."}

    response = {
        "ok": True,
        "date": date_str,
        "opening_hours_hint": get_opening_hours_hint(date_str),
        "blocked_periods": get_blocked_periods(date_str),
        "available": True,
    }

    if not time_str:
        if response["blocked_periods"]:
            response["summary"] = "На выбранную дату есть периоды, когда ресторан закрыт под мероприятие."
        else:
            response["summary"] = "На выбранную дату бронь доступна в стандартные часы работы."
        return response

    if is_outside_opening_hours(date_str, time_str):
        response["available"] = False
        response["message"] = "Ресторан закрыт в выбранное время. Вс–Чт: 12:00–00:00. Пт–Сб: 12:00–02:00."
        response["next_available"] = find_next_available_slot(date_str, time_str)
        return response

    block = get_block_for_time(date_str, time_str)
    if block:
        response["available"] = False
        response["message"] = block["message"]
        response["blocked_by"] = block
        response["next_available"] = find_next_available_slot(date_str, _next_slot_time(block["end"], 30))
        return response

    response["message"] = "Это время доступно для бронирования."
    return response
