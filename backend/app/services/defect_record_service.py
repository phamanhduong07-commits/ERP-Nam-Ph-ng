"""Auto-create / upsert DefectRecord khi so_luong_loi > 0 được lưu.

Dùng chung cho mọi điểm trigger: ProductionOutput, PhieuNhapPhoiSongItem.
Gọi db.flush() sau khi xong — caller chịu trách nhiệm commit cuối.
"""
from decimal import Decimal
from typing import Optional
from sqlalchemy.orm import Session


def auto_defect_record(
    db: Session,
    ref_id: int,
    ref_type: str,
    khau: str,
    so_luong: Decimal,
    created_by: Optional[int] = None,
    phan_xuong_id: Optional[int] = None,
    phap_nhan_id: Optional[int] = None,
) -> None:
    """Tạo hoặc cập nhật DefectRecord tương ứng.

    - so_luong > 0 → create (nếu chưa có) hoặc update so_luong (nếu đã có).
    - so_luong == 0 → void record đang ở cho_xu_ly (set trang_thai='huy').
    """
    from app.models.defect_records import DefectRecord

    existing = (
        db.query(DefectRecord)
        .filter(DefectRecord.ref_type == ref_type, DefectRecord.ref_id == ref_id)
        .first()
    )

    if so_luong <= 0:
        if existing and existing.trang_thai == "cho_xu_ly":
            existing.trang_thai = "huy"
        db.flush()
        return

    if existing:
        existing.so_luong = so_luong
        if existing.trang_thai == "huy":
            existing.trang_thai = "cho_xu_ly"
    else:
        db.add(DefectRecord(
            ref_type=ref_type,
            ref_id=ref_id,
            khau=khau,
            so_luong=so_luong,
            trang_thai="cho_xu_ly",
            created_by=created_by,
            phan_xuong_id=phan_xuong_id,
            phap_nhan_id=phap_nhan_id,
        ))
    db.flush()
