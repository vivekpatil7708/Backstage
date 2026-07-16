import json
import os
import sys
import traceback


def handler(environ, start_response):
    method = environ.get('REQUEST_METHOD', 'GET')
    headers = [('Content-Type', 'application/json'), ('Access-Control-Allow-Origin', '*')]

    if method == 'OPTIONS':
        start_response('204 No Content', headers)
        return [b'']

    if method != 'POST':
        start_response('405 Method Not Allowed', headers)
        return [json.dumps({'error': 'Method not allowed'}).encode()]

    try:
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if root not in sys.path:
            sys.path.insert(0, root)

        length = int(environ.get('CONTENT_LENGTH', 0) or 0)
        body = environ['wsgi.input'].read(length)
        data = json.loads(body) if body else {}

        from backend.app.core.engine.backtest import BacktestEngine
        from backend.app.core.models.strategy import StrategyDefinition
        from backend.app.data.registry import get_adapter

        strategy_def = StrategyDefinition(**data.get('strategy', {}))
        data_source = data.get('data_source', 'synthetic')
        instrument = data.get('instrument', 'NIFTY')
        start_date = data.get('start_date', '2023-01-01')
        end_date = data.get('end_date', '2024-12-31')

        adapter = get_adapter(data_source)
        df = adapter.load(instrument, start_date, end_date, strategy_def.timeframe.value)

        engine = BacktestEngine(strategy_def, df)
        result = engine.run()

        resp = json.dumps({'run_id': 0, 'result': result.model_dump()}, default=str).encode()
        start_response('200 OK', headers)
        return [resp]

    except Exception as e:
        resp = json.dumps({'error': str(e), 'trace': traceback.format_exc()}).encode()
        start_response('400 Bad Request', headers)
        return [resp]
