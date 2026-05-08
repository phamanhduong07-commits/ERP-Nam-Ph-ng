"""
Model lưu lịch sử import: người import, thời gian, loại dữ liệu,
tên file gốc, số dòng thành công / lỗi, ghi chú.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, func
from app.database import Base


class ImportLog(Base):
    __tablename__ = "import_logs"

    id = Column(Integer, primary_key=True, index=True)
    # Người thực hiện
    user_id = Column(Integer, nullable=True, index=True)
    ten_nguoi_import = Column(String(120), nullable=True)
    # Loại dữ liệu: 'khach_hang', 'nha_cung_cap', 'san_pham', 'vat_tu_giay', ...
    loai_du_lieu = Column(String(80), nullable=False, index=True)
    # Tên file gốc
    ten_file = Column(String(255), nullable=True)
    # Kết quả
    so_dong_thanh_cong = Column(Integer, default=0)
    so_dong_loi = Column(Integer, default=0)
    so_dong_bo_qua = Column(Integer, default=0)
    # Trạng thái: 'success' | 'partial' | 'failed'
    trang_thai = Column(String(20), default='success')
    # Chi tiết lỗi (JSON string hoặc text)
    chi_tiet_loi = Column(Text, nullable=True)
    # Thời gian
    thoi_gian = Column(DateTime, default=func.now(), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "ten_nguoi_import": self.ten_nguoi_import,
            "loai_du_lieu": self.loai_du_lieu,
            "ten_file": self.ten_file,
            "so_dong_thanh_cong": self.so_dong_thanh_cong,
            "so_dong_loi": self.so_dong_loi,
            "so_dong_bo_qua": self.so_dong_bo_qua,
            "trang_thai": self.trang_thai,
            "chi_tiet_loi": self.chi_tiet_loi,
            "thoi_gian": self.thoi_gian.isoformat() if self.thoi_gian else None,
        }
