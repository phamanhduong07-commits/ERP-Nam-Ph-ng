"""
cost_analysis.py — Phân tích chi phí giấy theo KHSX

GET /api/production-orders/{khsx_id}/cost-analysis
    So sánh chi phí giấy kế hoạch (confirmed BOM) vs thực tế (da_xuat MaterialIssue)
    cho từng LSX thuộc lệnh sản xuất.
"""

import json
from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.deps import get_current_user, require_any_permission
from app.models.auth import User
from app.models.bom import ProductionBOM, ProductionBOMItem
from app.models.master import PaperMaterial
from app.models.production import ProductionOrder, ProductionOrderItem
from app.models.warehouse_doc import MaterialIssue, MaterialIssueItem

router = APIRouter(
    prefix="/api/production-orders",
    dependencies=[Depends(require_any_permission("production.cost_analysis"))],
    tags=["cost-analysis"],
)


# ─── Response schemas ──────────────────────────────────────────────────────────

class PaperRowOut(BaseModel):
    ma_ky_hieu: str
    vi_tri_lop: str
    # Planned (from confirmed ProductionBOMItem)
    kg_ke_hoach: float
    don_gia_ke_hoach: float
    chi_phi_ke_hoach: float
    # Actual (aggregated from allocation_detail)
    kg_thuc_te: float
    don_gia_thuc_te: float       # weighted avg: total_thanh_tien / total_kg
    chi_phi_thuc_te: float
    # Delta
    delta_kg: float              # thuc_te - ke_hoach
    delta_chi_phi: float         # thuc_te - ke_hoach


class LsxCostItemOut(BaseModel):
    lsx_id: int
    ten_hang: str
    so_luong_ke_hoach: float
    paper_rows: list[PaperRowOut]
    tong_chi_phi_giay_ke_hoach: float
    tong_chi_phi_giay_thuc_te: float
    gia_thanh_giay_ke_hoach: float   # per unit = tong / so_luong_ke_hoach (0 if so_luong=0)
    gia_thanh_giay_thuc_te: float
    has_bom: bool
    has_allocation: bool


class CostAnalysisSummary(BaseModel):
    tong_ke_hoach: float
    tong_thuc_te: float
    delta_tong: float


class CostAnalysisResponse(BaseModel):
    khsx_id: int
    so_lenh: str
    items: list[LsxCostItemOut]
    summary: CostAnalysisSummary


# ─── Endpoint ──────────────────────────────────────────────────────────────────

