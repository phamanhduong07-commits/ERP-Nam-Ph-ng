
import sys
import os
import io
from decimal import Decimal
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.append(os.getcwd())

from sqlalchemy.orm import sessionmaker
from app.database import engine
from app.models.master import PhanXuong, Warehouse
from app.models.production import ProductionOrder, ProductionOrderItem
from app.models.phieu_nhap_phoi_song import PhieuNhapPhoiSong, PhieuNhapPhoiSongItem
from app.models.warehouse_doc import PhieuChuyenKho, PhieuChuyenKhoItem
from app.models.phieu_xuat_phoi import PhieuXuatPhoi, PhieuXuatPhoiItem
from sqlalchemy import func

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    print("--- Phôi Stock Distribution by Warehouse ---")
    
    # 1. Nhập SX
    nhap = db.query(Warehouse.ten_kho, func.sum(PhieuNhapPhoiSongItem.so_tam)).join(PhieuNhapPhoiSong, PhieuNhapPhoiSong.warehouse_id == Warehouse.id).join(PhieuNhapPhoiSongItem, PhieuNhapPhoiSongItem.phieu_id == PhieuNhapPhoiSong.id).group_by(Warehouse.ten_kho).all()
    print("Nhập SX:", nhap)
    
    # 2. Chuyển Đến
    chuyen_den = db.query(Warehouse.ten_kho, func.sum(PhieuChuyenKhoItem.so_luong)).join(PhieuChuyenKho, PhieuChuyenKho.warehouse_nhap_id == Warehouse.id).join(PhieuChuyenKhoItem, PhieuChuyenKhoItem.phieu_chuyen_kho_id == PhieuChuyenKho.id).group_by(Warehouse.ten_kho).all()
    print("Chuyển Đến:", chuyen_den)
    
    # 3. Xuất SX
    xuat = db.query(Warehouse.ten_kho, func.sum(PhieuXuatPhoiItem.so_luong)).join(Warehouse, Warehouse.phan_xuong_id == 3).join(PhieuXuatPhoiItem, PhieuXuatPhoiItem.ten_hang != '').group_by(Warehouse.ten_kho).limit(1).all()
    # Query trên hơi sai logic join, tôi sẽ query đơn giản hơn
    
    print("\n--- Raw Items in PhieuChuyenKhoItem ---")
    items = db.query(PhieuChuyenKhoItem).all()
    for it in items:
        pc = db.query(PhieuChuyenKho).get(it.phieu_chuyen_kho_id)
        wh_nhap = db.query(Warehouse).get(pc.warehouse_nhap_id)
        print(f"Item ID: {it.id}, LSX: {it.production_order_id}, Qty: {it.so_luong}, Target WH: {wh_nhap.ten_kho if wh_nhap else 'N/A'}")

finally:
    db.close()
