"""Warehouse router — phiếu chuyển kho (PhieuChuyenKho).

Split out of app/routers/warehouse.py (pure structural extraction).
Shares the /api/warehouse prefix; mounted alongside warehouse.router.
"""
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, aliased, joinedload
from app.database import get_db
from app.deps import get_current_user, require_any_permission
from app.models.auth import User
from app.models.master import Warehouse, PaperMaterial, OtherMaterial, Product, PhanXuong, PhapNhan
from app.models.production import ProductionOrder
from app.models.accounting import JournalEntry
from app.models.warehouse_doc import (
    PhieuChuyenKho, PhieuChuyenKhoItem,
)
from app.models.phieu_nhap_phoi_song import PhieuNhapPhoiSong, PhieuNhapPhoiSongItem
from app.models.cd2 import PhieuIn
from app.services.accounting_service import AccountingService
from app.utils.log import get_logger

logger = get_logger(__name__)

from app.services.inventory_service import (
    get_or_create_balance as _get_or_create_balance,
    nhap_balance as _nhap_balance,
    xuat_balance as _xuat_balance,
    log_tx as _log_tx,
)

from app.routers.warehouse import (  # shared schemas + helpers
    PhieuChuyenIn,
    _gen_so,
    _resolve_nvl_name,
    _ensure_active_warehouse,
)

router = APIRouter(
    prefix="/api/warehouse",
    dependencies=[Depends(require_any_permission("inventory.transfer"))],
    tags=["warehouse"],
)


# ── Phiếu chuyển kho ──────────────────────────────────────────────────────────

