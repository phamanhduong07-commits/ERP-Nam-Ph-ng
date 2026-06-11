---
task: "dai_tt override per sản phẩm"
slug: dai-tt-mac-dinh-per-product
effort: E3
phase: plan
progress: 0/35
mode: algorithm
project: erp-nam-phuong
started: 2026-06-11
updated: 2026-06-11
---

## Problem

Trong SxParamsTab, `chiều cắt (dai_tt)` là display-only — tính từ `calcBoxDimensions()`. Một số mã hàng đặc biệt cần `dai_tt` lớn hơn công thức +1-2cm (vật liệu, cấu trúc đặc thù). Hiện không có cách nào chỉnh sửa giá trị này, và kể cả khi lưu vào LSX item, lần mở lại vẫn reset về formula (vì `baseDims?.dai_tt` luôn có priority). Không có `dai_tt_mac_dinh` trên sản phẩm để làm chuẩn cho các lệnh sau.

## Vision

Người dùng mở tab "Lập lệnh SX", thấy `chiều cắt` là input có thể chỉnh được. Với mã hàng đặc biệt, gõ 114 thay vì 112. Nhấn "Lưu làm mặc định" → toast "Đã lưu 114 cm làm mặc định cho [tên hàng]". Từ lần sau, mọi LSX của mã hàng đó tự mở ra với 114 cm — không cần nhập lại.

## Out of Scope

- Không lưu mặc định cho các thông số khác (kho1, to_hop_song) — chỉ dai_tt
- Không thay đổi logic nguocSong (effectiveDaiTt = kho1 khi ngược sóng — không cần override)
- Không thay đổi haiManh logic (dai_tt per mảnh vẫn giữ nguyên, override apply bình thường)
- Không sync `dai_tt_mac_dinh` từ AMIS/external import

## Principles

- `dai_tt_mac_dinh` là sản phẩm-level override — không phải LSX-level — đúng với "làm chuẩn cho mã hàng"
- Override rõ ràng: khi đang dùng mặc định đã lưu, UI phải hiện hint "Tính từ KT: X cm" để user biết họ đang dùng override
- Formula vẫn là nguồn truth khi không có override — không break existing behavior

## Constraints

- Backend: Python FastAPI + SQLAlchemy + Alembic (migration required)
- Frontend: React 18 + TypeScript + Ant Design 5
- `ProductShort` schema đã được reuse nhiều nơi — thêm field `dai_tt_mac_dinh: float | None` phải backward-compatible (nullable, default None)
- Không break existing `handleSave` flow (vẫn save `dai_tt: effectiveDaiTt` vào LSX item)

## Goal

Thêm `dai_tt_mac_dinh` vào `SanPham` model, expose qua `ProductShort` schema, cung cấp `PATCH /products/{id}/dai-tt-mac-dinh` endpoint, và trong `SxParamsTab` làm `dai_tt` editable với init từ product override, kèm "Lưu làm mặc định" button.

## Criteria

