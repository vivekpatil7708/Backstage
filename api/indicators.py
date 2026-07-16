import json
import os
import sys
import traceback

_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _root not in sys.path:
    sys.path.insert(0, _root)

from flask import Flask, jsonify

app = Flask(__name__)


@app.route('/api/indicators', methods=['GET', 'OPTIONS'])
def indicators():
    if request.method == 'OPTIONS':
        return '', 200

    try:
        from backend.app.core.indicators.technical import INDICATOR_REGISTRY
        return jsonify({'indicators': list(INDICATOR_REGISTRY.keys())})

    except Exception as e:
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 400


handler = app
