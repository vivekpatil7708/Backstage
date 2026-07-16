import json
import os
import sys
import traceback

_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _root not in sys.path:
    sys.path.insert(0, _root)

from flask import Flask, request, jsonify

app = Flask(__name__)


@app.route('/api/data', methods=['GET', 'OPTIONS'])
def data():
    if request.method == 'OPTIONS':
        return '', 200

    try:
        from backend.app.data.registry import ADAPTER_REGISTRY, get_adapter

        source = request.args.get('source', '')

        if source:
            adapter = get_adapter(source)
            return jsonify({'instruments': adapter.list_instruments()})
        else:
            return jsonify({'sources': list(ADAPTER_REGISTRY.keys())})

    except Exception as e:
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 400


handler = app
