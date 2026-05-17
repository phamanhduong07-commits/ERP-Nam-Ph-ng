"""
Seed day du quyen cho Ke Toan - Tai Chinh va Nhan Su (HRM)
va cap nhat nhom cho cac quyen cu bi thieu nhom
"""
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path)
DATABASE_URL = os.getenv("DATABASE_URL")

NEW_PERMISSIONS = [
    # Ke toan - Tai chinh
    ("accounting.view",            "Xem module Ke toan - Tai chinh",      "Ke Toan"),
    ("accounting.receipts",        "Xem / Tao Phieu thu",                 "Ke Toan"),
    ("accounting.payments",        "Xem / Tao Phieu chi",                 "Ke Toan"),
    ("accounting.cash_book",       "Xem So quy tien mat",                 "Ke Toan"),
    ("accounting.bank_ledger",     "Xem So tien gui ngan hang",           "Ke Toan"),
    ("accounting.ar_ledger",       "Xem So cong no phai thu",             "Ke Toan"),
    ("accounting.ap_ledger",       "Xem So cong no phai tra",             "Ke Toan"),
    ("accounting.reconciliation",  "Doi soat cong no",                    "Ke Toan"),
    ("accounting.journal",         "But toan tong hop",                   "Ke Toan"),
    ("accounting.general_ledger",  "So cai tai khoan",                    "Ke Toan"),
    ("accounting.ccdc",            "Tai san & CCDC",                      "Ke Toan"),
    ("accounting.workshop_mgmt",   "Quan tri xuong (Luong)",              "Ke Toan"),
    ("accounting.manage",          "Quan ly Ke toan (Admin)",             "Ke Toan"),

    # Nhan su (HRM)
    ("hr.view",                    "Xem module Nhan su",                  "Nhan Su"),
    ("hr.employees",               "Ho so nhan vien",                     "Nhan Su"),
    ("hr.departments",             "Co cau to chuc",                      "Nhan Su"),
    ("hr.permission_matrix",       "Ma tran phan quyen",                  "Nhan Su"),
    ("hr.attendance",              "Cham cong & Don tu",                  "Nhan Su"),
    ("hr.payroll",                 "Bang luong san pham",                 "Nhan Su"),
    ("hr.payroll_config",          "Cau hinh he so luong",                "Nhan Su"),
    ("hr.logistics",               "Logistics & Doi xe",                  "Nhan Su"),
    ("hr.approvals",               "Phe duyet don tu",                    "Nhan Su"),
    ("hr.rewards",                 "Khen thuong & Ky luat",               "Nhan Su"),
    ("hr.manage",                  "Quan ly Nhan su (Admin)",             "Nhan Su"),

    # Mua hang
    ("purchase.view",              "Xem module Mua hang",                 "Mua Hang"),
    ("purchase.orders",            "Don mua hang (PO)",                   "Mua Hang"),
    ("purchase.goods_receipts",    "Phieu nhap kho (GR)",                 "Mua Hang"),
    ("purchase.returns",           "Tra hang NCC",                        "Mua Hang"),
    ("purchase.reports",           "Bao cao mua hang",                    "Mua Hang"),
    ("purchase.manage",            "Quan ly Mua hang (Admin)",            "Mua Hang"),
]

# Cap nhat nhom cho quyen cu
UPDATE_NHOM = [
    ("accounting.import",  "Ke Toan"),
    ("purchase.import",    "Mua Hang"),
    ("master.import",      "Danh muc"),
    ("sales.import",       "Ban Hang"),
    ("user.view",          "He Thong"),
    ("user.create",        "He Thong"),
    ("user.edit",          "He Thong"),
    ("user.delete",        "He Thong"),
    ("user.reset_password","He Thong"),
    ("role.view",          "He Thong"),
    ("role.create",        "He Thong"),
    ("role.edit",          "He Thong"),
    ("permission.view",    "He Thong"),
    ("permission.manage",  "He Thong"),
    ("inventory.view",     "Kho"),
    ("inventory.import",   "Kho"),
    ("inventory.export",   "Kho"),
    ("inventory.transfer", "Kho"),
    ("inventory.adjust",   "Kho"),
    ("product.view",       "Danh muc"),
    ("product.create",     "Danh muc"),
    ("product.edit",       "Danh muc"),
    ("product.delete",     "Danh muc"),
]

def run():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        added = 0
        for ma_quyen, ten_quyen, nhom in NEW_PERMISSIONS:
            conn.execute(text(f"""
                INSERT INTO permissions (ma_quyen, ten_quyen, nhom, trang_thai, created_at)
                VALUES ('{ma_quyen}', '{ten_quyen}', '{nhom}', true, now())
                ON CONFLICT (ma_quyen) DO UPDATE SET nhom = '{nhom}', ten_quyen = '{ten_quyen}'
            """))
            added += 1

        for ma_quyen, nhom in UPDATE_NHOM:
            conn.execute(text(f"""
                UPDATE permissions SET nhom = '{nhom}' WHERE ma_quyen = '{ma_quyen}'
            """))

        conn.commit()
        print(f"Done! Added/updated {added} permissions.")

        # Tu dong gan tat ca quyen cho ADMIN
        admin_role = conn.execute(text("SELECT id FROM roles WHERE ma_vai_tro = 'ADMIN'")).fetchone()
        if admin_role:
            admin_id = admin_role[0]
            all_perms = conn.execute(text("SELECT id FROM permissions WHERE trang_thai = true")).fetchall()
            conn.execute(text(f"DELETE FROM role_permissions WHERE role_id = {admin_id}"))
            for (pid,) in all_perms:
                conn.execute(text(f"""
                    INSERT INTO role_permissions (role_id, permission_id, created_at)
                    VALUES ({admin_id}, {pid}, now()) ON CONFLICT DO NOTHING
                """))
            conn.commit()
            print(f"Assigned {len(all_perms)} permissions to ADMIN.")

if __name__ == "__main__":
    run()
