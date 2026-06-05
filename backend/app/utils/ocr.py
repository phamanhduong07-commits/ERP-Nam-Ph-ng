"""
ocr.py — Đọc ảnh phiếu xuất NCC → structured JSON qua Gemini Vision API.

  Pipeline 2 bước khi có ảnh mẫu (few-shot):
    1. identify_supplier() — Gemini nhận diện tên NCC (gọi nhanh, ít token)
    2. extract_delivery_slip(few_shot_examples) — few-shot với ảnh mẫu của NCC đó

  Khi chưa có ảnh mẫu nào: zero-shot (1 bước, hành vi cũ).

  Cấu hình: GEMINI_API_KEY trong backend/.env
"""
import base64
import json
import mimetypes
import re
from pathlib import Path

from google import genai
from google.genai import types
from app.utils.log import get_logger
from app.config import settings

logger = get_logger(__name__)

GEMINI_API_KEY = settings.GEMINI_API_KEY
GEMINI_MODEL = settings.GEMINI_MODEL

_EXTRACT_PROMPT = """Đây là ảnh phiếu xuất hàng / biên bản giao hàng của nhà cung cấp.
Hãy trích xuất thông tin và trả về đúng định dạng JSON, KHÔNG có văn bản nào khác ngoài JSON:

{
  "ten_ncc": "tên nhà cung cấp hoặc null",
  "ngay_xuat": "ngày dạng DD/MM/YYYY hoặc YYYY-MM-DD hoặc null",
  "so_xe": "biển số xe hoặc null",
  "hang_hoa": [
    {
      "ten": "tên hàng hóa",
      "dvt": "đơn vị tính (Kg, Cuộn, Cái, m², thùng...) hoặc null",
      "so_luong": <số lượng thực tế theo DVT hoặc null>,
      "don_gia": <đơn giá số thực hoặc null>,
      "kho_mm": <khổ rộng mm — chỉ có với giấy cuộn hoặc null>,
      "gsm": <định lượng g/m² — chỉ có với giấy cuộn hoặc null>,
      "ky_hieu": "ký hiệu lô/cuộn hoặc null",
      "so_cuon": <số cuộn nguyên — chỉ có với giấy cuộn hoặc null>,
      "trong_luong_kg": <tổng kg lô này — chỉ có với giấy cuộn hoặc null>
    }
  ],
  "tong_tien": <tổng tiền số thực hoặc null>,
  "tong_kg": <tổng kg — chỉ điền nếu là giấy cuộn hoặc null>,
  "ghi_chu": "ghi chú hoặc null"
}

Lưu ý:
- dvt: đọc từ cột ĐVT/DVT trên phiếu. Ví dụ: Kg, Cuộn, Cái, Thùng, m²
- so_luong: số lượng theo đơn vị DVT (không phải kg nếu DVT là Cuộn)
- don_gia: đơn giá mỗi DVT
- kho_mm: chỉ điền nếu phiếu là giấy cuộn, có cột Khổ/K:
- Nếu có nhiều dòng hàng, tạo nhiều phần tử trong hang_hoa
- Nếu không tìm thấy thông tin, để null
- Chỉ trả về JSON thuần, không markdown, không giải thích"""

_IDENTIFY_PROMPT = (
    "Nhìn vào ảnh phiếu xuất hàng này, tên nhà cung cấp (NCC) là gì? "
    "Chỉ trả về tên công ty, không giải thích, không thêm gì khác."
)


def _make_client() -> genai.Client:
    if not GEMINI_API_KEY:
        raise RuntimeError(
            "Chưa cấu hình GEMINI_API_KEY trong file .env — "
            "lấy key tại https://aistudio.google.com/app/apikey"
        )
    return genai.Client(api_key=GEMINI_API_KEY)


def _img_part(img_path: str) -> types.Part:
    mime = mimetypes.guess_type(img_path)[0] or "image/jpeg"
    data = Path(img_path).read_bytes()
    return types.Part.from_bytes(data=data, mime_type=mime)


def _call_gemini(contents: list, client: genai.Client) -> str:
    try:
        resp = client.models.generate_content(model=GEMINI_MODEL, contents=contents)
        return resp.text.strip()
    except Exception as e:
        err = str(e)
        if "API_KEY_INVALID" in err or "API key not valid" in err:
            raise RuntimeError("GEMINI_API_KEY không hợp lệ — kiểm tra lại key trong .env")
        if "quota" in err.lower() or "429" in err:
            raise RuntimeError("Gemini API vượt quota — thử lại sau hoặc nâng cấp plan")
        raise RuntimeError(f"Gemini API lỗi: {err[:300]}")


_EXTRACT_PHIEU_GIAO_PROMPT = """Đây là ảnh phiếu bán hàng (phiếu giao hàng) của công ty Nam Phương Bao Bì.
Hãy trích xuất thông tin và trả về đúng định dạng JSON, KHÔNG có văn bản nào khác ngoài JSON:

{
  "ten_khach": "tên khách hàng hoặc null",
  "so_phieu": "số phiếu bán hàng (dạng PBH-... hoặc DO-...) hoặc null",
  "ngay_giao": "ngày giao dạng DD/MM/YYYY hoặc YYYY-MM-DD hoặc null",
  "ten_nguoi_nhan": "tên người nhận hàng đã ký tên hoặc null",
  "hang_hoa": [
    {
      "ten": "tên hàng hóa / mã hàng",
      "so_luong": <số nguyên hoặc null>,
      "dvt": "đơn vị tính (thùng, cái, m², kg...)",
      "don_gia": <số thực hoặc null>,
      "thanh_tien": <số thực hoặc null>
    }
  ],
  "tong_tien": <tổng tiền số thực hoặc null>,
  "ghi_chu": "ghi chú hoặc null"
}

Lưu ý:
- ten_nguoi_nhan: tìm ở ô "Người nhận hàng", "Khách hàng ký", hoặc chữ ký cuối phiếu
- so_phieu: thường ở góc trên phải, dạng PBH-YYYYMMDD-XXX
- ngay_giao: tìm ở "Ngày giao", "Ngày xuất", hoặc ngày trên phiếu
- Chỉ trả về JSON thuần, không markdown, không giải thích"""


