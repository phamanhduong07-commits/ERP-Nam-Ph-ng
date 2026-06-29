"""
reset_transactional_data.py
Xoa du lieu don hang / van hanh — co the loc theo user cu the.

Chay tu thu muc backend/:
    python scripts/reset_transactional_data.py --yes               # xoa tat ca
    python scripts/reset_transactional_data.py --user admin --yes  # chi xoa cua user admin
    python scripts/reset_transactional_data.py --dry-run           # xem truoc, khong xoa
"""

import sys
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError


def get_user_id(conn, username: str) -> int:
    row = conn.execute(text("SELECT id FROM users WHERE username = :u"), {"u": username}).fetchone()
    if not row:
        raise SystemExit(f"Khong tim thay user '{username}' trong DB.")
    return row[0]


def has_column(conn, table: str, column: str) -> bool:
    row = conn.execute(text("""
        SELECT 1 FROM information_schema.columns
        WHERE table_name = :t AND column_name = :c AND table_schema = 'public'
    """), {"t": table, "c": column}).fetchone()
    return row is not None


def table_exists(conn, table: str) -> bool:
    row = conn.execute(text("""
        SELECT 1 FROM information_schema.tables
        WHERE table_name = :t AND table_schema = 'public'
    """), {"t": table}).fetchone()
    return row is not None


def count_rows(conn, table: str, where: str | None, params: dict) -> int:
    sql = f"SELECT COUNT(*) FROM {table}"
    if where:
        sql += f" WHERE {where}"
    return conn.execute(text(sql), params).scalar()


def delete_rows(conn, table: str, where: str | None, params: dict) -> int:
    """Returns number of rows deleted (0 if nothing to delete)."""
    before = count_rows(conn, table, where, params)
    if before == 0:
        return 0
    sql = f"DELETE FROM {table}"
    if where:
        sql += f" WHERE {where}"
    conn.execute(text(sql), params)
    return before


# ─── Chien luoc xoa tung bang ──────────────────────────────────────────────
#
# Moi entry: (table, where_template)
# where_template:
#   None                  → xoa tat ca (bang system/log khong co user)
#   "created_by = :uid"   → loc theo user tao truc tiep
#   "col IN (...)"        → loc qua parent table
#
# Thu tu goi y: child TRUOC parent, nhung retry loop tu xu ly FK con lai.

BY_CREATED_BY = "created_by = :uid"


