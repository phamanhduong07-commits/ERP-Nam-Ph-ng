from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models.hr import Employee, FuelLog
from app.models.warehouse_doc import DeliveryOrder
from app.models.master import Xe, DonGiaVanChuyen

router = APIRouter(prefix="/api/hr", tags=["HR Logistics"])


class FuelLogCreate(BaseModel):
    ngay_do: date
    xe_id: int
    employee_id: int
    so_km_dau: Decimal
    so_km_cuoi: Decimal
    so_lit_dau: Decimal
    don_gia: Decimal
    ghi_chu: str | None = None


def _default_trip_rate(db: Session) -> Decimal:
    cfg = db.query(DonGiaVanChuyen).filter(
        DonGiaVanChuyen.trang_thai.is_(True),
        DonGiaVanChuyen.don_gia_m2 > 0,
    ).order_by(DonGiaVanChuyen.id).first()
    return cfg.don_gia_m2 if cfg else Decimal("0")


def _trip_fund(delivery: DeliveryOrder, db: Session) -> tuple[Decimal, Decimal, Decimal]:
    tong_m2 = sum((item.dien_tich or Decimal("0")) for item in delivery.items)
    don_gia_m2 = _default_trip_rate(db)
    tien_chuyen = tong_m2 * don_gia_m2
    return tong_m2, don_gia_m2, tien_chuyen


def _trip_participants(delivery: DeliveryOrder) -> list[dict]:
    people = []
    if delivery.tai_xe:
        people.append({
            "role": "tai_xe",
            "employee_id": delivery.tai_xe.employee_id,
            "name": delivery.tai_xe.ho_ten,
            "he_so": delivery.tai_xe.he_so_chuyen or Decimal("1"),
        })
    if delivery.lo_xe_rel:
        people.append({
            "role": "lo_xe_1",
            "employee_id": delivery.lo_xe_rel.employee_id,
            "name": delivery.lo_xe_rel.ho_ten,
            "he_so": delivery.lo_xe_rel.he_so_chuyen or Decimal("0.3"),
        })
    if delivery.lo_xe_rel_2:
        people.append({
            "role": "lo_xe_2",
            "employee_id": delivery.lo_xe_rel_2.employee_id,
            "name": delivery.lo_xe_rel_2.ho_ten,
            "he_so": delivery.lo_xe_rel_2.he_so_chuyen or Decimal("0.3"),
        })
    return [p for p in people if p["employee_id"] and p["he_so"] > 0]


def calculate_trip_salary_allocations(db: Session, from_date: date, to_date: date) -> dict[int, dict]:
    deliveries = db.query(DeliveryOrder).options(
        joinedload(DeliveryOrder.items),
        joinedload(DeliveryOrder.customer),
        joinedload(DeliveryOrder.xe),
        joinedload(DeliveryOrder.tai_xe),
        joinedload(DeliveryOrder.lo_xe_rel),
        joinedload(DeliveryOrder.lo_xe_rel_2),
        joinedload(DeliveryOrder.don_gia_vc),
    ).filter(
        DeliveryOrder.ngay_xuat >= from_date,
        DeliveryOrder.ngay_xuat <= to_date,
        DeliveryOrder.trang_thai == "da_giao",
    ).all()

    result: dict[int, dict] = {}
    for delivery in deliveries:
        tong_m2, don_gia_m2, tien_chuyen = _trip_fund(delivery, db)
        participants = _trip_participants(delivery)
        total_factor = sum((p["he_so"] for p in participants), Decimal("0"))
        if tien_chuyen <= 0 or total_factor <= 0:
            continue

        for person in participants:
            amount = tien_chuyen * person["he_so"] / total_factor
            emp_id = person["employee_id"]
            if emp_id not in result:
                emp = db.get(Employee, emp_id)
                result[emp_id] = {
                    "employee_id": emp_id,
                    "ma_nv": emp.ma_nv if emp else None,
                    "ho_ten": emp.ho_ten if emp else person["name"],
                    "tien_chuyen": Decimal("0"),
                    "details": [],
                }
            result[emp_id]["tien_chuyen"] += amount
            result[emp_id]["details"].append({
                "delivery_id": delivery.id,
                "so_phieu": delivery.so_phieu,
                "ngay_xuat": delivery.ngay_xuat.isoformat(),
                "role": person["role"],
                "he_so": float(person["he_so"]),
                "tong_m2": round(float(tong_m2), 2),
                "don_gia_m2": float(don_gia_m2),
                "quy_chuyen": round(float(tien_chuyen), 0),
                "tien_chuyen": round(float(amount), 0),
            })

    return result


@router.get("/vehicles")
def list_vehicles(db: Session = Depends(get_db)):
    return db.query(Xe).order_by(Xe.bien_so).all()


@router.get("/trip-rate")
def get_trip_rate(db: Session = Depends(get_db)):
    return {"don_gia_m2": float(_default_trip_rate(db))}


