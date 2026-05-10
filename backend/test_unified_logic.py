
import sys
import os
import io
from decimal import Decimal
from datetime import date

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.append(os.getcwd())

from sqlalchemy.orm import sessionmaker
from app.database import engine
from app.models.production import ProductionOrder, ProductionOrderItem
from app.models.phieu_nhap_phoi_song import PhieuNhapPhoiSong, PhieuNhapPhoiSongItem
from app.models.warehouse_doc import PhieuChuyenKho, PhieuChuyenKhoItem
from app.models.inventory import InventoryBalance
from app.models.phieu_xuat_phoi import PhieuXuatPhoi, PhieuXuatPhoiItem
from app.models.cd2 import PhieuIn
from app.models.master import PhanXuong, Warehouse
from app.routers.phieu_phoi import ton_kho_lsx

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def test():
    db = SessionLocal()
    try:
        # 1. Create Mock LSX
        order = ProductionOrder(
            so_lenh="TEST-LSX-999",
            phan_xuong_id=1, # Hoang Gia
            ngay_lenh=date.today(),
            trang_thai="dang_sx"
        )
        db.add(order)
        db.flush()
        
        poi = ProductionOrderItem(
            production_order_id=order.id,
            ten_hang="Thùng TEST 5 lớp",
            so_luong_ke_hoach=Decimal("1000"),
            dvt="Cái"
        )
        db.add(poi)
        db.flush()
        
        print(f"--- Created LSX {order.so_lenh} (ID: {order.id}) ---")
        
        # 2. Step 1: Nhập phôi tại Hoàng Gia (ID 1)
        wh_hg = 11 # Kho phôi HG
        phieu_nhap = PhieuNhapPhoiSong(
            so_phieu="TEST-NHAP-001",
            ngay=date.today(),
            production_order_id=order.id,
            warehouse_id=wh_hg
        )
        db.add(phieu_nhap)
        db.flush()
        
        item_nhap = PhieuNhapPhoiSongItem(
            phieu_id=phieu_nhap.id,
            production_order_item_id=poi.id,
            so_luong_ke_hoach=Decimal("1000"),
            so_luong_thuc_te=Decimal("1000"),
            so_luong_loi=Decimal("0"),
            so_tam=Decimal("1000"),
            chieu_kho=Decimal("600"),
            chieu_cat=Decimal("800")
        )
        db.add(item_nhap)
        db.flush()
        
        # Update Balance HG
        bal_hg = db.query(InventoryBalance).filter(InventoryBalance.warehouse_id == wh_hg, InventoryBalance.ten_hang == poi.ten_hang).first()
        if not bal_hg:
            bal_hg = InventoryBalance(warehouse_id=wh_hg, ten_hang=poi.ten_hang, ton_luong=Decimal("0"), don_gia_binh_quan=Decimal("5000"))
            db.add(bal_hg)
        bal_hg.ton_luong += Decimal("1000")
        db.flush()
        
        print("\nStep 1: After Produce 1000 at HG")
        res1 = ton_kho_lsx(db)
        target = [r for r in res1 if r['production_order_id'] == order.id]
        for r in target:
            print(f"  Xưởng: {r['ten_phan_xuong']} (Kho: {r['ten_kho']}), Tồn: {r['ton_kho']}")

        # 3. Step 2: Chuyển 400 từ HG (11) sang Hóc Môn (18)
        wh_hm = 18
        phieu_chuyen = PhieuChuyenKho(
            so_phieu="TEST-CHUYEN-001",
            ngay=date.today(),
            warehouse_xuat_id=wh_hg,
            warehouse_nhap_id=wh_hm,
            trang_thai="hoan_thanh"
        )
        db.add(phieu_chuyen)
        db.flush()
        
        item_chuyen = PhieuChuyenKhoItem(
            phieu_chuyen_kho_id=phieu_chuyen.id,
            production_order_id=order.id,
            so_luong=Decimal("400")
        )
        db.add(item_chuyen)
        db.flush()
        
        # Update Balances
        bal_hg.ton_luong -= Decimal("400")
        bal_hm = db.query(InventoryBalance).filter(InventoryBalance.warehouse_id == wh_hm, InventoryBalance.ten_hang == poi.ten_hang).first()
        if not bal_hm:
            bal_hm = InventoryBalance(warehouse_id=wh_hm, ten_hang=poi.ten_hang, ton_luong=Decimal("0"), don_gia_binh_quan=Decimal("5500"))
            db.add(bal_hm)
        bal_hm.ton_luong += Decimal("400")
        db.flush()
        
        print("\nStep 2: After Transfer 400 HG -> HM")
        res2 = ton_kho_lsx(db)
        target = [r for r in res2 if r['production_order_id'] == order.id]
        for r in target:
            print(f"  Xưởng: {r['ten_phan_xuong']} (Kho: {r['ten_kho']}), Tồn: {r['ton_kho']}")

        # 4. Step 3: Xuất dùng 150 tại Hóc Môn (HM)
        order_hm = ProductionOrder(
            so_lenh="TEST-LSX-HM-999",
            phan_xuong_id=3, # Hoc Mon
            ngay_lenh=date.today(),
            trang_thai="dang_sx"
        )
        db.add(order_hm)
        db.flush()
        
        poi_hm = ProductionOrderItem(
            production_order_id=order_hm.id,
            ten_hang="Thùng TEST 5 lớp",
            so_luong_ke_hoach=Decimal("400"),
            dvt="Cái"
        )
        db.add(poi_hm)
        db.flush()
        
        item_chuyen.production_order_id = order_hm.id
        db.flush()
        
        phieu_xuat_hm = PhieuXuatPhoi(
            so_phieu="TEST-XUAT-HM-001",
            ngay=date.today()
        )
        db.add(phieu_xuat_hm)
        db.flush()
        
        item_xuat_hm = PhieuXuatPhoiItem(
            phieu_id=phieu_xuat_hm.id,
            production_order_item_id=poi_hm.id,
            so_luong=Decimal("150"),
            ten_hang="Thùng TEST 5 lớp"
        )
        db.add(item_xuat_hm)
        db.flush()
        
        bal_hm.ton_luong -= Decimal("150")
        db.flush()
        
        print("\nStep 3: After Consume 150 at HM")
        res3 = ton_kho_lsx(db)
        target_hg = [r for r in res3 if r['production_order_id'] == order.id]
        target_hm = [r for r in res3 if r['production_order_id'] == order_hm.id]
        for r in target_hg + target_hm:
            print(f"  Xưởng: {r['ten_phan_xuong']} (Kho: {r['ten_kho']}), Tồn: {r['ton_kho']}")

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error: {e}")
    finally:
        print("\n--- Rolling back changes ---")
        db.rollback()
        db.close()

if __name__ == "__main__":
    test()
