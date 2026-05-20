"""
media.py — Upload ảnh từ điện thoại nhân viên gắn với bất kỳ module ERP nào.
Endpoint:
  POST   /api/media/upload                 — upload 1 ảnh
  GET    /api/media/{module}/{record_id}   — danh sách ảnh của 1 record
  DELETE /api/media/{media_id}             — xóa 1 ảnh

Ảnh lưu tại: uploads/media/{module}/{record_id}/{uuid}.{ext}
"""

import os
import uuid
import mimetypes
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user

router = APIRouter(prefix="/api/media", tags=["media"])

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
MAX_SIZE_MB = 15
UPLOAD_BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "uploads", "media")

# ─── Đảm bảo bảng tồn tại ────────────────────────────────────────────────────
_DDL = """
CREATE TABLE IF NOT EXISTS erp_media (
    id            SERIAL PRIMARY KEY,
    module        VARCHAR(64)  NOT NULL,
    record_id     VARCHAR(128) NOT NULL,
    filename      VARCHAR(255) NOT NULL,
    filepath      VARCHAR(512) NOT NULL,
    mime_type     VARCHAR(64),
    size_bytes    INTEGER,
    uploaded_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    note          TEXT,
    created_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_erp_media_module_record ON erp_media(module, record_id);
"""


def ensure_table(db: Session):
    try:
        db.execute(text(_DDL))
        db.commit()
    except Exception:
        db.rollback()


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
    ensure_table(db)

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

    # Đường dẫn tương đối để lưu DB (phục vụ StaticFiles)
    filepath = f"media/{rel_dir}/{filename}"

    row = db.execute(
        text("""
            INSERT INTO erp_media (module, record_id, filename, filepath, mime_type, size_bytes, uploaded_by, note)
            VALUES (:module, :record_id, :filename, :filepath, :mime_type, :size_bytes, :uploaded_by, :note)
            RETURNING id, created_at
        """),
        {
            "module": module,
            "record_id": record_id,
            "filename": filename,
            "filepath": filepath,
            "mime_type": content_type,
            "size_bytes": len(data),
            "uploaded_by": current_user.id,
            "note": note,
        }
    ).fetchone()
    db.commit()

    return {
        "id": row.id,
        "url": f"/uploads/{filepath}",
        "filename": filename,
        "size_bytes": len(data),
        "created_at": row.created_at.isoformat(),
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
    ensure_table(db)
    rows = db.execute(
        text("""
            SELECT m.id, m.filename, m.filepath, m.mime_type, m.size_bytes, m.note, m.created_at,
                   u.ho_ten as uploader_name, u.username as uploader_username
            FROM erp_media m
            LEFT JOIN users u ON u.id = m.uploaded_by
            WHERE m.module = :module AND m.record_id = :record_id
            ORDER BY m.created_at DESC
        """),
        {"module": module, "record_id": record_id}
    ).fetchall()

    return [
        {
            "id": r.id,
            "url": f"/uploads/{r.filepath}",
            "filename": r.filename,
            "mime_type": r.mime_type,
            "size_bytes": r.size_bytes,
            "note": r.note,
            "created_at": r.created_at.isoformat(),
            "uploaded_by": r.uploader_name or r.uploader_username,
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
    ensure_table(db)
    row = db.execute(
        text("SELECT filepath, uploaded_by FROM erp_media WHERE id = :id"),
        {"id": media_id}
    ).fetchone()

    if not row:
        raise HTTPException(404, "Không tìm thấy ảnh")

    # Chỉ người upload hoặc admin mới được xóa
    is_admin = getattr(current_user, "role", "") in ("ADMIN", "admin")
    if row.uploaded_by != current_user.id and not is_admin:
        raise HTTPException(403, "Bạn không có quyền xóa ảnh này")

    # Xóa file vật lý
    abs_path = os.path.join(UPLOAD_BASE, "..", row.filepath)
    abs_path = os.path.normpath(abs_path)
    if os.path.isfile(abs_path):
        os.remove(abs_path)

    db.execute(text("DELETE FROM erp_media WHERE id = :id"), {"id": media_id})
    db.commit()
    return {"ok": True}
