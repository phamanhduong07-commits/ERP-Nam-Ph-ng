from datetime import date, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.models.maintenance import MaintenanceMachine as Machine, MaintenanceSchedule, MaintenanceLog
from app.schemas.maintenance import (
    MachineCreate, MachineUpdate, MachineResponse,
    ScheduleCreate, ScheduleResponse,
    LogCreate, LogResponse,
)

router = APIRouter(prefix="/api/maintenance", tags=["Bảo trì"])

OVERDUE_WARN_DAYS = 7  # số ngày trước hạn bắt đầu cảnh báo "sap_den_han"


def _calc_schedule_status(s: MaintenanceSchedule) -> str:
    if not s.ngay_bao_tri_tiep_theo:
        return "dung_han"
    today = date.today()
    if s.ngay_bao_tri_tiep_theo < today:
        return "qua_han"
    if s.ngay_bao_tri_tiep_theo <= today + timedelta(days=OVERDUE_WARN_DAYS):
        return "sap_den_han"
    return "dung_han"


# ─── Machines ────────────────────────────────────────────────────────────────

@router.get("/machines", response_model=list[MachineResponse])
def list_machines(
    phan_xuong_id: int | None = Query(None),
    trang_thai: str | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Machine).order_by(Machine.ma_may)
    if phan_xuong_id:
        q = q.filter(Machine.phan_xuong_id == phan_xuong_id)
    if trang_thai:
        q = q.filter(Machine.trang_thai == trang_thai)
    return q.all()


@router.post("/machines", response_model=MachineResponse, status_code=201)
def create_machine(
    data: MachineCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    machine = Machine(**data.model_dump())
    db.add(machine)
    db.commit()
    db.refresh(machine)
    return machine


@router.get("/machines/{machine_id}", response_model=MachineResponse)
def get_machine(
    machine_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    m = db.get(Machine, machine_id)
    if not m:
        raise HTTPException(404, "Không tìm thấy máy")
    return m


@router.patch("/machines/{machine_id}", response_model=MachineResponse)
def update_machine(
    machine_id: int,
    data: MachineUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    m = db.get(Machine, machine_id)
    if not m:
        raise HTTPException(404, "Không tìm thấy máy")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(m, k, v)
    db.commit()
    db.refresh(m)
    return m


# ─── Schedules ───────────────────────────────────────────────────────────────

@router.get("/schedules", response_model=list[ScheduleResponse])
def list_schedules(
    machine_id: int | None = Query(None),
    trang_thai: str | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(MaintenanceSchedule).order_by(MaintenanceSchedule.ngay_bao_tri_tiep_theo)
    if machine_id:
        q = q.filter(MaintenanceSchedule.machine_id == machine_id)
    schedules = q.all()
    for s in schedules:
        s.trang_thai = _calc_schedule_status(s)
    if trang_thai:
        schedules = [s for s in schedules if s.trang_thai == trang_thai]
    return schedules


@router.post("/schedules", response_model=ScheduleResponse, status_code=201)
def create_schedule(
    data: ScheduleCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    m = db.get(Machine, data.machine_id)
    if not m:
        raise HTTPException(404, "Không tìm thấy máy")

    ngay_tiep_theo = None
    if data.ngay_bao_tri_gan_nhat:
        ngay_tiep_theo = data.ngay_bao_tri_gan_nhat + timedelta(days=data.chu_ky_ngay)

    schedule = MaintenanceSchedule(
        machine_id=data.machine_id,
        loai_bao_tri=data.loai_bao_tri,
        chu_ky_ngay=data.chu_ky_ngay,
        ngay_bao_tri_gan_nhat=data.ngay_bao_tri_gan_nhat,
        ngay_bao_tri_tiep_theo=ngay_tiep_theo,
        trang_thai=_calc_schedule_status(
            MaintenanceSchedule(
                chu_ky_ngay=data.chu_ky_ngay,
                ngay_bao_tri_tiep_theo=ngay_tiep_theo,
            )
        ) if ngay_tiep_theo else "dung_han",
        ghi_chu=data.ghi_chu,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule


@router.post("/schedules/{schedule_id}/complete", response_model=ScheduleResponse)
def complete_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Hoàn thành bảo trì → ngày gần nhất = hôm nay, ngày tiếp theo = hôm nay + chu kỳ."""
    s = db.get(MaintenanceSchedule, schedule_id)
    if not s:
        raise HTTPException(404, "Không tìm thấy lịch bảo trì")

    today = date.today()
    s.ngay_bao_tri_gan_nhat = today
    s.ngay_bao_tri_tiep_theo = today + timedelta(days=s.chu_ky_ngay)
    s.trang_thai = _calc_schedule_status(s)
    db.commit()
    db.refresh(s)
    return s


# ─── Logs ────────────────────────────────────────────────────────────────────

@router.get("/logs", response_model=list[LogResponse])
def list_logs(
    machine_id: int | None = Query(None),
    loai: str | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(MaintenanceLog).order_by(MaintenanceLog.ngay_bat_dau.desc())
    if machine_id:
        q = q.filter(MaintenanceLog.machine_id == machine_id)
    if loai:
        q = q.filter(MaintenanceLog.loai == loai)
    return q.all()


@router.post("/logs", response_model=LogResponse, status_code=201)
def create_log(
    data: LogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    m = db.get(Machine, data.machine_id)
    if not m:
        raise HTTPException(404, "Không tìm thấy máy")

    tong_chi_phi = data.chi_phi_vat_tu + data.chi_phi_nhan_cong
    log = MaintenanceLog(
        machine_id=data.machine_id,
        schedule_id=data.schedule_id,
        loai=data.loai,
        ngay_bat_dau=data.ngay_bat_dau,
        ngay_ket_thuc=data.ngay_ket_thuc,
        downtime_phut=data.downtime_phut,
        mo_ta_su_co=data.mo_ta_su_co,
        bien_phap_xu_ly=data.bien_phap_xu_ly,
        chi_phi_vat_tu=data.chi_phi_vat_tu,
        chi_phi_nhan_cong=data.chi_phi_nhan_cong,
        tong_chi_phi=tong_chi_phi,
        created_by=current_user.id,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


# ─── Overdue alert ───────────────────────────────────────────────────────────

@router.get("/overdue", response_model=list[ScheduleResponse])
def get_overdue(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Danh sách lịch bảo trì quá hạn hoặc sắp đến hạn."""
    schedules = db.query(MaintenanceSchedule).all()
    result = []
    for s in schedules:
        s.trang_thai = _calc_schedule_status(s)
        if s.trang_thai in ("qua_han", "sap_den_han"):
            result.append(s)
    result.sort(key=lambda s: s.ngay_bao_tri_tiep_theo or date.min)
    return result
