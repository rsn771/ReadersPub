"""Контент сайта для админки.

Отдаёт актуальный content.json. На Vercel берёт его из репозитория GitHub —
там он всегда свежий, даже если сайт ещё не пересобрался после правки.
"""

from http.server import BaseHTTPRequestHandler
from pathlib import Path
import json
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import lib_store as store


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            payload = {"ok": True, "content": store.load_content()}
        except Exception as e:
            payload = {"ok": False, "message": str(e)}
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(200 if payload.get("ok") else 500)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
