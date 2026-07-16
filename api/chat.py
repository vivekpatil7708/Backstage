import json
import os
import sys

_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _root not in sys.path:
    sys.path.insert(0, _root)


def _json_response(handler, data, status=200):
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json')
    handler.send_header('Access-Control-Allow-Origin', '*')
    handler.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
    handler.send_header('Access-Control-Allow-Headers', 'Content-Type')
    handler.end_headers()
    handler.wfile.write(json.dumps(data, default=str).encode())


def _read_body(handler):
    length = int(handler.headers.get('Content-Length', 0))
    if length == 0:
        return {}
    return json.loads(handler.rfile.read(length))


class handler:
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        try:
            from backend.app.services.chatbot import strategy_coach

            body = _read_body(self)
            message = body.get('message', '')
            history = body.get('history', [])

            import asyncio
            response = asyncio.run(strategy_coach.chat(message, history))

            _json_response(self, {'response': response})
        except Exception as e:
            import traceback
            _json_response(self, {'error': str(e), 'trace': traceback.format_exc()}, 400)
