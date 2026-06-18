import xml.etree.ElementTree as ET
from datetime import datetime, date
from decimal import Decimal
import logging

logger = logging.getLogger("erp")


def get_clean_tag(element) -> str:
    """Trích xuất tên tag loại bỏ namespace XML."""
    return element.tag.split("}")[-1]


def find_tag_recursive(element, tag_name) -> ET.Element | None:
    """Tìm tag đầu tiên khớp tên (không phân biệt hoa thường, bỏ qua namespace)."""
    target = tag_name.lower()
    for child in element.iter():
        if get_clean_tag(child).lower() == target:
            return child
    return None


def find_all_tags_recursive(element, tag_name) -> list[ET.Element]:
    """Tìm tất cả các tag khớp tên (không phân biệt hoa thường, bỏ qua namespace)."""
    target = tag_name.lower()
    results = []
    for child in element.iter():
        if get_clean_tag(child).lower() == target:
            results.append(child)
    return results


def get_tag_value(element, tag_name, default="") -> str:
    """Lấy giá trị text của tag."""
    el = find_tag_recursive(element, tag_name)
    if el is not None and el.text:
        return el.text.strip()
    return default


def parse_xml_invoice(xml_str: str) -> dict | None:
    """
    Phân tích cú pháp XML Hóa đơn Điện tử Việt Nam.
    Trả về dict chứa dữ liệu chuẩn hóa của hóa đơn hoặc None nếu không hợp lệ.
    """
    try:
        # Xử lý BOM UTF-8 nếu có
        if xml_str.startswith("\ufeff"):
            xml_str = xml_str[1:]

        root = ET.fromstring(xml_str.encode("utf-8"))

        clean_root = get_clean_tag(root).lower()
        # Xác thực xem có phải file XML hóa đơn không
        if clean_root not in ("hdon", "invoice", "hoadon", "dieu_le_hdon", "dulieuhdon"):
            dl_hdon = find_tag_recursive(root, "dlhdon")
            if dl_hdon is None:
                if find_tag_recursive(root, "shdon") is None and find_tag_recursive(root, "invoiceno") is None:
                    logger.warning("File XML không đúng định dạng hóa đơn điện tử: %s", root.tag)
                    return None

        # 1. Thông tin chung
        so_hoa_don = get_tag_value(root, "shdon") or get_tag_value(root, "invoiceno")
        # Format số hóa đơn thành 8 chữ số dạng chuỗi (vd: "00001234")
        if so_hoa_don and so_hoa_don.isdigit():
            so_hoa_don = so_hoa_don.zfill(8)

        ky_hieu = get_tag_value(root, "khhdtu") or get_tag_value(root, "serial") or get_tag_value(root, "khieu")
        mau_so = get_tag_value(root, "mthdon") or get_tag_value(root, "templatecode") or get_tag_value(root, "mauso")

        ngay_lap_str = get_tag_value(root, "nlap") or get_tag_value(root, "invoicedate") or get_tag_value(root, "ngay")
        ngay_hoa_don = None
        if ngay_lap_str:
            ngay_lap_str = ngay_lap_str.split("T")[0]  # Cắt bỏ phần giờ
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y%m%d"):
                try:
                    ngay_hoa_don = datetime.strptime(ngay_lap_str, fmt).date()
                    break
                except ValueError:
                    continue
        if not ngay_hoa_don:
            ngay_hoa_don = date.today()

        # 2. Thông tin người bán (NBan)
        nban = find_tag_recursive(root, "nban") or find_tag_recursive(root, "seller")
        supplier_name = ""
        supplier_tax_code = ""
        if nban is not None:
            supplier_name = get_tag_value(nban, "ten") or get_tag_value(nban, "sellername") or get_tag_value(nban, "tendv")
            supplier_tax_code = get_tag_value(nban, "mst") or get_tag_value(nban, "sellertaxcode")
        else:
            supplier_name = get_tag_value(root, "tendvban")
            supplier_tax_code = get_tag_value(root, "mstban")

        # 3. Thông tin người mua (NMua)
        nmua = find_tag_recursive(root, "nmua") or find_tag_recursive(root, "buyer")
        buyer_name = ""
        buyer_tax_code = ""
        if nmua is not None:
            buyer_name = get_tag_value(nmua, "ten") or get_tag_value(nmua, "buyername") or get_tag_value(nmua, "tendv")
            buyer_tax_code = get_tag_value(nmua, "mst") or get_tag_value(nmua, "buyertaxcode")
        else:
            buyer_name = get_tag_value(root, "tendvmua")
            buyer_tax_code = get_tag_value(root, "mstmua")

        # 4. Thông tin tổng hợp thanh toán (TToan)
        ttoan = find_tag_recursive(root, "ttoan") or find_tag_recursive(root, "total")
        tong_tien_hang = Decimal("0")
        tien_thue = Decimal("0")
        tong_thanh_toan = Decimal("0")

        if ttoan is not None:
            tong_tien_hang = Decimal(get_tag_value(ttoan, "tgtcthue", "0") or get_tag_value(ttoan, "amountwithoutvat", "0") or "0")
            tien_thue = Decimal(get_tag_value(ttoan, "tgtthue", "0") or get_tag_value(ttoan, "vatamount", "0") or "0")
            tong_thanh_toan = Decimal(get_tag_value(ttoan, "tgtttbso", "0") or get_tag_value(ttoan, "totalamount", "0") or "0")
        else:
            tong_tien_hang = Decimal(get_tag_value(root, "tgtcthue", "0") or "0")
            tien_thue = Decimal(get_tag_value(root, "tgtthue", "0") or "0")
            tong_thanh_toan = Decimal(get_tag_value(root, "tgtttbso", "0") or "0")

        # 5. Thông tin chi tiết hàng hóa (HHDVu)
        items = []
        dshhdvu = find_all_tags_recursive(root, "hhdvu") or find_all_tags_recursive(root, "invoiceline") or find_all_tags_recursive(root, "item")

        for idx, it_el in enumerate(dshhdvu, 1):
            ten_hang = get_tag_value(it_el, "thang") or get_tag_value(it_el, "itemname") or get_tag_value(it_el, "ten")
            if not ten_hang:
                continue

            ma_hang = get_tag_value(it_el, "mhang") or get_tag_value(it_el, "itemcode") or get_tag_value(it_el, "ma")
            dvt = get_tag_value(it_el, "dvt") or get_tag_value(it_el, "unit") or "Kg"

            so_luong_str = get_tag_value(it_el, "sluong") or get_tag_value(it_el, "quantity") or "0"
            don_gia_str = get_tag_value(it_el, "dgia") or get_tag_value(it_el, "unitprice") or "0"
            thanh_tien_str = get_tag_value(it_el, "tte") or get_tag_value(it_el, "amount") or "0"
            thue_suat = get_tag_value(it_el, "tsuat") or get_tag_value(it_el, "vatrate") or "10%"

            so_luong = Decimal(so_luong_str or "0")
            don_gia = Decimal(don_gia_str or "0")
            thanh_tien = Decimal(thanh_tien_str or "0")

            if thanh_tien == 0 and so_luong > 0 and don_gia > 0:
                thanh_tien = so_luong * don_gia

            items.append({
                "stt": idx,
                "ma_hang": ma_hang,
                "ten_hang": ten_hang,
                "dvt": dvt,
                "so_luong": float(so_luong),
                "don_gia": float(don_gia),
                "thanh_tien": float(thanh_tien),
                "thue_suat": thue_suat
            })

        if not so_hoa_don:
            logger.warning("Không tìm thấy số hóa đơn trong file XML")
            return None

        return {
            "so_hoa_don": so_hoa_don,
            "mau_so": mau_so,
            "ky_hieu": ky_hieu,
            "ngay_hoa_don": ngay_hoa_don,
            "supplier_tax_code": supplier_tax_code,
            "supplier_name": supplier_name,
            "buyer_tax_code": buyer_tax_code,
            "buyer_name": buyer_name,
            "tong_tien_hang": float(tong_tien_hang),
            "tien_thue": float(tien_thue),
            "tong_thanh_toan": float(tong_thanh_toan),
            "items": items
        }
    except Exception as e:
        logger.error("Lỗi parse XML hóa đơn đầu vào: %s", e, exc_info=True)
        return None
