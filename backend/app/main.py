import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import IntegrityError
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.limiter import limiter
from app.socket_manager import socket_app
from app.config import settings
from app.database import Base, engine, ensure_schema
from app.routers import (
    auth, customers, products, sales_orders, sales_returns, quotes, paper_materials, cau_truc,
    suppliers, material_groups, other_materials, warehouses, users, tieu_chuan_ky_thuat,
    don_vi_tinh, vi_tri, xe, tai_xe, lo_xe, tinh_thanh, phuong_xa, don_gia_van_chuyen,
    production_orders, bom, production_plans, indirect_costs, addon_rates, permissions,
    hr, logistics_hr, hr_payroll_calc, hr_reward, hr_self_service, hr_workflow, hr_benefits, hr_safety, hr_kpi, hr_reports, hr_production, hr_payroll_adjustments, hr_payroll_runs, hr_payroll_complaints, hr_my_payslip,
)
from app.routers import (
    phieu_phoi, cd2, warehouse, purchase_orders, purchase_returns,
    phap_nhan, dashboard, theo_doi, yeu_cau_giao_hang,
)
from app.routers import (
    goods_receipts, material_issues, production_outputs, delivery_orders,
    stock_transfers, stock_adjustments, inventory_reports,
)
from app.routers import purchase_requisitions
from app.routers import may_dung_log
from app.routers import billing, accounting
from app.routers import bank_accounts, ccdc as ccdc_router
from app.routers import mst_lookup
from app.routers import reports as reports_router
from app.routers import customer_refunds as customer_refunds_router
from app.routers import import_logs as import_logs_router
from app.routers import system as system_router
from app.routers import media as media_router
from app.routers import incoming_invoices
from app.routers import doi_tru as doi_tru_router
from app.agent import router as agent_router
from app.routers import quality_control as quality_control_router
from app.routers import kho_ao as kho_ao_router
from app.routers import kho_ao_phoi as kho_ao_phoi_router
from app.routers import defect_records as defect_records_router
from app.routers import maintenance as maintenance_router
from app.routers import crm as crm_router
from app.routers import fixed_assets as fixed_assets_router
from app.routers import mrp as mrp_router
from app.routers import gps as gps_router
from app.routers.gps import gps_poller_loop