@router.get("/{khsx_id}/cost-analysis", response_model=CostAnalysisResponse)
def get_cost_analysis(
    khsx_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CostAnalysisResponse:
    """
    Phân tích biến động chi phí giấy cho lệnh sản xuất.

    - Kế hoạch: lấy từ ProductionBOM confirmed mới nhất của mỗi LSX.
    - Thực tế: tổng hợp từ allocation_detail của các MaterialIssueItem
      thuộc phiếu xuất đã hoàn thành (trang_thai='da_xuat').
    - Trả về so sánh chi phí giấy theo từng mã ký hiệu cho mỗi LSX,
      kèm tổng hợp toàn lệnh.
    """

    # Step 1 — Load order
    order: Optional[ProductionOrder] = db.get(ProductionOrder, khsx_id)
    if not order:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy lệnh sản xuất id={khsx_id}")

    # Step 2 — Load all LSX items for this KHSX
    poi_list: list[ProductionOrderItem] = (
        db.query(ProductionOrderItem)
        .filter(ProductionOrderItem.production_order_id == khsx_id)
        .order_by(ProductionOrderItem.id)
        .all()
    )

    if not poi_list:
        return CostAnalysisResponse(
            khsx_id=khsx_id,
            so_lenh=order.so_lenh,
            items=[],
            summary=CostAnalysisSummary(tong_ke_hoach=0.0, tong_thuc_te=0.0, delta_tong=0.0),
        )

    lsx_ids = [p.id for p in poi_list]

    # Step 3 — Load all confirmed BOMs for these LSXs (with their items)
    boms: list[ProductionBOM] = (
        db.query(ProductionBOM)
        .filter(
            ProductionBOM.production_order_item_id.in_(lsx_ids),
            ProductionBOM.trang_thai == "confirmed",
        )
        .options(selectinload(ProductionBOM.items))
        .all()
    )

    # bom_map: lsx_id → most recent confirmed ProductionBOM
    bom_map: dict[int, ProductionBOM] = {}
    for bom in boms:
        lsx_id = bom.production_order_item_id
        if lsx_id not in bom_map or bom.id > bom_map[lsx_id].id:
            bom_map[lsx_id] = bom

    # Step 4 — Load all da_xuat MaterialIssues + items + paper_material for this KHSX
    mi_list: list[MaterialIssue] = (
        db.query(MaterialIssue)
        .filter(
            MaterialIssue.production_order_id == khsx_id,
            MaterialIssue.trang_thai == "da_xuat",
        )
        .options(
            selectinload(MaterialIssue.items).selectinload(MaterialIssueItem.paper_material)
        )
        .all()
    )

    # Step 5 — Aggregate actual cost per (lsx_id, ma_ky_hieu)
    # actual_map: (lsx_id, ma_ky_hieu) → {"kg": float, "thanh_tien": float}
    actual_map: dict[tuple[int, str], dict] = defaultdict(
        lambda: {"kg": 0.0, "thanh_tien": 0.0}
    )

    for mi in mi_list:
        for item in mi.items:
            if not item.paper_material_id or not item.allocation_detail:
                continue
            pm: Optional[PaperMaterial] = item.paper_material
            if pm is None:
                continue
            ma = (pm.ma_ky_hieu or "").strip().upper()
            if not ma:
                continue
            try:
                entries = json.loads(item.allocation_detail)
            except Exception:
                continue
            if not isinstance(entries, list):
                continue
            for e in entries:
                entry_lsx_id = e.get("lsx_id")
                kg = float(e.get("kg_phan_bo", 0) or 0)
                tt = float(e.get("thanh_tien", 0) or 0)
                if entry_lsx_id and kg > 0:
                    actual_map[(int(entry_lsx_id), ma)]["kg"] += kg
                    actual_map[(int(entry_lsx_id), ma)]["thanh_tien"] += tt

    # Step 6 — Build result per LSX
    items_out: list[LsxCostItemOut] = []

    for poi in poi_list:
        bom = bom_map.get(poi.id)
        has_bom = bom is not None
        has_allocation = any(k[0] == poi.id for k in actual_map)

        # planned_map: ma_ky_hieu (upper) → first ProductionBOMItem seen for that grade
        # For duplicates, accumulate kg/cost onto first occurrence
        planned_map: dict[str, ProductionBOMItem] = {}
        planned_kg_extra: dict[str, float] = defaultdict(float)
        planned_cost_extra: dict[str, float] = defaultdict(float)

        if bom:
            for bi in bom.items:
                ma = (bi.ma_ky_hieu or "").strip().upper()
                if not ma:
                    continue
                if ma not in planned_map:
                    planned_map[ma] = bi
                else:
                    # Accumulate additional rows for same grade
                    planned_kg_extra[ma] += float(bi.trong_luong_can_tong or 0)
                    planned_cost_extra[ma] += float(bi.thanh_tien or 0)

        # Collect all grades from both planned and actual for this LSX
        actual_keys_for_lsx = {k[1] for k in actual_map if k[0] == poi.id}
        all_ma = set(planned_map.keys()) | actual_keys_for_lsx

        paper_rows: list[PaperRowOut] = []
        for ma in sorted(all_ma):
            bi = planned_map.get(ma)
            act = actual_map.get((poi.id, ma), {"kg": 0.0, "thanh_tien": 0.0})

            kg_kh = float(bi.trong_luong_can_tong or 0) if bi else 0.0
            kg_kh += planned_kg_extra.get(ma, 0.0)

            don_gia_kh = float(bi.don_gia_kg or 0) if bi else 0.0
            chi_phi_kh = float(bi.thanh_tien or 0) if bi else 0.0
            chi_phi_kh += planned_cost_extra.get(ma, 0.0)

            vi_tri = (bi.vi_tri_lop or "") if bi else ""

            kg_tt = act["kg"]
            tt_tt = act["thanh_tien"]
            don_gia_tt = (tt_tt / kg_tt) if kg_tt > 0 else 0.0

            paper_rows.append(
                PaperRowOut(
                    ma_ky_hieu=ma,
                    vi_tri_lop=vi_tri,
                    kg_ke_hoach=round(kg_kh, 3),
                    don_gia_ke_hoach=round(don_gia_kh, 2),
                    chi_phi_ke_hoach=round(chi_phi_kh, 2),
                    kg_thuc_te=round(kg_tt, 3),
                    don_gia_thuc_te=round(don_gia_tt, 2),
                    chi_phi_thuc_te=round(tt_tt, 2),
                    delta_kg=round(kg_tt - kg_kh, 3),
                    delta_chi_phi=round(tt_tt - chi_phi_kh, 2),
                )
            )

        tong_kh = sum(r.chi_phi_ke_hoach for r in paper_rows)
        tong_tt = sum(r.chi_phi_thuc_te for r in paper_rows)
        sl = float(poi.so_luong_ke_hoach or 0)

        items_out.append(
            LsxCostItemOut(
                lsx_id=poi.id,
                ten_hang=poi.ten_hang,
                so_luong_ke_hoach=sl,
                paper_rows=paper_rows,
                tong_chi_phi_giay_ke_hoach=round(tong_kh, 2),
                tong_chi_phi_giay_thuc_te=round(tong_tt, 2),
                gia_thanh_giay_ke_hoach=round(tong_kh / sl, 2) if sl else 0.0,
                gia_thanh_giay_thuc_te=round(tong_tt / sl, 2) if sl else 0.0,
                has_bom=has_bom,
                has_allocation=has_allocation,
            )
        )

    # Step 7 — Roll up summary
    total_kh = sum(i.tong_chi_phi_giay_ke_hoach for i in items_out)
    total_tt = sum(i.tong_chi_phi_giay_thuc_te for i in items_out)

    return CostAnalysisResponse(
        khsx_id=khsx_id,
        so_lenh=order.so_lenh,
        items=items_out,
        summary=CostAnalysisSummary(
            tong_ke_hoach=round(total_kh, 2),
            tong_thuc_te=round(total_tt, 2),
            delta_tong=round(total_tt - total_kh, 2),
        ),
    )
