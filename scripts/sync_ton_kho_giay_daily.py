"""
Sync ton kho giay cuon: SQL Server HTCPH (KNVL01) -> ERP (warehouse_id=9)
Chay hang ngay qua Windows Task Scheduler.
"""

import sys, os, json, logging
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")
from datetime import datetime, timezone, date
from decimal import Decimal
from pathlib import Path

# ── Cấu hình ──────────────────────────────────────────────────────────────────
MSSQL_HOST   = "203.162.54.176"
MSSQL_PORT   = 1441
MSSQL_USER   = "duong"
MSSQL_PASS   = "Namphuong123@"
MSSQL_DB     = "HTCPH"
MSSQL_KHO    = "KNVL01"

ERP_WAREHOUSE_ID = 9           # Kho giấy cuộn - Xưởng Hoàng Gia

TELEGRAM_TOKEN   = "8676494446:AAEJidl13qsG6BTksBgXhQ_Swpq_51_eJSc"
TELEGRAM_CHAT_ID = "8463944607"

SCRIPT_DIR = Path(__file__).parent
LOG_FILE   = SCRIPT_DIR / "sync_ton_kho_giay.log"
SNAP_FILE  = SCRIPT_DIR / "ton_kho_snapshot.json"   # lưu snapshot hôm trước để so sánh

# ── Logger ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger(__name__)


def send_telegram(text: str) -> None:
    import urllib.request, urllib.parse
    url  = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    body = json.dumps({"chat_id": TELEGRAM_CHAT_ID, "text": text, "parse_mode": "HTML"}).encode()
    req  = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10):
            pass
    except Exception as e:
        log.warning(f"Telegram gửi thất bại: {e}")


def fetch_mssql() -> list[dict]:
    import pymssql
    conn = pymssql.connect(MSSQL_HOST, MSSQL_USER, MSSQL_PASS, MSSQL_DB,
                           port=MSSQL_PORT, timeout=30)
    cur = conn.cursor(as_dict=True)
    cur.execute("""
        SELECT
            b.MaNL  AS ma_hang,
            d.Ten   AS ten_hang,
            d.DVT   AS don_vi,
            ROUND(
                SUM(CASE WHEN b.NhomDk IN ('DK','NDH1','DK1') THEN b.SoLuong  ELSE 0 END) -
                SUM(CASE WHEN b.NhomDk IN ('XSX1','XB1','NCK','XCK','XTL1') THEN b.Soluong_x ELSE 0 END)
            , 2) AS ton_kho,
            CASE
                WHEN SUM(CASE WHEN b.NhomDk='NDH1' THEN b.SoLuong ELSE 0 END) > 0
                THEN ROUND(
                    SUM(CASE WHEN b.NhomDk='NDH1' THEN b.PsNo    ELSE 0 END) /
                    SUM(CASE WHEN b.NhomDk='NDH1' THEN b.SoLuong ELSE 0 END), 0)
                ELSE 0
            END AS don_gia_bq
        FROM BLNL b
        JOIN DMNL d ON b.MaNL = d.Ma AND d.Cuon = 1
        WHERE b.MaKho = %s
        GROUP BY b.MaNL, d.Ten, d.DVT
        HAVING
            SUM(CASE WHEN b.NhomDk IN ('DK','NDH1','DK1') THEN b.SoLuong ELSE 0 END) -
            SUM(CASE WHEN b.NhomDk IN ('XSX1','XB1','NCK','XCK','XTL1') THEN b.Soluong_x ELSE 0 END) > 0.01
    """, (MSSQL_KHO,))
    rows = cur.fetchall()
    conn.close()
    return rows


