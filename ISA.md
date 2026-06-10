---
task: "Gỡ LSX khỏi KH → tự quay lại KHSX chờ"
slug: go-khoi-kh-return-to-queue
effort: E3
phase: verify
progress: 38/38
mode: algorithm
project: erp-nam-phuong
started: 2026-06-10
updated: 2026-06-10
---

## Problem

Khi nhấn "Gỡ khỏi KH", `delete_line` xóa hẳn `ProductionPlanLine` — LSX mất hoàn toàn khỏi hệ thống. Dialog xác nhận đã hiện "LSX sẽ về trạng thái chờ KHSX" nhưng hành động thực tế không làm vậy. Người dùng mong đợi LSX vẫn visible trong queue chờ để có thể lên lịch lại.

## Vision

Sau khi gỡ, LSX xuất hiện ngay trong ProductionQueuePage với trạng thái "Chờ" và badge "Hàng chờ" (phân biệt với nhap plan thông thường). Không cần thao tác thêm — tự động. Người dùng có thể thấy nó và thêm vào plan mới bất cứ lúc nào.

## Out of Scope

- Không tạo UI để "kéo từ hàng chờ vào plan" (feature sau)
- Không thay đổi schema DB (không migration)
- Không thay đổi push_to_queue logic (nó đã handle dedup)
- Không ảnh hưởng lines đang `dang_chay`

## Principles

- Pool plan là implementation detail — user chỉ thấy "Hàng chờ", không thấy "KHSX-POOL"
- No migration: dùng existing schema, sentinel so_ke_hoach
- Backward-compatible: lines từ pool plan behave như lines chờ thông thường trong queue

## Constraints

- `plan_id` NOT NULL — phải dùng pool plan approach
- Backend: Python FastAPI, SQLAlchemy
- Frontend: React 18 + TypeScript + Ant Design 5
- Không break push_to_queue dedup logic (đã kiểm tra: nó tìm existing "cho" line → sẽ tìm thấy pool line)

## Goal

Khi `DELETE /{plan_id}/lines/{line_id}` được gọi, thay vì xóa line, di chuyển line sang pool plan (`KHSX-POOL`) với `trang_thai = 'cho'`. Queue page tự động hiển thị line này với badge "Hàng chờ". Pool plan bị ẩn khỏi KHSX list và không thể bị xóa/chốt.

## Criteria

