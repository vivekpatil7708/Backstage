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

        from backend.app.services.chatbot import strategy_coach

        message = data.get('message', '')
        history = data.get('history', [])

        import asyncio
        response = asyncio.run(strategy_coach.chat(message, history))

        resp = json.dumps({'response': response})
        start_response('200 OK', headers)
        return [resp.encode()]

    except Exception as e:
        resp = json.dumps({'error': str(e), 'trace': traceback.format_exc()})
        start_response('400 Bad Request', headers)
        return [resp.encode()]
