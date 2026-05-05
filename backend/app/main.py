import logging
import os
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.database import Base, engine, ensure_schema
from app.routers import (
    auth, customers, products, sales_orders, sales_returns, quotes, paper_materials, cau_truc,
    suppliers, material_groups, other_materials, warehouses, users,
    don_vi_tinh, vi_tri, xe, tai_xe, tinh_thanh, phuong_xa, don_gia_van_chuyen,
    production_orders, bom, production_plans, indirect_costs, addon_rates, permissions,
)
from app.routers import phieu_phoi, cd2, warehouse, purchase_orders, phap_nhan, dashboard, theo_doi, yeu_cau_giao_hang
from app.routers import billing, accounting

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

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Request logging middleware ───────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    duration_ms = round((time.time() - start) * 1000)
    # Bỏ qua static assets để log không bị nhiễu
    if not request.url.path.startswith("/assets"):
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
app.include_router(tinh_thanh.router)
app.include_router(phuong_xa.router)
app.include_router(don_gia_van_chuyen.router)
app.include_router(production_orders.router)
app.include_router(production_plans.router)
app.include_router(bom.router)
app.include_router(indirect_costs.router)
app.include_router(addon_rates.router)
app.include_router(phieu_phoi.router)
app.include_router(cd2.router)
app.include_router(warehouse.router)
app.include_router(purchase_orders.router)
app.include_router(phap_nhan.router)
app.include_router(dashboard.router)
app.include_router(theo_doi.router)
app.include_router(yeu_cau_giao_hang.router)
app.include_router(billing.router)
app.include_router(accounting.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME}


# ─── SPA fallback ─────────────────────────────────────────────────────────────
if os.path.exists("dist"):
    app.mount("/", StaticFiles(directory="dist", html=True), name="static")

    @app.exception_handler(404)
    async def not_found_exception_handler(request, exc):
        return FileResponse("dist/index.html")
