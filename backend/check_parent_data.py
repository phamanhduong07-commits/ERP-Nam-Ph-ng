import os
import sys
from sqlalchemy import create_engine, text

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.config import settings

def main():
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        print("--- ROLES ---")
        for r in conn.execute(text("SELECT id, ma_vai_tro FROM roles LIMIT 5")).fetchall():
            print(r)
            
        print("--- PHAN XUONG ---")
        for r in conn.execute(text("SELECT id, ma_xuong FROM phan_xuong LIMIT 5")).fetchall():
            print(r)
            
        print("--- CUSTOMERS ---")
        for r in conn.execute(text("SELECT id, ma_kh FROM customers LIMIT 5")).fetchall():
            print(r)

if __name__ == "__main__":
    main()
