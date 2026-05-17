import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import settings

# Tải tất cả models vào registry để Base.metadata biết toàn bộ bảng
try:
    from app import models  # noqa: F401  — side-effect import để đăng ký models
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


def _seed_phan_xuong() -> None:
    """Tạo 4 xưởng mặc định nếu bảng còn trống."""
    from app.models.master import PhanXuong
    with SessionLocal() as db:
        if db.query(PhanXuong).count() > 0:
            return
        seeds = [
            PhanXuong(ma_xuong="hoang_gia", ten_xuong="Xưởng Hoàng Gia", dia_chi="Hoàng Gia", cong_doan="cd1_cd2"),
            PhanXuong(ma_xuong="nam_thuan",  ten_xuong="Xưởng Nam Thuận",  dia_chi="Nam Thuận",  cong_doan="cd1_cd2"),
            PhanXuong(ma_xuong="hoc_mon",    ten_xuong="Xưởng Hóc Môn",   dia_chi="Hóc Môn",   cong_doan="cd2"),
            PhanXuong(ma_xuong="cu_chi",     ten_xuong="Xưởng Củ Chi",    dia_chi="Củ Chi",    cong_doan="cd2"),
        ]
        for s in seeds:
            db.add(s)
        db.commit()

        # Hóc Môn và Củ Chi nhận phôi mặc định từ Hoàng Gia
        hoang_gia = db.query(PhanXuong).filter_by(ma_xuong="hoang_gia").first()
        if hoang_gia:
            for ma in ("hoc_mon", "cu_chi"):
                px = db.query(PhanXuong).filter_by(ma_xuong=ma).first()
                if px:
                    px.phoi_tu_phan_xuong_id = hoang_gia.id
            db.commit()
        logger.info("seed_phan_xuong: đã tạo 4 xưởng mặc định")


def ensure_schema() -> None:
    """
    Khởi tạo schema và data seed sau khi app start.

    DDL (CREATE TABLE / ALTER TABLE) đã được chuyển hoàn toàn vào Alembic:
      migration: a0b1c2d3e4f5_sync_ensure_schema_to_alembic
    Chạy `alembic upgrade head` để áp dụng tất cả DDL.

    Hàm này chỉ còn xử lý:
      1. Data seed phan_xuong (idempotent — chỉ chạy khi bảng trống)
      2. Đảm bảo Hóc Môn / Củ Chi có phoi_tu_phan_xuong_id trỏ về Hoàng Gia
    """
    _seed_phan_xuong()

    # Idempotent: chỉ set khi chưa có giá trị
    with engine.begin() as conn:
        conn.execute(text("""
            UPDATE phan_xuong
            SET phoi_tu_phan_xuong_id = (
                SELECT id FROM phan_xuong WHERE ma_xuong = 'hoang_gia' LIMIT 1
            )
            WHERE ma_xuong IN ('hoc_mon', 'cu_chi')
              AND phoi_tu_phan_xuong_id IS NULL
        """))
