from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from io import BytesIO
from typing import Any, Callable

import json
import pandas as pd
from fastapi import HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from sqlalchemy.orm import Session
from app.models.import_log import ImportLog
from app.models.auth import User


Parser = Callable[[Any], Any]
Resolver = Callable[[Session, dict[str, Any]], tuple[dict[str, Any], list[str]]]


@dataclass(frozen=True)
class ImportField:
    name: str
    label: str
    required: bool = False
    parser: Parser | None = None
    default: Any = None
    aliases: tuple[str, ...] = ()
    help_text: str = ""


def parse_text(value: Any) -> str | None:
    if value is None or pd.isna(value):
        return None
    text = str(value).strip()
    return text or None


def parse_int(value: Any) -> int | None:
    if value is None or pd.isna(value) or str(value).strip() == "":
        return None
    try:
        return int(float(str(value).replace(",", "").strip()))
    except ValueError as exc:
        raise ValueError("phai la so nguyen") from exc


def parse_decimal(value: Any) -> Decimal | None:
    if value is None or pd.isna(value) or str(value).strip() == "":
        return None
    text = str(value).replace(",", "").strip()
    try:
        return Decimal(text)
    except (InvalidOperation, ValueError) as exc:
        raise ValueError("phai la so") from exc


def parse_date(value: Any) -> date | None:
    if value is None or pd.isna(value) or str(value).strip() == "":
        return None
    if isinstance(value, date):
        return value
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y"):
        try:
            from datetime import datetime as _dt
            return _dt.strptime(text, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"không nhận dạng được ngày: {text!r}")


def parse_bool(value: Any) -> bool | None:
    if value is None or pd.isna(value) or str(value).strip() == "":
        return None
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "y", "co", "có", "x", "active", "hoat dong", "hoạt động"}:
        return True
    if text in {"0", "false", "no", "n", "khong", "không", "inactive", "ngung", "ngừng"}:
        return False
    raise ValueError("phai la dung/sai")


def build_template_response(filename: str, fields: list[ImportField]) -> StreamingResponse:
    wb = Workbook()
    ws = wb.active
    ws.title = "Du lieu import"
    ws.append([field.label for field in fields])
    ws.append([_sample_value(field) for field in fields])

    guide = wb.create_sheet("Huong dan")
    guide.append(["Cot", "Bat buoc", "Ghi chu"])
    for field in fields:
        guide.append([field.label, "Co" if field.required else "Khong", field.help_text])

    for sheet in wb.worksheets:
        for col in sheet.columns:
            width = max(len(str(cell.value or "")) for cell in col) + 2
            sheet.column_dimensions[col[0].column_letter].width = min(max(width, 12), 42)

    stream = BytesIO()
    wb.save(stream)
    stream.seek(0)
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


async def import_excel(
    *,
    db: Session,
    file: UploadFile,
    model: Any,
    fields: list[ImportField],
    key_field: str,
    commit: bool,
    resolver: Resolver | None = None,
    user: User | None = None,
    loai_du_lieu: str = "khac",
) -> dict[str, Any]:
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Chi chap nhan file Excel .xlsx/.xls")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="File rong")

    try:
        df = pd.read_excel(BytesIO(raw), dtype=object)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Khong doc duoc file Excel: {exc}") from exc

    if df.empty:
        raise HTTPException(status_code=400, detail="File khong co du lieu")

    column_map = _build_column_map(df.columns, fields)
    missing = [field.label for field in fields if field.required and field.name not in column_map]
    if missing:
        raise HTTPException(status_code=400, detail=f"Thieu cot bat buoc: {', '.join(missing)}")

    rows: list[dict[str, Any]] = []
    created = updated = skipped = 0
    has_error = False
    objects_to_save: list[tuple[Any | None, dict[str, Any]]] = []
    error_details: list[str] = []

    for idx, source in df.iterrows():
        row_number = int(idx) + 2
        values: dict[str, Any] = {}
        row_errors: list[str] = []

        if _is_blank_row(source):
            skipped += 1
            rows.append({"row": row_number, "status": "skip", "errors": [], "data": {}})
            continue

        for field in fields:
            raw_value = source[column_map[field.name]] if field.name in column_map else None
            try:
                parsed = field.parser(raw_value) if field.parser else parse_text(raw_value)
            except ValueError as exc:
                row_errors.append(f"{field.label}: {exc}")
                parsed = None

            if parsed is None and field.default is not None:
                parsed = field.default() if callable(field.default) else field.default

            if field.required and (parsed is None or parsed == ""):
                row_errors.append(f"{field.label}: bat buoc")

            if parsed is not None:
                values[field.name] = parsed

        if resolver:
            resolved_values, resolve_errors = resolver(db, values)
            values = resolved_values
            row_errors.extend(resolve_errors)

        key_value = values.get(key_field)
        existing = None
        if key_value:
            existing = db.query(model).filter(getattr(model, key_field) == key_value).first()

        status = "error" if row_errors else ("update" if existing else "create")
        if row_errors:
            has_error = True
            error_details.append(f"Dong {row_number}: {'; '.join(row_errors)}")
        elif existing:
            updated += 1
            objects_to_save.append((existing, values))
        else:
            created += 1
            objects_to_save.append((None, values))

        rows.append({"row": row_number, "status": status, "errors": row_errors, "data": _jsonable(values)})

    if commit:
        if has_error:
            # Ghi log that bai neu commit ma co loi
            if user:
                log = ImportLog(
                    user_id=user.id,
                    ten_nguoi_import=user.full_name or user.username,
                    loai_du_lieu=loai_du_lieu,
                    ten_file=file.filename,
                    so_dong_thanh_cong=0,
                    so_dong_loi=len(error_details),
                    so_dong_bo_qua=skipped,
                    trang_thai='failed',
                    chi_tiet_loi="\n".join(error_details[:500]),
                )
                db.add(log)
                db.commit()
            raise HTTPException(status_code=400, detail="File con loi, chua import. Hay sua loi va thu lai.")
        
        for existing, values in objects_to_save:
            if existing:
                for field, value in values.items():
                    setattr(existing, field, value)
            else:
                db.add(model(**values))
        
        # Ghi log thanh cong
        if user:
            log = ImportLog(
                user_id=user.id,
                ten_nguoi_import=user.full_name or user.username,
                loai_du_lieu=loai_du_lieu,
                ten_file=file.filename,
                so_dong_thanh_cong=created + updated,
                so_dong_loi=0,
                so_dong_bo_qua=skipped,
                trang_thai='success',
            )
            db.add(log)
        
        db.commit()

    return {
        "commit": commit,
        "total": len(rows),
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "errors": sum(1 for row in rows if row["status"] == "error"),
        "rows": rows[:200],
    }


def _build_column_map(columns: Any, fields: list[ImportField]) -> dict[str, str]:
    normalized = {_normalize(col): col for col in columns}
    result: dict[str, str] = {}
    for field in fields:
        candidates = (field.label, field.name, *field.aliases)
        for candidate in candidates:
            key = _normalize(candidate)
            if key in normalized:
                result[field.name] = normalized[key]
                break
    return result


def _normalize(value: Any) -> str:
    return str(value).strip().lower().replace(" ", "_")


def _is_blank_row(row: Any) -> bool:
    return all(value is None or pd.isna(value) or str(value).strip() == "" for value in row.values)


def _jsonable(values: dict[str, Any]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in values.items():
        result[key] = str(value) if isinstance(value, Decimal) else value
    return result


def _sample_value(field: ImportField) -> Any:
    samples = {
        "ma_kh": "KH001",
        "ma_ncc": "NCC001",
        "ma_amis": "SP001",
        "ten_viet_tat": "Ten ngan",
        "ten_hang": "Thung carton 3 lop",
        "dvt": "Thung",
        "so_lop": 3,
        "so_mau": 0,
        "gia_ban": 0,
        "trang_thai": 1,
    }
    return samples.get(field.name, "")
