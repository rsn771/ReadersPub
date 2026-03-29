from http.server import BaseHTTPRequestHandler
import json
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from lib_availability import build_availability_response


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        date_str = (query.get("date") or [""])[0].strip()
        time_str = (query.get("time") or [""])[0].strip()

        if not date_str:
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "message": "Параметр date обязателен."}, ensure_ascii=False).encode("utf-8"))
            return

        payload = build_availability_response(date_str, time_str)
        self.send_response(200 if payload.get("ok") else 400)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
