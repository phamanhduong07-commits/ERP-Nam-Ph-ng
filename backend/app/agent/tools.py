SYSTEM_PROMPT = """Bạn là trợ lý ERP thông minh của Công ty TNHH Nam Phương Bao Bì (sản xuất thùng carton TP.HCM).
Nhiệm vụ: hỗ trợ nhân viên nội bộ truy vấn và quản lý dữ liệu ERP bằng ngôn ngữ tự nhiên tiếng Việt.

Quyền hạn theo role:
- ADMIN / GIAM_DOC: toàn quyền xem mọi dữ liệu và duyệt nghiệp vụ
- KE_TOAN: tài chính, công nợ, phiếu thu/chi, hóa đơn
- KINH_DOANH: báo giá, đơn hàng, khách hàng
- KHO: tồn kho, phiếu xuất/nhập kho
- SAN_XUAT: lệnh sản xuất, kế hoạch SX, BOM
- MUA_HANG: đơn mua hàng, nhà cung cấp

Nguyên tắc làm việc:
1. Luôn dùng tool để lấy dữ liệu thực từ hệ thống — không đoán mò số liệu
2. Trả lời ngắn gọn, đúng trọng tâm, dùng danh sách khi có nhiều dòng dữ liệu
3. Nếu không tìm thấy dữ liệu, nói rõ "không tìm thấy" thay vì đoán
4. Xưng "tôi", gọi người dùng theo chức danh nếu biết, ngôn ngữ thân thiện

== QUY TẮC THAO TÁC GHI (BẮT BUỘC) ==
Trước khi gọi bất kỳ tool nào có tên bắt đầu bằng "update_" hoặc "create_":
1. Tóm tắt chính xác thao tác sẽ thực hiện (thay đổi gì, trên bản ghi nào)
2. Hỏi: "Bạn xác nhận thực hiện không?"
3. CHỈ gọi tool sau khi người dùng trả lời "có", "xác nhận", "đồng ý", "ok", "yes" (không phân biệt hoa thường)
4. Nếu người dùng từ chối hoặc muốn thay đổi → KHÔNG gọi tool

== HƯỚNG DẪN SỬ DỤNG CÁC MODULE ERP ==
Khi được hỏi "hướng dẫn sử dụng", "làm thế nào", "cách dùng" → trả lời dựa trên kiến thức module bên dưới, KHÔNG cần gọi tool.

--- MODULE BÁN HÀNG ---
Quy trình chuẩn: Khách hàng → Báo giá → Đơn hàng → Phiếu bán hàng → Phiếu thu
1. Khách hàng (menu Bán hàng > Khách hàng): thêm/sửa thông tin KH, hạn mức công nợ
2. Báo giá (Bán hàng > Báo giá): tạo báo giá gửi KH, chọn sản phẩm và giá, xuất PDF
3. Đơn hàng (Bán hàng > Đơn hàng): tạo từ báo giá hoặc nhập trực tiếp, duyệt → chuyển sản xuất
4. Phiếu bán hàng (Bán hàng > Phiếu bán hàng): ghi nhận xuất hàng thực tế, in phiếu A4
5. Phiếu thu (Kế toán > Phiếu thu): ghi nhận thu tiền từ KH

Trạng thái đơn hàng: mới → đã duyệt → đang sản xuất → hoàn thành / hủy

--- MODULE MUA HÀNG ---
Quy trình: Nhà cung cấp → Yêu cầu mua → Đơn mua hàng → Phiếu nhập kho → Phiếu chi
1. Nhà cung cấp (Mua hàng > Nhà cung cấp): quản lý danh sách NCC
2. Đơn mua hàng (Mua hàng > Đơn mua): tạo đơn mua nguyên liệu/vật tư, duyệt → gửi NCC
3. Phiếu nhập kho (Kho > Nhập kho): nhận hàng từ NCC, xác nhận → tự động cập nhật tồn kho
4. Phiếu chi (Kế toán > Phiếu chi): thanh toán cho NCC

--- MODULE KHO ---
1. Nhập kho: nhận hàng từ NCC hoặc từ sản xuất
2. Xuất kho: xuất nguyên liệu cho sản xuất hoặc xuất thành phẩm giao KH
3. Chuyển kho: di chuyển hàng giữa các kho/phân xưởng
4. Điều chỉnh tồn: kiểm kê và điều chỉnh số liệu tồn kho

--- MODULE SẢN XUẤT ---
Quy trình: Kế hoạch SX → Lệnh SX → Xuất NVL → Nhập thành phẩm
1. Kế hoạch SX (Sản xuất > Kế hoạch): lên kế hoạch từ đơn hàng, phân xưởng, thời gian
2. Lệnh SX (Sản xuất > Lệnh SX): tạo lệnh cho từng phân xưởng, theo dõi tiến độ
3. BOM (Sản xuất > BOM): định mức nguyên liệu cho từng sản phẩm

--- MODULE KẾ TOÁN ---
1. Phiếu thu (01-TT): ghi nhận tiền vào — thu từ KH, thu khác
2. Phiếu chi (02-TT): ghi nhận tiền ra — trả NCC, chi phí
3. Công nợ: theo dõi KH nợ tiền, NCC phải trả
4. Báo cáo: doanh thu, chi phí, lợi nhuận theo kỳ

--- MODULE NHÂN SỰ ---
1. Nhân viên: hồ sơ, phòng ban, chức vụ
2. Chấm công: ghi nhận công làm việc hàng ngày
3. Bảng lương: tính lương tự động theo công + sản phẩm"""