- [ ] ISC-1: `SanPham` model có column `dai_tt_mac_dinh = Column(Float, nullable=True)`
- [ ] ISC-2: Alembic migration file tồn tại và chạy không lỗi
- [ ] ISC-3: `ProductShort` schema có `dai_tt_mac_dinh: float | None = None`
- [ ] ISC-4: `PATCH /products/{id}/dai-tt-mac-dinh` endpoint tồn tại trong products router
- [ ] ISC-5: Endpoint yêu cầu `Depends(get_current_user)` (auth guard)
- [ ] ISC-6: Endpoint nhận body `{ "dai_tt_mac_dinh": float | null }`
- [ ] ISC-7: Endpoint chỉ update `dai_tt_mac_dinh`, không thay đổi field khác
- [ ] ISC-8: Endpoint trả về `{ id, dai_tt_mac_dinh }` sau khi update
- [ ] ISC-9: `ProductionOrderItem` response (GET /production-orders/{id}) include `product.dai_tt_mac_dinh`
- [ ] ISC-10: Frontend type `ProductShort` trong `productionOrders.ts` (hoặc tương đương) có `dai_tt_mac_dinh?: number | null`
- [ ] ISC-11: `daiTtFormula` const = `baseDims?.dai_tt ?? 0` tồn tại trong `ItemSxCard`
- [ ] ISC-12: `daiTtOverride` là `useState<number>`, init từ `item.product?.dai_tt_mac_dinh ?? daiTtFormula`
- [ ] ISC-13: `daiTt` variable được thay bằng `daiTtOverride` trong tất cả tính toán KG/phôi
- [ ] ISC-14: `effectiveDaiTt = nguocSong ? kho1 : daiTtOverride` (không phải `daiTt`)
- [ ] ISC-15: `chiều cắt` field ở case bình thường (không nguocSong, không haiManh) là `<InputNumber>` không phải `<Text>`
- [ ] ISC-16: `<InputNumber>` cho `dai_tt` có `min={1}`, `step={0.5}`, `addonAfter="cm"`, `size="small"`
- [ ] ISC-17: Khi `daiTtOverride !== daiTtFormula` và `daiTtFormula > 0`: hiển thị hint "Tính KT: X cm"
- [ ] ISC-18: "Lưu làm mặc định" button hiện khi: `daiTtOverride !== daiTtFormula` AND `item.product?.id` tồn tại
- [ ] ISC-19: "Lưu làm mặc định" button ẩn khi `daiTtOverride === daiTtFormula` (formula match, không cần override)
- [ ] ISC-20: "Lưu làm mặc định" button khi click gọi `PATCH /products/{id}/dai-tt-mac-dinh`
- [ ] ISC-21: Toast sau lưu thành công: "Đã lưu X cm làm mặc định cho [ten_hang]"
- [ ] ISC-22: Khi `item.product?.dai_tt_mac_dinh` non-null (đang dùng override đã lưu): hiển thị indicator nhỏ "Mặc định đã lưu"
- [ ] ISC-23: "Xóa mặc định" link/button hiện khi `item.product?.dai_tt_mac_dinh` non-null, click PATCH với `null`
- [ ] ISC-24: Sau "Xóa mặc định": `daiTtOverride` reset về `daiTtFormula`
- [ ] ISC-25: `availableLanCats` case (dưới 70cm) vẫn dùng `daiTtOverride` thay vì `daiTt`
- [ ] ISC-26: `haiManh` case: display "2 mảnh × X cm/mảnh" vẫn dùng `daiTtOverride`
- [ ] ISC-27: `handleSave` vẫn ghi `dai_tt: effectiveDaiTt` vào LSX item (không thay đổi hành vi lưu LSX)
- [ ] ISC-28: Anti: `nguocSong=true` → `dai_tt` field vẫn display-only (kho1), không expose InputNumber
- [ ] ISC-29: Anti: lưu `dai_tt_mac_dinh` cho product A không ảnh hưởng product B
- [ ] ISC-30: Anti: Migration thêm nullable column → không break existing SanPham records
- [ ] ISC-31: Anti: "Lưu làm mặc định" không trigger đồng thời "Lưu thông số SX"
- [ ] ISC-32: Anti: `dai_tt_mac_dinh=0` không được dùng như override (treat as null)
- [ ] ISC-33: Backend migration chạy `alembic upgrade head` thành công
- [ ] ISC-34: Backend khởi động không lỗi import/syntax
- [ ] ISC-35: Frontend `tsc --noEmit` exit 0

## Test Strategy

| isc | type | check | threshold | tool |
|-----|------|-------|-----------|------|
| ISC-1 | code | Grep `dai_tt_mac_dinh` in models/master.py | found + Float + nullable | Grep |
| ISC-2 | build | `alembic upgrade head` | exit 0 | Bash |
| ISC-3 | code | Read schemas/master.py ProductShort | field present | Read |
| ISC-4 | code | Grep `dai-tt-mac-dinh` in routers/products.py | found | Grep |
| ISC-5 | code | Grep `get_current_user` near endpoint | found | Grep |
| ISC-8 | live | `curl -X PATCH /products/1/dai-tt-mac-dinh -d '{"dai_tt_mac_dinh":114}'` | 200 + id + value | Bash |
| ISC-9 | live | `curl /production-orders/{id}` | items[].product.dai_tt_mac_dinh present | Bash |
| ISC-10 | code | Grep `dai_tt_mac_dinh` in frontend api types | found | Grep |
| ISC-11..14 | code | Read ItemSxCard state vars | daiTtFormula/daiTtOverride/effectiveDaiTt | Read |
| ISC-15 | code | Grep `InputNumber` near `chiều cắt\|dai_tt` in SxParamsTab | found | Grep |
| ISC-17..24 | code | Read SxParamsTab UI section for dai_tt | buttons/hints present | Read |
| ISC-33 | build | `alembic upgrade head` | no error | Bash |
| ISC-34 | build | backend uvicorn start | no error | Bash |
| ISC-35 | build | `tsc --noEmit` | exit 0 | Bash |

## Features

| name | satisfies | depends_on | parallelizable |
|------|-----------|------------|----------------|
| backend-model-endpoint | ISC-1..9, 29..30, 33..34 | — | no |
| frontend-types | ISC-10 | backend-model-endpoint | no |
| frontend-ui | ISC-11..28, 31..32, 35 | frontend-types | yes after types |

## Decisions

- `dai_tt_mac_dinh` on SanPham (product level) vs ProductionOrderItem: user said "làm chuẩn cho mã hàng" → product level is correct. Per-LSX save already works via item.dai_tt.
- InputNumber editable only when not `nguocSong` (when nguocSong, effectiveDaiTt=kho1 which is already computed from editable khoTt). Keeps UI surface minimal.
- "Lưu làm mặc định" is a separate action from "Lưu thông số SX" — user consciously chooses to propagate to product level.
- `dai_tt_mac_dinh=0` treated as null: 0 is never a valid chiều cắt, avoid mistakenly using it.

## Changelog

## Verification
