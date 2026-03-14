#!/usr/bin/env python3
"""Тест отправки в Telegram — запустить: python3 test_telegram.py"""
import json
import os
import sys
from pathlib import Path

# Загрузка .env.bot
_env = Path(__file__).parent.parent / ".env.bot"
if _env.exists():
    for line in _env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

TOKEN = os.environ.get("TELEGRAM_RESTAURANT_BOT_TOKEN") or os.environ.get("TELEGRAM_BOT_TOKEN", "")
OWNER_IDS = [int(x.strip()) for x in (os.environ.get("OWNER_IDS") or "5651149188,728379071").split(",") if x.strip()]

import ssl
import urllib.request
import urllib.error

_ctx = ssl.create_default_context()
_ctx.check_hostname = False
_ctx.verify_mode = ssl.CERT_NONE

print("Token:", TOKEN[:20] + "..." if len(TOKEN) > 20 else "(пусто)")
print("OWNER_IDS:", OWNER_IDS)
print()

url = f"https://api.telegram.org/bot{TOKEN}/sendMessage"
text = "🔔 Тест от Readers Pub — если видишь это, всё работает!"

for chat_id in OWNER_IDS:
    try:
        req = urllib.request.Request(url, data=json.dumps({
            "chat_id": chat_id,
            "text": text,
        }).encode(), method="POST")
        req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, timeout=10, context=_ctx) as r:
            data = json.loads(r.read().decode())
            if data.get("ok"):
                print(f"✅ chat_id={chat_id}: отправлено")
            else:
                print(f"❌ chat_id={chat_id}:", data.get("description", data))
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            err = json.loads(body)
            print(f"❌ chat_id={chat_id}:", err.get("description", body))
        except:
            print(f"❌ chat_id={chat_id}:", body)
    except Exception as e:
        print(f"❌ chat_id={chat_id}:", e)