TOOL_DEFINITIONS = [
    # ── Read-only tools ──────────────────────────────────────────────────────
    {
        "name": "query_orders",
        "description": (
            "Tra cứu đơn hàng bán hàng. Dùng khi hỏi về đơn hàng, trạng thái giao hàng, "
            "doanh thu, đơn hàng của khách hàng cụ thể, hoặc đơn hàng theo khoảng thời gian."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "customer_name": {"type": "string", "description": "Tên khách hàng (tìm kiếm gần đúng)"},
                "so_don": {"type": "string", "description": "Mã đơn hàng cụ thể, VD: DH-20240101001"},
                "trang_thai": {
                    "type": "string",
                    "description": "Trạng thái đơn: moi | da_duyet | dang_sx | hoan_thanh | huy",
                    "enum": ["moi", "da_duyet", "dang_sx", "hoan_thanh", "huy"],
                },
                "date_from": {"type": "string", "description": "Từ ngày YYYY-MM-DD"},
                "date_to": {"type": "string", "description": "Đến ngày YYYY-MM-DD"},
                "limit": {"type": "integer", "description": "Số kết quả tối đa (mặc định 10)", "default": 10},
            },
        },
    },
    {
        "name": "query_quotes",
        "description": (
            "Tra cứu báo giá. Dùng khi hỏi về báo giá, tình trạng duyệt, "
            "báo giá của khách hàng cụ thể, hoặc giá trị báo giá."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "customer_name": {"type": "string", "description": "Tên khách hàng (tìm kiếm gần đúng)"},
                "so_bao_gia": {"type": "string", "description": "Mã báo giá, VD: BG20240101001"},
                "trang_thai": {
                    "type": "string",
                    "description": "Trạng thái: moi | da_duyet | tu_choi | het_han",
                    "enum": ["moi", "da_duyet", "tu_choi", "het_han"],
                },
                "date_from": {"type": "string", "description": "Từ ngày YYYY-MM-DD"},
                "date_to": {"type": "string", "description": "Đến ngày YYYY-MM-DD"},
                "limit": {"type": "integer", "description": "Số kết quả tối đa (mặc định 10)", "default": 10},
            },
        },
    },
    {
        "name": "query_production_status",
        "description": (
            "Tra cứu lệnh sản xuất. Dùng khi hỏi về tiến độ SX, "
            "lệnh đang chạy, lệnh trễ, hoặc tình trạng hoàn thành."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "so_lenh": {"type": "string", "description": "Mã lệnh sản xuất"},
                "sales_order_id": {"type": "integer", "description": "ID đơn hàng liên quan"},
                "trang_thai": {
                    "type": "string",
                    "description": "Trạng thái: moi | dang_chay | hoan_thanh | huy",
                    "enum": ["moi", "dang_chay", "hoan_thanh", "huy"],
                },
                "tre_han": {"type": "boolean", "description": "true = chỉ lấy lệnh trễ kế hoạch"},
                "limit": {"type": "integer", "description": "Số kết quả tối đa (mặc định 10)", "default": 10},
            },
        },
    },
    {
        "name": "query_inventory",
        "description": (
            "Xem tồn kho nguyên liệu, thành phẩm, phôi sóng. Dùng khi hỏi về tồn kho, "
            "số lượng còn trong kho, hàng sắp hết, hoặc giá trị tồn kho."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "ten_hang": {"type": "string", "description": "Tên hàng (tìm kiếm gần đúng)"},
                "loai_kho": {
                    "type": "string",
                    "description": "nguyen_lieu | thanh_pham | phoi_song | tat_ca",
                    "enum": ["nguyen_lieu", "thanh_pham", "phoi_song", "tat_ca"],
                },
                "chi_hang_sap_het": {"type": "boolean", "description": "true = chỉ hàng dưới mức tối thiểu"},
                "limit": {"type": "integer", "description": "Số kết quả tối đa (mặc định 20)", "default": 20},
            },
        },
    },
    {
        "name": "query_customers",
        "description": "Tìm kiếm thông tin khách hàng theo tên hoặc số điện thoại.",
        "input_schema": {
            "type": "object",
            "properties": {
                "ten": {"type": "string", "description": "Tên khách hàng/công ty (gần đúng)"},
                "so_dien_thoai": {"type": "string", "description": "Số điện thoại"},
                "limit": {"type": "integer", "description": "Số kết quả tối đa (mặc định 10)", "default": 10},
            },
        },
    },
    {
        "name": "query_purchase_orders",
        "description": "Tra cứu đơn mua hàng (giấy cuộn và vật tư). Dùng khi hỏi về thu mua, nhà cung cấp.",
        "input_schema": {
            "type": "object",
            "properties": {
                "supplier_name": {"type": "string", "description": "Tên nhà cung cấp (gần đúng)"},
                "so_don_mua": {"type": "string", "description": "Mã đơn mua hàng"},
                "trang_thai": {
                    "type": "string",
                    "description": "moi | da_duyet | hoan_thanh | huy",
                    "enum": ["moi", "da_duyet", "hoan_thanh", "huy"],
                },
                "date_from": {"type": "string", "description": "Từ ngày YYYY-MM-DD"},
                "limit": {"type": "integer", "description": "Số kết quả tối đa (mặc định 10)", "default": 10},
            },
        },
    },
    {
        "name": "get_dashboard_summary",
        "description": (
            "Lấy số liệu tổng quan hôm nay: doanh thu tháng, đơn hàng mới, "
            "lệnh SX đang chạy/trễ, tồn kho sắp hết, đơn mua chờ duyệt."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "generate_report",
        "description": (
            "Tạo báo cáo tổng hợp theo kỳ. Dùng khi hỏi báo cáo doanh thu, "
            "sản xuất theo tháng/quý/năm, hoặc tổng kết tồn kho."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "loai_bao_cao": {
                    "type": "string",
                    "description": "doanh_thu | san_xuat | ton_kho",
                    "enum": ["doanh_thu", "san_xuat", "ton_kho"],
                },
                "ky": {
                    "type": "string",
                    "description": "thang_nay | thang_truoc | quy_nay | nam_nay | tuy_chinh",
                    "enum": ["thang_nay", "thang_truoc", "quy_nay", "nam_nay", "tuy_chinh"],
                },
                "date_from": {"type": "string", "description": "Từ ngày YYYY-MM-DD (dùng khi ky=tuy_chinh)"},
                "date_to": {"type": "string", "description": "Đến ngày YYYY-MM-DD (dùng khi ky=tuy_chinh)"},
            },
            "required": ["loai_bao_cao", "ky"],
        },
    },

    # ── Write tools (yêu cầu xác nhận trước khi gọi) ─────────────────────────
    {
        "name": "update_order_status",
        "description": (
            "Cập nhật trạng thái đơn hàng. "
            "QUAN TRỌNG: phải hỏi xác nhận người dùng trước khi gọi tool này."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "order_id": {
                    "type": "integer",
                    "description": "ID đơn hàng (lấy từ query_orders trước)",
                },
                "trang_thai_moi": {
                    "type": "string",
                    "description": "Trạng thái mới: da_duyet | dang_sx | hoan_thanh | huy",
                    "enum": ["da_duyet", "dang_sx", "hoan_thanh", "huy"],
                },
                "ghi_chu": {
                    "type": "string",
                    "description": "Ghi chú lý do thay đổi (không bắt buộc)",
                },
            },
            "required": ["order_id", "trang_thai_moi"],
        },
    },
    {
        "name": "create_quote_draft",
        "description": (
            "Tạo bản nháp báo giá mới (trạng thái 'mới', chưa duyệt). "
            "QUAN TRỌNG: phải hỏi xác nhận người dùng trước khi gọi tool này."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "customer_id": {
                    "type": "integer",
                    "description": "ID khách hàng (lấy từ query_customers trước)",
                },
                "ghi_chu": {
                    "type": "string",
                    "description": "Ghi chú / yêu cầu đặc biệt",
                },
                "ngay_het_han": {
                    "type": "string",
                    "description": "Ngày hết hạn báo giá YYYY-MM-DD (mặc định 30 ngày)",
                },
            },
            "required": ["customer_id"],
        },
    },
    {
        "name": "create_customer",
        "description": (
            "Tạo mới thông tin khách hàng vào hệ thống. "
            "QUAN TRỌNG: phải hỏi xác nhận người dùng trước khi gọi tool này."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "ma_kh": {
                    "type": "string",
                    "description": (
                        "Mã khách hàng duy nhất (VD: KH-DATVIET). "
                        "Nếu người dùng không cung cấp, hãy tự sinh tự động "
                        "viết hoa không dấu dựa trên tên viết tắt."
                    ),
                },
                "ten_viet_tat": {
                    "type": "string",
                    "description": "Tên viết tắt / tên gọi nhanh của khách hàng (bắt buộc, VD: Bao Bì Đất Việt)",
                },
                "ten_don_vi": {
                    "type": "string",
                    "description": "Tên đầy đủ của công ty/đơn vị (VD: Công ty Cổ phần Bao Bì Đất Việt)",
                },
                "dia_chi": {
                    "type": "string",
                    "description": "Địa chỉ trụ sở chính đăng ký kinh doanh",
                },
                "dia_chi_giao_hang": {
                    "type": "string",
                    "description": "Địa chỉ nhận hàng thực tế (nếu khác địa chỉ trụ sở)",
                },
                "dien_thoai": {
                    "type": "string",
                    "description": "Số điện thoại chính của công ty/khách hàng",
                },
                "ma_so_thue": {
                    "type": "string",
                    "description": "Mã số thuế doanh nghiệp",
                },
                "nguoi_lien_he": {
                    "type": "string",
                    "description": "Họ tên người liên hệ trực tiếp đặt hàng",
                },
                "so_dien_thoai_lh": {
                    "type": "string",
                    "description": "Số điện thoại của người liên hệ trực tiếp",
                },
                "ghi_chu": {
                    "type": "string",
                    "description": "Các thông tin bổ sung khác",
                },
            },
            "required": ["ten_viet_tat"],
        },
    },
]
