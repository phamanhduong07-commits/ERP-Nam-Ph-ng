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
4. Nếu người dùng từ chối hoặc muốn thay đổi → KHÔNG gọi tool"""

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
                "date_to":   {"type": "string", "description": "Đến ngày YYYY-MM-DD"},
                "limit":     {"type": "integer", "description": "Số kết quả tối đa (mặc định 10)", "default": 10},
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
                "so_bao_gia":    {"type": "string", "description": "Mã báo giá, VD: BG20240101001"},
                "trang_thai": {
                    "type": "string",
                    "description": "Trạng thái: moi | da_duyet | tu_choi | het_han",
                    "enum": ["moi", "da_duyet", "tu_choi", "het_han"],
                },
                "date_from": {"type": "string", "description": "Từ ngày YYYY-MM-DD"},
                "date_to":   {"type": "string", "description": "Đến ngày YYYY-MM-DD"},
                "limit":     {"type": "integer", "description": "Số kết quả tối đa (mặc định 10)", "default": 10},
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
                "so_lenh":        {"type": "string",  "description": "Mã lệnh sản xuất"},
                "sales_order_id": {"type": "integer", "description": "ID đơn hàng liên quan"},
                "trang_thai": {
                    "type": "string",
                    "description": "Trạng thái: moi | dang_chay | hoan_thanh | huy",
                    "enum": ["moi", "dang_chay", "hoan_thanh", "huy"],
                },
                "tre_han": {"type": "boolean", "description": "true = chỉ lấy lệnh trễ kế hoạch"},
                "limit":   {"type": "integer", "description": "Số kết quả tối đa (mặc định 10)", "default": 10},
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
                "ten":           {"type": "string", "description": "Tên khách hàng/công ty (gần đúng)"},
                "so_dien_thoai": {"type": "string", "description": "Số điện thoại"},
                "limit":         {"type": "integer", "description": "Số kết quả tối đa (mặc định 10)", "default": 10},
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
                "so_don_mua":    {"type": "string", "description": "Mã đơn mua hàng"},
                "trang_thai": {
                    "type": "string",
                    "description": "moi | da_duyet | hoan_thanh | huy",
                    "enum": ["moi", "da_duyet", "hoan_thanh", "huy"],
                },
                "date_from": {"type": "string", "description": "Từ ngày YYYY-MM-DD"},
                "limit":     {"type": "integer", "description": "Số kết quả tối đa (mặc định 10)", "default": 10},
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
                "date_to":   {"type": "string", "description": "Đến ngày YYYY-MM-DD (dùng khi ky=tuy_chinh)"},
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
]