@router.get("/fuel-logs")
def list_fuel_logs(
    from_date: date = Query(...),
    to_date: date = Query(...),
    db: Session = Depends(get_db)
):
    logs = db.query(FuelLog).options(
        joinedload(FuelLog.xe),
        joinedload(FuelLog.employee),
    ).filter(
        FuelLog.ngay_do >= from_date,
        FuelLog.ngay_do <= to_date
    ).all()

    result = []
    for log in logs:
        xe = log.xe or getattr(log, "vehicle", None)
        result.append({
            "id": log.id,
            "ngay_do": log.ngay_do.isoformat(),
            "xe_id": log.xe_id,
            "vehicle": (
                {"bien_so": xe.bien_so, "dinh_muc_dau": float(getattr(xe, "dinh_muc_dau", 0) or 0)}
                if xe else None
            ),
            "employee": {"ho_ten": log.employee.ho_ten},
            "so_km_dau": log.so_km_dau,
            "so_km_cuoi": log.so_km_cuoi,
            "so_km_chay": log.so_km_chay,
            "so_lit_dau": log.so_lit_dau,
            "don_gia": log.don_gia,
            "thanh_tien": log.thanh_tien,
            "ghi_chu": log.ghi_chu
        })
    return result


@router.post("/fuel-logs")
def create_fuel_log(body: FuelLogCreate, db: Session = Depends(get_db)):
    if body.so_km_cuoi < body.so_km_dau:
        raise HTTPException(status_code=400, detail="So km cuoi phai lon hon hoac bang so km dau")
    if not db.get(Xe, body.xe_id):
        raise HTTPException(status_code=404, detail="Khong tim thay xe")

    km_chay = body.so_km_cuoi - body.so_km_dau
    thanh_tien = body.so_lit_dau * body.don_gia
    db_obj = FuelLog(
        xe_id=body.xe_id,
        employee_id=body.employee_id,
        ngay_do=body.ngay_do,
        so_km_dau=body.so_km_dau,
        so_km_cuoi=body.so_km_cuoi,
        so_km_chay=km_chay,
        so_lit_dau=body.so_lit_dau,
        don_gia=body.don_gia,
        thanh_tien=thanh_tien,
        ghi_chu=body.ghi_chu,
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


@router.get("/trip-salaries")
def get_trip_salaries(
    from_date: date = Query(...),
    to_date: date = Query(...),
    db: Session = Depends(get_db)
):
    deliveries = db.query(DeliveryOrder).options(
        joinedload(DeliveryOrder.items),
        joinedload(DeliveryOrder.customer),
        joinedload(DeliveryOrder.xe),
        joinedload(DeliveryOrder.tai_xe),
        joinedload(DeliveryOrder.lo_xe_rel),
        joinedload(DeliveryOrder.lo_xe_rel_2),
        joinedload(DeliveryOrder.don_gia_vc),
    ).filter(
        DeliveryOrder.ngay_xuat >= from_date,
        DeliveryOrder.ngay_xuat <= to_date,
        DeliveryOrder.trang_thai == "da_giao",
    ).all()

    rows = []
    for delivery in deliveries:
        tong_m2, don_gia_m2, tien_chuyen = _trip_fund(delivery, db)
        participants = _trip_participants(delivery)
        total_factor = sum((p["he_so"] for p in participants), Decimal("0"))
        allocations = []
        if total_factor > 0:
            allocations = [
                {
                    "role": p["role"],
                    "employee_id": p["employee_id"],
                    "name": p["name"],
                    "he_so": float(p["he_so"]),
                    "tien_chuyen": round(float(tien_chuyen * p["he_so"] / total_factor), 0),
                }
                for p in participants
            ]

        rows.append({
            "id": delivery.id,
            "so_phieu": delivery.so_phieu,
            "ngay_xuat": delivery.ngay_xuat.isoformat(),
            "tai_xe": delivery.tai_xe.ho_ten if delivery.tai_xe else "N/A",
            "xe": delivery.xe.bien_so if delivery.xe else "N/A",
            "khach_hang": delivery.customer.ten_viet_tat if delivery.customer else "",
            "tong_m2": round(float(tong_m2), 2),
            "don_gia_m2": float(don_gia_m2),
            "tien_chuyen": round(float(tien_chuyen), 0),
            "allocations": allocations,
            "trang_thai": delivery.trang_thai
        })
    return rows


@router.get("/trip-salaries/summary")
def get_trip_salary_summary(
    from_date: date = Query(...),
    to_date: date = Query(...),
    db: Session = Depends(get_db)
):
    rows = calculate_trip_salary_allocations(db, from_date, to_date)
    return [
        {
            **row,
            "tien_chuyen": round(float(row["tien_chuyen"]), 0),
        }
        for row in rows.values()
    ]
