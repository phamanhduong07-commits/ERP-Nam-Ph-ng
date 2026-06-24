"""
Force-update các template đã sửa lỗi trong DB.
Chạy: python -m app.seeds.force_update_templates
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from app.database import SessionLocal
from app.models.system import PrintTemplate
from app.seeds.seed_templates import TEMPLATES

# Danh sách ma_mau cần force-update (không cho phép user customize nếu bị lỗi kỹ thuật)
FORCE_UPDATE_MAUS = {"CASH_RECEIPT", "CASH_PAYMENT", "PAPER_ROLL_LABEL", "SALES_QUOTE", "PURCHASE_ORDER"}

def force_update():
    db = SessionLocal()
    try:
        updated = []
        for t in TEMPLATES:
            if t["ma_mau"] not in FORCE_UPDATE_MAUS:
                continue
            pn_id = t.get("phap_nhan_id")
            q = db.query(PrintTemplate).filter(PrintTemplate.ma_mau == t["ma_mau"])
            if pn_id is None:
                q = q.filter(PrintTemplate.phap_nhan_id.is_(None))
            else:
                q = q.filter(PrintTemplate.phap_nhan_id == pn_id)
            exists = q.first()
            if exists:
                exists.html_content = t["html_content"]
                if "ten_mau" in t:
                    exists.ten_mau = t["ten_mau"]
                updated.append(t["ma_mau"])
            else:
                db.add(PrintTemplate(**t))
                updated.append(f"{t['ma_mau']} (mới)")
        db.commit()
        print(f"Force-update thành công: {', '.join(updated)}")
    finally:
        db.close()

if __name__ == "__main__":
    force_update()
