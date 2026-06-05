from datetime import date, datetime, time
from decimal import Decimal
import unicodedata
from sqlalchemy.orm import Session, joinedload
from app.models.hr import Employee, PayrollConfig, AttendanceLog
from app.models.cd2 import ScanLog


STAGE_LABELS = {
    "MAY_SONG_CD1": "May song (CD1)",
    "XA": "Xa",
    "IN": "In",
    "CAN_MANG": "Can mang",
    "THANH_PHAM": "Thanh pham",
    "ALL": "Tong san luong xuong",
}


def _norm(value: str | None) -> str:
    if not value:
        return ""
    raw = unicodedata.normalize("NFD", value)
    raw = "".join(ch for ch in raw if unicodedata.category(ch) != "Mn")
    return raw.upper()


def _workshop_rule(name: str | None, code: str | None = None) -> str:
    text = f"{_norm(name)} {_norm(code)}"
    if "HOC MON" in text or "HM" in text:
        return "time"
    if "CU CHI" in text or "CC" in text:
        return "whole_m2"
    if "HOANG GIA" in text or "NAM THUAN" in text or "HG" in text or "NT" in text:
        return "staged_m2"
    return "staged_m2"


def _stage_from_scan(log: ScanLog) -> str:
    text = " ".join([
        _norm(getattr(log.may_scan_obj, "ten_may", None)),
        _norm(log.ten_hang),
        _norm(log.so_lsx),
    ])
    if "SONG" in text or "CD1" in text:
        return "MAY_SONG_CD1"
    if "CAN MANG" in text or "MANG" in text:
        return "CAN_MANG"
    if "THANH PHAM" in text or "TP" in text:
        return "THANH_PHAM"
    if "XA" in text:
        return "XA"
    if "IN" in text:
        return "IN"
    return "IN"


def _cfg_key(phan_xuong_id: int | None, cong_doan: str | None) -> str:
    if phan_xuong_id and cong_doan:
        return f"PX{phan_xuong_id}_{cong_doan}"
    return cong_doan or ""


