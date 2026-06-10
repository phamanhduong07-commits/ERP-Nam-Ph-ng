"""Thêm role KE_TOAN_MUA_HANG — Kế Toán Mua Hàng."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from sqlalchemy import create_engine, text
from app.config import settings

DATABASE_URL = settings.DATABASE_URL

ROLE = {
    "ma_vai_tro": "KE_TOAN_MUA_HANG",
    "ten_vai_tro": "Kế Toán Mua Hàng",
    "mo_ta": "Lập phiếu chi trả NCC, đối soát công nợ, hóa đơn mua hàng",
    "permissions": [
        # Kế toán — công nợ phải trả + thanh toán
        "accounting.view",
        "accounting.receipts",
        "accounting.payments",
        "accounting.cash_book",
        "accounting.bank_ledger",
        "accounting.ap_ledger",
        "accounting.reconciliation",
        # Mua hàng — đọc để đối soát PO/GR/HĐ
        "purchase.view",
        "purchase.orders",
        "purchase.goods_receipts",
        "purchase.reports",
        # Danh mục
        "master.suppliers.view",
        "master.materials.view",
    ],
}


def run():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        conn.execute(text("""
            INSERT INTO roles (ma_vai_tro, ten_vai_tro, mo_ta, trang_thai, created_at)
            VALUES (:ma, :ten, :mo_ta, true, now())
            ON CONFLICT (ma_vai_tro) DO UPDATE
              SET ten_vai_tro = :ten, mo_ta = :mo_ta
        """), {"ma": ROLE["ma_vai_tro"], "ten": ROLE["ten_vai_tro"], "mo_ta": ROLE["mo_ta"]})
        conn.commit()

        role_row = conn.execute(
            text("SELECT id FROM roles WHERE ma_vai_tro = :ma"),
            {"ma": ROLE["ma_vai_tro"]}
        ).fetchone()
        role_id = role_row[0]

        conn.execute(text("DELETE FROM role_permissions WHERE role_id = :rid"), {"rid": role_id})

        assigned, missing = [], []
        for ma_quyen in ROLE["permissions"]:
            perm = conn.execute(
                text("SELECT id FROM permissions WHERE ma_quyen = :mq"),
                {"mq": ma_quyen}
            ).fetchone()
            if perm:
                conn.execute(text("""
                    INSERT INTO role_permissions (role_id, permission_id, created_at)
                    VALUES (:rid, :pid, now()) ON CONFLICT DO NOTHING
                """), {"rid": role_id, "pid": perm[0]})
                assigned.append(ma_quyen)
            else:
                missing.append(ma_quyen)

        conn.commit()
        print(f"[{ROLE['ma_vai_tro']}] {ROLE['ten_vai_tro']}")
        print(f"  Assigned {len(assigned)} permissions: {assigned}")
        if missing:
            print(f"  WARNING — not found in DB: {missing}")
        print("Done.")


if __name__ == "__main__":
    run()
