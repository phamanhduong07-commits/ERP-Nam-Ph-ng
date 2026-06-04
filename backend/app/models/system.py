from datetime import datetime
from sqlalchemy import Column, ForeignKey, Integer, String, Text, DateTime, JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class PrintTemplate(Base):
    """Lưu trữ các biểu mẫu in ấn tùy chỉnh (HTML/CSS)"""
    __tablename__ = "print_templates"

    id = Column(Integer, primary_key=True)
    ma_mau = Column(String(50), nullable=False)  # ví dụ: 'delivery_order', 'sales_invoice'
    phap_nhan_id = Column(Integer, nullable=True)  # ID của pháp nhân (NULL nếu dùng chung)
    ten_mau = Column(String(100), nullable=False)
    html_content = Column(Text, nullable=False)
    css_content = Column(Text)
    variables_meta = Column(JSON)  # Lưu danh sách các biến khả dụng: { "so_phieu": "Số phiếu", "ngay": "Ngày" }
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class ExcelTemplate(Base):
    """Lưu trữ cấu hình cột và layout cho việc xuất file Excel"""
    __tablename__ = "excel_templates"

    id = Column(Integer, primary_key=True)
    ma_mau = Column(String(50), nullable=False)
    phap_nhan_id = Column(Integer, nullable=True)
    ten_mau = Column(String(100), nullable=False)
    # [{ "key": "field", "label": "Header", "width": 15 }]
    column_config = Column(JSON, nullable=False)
    # [{ "key": "document_number", "label": "Số phiếu" }, ...]  — info rows above table
    header_config = Column(JSON, nullable=True)
    # { "show_total": true, "sum_columns": ["so_luong", "thanh_tien"],
    #   "show_signatures": true, "signatures": ["Người lập", "Thủ kho"] }
    footer_config = Column(JSON, nullable=True)
    # { "accent_color": "#1B5E20", "alt_row_color": "#F1F8E9",
    #   "orientation": "portrait", "show_company_header": true, "freeze_header": true }
    style_config = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class SystemSetting(Base):
    """Cấu hình hệ thống chung"""
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(Text)
    description = Column(String(255))
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class AgentSession(Base):
    """Lịch sử chat AI — chuyển từ SQLite sang PostgreSQL"""
    __tablename__ = "agent_sessions"

    session_id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    history_json: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    last_active: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )
