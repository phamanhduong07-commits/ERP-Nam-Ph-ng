
import sys
import os
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.append(os.getcwd())

from sqlalchemy.orm import sessionmaker
from app.database import engine
from app.models.phieu_nhap_phoi_song import PhieuNhapPhoiSong, PhieuNhapPhoiSongItem
from app.models.warehouse_doc import PhieuChuyenKho, PhieuChuyenKhoItem
from app.models.phieu_xuat_phoi import PhieuXuatPhoi, PhieuXuatPhoiItem
from app.models.production import ProductionOrder

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

WH_CU_CHI = 21

try:
    print(f"--- Transactions for Warehouse ID {WH_CU_CHI} (Củ Chi PHOI) ---")
    
    # 1. Nhập từ SX
    nhaps = db.query(PhieuNhapPhoiSongItem, PhieuNhapPhoiSong.so_phieu, PhieuNhapPhoiSong.production_order_id)\
        .join(PhieuNhapPhoiSong)\
        .filter(PhieuNhapPhoiSong.warehouse_id == WH_CU_CHI).all()
    print(f"\n1. Nhập từ SX ({len(nhaps)} records):")
    for item, so_phieu, order_id in nhaps:
        order = db.query(ProductionOrder).get(order_id)
        print(f"   Phieu: {so_phieu}, LSX: {order.so_lenh if order else order_id}, Qty: {item.so_tam}")

    # 2. Nhập từ Chuyển kho
    chuyens_in = db.query(PhieuChuyenKhoItem, PhieuChuyenKho.so_phieu)\
        .join(PhieuChuyenKho)\
        .filter(PhieuChuyenKho.warehouse_nhap_id == WH_CU_CHI, PhieuChuyenKho.trang_thai == 'hoan_thanh').all()
    print(f"\n2. Nhập từ Chuyển kho ({len(chuyens_in)} records):")
    for item, so_phieu in chuyens_in:
        order = db.query(ProductionOrder).get(item.production_order_id)
        print(f"   Phieu: {so_phieu}, LSX: {order.so_lenh if order else item.production_order_id}, Qty: {item.so_luong}")

    # 3. Xuất SX (Dựa trên workshop của LSX)
    # Tìm các LSX thuộc Workshop Củ Chi (ID 4) có phiếu xuất phôi
    xuats = db.query(PhieuXuatPhoiItem, ProductionOrder.so_lenh)\
        .join(ProductionOrder, ProductionOrder.id == PhieuXuatPhoiItem.production_order_id)\
        .filter(ProductionOrder.phan_xuong_id == 4).all()
    print(f"\n3. Xuất SX ({len(xuats)} records):")
    for item, so_lenh in xuats:
        print(f"   LSX: {so_lenh}, Qty: {item.so_luong}")

    # 4. Xuất Chuyển đi
    chuyens_out = db.query(PhieuChuyenKhoItem, PhieuChuyenKho.so_phieu)\
        .join(PhieuChuyenKho)\
        .filter(PhieuChuyenKho.warehouse_xuat_id == WH_CU_CHI, PhieuChuyenKho.trang_thai == 'hoan_thanh').all()
    print(f"\n4. Xuất Chuyển đi ({len(chuyens_out)} records):")
    for item, so_phieu in chuyens_out:
        order = db.query(ProductionOrder).get(item.production_order_id)
        print(f"   Phieu: {so_phieu}, LSX: {order.so_lenh if order else item.production_order_id}, Qty: {item.so_luong}")

finally:
    db.close()
