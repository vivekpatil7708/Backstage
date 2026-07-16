import json
import os
import sys
import traceback
import urllib.parse

_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _root not in sys.path:
    sys.path.insert(0, _root)

from flask import Flask, request, jsonify

app = Flask(__name__)


@app.route('/api/parse', methods=['GET', 'OPTIONS'])
def parse_strategy():
    if request.method == 'OPTIONS':
        return '', 200

    try:
        from backend.app.strategies.parser import (
            parse_natural_language,
            strategy_to_json,
            strategy_to_yaml,
        )

        prompt = request.args.get('prompt', '')
        strategy = parse_natural_language(prompt)

        return jsonify({
            'strategy': strategy.model_dump(),
            'json': strategy_to_json(strategy),
            'yaml': strategy_to_yaml(strategy),
        })

    except Exception as e:
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 400


handler = app