def extract_phieu_giao_hang(img_path: str) -> dict:
    """
    OCR phiếu bán hàng / phiếu giao hàng Nam Phương.
    Trích xuất: ten_khach, ten_nguoi_nhan, so_phieu, ngay_giao, hang_hoa, tong_tien.
    Trả về: {"raw_text": str, "extracted": dict}
    """
    if not Path(img_path).is_file():
        raise RuntimeError(f"File ảnh không tồn tại: {img_path}")

    client = _make_client()
    sz_kb = Path(img_path).stat().st_size // 1024
    logger.info("Gemini OCR phiếu giao hàng: %s (%d KB)", Path(img_path).name, sz_kb)

    content = _call_gemini([_img_part(img_path), _EXTRACT_PHIEU_GIAO_PROMPT], client)
    logger.info("Gemini response: %d chars", len(content))

    json_match = re.search(r"\{[\s\S]*\}", content)
    if not json_match:
        logger.warning("No JSON in Gemini response: %s", content[:200])
        return {"raw_text": content, "extracted": {}, "warning": "Không phân tích được JSON từ Gemini"}

    try:
        extracted = json.loads(json_match.group())
    except json.JSONDecodeError as e:
        logger.error("JSON parse error: %s | %s", e, content[:300])
        return {"raw_text": content, "extracted": {}, "warning": "JSON từ Gemini bị lỗi định dạng"}

    logger.info("OCR phiếu giao done: %d fields", len(extracted))
    return {"raw_text": content, "extracted": extracted}


def identify_supplier(img_path: str) -> str | None:
    """
    Bước 1: Nhận diện tên NCC từ ảnh phiếu — gọi nhanh, ít token.
    Trả về tên NCC (string) hoặc None nếu không nhận ra.
    """
    if not Path(img_path).is_file():
        return None
    try:
        client = _make_client()
        name = _call_gemini([_img_part(img_path), _IDENTIFY_PROMPT], client)
        logger.info("Identified supplier: %s", name)
        return name if name and len(name) < 300 else None
    except Exception as e:
        logger.warning("identify_supplier failed: %s", e)
        return None


def extract_delivery_slip(
    img_path: str,
    few_shot_examples: list[dict] | None = None,
) -> dict:
    """
    Gửi ảnh lên Gemini Vision → structured JSON.

    few_shot_examples: list of {"img_path": str, "extracted_json": str, "ten_ncc": str}
      Nếu có → few-shot: Gemini thấy ví dụ mẫu trước khi đọc ảnh mới.
      Nếu None/[] → zero-shot (hành vi cũ).

    Trả về: {"raw_text": str, "extracted": dict, "few_shot_count": int}
    """
    if not Path(img_path).is_file():
        raise RuntimeError(f"File ảnh không tồn tại: {img_path}")

    client = _make_client()
    sz_kb = Path(img_path).stat().st_size // 1024
    n_examples = len(few_shot_examples) if few_shot_examples else 0
    logger.info("Gemini OCR: %s (%d KB), few-shot=%d", Path(img_path).name, sz_kb, n_examples)

    contents: list = []

    # ── Few-shot: thêm ảnh mẫu + JSON đúng trước ──────────────────────────────
    if few_shot_examples:
        contents.append(
            "Dưới đây là một số ví dụ phiếu xuất NCC và kết quả trích xuất đúng. "
            "Hãy học từ các ví dụ này để đọc ảnh cuối cùng chính xác hơn.\n"
        )
        for i, ex in enumerate(few_shot_examples, 1):
            ex_path = ex.get("img_path", "")
            if not Path(ex_path).is_file():
                continue
            contents.append(f"--- Ví dụ {i} ---")
            contents.append(_img_part(ex_path))
            contents.append(f"Kết quả đúng cho ví dụ {i}:\n```json\n{ex['extracted_json']}\n```\n")

        contents.append("--- Ảnh cần đọc ---")

    # ── Ảnh thực tế + prompt ───────────────────────────────────────────────────
    contents.append(_img_part(img_path))
    contents.append(_EXTRACT_PROMPT)

    content = _call_gemini(contents, client)
    logger.info("Gemini response: %d chars", len(content))

    json_match = re.search(r"\{[\s\S]*\}", content)
    if not json_match:
        logger.warning("No JSON in Gemini response: %s", content[:200])
        return {
            "raw_text": content,
            "extracted": {},
            "few_shot_count": n_examples,
            "warning": "Không phân tích được JSON từ Gemini",
        }

    try:
        extracted = json.loads(json_match.group())
    except json.JSONDecodeError as e:
        logger.error("JSON parse error: %s | %s", e, content[:300])
        return {
            "raw_text": content,
            "extracted": {},
            "few_shot_count": n_examples,
            "warning": "JSON từ Gemini bị lỗi định dạng",
        }

    logger.info("OCR done: %d fields, few_shot=%d", len(extracted), n_examples)
    return {"raw_text": content, "extracted": extracted, "few_shot_count": n_examples}