async def benefit_birthday_loop():
    """Cron: mỗi 6 giờ làm 2 việc:
      1. Tự tạo BenefitRecord cho NV sinh nhật HÔM NAY (idempotent qua UNIQUE INDEX)
      2. Ping HR (Socket.io) các sự kiện sắp tới: sinh nhật 3 ngày tới, HĐLĐ hết hạn 60 ngày
    """
    import asyncio as _aio
    from datetime import date as _date, timedelta as _td
    from sqlalchemy import extract
    from app.database import SessionLocal as _SessionLocal
    from app.models.hr import (
        BenefitPolicy as _Policy, BenefitRecord as _Record, Employee as _Emp,
        LaborContract as _Contract,
    )

    await _aio.sleep(30)  # đợi startup xong
    while True:
        try:
            today = _date.today()
            with _SessionLocal() as db:
                # ─── 1. Auto tạo sinh nhật hôm nay ───
                policy = db.query(_Policy).filter(
                    _Policy.loai == "sinh_nhat",
                    _Policy.is_active.is_(True),
                ).first()
                if policy:
                    employees = db.query(_Emp).filter(
                        _Emp.trang_thai == "dang_lam",
                        _Emp.ngay_sinh.isnot(None),
                        extract("month", _Emp.ngay_sinh) == today.month,
                        extract("day", _Emp.ngay_sinh) == today.day,
                    ).all()
                    existing = {
                        r.employee_id for r in db.query(_Record).filter(
                            _Record.loai == "sinh_nhat",
                            _Record.thang_ap_dung == today.month,
                            _Record.nam_ap_dung == today.year,
                        ).all()
                    }
                    created = 0
                    for emp in employees:
                        if emp.id in existing:
                            continue
                        if policy.ap_dung_cho == "female" and (emp.gioi_tinh or "").lower() != "nữ":
                            continue
                        if policy.ap_dung_cho == "male" and (emp.gioi_tinh or "").lower() != "nam":
                            continue
                        db.add(_Record(
                            employee_id=emp.id, policy_id=policy.id,
                            loai="sinh_nhat", ngay_su_kien=today,
                            muc_tien=policy.muc_tien,
                            ghi_chu=f"Sinh nhật {emp.ho_ten}",
                            thang_ap_dung=today.month, nam_ap_dung=today.year,
                            trang_thai="de_xuat",
                        ))
                        created += 1
                    if created:
                        db.commit()
                        logger.info("Birthday auto-cron: created %s records for %s", created, today)

                # ─── 2. Ping HR sự kiện sắp tới qua Socket.io ───
                # Sinh nhật trong 3 ngày tới
                upcoming_birthdays = []
                for emp in db.query(_Emp).filter(
                    _Emp.trang_thai == "dang_lam",
                    _Emp.ngay_sinh.isnot(None),
                ).all():
                    if not emp.ngay_sinh:
                        continue
                    try:
                        bd = _date(today.year, emp.ngay_sinh.month, emp.ngay_sinh.day)
                    except ValueError:
                        continue
                    if bd < today:
                        try:
                            bd = _date(today.year + 1, emp.ngay_sinh.month, emp.ngay_sinh.day)
                        except ValueError:
                            continue
                    delta = (bd - today).days
                    if 1 <= delta <= 3:  # 1-3 ngày tới
                        upcoming_birthdays.append({
                            "ho_ten": emp.ho_ten,
                            "ma_nv": emp.ma_nv,
                            "con_lai_ngay": delta,
                        })

                # HĐLĐ hết hạn 60 ngày tới
                expiring = []
                deadline = today + _td(days=60)
                for ct, emp in db.query(_Contract, _Emp).join(
                    _Emp, _Emp.id == _Contract.employee_id,
                ).filter(
                    _Contract.trang_thai == "hieu_luc",
                    _Contract.ngay_het_han.isnot(None),
                    _Contract.ngay_het_han >= today,
                    _Contract.ngay_het_han <= deadline,
                ).all():
                    expiring.append({
                        "ho_ten": emp.ho_ten,
                        "ma_nv": emp.ma_nv,
                        "ngay_het_han": ct.ngay_het_han.isoformat() if ct.ngay_het_han else None,
                        "con_lai_ngay": (ct.ngay_het_han - today).days if ct.ngay_het_han else None,
                    })

                # NOTE: KHÔNG emit qua Socket.io broadcast — gây leak PII vì
                # mọi NV connected (kể cả công nhân/tài xế) đều nhận được payload
                # chứa tên + HĐLĐ đồng nghiệp. Socket infra hiện chưa có room/JWT
                # verify, không thể filter theo role.
                #
                # Thay thế: HR xem qua tab "Tổng quan" trong /hr/benefits (đã có
                # endpoint /family-events với require_roles HR/Admin/BGD).
                # Log internal để audit + nếu cần triển khai notification sau này
                # sẽ làm qua REST endpoint /api/hr/notifications gated by role.
                if upcoming_birthdays or expiring:
                    logger.info(
                        "HR daily summary [%s]: %d sinh nhật + %d HĐLĐ sắp hết hạn (xem dashboard /hr/benefits)",
                        today, len(upcoming_birthdays), len(expiring),
                    )

        except Exception as exc:  # noqa: BLE001
            logger.warning("Birthday/reminder cron error (retry 6h): %s", exc)
        await _aio.sleep(6 * 3600)  # 6 giờ


