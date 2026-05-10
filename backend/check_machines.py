from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    res = db.execute(text('SELECT id, ten_may FROM machines'))
    print("Machines:")
    for r in res:
        print(f"ID: {r[0]}, Name: {r[1]}")
except Exception as e:
    print(f"Error: {str(e)}")
finally:
    db.close()
