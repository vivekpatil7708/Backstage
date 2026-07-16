import json
import os
import sys
import traceback

_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _root not in sys.path:
    sys.path.insert(0, _root)

from flask import Flask, request, jsonify

app = Flask(__name__)


@app.route('/api/backtest', methods=['POST', 'OPTIONS'])
def run_backtest():
    if request.method == 'OPTIONS':
        return '', 200

    try:
        from backend.app.core.engine.backtest import BacktestEngine
        from backend.app.core.models.strategy import StrategyDefinition
        from backend.app.data.registry import get_adapter

        data = request.get_json(force=True)
        strategy_def = StrategyDefinition(**data.get('strategy', {}))
        data_source = data.get('data_source', 'synthetic')
        instrument = data.get('instrument', 'NIFTY')
        start_date = data.get('start_date', '2023-01-01')
        end_date = data.get('end_date', '2024-12-31')

        adapter = get_adapter(data_source)
        df = adapter.load(instrument, start_date, end_date, strategy_def.timeframe.value)

        engine = BacktestEngine(strategy_def, df)
        result = engine.run()

        return jsonify({'run_id': 0, 'result': result.model_dump()})

    except Exception as e:
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 400


handler = app
