import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


def _json_response(handler, data, status=200):
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json')
    handler.send_header('Access-Control-Allow-Origin', '*')
    handler.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
    handler.send_header('Access-Control-Allow-Headers', 'Content-Type')
    handler.end_headers()
    handler.wfile.write(json.dumps(data).encode())


class handler:
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        try:
            from backend.app.data.registry import ADAPTER_REGISTRY, get_adapter

            query = self.path.split('?', 1)[1] if '?' in self.path else ''
            params = dict(p.split('=') for p in query.split('&') if '=' in p)
            source = params.get('source', '')

            if source:
                adapter = get_adapter(source)
                _json_response(self, {'instruments': adapter.list_instruments()})
            else:
                _json_response(self, {'sources': list(ADAPTER_REGISTRY.keys())})
        except Exception as e:
            _json_response(self, {'error': str(e)}, 400)