def fetch_daily_movements(target_date=None) -> dict:
    """Lấy nhập/xuất trong ngày từ BLNL. Trả về {ma_hang: {nhap_kg, xuat_kg, ten, don_vi}}."""
    import pymssql
    if target_date is None:
        target_date = date.today()

    conn = pymssql.connect(MSSQL_HOST, MSSQL_USER, MSSQL_PASS, MSSQL_DB,
                           port=MSSQL_PORT, timeout=30)
    cur = conn.cursor(as_dict=True)
    cur.execute("""
        SELECT
            b.MaNL  AS ma_hang,
            d.Ten   AS ten_hang,
            d.DVT   AS don_vi,
            ROUND(SUM(CASE WHEN b.NhomDk IN ('DK','NDH1','DK1')
                          THEN b.SoLuong  ELSE 0 END), 2) AS nhap_kg,
            ROUND(SUM(CASE WHEN b.NhomDk IN ('XSX1','XB1','NCK','XCK','XTL1')
                          THEN b.Soluong_x ELSE 0 END), 2) AS xuat_kg
        FROM BLNL b
        JOIN DMNL d ON b.MaNL = d.Ma AND d.Cuon = 1
        WHERE b.MaKho = %s
          AND CAST(b.NgayCT AS DATE) = %s
        GROUP BY b.MaNL, d.Ten, d.DVT
        HAVING
            SUM(CASE WHEN b.NhomDk IN ('DK','NDH1','DK1')
                     THEN b.SoLuong ELSE 0 END) > 0.01
            OR
            SUM(CASE WHEN b.NhomDk IN ('XSX1','XB1','NCK','XCK','XTL1')
                     THEN b.Soluong_x ELSE 0 END) > 0.01
    """, (MSSQL_KHO, target_date.isoformat()))
    rows = cur.fetchall()
    conn.close()

    result = {}
    for r in rows:
        ma = str(r["ma_hang"] or "").strip()
        result[ma] = {
            "ten":     str(r["ten_hang"] or ""),
            "don_vi":  str(r["don_vi"] or "Kg"),
            "nhap_kg": float(r["nhap_kg"] or 0),
            "xuat_kg": float(r["xuat_kg"] or 0),
        }
    return result


def sync_to_erp(mssql_rows: list[dict]) -> dict:
    sys.path.insert(0, str(SCRIPT_DIR.parent / "backend"))
    os.chdir(SCRIPT_DIR.parent / "backend")

    from sqlalchemy.orm import Session
    from app.models.master import PaperMaterial
    from app.models.inventory import InventoryBalance
    from app.database import engine

    now = datetime.now(timezone.utc)
    result = {"created": 0, "updated": 0, "skipped": 0, "unchanged": 0}

    with Session(engine) as db:
        papers = {p.ma_chinh: p for p in db.query(PaperMaterial).all()}

        for row in mssql_rows:
            ma      = str(row["ma_hang"] or "").strip()
            paper   = papers.get(ma)
            if not paper:
                result["skipped"] += 1
                continue

            ton_kho  = Decimal(str(row["ton_kho"]))
            don_gia  = Decimal(str(row["don_gia_bq"]))
            gia_tri  = ton_kho * don_gia
            don_vi   = str(row["don_vi"] or paper.dvt or "Kg")

            existing = db.query(InventoryBalance).filter(
                InventoryBalance.warehouse_id      == ERP_WAREHOUSE_ID,
                InventoryBalance.paper_material_id == paper.id,
            ).first()

            if existing:
                old = float(existing.ton_luong or 0)
                if abs(float(ton_kho) - old) < 0.01:
                    result["unchanged"] += 1
                    continue
                existing.ton_luong         = ton_kho
                existing.don_gia_binh_quan = don_gia
                existing.gia_tri_ton       = gia_tri
                existing.don_vi            = don_vi
                existing.cap_nhat_luc      = now
                result["updated"] += 1
            else:
                db.add(InventoryBalance(
                    warehouse_id        = ERP_WAREHOUSE_ID,
                    paper_material_id   = paper.id,
                    ton_luong           = ton_kho,
                    don_gia_binh_quan   = don_gia,
                    gia_tri_ton         = gia_tri,
                    don_vi              = don_vi,
                    cap_nhat_luc        = now,
                ))
                result["created"] += 1

        db.commit()

        # Snapshot sau khi commit để so sánh ngày mai
        balances = (db.query(PaperMaterial.ma_chinh, InventoryBalance.ton_luong)
                    .join(InventoryBalance, InventoryBalance.paper_material_id == PaperMaterial.id)
                    .filter(InventoryBalance.warehouse_id == ERP_WAREHOUSE_ID)
                    .all())
        snapshot = {ma: float(ton) for ma, ton in balances}
        SNAP_FILE.write_text(json.dumps(snapshot, ensure_ascii=False), encoding="utf-8")

    return result


def load_previous_snapshot() -> dict:
    if SNAP_FILE.exists():
        return json.loads(SNAP_FILE.read_text(encoding="utf-8"))
    return {}