def build_strategies(uid_filter: bool) -> list[tuple[str, str | None]]:
    """
    uid_filter=True: dung WHERE clause loc theo user.
    uid_filter=False: xoa tat ca (None = DELETE all).
    """

    def f(where: str) -> str | None:
        """Ap dung where chi khi uid_filter=True."""
        return where if uid_filter else None

    def via(col: str, parent: str, parent_where: str | None = None) -> str | None:
        """Subquery filter qua parent table: col IN (SELECT id FROM parent WHERE ...)."""
        if not uid_filter:
            return None
        pw = parent_where or BY_CREATED_BY
        return f"{col} IN (SELECT id FROM {parent} WHERE {pw})"

    # Helper: WHERE cho production_order_items qua production_orders.created_by
    PROD_ORDER_FILTER = f"production_order_id IN (SELECT id FROM production_orders WHERE {BY_CREATED_BY})"
    # Helper: WHERE cho items co FK truc tiep vao production_order_items
    POI_SUBQ = f"production_order_item_id IN (SELECT id FROM production_order_items WHERE {PROD_ORDER_FILTER})"

    BY_SESSION     = via("session_id",          "production_sessions")
    BY_PROD_ORDER  = f(PROD_ORDER_FILTER)
    BY_DELIVERY    = via("delivery_id",         "delivery_orders")
    BY_SALES_RETURN = via("sales_return_id",    "sales_returns")

    return [
        # ── Logs / system (khong co user attribution) ─────────────────────
        ("audit_logs",                    None),
        ("import_logs",                   None),
        ("agent_sessions",                None),
        ("scan_log",                      None),
        # gps_snapshots / gps_binhminh_daily: KHONG xoa — khong lien quan den don hang
        ("phieu_in_state_log",            None),

        # ── Production session children ────────────────────────────────────
        ("production_session_paper_wastes", BY_SESSION),
        ("production_session_overheads",    BY_SESSION),
        ("production_session_materials",    BY_SESSION),
        ("production_session_rolls",        BY_SESSION),

        # ── Items co FK -> production_order_items (phai truoc production_order_items) ──
        # Filter bang OR: lay ca items cua admin's phieu + items ref admin's POI
        ("production_plan_lines",     f(f"plan_id IN (SELECT id FROM production_plans WHERE {BY_CREATED_BY})"
                                        f" OR {POI_SUBQ}") if uid_filter else None),
        ("production_khau_costs",     f(POI_SUBQ)),
        ("production_boms",           f(POI_SUBQ)),
        ("phieu_nhap_phoi_song_items", f(
            f"phieu_nhap_phoi_song_id IN (SELECT id FROM phieu_nhap_phoi_song WHERE {BY_CREATED_BY})"
            f" OR {POI_SUBQ}"
        )),
        ("phieu_xuat_phoi_items",     f(
            f"phieu_xuat_phoi_id IN (SELECT id FROM phieu_xuat_phoi WHERE {BY_CREATED_BY})"
            f" OR {POI_SUBQ}"
        )),

        # hang_loi_phoi_kho_ao: FK -> phieu_nhap_phoi_song_items (phai truoc no)
        ("hang_loi_phoi_kho_ao",      via("phieu_nhap_phoi_song_item_id", "phieu_nhap_phoi_song_items",
                                          f"phieu_nhap_phoi_song_id IN (SELECT id FROM phieu_nhap_phoi_song WHERE {BY_CREATED_BY})"
                                          f" OR {POI_SUBQ}") if uid_filter else None),

        # ── Production order items + outputs ─────────────────────────────
        ("hang_loi_kho_ao",           via("production_output_id", "production_outputs", PROD_ORDER_FILTER)),
        ("production_outputs",        BY_PROD_ORDER),
        ("may_dung_log",              f(BY_CREATED_BY)),
        ("production_order_items",    BY_PROD_ORDER),

        # ── Phieu kho (truoc phieu headers) ──────────────────────────────
        ("phieu_tra_hang_items",      via("phieu_tra_hang_id", "phieu_tra_hang")),
        ("phieu_chuyen_kho_item",     via("phieu_chuyen_kho_id", "phieu_chuyen_kho")),

        # ── Kho items ─────────────────────────────────────────────────────
        ("goods_receipt_items",       via("receipt_id", "goods_receipts")),
        ("giay_rolls",                via("goods_receipt_id", "goods_receipts")),
        ("stock_adjustment_items",    via("adjustment_id", "stock_adjustments")),
        ("material_issue_items",      via("issue_id", "material_issues")),

        # ── Purchase children ─────────────────────────────────────────────
        ("purchase_order_items",      via("po_id", "purchase_orders")),
        ("purchase_return_items",     via("return_id", "purchase_returns")),
        ("purchase_requisition_items", via("requisition_id", "purchase_requisitions")),

        # ── Accounting children ───────────────────────────────────────────
        ("journal_entry_lines",       via("entry_id", "journal_entries")),
        ("invoice_adjustment_logs",   via("invoice_id", "sales_invoices")),
        ("debt_ledger_entries",       None),
        ("doi_tru_items",             via("doi_tru_id", "doi_tru_chung_tu")),
        ("lich_tra_no",               None),

        # ── QC ────────────────────────────────────────────────────────────
        ("qc_defects",                None),
        ("qc_giay_cuon_phieu",        None),
        ("qc_nvl_phieu",              None),
        ("defect_records",            None),

        # ── Quote children ────────────────────────────────────────────────
        ("quote_history",             via("quote_id", "quotes")),
        ("quote_items",               via("quote_id", "quotes")),

        # ── Sales return chain ────────────────────────────────────────────
        ("customer_refund_vouchers",  BY_SALES_RETURN),
        ("sales_return_items",        BY_SALES_RETURN),

        # ── Delivery children ─────────────────────────────────────────────
        ("delivery_order_items",      BY_DELIVERY),
        ("delivery_post_tasks",       BY_DELIVERY),
        ("yeu_cau_giao_hang_items",   via("yeu_cau_id", "yeu_cau_giao_hang")),

        # ── Sales order items (truoc sales_orders) ─────────────────────────
        ("sales_order_items",         via("order_id", "sales_orders")),

        # ── Invoice-related ───────────────────────────────────────────────
        ("hoa_don_dien_tu",           f(BY_CREATED_BY)),
        ("incoming_invoices",         f(BY_CREATED_BY)),
        ("purchase_invoices",         f(BY_CREATED_BY)),
        ("cash_receipts",             f(BY_CREATED_BY)),
        ("cash_payments",             f(BY_CREATED_BY)),
        ("sales_invoices",            f(BY_CREATED_BY)),

        # ── Returns / delivery headers ────────────────────────────────────
        ("sales_returns",             f(BY_CREATED_BY)),
        ("delivery_orders",           f(BY_CREATED_BY)),
        ("yeu_cau_giao_hang",         f(BY_CREATED_BY)),
        ("phieu_tra_hang",            f(BY_CREATED_BY)),

        # ── Production headers ────────────────────────────────────────────
        ("production_sessions",       f(BY_CREATED_BY)),
        ("production_orders",         f(BY_CREATED_BY)),
        ("production_plans",          f(BY_CREATED_BY)),
        ("production_cost_inputs",    None),
        ("production_cost_allocations", None),
        ("production_cost_periods",   None),
        ("product_costs",             None),

        # ── Purchase headers ──────────────────────────────────────────────
        ("goods_receipts",            f(BY_CREATED_BY)),
        ("purchase_returns",          f(BY_CREATED_BY)),
        ("purchase_orders",           f(BY_CREATED_BY)),
        ("purchase_requisitions",     f(BY_CREATED_BY)),

        # ── Kho headers ───────────────────────────────────────────────────
        ("stock_adjustments",         f(BY_CREATED_BY)),
        ("material_issues",           f(BY_CREATED_BY)),
        ("phieu_chuyen_kho",          f(BY_CREATED_BY)),
        ("phieu_xuat_phoi",           f(BY_CREATED_BY)),
        ("phieu_nhap_phoi_song",      f(BY_CREATED_BY)),

        # ── Sales headers ─────────────────────────────────────────────────
        ("sales_orders",              f(BY_CREATED_BY)),
        ("quotes",                    f(BY_CREATED_BY)),
        ("sales_targets",             f("user_id = :uid")),

        # ── Accounting headers ────────────────────────────────────────────
        ("journal_entries",           f(BY_CREATED_BY)),
        ("doi_tru_chung_tu",          f(BY_CREATED_BY)),
        ("khe_uoc_vay",               f(BY_CREATED_BY)),
        ("khe_uoc_cho_vay",           f(BY_CREATED_BY)),
        ("bank_transactions",         f(BY_CREATED_BY)),
        ("workshop_payroll",          f(BY_CREATED_BY)),
        ("opening_balances",          f(BY_CREATED_BY)),

        # ── Inventory / physical ──────────────────────────────────────────
        ("inventory_transactions",    None),
        ("inventory_balances",        None),
        ("paper_rolls",               None),

        # ── Misc ──────────────────────────────────────────────────────────
        ("qc_sheets",                 None),
        ("phieu_in",                  None),
        ("erp_media",                 None),
        ("customer_interactions",     None),
        ("ocr_supplier_examples",     None),
    ]


