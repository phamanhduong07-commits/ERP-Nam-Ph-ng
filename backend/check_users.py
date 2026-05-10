from app.database import SessionLocal
from sqlalchemy import text
import sys

db = SessionLocal()
try:
    res = db.execute(text('SELECT username FROM users'))
    print("User List:")
    for r in res:
        print(f"USER: {r[0]}")
except Exception as e:
    print(f"Error: {str(e)}")
finally:
    db.close()