async def incoming_invoice_email_scanner_loop():
    """Vòng lặp chạy ngầm định kỳ quét email tải hóa đơn XML đầu vào."""
    from app.database import SessionLocal as _SessionLocal
    from app.routers.incoming_invoices import scan_emails_for_invoices
    from app.config import settings

    # Đợi startup ổn định
    await asyncio.sleep(45)

    interval = settings.EMAIL_SCAN_INTERVAL_MINUTES * 60
    if interval <= 0:
        interval = 600

    logger.info("Incoming invoice email scanner loop started with interval %s seconds", interval)
    while True:
        try:
            with _SessionLocal() as db:
                scan_emails_for_invoices(db)
        except Exception as exc:
            logger.warning("Error in background email scanner: %s", exc, exc_info=True)
        await asyncio.sleep(interval)


from app.models import gps as _gps_models  # noqa: F401 — ensures GpsSnapshot is in Base.metadata
from app.routers import qc_giay_cuon as qc_giay_cuon_router
from app.routers import qc_nvl as qc_nvl_router
from app.routers import hoa_don_dien_tu
from app.routers import ke_hoach_tan_dung
from app.routers import tem_paper_prices as tem_paper_prices_router
from app.routers import offset_addon_prices as offset_addon_prices_router
from app.routers import sync_htcph as sync_htcph_router
from app.routers import layer_allocation_coefficients as lac_router
from app.routers import cost_analysis as cost_analysis_router
from app.routers import (
    dieu_khoan_thanh_toan, muc_thu_chi, khoan_muc_chi_phi, loai_tai_san_co_dinh,
    ky_hieu_cham_cong, bieu_thue_thu_nhap, nhom_doi_tuong, tai_khoan_ngam_dinh,
    loai_tien, ngan_hang,
)
from app.routers import chart_of_accounts as chart_of_accounts_danhmuc
from app.services.htcph_sync import run_daily_sync
from app.database import SessionLocal as _SessionLocal

# ─── Logging setup ────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("backend.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger("erp")

# ─── DB init ──────────────────────────────────────────────────────────────────
# Schema changes should normally go through Alembic. Keep the legacy
# auto-create path opt-in for local recovery/import work only.
if settings.AUTO_CREATE_SCHEMA:
    Base.metadata.create_all(bind=engine)
    ensure_schema()

