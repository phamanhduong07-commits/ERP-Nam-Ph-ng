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
    pool_recycle=3600,
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
            logger.info("seed_phan_xuong: đã tạo 4 xưởng")


def ensure_schema() -> None:
    _sync_all_tables(Base, engine)
    _run_backfills(engine)
    _seed_phan_xuong(engine)