---
layout: home
hero:
  name: "Nam Phương ERP"
  text: "Tài liệu Hướng dẫn Sử dụng"
  tagline: Hệ thống quản trị toàn diện dành cho nhà máy sản xuất bao bì carton.
  actions:
    - theme: brand
      text: Bắt đầu học ngay
      link: /user_guide/01_sales/01_tao_khach_hang_moi
    - theme: alt
      text: Xem Mục Lục
      link: /planhuongdan
features:
  - title: 1. Sales & Quotes
    details: Tính giá M2, chọn sóng, chốt đơn hàng và theo dõi giao hàng.
  - title: 2. Kế Hoạch & Sản Xuất
    details: Lên lịch Kanban máy in, máy bế. Quét mã vạch khai báo năng suất.
  - title: 3. Quản Lý Kho
    details: Quản lý cuộn giấy, tồn phôi, quét mã nhập xuất kho.
---

## Sơ đồ Tổng Quan Hệ Thống

```mermaid
flowchart TD
    A[Khách hàng] -->|Yêu cầu| B(Bán hàng & Báo giá)
    B -->|Chốt đơn| C(Kế hoạch Sản xuất)
    C -->|Thiếu Vật tư| D(Mua hàng)
    D -->|Nhập NVL| E(Kho NVL & Phôi)
    E -->|Cấp phát| F(Phân xưởng Sản xuất)
    C -->|Chỉ thị lệnh| F
    F -->|Báo cáo KCS| G(Kho Thành phẩm)
    G -->|Lên chuyến| H(Giao hàng Logistics)
    H -->|Ghi nhận| I(Kế toán & Công nợ)
```

> Vui lòng dùng thanh Menu bên trái (Sidebar) để chuyển đến Hướng dẫn của phòng ban bạn.
