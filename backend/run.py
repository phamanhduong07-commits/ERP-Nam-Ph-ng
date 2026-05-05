import sys
import os
import socket

# Fix encoding for Windows console (avoid UnicodeEncodeError with Vietnamese)
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr.encoding and sys.stderr.encoding.lower() not in ('utf-8', 'utf-8'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)
sys.path.insert(0, BASE_DIR)

import uvicorn


def is_port_free(port: int) -> bool:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        s.bind(("0.0.0.0", port))
        s.close()
        return True
    except OSError:
        s.close()
        return False


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    reload_enabled = os.environ.get("ERP_RELOAD", "").lower() in ("1", "true", "yes", "on")

    if not is_port_free(port):
        alt = port + 1
        print(f"[run.py] WARNING: Port {port} busy, trying {alt}")
        if is_port_free(alt):
            port = alt
        else:
            print(f"[run.py] ERROR: Both port {port} and {alt} are busy. Please kill the process or restart.")
            sys.exit(1)

    print(f"[run.py] Starting backend on port {port} (reload={reload_enabled})")
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=reload_enabled,
        log_level="info",
    )
