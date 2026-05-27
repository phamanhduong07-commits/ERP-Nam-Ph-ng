"""
ocr_examples.py — Quản lý ảnh mẫu phiếu xuất NCC cho few-shot OCR.
  Mỗi NCC có 2-5 ảnh mẫu + JSON đúng đã verify.
  Khi OCR ảnh mới, hệ thống tự load ảnh mẫu của NCC đó → few-shot prompt → chính xác hơn.
"""
import unicodedata
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.warehouse_doc import OcrSupplierExample

router = APIRouter(prefix="/api/ocr-examples", tags=["OCR Examples"])

UPLOAD_DIR = Path(__file__).parent.parent.parent / "uploads" / "ocr_examples"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_PER_SUPPLIER = 5


def _normalize(name: str) -> str:
    """Lowercase + bỏ dấu + strip — dùng để so sánh fuzzy tên NCC."""
    nfkd = unicodedata.normalize("NFKD", name)
    ascii_str = "".join(c for c in nfkd if not unicodedata.combining(c))
    return ascii_str.lower().strip()


# ── List all examples (grouped by supplier) ───────────────────────────────────

@router.get("")
def list_examples(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(OcrSupplierExample).order_by(
        OcrSupplierExample.ten_ncc_chuan, OcrSupplierExample.id
    ).all()
    return [_to_dict(r) for r in rows]


@router.get("/suppliers")
def list_suppliers(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Trả về danh sách NCC đã có ảnh mẫu + số lượng."""
    from sqlalchemy import func
    rows = (
        db.query(OcrSupplierExample.ten_ncc_chuan, func.count().label("so_mau"))
        .group_by(OcrSupplierExample.ten_ncc_chuan)
        .order_by(OcrSupplierExample.ten_ncc_chuan)
        .all()
    )
    return [{"ten_ncc_chuan": r.ten_ncc_chuan, "so_mau": r.so_mau} for r in rows]


# ── Upload example ─────────────────────────────────────────────────────────────

@router.post("", status_code=201)
async def create_example(
    ten_ncc: str = Form(...),
    extracted_json: str = Form(...),
    ghi_chu: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload ảnh mẫu + JSON đúng đã verify cho một NCC."""
    ten_ncc_chuan = _normalize(ten_ncc)

    # Giới hạn MAX_PER_SUPPLIER ảnh mỗi NCC
    count = db.query(OcrSupplierExample).filter(
        OcrSupplierExample.ten_ncc_chuan == ten_ncc_chuan
    ).count()
    if count >= MAX_PER_SUPPLIER:
        raise HTTPException(
            400,
            f"NCC '{ten_ncc}' đã có {count} ảnh mẫu (tối đa {MAX_PER_SUPPLIER}). "
            "Xóa bớt ảnh cũ trước khi thêm mới."
        )

    # Lưu file
    ext = Path(file.filename).suffix.lower() if file.filename else ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / filename
    content = await file.read()
    dest.write_bytes(content)

    rel_path = f"ocr_examples/{filename}"

    example = OcrSupplierExample(
        ten_ncc=ten_ncc.strip(),
        ten_ncc_chuan=ten_ncc_chuan,
        img_path=rel_path,
        extracted_json=extracted_json,
        ghi_chu=ghi_chu,
        created_by=current_user.id,
    )
    db.add(example)
    db.commit()
    db.refresh(example)
    return _to_dict(example)


# ── Delete ─────────────────────────────────────────────────────────────────────

@router.delete("/{example_id}", status_code=204)
def delete_example(
    example_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    ex = db.get(OcrSupplierExample, example_id)
    if not ex:
        raise HTTPException(404, "Không tìm thấy ảnh mẫu")
    # Xóa file vật lý
    upload_base = Path(__file__).parent.parent.parent / "uploads"
    img = upload_base / ex.img_path
    if img.is_file():
        img.unlink(missing_ok=True)
    db.delete(ex)
    db.commit()


# ── Internal: load examples for a supplier (dùng bởi warehouse router) ────────

def get_examples_for_supplier(
    ten_ncc_detected: str, db: Session, limit: int = 3
) -> list[dict]:
    """
    Load ảnh mẫu phù hợp nhất cho NCC được nhận diện.
    So sánh fuzzy qua ten_ncc_chuan.
    """
    if not ten_ncc_detected:
        return []

    normalized = _normalize(ten_ncc_detected)

    # Tìm exact match trước
    rows = (
        db.query(OcrSupplierExample)
        .filter(OcrSupplierExample.ten_ncc_chuan == normalized)
        .limit(limit)
        .all()
    )

    # Nếu không có exact, tìm partial (tên NCC detect chứa keyword của mẫu)
    if not rows:
        keywords = [w for w in normalized.split() if len(w) >= 4]
        for kw in keywords:
            rows = (
                db.query(OcrSupplierExample)
                .filter(OcrSupplierExample.ten_ncc_chuan.contains(kw))
                .limit(limit)
                .all()
            )
            if rows:
                break

    if not rows:
        return []

    upload_base = Path(__file__).parent.parent.parent / "uploads"
    return [
        {
            "img_path": str(upload_base / r.img_path),
            "extracted_json": r.extracted_json,
            "ten_ncc": r.ten_ncc,
        }
        for r in rows
        if (upload_base / r.img_path).is_file()
    ]


def _to_dict(r: OcrSupplierExample) -> dict:
    return {
        "id": r.id,
        "ten_ncc": r.ten_ncc,
        "ten_ncc_chuan": r.ten_ncc_chuan,
        "img_path": r.img_path,
        "img_url": f"/uploads/{r.img_path}",
        "extracted_json": r.extracted_json,
        "ghi_chu": r.ghi_chu,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }
