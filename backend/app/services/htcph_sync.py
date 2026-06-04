"""
HTCPH Sync Service
==================
Pulls product master data (DMHH + DTBaoGia) from SQL Server HTCPH
and upserts into the FastAPI ERP (PostgreSQL/SQLite).

Runs asynchronously by offloading blocking pyodbc calls to a thread executor.
Daily background loop triggers at 02:00 local time.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any

import pyodbc
from sqlalchemy.orm import Session

from app.models.import_log import ImportLog
from app.models.master import CauTrucThongDung, Customer, Product

logger = logging.getLogger("erp.htcph_sync")

# ---------------------------------------------------------------------------
# Connection string
# ---------------------------------------------------------------------------
_SS_CONN_STR = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=203.162.54.176,1441;"
    "DATABASE=HTCPH;"
    "UID=duong;"
    "PWD=Namphuong123@;"
    "TrustServerCertificate=yes;"
    "Connection Timeout=20;"
)

# Thread pool — keep at 2 so we never saturate the SQL Server connection limit
_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="htcph")

# ---------------------------------------------------------------------------
# Regex: parse MaHH → (ma_kh_prefix, dai, rong, cao, so_lop)
# Example: "KH01_40.0*30.0*20.0_5L" or "KH01_40*30*20_3L"
# ---------------------------------------------------------------------------
_MAHH_RE = re.compile(
    r"^([^_]+)_(\d+\.?\d*)\*(\d+\.?\d*)(?:\*(\d+\.?\d*))?_(\d+)L",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Normalisation helpers
# ---------------------------------------------------------------------------

def _to_decimal(value: Any) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(str(value).strip())
    except (InvalidOperation, ValueError):
        return None


def _round1(value: float | None) -> float | None:
    return round(value, 1) if value is not None else None


def _norm_loai_lan(raw: Any) -> str | None:
    """'+ 0' → 'bang', '+ -' → 'am_duong', else None."""
    if not raw:
        return None
    s = str(raw).strip()
    if s == "+ 0":
        return "bang"
    if s == "+ -":
        return "am_duong"
    return None


def _norm_coverage(raw: Any) -> int:
    """'Không'→0, 'Trong'→1, 'Ngoài'/'2 Mặt'/'2'→2."""
    if not raw:
        return 0
    s = str(raw).strip()
    if s in ("Không", "Khong", "0", ""):
        return 0
    if s in ("Trong", "1"):
        return 1
    if s in ("Ngoài", "Ngoai", "2 Mặt", "2 Mat", "2"):
        return 2
    return 0


def _norm_bool(raw: Any) -> bool:
    """Convert various truthy representations to Python bool."""
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, int):
        return raw != 0
    if raw is None:
        return False
    s = str(raw).strip().lower()
    return s in ("1", "true", "yes", "có", "co", "x")


def _norm_int(raw: Any, default: int = 0) -> int:
    if raw is None:
        return default
    try:
        return max(0, int(raw))
    except (ValueError, TypeError):
        return default


# ---------------------------------------------------------------------------
# SQL: DMHH query
# ---------------------------------------------------------------------------
_DMHH_SQL = """
SELECT
    MaHH,
    TenHH,
    DVT,
    GiaBan,
    GiaMua,
    KhongNXT,
    Loai
FROM DMHH
WHERE MaHH IS NOT NULL
  AND TenHH IS NOT NULL
"""

# ---------------------------------------------------------------------------
# SQL: latest DTBaoGia per product
# Joins MTBaoGia (header) for MaKH and DTBaoGia (detail) for dimensions/paper.
# DTBaoGia không có MaHH FK (luôn NULL). Match bằng:
# (MTBaoGia.MaKH, round(Dai,1), round(Rong,1), round(Cao,1), Lop) → latest row
# ---------------------------------------------------------------------------
_BG_SQL = """
SELECT
    mb.MaKH,
    dt.Dai, dt.Rong, dt.Cao, dt.Lop,
    dt.Mat_Giay,
    dt.SB_Giay,  dt.MB_Giay,
    dt.SC_Giay,  dt.MC_Giay,
    dt.SE_Giay,  dt.ME_Giay,
    dt.Mat_DL,
    dt.SB_DL,    dt.MB_DL,
    dt.SC_DL,    dt.MC_DL,
    dt.SE_DL,    dt.ME_DL,
    dt.SoMau, dt.LoaiIn, dt.CHAPXA, dt.Lan, dt.LoaiThung,
    dt.isChongTham, dt.isBoi, dt.isBe, dt.isCanMan, dt.Ghim, dt.Dan,
    mb.NgayCT
