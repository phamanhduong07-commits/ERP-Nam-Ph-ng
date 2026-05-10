from app.database import SessionLocal
from app.models.cd2 import PrinterUser
import bcrypt as _bcrypt

def _hash_password(plain: str) -> str:
    return _bcrypt.hashpw(plain.encode(), _bcrypt.gensalt()).decode()

db = SessionLocal()
try:
    workers = db.query(PrinterUser).filter(PrinterUser.token_user.in_(['duong', 'cn01'])).all()
    if workers:
        new_hash = _hash_password('123456')
        for w in workers:
            w.token_password = new_hash
        db.commit()
        print(f"Successfully reset password for {len(workers)} workers to: 123456")
    else:
        print("Error: Workers not found in printer_user table!")
except Exception as e:
    print(f"Error: {str(e)}")
finally:
    db.close()
