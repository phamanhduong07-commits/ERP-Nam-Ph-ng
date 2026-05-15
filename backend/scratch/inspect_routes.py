from app.main import app
for route in app.routes:
    methods = getattr(route, 'methods', [])
    path = getattr(route, 'path', '')
    if 'machine-login' in path or 'move' in path:
        print(f"{path} {methods}")
