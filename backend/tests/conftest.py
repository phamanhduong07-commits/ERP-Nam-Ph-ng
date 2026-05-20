"""
Test configuration: SQLite in-memory DB, chỉ tạo các bảng CD2 cần thiết,
override dependencies, mock sio.emit.
"""
import os
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_cd2.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key")

import pytest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Load all models so Base.metadata is populated
from app.database import Base
import app.models  # noqa: F401 — registers all SQLAlchemy models

TEST_DB_URL = "sqlite:///./test_cd2.db"


def _create_cd2_tables(engine):
    """
    SQLite không hỗ trợ JSONB/ARRAY/UUID. Thay thế bằng JSON/Text để tạo được tất cả bảng.
    SQLite không enforce FK nên không cần tạo các bảng tham chiếu.
    """
    from sqlalchemy import JSON, Text
    from sqlalchemy.dialects.postgresql import JSONB, ARRAY, UUID as PG_UUID

    # Thay thế PG-specific types thành SQLite-compatible types (chỉ cho test)
    for table in Base.metadata.sorted_tables:
        for col in table.columns:
            if isinstance(col.type, JSONB):
                col.type = JSON()
            elif isinstance(col.type, (ARRAY, PG_UUID)):
                col.type = Text()

    Base.metadata.create_all(engine, checkfirst=True)


@pytest.fixture(scope="function")
def db_engine():
    from sqlalchemy import StaticPool

    # Dùng in-memory DB với shared cache để mỗi test có DB độc lập, không bị
    # lỗi "table already exists" giữa các test.
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    _create_cd2_tables(engine)
    yield engine
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(db_engine):
    SessionLocal = sessionmaker(bind=db_engine, autocommit=False, autoflush=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def client(db_session):
    from app.main import app
    from app.database import get_db
    from app.deps import get_current_user

    def override_get_db():
        yield db_session

    def override_get_current_user():
        _role = SimpleNamespace(ma_vai_tro="ADMIN")
        return SimpleNamespace(id=1, username="testuser", trang_thai=True, role=_role)

    with patch("app.socket_manager.sio.emit", new=AsyncMock(return_value=None)):
        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = override_get_current_user
        with TestClient(app, raise_server_exceptions=True) as c:
            yield c
    app.dependency_overrides.clear()


@pytest.fixture
def phieu_in_cho_in(db_session):
    from app.models.cd2 import PhieuIn
    p = PhieuIn(so_phieu="TEST-001", trang_thai="cho_in", so_luong_phoi=100)
    db_session.add(p)
    db_session.commit()
    db_session.refresh(p)
    return p


@pytest.fixture
def phieu_in_dang_in(db_session):
    from app.models.cd2 import PhieuIn
    p = PhieuIn(so_phieu="TEST-002", trang_thai="dang_in", so_luong_phoi=100)
    db_session.add(p)
    db_session.commit()
    db_session.refresh(p)
    return p


@pytest.fixture
def phieu_in_cho_dinh_hinh(db_session):
    from app.models.cd2 import PhieuIn
    p = PhieuIn(
        so_phieu="TEST-003", trang_thai="cho_dinh_hinh",
        so_luong_phoi=100, so_luong_in_ok=90,
    )
    db_session.add(p)
    db_session.commit()
    db_session.refresh(p)
    return p


@pytest.fixture
def phieu_in_sau_in(db_session):
    from app.models.cd2 import PhieuIn, MaySauIn
    may = MaySauIn(ten_may="Máy test", sort_order=0)
    db_session.add(may)
    db_session.flush()
    p = PhieuIn(
        so_phieu="TEST-004", trang_thai="sau_in",
        so_luong_phoi=100, so_luong_in_ok=90, may_sau_in_id=may.id,
    )
    db_session.add(p)
    db_session.commit()
    db_session.refresh(p)
    return p


@pytest.fixture
def phieu_in_hoan_thanh(db_session):
    from app.models.cd2 import PhieuIn
    p = PhieuIn(
        so_phieu="TEST-005", trang_thai="hoan_thanh",
        so_luong_phoi=100, so_luong_in_ok=90, so_luong_sau_in_ok=88,
    )
    db_session.add(p)
    db_session.commit()
    db_session.refresh(p)
    return p
