import logging
from sqlalchemy import create_engine, event, inspect as sa_inspect, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings

logger = logging.getLogger(__name__)

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_recycle=3600,
)

# Bật FK enforcement cho SQLite
if settings.DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Cột spec cần thêm vào production_order_items ─────────────────────────────
_POI_COLUMNS = [
    ('loai_thung',        'VARCHAR(50)'),
    ('dai',               'DECIMAL(8,2)'),
    ('rong',              'DECIMAL(8,2)'),
    ('cao',               'DECIMAL(8,2)'),
    ('so_lop',            'SMALLINT'),
    ('to_hop_song',       'VARCHAR(20)'),
    ('mat',               'VARCHAR(30)'),
    ('mat_dl',            'DECIMAL(8,2)'),
    ('song_1',            'VARCHAR(30)'),
    ('song_1_dl',         'DECIMAL(8,2)'),
    ('mat_1',             'VARCHAR(30)'),
    ('mat_1_dl',          'DECIMAL(8,2)'),
    ('song_2',            'VARCHAR(30)'),
    ('song_2_dl',         'DECIMAL(8,2)'),
    ('mat_2',             'VARCHAR(30)'),
    ('mat_2_dl',          'DECIMAL(8,2)'),
    ('song_3',            'VARCHAR(30)'),
    ('song_3_dl',         'DECIMAL(8,2)'),
    ('mat_3',             'VARCHAR(30)'),
    ('mat_3_dl',          'DECIMAL(8,2)'),
    ('loai_in',           'VARCHAR(30)'),
    ('so_mau',            'SMALLINT'),
    ('kho_tt',            'DECIMAL(8,2)'),
    ('dai_tt',            'DECIMAL(8,2)'),
    ('dien_tich',         'DECIMAL(12,4)'),
    ('gia_ban_muc_tieu',  'DECIMAL(18,2)'),
]

# ── Cột spec cần thêm vào sales_order_items ──────────────────────────────────
_SOI_COLUMNS = [
    ('ten_hang',     'VARCHAR(255)'),
    ('quote_item_id', 'INTEGER'),
    ('loai_thung',   'VARCHAR(50)'),
    ('dai',          'DECIMAL(8,2)'),
    ('rong',         'DECIMAL(8,2)'),
    ('cao',          'DECIMAL(8,2)'),
    ('so_lop',       'SMALLINT'),
    ('to_hop_song',  'VARCHAR(20)'),
    ('mat',          'VARCHAR(30)'),
    ('mat_dl',       'DECIMAL(8,2)'),
    ('song_1',       'VARCHAR(30)'),
    ('song_1_dl',    'DECIMAL(8,2)'),
    ('mat_1',        'VARCHAR(30)'),
    ('mat_1_dl',     'DECIMAL(8,2)'),
    ('song_2',       'VARCHAR(30)'),
    ('song_2_dl',    'DECIMAL(8,2)'),
    ('mat_2',        'VARCHAR(30)'),
    ('mat_2_dl',     'DECIMAL(8,2)'),
    ('song_3',       'VARCHAR(30)'),
    ('song_3_dl',    'DECIMAL(8,2)'),
    ('mat_3',        'VARCHAR(30)'),
    ('mat_3_dl',     'DECIMAL(8,2)'),
    ('loai_in',      'VARCHAR(30)'),
    ('so_mau',       'SMALLINT'),
    ('kho_tt',       'DECIMAL(8,2)'),
    ('dai_tt',       'DECIMAL(8,2)'),
    ('dien_tich',    'DECIMAL(12,4)'),
]

# Bước 1a: gán quote_item_id cho sales_order_items qua product_id
_BACKFILL_QI_MYSQL = """
    UPDATE sales_order_items soi
    JOIN sales_orders so ON soi.order_id = so.id
    JOIN quotes q ON so.ghi_chu LIKE CONCAT('Lập từ báo giá ', q.so_bao_gia, '%')
    JOIN quote_items qi ON qi.quote_id = q.id
        AND qi.product_id IS NOT NULL
        AND qi.product_id = soi.product_id
    SET soi.quote_item_id = qi.id
    WHERE soi.quote_item_id IS NULL
      AND soi.product_id IS NOT NULL
"""

# Bước 1b: gán quote_item_id qua ten_hang (cho các dòng chưa có product_id)
_BACKFILL_QI_TEN_HANG_MYSQL = """
    UPDATE sales_order_items soi
    JOIN sales_orders so ON soi.order_id = so.id
    JOIN quotes q ON so.ghi_chu LIKE CONCAT('Lập từ báo giá ', q.so_bao_gia, '%')
    JOIN quote_items qi ON qi.quote_id = q.id
        AND qi.ten_hang IS NOT NULL
        AND qi.ten_hang = soi.ten_hang
    SET soi.quote_item_id = qi.id
    WHERE soi.quote_item_id IS NULL
      AND soi.ten_hang IS NOT NULL
      AND soi.ten_hang != ''
"""

