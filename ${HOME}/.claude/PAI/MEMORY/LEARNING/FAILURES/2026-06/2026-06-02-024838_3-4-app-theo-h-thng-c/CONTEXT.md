---
capture_type: FAILURE_ANALYSIS
timestamp: 2026-06-02 02:48:38 PST
rating: 2
description: 3-4-app-theo-h-thng-c
session_id: 554d479c-4f97-4647-9d58-98b38d12985d
---

# Failure Analysis: 3 4 app theo h thng c

**Date:** 2026-06-02
**Rating:** 2/10
**Summary:** 3 4 app theo hệ thống cũ

---

## What Happened

No detailed analysis available. Review the transcript for context.

---

## Conversation Summary

**ASSISTANT:** **HTCPH** là main ERP — 331 tables. Spawn 4 agent song song để explore từng mảng nghiệp vụ chính.

**USER:** Tôi đã có đủ dữ liệu để phân tích toàn diện. Đây là kết quả:

---

## Kết quả Explore Database HTCPH

### Tổng quan
Database SQL Server với ~280 tables, chứa dữ liệu từ 2019 đến 06/2026. Phục vụ 2 pháp nhân: **Nam Phương** và **VISUNPACK**. Hệ thống cũ dùng prefix số (MT/DT + số) để đặt tên bảng theo nghiệp vụ.

---

### Sơ đồ convention đặt tên

```
DM*  = Danh Mục (master data)
MT*  = Master (phiếu chính, 1 phiếu)  
DT*  = Detail (dòng chi tiết của MT)
OB*  = Opening Balance (số dư đầu kỳ)
BL*...

**USER:** Đây là báo cáo đầy đủ từ kết quả explore:

---

## Kết quả Explore Database HTCPH

### Tổng quan Database

Database `HTCPH` có **331 bảng**. Hệ thống này là một ERP sản xuất thùng carton đầy đủ, với 2 chi nhánh: **Nam Phương** (8.336 DH) và **VISUNPACK** (5.496 DH).

---

## 1. DMKH — Danh Mục Khách Hàng (1.007 rows, 41 cột)

**Mục đích:** Master data khách hàng — danh mục tĩnh, 1 row = 1 khách hàng.

**Schema đầy đủ:**

| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `MaKH` | varchar(16) NO...

**USER:** Now I have a complete picture. Here is the full analysis report:

---

## Báo Cáo: Database HTCPH — Hệ Thống Quản Lý Sản Xuất

### Tổng quan dữ liệu

| Bảng | Số dòng | Phạm vi thời gian |
|---|---|---|
| MTLSX | 13,816 | 12/2023 – 06/2026 |
| DTLSX | 35,586 | cùng MTLSX |
| MTDonHang | 13,969 | 11/2023 – 06/2026 |
| DTDonHang | ~35,000+ | cùng MTDonHang |
| DMHH | 10,482 | – |
| DMNL | 3,129 | – |
| DTNPhoi | 32,858 | 01/2024 – 06/2026 |
| DTXPhoi | 27,117 | – |
| MTNPhoi | 8,569 | – |
| MTXPho...

**USER:** Here is the complete findings from exploring the HTCPH SQL Server database:

---

## Database: HTCPH (SQL Server 2022)

### Table Row Counts

| Table | Rows | Notes |
|-------|------|-------|
| `NhapGiaCost` | 2,578 | **Primary pricing table** - all historical quotes |
| `DMNL` | 3,129 | Paper roll master data |
| `DTDonHang` | 35,991 | Order detail lines |
| `MTDonHang` | 13,968 | Order headers |
| `DMNLK` | 778 | Warehouse material catalog |
| `DMNhomGiay` | 43 | Paper group definitions |
| `D...

**ASSISTANT:** 4 agent đã hoàn thành. Đây là tổng hợp toàn bộ phát hiện quan trọng.

---

## Kết quả Khám phá SQL Server HTCPH

### Tổng quan Database
- **HTCPH** = ERP chính (331 bảng), 2 pháp nhân: **Nam Phương** + **VISUNPACK**
- Data từ 12/2023 → hiện tại: ~14k đơn hàng, ~36k dòng sản phẩm, ~14k lệnh SX

---

## Phát hiện quan trọng nhất

### 1. Công thức tính giá thực tế (reverse-engineered từ 2,578 records NhapGiaCost)

