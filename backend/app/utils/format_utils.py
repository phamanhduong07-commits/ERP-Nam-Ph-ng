"""Định dạng dữ liệu dùng chung cho phiếu in (số tiền bằng chữ, ngày tháng)."""


def so_thanh_chu(n: float) -> str:
    """Chuyển số tiền VNĐ sang chữ tiếng Việt."""
    n = int(round(n))
    if n == 0:
        return "Không đồng"

    don_vi = ["", "nghìn", "triệu", "tỷ"]
    chu_so = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"]

    def doc_ba_chu_so(num: int, is_first: bool) -> str:
        tram = num // 100
        chuc = (num % 100) // 10
        dv = num % 10
        result = ""
        if tram > 0:
            result += chu_so[tram] + " trăm "
        elif not is_first:
            result += "không trăm "
        if chuc == 0 and dv == 0:
            return result.strip()
        if chuc == 0:
            if result:
                result += "lẻ " + chu_so[dv]
            else:
                result += chu_so[dv]
        elif chuc == 1:
            result += "mười "
            if dv == 5:
                result += "lăm"
            elif dv > 0:
                result += chu_so[dv]
        else:
            result += chu_so[chuc] + " mươi "
            if dv == 1:
                result += "mốt"
            elif dv == 5:
                result += "lăm"
            elif dv > 0:
                result += chu_so[dv]
        return result.strip()

    parts = []
    idx = 0
    while n > 0:
        nhom = n % 1000
        if nhom != 0:
            txt = doc_ba_chu_so(nhom, idx == 0 and n < 1000)
            if don_vi[idx]:
                txt += " " + don_vi[idx]
            parts.append(txt)
        n //= 1000
        idx += 1

    result = ", ".join(reversed(parts))
    return result.capitalize() + " đồng"


def ngay_str(d) -> str:
    """Định dạng ngày kiểu tiếng Việt: Ngày DD tháng MM năm YYYY."""
    if not d:
        return ""
    s = str(d)
    parts = s.split("-")
    if len(parts) == 3:
        return f"Ngày {parts[2]} tháng {parts[1]} năm {parts[0]}"
    return s