@router.get("/phieu-chuyen")
def list_phieu_chuyen(
    warehouse_xuat_id: Optional[int] = Query(None),
    warehouse_nhap_id: Optional[int] = Query(None),
    phan_xuong_xuat_id: Optional[int] = Query(None),
    phan_xuong_nhap_id: Optional[int] = Query(None),
    phap_nhan_xuat_id: Optional[int] = Query(None),
    phap_nhan_nhap_id: Optional[int] = Query(None),
    phap_nhan_id: Optional[int] = Query(None),
    tu_ngay: Optional[date] = Query(None),
    den_ngay: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(PhieuChuyenKho)
    WhX = aliased(Warehouse)
    WhN = aliased(Warehouse)
    PxX = aliased(PhanXuong)
    PxN = aliased(PhanXuong)
    if warehouse_xuat_id:
        q = q.filter(PhieuChuyenKho.warehouse_xuat_id == warehouse_xuat_id)
    if warehouse_nhap_id:
        q = q.filter(PhieuChuyenKho.warehouse_nhap_id == warehouse_nhap_id)
    if phan_xuong_xuat_id or phap_nhan_xuat_id or phap_nhan_id:
        q = q.join(WhX, WhX.id == PhieuChuyenKho.warehouse_xuat_id)
    if phan_xuong_xuat_id:
        q = q.filter(WhX.phan_xuong_id == phan_xuong_xuat_id)
    if phap_nhan_xuat_id or phap_nhan_id:
        q = q.join(PxX, WhX.phan_xuong_id == PxX.id)
        q = q.filter(PxX.phap_nhan_id == (phap_nhan_xuat_id or phap_nhan_id))
    if phan_xuong_nhap_id or phap_nhan_nhap_id:
        q = q.join(WhN, WhN.id == PhieuChuyenKho.warehouse_nhap_id)
    if phan_xuong_nhap_id:
        q = q.filter(WhN.phan_xuong_id == phan_xuong_nhap_id)
    if phap_nhan_nhap_id:
        q = q.join(PxN, WhN.phan_xuong_id == PxN.id)
        q = q.filter(PxN.phap_nhan_id == phap_nhan_nhap_id)
    if tu_ngay:
        q = q.filter(PhieuChuyenKho.ngay >= tu_ngay)
    if den_ngay:
        q = q.filter(PhieuChuyenKho.ngay <= den_ngay)
    rows = q.options(joinedload(PhieuChuyenKho.items)).order_by(PhieuChuyenKho.created_at.desc()).all()
    return [_ck_to_dict(r, db) for r in rows]


@router.get("/phieu-chuyen/{phieu_id}")
def get_phieu_chuyen(phieu_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    p = db.query(PhieuChuyenKho).options(joinedload(PhieuChuyenKho.items)).filter(PhieuChuyenKho.id == phieu_id).first()
    if not p:
        raise HTTPException(404, "Không tìm thấy phiếu chuyển")
    return _ck_to_dict(p, db)


@router.post("/phieu-chuyen", status_code=201)
def create_phieu_chuyen(
    body: PhieuChuyenIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not body.items:
        raise HTTPException(400, "Phiếu chuyển phải có ít nhất 1 dòng hàng")
    if body.warehouse_xuat_id == body.warehouse_nhap_id:
        raise HTTPException(400, "Kho xuất và kho nhận phải khác nhau")

    if not _ensure_active_warehouse(db, body.warehouse_xuat_id) or not _ensure_active_warehouse(db, body.warehouse_nhap_id):
        raise HTTPException(404, "Không tìm thấy kho")

    for it in body.items:
        is_phoi = bool(it.production_order_id) and not it.paper_material_id and not it.other_material_id
        if is_phoi:
            tong_nhap = db.query(func.coalesce(func.sum(PhieuNhapPhoiSongItem.so_luong_thuc_te), 0)).join(
                PhieuNhapPhoiSong, PhieuNhapPhoiSongItem.phieu_id == PhieuNhapPhoiSong.id
            ).filter(PhieuNhapPhoiSong.production_order_id == it.production_order_id).scalar() or Decimal("0")
            tong_chuyen = db.query(func.coalesce(func.sum(PhieuChuyenKhoItem.so_luong), 0)).filter(
                PhieuChuyenKhoItem.production_order_id == it.production_order_id
            ).scalar() or Decimal("0")
            ton_tai_nguon = max(Decimal("0"), Decimal(str(tong_nhap)) - Decimal(str(tong_chuyen)))
            if ton_tai_nguon < it.so_luong:
                raise HTTPException(400, f"Không đủ phôi tại kho nguồn: LSX #{it.production_order_id} — "
                                    f"cần {float(it.so_luong):g}, còn {float(ton_tai_nguon):g}")
        else:
            ten_hang, don_vi = _resolve_nvl_name(db, it.paper_material_id, it.other_material_id, it.ten_hang)
            if not ten_hang:
                ten_hang = it.ten_hang
            bal = _get_or_create_balance(db, body.warehouse_xuat_id,
                                         it.paper_material_id, it.other_material_id,
                                         ten_hang=ten_hang, don_vi=it.don_vi or don_vi)
            if bal.ton_luong < it.so_luong:
                raise HTTPException(400, f"Không đủ tồn tại kho xuất: {ten_hang} — "
                                    f"cần {float(it.so_luong):g}, còn {float(bal.ton_luong):g}")

    try:
        phieu = PhieuChuyenKho(
            so_phieu=_gen_so(db, "CK", PhieuChuyenKho),
            warehouse_xuat_id=body.warehouse_xuat_id,
            warehouse_nhap_id=body.warehouse_nhap_id,
            ngay=body.ngay,
            ghi_chu=body.ghi_chu,
            created_by=current_user.id,
        )
        db.add(phieu)
        db.flush()

        for it in body.items:
            is_phoi = bool(it.production_order_id) and not it.paper_material_id and not it.other_material_id
            if is_phoi:
                # Phôi sóng: chỉ tạo PhieuChuyenKhoItem, KHÔNG dùng InventoryBalance
                # get_ton_kho_lsx đọc tong_chuyen từ bảng này để tính tồn kho phôi

                # Tự động lấy don_gia_noi_bo từ LSX nếu client không truyền (hoặc truyền 0)
                don_gia_phoi = it.don_gia
                if (not don_gia_phoi or don_gia_phoi == Decimal("0")) and it.production_order_id:
                    lsx = db.get(ProductionOrder, it.production_order_id)
                    if lsx and lsx.don_gia_noi_bo and lsx.don_gia_noi_bo > 0:
                        don_gia_phoi = lsx.don_gia_noi_bo

                db.add(PhieuChuyenKhoItem(
                    phieu_chuyen_kho_id=phieu.id,
                    production_order_id=it.production_order_id,
                    paper_material_id=None,
                    other_material_id=None,
                    ten_hang=it.ten_hang or f"LSX #{it.production_order_id}",
                    don_vi=it.don_vi,
                    so_luong=it.so_luong,
                    don_gia=don_gia_phoi,
                    ghi_chu=it.ghi_chu,
                ))
            else:
                ten_hang, don_vi = _resolve_nvl_name(db, it.paper_material_id, it.other_material_id, it.ten_hang)
                if not ten_hang:
                    ten_hang = it.ten_hang
                don_vi = it.don_vi or don_vi

                # Lấy giá bình quân TRƯỚC khi tạo item — lock row để tránh race condition
                bal_xuat = _get_or_create_balance(db, body.warehouse_xuat_id,
                                                  it.paper_material_id, it.other_material_id,
                                                  ten_hang=ten_hang, don_vi=don_vi, lock=True)
                don_gia_xuat = bal_xuat.don_gia_binh_quan

                db.add(PhieuChuyenKhoItem(
                    phieu_chuyen_kho_id=phieu.id,
                    paper_material_id=it.paper_material_id,
                    other_material_id=it.other_material_id,
                    production_order_id=it.production_order_id,
                    ten_hang=ten_hang,
                    don_vi=don_vi,
                    so_luong=it.so_luong,
                    don_gia=don_gia_xuat,
                    ghi_chu=it.ghi_chu,
                ))

                _xuat_balance(bal_xuat, it.so_luong, ten_hang)
                _log_tx(db, body.warehouse_xuat_id, "CHUYEN_KHO_XUAT",
                        it.so_luong, don_gia_xuat, bal_xuat.ton_luong,
                        "phieu_chuyen_kho", phieu.id, current_user.id,
                        paper_material_id=it.paper_material_id,
                        other_material_id=it.other_material_id,
                        ghi_chu=it.ghi_chu)

                bal_nhap = _get_or_create_balance(db, body.warehouse_nhap_id,
                                                  it.paper_material_id, it.other_material_id,
                                                  ten_hang=ten_hang, don_vi=don_vi)
                _nhap_balance(bal_nhap, it.so_luong, don_gia_xuat)
                _log_tx(db, body.warehouse_nhap_id, "CHUYEN_KHO_NHAP",
                        it.so_luong, don_gia_xuat, bal_nhap.ton_luong,
                        "phieu_chuyen_kho", phieu.id, current_user.id,
                        paper_material_id=it.paper_material_id,
                        other_material_id=it.other_material_id,
                        ghi_chu=it.ghi_chu)

        # ── Ghi sổ kế toán tự động ──────────────────────────────────────────────
        acc_service = AccountingService(db)

        # Lấy thông tin pháp nhân và xưởng — mỗi chiều dùng phap_nhan riêng
        wh_xuat = db.get(Warehouse, body.warehouse_xuat_id)
        wh_nhap = db.get(Warehouse, body.warehouse_nhap_id)

        phap_nhan_id_xuat = wh_xuat.phan_xuong_obj.phap_nhan_id if wh_xuat and wh_xuat.phan_xuong_obj else None
        phap_nhan_id_nhap = wh_nhap.phan_xuong_obj.phap_nhan_id if wh_nhap and wh_nhap.phan_xuong_obj else None
        phap_nhan_id = phap_nhan_id_xuat  # giữ alias cho bút toán xuất

        # Chuẩn bị dữ liệu dòng cho kế toán
        journal_items = []
        for it in phieu.items:
            # Xác định tài khoản 152 (NVL) hay 155 (Thành phẩm / Phôi sóng)
            _product_id = getattr(it, "product_id", None)
            _is_phoi_item = bool(it.production_order_id) and not it.paper_material_id and not it.other_material_id
            tk_kho = "155" if _product_id or it.production_order_id else "152"

            # --- LẤY GIÁ CHUYỂN ---
            std_price = Decimal("0")
            if it.paper_material_id:
                mat = db.get(PaperMaterial, it.paper_material_id)
                std_price = mat.gia_dinh_muc if mat else Decimal("0")
            elif it.other_material_id:
                mat = db.get(OtherMaterial, it.other_material_id)
                std_price = mat.gia_dinh_muc if mat else Decimal("0")
            elif _is_phoi_item:
                # Phôi sóng: dùng giá đã lưu trên item (= don_gia_noi_bo tại thời điểm tạo phiếu)
                std_price = it.don_gia or Decimal("0")
            elif _product_id:
                prod = db.get(Product, _product_id)
                std_price = prod.gia_dinh_muc if prod else Decimal("0")

            # Nếu không có giá, dùng giá bình quân lưu trong item
            transfer_price = std_price if std_price > 0 else (it.don_gia or Decimal("0"))

            # Phôi không có don_gia_binh_quan từ InventoryBalance → dùng transfer_price cho cả 2 vế
            don_gia_bq = transfer_price if _is_phoi_item else (it.don_gia or Decimal("0"))

            journal_items.append({
                "ten_hang": it.ten_hang,
                "so_luong": it.so_luong,
                "don_gia": transfer_price,
                "don_gia_binh_quan": don_gia_bq,
                "tk_kho": tk_kho
            })

        # Guard idempotency: không tạo bút toán trùng nếu phiếu đã có journal
        _existing_journal = db.query(JournalEntry).filter(
            JournalEntry.chung_tu_loai == "phieu_chuyen_kho",
            JournalEntry.chung_tu_id == phieu.id,
        ).first()

        if journal_items and not phieu.bo_qua_hach_toan and not _existing_journal:
            # 1. Bút toán xưởng xuất:
            # - Nợ 1368 / Có 5112 (Doanh thu nội bộ theo Giá định mức)
            # - Nợ 6322 / Có 152-155 (Giá vốn nội bộ theo Giá bình quân)
            lines_xuat = []
            for i in journal_items:
                val_std = float(i["so_luong"]) * float(i["don_gia"])      # Giá định mức
                val_act = float(i["so_luong"]) * float(i.get("don_gia_binh_quan", i["don_gia"])) # Giá bình quân

                # Cặp Doanh thu nội bộ
                lines_xuat.append({"so_tk": "1368", "dien_giai": f"DTNB: {i['ten_hang']}", "so_tien_no": val_std, "so_tien_co": 0})
                lines_xuat.append({"so_tk": "5112", "dien_giai": f"DTNB: {i['ten_hang']}", "so_tien_no": 0, "so_tien_co": val_std})

                # Cặp Giá vốn nội bộ
                lines_xuat.append({"so_tk": "6322", "dien_giai": f"GVNB: {i['ten_hang']}", "so_tien_no": val_act, "so_tien_co": 0})
                lines_xuat.append({"so_tk": i["tk_kho"], "dien_giai": f"GVNB: {i['ten_hang']}", "so_tien_no": 0, "so_tien_co": val_act})

            acc_service._create_journal_entry(
                ngay=phieu.ngay,
                dien_giai=f"Xuất nội bộ: {phieu.so_phieu}",
                loai_but_toan="chuyen_kho_xuat",
                chung_tu_loai="phieu_chuyen_kho",
                chung_tu_id=phieu.id,
                phap_nhan_id=phap_nhan_id,
                phan_xuong_id=wh_xuat.phan_xuong_id,
                lines=lines_xuat
            )

            # 2. Bút toán xưởng nhập: Nợ 152-155 / Có 3368 (Theo Giá định mức)
            acc_service.post_inventory_journal(
                ngay=phieu.ngay,
                loai="CHUYEN_KHO_NHAP",
                chung_tu_loai="phieu_chuyen_kho",
                chung_tu_id=phieu.id,
                phap_nhan_id=phap_nhan_id_nhap,
                phan_xuong_id=wh_nhap.phan_xuong_id,
                items=[{
                    "ten_hang": i["ten_hang"],
                    "so_luong": i["so_luong"],
                    "don_gia": i["don_gia"],
                    "tk_no": i["tk_kho"],
                    "tk_co": "3368"
                } for i in journal_items]
            )

        db.commit()
        db.refresh(phieu)
        return _ck_to_dict(phieu, db)
    except Exception:
        db.rollback()
        raise


@router.delete("/phieu-chuyen/{phieu_id}")
def delete_phieu_chuyen(phieu_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = db.get(PhieuChuyenKho, phieu_id)
    if not p:
        raise HTTPException(404, "Không tìm thấy phiếu chuyển")
    if p.trang_thai != "nhap":
        raise HTTPException(400, "Chỉ được xoá phiếu ở trạng thái Nhập")

    for it in p.items:
        _is_phoi = bool(it.production_order_id) and not it.paper_material_id and not it.other_material_id
        if _is_phoi:
            # Phôi sóng không dùng InventoryBalance — tồn kho tự đảo ngược khi xóa PhieuChuyenKhoItem
            continue

        bal_xuat = _get_or_create_balance(db, p.warehouse_xuat_id,
                                          it.paper_material_id, it.other_material_id,
                                          ten_hang=it.ten_hang, don_vi=it.don_vi)
        bal_xuat.ton_luong += it.so_luong
        bal_xuat.gia_tri_ton = bal_xuat.ton_luong * bal_xuat.don_gia_binh_quan
        bal_xuat.cap_nhat_luc = datetime.now(timezone.utc)
        _log_tx(db, p.warehouse_xuat_id, "XOA_CHUYEN_XUAT",
                it.so_luong, it.don_gia, bal_xuat.ton_luong,
                "phieu_chuyen_kho", p.id, current_user.id,
                paper_material_id=it.paper_material_id,
                other_material_id=it.other_material_id,
                ghi_chu=f"Xóa {p.so_phieu}")

        bal_nhap = _get_or_create_balance(db, p.warehouse_nhap_id,
                                          it.paper_material_id, it.other_material_id,
                                          ten_hang=it.ten_hang, don_vi=it.don_vi)
        bal_nhap.ton_luong = max(Decimal("0"), bal_nhap.ton_luong - it.so_luong)
        bal_nhap.gia_tri_ton = bal_nhap.ton_luong * bal_nhap.don_gia_binh_quan
        bal_nhap.cap_nhat_luc = datetime.now(timezone.utc)
        _log_tx(db, p.warehouse_nhap_id, "XOA_CHUYEN_NHAP",
                it.so_luong, it.don_gia, bal_nhap.ton_luong,
                "phieu_chuyen_kho", p.id, current_user.id,
                paper_material_id=it.paper_material_id,
                other_material_id=it.other_material_id,
                ghi_chu=f"Xóa {p.so_phieu}")

    # Đảo ngược bút toán kế toán
    acc_service = AccountingService(db)
    acc_service._reverse_journal_entries("phieu_chuyen_kho", phieu_id)

    db.delete(p)
    db.commit()
    return {"ok": True}


def _ck_to_dict(p: PhieuChuyenKho, db: Session) -> dict:
    wh_x = db.get(Warehouse, p.warehouse_xuat_id)
    wh_n = db.get(Warehouse, p.warehouse_nhap_id)

    px_x_id = wh_x.phan_xuong_id if wh_x else None
    px_n_id = wh_n.phan_xuong_id if wh_n else None
    px_x = db.get(PhanXuong, px_x_id) if px_x_id else None
    px_n = db.get(PhanXuong, px_n_id) if px_n_id else None
    pn_x = db.get(PhapNhan, px_x.phap_nhan_id) if px_x and px_x.phap_nhan_id else None
    pn_n = db.get(PhapNhan, px_n.phap_nhan_id) if px_n and px_n.phap_nhan_id else None

    # phap_nhan_id dùng để chọn template in — ưu tiên từ ProductionOrder của items phôi
    phap_nhan_id_for_print: Optional[int] = None
    for it in p.items:
        po_id = getattr(it, "production_order_id", None)
        if po_id:
            lsx = db.get(ProductionOrder, po_id)
            if lsx and lsx.phap_nhan_id:
                phap_nhan_id_for_print = lsx.phap_nhan_id
                break
    if not phap_nhan_id_for_print and px_x and px_x.phap_nhan_id:
        phap_nhan_id_for_print = px_x.phap_nhan_id

    return {
        "id": p.id,
        "so_phieu": p.so_phieu,
        "warehouse_xuat_id": p.warehouse_xuat_id,
        "ten_kho_xuat": wh_x.ten_kho if wh_x else "",
        "phan_xuong_xuat_id": px_x.id if px_x else None,
        "ten_phan_xuong_xuat": px_x.ten_xuong if px_x else "",
        "phap_nhan_xuat_id": pn_x.id if pn_x else None,
        "ten_phap_nhan_xuat": pn_x.ten_phap_nhan if pn_x else "",
        "warehouse_nhap_id": p.warehouse_nhap_id,
        "ten_kho_nhap": wh_n.ten_kho if wh_n else "",
        "phan_xuong_nhap_id": px_n.id if px_n else None,
        "ten_phan_xuong_nhap": px_n.ten_xuong if px_n else "",
        "phap_nhan_nhap_id": pn_n.id if pn_n else None,
        "ten_phap_nhan_nhap": pn_n.ten_phap_nhan if pn_n else "",
        "ngay": str(p.ngay),
        "ghi_chu": p.ghi_chu,
        "trang_thai": p.trang_thai,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "phap_nhan_id_for_print": phap_nhan_id_for_print,
        "items": [_ck_item_dict(it, db) for it in p.items],
    }


def _ck_item_dict(it: "PhieuChuyenKhoItem", db: Session) -> dict:
    d: dict = {
        "id": it.id,
        "paper_material_id": it.paper_material_id,
        "other_material_id": it.other_material_id,
        "production_order_id": getattr(it, "production_order_id", None),
        "ten_hang": it.ten_hang,
        "don_vi": it.don_vi,
        "so_luong": float(it.so_luong),
        "don_gia": float(it.don_gia),
        "ghi_chu": it.ghi_chu,
    }
    po_id = getattr(it, "production_order_id", None)
    if po_id:
        lsx = db.get(ProductionOrder, po_id)
        if lsx:
            d["so_lsx"] = lsx.so_lenh or ""
            d["don_gia_noi_bo"] = float(lsx.don_gia_noi_bo) if lsx.don_gia_noi_bo else None
            # Quy cách: ưu tiên PhieuIn.quy_cach (đã format sẵn), fallback về dai×rong×cao
            phieu_in = db.query(PhieuIn).filter(PhieuIn.production_order_id == po_id).first()
            if phieu_in and phieu_in.quy_cach:
                d["quy_cach"] = phieu_in.quy_cach
            first = lsx.items[0] if lsx.items else None
            if first:
                d["so_lop"] = first.so_lop
                d["to_hop_song"] = first.to_hop_song or ""
                if "quy_cach" not in d:
                    dai = int(first.dai) if first.dai else 0
                    rong = int(first.rong) if first.rong else 0
                    cao = int(first.cao) if first.cao else 0
                    if dai and rong and cao:
                        d["quy_cach"] = f"{dai}×{rong}×{cao}"
                # Khổ x Cắt: kích thước phôi thực tế từ KHSX (kho_tt × dai_tt)
                kho_tt = int(first.kho_tt) if first.kho_tt else 0
                dai_tt = int(first.dai_tt) if first.dai_tt else 0
                if kho_tt and dai_tt:
                    d["kho_cat"] = f"{kho_tt}×{dai_tt}"
                if first.product_id:
                    prod = db.get(Product, first.product_id)
                    if prod:
                        d["ma_sp"] = prod.ma_amis or prod.ma_hang or ""
    return d
