"""Tạo tài khoản quynh_kt / KE_TOAN_MUA_HANG."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import bcrypt
from sqlalchemy import create_engine, text
from app.config import settings

DATABASE_URL = settings.DATABASE_URL

USERNAME  = "quynh_kt"
PASSWORD  = "123456"
HO_TEN    = "Quỳnh KT"
MA_VAI_TRO = "KE_TOAN_MUA_HANG"

def run():
    engine = create_engine(DATABASE_URL)
    hashed = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt()).decode()
    with engine.connect() as conn:
        role = conn.execute(
            text("SELECT id FROM roles WHERE ma_vai_tro = :ma"),
            {"ma": MA_VAI_TRO}
        ).fetchone()
        if not role:
            print(f"ERROR: role {MA_VAI_TRO} not found")
            return

        existing = conn.execute(
            text("SELECT id FROM users WHERE username = :u"),
            {"u": USERNAME}
        ).fetchone()

        rid = role[0]

        if existing:
            conn.execute(text("""
                UPDATE users SET password_hash=:pw, role_id=:rid, trang_thai=true
                WHERE username=:u
            """), {"pw": hashed, "rid": rid, "u": USERNAME})
            print(f"Updated: {USERNAME}")
        else:
            conn.execute(text("""
                INSERT INTO users (username, password_hash, ho_ten, role_id, trang_thai, created_at, updated_at)
                VALUES (:u, :pw, :ht, :rid, true, now(), now())
            """), {"u": USERNAME, "pw": hashed, "ht": HO_TEN, "rid": rid})
            print(f"Created: {USERNAME}")

        conn.commit()
        print(f"  role: {MA_VAI_TRO} | password: {PASSWORD}")

if __name__ == "__main__":
    run()
