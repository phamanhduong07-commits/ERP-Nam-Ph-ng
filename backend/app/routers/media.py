"""
media.py — Upload ảnh từ điện thoại nhân viên gắn với bất kỳ module ERP nào.
Endpoint:
  POST   /api/media/upload                 — upload 1 ảnh
  GET    /api/media/{module}/{record_id}   — danh sách ảnh của 1 record
  DELETE /api/media/{media_id}             — xóa 1 ảnh

Ảnh lưu tại: uploads/media/{module}/{record_id}/{uuid}.{ext}
"""

import os
import re
import uuid
import mimetypes
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.media import ErpMedia

router = APIRouter(prefix="/api/media", tags=["media"])

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
MAX_SIZE_MB = 15
UPLOAD_BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "uploads", "media")

_MODULE_RE = re.compile(r"^[a-z][a-z0-9_]{1,62}$")
_RECORD_ID_RE = re.compile(r"^[a-zA-Z0-9_\-]{1,128}$")


def _validate_path_params(module: str, record_id: str) -> None:
    if not _MODULE_RE.match(module):
        raise HTTPException(422, "module chỉ được chứa chữ thường, số và dấu gạch dưới")
    if not _RECORD_ID_RE.match(record_id):
        raise HTTPException(422, "record_id chỉ được chứa chữ, số, dấu gạch ngang và gạch dưới")


# ─── Upload ───────────────────────────────────────────────────────────────────
@router.post("/upload")
async def upload_media(
    module: str = Form(..., description="Ví dụ: purchase_orders, warehouse_receipts, production"),
    record_id: str = Form(..., description="ID của phiếu/đơn hàng"),
    note: str = Form(default=""),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _validate_path_params(module, record_id)

    # Validate MIME
    content_type = file.content_type or ""
    if content_type not in ALLOWED_MIME:
        raise HTTPException(400, f"Chỉ chấp nhận ảnh JPEG/PNG/WebP/HEIC. Nhận được: {content_type}")

    # Đọc nội dung & kiểm tra kích thước
    data = await file.read()
    if len(data) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"Ảnh quá lớn, tối đa {MAX_SIZE_MB}MB")

    # Tạo đường dẫn lưu file
    ext = mimetypes.guess_extension(content_type) or ".jpg"
    if ext == ".jpe":
        ext = ".jpg"
    file_uuid = str(uuid.uuid4())
    rel_dir = os.path.join(module, record_id)
    abs_dir = os.path.join(UPLOAD_BASE, rel_dir)
    os.makedirs(abs_dir, exist_ok=True)

    filename = f"{file_uuid}{ext}"
    abs_path = os.path.join(abs_dir, filename)
    with open(abs_path, "wb") as f:
        f.write(data)

    filepath = f"media/{rel_dir}/{filename}"

    media = ErpMedia(
        module=module,
        record_id=record_id,
        filename=filename,
        filepath=filepath,
        mime_type=content_type,
        size_bytes=len(data),
        uploaded_by=current_user.id,
        note=note or None,
    )
    db.add(media)
    db.commit()
    db.refresh(media)

    return {
        "id": media.id,
        "url": f"/uploads/{filepath}",
        "filename": filename,
        "size_bytes": len(data),
        "created_at": media.created_at.isoformat(),
        "uploaded_by": current_user.ho_ten or current_user.username,
    }


# ─── Danh sách ảnh của 1 record ───────────────────────────────────────────────
@router.get("/{module}/{record_id}")
def list_media(
    module: str,
    record_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _validate_path_params(module, record_id)
    rows = (
        db.query(ErpMedia)
        .filter(ErpMedia.module == module, ErpMedia.record_id == record_id)
        .order_by(ErpMedia.created_at.desc())
        .all()
    )

    return [
        {
            "id": r.id,
            "url": f"/uploads/{r.filepath}",
            "filename": r.filename,
            "mime_type": r.mime_type,
            "size_bytes": r.size_bytes,
            "note": r.note,
            "created_at": r.created_at.isoformat(),
            "uploaded_by": (r.uploader.ho_ten or r.uploader.username) if r.uploader else None,
        }
        for r in rows
    ]


# ─── Xóa ảnh ─────────────────────────────────────────────────────────────────
@router.delete("/{media_id}")
def delete_media(
    media_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    media = db.query(ErpMedia).filter(ErpMedia.id == media_id).first()
    if not media:
        raise HTTPException(404, "Không tìm thấy ảnh")

    # Chỉ người upload hoặc admin mới được xóa
    is_admin = bool(current_user.role and current_user.role.ma_vai_tro == "ADMIN")
    if media.uploaded_by != current_user.id and not is_admin:
        raise HTTPException(403, "Bạn không có quyền xóa ảnh này")

    # Xóa file vật lý
    abs_path = os.path.normpath(os.path.join(UPLOAD_BASE, "..", media.filepath))
    if os.path.isfile(abs_path):
        os.remove(abs_path)

    db.delete(media)
    db.commit()
    return {"ok": True}