def _get_db():
    db = _SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def _warmup_ollama() -> None:
    """Pre-load Ollama model vào VRAM khi ERP khởi động — tránh cold start 100s cho user đầu tiên."""
    import httpx
    from app.config import settings
    try:
        async with httpx.AsyncClient(timeout=300) as client:
            await client.post(
                f"{settings.OLLAMA_URL.rstrip('/')}/api/generate",
                json={"model": settings.OLLAMA_MODEL, "prompt": "", "keep_alive": "60m", "stream": False},
            )
        logger.info("Ollama warmup done: model=%s loaded into VRAM", settings.OLLAMA_MODEL)
    except Exception as exc:
        logger.warning("Ollama warmup skipped: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ───────────────────────────────────────────────────────────────
    _gps_task = asyncio.create_task(gps_poller_loop())
    _htcph_task = asyncio.create_task(run_daily_sync(_get_db))
    _birthday_task = asyncio.create_task(benefit_birthday_loop())
    _email_scan_task = asyncio.create_task(incoming_invoice_email_scanner_loop())
    asyncio.create_task(_warmup_ollama())
    logger.info("GPS background poller scheduled")
    logger.info("HTCPH daily sync scheduled (next run: 02:00)")
    logger.info("Birthday benefit cron scheduled (every 6h)")
    logger.info("Incoming invoice email scanner scheduled")
    yield
    # ── Shutdown ──────────────────────────────────────────────────────────────
    _gps_task.cancel()
    _htcph_task.cancel()
    _birthday_task.cancel()
    _email_scan_task.cancel()
    for task in (_gps_task, _htcph_task, _birthday_task, _email_scan_task):
        try:
            await task
        except asyncio.CancelledError:
            pass
    logger.info("Background tasks stopped")


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─── Socket.io ────────────────────────────────────────────────────────────────
# Mount Socket.io ASGI app vào đường dẫn /ws
app.mount("/ws/socket.io", socket_app)

# ─── Compression ──────────────────────────────────────────────────────────────
app.add_middleware(GZipMiddleware, minimum_size=1024)

# ─── CORS ─────────────────────────────────────────────────────────────────────
_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

# ─── Request logging middleware ───────────────────────────────────────────────


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=self, microphone=(), geolocation=()")
    response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    response.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' data: https://fonts.gstatic.com; "
        "img-src 'self' data: blob:; "
        "connect-src 'self' ws: wss: https://cloudflareinsights.com; "
        "frame-ancestors 'none'",
    )
    duration_ms = round((time.time() - start) * 1000)
    # Bỏ qua static assets để log không bị nhiễu
    if not request.url.path.startswith("/assets"):
        if response.status_code in (401, 403):
            logger.warning(
                "AUTH FAILURE %d — %s %s — ip=%s",
                response.status_code, request.method, request.url.path,
                request.client.host if request.client else "unknown",
            )
        else:
            logger.info(
                "%s %s %d %dms",
                request.method, request.url.path, response.status_code, duration_ms,
            )
    return response

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(permissions.router)
app.include_router(permissions.role_router)
app.include_router(customers.router)
app.include_router(products.router)
app.include_router(sales_orders.router)
app.include_router(sales_returns.router)
app.include_router(quotes.router)
app.include_router(paper_materials.router)
app.include_router(cau_truc.router)
app.include_router(suppliers.router)
app.include_router(material_groups.router)
app.include_router(other_materials.router)
app.include_router(tieu_chuan_ky_thuat.router)
app.include_router(warehouses.router)
app.include_router(users.router)
app.include_router(don_vi_tinh.router)
app.include_router(vi_tri.router)
app.include_router(xe.router)
app.include_router(tai_xe.router)
app.include_router(lo_xe.router)
app.include_router(tinh_thanh.router)
app.include_router(phuong_xa.router)
app.include_router(don_gia_van_chuyen.router)
app.include_router(production_orders.router)
app.include_router(production_plans.router)
app.include_router(ke_hoach_tan_dung.router)
app.include_router(bom.router)
app.include_router(indirect_costs.router)
app.include_router(addon_rates.router)
app.include_router(phieu_phoi.router)
app.include_router(may_dung_log.router, prefix="/api")
app.include_router(cd2.router)
app.include_router(warehouse.router)
# Warehouse routers split out of warehouse.py — all share /api/warehouse prefix
app.include_router(goods_receipts.router)
app.include_router(material_issues.router)
app.include_router(production_outputs.router)
app.include_router(delivery_orders.router)
app.include_router(stock_transfers.router)
app.include_router(stock_adjustments.router)
app.include_router(inventory_reports.router)
app.include_router(kho_ao_router.router)
app.include_router(kho_ao_phoi_router.router)
app.include_router(defect_records_router.router)
app.include_router(purchase_orders.router)
app.include_router(purchase_returns.router)
app.include_router(purchase_requisitions.router)
app.include_router(phap_nhan.router)
app.include_router(dashboard.router)
app.include_router(theo_doi.router)
app.include_router(yeu_cau_giao_hang.router)
app.include_router(billing.router)
app.include_router(accounting.router)
app.include_router(bank_accounts.router)
app.include_router(ccdc_router.router)
app.include_router(reports_router.router)
app.include_router(customer_refunds_router.router)
app.include_router(import_logs_router.router)
app.include_router(system_router.router)
app.include_router(agent_router.router)
app.include_router(media_router.router)
app.include_router(mst_lookup.router)
app.include_router(hr.router)
app.include_router(logistics_hr.router)
app.include_router(hr_payroll_calc.router)
app.include_router(hr_reward.router)
app.include_router(hr_self_service.router)
app.include_router(hr_workflow.router)
app.include_router(hr_benefits.router)
app.include_router(hr_safety.router)
app.include_router(hr_kpi.router)
app.include_router(hr_reports.router)
app.include_router(hr_production.router)
app.include_router(hr_payroll_adjustments.router)
app.include_router(hr_payroll_runs.router)
app.include_router(hr_payroll_complaints.router)
app.include_router(hr_my_payslip.router)
app.include_router(quality_control_router.router)
app.include_router(maintenance_router.router)
app.include_router(crm_router.router)
app.include_router(fixed_assets_router.router)
app.include_router(mrp_router.router)
app.include_router(gps_router.router)
app.include_router(qc_giay_cuon_router.router)
app.include_router(qc_nvl_router.router)
app.include_router(hoa_don_dien_tu.router)
app.include_router(incoming_invoices.router)
app.include_router(doi_tru_router.router, prefix="/api")
app.include_router(tem_paper_prices_router.router, prefix="/api")
app.include_router(offset_addon_prices_router.router, prefix="/api")
app.include_router(sync_htcph_router.router)
app.include_router(lac_router.router)
app.include_router(cost_analysis_router.router)
# ── Danh mục mới (kế toán, nhân sự, tài sản) ──────────────────────────────────
app.include_router(dieu_khoan_thanh_toan.router)
app.include_router(muc_thu_chi.router)
app.include_router(khoan_muc_chi_phi.router)
app.include_router(loai_tai_san_co_dinh.router)
app.include_router(ky_hieu_cham_cong.router)
app.include_router(bieu_thue_thu_nhap.router)
app.include_router(nhom_doi_tuong.router)
app.include_router(chart_of_accounts_danhmuc.router)
app.include_router(tai_khoan_ngam_dinh.router)
app.include_router(loai_tien.router)
app.include_router(ngan_hang.router)


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    db_msg = str(exc.orig) if exc.orig else str(exc)
    if "unique" in db_msg.lower() or "duplicate" in db_msg.lower():
        detail = "Dữ liệu đã tồn tại (vi phạm ràng buộc duy nhất)"
    elif "foreign key" in db_msg.lower() or "violates foreign" in db_msg.lower():
        detail = "Dữ liệu tham chiếu không hợp lệ (FK không tồn tại)"
    elif "not null" in db_msg.lower():
        detail = "Thiếu dữ liệu bắt buộc (NOT NULL)"
    else:
        detail = "Lỗi dữ liệu: vi phạm ràng buộc cơ sở dữ liệu"
    logger.warning("IntegrityError %s %s: %s", request.method, request.url.path, db_msg)
    return JSONResponse({"detail": detail}, status_code=400)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME}


# ─── SPA fallback ─────────────────────────────────────────────────────────────
# Dùng catch-all route thay vì StaticFiles mount tại "/" để tránh StaticFiles
# chặn POST request (StaticFiles trả 405 với mọi non-GET request).
os.makedirs("uploads/invoices", exist_ok=True)
os.makedirs("uploads/media", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

if os.path.exists("dist"):
    app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")

    _NO_CACHE_HEADERS = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
    }

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        # Trả file tĩnh nếu tồn tại, ngược lại serve index.html cho SPA
        file_path = os.path.join("dist", full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse("dist/index.html", headers=_NO_CACHE_HEADERS)

    @app.exception_handler(404)
    async def not_found_exception_handler(request, exc):
        if request.url.path.startswith("/api/"):
            detail = getattr(exc, "detail", None) or "Not found"
            return JSONResponse({"detail": detail}, status_code=404)
        if os.path.exists("dist/index.html"):
            return FileResponse("dist/index.html", headers=_NO_CACHE_HEADERS)
        return JSONResponse({"detail": "Not found"}, status_code=404)
