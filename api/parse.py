import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


def _json_response(handler, data, status=200):
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json')
    handler.send_header('Access-Control-Allow-Origin', '*')
    handler.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    handler.send_header('Access-Control-Allow-Headers', 'Content-Type')
    handler.end_headers()
    handler.wfile.write(json.dumps(data, default=str).encode())


class handler:
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        try:
            from backend.app.strategies.parser import (
                parse_natural_language,
                strategy_to_json,
                strategy_to_yaml,
            )

            query = self.path.split('?', 1)[1] if '?' in self.path else ''
            params = dict(p.split('=') for p in query.split('&') if '=' in p)
            import urllib.parse
            prompt = urllib.parse.unquote(params.get('prompt', ''))

            strategy = parse_natural_language(prompt)

            _json_response(self, {
                'strategy': strategy.model_dump(),
                'json': strategy_to_json(strategy),
                'yaml': strategy_to_yaml(strategy),
            })
        except Exception as e:
            _json_response(self, {'error': str(e)}, 400)
