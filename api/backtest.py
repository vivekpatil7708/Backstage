import json
import os
import sys

# Add project root to path so we can import from backend/
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
            from backend.app.core.engine.backtest import BacktestEngine
            from backend.app.core.models.strategy import StrategyDefinition
            from backend.app.data.registry import get_adapter

            body = _read_body(self)
            strategy_def = StrategyDefinition(**body.get('strategy', {}))
            data_source = body.get('data_source', 'synthetic')
            instrument = body.get('instrument', 'NIFTY')
            start_date = body.get('start_date', '2023-01-01')
            end_date = body.get('end_date', '2024-12-31')

            adapter = get_adapter(data_source)
            data = adapter.load(instrument, start_date, end_date, strategy_def.timeframe.value)

            engine = BacktestEngine(strategy_def, data)
            result = engine.run()

            _json_response(self, {
                'run_id': 0,
                'result': result.model_dump(),
            })
        except Exception as e:
            import traceback
            _json_response(self, {'error': str(e), 'trace': traceback.format_exc()}, 400)
