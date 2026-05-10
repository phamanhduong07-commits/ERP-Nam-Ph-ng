import logging
from sqlalchemy import (
    create_engine, inspect as sa_inspect, text,
    String, Text, Integer, SmallInteger, BigInteger,
    Numeric, Float, Boolean, Date, DateTime,
)
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings

# --- QUAN TRỌNG: IMPORT TẤT CẢ MODEL VÀO ĐÂY ĐỂ ALEMBIC THẤY BẢNG ---
# Giả sử anh để các model trong thư mục app/models/
# Nếu anh có file __init__.py trong đó thì dùng: from app.models import *
# Hoặc import từng file nếu chưa có __init__:
try:
    from app.models.user import User
    from app.models.product import Product
    from app.models.customer import Customer
    from app.models.production import ProductionPlan, ProductionOrder
    # Anh hãy thêm các dòng import tương ứng với các file trong thư mục app/models của anh ở đây
except ImportError:
    # Nếu cấu trúc file khác, hãy thử import file tổng (nếu có)
    try:
        from app import models
    except ImportError:
        pass

logger = logging.getLogger(__name__)

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=1800,
    pool_size=20,
    max_overflow=30,
    pool_timeout=30,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Giữ nguyên các logic Backfill và Sync thủ công của anh ---

_BACKFILL_QI_PG = """ ... """ # Giữ nguyên các biến này của anh
_BACKFILL_QI_TEN_HANG_PG = """ ... """
_BACKFILL_SPEC_PG = """ ... """
_BACKFILL_POI_SPEC_PG = """ ... """
_BACKFILL_CT_CM_PG = """ ... """

def _sa_col_to_pg_ddl(col_type) -> str:
    # ... giữ nguyên hàm này của anh ...
    if isinstance(col_type, String): return f"VARCHAR({col_type.length or 255})"
    if isinstance(col_type, Text): return "TEXT"
    if isinstance(col_type, BigInteger): return "BIGINT"
    if isinstance(col_type, SmallInteger): return "SMALLINT"
    if isinstance(col_type, Integer): return "INTEGER"
    if isinstance(col_type, Float): return "DOUBLE PRECISION"
    if isinstance(col_type, Numeric):
        p = col_type.precision or 18
        s = col_type.scale if col_type.scale is not None else 2
        return f"NUMERIC({p},{s})"
    if isinstance(col_type, Boolean): return "BOOLEAN"
    if isinstance(col_type, Date): return "DATE"
    if isinstance(col_type, DateTime): return "TIMESTAMPTZ" if getattr(col_type, "timezone", False) else "TIMESTAMP"
    return "TEXT"

def _sync_all_tables(base, eng) -> None:
    inspector = sa_inspect(eng)
    existing_tables = set(inspector.get_table_names())
    for mapper in base.registry.mappers:
        table = mapper.local_table
        tname = table.name
        if tname not in existing_tables: continue
        existing_cols = {c["name"] for c in inspector.get_columns(tname)}
        missing = [(col.name, col) for col in table.columns if col.name not in existing_cols and not col.primary_key]
        if not missing: continue
        with eng.begin() as conn:
            for col_name, col in missing:
                ddl_type = _sa_col_to_pg_ddl(col.type)
                try:
                    conn.execute(text(f'ALTER TABLE "{tname}" ADD COLUMN "{col_name}" {ddl_type} NULL'))
                    logger.info("sync_schema: + %s.%s (%s)", tname, col_name, ddl_type)
                except Exception as exc:
                    logger.warning("sync_schema: skip %s.%s — %s", tname, col_name, exc)

def _run_backfills(eng) -> None:
    # ... giữ nguyên hàm này của anh ...
    pass

