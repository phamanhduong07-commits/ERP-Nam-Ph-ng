"""
Tao tai khoan 'loan' voi role KE_TOAN_TRUONG va assign permissions cho role nay.
Chay 1 lan: python create_loan_ke_toan_truong.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import bcrypt
from sqlalchemy import create_engine, text
from app.config import settings

DATABASE_URL = settings.DATABASE_URL

KE_TOAN_TRUONG_PERMISSIONS = [
    # Ke Toan - full access
    "accounting.view",
    "accounting.receipts",
    "accounting.payments",
    "accounting.cash_book",
    "accounting.bank_ledger",
    "accounting.ar_ledger",
    "accounting.ap_ledger",
    "accounting.reconciliation",
    "accounting.journal",
    "accounting.general_ledger",
    "accounting.ccdc",
    "accounting.workshop_mgmt",
    "accounting.manage",
    "accounting.hoa_don_dien_tu",
    # Mua Hang - read only
    "purchase.view",
    "purchase.orders",
    "purchase.goods_receipts",
    "purchase.reports",
    # Nhan Su - luong
    "hr.view",
    "hr.payroll",
    "hr.payroll_config",
]

def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=14)).decode()

def run():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        # 1. Lay role KE_TOAN_TRUONG
        role = conn.execute(
            text("SELECT id FROM roles WHERE ma_vai_tro = 'KE_TOAN_TRUONG'")
        ).fetchone()
        if not role:
            print("LOI: Role KE_TOAN_TRUONG chua ton tai trong DB!")
            return
        role_id = role[0]
        print(f"Tim thay role KE_TOAN_TRUONG (id={role_id})")

        # 2. Assign permissions cho role
        assigned = 0
        skipped = 0
        for ma_quyen in KE_TOAN_TRUONG_PERMISSIONS:
            perm = conn.execute(
                text("SELECT id FROM permissions WHERE ma_quyen = :ma"),
                {"ma": ma_quyen}
            ).fetchone()
            if not perm:
                print(f"  WARN: Permission '{ma_quyen}' chua co trong DB (bo qua)")
                skipped += 1
                continue
            conn.execute(text("""
                INSERT INTO role_permissions (role_id, permission_id, created_at)
                VALUES (:rid, :pid, now())
                ON CONFLICT DO NOTHING
            """), {"rid": role_id, "pid": perm[0]})
            assigned += 1

        conn.commit()
        print(f"Assigned {assigned} permissions cho KE_TOAN_TRUONG (bo qua {skipped} chua co).")

        # 3. Tao user loan
        password_hash = _hash_password("123456")
        conn.execute(text("""
            INSERT INTO users (username, ho_ten, password_hash, role_id, trang_thai, created_at, updated_at)
            VALUES ('loan', 'Loan', :pw, :rid, true, now(), now())
            ON CONFLICT (username) DO UPDATE SET
                password_hash = :pw,
                role_id = :rid,
                ho_ten = 'Loan',
                trang_thai = true
        """), {"pw": password_hash, "rid": role_id})
        conn.commit()

        user = conn.execute(text("SELECT id, username, ho_ten FROM users WHERE username = 'loan'")).fetchone()
        print(f"Created/updated user: id={user[0]}, username={user[1]}, ho_ten={user[2]}")
        print("Xong! Dang nhap: username=loan / password=123456")

if __name__ == "__main__":
    run()