class PayrollService:
    @staticmethod
    def calculate_production_salary(db: Session, from_date: date, to_date: date):
        configs = db.query(PayrollConfig).filter(PayrollConfig.trang_thai.is_(True)).all()
        config_by_scope = {
            (c.phan_xuong_id, c.cong_doan): c
            for c in configs
            if c.cong_doan and c.loai != "so_lop_giay"
        }
        config_by_code = {c.ma_hang: c for c in configs if c.loai != "so_lop_giay"}
        # Hệ số máy sóng theo số lớp: ma_cau_hinh → gia_tri (ví dụ: "3"→1.0, "5"→2.0, "7"→3.0)
        so_lop_hs_map: dict[str, Decimal] = {
            c.ma_cau_hinh: (c.gia_tri or Decimal("1"))
            for c in configs
            if c.loai == "so_lop_giay" and c.ma_cau_hinh
        }

        from_dt = datetime.combine(from_date, time.min)
        to_dt = datetime.combine(to_date, time.max)
        logs = db.query(ScanLog).options(
            joinedload(ScanLog.may_scan_obj),
        ).filter(
            ScanLog.created_at >= from_dt,
            ScanLog.created_at <= to_dt
        ).all()

        group_funds: dict[str, dict] = {}
        skipped_hoc_mon_m2 = Decimal("0")

        for log in logs:
            px = getattr(log.may_scan_obj, "phan_xuong_obj", None) if log.may_scan_obj else None
            phan_xuong_id = getattr(log.may_scan_obj, "phan_xuong_id", None)
            rule = _workshop_rule(getattr(px, "ten_xuong", None), getattr(px, "ma_xuong", None))
            m2 = log.dien_tich or Decimal("0")
            if m2 <= 0:
                continue
            if rule == "time":
                skipped_hoc_mon_m2 += m2
                continue

            cong_doan = "ALL" if rule == "whole_m2" else _stage_from_scan(log)
            cfg = (
                config_by_scope.get((phan_xuong_id, cong_doan))
                or config_by_scope.get((None, cong_doan))
                or config_by_code.get(_cfg_key(phan_xuong_id, cong_doan))
                or config_by_code.get(cong_doan)
            )
            if not cfg:
                continue

            key = _cfg_key(phan_xuong_id, cong_doan)
            if key not in group_funds:
                group_funds[key] = {
                    "phan_xuong_id": phan_xuong_id,
                    "ten_xuong": getattr(px, "ten_xuong", None),
                    "cong_doan": cong_doan,
                    "ten_cong_doan": STAGE_LABELS.get(cong_doan, cong_doan),
                    "don_gia": cfg.don_gia or Decimal("0"),
                    "phan_tram_luong_sp": cfg.phan_tram_luong_sp or Decimal("100"),
                    "tong_m2": Decimal("0"),
                    "quy_luong": Decimal("0"),
                    "logs": [],
                }

            don_gia = cfg.don_gia or Decimal("0")
            pct = cfg.phan_tram_luong_sp or Decimal("100")
            # Áp hệ số số lớp giấy cho máy sóng nếu có config so_lop_giay
            he_so_so_lop = Decimal("1")
            if cong_doan == "MAY_SONG_CD1" and so_lop_hs_map:
                po = getattr(log, "production_order", None)
                so_lop = getattr(po, "so_lop", None) if po else None
                if so_lop is not None:
                    he_so_so_lop = (
                        so_lop_hs_map.get(str(so_lop))
                        or so_lop_hs_map.get(f"HS_{so_lop}_LOP")
                        or Decimal("1")
                    )
            fund = m2 * don_gia * (pct / Decimal("100")) * he_so_so_lop
            group_funds[key]["tong_m2"] += m2
            group_funds[key]["quy_luong"] += fund
            group_funds[key]["logs"].append(log)

        employees = db.query(Employee).all()
        user_to_emp = {e.user_id: e for e in employees if e.user_id}
        active_by_workshop: dict[int, list[Employee]] = {}
        for emp in employees:
            if emp.trang_thai != "dang_lam" or not emp.phan_xuong_id:
                continue
            active_by_workshop.setdefault(emp.phan_xuong_id, []).append(emp)

        att_logs = db.query(AttendanceLog).filter(
            AttendanceLog.ngay >= from_date,
            AttendanceLog.ngay <= to_date
        ).all()
        emp_work_map: dict[int, Decimal] = {}
        for al in att_logs:
            emp_work_map[al.employee_id] = emp_work_map.get(al.employee_id, Decimal("0")) + (al.so_cong or Decimal("0"))

        final_payroll: dict[int, dict] = {}

        for group in group_funds.values():
            tong_trong_so_nhom = Decimal("0")
            group_details = []
            group_employees: list[Employee] = []

            if group["cong_doan"] == "ALL" and group["phan_xuong_id"]:
                group_employees = active_by_workshop.get(group["phan_xuong_id"], [])
            else:
                participants = list({log.created_by for log in group["logs"] if log.created_by})
                group_employees = [user_to_emp[user_id] for user_id in participants if user_to_emp.get(user_id)]

            if not group_employees and group["phan_xuong_id"]:
                group_employees = active_by_workshop.get(group["phan_xuong_id"], [])

            for emp in group_employees:
                cong = emp_work_map.get(emp.id, Decimal("1.0"))
                trong_so = (emp.he_so_ca_nhan or Decimal("1")) * cong
                if trong_so <= 0:
                    continue
                tong_trong_so_nhom += trong_so
                group_details.append({"emp": emp, "trong_so": trong_so, "cong": cong})

            if tong_trong_so_nhom <= 0:
                continue

            for item in group_details:
                emp = item["emp"]
                luong_sp = (group["quy_luong"] * item["trong_so"]) / tong_trong_so_nhom
                if emp.id not in final_payroll:
                    final_payroll[emp.id] = {
                        "employee_id": emp.id,
                        "ma_nv": emp.ma_nv,
                        "ho_ten": emp.ho_ten,
                        "he_so": float(emp.he_so_ca_nhan or 0),
                        "cong_quy_doi": float(item["cong"] or 0),
                        "tong_m2": 0.0,
                        "luong_sp": Decimal("0"),
                        "details": [],
                    }
                final_payroll[emp.id]["luong_sp"] += luong_sp
                final_payroll[emp.id]["tong_m2"] += float(group["tong_m2"])
                final_payroll[emp.id]["details"].append({
                    "phan_xuong_id": group["phan_xuong_id"],
                    "ten_xuong": group["ten_xuong"],
                    "cong_doan": group["cong_doan"],
                    "ten_cong_doan": group["ten_cong_doan"],
                    "tong_m2": round(float(group["tong_m2"]), 2),
                    "don_gia": float(group["don_gia"]),
                    "quy_luong": round(float(group["quy_luong"]), 0),
                    "luong": round(float(luong_sp), 0),
                })

        return [
            {
                **row,
                "tong_m2": round(float(row["tong_m2"]), 2),
                "luong_sp": round(float(row["luong_sp"]), 0),
            }
            for row in final_payroll.values()
        ]
