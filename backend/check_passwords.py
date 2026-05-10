from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    res = db.execute(text('SELECT token_user, token_password FROM printer_user'))
    print("Worker Credentials:")
    for r in res:
        print(f"- User: {r[0]}, Password: {r[1]}")
except Exception as e:
    print(f"Error: {str(e)}")
finally:
    db.close()