# Bước 2: copy spec từ quote_items sang sales_order_items (với quote_item_id đã có)
_BACKFILL_SPEC_MYSQL = """
    UPDATE sales_order_items soi
    JOIN quote_items qi ON soi.quote_item_id = qi.id
    SET soi.loai_thung  = COALESCE(soi.loai_thung,  qi.loai_thung),
        soi.dai         = COALESCE(soi.dai,          qi.dai),
        soi.rong        = COALESCE(soi.rong,         qi.rong),
        soi.cao         = COALESCE(soi.cao,          qi.cao),
        soi.so_lop      = COALESCE(soi.so_lop,       qi.so_lop),
        soi.to_hop_song = COALESCE(soi.to_hop_song,  qi.to_hop_song),
        soi.mat         = COALESCE(soi.mat,          qi.mat),
        soi.mat_dl      = COALESCE(soi.mat_dl,       qi.mat_dl),
        soi.song_1      = COALESCE(soi.song_1,       qi.song_1),
        soi.song_1_dl   = COALESCE(soi.song_1_dl,    qi.song_1_dl),
        soi.mat_1       = COALESCE(soi.mat_1,        qi.mat_1),
        soi.mat_1_dl    = COALESCE(soi.mat_1_dl,     qi.mat_1_dl),
        soi.song_2      = COALESCE(soi.song_2,       qi.song_2),
        soi.song_2_dl   = COALESCE(soi.song_2_dl,    qi.song_2_dl),
        soi.mat_2       = COALESCE(soi.mat_2,        qi.mat_2),
        soi.mat_2_dl    = COALESCE(soi.mat_2_dl,     qi.mat_2_dl),
        soi.song_3      = COALESCE(soi.song_3,       qi.song_3),
        soi.song_3_dl   = COALESCE(soi.song_3_dl,    qi.song_3_dl),
        soi.mat_3       = COALESCE(soi.mat_3,        qi.mat_3),
        soi.mat_3_dl    = COALESCE(soi.mat_3_dl,     qi.mat_3_dl),
        soi.loai_in     = COALESCE(soi.loai_in,      qi.loai_in),
        soi.so_mau      = COALESCE(soi.so_mau,       qi.so_mau),
        soi.kho_tt      = COALESCE(soi.kho_tt,       qi.kho_tt),
        soi.dai_tt      = COALESCE(soi.dai_tt,       qi.dai_tt),
        soi.dien_tich   = COALESCE(soi.dien_tich,    qi.dien_tich)
    WHERE soi.quote_item_id IS NOT NULL
"""

# Bước 3: copy spec từ sales_order_items sang production_order_items
_BACKFILL_POI_SPEC_MYSQL = """
    UPDATE production_order_items poi
    JOIN sales_order_items soi ON poi.sales_order_item_id = soi.id
    SET
        poi.loai_thung       = COALESCE(poi.loai_thung, soi.loai_thung),
        poi.dai              = COALESCE(poi.dai,         soi.dai),
        poi.rong             = COALESCE(poi.rong,        soi.rong),
        poi.cao              = COALESCE(poi.cao,         soi.cao),
        poi.so_lop           = COALESCE(poi.so_lop,      soi.so_lop),
        poi.to_hop_song      = COALESCE(poi.to_hop_song, soi.to_hop_song),
        poi.mat              = COALESCE(poi.mat,         soi.mat),
        poi.mat_dl           = COALESCE(poi.mat_dl,      soi.mat_dl),
        poi.song_1           = COALESCE(poi.song_1,      soi.song_1),
        poi.song_1_dl        = COALESCE(poi.song_1_dl,   soi.song_1_dl),
        poi.mat_1            = COALESCE(poi.mat_1,       soi.mat_1),
        poi.mat_1_dl         = COALESCE(poi.mat_1_dl,    soi.mat_1_dl),
        poi.song_2           = COALESCE(poi.song_2,      soi.song_2),
        poi.song_2_dl        = COALESCE(poi.song_2_dl,   soi.song_2_dl),
        poi.mat_2            = COALESCE(poi.mat_2,       soi.mat_2),
        poi.mat_2_dl         = COALESCE(poi.mat_2_dl,    soi.mat_2_dl),
        poi.song_3           = COALESCE(poi.song_3,      soi.song_3),
        poi.song_3_dl        = COALESCE(poi.song_3_dl,   soi.song_3_dl),
        poi.mat_3            = COALESCE(poi.mat_3,       soi.mat_3),
        poi.mat_3_dl         = COALESCE(poi.mat_3_dl,    soi.mat_3_dl),
        poi.loai_in          = COALESCE(poi.loai_in,     soi.loai_in),
        poi.so_mau           = COALESCE(poi.so_mau,      soi.so_mau),
        poi.gia_ban_muc_tieu = COALESCE(poi.gia_ban_muc_tieu, soi.don_gia)
    WHERE poi.sales_order_item_id IS NOT NULL
"""


