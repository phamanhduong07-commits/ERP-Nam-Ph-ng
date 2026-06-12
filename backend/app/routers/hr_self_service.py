import logging
import math
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.hr import (
    Employee, PayrollRun, AttendanceLog, LeaveRequest, CheckInLocation, BenefitRecord,
    HealthCheck, KPIEvaluation, KPICycle, KPIScore,
)
from app.models.auth import User
from app.routers.auth import get_current_user
from app.schemas import hr as schemas
from app.utils import hr_roles as hrr

logger = logging.getLogger("erp.hr.checkin")
router = APIRouter(prefix="/api/hr/me", tags=["HR Employee Self-Service"])


# ─── Geo utility ───
def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Khoảng cách 2 điểm GPS theo công thức Haversine, đơn vị mét."""
    R = 6_371_000  # Bán kính trái đất (m)
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


_SAFE_IMAGE_DATA_PREFIXES = (
    "data:image/jpeg",
    "data:image/png",
    "data:image/webp",
    "data:image/gif",
)


def _safe_selfie_url(v: str | None) -> str | None:
    """Validate URL selfie. Chỉ cho phép:
      - http(s)://... (URL từ media endpoint)
      - đường dẫn tương đối /media/...
      - data:image/{jpeg,png,webp,gif};base64,... (selfie thumbnail từ mobile)
    Reject mọi scheme khác (file/javascript/ftp/text/html) để chặn XSS khi serve lại.
    """
    if not v:
        return None
    v = v.strip()
    low = v.lower()
    if ".." in v:
        return None
    if low.startswith("data:"):
        # Chỉ cho phép data:image/* — chặn data:text/html → XSS
        if not low.startswith(_SAFE_IMAGE_DATA_PREFIXES):
            return None
        return v
    if low.startswith(("file:", "javascript:", "ftp:", "vbscript:")):
        return None
    # http(s):// hoặc đường dẫn tương đối /static/... → OK
    return v


@router.get("/profile")
def get_my_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ nhân viên liên kết")
    return {
        "id": emp.id,
        "employee_id": emp.id,
        "ho_ten": emp.ho_ten,
        "ma_nv": emp.ma_nv,
        "bo_phan": emp.bo_phan.ten_bo_phan if emp.bo_phan else "N/A",
        "chuc_vu": emp.chuc_vu.ten_chuc_vu if emp.chuc_vu else "N/A",
        "role": hrr.role_code(current_user),
        # Capability flags để frontend biết user có quyền làm gì
        # Sprint C: chỉ tổ trưởng/tổ phó mới đề xuất tăng ca
        "can_request_overtime": hrr.can_request_overtime(current_user),
    }


@router.get("/payroll")
def get_my_payroll(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        return []

    runs = db.query(PayrollRun).filter(
        PayrollRun.employee_id == emp.id).order_by(
        PayrollRun.nam.desc(),
        PayrollRun.thang.desc()).all()
    return [
        {
            "id": r.id,
            "thang": r.thang,
            "nam": r.nam,
            "trang_thai": r.trang_thai,
            "luong_co_ban": float(r.luong_co_ban),
            "luong_san_pham": float(r.luong_san_pham),
            "phu_cap": float(r.phu_cap),
            "thuong": float(r.thuong),
            "thuc_linh": float(r.thuc_linh),
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in runs
    ]


@router.get("/attendance")
def get_my_attendance(
    thang: int, nam: int,
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        return []

    logs = db.query(AttendanceLog).filter(
        AttendanceLog.employee_id == emp.id,
        func.extract('month', AttendanceLog.ngay) == thang,
        func.extract('year', AttendanceLog.ngay) == nam
    ).all()
    return logs


@router.get("/leave-requests")
def get_my_leave_requests(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        return []

    return db.query(LeaveRequest).filter(LeaveRequest.employee_id ==
                                         emp.id).order_by(LeaveRequest.created_at.desc()).all()


# ─── Sprint B: Geo-fence chấm công ───

@router.get("/checkin-locations", response_model=list[schemas.CheckInLocation])
def list_active_locations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Danh sách địa điểm chấm công đang active — mobile gọi để hiển thị bản đồ."""
    return db.query(CheckInLocation).filter(CheckInLocation.is_active.is_(True)).order_by(CheckInLocation.ten).all()