def normalize_where(conn, table: str, where: str | None) -> str | None:
    """Neu where dung cot khong ton tai trong bang, bo where (xoa het)."""
    if not where:
        return where
    if "created_by" in where and not has_column(conn, table, "created_by"):
        return None
    if "user_id = :uid" in where and not has_column(conn, table, "user_id"):
        return None
    return where


def build_valid_strategies(conn, uid_filter: bool) -> list[tuple[str, str | None]]:
    strategies = build_strategies(uid_filter)
    valid = []
    seen = set()
    for table, where in strategies:
        if table in seen:
            continue  # bo qua ban ghi trung
        seen.add(table)
        if not table_exists(conn, table):
            continue
        valid.append((table, normalize_where(conn, table, where)))
    return valid


def main(dry_run: bool, uid_filter: bool, username: str) -> None:
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        uid = get_user_id(conn, username) if uid_filter else None
        params = {"uid": uid} if uid else {}
        valid = build_valid_strategies(conn, uid_filter)

        counts: dict[str, int] = {}
        for table, where in valid:
            try:
                c = count_rows(conn, table, where, params)
                if c > 0:
                    counts[table] = c
            except Exception:
                pass

        label = f"cua user '{username}'" if uid_filter else "tat ca"
        if dry_run:
            print("=" * 60)
            print(f"DRY RUN -- du lieu {label}")
            print("=" * 60)
            for t, c in counts.items():
                print(f"  {t:<45} {c:>8} ban ghi")
            print("-" * 60)
            print(f"  TONG:                                       {sum(counts.values()):>8} ban ghi")
            return

        print("=" * 60)
        print(f"XOA DU LIEU GIAO DICH -- {label}")
        print("=" * 60)
        if not counts:
            print("Khong co ban ghi nao can xoa.")
            return

    # Xoa trong transaction voi retry loop
    # Moi bang dung SAVEPOINT de co the rollback rieng neu FK violation,
    # sau do thu lai o pass sau khi bang cha da duoc xoa.
    with engine.begin() as conn:
        uid = get_user_id(conn, username) if uid_filter else None
        params = {"uid": uid} if uid else {}
        valid = build_valid_strategies(conn, uid_filter)

        pending = valid
        total = 0
        max_passes = len(valid) + 1

        for pass_num in range(max_passes):
            if not pending:
                break

            newly_done: list[str] = []
            still_pending: list[tuple[str, str | None]] = []

            for table, where in pending:
                sp = conn.begin_nested()
                try:
                    n = delete_rows(conn, table, where, params)
                    sp.commit()
                    if n > 0:
                        print(f"  {table:<45} -{n:>7} ban ghi")
                        total += n
                    newly_done.append(table)
                except (IntegrityError, Exception):
                    sp.rollback()
                    still_pending.append((table, where))

            if not newly_done:
                # Khong tien trien — bi block hoan toan
                for table, _ in still_pending:
                    print(f"  SKIP {table}: bi FK block, khong the xoa")
                break

            pending = still_pending
            if pass_num > 0 and still_pending:
                print(f"  [Pass {pass_num + 1}: thu lai {len(still_pending)} bang...]")

    print(f"  {'TONG':<45} -{total:>7} ban ghi")
    print()
    print("HOAN THANH.")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reset du lieu giao dich ERP")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--yes",     action="store_true", help="Khong hoi lai")
    parser.add_argument("--user",    default=None, help="Chi xoa cua user nay (vd: admin)")
    args = parser.parse_args()

    uid_filter = args.user is not None
    username   = args.user or "admin"

    if not args.dry_run and not args.yes:
        scope = f"cua user '{username}'" if uid_filter else "TAT CA users"
        print(f"CANH BAO: Se xoa du lieu {scope}!")
        ans = input("Go 'XOA' de xac nhan: ").strip()
        if ans != "XOA":
            print("Da huy.")
            sys.exit(0)

    main(dry_run=args.dry_run, uid_filter=uid_filter, username=username)
