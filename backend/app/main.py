from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import Base, engine
from app.routers import (
    auth, customers, products, sales_orders, quotes, paper_materials, cau_truc,
    suppliers, material_groups, other_materials, warehouses, users,
    don_vi_tinh, vi_tri, xe, tai_xe, tinh_thanh, phuong_xa, don_gia_van_chuyen,
    production_orders, bom,
)

# Tạo bảng tự động nếu chưa có (dùng Alembic cho production)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(customers.router)
app.include_router(products.router)
app.include_router(sales_orders.router)
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
app.include_router(bom.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME}
