"""
Unified QC calculation engine — dùng chung cho NVL và giấy cuộn.

Hỗ trợ 6 kiểu kiểm tra:
  pass_fail     — nhập tay đạt/không đạt, không tính TB
  range         — giá trị đơn trong [min, max]
  min           — giá trị đơn >= min
  max           — giá trị đơn <= max
  average_range — TB N lần đo nằm trong center ± tolerance_pct%
  average_min   — TB N lần đo >= min
"""
from __future__ import annotations
from typing import Any


def calc_chi_tieu_result(
    kieu_kiem_tra: str,
    measurements: list[float | None],
    gia_tri_min: float | None = None,
    gia_tri_max: float | None = None,
    tolerance_pct: float | None = None,
) -> dict[str, Any]:
    """
    Tính kết quả cho 1 chỉ tiêu.

    Args:
        kieu_kiem_tra: loại kiểm tra
        measurements:  danh sách giá trị đo (có thể có None — bỏ qua)
        gia_tri_min:   giá trị min, hoặc center nếu average_range
        gia_tri_max:   giá trị max (range)
        tolerance_pct: sai số % (average_range)

    Returns:
        {"tb": float | None, "ket_qua": "dat" | "khong_dat" | None}
    """
    vals = [v for v in measurements if v is not None]

    if kieu_kiem_tra == "pass_fail":
        return {"tb": None, "ket_qua": None}

    if not vals:
        return {"tb": None, "ket_qua": None}

    tb = round(sum(vals) / len(vals), 4)

    if kieu_kiem_tra == "range":
        if gia_tri_min is not None and gia_tri_max is not None:
            ket_qua = "dat" if gia_tri_min <= tb <= gia_tri_max else "khong_dat"
        else:
            ket_qua = None
        return {"tb": tb, "ket_qua": ket_qua}

    if kieu_kiem_tra == "min":
        ket_qua = ("dat" if tb >= gia_tri_min else "khong_dat") if gia_tri_min is not None else None
        return {"tb": tb, "ket_qua": ket_qua}

    if kieu_kiem_tra == "max":
        ket_qua = ("dat" if tb <= gia_tri_max else "khong_dat") if gia_tri_max is not None else None
        return {"tb": tb, "ket_qua": ket_qua}

    if kieu_kiem_tra == "average_range":
        # gia_tri_min = center; tolerance_pct = sai số %
        if gia_tri_min is not None and tolerance_pct is not None:
            center = gia_tri_min
            lower = center * (1 - tolerance_pct / 100)
            upper = center * (1 + tolerance_pct / 100)
            ket_qua = "dat" if lower <= tb <= upper else "khong_dat"
        else:
            ket_qua = None
        return {"tb": tb, "ket_qua": ket_qua}

    if kieu_kiem_tra == "average_min":
        ket_qua = ("dat" if tb >= gia_tri_min else "khong_dat") if gia_tri_min is not None else None
        return {"tb": tb, "ket_qua": ket_qua}

    return {"tb": tb, "ket_qua": None}


def calc_overall_result(
    item_results: list[dict[str, Any]],
    bat_buoc_list: list[bool],
) -> str | None:
    """
    Kết quả tổng: "dat" nếu mọi chỉ tiêu bắt buộc đã có dữ liệu và đều đạt.
    Trả None nếu chưa có chỉ tiêu bắt buộc nào có kết quả.
    """
    mandatory = [
        r["ket_qua"]
        for r, bat_buoc in zip(item_results, bat_buoc_list)
        if bat_buoc and r["ket_qua"] is not None
    ]
    if not mandatory:
        return None
    return "dat" if all(k == "dat" for k in mandatory) else "khong_dat"


def calc_paper_qc_results(phieu: Any) -> None:
    """
    Tính TB và kết quả cho phiếu QC giấy cuộn (backward-compat với hardcoded fields).
    Ghi trực tiếp vào object phieu.
    """
    # Định lượng
    vals_dl = [v for v in [phieu.dl_l1, phieu.dl_l2] if v is not None]
    if vals_dl:
        phieu.dl_tb = round(sum(vals_dl) / len(vals_dl), 3)
        if phieu.tc_dinh_luong is not None and phieu.tc_sai_so_pct is not None:
            r = calc_chi_tieu_result(
                "average_range",
                vals_dl,
                gia_tri_min=float(phieu.tc_dinh_luong),
                tolerance_pct=float(phieu.tc_sai_so_pct),
            )
            phieu.dl_ket_qua = r["ket_qua"]
        else:
            phieu.dl_ket_qua = None
    else:
        phieu.dl_tb = None
        phieu.dl_ket_qua = None

    # Độ bục
    vals_buc = [v for v in [phieu.buc_l1, phieu.buc_l2, phieu.buc_l3, phieu.buc_l4] if v is not None]
    if vals_buc:
        phieu.buc_tb = round(sum(vals_buc) / len(vals_buc), 4)
        if phieu.tc_do_buc is not None:
            r = calc_chi_tieu_result("average_min", vals_buc, gia_tri_min=float(phieu.tc_do_buc))
            phieu.buc_ket_qua = r["ket_qua"]
    else:
        phieu.buc_tb = None
        phieu.buc_ket_qua = None

    # Độ nén vòng
    vals_nen = [v for v in [phieu.nen_vong_l1, phieu.nen_vong_l2, phieu.nen_vong_l3] if v is not None]
    if vals_nen:
        phieu.nen_vong_tb = round(sum(vals_nen) / len(vals_nen), 4)
        if phieu.tc_do_nen_vong is not None:
            r = calc_chi_tieu_result("average_min", vals_nen, gia_tri_min=float(phieu.tc_do_nen_vong))
            phieu.nen_vong_ket_qua = r["ket_qua"]
    else:
        phieu.nen_vong_tb = None
        phieu.nen_vong_ket_qua = None

    # Khổ giấy
    if phieu.kho_thuc_te is not None and phieu.kho_tc is not None:
        phieu.kho_ket_qua = "dat" if abs(phieu.kho_thuc_te - float(phieu.kho_tc)) <= 4 else "khong_dat"
    else:
        phieu.kho_ket_qua = None

    # Kết quả tổng
    all_kq = [phieu.dl_ket_qua, phieu.buc_ket_qua, phieu.nen_vong_ket_qua, phieu.kho_ket_qua]
    filled = [k for k in all_kq if k is not None]
    phieu.ket_qua = (
        "dat" if filled and all(k == "dat" for k in filled)
        else ("khong_dat" if filled else None)
    )