def _seed_phan_xuong(eng) -> None:
    from app.models.master import PhanXuong
    with SessionLocal() as db:
        if db.query(PhanXuong).count() == 0:
            seeds = [
                PhanXuong(ma_xuong="hoang_gia", ten_xuong="Xưởng Hoàng Gia", dia_chi="Hoàng Gia", cong_doan="cd1_cd2"),
                PhanXuong(ma_xuong="nam_thuan", ten_xuong="Xưởng Nam Thuận", dia_chi="Nam Thuận", cong_doan="cd1_cd2"),
                PhanXuong(ma_xuong="hoc_mon",   ten_xuong="Xưởng Hóc Môn",  dia_chi="Hóc Môn",  cong_doan="cd2"),
                PhanXuong(ma_xuong="cu_chi",    ten_xuong="Xưởng Củ Chi",   dia_chi="Củ Chi",   cong_doan="cd2"),
            ]
            for s in seeds:
                db.add(s)
            db.commit()
            # Hóc Môn và Củ Chi nhập phôi tại Hoàng Gia trước khi chuyển sang xưởng mình
            hoang_gia = db.query(PhanXuong).filter_by(ma_xuong="hoang_gia").first()
            if hoang_gia:
                for ma in ("hoc_mon", "cu_chi"):
                    px = db.query(PhanXuong).filter_by(ma_xuong=ma).first()
                    if px:
                        px.phoi_tu_phan_xuong_id = hoang_gia.id
                db.commit()
            logger.info("seed_phan_xuong: đã tạo 4 xưởng")