@router.get("/checkin-today")
def get_my_checkin_today(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Tra trạng thái chấm công hôm nay của user — đã vào chưa, đã ra chưa."""
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(404, "Chưa liên kết hồ sơ nhân viên")
    today = date.today()
    log = db.query(AttendanceLog).filter(
        AttendanceLog.employee_id == emp.id,
        AttendanceLog.ngay == today,
    ).first()
    if not log:
        return {"has_log": False, "ngay": today.isoformat()}
    return {
        "has_log": True,
        "ngay": today.isoformat(),
        "gio_vao": log.gio_vao.isoformat() if log.gio_vao else None,
        "gio_ra": log.gio_ra.isoformat() if log.gio_ra else None,
        "checkin_location_id": log.checkin_location_id,
        "checkin_distance_m": log.checkin_distance_m,
        "checkin_address": log.checkin_address,
        "checkout_address": log.checkout_address,
    }


@router.post("/checkin", response_model=schemas.CheckInResponse)
def submit_checkin(
    payload: schemas.CheckInRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Nhân viên chấm công (vào / ra) từ mobile.

    - Server tính khoảng cách Haversine đến tất cả địa điểm active.
    - Reject nếu khoảng cách gần nhất > bán kính của địa điểm đó.
    - 'in': tạo log mới nếu chưa có (idempotent: chấm vào lần 2 trong ngày → trả về vào đầu tiên).
    - 'out': cập nhật gio_ra (chấm ra lần 2 → ghi đè).
    """
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(404, "Chưa liên kết hồ sơ nhân viên — liên hệ HR để cấp tài khoản")

    # Tìm địa điểm gần nhất + check bán kính
    locations = db.query(CheckInLocation).filter(CheckInLocation.is_active.is_(True)).all()
    if not locations:
        raise HTTPException(400, "Chưa có địa điểm chấm công nào — liên hệ HR để cấu hình")

    nearest = None
    nearest_dist = float("inf")
    for loc in locations:
        d = haversine_m(payload.lat, payload.lng, loc.lat, loc.lng)
        if d < nearest_dist:
            nearest_dist = d
            nearest = loc

    if nearest is None or nearest_dist > nearest.ban_kinh_m:
        # Reject — không nằm trong bán kính bất kỳ địa điểm nào
        raise HTTPException(
            400,
            {
                "message": f"Bạn đang cách {nearest.ten if nearest else 'địa điểm gần nhất'} "
                           f"{int(nearest_dist)} m — vượt quá bán kính cho phép "
                           f"({nearest.ban_kinh_m if nearest else 0} m)",
                "nearest_location_id": nearest.id if nearest else None,
                "nearest_location_name": nearest.ten if nearest else None,
                "distance_m": round(nearest_dist, 1),
                "allowed_radius_m": nearest.ban_kinh_m if nearest else 0,
            },
        )

    selfie_url = _safe_selfie_url(payload.selfie_url)
    today = date.today()
    now = datetime.now(timezone.utc)

    log = db.query(AttendanceLog).filter(
        AttendanceLog.employee_id == emp.id,
        AttendanceLog.ngay == today,
    ).first()

    if payload.type == "in":
        if log and log.gio_vao:
            # Idempotent — đã chấm vào rồi
            return schemas.CheckInResponse(
                success=True,
                message=f"Bạn đã chấm công vào lúc {log.gio_vao.astimezone().strftime('%H:%M:%S')} hôm nay",
                type="in",
                log_id=log.id,
                location_id=nearest.id,
                location_name=nearest.ten,
                distance_m=round(nearest_dist, 1),
            )
        if not log:
            log = AttendanceLog(employee_id=emp.id, ngay=today, loai="app_geo")
            db.add(log)
        log.gio_vao = now
        log.loai = "app_geo"
        log.checkin_lat = payload.lat
        log.checkin_lng = payload.lng
        log.checkin_address = payload.address
        log.checkin_selfie_url = selfie_url
        log.checkin_location_id = nearest.id
        log.checkin_distance_m = round(nearest_dist, 1)
        msg = f"Chấm công VÀO thành công tại {nearest.ten} (cách {int(nearest_dist)} m)"
    else:  # type == "out"
        if not log or not log.gio_vao:
            raise HTTPException(400, "Bạn chưa chấm công VÀO hôm nay — không thể chấm RA")
        log.gio_ra = now
        log.checkout_lat = payload.lat
        log.checkout_lng = payload.lng
        log.checkout_address = payload.address
        log.checkout_selfie_url = selfie_url
        log.checkout_distance_m = round(nearest_dist, 1)
        msg = f"Chấm công RA thành công tại {nearest.ten} (cách {int(nearest_dist)} m)"

    db.commit()
    db.refresh(log)
    logger.info(
        "HR checkin type=%s employee=%s log_id=%s location=%s distance_m=%.1f",
        payload.type, emp.id, log.id, nearest.id, nearest_dist,
    )
    return schemas.CheckInResponse(
        success=True,
        message=msg,
        type=payload.type,
        log_id=log.id,
        location_id=nearest.id,
        location_name=nearest.ten,
        distance_m=round(nearest_dist, 1),
    )


# ─── Benefits (Sprint phúc lợi) ───

@router.get("/benefits")
def get_my_benefits(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List phúc lợi đã/đang nhận của user. Sắp xếp gần nhất trước."""
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        return []
    rows = db.query(BenefitRecord).filter(
        BenefitRecord.employee_id == emp.id,
    ).order_by(BenefitRecord.ngay_su_kien.desc(), BenefitRecord.id.desc()).all()
    return [
        {
            "id": r.id,
            "loai": r.loai,
            "ngay_su_kien": r.ngay_su_kien.isoformat() if r.ngay_su_kien else None,
            "muc_tien": float(r.muc_tien) if r.muc_tien else 0,
            "ghi_chu": r.ghi_chu,
            "thang_ap_dung": r.thang_ap_dung,
            "nam_ap_dung": r.nam_ap_dung,
            "trang_thai": r.trang_thai,
        }
        for r in rows
    ]


@router.get("/eligible-benefits")
def get_my_eligible_benefits(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List các chính sách phúc lợi NV được hưởng (lọc theo gender + active).

    Giúp NV biết "công ty cho mình quyền lợi gì" — trước đây chỉ thấy đã nhận.
    """
    from app.models.hr import BenefitPolicy
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        return []
    gender = (emp.gioi_tinh or "").lower()
    policies = db.query(BenefitPolicy).filter(BenefitPolicy.is_active.is_(True)).all()
    eligible = []
    for p in policies:
        # Lọc theo gender
        if p.ap_dung_cho == "female" and gender != "nữ":
            continue
        if p.ap_dung_cho == "male" and gender != "nam":
            continue
        eligible.append({
            "id": p.id,
            "ten": p.ten,
            "loai": p.loai,
            "muc_tien": float(p.muc_tien) if p.muc_tien else 0,
            "ap_dung_cho": p.ap_dung_cho,
            "mo_ta": p.mo_ta,
        })
    return eligible


# ─── Sprint Polish-2: KPI của tôi (Phase 1.4) ───

@router.get("/kpi")
def get_my_kpi(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List các kỳ KPI của NV (chu kỳ + tổng điểm + xếp loại + trạng thái).

    NV thấy điểm cuối cùng + nhận xét. Không lộ thông tin của NV khác.
    Sắp xếp kỳ mới nhất trước.
    """
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        return []

    rows = (
        db.query(KPIEvaluation, KPICycle)
        .join(KPICycle, KPIEvaluation.cycle_id == KPICycle.id)
        .filter(KPIEvaluation.employee_id == emp.id)
        .order_by(KPICycle.ngay_bat_dau.desc())
        .all()
    )
    return [
        {
            "id": ev.id,
            "cycle_id": cy.id,
            "cycle_ten": cy.ten,
            "cycle_loai": cy.loai,
            "ngay_bat_dau": cy.ngay_bat_dau.isoformat() if cy.ngay_bat_dau else None,
            "ngay_ket_thuc": cy.ngay_ket_thuc.isoformat() if cy.ngay_ket_thuc else None,
            "han_nv_tu_danh_gia": cy.han_nv_tu_danh_gia.isoformat() if cy.han_nv_tu_danh_gia else None,
            "han_ql_danh_gia": cy.han_ql_danh_gia.isoformat() if cy.han_ql_danh_gia else None,
            "diem_nv_tu_cham": float(ev.diem_nv_tu_cham) if ev.diem_nv_tu_cham is not None else None,
            "diem_quan_ly": float(ev.diem_quan_ly) if ev.diem_quan_ly is not None else None,
            "diem_cuoi_cung": float(ev.diem_cuoi_cung) if ev.diem_cuoi_cung is not None else None,
            "xep_loai": ev.xep_loai,
            "nhan_xet_ql": ev.nhan_xet_ql,
            "nhan_xet_bgd": ev.nhan_xet_bgd,
            "trang_thai": ev.trang_thai,
            "ngay_duyet": ev.ngay_duyet.isoformat() if ev.ngay_duyet else None,
        }
        for ev, cy in rows
    ]


@router.get("/kpi/{evaluation_id}")
def get_my_kpi_detail(
    evaluation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Chi tiết 1 kỳ KPI — kèm điểm từng tiêu chí.

    NV chỉ xem được bản đánh giá của chính mình.
    """
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(404, "Không tìm thấy hồ sơ nhân viên.")

    ev = db.query(KPIEvaluation).filter(KPIEvaluation.id == evaluation_id).first()
    if not ev:
        raise HTTPException(404, "Không tìm thấy bản đánh giá.")
    if ev.employee_id != emp.id:
        raise HTTPException(403, "Bạn không có quyền xem bản đánh giá của người khác.")

    cy = db.query(KPICycle).filter(KPICycle.id == ev.cycle_id).first()
    scores = db.query(KPIScore).filter(KPIScore.evaluation_id == ev.id).all()
    return {
        "id": ev.id,
        "cycle": {
            "id": cy.id if cy else None,
            "ten": cy.ten if cy else None,
            "ngay_bat_dau": cy.ngay_bat_dau.isoformat() if cy and cy.ngay_bat_dau else None,
            "ngay_ket_thuc": cy.ngay_ket_thuc.isoformat() if cy and cy.ngay_ket_thuc else None,
            "ty_le_nv": float(cy.ty_le_nv) if cy else 30,
            "ty_le_ql": float(cy.ty_le_ql) if cy else 70,
        },
        "diem_nv_tu_cham": float(ev.diem_nv_tu_cham) if ev.diem_nv_tu_cham is not None else None,
        "diem_quan_ly": float(ev.diem_quan_ly) if ev.diem_quan_ly is not None else None,
        "diem_cuoi_cung": float(ev.diem_cuoi_cung) if ev.diem_cuoi_cung is not None else None,
        "xep_loai": ev.xep_loai,
        "nhan_xet_nv": ev.nhan_xet_nv,
        "nhan_xet_ql": ev.nhan_xet_ql,
        "nhan_xet_bgd": ev.nhan_xet_bgd,
        "trang_thai": ev.trang_thai,
        "scores": [
            {
                "id": s.id,
                "ten_tieu_chi": s.ten_tieu_chi,
                "nhom": s.nhom,
                "trong_so": float(s.trong_so or 0),
                "thang_diem_max": s.thang_diem_max,
                "diem_nv": float(s.diem_nv) if s.diem_nv is not None else None,
                "diem_ql": float(s.diem_ql) if s.diem_ql is not None else None,
                "ghi_chu_nv": s.ghi_chu_nv,
                "ghi_chu_ql": s.ghi_chu_ql,
            }
            for s in scores
        ],
    }


# ─── Sprint Polish-2: Khám sức khỏe của tôi (Phase 1.2) ───

@router.get("/health-checks")
def get_my_health_checks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lịch sử khám sức khỏe của NV + lịch khám tiếp theo + alert quá hạn.

    Theo TT 14/2013/TT-BYT:
    - NV bình thường: khám tối thiểu 1 lần/năm
    - NV làm việc nặng nhọc/độc hại: 6 tháng/lần
    """
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        return {"history": [], "next_check": None, "overdue_days": 0}

    rows = db.query(HealthCheck).filter(
        HealthCheck.employee_id == emp.id,
    ).order_by(HealthCheck.ngay_kham.desc()).all()

    history = [
        {
            "id": r.id,
            "ngay_kham": r.ngay_kham.isoformat() if r.ngay_kham else None,
            "loai_kham": r.loai_kham,
            "phan_loai_suc_khoe": r.phan_loai_suc_khoe,
            "noi_kham": r.noi_kham,
            "bac_si": r.bac_si,
            "ket_luan": r.ket_luan,
            "benh_man_tinh": r.benh_man_tinh,
            "ngay_kham_tiep_theo": r.ngay_kham_tiep_theo.isoformat() if r.ngay_kham_tiep_theo else None,
            "ghi_chu": r.ghi_chu,
        }
        for r in rows
    ]

    # Tính trạng thái: ngày khám tiếp theo gần nhất
    today = date.today()
    next_check = None
    overdue_days = 0
    upcoming_in_days = None
    if rows and rows[0].ngay_kham_tiep_theo:
        next_check = rows[0].ngay_kham_tiep_theo.isoformat()
        delta = (rows[0].ngay_kham_tiep_theo - today).days
        if delta < 0:
            overdue_days = -delta
        else:
            upcoming_in_days = delta

    return {
        "history": history,
        "next_check": next_check,
        "overdue_days": overdue_days,
        "upcoming_in_days": upcoming_in_days,
        "tong_so_lan_kham": len(history),
        "phan_loai_gan_nhat": rows[0].phan_loai_suc_khoe if rows else None,
    }
