"""
Thêm 2 roles mới cho module Mua Hàng:
  - MUA_HANG_TRUONG_PHONG: Trưởng Phòng Mua Hàng
  - MUA_HANG_NHAN_VIEN:    Nhân Viên Mua Hàng
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from sqlalchemy import create_engine, text
from app.config import settings

DATABASE_URL = settings.DATABASE_URL

NEW_ROLES = [
    {
        "ma_vai_tro": "MUA_HANG_TRUONG_PHONG",
        "ten_vai_tro": "Trưởng Phòng Mua Hàng",
        "mo_ta": "Quản lý toàn bộ hoạt động mua hàng, nhà cung cấp, vật tư",
        "permissions": [
            # Mua hàng — FULL
            "purchase.view",
            "purchase.orders",
            "purchase.goods_receipts",
            "purchase.returns",
            "purchase.reports",
            "purchase.manage",
            "purchase.import",
            # Kho — chỉ xem (tiếp nhận hàng về kho)
            "inventory.view",
            # Danh mục NCC + vật tư — quản lý
            "master.suppliers.view",
            "master.suppliers.manage",
            "master.materials.view",
            "master.materials.manage",
            # Báo cáo
            "report.view",
            "report.export",
            # Kế toán — xem công nợ NCC để đối soát
            "accounting.ap_ledger",
        ],
    },
    {
        "ma_vai_tro": "MUA_HANG_NHAN_VIEN",
        "ten_vai_tro": "Nhân Viên Mua Hàng",
        "mo_ta": "Lập đơn mua hàng, nhập kho, trả hàng NCC",
        "permissions": [
            # Mua hàng — CRUD, không manage/import
            "purchase.view",
            "purchase.orders",
            "purchase.goods_receipts",
            "purchase.returns",
            "purchase.reports",
            # Kho — chỉ xem
            "inventory.view",
            # Danh mục — chỉ xem
            "master.suppliers.view",
            "master.materials.view",
            # Báo cáo — chỉ xem
            "report.view",
        ],
    },
]


def run():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        for role in NEW_ROLES:
            # Thêm hoặc cập nhật role
            conn.execute(text("""
                INSERT INTO roles (ma_vai_tro, ten_vai_tro, mo_ta, trang_thai, created_at)
                VALUES (:ma, :ten, :mo_ta, true, now())
                ON CONFLICT (ma_vai_tro) DO UPDATE
                  SET ten_vai_tro = :ten, mo_ta = :mo_ta
            """), {"ma": role["ma_vai_tro"], "ten": role["ten_vai_tro"], "mo_ta": role["mo_ta"]})
            conn.commit()

            role_row = conn.execute(
                text("SELECT id FROM roles WHERE ma_vai_tro = :ma"),
                {"ma": role["ma_vai_tro"]}
            ).fetchone()
            role_id = role_row[0]

            # Xóa phân quyền cũ rồi gán lại
            conn.execute(text("DELETE FROM role_permissions WHERE role_id = :rid"), {"rid": role_id})

            assigned = []
            missing = []
            for ma_quyen in role["permissions"]:
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
            print(f"\n[{role['ma_vai_tro']}] {role['ten_vai_tro']}")
            print(f"  Assigned {len(assigned)} permissions: {assigned}")
            if missing:
                print(f"  WARNING — permission not found in DB: {missing}")

        print("\nDone.")


if __name__ == "__main__":
    run()
