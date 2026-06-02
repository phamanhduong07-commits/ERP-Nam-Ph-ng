import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
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
    suppliers, material_groups, other_materials, warehouses, users,
    don_vi_tinh, vi_tri, xe, tai_xe, lo_xe, tinh_thanh, phuong_xa, don_gia_van_chuyen,
    production_orders, bom, production_plans, indirect_costs, addon_rates, permissions,
    hr, logistics_hr, hr_payroll_calc, hr_reward, hr_self_service,
)
from app.routers import (
    phieu_phoi, cd2, warehouse, purchase_orders, purchase_returns,
    phap_nhan, dashboard, theo_doi, yeu_cau_giao_hang,
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
from app.agent import router as agent_router
from app.routers import quality_control as quality_control_router
from app.routers import maintenance as maintenance_router
from app.routers import crm as crm_router
from app.routers import fixed_assets as fixed_assets_router
from app.routers import mrp as mrp_router
from app.routers import gps as gps_router
from app.routers.gps import gps_poller_loop
from app.models import gps as _gps_models  # noqa: F401 — ensures GpsSnapshot is in Base.metadata
from app.routers import qc_giay_cuon as qc_giay_cuon_router
from app.routers import hoa_don_dien_tu
from app.routers import ke_hoach_tan_dung
from app.routers import tem_paper_prices as tem_paper_prices_router
from app.routers import offset_addon_prices as offset_addon_prices_router

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

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ───────────────────────────────────────────────────────────────
    _gps_task = asyncio.create_task(gps_poller_loop())
    logger.info("GPS background poller scheduled")
    yield
    # ── Shutdown ──────────────────────────────────────────────────────────────
    _gps_task.cancel()
    try:
        await _gps_task
    except asyncio.CancelledError:
        pass
    logger.info("GPS background poller stopped")


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
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
        "font-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'none'",
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
app.include_router(quality_control_router.router)
app.include_router(maintenance_router.router)
app.include_router(crm_router.router)
app.include_router(fixed_assets_router.router)
app.include_router(mrp_router.router)
app.include_router(gps_router.router)
app.include_router(qc_giay_cuon_router.router)
app.include_router(hoa_don_dien_tu.router)
app.include_router(tem_paper_prices_router.router, prefix="/api")
app.include_router(offset_addon_prices_router.router, prefix="/api")


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

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        # Trả file tĩnh nếu tồn tại, ngược lại serve index.html cho SPA
        file_path = os.path.join("dist", full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse("dist/index.html")

    @app.exception_handler(404)
    async def not_found_exception_handler(request, exc):
        if request.url.path.startswith("/api/"):
            detail = getattr(exc, "detail", None) or "Not found"
            return JSONResponse({"detail": detail}, status_code=404)
        if os.path.exists("dist/index.html"):
            return FileResponse("dist/index.html")
        return JSONResponse({"detail": "Not found"}, status_code=404)
