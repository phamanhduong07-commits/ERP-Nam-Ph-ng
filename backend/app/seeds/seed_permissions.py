from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.auth import Permission


def seed_permissions():
    db: Session = SessionLocal()
    permissions = [
        {"ma_quyen": "master.import", "ten_quyen": "Import danh mục (Phân xưởng, Vật tư, Sản phẩm...)"},
        {"ma_quyen": "inventory.import", "ten_quyen": "Import tồn kho đầu kỳ"},
        {"ma_quyen": "sales.import", "ten_quyen": "Import nghiệp vụ bán hàng (Khách hàng, Đơn hàng...)"},
        {"ma_quyen": "purchase.import", "ten_quyen": "Import nghiệp vụ mua hàng (NCC, Đơn mua...)"},
        {"ma_quyen": "accounting.import", "ten_quyen": "Import kế toán (Số dư đầu kỳ...)"},
        {"ma_quyen": "report.export", "ten_quyen": "Xuất báo cáo Excel quản trị"},
        {"ma_quyen": "admin.paper_materials", "ten_quyen": "Quản trị giấy nguyên liệu (sync giá mua từ HTCPH, cập nhật loạt)"},
        {"ma_quyen": "accounting.incoming_invoice", "ten_quyen": "Xử lý hóa đơn đầu vào (upload XML, sync email, sinh chứng từ)"},
    ]

    for p in permissions:
        existing = db.query(Permission).filter(Permission.ma_quyen == p["ma_quyen"]).first()
        if not existing:
            db.add(Permission(**p))
            print(f"Added permission: {p['ma_quyen']}")
        else:
            print(f"Permission already exists: {p['ma_quyen']}")

    db.commit()
    db.close()


if __name__ == "__main__":
    seed_permissions()
