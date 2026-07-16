import json
import os
import sys
import traceback
import urllib.parse


def handler(environ, start_response):
    method = environ.get('REQUEST_METHOD', 'GET')
    headers = [('Content-Type', 'application/json'), ('Access-Control-Allow-Origin', '*')]

    if method == 'OPTIONS':
        start_response('204 No Content', headers)
        return [b'']

    try:
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if root not in sys.path:
            sys.path.insert(0, root)

        query = urllib.parse.unquote(environ.get('QUERY_STRING', ''))
        params = dict(p.split('=') for p in query.split('&') if '=' in p)
        prompt = params.get('prompt', '')

        from backend.app.strategies.parser import (
            parse_natural_language,
            strategy_to_json,
            strategy_to_yaml,
        )

        strategy = parse_natural_language(prompt)

        resp = json.dumps({
            'strategy': strategy.model_dump(),
            'json': strategy_to_json(strategy),
            'yaml': strategy_to_yaml(strategy),
        }, default=str)
        start_response('200 OK', headers)
        return [resp.encode()]

    except Exception as e:
        resp = json.dumps({'error': str(e), 'trace': traceback.format_exc()})
        start_response('400 Bad Request', headers)
        return [resp.encode()]
