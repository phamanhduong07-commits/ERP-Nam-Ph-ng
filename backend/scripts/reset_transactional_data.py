"""
reset_transactional_data.py
Xóa toàn bộ dữ liệu đơn hàng / vận hành đã nhập test.
Giữ nguyên: customers, suppliers, products, users, roles, permissions,
             master data, print_templates, seed data.

Chạy từ thư mục backend/:
    python scripts/reset_transactional_data.py

Thêm --dry-run để xem số bản ghi mà không xóa:
    python scripts/reset_transactional_data.py --dry-run
"""

import sys
import argparse
from pathlib import Path

# Thêm backend/ vào sys.path để import app.config
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings
from sqlalchemy import create_engine, text

# ─── Thứ tự xóa (tuân theo FK constraint) ───────────────────────────────────
# Mỗi bảng phải được xóa TRƯỚC bảng cha của nó.
# Các bảng không có trong danh sách này sẽ KHÔNG bị xóa.

DELETE_ORDER = [
    # ── Phase 1: Logs/audit — không có transactional FK đến ──────────────────
    "audit_logs",
    "import_logs",
    "agent_sessions",
    "scan_log",
    "gps_snapshots",
    "gps_binhminh_daily",
    "sales_targets",
    "drain_alert_logs",
    "customer_interactions",
    "ocr_supplier_examples",
    "push_subscription",

    # ── Phase 2: Production details ──────────────────────────────────────────
    "production_session_paper_wastes",
    "production_session_overheads",
    "production_session_materials",
    "production_session_rolls",
    "production_khau_costs",
    "production_bom_indirect_items",
    "production_bom_items",
    "production_plan_lines",
    "production_logs",
    "production_cost_inputs",
    "production_cost_allocations",
    "product_costs",
    "may_dung_log",
    "phieu_in_state_log",

    # ── Phase 3: Purchase / requisition details ───────────────────────────────
    "purchase_requisition_items",
    "purchase_return_items",
    "purchase_order_items",

    # ── Phase 4: Warehouse details ────────────────────────────────────────────
    "goods_receipt_items",
    "stock_adjustment_items",
    "material_issue_items",
    "phieu_chuyen_kho_item",
    "phieu_xuat_phoi_items",
    "phieu_nhap_phoi_song_items",
    "phieu_tra_hang_items",

    # ── Phase 5: Accounting details ───────────────────────────────────────────
    "journal_entry_lines",
    "doi_tru_items",
    "lich_tra_no",
    "debt_ledger_entries",
    "indirect_cost_items",

    # ── Phase 6: QC records ───────────────────────────────────────────────────
    "qc_defects",
    "qc_giay_cuon_phieu",
    "qc_nvl_phieu",
    "defect_records",

    # ── Phase 7: Delivery details ─────────────────────────────────────────────
    "yeu_cau_giao_hang_items",
    "delivery_post_tasks",

    # ── Phase 8: Quote details (SET NULL FK từ sales_order_items) ─────────────
    "quote_history",
    "quote_items",

    # ── Phase 9: Returns chain (thứ tự nghiêm ngặt) ──────────────────────────
    # customer_refund_vouchers → sales_returns (NOT NULL FK)
    # customer_refund_vouchers → sales_invoices
    "customer_refund_vouchers",
    # sales_return_items → sales_returns, delivery_order_items, sales_order_items
    "sales_return_items",

    # ── Phase 10: Delivery items (sau sales_return_items) ────────────────────
    "delivery_order_items",

    # ── Phase 11: Production order items → sales_order_items ─────────────────
    "production_order_items",

    # ── Phase 12: Sales order items (sau sales_return_items + production_order_items) ─
    "sales_order_items",

    # ── Phase 13: Invoice adjustment + cash transactions (trước sales_invoices) ──
    "invoice_adjustment_logs",
    "cash_receipts",        # cash_receipts → sales_invoices
    "cash_payments",        # cash_payments → purchase_invoices

    # ── Phase 14: Sales invoices (sau cash_receipts, customer_refund_vouchers) ──
    # sales_invoices → delivery_orders, sales_orders (phải xóa trước)
    "hoa_don_dien_tu",      # → sales_invoices nếu có FK
    "sales_invoices",
    "incoming_invoices",

    # ── Phase 15: Purchase invoices (trước goods_receipts) ───────────────────
    "purchase_invoices",    # purchase_invoices → goods_receipts

    # ── Phase 16: Sales returns (sau customer_refund_vouchers, sales_return_items) ──
    "sales_returns",        # sales_returns → sales_orders, delivery_orders

    # ── Phase 17: Delivery headers (sau delivery_order_items, sales_returns, sales_invoices) ─
    "delivery_orders",
    "yeu_cau_giao_hang",

    # ── Phase 18: Production headers ─────────────────────────────────────────
    "production_sessions",
    "production_orders",    # → sales_orders (phải xóa trước sales_orders)
    "production_plans",
    "production_boms",
    "production_cost_periods",
    "production_outputs",

    # ── Phase 19: Purchase headers ────────────────────────────────────────────
    "goods_receipts",       # sau goods_receipt_items, purchase_invoices
    "purchase_returns",
    "purchase_orders",
    "purchase_requisitions",

    # ── Phase 20: Warehouse headers ───────────────────────────────────────────
    "stock_adjustments",
    "material_issues",
    "phieu_chuyen_kho",
    "phieu_xuat_phoi",
    "phieu_nhap_phoi_song",
    "phieu_tra_hang",
    "hang_loi_kho_ao",
    "hang_loi_phoi_kho_ao",
    "internal_transfers",

    # ── Phase 21: Sales orders (sau tất cả bảng con) ─────────────────────────
    "sales_orders",

    # ── Phase 22: Quotes (sau quote_items, quote_history) ────────────────────
    "quotes",

    # ── Phase 23: Accounting headers ─────────────────────────────────────────
    "journal_entries",
    "doi_tru_chung_tu",
    "khe_uoc_vay",
    "khe_uoc_cho_vay",
    "bank_transactions",
    "workshop_payroll",
    "opening_balances",

    # ── Phase 24: Inventory snapshot ─────────────────────────────────────────
    "inventory_transactions",
    "inventory_balances",

    # ── Phase 25: Physical roll tracking ─────────────────────────────────────
    "paper_rolls",
    "giay_rolls",

    # ── Phase 26: Remaining ───────────────────────────────────────────────────
    "qc_sheets",
    "phieu_in",
    "erp_media",
]


