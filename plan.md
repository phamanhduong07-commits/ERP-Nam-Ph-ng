# Plan: Rà soát toàn diện Mobile Sau In — Gap sót
Date: 2026-05-19
Status: PENDING_APPROVAL

## Tổng kết yêu cầu session này (đã hoàn thành)

| Yêu cầu | Fix | File |
|---|---|---|
| Không ngưng tạo phiếu bù trên mobile | `/ngung-in`, `/ngung-dinh-hinh`, `/bat-dau-sau-in` → `get_optional_user` | cd2.py |
| Nút web không đồng bộ | `dinhHinhStartMutation` chain `/sau-in`+`/bat-dau-sau-in` → `dang_sau_in` | MobileTrackingPage.tsx |
| Mobile tạm dừng, web nút "Bắt đầu" | `MachineTab` treat `sau_in+tam_dung_luc` as active; `handleTiepTuc` chain `batDauSauIn` | SauInKanbanPage.tsx |
| Số lượng mobile/web không khớp | SL ref → `so_luong_in_ok ?? so_luong_phoi` cho sau-in mode | MobileTrackingPage.tsx |
| Mất mạng quét được không | `handleLookup` tìm local list trước, thông báo rõ khi offline | MobileTrackingPage.tsx |

## Mục tiêu

Đóng nốt gap còn sót: khi mobile bấm TIẾP TỤC trên phiếu `sau_in + tam_dung_luc`,
phiếu phải reach `dang_sau_in` để web đồng bộ đúng.

## Các bước thực thi

- [ ] Bước 1: Fix `sauInTiepTucMutation` trong MobileTrackingPage.tsx
  - `mutationFn`: sau khi gọi `tiepTucIn`, nếu phiếu đang ở `sau_in + may_sau_in_id` thì gọi thêm `batDauSauIn`
  - `onSuccess`: `setCurrentOrder` với response của lần gọi cuối (đã là `dang_sau_in`)
  - File: `frontend/src/pages/production/MobileTrackingPage.tsx`

## Done Criteria

- [ ] Mobile TIẾP TỤC từ `sau_in+tam_dung_luc` → phiếu đạt `dang_sau_in` trên server
- [ ] Web nhận WebSocket → phiếu vào `active` section → hiện "Tạm dừng" + "Hoàn thành" (không còn "Bắt đầu")
- [ ] Mobile TIẾP TỤC từ `dang_sau_in+tam_dung_luc` → vẫn hoạt động bình thường (không gọi `batDauSauIn` thừa)
- [ ] TypeScript: không có lỗi mới

## Rủi ro

- Không có: `batDauSauIn` idempotent với `sau_in + may_sau_in_id`, backend trả lỗi rõ nếu state sai
