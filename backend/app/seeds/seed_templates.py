from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.system import PrintTemplate

# Lấy HTML mặc định từ code hiện tại (giả định logic)
DEFAULT_HEADER = """
<div class="doc-head" style="border-bottom: 2px solid var(--primary); padding-bottom: 10px; margin-bottom: 15px;">
    <div class="doc-brand" style="flex: 0 0 100px;">
        {{logo_img}}
    </div>
    <div class="doc-title-block" style="flex: 1; padding-left: 15px;">
        <div class="company-name" style="font-size: 14px; color: var(--primary);">{{company_name}}</div>
        <div class="co-details" style="font-size: 10px; line-height: 1.4;">{{company_details}}</div>
        <div class="document-type" style="margin-top: 10px; font-size: 18px; color: var(--accent);">{{subtitle}}</div>
    </div>
    <div class="doc-meta" style="flex: 0 0 150px; text-align: right; font-size: 10px;">
        {{meta_rows}}
    </div>
</div>
"""

TEMPLATES = [
    {
        "ma_mau": "delivery_order",
        "ten_mau": "Phiếu Giao Hàng",
        "html_content": DEFAULT_HEADER + '<div class="doc-body">{{body_html}}</div>' + '<div class="doc-footer">{{footer_html}}</div>',
        "variables_meta": {
            "company_name": "Tên công ty",
            "subtitle": "Tiêu đề phiếu",
            "body_html": "Nội dung chính (bảng hàng hóa)",
            "footer_html": "Ghi chú chân trang"
        }
    },
    {
        "ma_mau": "cash_receipt",
        "ten_mau": "Phiếu Thu",
        "html_content": DEFAULT_HEADER + '<div class="doc-body">{{body_html}}</div>' + '<div class="doc-footer">{{footer_html}}</div>',
        "variables_meta": {
            "company_name": "Tên công ty",
            "subtitle": "Tiêu đề phiếu",
            "body_html": "Nội dung chi tiết phiếu thu",
            "footer_html": "Ghi chú chân trang"
        }
    },
    {
        "ma_mau": "sales_quote",
        "ten_mau": "Báo Giá",
        "html_content": DEFAULT_HEADER + '<div class="doc-body">{{body_html}}</div>' + '<div class="doc-footer">{{footer_html}}</div>',
        "variables_meta": {
            "company_name": "Tên công ty",
            "subtitle": "Tiêu đề báo giá",
            "body_html": "Nội dung bảng báo giá",
            "footer_html": "Ghi chú chân trang"
        }
    }
]

def seed():
    db = SessionLocal()
    try:
        for t in TEMPLATES:
            exists = db.query(PrintTemplate).filter(PrintTemplate.ma_mau == t["ma_mau"]).first()
            if not exists:
                tpl = PrintTemplate(**t)
                db.add(tpl)
        db.commit()
        print("Seed templates thành công!")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
