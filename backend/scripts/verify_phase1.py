import sys
import os

# Add current dir to path
sys.path.append(os.getcwd())

from sqlalchemy import text
from app.database import engine
try:
    import socketio
    print("CHECK: Socket.io library INSTALLED")
except ImportError as e:
    print(f"CHECK: Socket.io library MISSING: {e}")

def check_db():
    indexes_to_check = [
        "idx_prod_logs_machine_date",
        "idx_prod_logs_order",
        "idx_inv_trans_wh_date",
        "idx_inv_bal_wh_prod",
        "idx_so_items_order"
    ]
    
    with engine.connect() as conn:
        print("\n--- Database Indexes Check ---")
        for idx in indexes_to_check:
            res = conn.execute(text(f"SELECT 1 FROM pg_indexes WHERE indexname = '{idx}'")).fetchone()
            status = "OK" if res else "MISSING"
            print(f"{idx}: {status}")

def check_socket_logic():
    print("\n--- Code Logic Check ---")
    file_path = 'app/routers/cd2.py'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        if 'await sio.emit' in content:
            print("LOGIC: WebSocket emit calls FOUND")
        else:
            print("LOGIC: WebSocket emit calls MISSING")

if __name__ == "__main__":
    check_db()
    check_socket_logic()
