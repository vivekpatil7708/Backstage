import json
import os
import sys
import traceback

_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _root not in sys.path:
    sys.path.insert(0, _root)

from flask import Flask, request, jsonify

app = Flask(__name__)


@app.route('/api/chat', methods=['POST', 'OPTIONS'])
def chat():
    if request.method == 'OPTIONS':
        return '', 200

    try:
        from backend.app.services.chatbot import strategy_coach

        data = request.get_json(force=True)
        message = data.get('message', '')
        history = data.get('history', [])

        import asyncio
        response = asyncio.run(strategy_coach.chat(message, history))

        return jsonify({'response': response})

    except Exception as e:
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 400


handler = app