def build_report(mssql_rows: list[dict], sync_result: dict, prev: dict,
                 movements: dict) -> str:
    today = date.today().strftime("%d/%m/%Y")
    total_kg  = sum(float(r["ton_kho"])  for r in mssql_rows)
    total_vnd = sum(float(r["ton_kho"]) * float(r["don_gia_bq"]) for r in mssql_rows)

    # Top 10 tồn
    sorted_rows = sorted(mssql_rows, key=lambda r: -float(r["ton_kho"]))
    top10 = sorted_rows[:10]

    # Biến động tồn > 10% so với hôm trước
    changes = []
    for r in mssql_rows:
        ma  = str(r["ma_hang"]).strip()
        cur = float(r["ton_kho"])
        old = prev.get(ma, 0)
        if old > 0:
            pct = (cur - old) / old * 100
            if abs(pct) >= 10:
                changes.append((ma, old, cur, pct))
    changes.sort(key=lambda x: abs(x[3]), reverse=True)

    # Nhập/xuất trong ngày
    nhap_list  = sorted(
        [(ma, v) for ma, v in movements.items() if v["nhap_kg"] > 0.01],
        key=lambda x: -x[1]["nhap_kg"]
    )
    xuat_list  = sorted(
        [(ma, v) for ma, v in movements.items() if v["xuat_kg"] > 0.01],
        key=lambda x: -x[1]["xuat_kg"]
    )
    total_nhap = sum(v["nhap_kg"] for _, v in nhap_list)
    total_xuat = sum(v["xuat_kg"] for _, v in xuat_list)

    lines = [
        f"📦 <b>BÁO CÁO TỒN KHO GIẤY CUỘN</b>",
        f"Kho: Hoàng Gia | {today}",
        "",
        f"📊 <b>Tồn kho cuối ngày</b>",
        f"• Số vật tư: {len(mssql_rows)} loại",
        f"• Tổng tồn:  {total_kg:,.0f} kg",
        f"• Giá trị:   {total_vnd/1e9:.2f} tỷ đồng",
        f"• Đồng bộ ERP: +{sync_result['created']} | ↻{sync_result['updated']} | ⏭{sync_result['skipped']}",
    ]

    # Nhập kho trong ngày
    lines += ["", f"📥 <b>Nhập kho hôm nay</b>  ({total_nhap:,.0f} kg tổng)"]
    if nhap_list:
        for ma, v in nhap_list[:10]:
            lines.append(f"  + {ma}  {v['nhap_kg']:,.0f} kg")
        if len(nhap_list) > 10:
            lines.append(f"  ... và {len(nhap_list)-10} loại khác")
    else:
        lines.append("  (không có nhập kho)")

    # Xuất kho trong ngày
    lines += ["", f"📤 <b>Xuất kho hôm nay</b>  ({total_xuat:,.0f} kg tổng)"]
    if xuat_list:
        for ma, v in xuat_list[:10]:
            lines.append(f"  - {ma}  {v['xuat_kg']:,.0f} kg")
        if len(xuat_list) > 10:
            lines.append(f"  ... và {len(xuat_list)-10} loại khác")
    else:
        lines.append("  (không có xuất kho)")

    # Top 10 tồn nhiều nhất
    lines += ["", "🔝 <b>Top 10 tồn nhiều nhất</b>"]
    for i, r in enumerate(top10, 1):
        ma  = str(r["ma_hang"]).strip()
        kg  = float(r["ton_kho"])
        vnd = kg * float(r["don_gia_bq"])
        lines.append(f"  {i:2}. {ma}  {kg:,.0f} kg  ({vnd/1e6:.0f}tr)")

    # Biến động tồn kho
    if changes:
        lines += ["", "⚠️ <b>Biến động tồn ≥10% so với hôm qua</b>"]
        for ma, old, cur, pct in changes[:8]:
            arrow = "📈" if pct > 0 else "📉"
            lines.append(f"  {arrow} {ma}  {old:,.0f}→{cur:,.0f} kg ({pct:+.0f}%)")

    return "\n".join(lines)


def main():
    log.info("=== Bắt đầu sync tồn kho giấy cuộn ===")
    prev = load_previous_snapshot()

    try:
        log.info("1. Lấy tồn kho SQL Server...")
        rows = fetch_mssql()
        log.info(f"   → {len(rows)} vật tư có tồn kho")

        log.info("2. Lấy nhập/xuất trong ngày...")
        movements = fetch_daily_movements()
        nhap_ct = sum(1 for v in movements.values() if v["nhap_kg"] > 0.01)
        xuat_ct = sum(1 for v in movements.values() if v["xuat_kg"] > 0.01)
        log.info(f"   → {nhap_ct} mã nhập, {xuat_ct} mã xuất hôm nay")

        log.info("3. Đồng bộ tồn kho vào ERP...")
        result = sync_to_erp(rows)
        log.info(f"   → {result}")

        log.info("4. Gửi báo cáo Telegram...")
        report = build_report(rows, result, prev, movements)
        send_telegram(report)
        log.info("   → Đã gửi")

    except Exception as e:
        log.exception(f"LỖI: {e}")
        send_telegram(f"❌ <b>Sync tồn kho giấy THẤT BẠI</b>\n{date.today()}\nLỗi: {e}")
        sys.exit(1)

    log.info("=== Hoàn thành ===")


if __name__ == "__main__":
    main()