FROM DTBaoGia dt
INNER JOIN MTBaoGia mb ON mb.MTBGID = dt.MTBGID
WHERE dt.Dai IS NOT NULL AND mb.MaKH IS NOT NULL
ORDER BY mb.NgayCT ASC
"""


# ---------------------------------------------------------------------------
# Internal: fetch from HTCPH (synchronous — runs in executor thread)
# ---------------------------------------------------------------------------

def _fetch_htcph() -> dict[str, Any]:
    """
    Returns:
        {
            "dmhh":      [row_dict, ...],
            "bg_lookup": {(MaKH,D,R,C,Lop): row_dict},  # latest per key
        }
    """
    logger.info("HTCPH fetch: connecting to SQL Server…")
    conn = pyodbc.connect(_SS_CONN_STR)
    try:
        cur = conn.cursor()

        # --- DMHH ---------------------------------------------------------
        cur.execute(_DMHH_SQL)
        cols_dmhh = [c[0] for c in cur.description]
        dmhh_rows = [dict(zip(cols_dmhh, row)) for row in cur.fetchall()]
        logger.info("HTCPH fetch: %d DMHH rows", len(dmhh_rows))

        # --- DTBaoGia: ORDER BY NgayCT ASC → latest overwrites older ------
        cur.execute(_BG_SQL)
        cols_bg = [c[0] for c in cur.description]
        bg_lookup: dict[tuple, dict] = {}
        for row in cur.fetchall():
            d = dict(zip(cols_bg, row))
            key = (
                (d["MaKH"] or "").strip(),
                round(float(d["Dai"] or 0), 1),
                round(float(d["Rong"] or 0), 1),
                round(float(d["Cao"] or 0), 1),
                int(d["Lop"] or 3),
            )
            bg_lookup[key] = d  # latest wins (ORDER BY ASC)

        logger.info("HTCPH fetch: %d DTBaoGia distinct keys", len(bg_lookup))
        return {"dmhh": dmhh_rows, "bg_lookup": bg_lookup}

    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Internal: build a paper-structure dedup key
# ---------------------------------------------------------------------------

def _cau_truc_key(row: dict) -> tuple:
    """Dedup key for CauTrucThongDung: (so_lop, mat, song_1, mat_1, song_2, mat_2, song_3, mat_3)."""
    return (
        row.get("so_lop"),
        row.get("mat"),
        row.get("song_1"),
        row.get("mat_1"),
        row.get("song_2"),
        row.get("mat_2"),
        row.get("song_3"),
        row.get("mat_3"),
    )


def _bg_to_cau_truc(bg: dict, so_lop: int) -> dict | None:
    """
    Convert a DTBaoGia row into a CauTrucThongDung dict.
    Returns None if mat (outer liner) is missing.
    """
    mat = bg.get("Mat_Giay")
    if not mat:
        return None
    return {
        "so_lop":    so_lop,
        "mat":       str(mat).strip() if mat else None,
        "mat_dl":    _to_decimal(bg.get("Mat_DL")),
        "song_1":    str(bg["SB_Giay"]).strip() if bg.get("SB_Giay") else None,
        "song_1_dl": _to_decimal(bg.get("SB_DL")),
        "mat_1":     str(bg["MB_Giay"]).strip() if bg.get("MB_Giay") else None,
        "mat_1_dl":  _to_decimal(bg.get("MB_DL")),
        "song_2":    str(bg["SC_Giay"]).strip() if bg.get("SC_Giay") else None,
        "song_2_dl": _to_decimal(bg.get("SC_DL")),
        "mat_2":     str(bg["MC_Giay"]).strip() if bg.get("MC_Giay") else None,
        "mat_2_dl":  _to_decimal(bg.get("MC_DL")),
        "song_3":    str(bg["SE_Giay"]).strip() if bg.get("SE_Giay") else None,
        "song_3_dl": _to_decimal(bg.get("SE_DL")),
        "mat_3":     None,
        "mat_3_dl":  None,
    }


# ---------------------------------------------------------------------------
# Internal: upsert products + cau_truc (synchronous — runs in executor thread)
# ---------------------------------------------------------------------------

def _upsert(db: Session, htcph_data: dict) -> dict:
    """
    Upsert DMHH rows into products table and DTBaoGia structures into
    cau_truc_thong_dung. Returns stats dict.
    """
    dmhh_rows: list[dict] = htcph_data["dmhh"]
    bg_lookup: dict[str, dict] = htcph_data["bg_lookup"]

    # Pre-load existing products (keyed by ma_amis) and customers (keyed by ma_kh)
    existing_products: dict[str, Product] = {
        p.ma_amis: p for p in db.query(Product).all()
    }
    existing_customers: dict[str, Customer] = {
        c.ma_kh: c for c in db.query(Customer).all()
    }

    # Pre-load existing cau_truc dedup keys
    existing_cau_truc_keys: set[tuple] = {
        _cau_truc_key({
            "so_lop": ct.so_lop, "mat": ct.mat,
            "song_1": ct.song_1, "mat_1": ct.mat_1,
            "song_2": ct.song_2, "mat_2": ct.mat_2,
            "song_3": ct.song_3, "mat_3": ct.mat_3,
        })
        for ct in db.query(CauTrucThongDung).all()
    }

    stats = {"new": 0, "updated": 0, "skipped": 0, "errors": 0}
    error_details: list[str] = []

    for row in dmhh_rows:
        ma_hh = (row.get("MaHH") or "").strip()
        if not ma_hh:
            stats["skipped"] += 1
            continue

        try:
            # ----------------------------------------------------------------
            # Parse MaHH to extract dimensions and so_lop
            # ----------------------------------------------------------------
            m = _MAHH_RE.match(ma_hh)
            ma_kh_prefix: str | None = None
            dai: Decimal | None = None
            rong: Decimal | None = None
            cao: Decimal | None = None
            so_lop: int = 3
            if m:
                ma_kh_prefix = m.group(1)
                dai = _to_decimal(m.group(2))
                rong = _to_decimal(m.group(3))
                cao = _to_decimal(m.group(4))
                so_lop = _norm_int(m.group(5), default=3)

            # ----------------------------------------------------------------
            # Resolve customer FK
            # ----------------------------------------------------------------
            ma_kh_id: int | None = None
            if ma_kh_prefix:
                cust = existing_customers.get(ma_kh_prefix)
                if cust:
                    ma_kh_id = cust.id

            # ----------------------------------------------------------------
            # Merge DTBaoGia fields — lookup bằng (MaKH, D, R, C, Lop)
            # ----------------------------------------------------------------
            bg_key = (
                ma_kh_prefix or "",
                round(float(dai or 0), 1),
                round(float(rong or 0), 1),
                round(float(cao or 0), 1),
                so_lop,
            ) if ma_kh_prefix else None
            bg = bg_lookup.get(bg_key, {}) if bg_key else {}

            gia_ban = _to_decimal(row.get("GiaBan")) or Decimal("0")
            gia_mua = _to_decimal(row.get("GiaMua")) or Decimal("0")
            dvt = str(row.get("DVT") or "Thùng").strip()[:20] or "Thùng"
            loai = str(row.get("Loai") or "").strip() or None
            ten_hang = str(row.get("TenHH") or "").strip() or ma_hh
            khong_tinh_nxt = _norm_bool(row.get("KhongNXT"))
            trang_thai = True

            # Paper structure fields from DTBaoGia
            mat     = str(bg.get("Mat_Giay") or "").strip() or None
            mat_dl  = _to_decimal(bg.get("Mat_DL"))
            song_1    = str(bg.get("SB_Giay") or "").strip() or None
            song_1_dl = _to_decimal(bg.get("SB_DL"))
            mat_1     = str(bg.get("MB_Giay") or "").strip() or None
            mat_1_dl  = _to_decimal(bg.get("MB_DL"))
            song_2    = str(bg.get("SC_Giay") or "").strip() or None
            song_2_dl = _to_decimal(bg.get("SC_DL"))
            mat_2     = str(bg.get("MC_Giay") or "").strip() or None
            mat_2_dl  = _to_decimal(bg.get("MC_DL"))
            song_3    = str(bg.get("SE_Giay") or "").strip() or None
            song_3_dl = _to_decimal(bg.get("SE_DL"))
            mat_3     = None
            mat_3_dl  = None

            so_mau = _norm_int(bg.get("SoMau"), default=0)
            loai_in = _norm_int(bg.get("LoaiIn"), default=0)
            chap_xa = 1 if _norm_bool(bg.get("CHAPXA")) else 0
            loai_lan = _norm_loai_lan(bg.get("Lan"))
            loai_thung = str(bg.get("LoaiThung") or "").strip() or None
            chong_tham = _norm_coverage(bg.get("isChongTham"))
            boi = 1 if _norm_bool(bg.get("isBoi")) else 0
            be_so_con = _norm_int(bg.get("isBe"), default=0)
            can_mang = _norm_coverage(bg.get("isCanMan"))
            ghim = _norm_bool(bg.get("Ghim"))
            dan = _norm_bool(bg.get("Dan"))

            # ----------------------------------------------------------------
            # Upsert Product
            # ----------------------------------------------------------------
            existing = existing_products.get(ma_hh)

            if existing is None:
                # INSERT
                product = Product(
                    ma_amis=ma_hh,
                    ma_hang=ma_hh,
                    ten_hang=ten_hang,
                    dai=dai,
                    rong=rong,
                    cao=cao,
                    so_lop=so_lop,
                    so_mau=so_mau,
                    loai_in=loai_in,
                    ghim=ghim,
                    dan=dan,
                    chap_xa=chap_xa,
                    loai_lan=loai_lan,
                    loai_thung=loai_thung,
                    chong_tham=chong_tham,
                    boi=boi,
                    be_so_con=be_so_con,
                    can_mang=can_mang,
                    mat=mat, mat_dl=mat_dl,
                    song_1=song_1, song_1_dl=song_1_dl,
                    mat_1=mat_1, mat_1_dl=mat_1_dl,
                    song_2=song_2, song_2_dl=song_2_dl,
                    mat_2=mat_2, mat_2_dl=mat_2_dl,
                    song_3=song_3, song_3_dl=song_3_dl,
                    mat_3=mat_3, mat_3_dl=mat_3_dl,
                    dvt=dvt,
                    loai=loai,
                    ma_kh_id=ma_kh_id,
                    gia_ban=gia_ban,
                    gia_mua=gia_mua,
                    khong_tinh_nxt=khong_tinh_nxt,
                    trang_thai=trang_thai,
                )
                db.add(product)
                stats["new"] += 1
            else:
                changed = (
                    existing.gia_ban != gia_ban
                    or existing.so_lop != so_lop
                    or existing.loai_in != loai_in
                    or existing.so_mau != so_mau
                    or existing.chong_tham != chong_tham
                    or existing.boi != boi
                    or existing.be_so_con != be_so_con
                    or existing.ghim != ghim
                    or existing.dan != dan
                    or existing.mat != mat
                )
                if changed:
                    existing.ten_hang = ten_hang
                    existing.dai = dai
                    existing.rong = rong
                    existing.cao = cao
                    existing.so_lop = so_lop
                    existing.so_mau = so_mau
                    existing.loai_in = loai_in
                    existing.ghim = ghim
                    existing.dan = dan
                    existing.chap_xa = chap_xa
                    existing.loai_lan = loai_lan
                    existing.loai_thung = loai_thung
                    existing.chong_tham = chong_tham
                    existing.boi = boi
                    existing.be_so_con = be_so_con
                    existing.can_mang = can_mang
                    existing.mat = mat; existing.mat_dl = mat_dl
                    existing.song_1 = song_1; existing.song_1_dl = song_1_dl
                    existing.mat_1 = mat_1; existing.mat_1_dl = mat_1_dl
                    existing.song_2 = song_2; existing.song_2_dl = song_2_dl
                    existing.mat_2 = mat_2; existing.mat_2_dl = mat_2_dl
                    existing.song_3 = song_3; existing.song_3_dl = song_3_dl
                    existing.mat_3 = mat_3; existing.mat_3_dl = mat_3_dl
                    existing.dvt = dvt
                    existing.loai = loai
                    existing.ma_kh_id = ma_kh_id
                    existing.gia_ban = gia_ban
                    existing.gia_mua = gia_mua
                    existing.khong_tinh_nxt = khong_tinh_nxt
                    existing.updated_at = datetime.now(timezone.utc)
                    stats["updated"] += 1
                else:
                    stats["skipped"] += 1

            # ----------------------------------------------------------------
            # Upsert CauTrucThongDung (paper structure) when bg has data
            # ----------------------------------------------------------------
            if bg:
                ct_dict = _bg_to_cau_truc(bg, so_lop)
                if ct_dict is not None:
                    key = _cau_truc_key(ct_dict)
                    if key not in existing_cau_truc_keys:
                        # Generate a human-readable name
                        parts = [
                            p for p in [
                                ct_dict.get("mat"),
                                ct_dict.get("song_1"),
                                ct_dict.get("mat_1"),
                                ct_dict.get("song_2"),
                                ct_dict.get("mat_2"),
                                ct_dict.get("song_3"),
                                ct_dict.get("mat_3"),
                            ] if p
                        ]
                        ten_cau_truc = "/".join(parts) or f"{so_lop}L"
                        ct = CauTrucThongDung(
                            ten_cau_truc=ten_cau_truc,
                            so_lop=ct_dict["so_lop"],
                            mat=ct_dict["mat"],
                            mat_dl=ct_dict["mat_dl"],
                            song_1=ct_dict["song_1"],
                            song_1_dl=ct_dict["song_1_dl"],
                            mat_1=ct_dict["mat_1"],
                            mat_1_dl=ct_dict["mat_1_dl"],
                            song_2=ct_dict["song_2"],
                            song_2_dl=ct_dict["song_2_dl"],
                            mat_2=ct_dict["mat_2"],
                            mat_2_dl=ct_dict["mat_2_dl"],
                            song_3=ct_dict["song_3"],
                            song_3_dl=ct_dict["song_3_dl"],
                            mat_3=ct_dict["mat_3"],
                            mat_3_dl=ct_dict["mat_3_dl"],
                        )
                        db.add(ct)
                        existing_cau_truc_keys.add(key)

        except Exception as exc:
            stats["errors"] += 1
            msg = f"{ma_hh}: {exc}"
            error_details.append(msg)
            logger.warning("HTCPH upsert error — %s", msg)

    # ------------------------------------------------------------------------
    # Commit all changes
    # ------------------------------------------------------------------------
    db.commit()
    logger.info(
        "HTCPH upsert done — new=%d updated=%d skipped=%d errors=%d",
        stats["new"], stats["updated"], stats["skipped"], stats["errors"],
    )

    # ------------------------------------------------------------------------
    # Write ImportLog
    # ------------------------------------------------------------------------
    total = stats["new"] + stats["updated"] + stats["skipped"]
    if stats["errors"] == 0:
        status = "success"
    elif stats["new"] + stats["updated"] > 0:
        status = "partial"
    else:
        status = "failed"

    log = ImportLog(
        loai_du_lieu="san_pham_htcph",
        ten_nguoi_import="htcph_sync",
        so_dong_thanh_cong=stats["new"] + stats["updated"],
        so_dong_loi=stats["errors"],
        so_dong_bo_qua=stats["skipped"],
        trang_thai=status,
        chi_tiet_loi=json.dumps(error_details[:100], ensure_ascii=False) if error_details else None,
        thoi_gian=datetime.now(timezone.utc),
    )
    db.add(log)
    db.commit()

    return stats


# ---------------------------------------------------------------------------
# Public async API
# ---------------------------------------------------------------------------

async def sync_products(db: Session) -> dict:
    """
    Pull DMHH + DTBaoGia from HTCPH, upsert products and CauTrucThongDung.

    The pyodbc calls run in a thread executor so they do not block the event loop.
    Returns a stats dict: {"new": int, "updated": int, "skipped": int, "errors": int}.
    """
    loop = asyncio.get_event_loop()
    htcph_data: dict = await loop.run_in_executor(_executor, _fetch_htcph)
    result: dict = await loop.run_in_executor(_executor, _upsert, db, htcph_data)
    return result


async def run_daily_sync(get_db_func) -> None:
    """
    Background coroutine: sleep until next 02:00, then call sync_products.
    Runs forever — schedule once at application startup.
    """
    while True:
        now = datetime.now()
        next_run = now.replace(hour=2, minute=0, second=0, microsecond=0)
        if next_run <= now:
            next_run += timedelta(days=1)

        wait_sec = (next_run - now).total_seconds()
        logger.info(
            "HTCPH sync scheduler: next run in %.1fh at %s",
            wait_sec / 3600,
            next_run.strftime("%Y-%m-%d %H:%M"),
        )
        await asyncio.sleep(wait_sec)

        db = next(get_db_func())
        try:
            result = await sync_products(db)
            logger.info("HTCPH daily sync completed: %s", result)
        except Exception as exc:
            logger.error("HTCPH daily sync failed: %s", exc, exc_info=True)
        finally:
            db.close()