- [ ] ISC-1: `QUEUE_POOL_SO = "KHSX-POOL"` constant tồn tại trong production_plans.py
- [ ] ISC-2: `_get_or_create_pool_plan(db)` helper function tồn tại
- [ ] ISC-3: Pool plan tự động tạo nếu chưa có khi gỡ lần đầu
- [ ] ISC-4: `delete_line` không gọi `db.delete(line)` nữa
- [ ] ISC-5: Sau gỡ, `line.plan_id == pool_plan.id`
- [ ] ISC-6: Sau gỡ, `line.trang_thai == 'cho'`
- [ ] ISC-7: Sau gỡ, `line.ngay_chay == None`
- [ ] ISC-8: `list_plans` filter `so_ke_hoach != QUEUE_POOL_SO` — pool không hiện trong KHSX list
- [ ] ISC-9: `delete_plan` guard — không thể xóa pool plan, raise 400
- [ ] ISC-10: Queue endpoint vẫn trả về pool plan lines (nhap plan filter covers it)
- [ ] ISC-11: `POOL_PLAN_SO = 'KHSX-POOL'` constant trong ProductionQueuePage.tsx
- [ ] ISC-12: `nhapPlans` useMemo lọc ra pool plan (`so_ke_hoach !== POOL_PLAN_SO`)
- [ ] ISC-13: `selectedNhapPlans` useMemo lọc ra pool plan
- [ ] ISC-14: "Chốt KH" button ẩn cho lines có `so_ke_hoach === POOL_PLAN_SO`
- [ ] ISC-15: Status tag hiển thị "Hàng chờ" (không phải "Chưa chốt KH") cho pool lines
- [ ] ISC-16: "Kế hoạch chờ chốt" banner không hiện pool plan button
- [ ] ISC-17: Anti: pool plan không hiện trong danh sách kế hoạch SX (list_plans)
- [ ] ISC-18: Anti: không thể chốt pool plan qua UI
- [ ] ISC-19: Anti: không thể xóa pool plan qua API
- [ ] ISC-20: Anti: line đang `dang_chay` vẫn bị block gỡ (existing guard còn nguyên)
- [ ] ISC-21: Anti: không tạo duplicate pool plan (singleton by so_ke_hoach)
- [ ] ISC-22: Backend build thành công (no import errors, no syntax errors)
- [ ] ISC-23: Frontend build thành công (no TypeScript errors)
- [ ] ISC-24: Push_to_queue dedup vẫn hoạt động: gọi push với poi_id đã có pool line → cập nhật pool line thay vì tạo mới
- [ ] ISC-25: Pool plan trang_thai = 'nhap' (để get_queue include nó)
- [ ] ISC-26: Pool plan ghi_chu rõ ràng mô tả đây là hàng chờ
- [ ] ISC-27: `_build_plan_response` sau delete_line trả về plan gốc (không phải pool)
- [ ] ISC-28: Lines trong pool plan có thu_tu = 0 (không ảnh hưởng sort)
- [ ] ISC-29: Service restart thành công sau deploy
- [ ] ISC-30: Queue page refresh sau gỡ → line xuất hiện trong queue
- [ ] ISC-31: Antecedent: pool plan tồn tại trong DB trước khi queue endpoint truy vấn nó
- [ ] ISC-32: "Chốt KH" in selected-rows toolbar ẩn cho pool plan
- [ ] ISC-33: Badge tag màu "Hàng chờ" phân biệt về màu/text với "Chưa chốt KH"
- [ ] ISC-34: list_plans filter không break trang KHSX list hiện tại
- [ ] ISC-35: Anti: push_to_queue không tạo plan mới khi đã có pool line cho cùng poi_id
- [ ] ISC-36: delete_plan guard chỉ check so_ke_hoach, không ảnh hưởng xóa plan thường
- [ ] ISC-37: Khi pool plan chưa tồn tại và gọi delete_line lần đầu → pool tự tạo thành công
- [ ] ISC-38: Anti: lines từ da_xuat plan không bị ảnh hưởng khi gỡ (existing guard cho dang_chay vẫn đủ)

## Test Strategy

| isc | type | check | threshold | tool |
|-----|------|-------|-----------|------|
| ISC-1 | code | Grep "QUEUE_POOL_SO" in production_plans.py | found | Grep |
| ISC-4 | code | Grep "db.delete(line)" in delete_line function | NOT found | Grep |
| ISC-5,6,7 | code | Read delete_line function body | pool.id + cho + None | Read |
| ISC-8 | code | Grep "QUEUE_POOL_SO" in list_plans | found | Grep |
| ISC-9 | code | Grep "QUEUE_POOL_SO" in delete_plan | found | Grep |
| ISC-11..16 | code | Read ProductionQueuePage relevant sections | correct | Read |
| ISC-22 | build | Backend start (uvicorn syntax check) | no error | Bash |
| ISC-23 | build | Frontend tsc --noEmit | exit 0 | Bash |

## Features

| name | satisfies | depends_on | parallelizable |
|------|-----------|------------|----------------|
| pool-plan-backend | ISC-1..10,19..22,24..28,31,35..38 | — | no |
| pool-plan-frontend | ISC-11..18,30,32..33 | pool-plan-backend | yes after backend |

## Decisions

- Pool plan approach chosen over nullable plan_id: no migration required, backward compatible, clean sentinel pattern
- Delegation floor: Forge for backend (Python precision), frontend done inline (straightforward TypeScript)
- `push_to_queue` dedup check: queries `plan_trang_thai IN ['nhap', 'da_xuat']` and `trang_thai IN ['cho', 'dang_chay']` — pool plan (nhap) lines match this filter → dedup works correctly, no change needed

## Changelog

## Verification