```python
# Kích thước tờ giấy
KhoTT = R + C + 3
DaiTT = (D + R) × 2 + 5   ← ⚠️ ERP h...

**USER:** File created successfully at: C:\Users\TUF\.claude\projects\d--NAM-PHUONG-SOFTWARE-DU-LIEU-MPS-erp-nam-phuong\memory\project_sql_server_htcph.md (file state is current in your context — no need to Read it back)

**USER:** 1	# Project Memory Index
2	
3	- [Pipeline 6 bước bắt buộc](feedback_task_pipeline.md) — Phân tích→Kế hoạch→Review→Thực thi→Dò lỗi→Kiểm thử; DỪNG sau Phase 2 chờ CONFIRM trước khi code
4	
5	- [Cấu trúc xưởng và kho theo pháp nhân](project_kho_phoi_defaults.md) — NP→Hoàng Gia, **Visunpack→Củ Chi**, NP Long An→Nam Thuận; mỗi xưởng có kho phôi + kho TP riêng
6	- [Thuật ngữ NVL phụ = NVL khác](project_nvl_terminology.md) — "NVL phụ" = ReceiptsPage.tsx (loai_hang='nvl'), khác với giấy cuộn (NhapGiayPa...

**USER:** The file C:\Users\TUF\.claude\projects\d--NAM-PHUONG-SOFTWARE-DU-LIEU-MPS-erp-nam-phuong\memory\MEMORY.md has been updated successfully. (file state is current in your context — no need to Read it back)

**ASSISTANT:** Đã lưu memory. Tóm tắt những điểm **cần kiểm tra / áp dụng ngay** vào ERP:

1. **Offset DaiTT**: Hệ thống cũ dùng `+5`, ERP hiện tại dùng `+3` — cần xác nhận cái nào đúng với Dương
2. **Final markup 12%**: Hệ thống cũ áp cố định 12% cuối cùng sau khi tính a+b+c+e+d — có thể đây là business rule không nên config
3. **Corrugation factor = 1.5** cho tất cả loại sóng (B/C/E) — đồng nhất, không tách biệt
4. **Bảng hao hụt 5 lớp**: `≤200→30%` đến `>2000→6%` — khớp với ERP hiện tại không?

---

## Tool Calls (11 total)

- **PowerShell**: {"command":"sqlcmd -? 2>&1 | Select-Object -First 3","description":"Check if sqlcmd is available"}...
- **Bash**: {"command":"python - <<'EOF'\nimport pymssql\ntry:\n    conn = pymssql.connect(\n        server='203.162.54.176',\n        port=1441,\n        user='duong',\n        password='Namphuong123@',\n       ...
- **Bash**: {"command":"python - <<'EOF'\nimport pymssql, json\n\nconn_cfg = dict(server='203.162.54.176', port=1441, user='duong', password='Namphuong123@', timeout=15)\n\nfor db in ['CDTPH', 'Dashboard', 'HTCPH...
- **Agent**: {"description":"Explore customer & sales tables in SQL Server","prompt":"Bạn cần explore cấu trúc SQL Server database HTCPH để hiểu nghiệp vụ bán hàng và khách hàng của một công ty sản xuất thùng cart...
- **Agent**: {"description":"Explore production & manufacturing tables in SQL Server","prompt":"Bạn cần explore cấu trúc SQL Server database HTCPH để hiểu nghiệp vụ sản xuất của một công ty sản xuất thùng carton V...
- **Agent**: {"description":"Explore finance & warehouse tables in SQL Server","prompt":"Bạn cần explore cấu trúc SQL Server database HTCPH để hiểu nghiệp vụ tài chính và kho vận của một công ty sản xuất thùng car...
- **Agent**: {"description":"Explore paper/materials & pricing tables in SQL Server","prompt":"Bạn cần explore cấu trúc SQL Server database HTCPH để hiểu nghiệp vụ nguyên liệu giấy và tính giá của một công ty sản ...
- **Write**: {"file_path":"C:\\Users\\TUF\\.claude\\projects\\d--NAM-PHUONG-SOFTWARE-DU-LIEU-MPS-erp-nam-phuong\\memory\\project_sql_server_htcph.md","content":"---\nname: project-sql-server-htcph\ndescription: Cấ...
- **Read**: {"file_path":"C:\\Users\\TUF\\.claude\\projects\\d--NAM-PHUONG-SOFTWARE-DU-LIEU-MPS-erp-nam-phuong\\memory\\MEMORY.md"}...
- **Edit**: {"replace_all":false,"file_path":"C:\\Users\\TUF\\.claude\\projects\\d--NAM-PHUONG-SOFTWARE-DU-LIEU-MPS-erp-nam-phuong\\memory\\MEMORY.md","old_string":"- [Default password \"123456\" là intentional](...

---

## Files in This Capture

| File | Description |
|------|-------------|
| `CONTEXT.md` | This analysis document |
| `transcript.jsonl` | Full raw conversation (180 entries) |
| `sentiment.json` | Sentiment analysis metadata |
| `tool-calls.json` | Extracted tool invocations (11 calls) |

---

## Learning System Notes

This failure has been captured for retroactive analysis. The learning system should:

1. Review the full transcript for root cause
2. Identify systemic issues that contributed
3. Determine if this failure type has occurred before
4. Propose improvements to prevent recurrence

**Action Required:** This capture needs manual review to extract learnings.
