from app.database import SessionLocal
from app.models.auth import User
import bcrypt as _bcrypt

def _hash_password(plain: str) -> str:
    return _bcrypt.hashpw(plain.encode(), _bcrypt.gensalt()).decode()

db = SessionLocal()
try:
    user = db.query(User).filter(User.username == 'admin').first()
    if user:
        user.password_hash = _hash_password('admin123')
        db.commit()
        print("Successfully reset admin password to: admin123")
    else:
        print("Error: Admin user not found in database!")
except Exception as e:
    print(f"Error: {str(e)}")
finally:
    db.close()