_QI_DL_COLUMNS = [
    ('mat_dl',    'DECIMAL(8,2)'),
    ('song_1_dl', 'DECIMAL(8,2)'),
    ('mat_1_dl',  'DECIMAL(8,2)'),
    ('song_2_dl', 'DECIMAL(8,2)'),
    ('mat_2_dl',  'DECIMAL(8,2)'),
    ('song_3_dl', 'DECIMAL(8,2)'),
    ('mat_3_dl',  'DECIMAL(8,2)'),
]


def ensure_schema() -> None:
    """
    Thêm các cột còn thiếu vào bảng hiện có và backfill dữ liệu.
    Chạy khi khởi động server — idempotent, an toàn khi chạy lại.
    """
    inspector = sa_inspect(engine)
    table_names = inspector.get_table_names()
    is_sqlite = settings.DATABASE_URL.startswith("sqlite")

    # ── quote_items: thêm các cột *_dl còn thiếu ─────────────────────────────
    if 'quote_items' in table_names:
        existing_qi = {col['name'] for col in inspector.get_columns('quote_items')}
        missing_qi  = [(col, dtype) for col, dtype in _QI_DL_COLUMNS if col not in existing_qi]
        if missing_qi:
            with engine.begin() as conn:
                for col, dtype in missing_qi:
                    conn.execute(text(f"ALTER TABLE quote_items ADD COLUMN {col} {dtype} NULL"))
            logger.info("ensure_schema: added %d cols to quote_items", len(missing_qi))

    # ── production_order_items spec columns ──────────────────────────────────
    if 'production_order_items' in table_names:
        existing_poi = {col['name'] for col in inspector.get_columns('production_order_items')}
        missing_poi  = [(col, dtype) for col, dtype in _POI_COLUMNS if col not in existing_poi]
        if missing_poi:
            with engine.begin() as conn:
                for col, dtype in missing_poi:
                    conn.execute(text(
                        f"ALTER TABLE production_order_items ADD COLUMN {col} {dtype} NULL"
                    ))
            logger.info("ensure_schema: added %d cols to production_order_items", len(missing_poi))

        if not is_sqlite:
            with engine.begin() as conn:
                try:
                    r = conn.execute(text(_BACKFILL_POI_SPEC_MYSQL))
                    if r.rowcount:
                        logger.info("backfill POI spec: %d rows", r.rowcount)
                except Exception as e:
                    logger.warning("backfill POI spec failed: %s", e)

    # ── sales_order_items spec columns ───────────────────────────────────────
    if 'sales_order_items' not in table_names:
        return  # bảng chưa tồn tại — create_all sẽ tạo đầy đủ

    existing = {col['name'] for col in inspector.get_columns('sales_order_items')}
    missing  = [(col, dtype) for col, dtype in _SOI_COLUMNS if col not in existing]

    with engine.begin() as conn:
        # 1. Thêm cột còn thiếu
        for col, dtype in missing:
            conn.execute(text(
                f"ALTER TABLE sales_order_items ADD COLUMN {col} {dtype} NULL"
            ))

        if not is_sqlite:
            # 2a. Gán quote_item_id qua product_id
            try:
                r1 = conn.execute(text(_BACKFILL_QI_MYSQL))
                logger.info("backfill quote_item_id (product_id): %d rows", r1.rowcount)
            except Exception as e:
                logger.warning("backfill quote_item_id (product_id) failed: %s", e)

            # 2b. Gán quote_item_id qua ten_hang (cho dòng chưa có product_id)
            try:
                r1b = conn.execute(text(_BACKFILL_QI_TEN_HANG_MYSQL))
                logger.info("backfill quote_item_id (ten_hang): %d rows", r1b.rowcount)
            except Exception as e:
                logger.warning("backfill quote_item_id (ten_hang) failed: %s", e)

            # 3. Copy spec từ quote_items sang sales_order_items
            try:
                r2 = conn.execute(text(_BACKFILL_SPEC_MYSQL))
                logger.info("backfill spec: %d rows updated", r2.rowcount)
            except Exception as e:
                logger.warning("backfill spec failed: %s", e)
