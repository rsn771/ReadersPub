"""Общая логика отправки в Telegram для Vercel serverless."""
import json
import os
import ssl
import urllib.error
import urllib.request

_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

BOT_TOKEN = (
    os.environ.get("TELEGRAM_RESTAURANT_BOT_TOKEN") or
    os.environ.get("TELEGRAM_BOT_TOKEN") or
    ""
).strip()
_owner_str = os.environ.get("OWNER_IDS", "")
OWNER_IDS = [int(x.strip()) for x in _owner_str.split(",") if x.strip()]
TELEGRAM_API = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"


def send_to_telegram(text: str):
    last_err = ""
    sent = False
    for chat_id in OWNER_IDS:
        try:
            req = urllib.request.Request(
                TELEGRAM_API,
                data=json.dumps({"chat_id": chat_id, "text": text, "parse_mode": "HTML"}).encode("utf-8"),
                method="POST",
            )
            req.add_header("Content-Type", "application/json")
            with urllib.request.urlopen(req, timeout=15, context=_SSL_CTX) as resp:
                data = json.loads(resp.read().decode())
                if data.get("ok"):
                    sent = True
                else:
                    last_err = data.get("description", "Unknown error")
        except Exception as e:
            last_err = str(e)
    if sent:
        return True, ""
    if "initiate conversation" in str(last_err).lower() or "blocked" in str(last_err).lower():
        return False, "Сначала напишите боту команду /start"
    return False, last_err or "Ошибка отправки в Telegram"