def get_row_count(conn, table: str) -> int:
    try:
        result = conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
        return result.scalar()
    except Exception:
        return -1  # table không tồn tại hoặc lỗi khác


def main(dry_run: bool = False) -> None:
    engine = create_engine(settings.DATABASE_URL)

    if dry_run:
        print("=" * 60)
        print("DRY RUN — chỉ đếm bản ghi, KHÔNG xóa")
        print("=" * 60)
        with engine.connect() as conn:
            total = 0
            for table in DELETE_ORDER:
                count = get_row_count(conn, table)
                if count > 0:
                    print(f"  {table:<45} {count:>8} bản ghi")
                    total += count
                elif count == 0:
                    pass  # bảng trống, không in
                else:
                    print(f"  {table:<45}  [bảng không tồn tại]")
            print("-" * 60)
            print(f"  TỔNG cộng sẽ xóa:                          {total:>8} bản ghi")
        return

    # ── Xóa thật ─────────────────────────────────────────────────────────────
    print("=" * 60)
    print("XÓA DỮ LIỆU GIAO DỊCH ERP NAM PHƯƠNG")
    print("=" * 60)
    print()

    deleted_counts: dict[str, int] = {}
    skipped: list[str] = []
    errors: list[tuple[str, str]] = []

    with engine.begin() as conn:
        for table in DELETE_ORDER:
            # Đếm trước khi xóa
            before = get_row_count(conn, table)
            if before == -1:
                skipped.append(table)
                continue
            if before == 0:
                continue  # bảng trống, bỏ qua

            try:
                conn.execute(text(f"DELETE FROM {table}"))
                deleted_counts[table] = before
                print(f"  ✓ {table:<45} -{before:>7} bản ghi")
            except Exception as e:
                errors.append((table, str(e)))
                print(f"  ✗ {table:<45} LỖI: {e}")
                # Raise để rollback toàn bộ transaction
                raise

    # ── Báo cáo ───────────────────────────────────────────────────────────────
    print()
    print("=" * 60)
    if errors:
        print(f"THẤT BẠI — {len(errors)} bảng lỗi, toàn bộ đã ROLLBACK")
        for tbl, err in errors:
            print(f"  {tbl}: {err}")
    else:
        total = sum(deleted_counts.values())
        print(f"HOÀN THÀNH — đã xóa {len(deleted_counts)} bảng, {total:,} bản ghi")
        if skipped:
            print(f"  Bỏ qua (không tồn tại): {', '.join(skipped)}")
        print()
        print("Các bảng master data được GIỮ NGUYÊN:")
        print("  customers, suppliers, products, paper_materials,")
        print("  users, roles, permissions, print_templates, ...")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reset dữ liệu giao dịch ERP")
    parser.add_argument("--dry-run", action="store_true", help="Chỉ đếm, không xóa")
    args = parser.parse_args()

    confirm = True
    if not args.dry_run:
        print("⚠️  CẢNH BÁO: Thao tác này sẽ XÓA VĨNH VIỄN dữ liệu đơn hàng!")
        print("   Backup DB trước nếu cần (pg_dump hoặc copy file .db)")
        print()
        ans = input("Gõ 'XOA' để xác nhận: ").strip()
        confirm = (ans == "XOA")

    if confirm:
        main(dry_run=args.dry_run)
    else:
        print("Đã hủy.")
