import sys
import os
import socket

# Đảm bảo thư mục backend luôn có trong sys.path (cần cho --reload)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

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

    # Nếu port chính bị chiếm (zombie socket), thử port kế tiếp
    if not is_port_free(port):
        alt = port + 1
        print(f"[run.py] WARNING: Port {port} bị chiếm — thử port {alt}")
        if is_port_free(alt):
            port = alt
        else:
            print(f"[run.py] ERROR: Cả port {port} và {alt} đều bị chiếm. "
                  f"Vui lòng restart máy hoặc kill process đang chiếm port.")
            sys.exit(1)

    print(f"[run.py] Khởi động backend trên port {port}")
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info",
    )
