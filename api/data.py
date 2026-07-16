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

        from backend.app.data.registry import ADAPTER_REGISTRY, get_adapter

        query = urllib.parse.unquote(environ.get('QUERY_STRING', ''))
        params = dict(p.split('=') for p in query.split('&') if '=' in p)
        source = params.get('source', '')

        if source:
            adapter = get_adapter(source)
            resp = json.dumps({'instruments': adapter.list_instruments()})
        else:
            resp = json.dumps({'sources': list(ADAPTER_REGISTRY.keys())})

        start_response('200 OK', headers)
        return [resp.encode()]

    except Exception as e:
        resp = json.dumps({'error': str(e), 'trace': traceback.format_exc()})
        start_response('400 Bad Request', headers)
        return [resp.encode()]
