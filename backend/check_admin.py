from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    res = db.execute(text("SELECT username, password_hash FROM users WHERE username='admin'"))
    r = res.fetchone()
    if r:
        print(f"User: {r[0]}, Hash: {r[1]}")
    else:
        print("Admin user not found!")
except Exception as e:
    print(f"Error: {str(e)}")
finally:
    db.close()