def ensure_schema() -> None:
    _sync_all_tables(Base, engine)
    _run_backfills(engine)
    _seed_phan_xuong(engine)
    with engine.begin() as conn:
        # Nghiệp vụ: Hóc Môn và Củ Chi nhập phôi mặc định tại Hoàng Gia → rồi mới chuyển kho
        # Idempotent: chỉ set khi chưa có giá trị
        conn.execute(text("""
            UPDATE phan_xuong
            SET phoi_tu_phan_xuong_id = (
                SELECT id FROM phan_xuong WHERE ma_xuong = 'hoang_gia' LIMIT 1
            )
            WHERE ma_xuong IN ('hoc_mon', 'cu_chi')
              AND phoi_tu_phan_xuong_id IS NULL
        """))

        conn.execute(text(
            "ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS phan_xuong_id INTEGER REFERENCES phan_xuong(id)"
        ))
        conn.execute(text(
            "ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS loai_po VARCHAR(20) DEFAULT 'chung'"
        ))
        conn.execute(text(
            "UPDATE purchase_orders SET loai_po = 'chung' WHERE loai_po IS NULL"
        ))

        conn.execute(text("ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS kho_mm NUMERIC(7,1)"))
        conn.execute(text("ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS so_cuon INTEGER"))
        conn.execute(text("ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS ky_hieu_cuon VARCHAR(50)"))

        # Phôi sóng mua ngoài: cờ trên KHSX line + spec/FK trên POItem
        # (idempotent — IF NOT EXISTS)
        conn.execute(text(
            "ALTER TABLE production_plan_lines "
            "ADD COLUMN IF NOT EXISTS mua_phoi_ngoai BOOLEAN NOT NULL DEFAULT FALSE"
        ))
        conn.execute(text(
            "ALTER TABLE purchase_order_items "
            "ADD COLUMN IF NOT EXISTS phoi_spec JSONB"
        ))
        conn.execute(text(
            "ALTER TABLE purchase_order_items "
            "ADD COLUMN IF NOT EXISTS production_plan_line_id INTEGER "
            "REFERENCES production_plan_lines(id)"
        ))

        # gia_dinh_muc: model đã có, DB cần thêm (3 bảng)
        for tbl in ("paper_materials", "other_materials", "products"):
            conn.execute(text(
                f'ALTER TABLE "{tbl}" ADD COLUMN IF NOT EXISTS gia_dinh_muc NUMERIC(18,2) DEFAULT 0'
            ))
        # ma_dong_cap, do_buc_tb, do_nen_vong_tb trên paper_materials
        conn.execute(text(
            "ALTER TABLE paper_materials ADD COLUMN IF NOT EXISTS ma_dong_cap VARCHAR(20)"
        ))
        conn.execute(text(
            "ALTER TABLE paper_materials ADD COLUMN IF NOT EXISTS do_buc_tb NUMERIC(8,2)"
        ))
        conn.execute(text(
            "ALTER TABLE paper_materials ADD COLUMN IF NOT EXISTS do_nen_vong_tb NUMERIC(8,2)"
        ))
        # GoodsReceiptItem: Khổ cuộn, Số cuộn, Ký hiệu lô
        conn.execute(text("ALTER TABLE goods_receipt_items ADD COLUMN IF NOT EXISTS kho_mm NUMERIC(7,1)"))
        conn.execute(text("ALTER TABLE goods_receipt_items ADD COLUMN IF NOT EXISTS so_cuon INTEGER"))
        conn.execute(text("ALTER TABLE goods_receipt_items ADD COLUMN IF NOT EXISTS ky_hieu_cuon VARCHAR(50)"))
        # GoodsReceipt: split-view fields
        conn.execute(text("ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS so_xe VARCHAR(30)"))
        conn.execute(text("ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS invoice_image TEXT"))
        conn.execute(text("ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS hd_tong_kg NUMERIC(12,2)"))
        # GoodsReceipt: pháp nhân (cho phôi mua ngoài)
        conn.execute(text("ALTER TABLE goods_receipts ADD COLUMN IF NOT EXISTS phap_nhan_id INTEGER"))
        # GoodsReceiptItem: phôi tấm (chiều dài + số lớp)
        conn.execute(text("ALTER TABLE goods_receipt_items ADD COLUMN IF NOT EXISTS dai_mm NUMERIC(7,1)"))
        conn.execute(text("ALTER TABLE goods_receipt_items ADD COLUMN IF NOT EXISTS so_lop INTEGER"))

        # --- Bảng Máy móc & Nhật ký sản xuất cho Mobile Tracking ---
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS machines (
                id SERIAL PRIMARY KEY,
                ten_may VARCHAR(100) NOT NULL,
                ma_may VARCHAR(50) UNIQUE,
                loai_may VARCHAR(50) DEFAULT 'khac',
                sort_order INTEGER DEFAULT 0,
                active BOOLEAN DEFAULT TRUE,
                phan_xuong_id INTEGER REFERENCES phan_xuong(id),
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS production_logs (
                id SERIAL PRIMARY KEY,
                production_order_id INTEGER REFERENCES production_orders(id) NOT NULL,
                phieu_in_id INTEGER REFERENCES phieu_in(id),
                machine_id INTEGER REFERENCES machines(id) NOT NULL,
                event_type VARCHAR(20) NOT NULL,
                quantity_ok NUMERIC(12,3),
                quantity_loi NUMERIC(12,3),
                quantity_setup NUMERIC(12,3),
                ghi_chu TEXT,
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))

        # PrinterUser: máy được gán cho công nhân
        conn.execute(text(
            "ALTER TABLE printer_user ADD COLUMN IF NOT EXISTS machine_id INTEGER REFERENCES machines(id)"
        ))

        # agent_sessions: Lịch sử chat AI (chuyển từ SQLite sang Postgres)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS agent_sessions (
                session_id TEXT PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                history_json JSONB NOT NULL DEFAULT '[]',
                last_active TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        """))

        # Chuyển lệnh SX sang mua phôi ngoài
        conn.execute(text(
            "ALTER TABLE production_order_items "
            "ADD COLUMN IF NOT EXISTS mua_phoi_ngoai BOOLEAN NOT NULL DEFAULT FALSE"
        ))

        # Giá nội bộ chuyển kho phôi — dùng cho hạch toán quản trị xưởng/pháp nhân
        conn.execute(text(
            "ALTER TABLE production_orders "
            "ADD COLUMN IF NOT EXISTS don_gia_noi_bo NUMERIC(14,2)"
        ))