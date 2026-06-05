import sys, os
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))
os.chdir(os.path.dirname(__file__))
from dotenv import load_dotenv; load_dotenv()
from database import engine
from sqlalchemy import text

with engine.connect() as c:
    # inventory.phoi_tp → nhóm "Kho"
    c.execute(text("UPDATE permissions SET nhom = 'Kho' WHERE ma_quyen = 'inventory.phoi_tp'"))
    # production_order.* → nhóm "Sản Xuất"
    c.execute(text("UPDATE permissions SET nhom = 'Sản Xuất' WHERE nhom = 'production'"))
    # reports → "Báo Cáo"
    c.execute(text("UPDATE permissions SET nhom = 'Báo Cáo' WHERE nhom = 'reports'"))
    # Bao Cao → "Báo Cáo"
    c.execute(text("UPDATE permissions SET nhom = 'Báo Cáo' WHERE nhom IN ('Bao Cao', 'Bao cao')"))
    # Ban Hang → "Bán Hàng"
    c.execute(text("UPDATE permissions SET nhom = 'Bán Hàng' WHERE nhom = 'Ban Hang'"))
    # sales → "Bán Hàng"
    c.execute(text("UPDATE permissions SET nhom = 'Bán Hàng' WHERE nhom = 'sales'"))
    # inventory (lowercase còn sót) → "Kho"
    c.execute(text("UPDATE permissions SET nhom = 'Kho' WHERE nhom = 'inventory'"))
    # Bao tri → "Bảo Trì"
    c.execute(text("UPDATE permissions SET nhom = 'Bảo Trì' WHERE nhom IN ('Bao tri', 'Bao Tri')"))
    # Chat luong → "Chất Lượng"
    c.execute(text("UPDATE permissions SET nhom = 'Chất Lượng' WHERE nhom IN ('Chat luong', 'Chat Luong')"))
    # Nhan Su → "Nhân Sự"
    c.execute(text("UPDATE permissions SET nhom = 'Nhân Sự' WHERE nhom = 'Nhan Su'"))
    # He Thong → "Hệ Thống"
    c.execute(text("UPDATE permissions SET nhom = 'Hệ Thống' WHERE nhom = 'He Thong'"))
    # Ke Toan → "Kế Toán"
    c.execute(text("UPDATE permissions SET nhom = 'Kế Toán' WHERE nhom = 'Ke Toan'"))
    # Mua Hang → "Mua Hàng"
    c.execute(text("UPDATE permissions SET nhom = 'Mua Hàng' WHERE nhom = 'Mua Hang'"))
    # Danh muc → "Danh Mục"
    c.execute(text("UPDATE permissions SET nhom = 'Danh Mục' WHERE nhom IN ('Danh muc', 'Danh mục')"))
    c.commit()

    rows = c.execute(text('SELECT nhom, COUNT(*) FROM permissions GROUP BY nhom ORDER BY nhom')).fetchall()
    for r in rows: print(r[0], ':', r[1])
