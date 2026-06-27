import dayjs from 'dayjs'
import type { HoaDonDienTu, HoaDonItem } from '../api/hoaDonDienTu'
import type { PrintCompanyInfo } from './exportUtils'

// ── Số thành chữ tiếng Việt ────────────────────────────────────
const DONVI = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
const HANG  = ['', 'mười', 'trăm', 'nghìn', '', '', 'triệu', '', '', 'tỷ']

function docNhom(n: number): string {
  const tram = Math.floor(n / 100)
  const chuc = Math.floor((n % 100) / 10)
  const dv   = n % 10
  let s = ''
  if (tram) s += DONVI[tram] + ' trăm'
  if (chuc === 0 && dv === 0) return s.trim()
  if (chuc === 0) { s += (tram ? ' lẻ ' : '') + DONVI[dv]; return s.trim() }
  if (chuc === 1) s += (s ? ' ' : '') + 'mười'
  else            s += (s ? ' ' : '') + DONVI[chuc] + ' mươi'
  if (dv === 1 && chuc > 1) s += ' mốt'
  else if (dv === 5 && chuc > 0) s += ' lăm'
  else if (dv) s += ' ' + DONVI[dv]
  return s.trim()
}

export function soThanhChu(so: number): string {
  if (!so) return 'Không đồng chẵn'
  const n = Math.round(Math.abs(so))
  const ty  = Math.floor(n / 1_000_000_000)
  const tr  = Math.floor((n % 1_000_000_000) / 1_000_000)
  const ng  = Math.floor((n % 1_000_000) / 1_000)
  const dv  = n % 1_000
  const parts: string[] = []
  if (ty)  parts.push(docNhom(ty)  + ' tỷ')
  if (tr)  parts.push(docNhom(tr)  + ' triệu')
  if (ng)  parts.push(docNhom(ng)  + ' nghìn')
  if (dv)  parts.push(docNhom(dv))
  const result = parts.join(' ').trim()
  return result.charAt(0).toUpperCase() + result.slice(1) + ' đồng chẵn'
}

// ── Helper ─────────────────────────────────────────────────────
const fmt = (v: number | null | undefined) =>
  v != null ? Number(v).toLocaleString('vi-VN') : '—'

function ngayStr(iso: string) {
  const d = new Date(iso)
  return `Ngày (Date) ${d.getDate()} tháng (month) ${d.getMonth() + 1} năm (year) ${d.getFullYear()}`
}

// ── Hàm print chính ───────────────────────────────────────────
export function printHoaDonDienTu(hdt: HoaDonDienTu, company?: PrintCompanyInfo) {
  const phapNhan = company
  const isDraft = hdt.trang_thai === 'nhap' || hdt.trang_thai === 'cho_ky'
  const items: HoaDonItem[] = hdt.items ?? []
  const loaiLabel = ({ '1': 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG', '2': 'HÓA ĐƠN BÁN HÀNG', '7': 'PHIẾU XUẤT KHO' } as Record<string, string>)[hdt.loai_hd] ?? 'HÓA ĐƠN'
  const loaiEn    = ({ '1': '(VAT INVOICE)', '2': '(SALES INVOICE)', '7': '(DELIVERY NOTE)' } as Record<string, string>)[hdt.loai_hd] ?? ''

  const logoSrc = phapNhan?.logo ?? ''

  const itemRows = items.map((it, i) => `
    <tr>
      <td class="center">${i + 1}</td>
      <td>${it.ten_hang ?? ''}</td>
      <td class="center">${it.don_vi ?? ''}</td>
      <td class="right">${fmt(it.so_luong)}</td>
      <td class="right">${fmt(it.don_gia)}</td>
      <td class="right">${fmt(it.thanh_tien)}</td>
    </tr>`).join('')

  // thêm dòng trống để bảng đủ chiều
  const emptyRows = Array.from({ length: Math.max(0, 5 - items.length) })
    .map(() => `<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>`).join('')

  const tienThue = Number(hdt.tien_thue_gtgt ?? 0)
  const tongHang = Number(hdt.tong_tien_hang ?? 0)
  const tongCong = Number(hdt.tong_cong ?? 0)

  // tính thuế suất hiển thị từ items (lấy thue_suat đầu tiên) hoặc suy ngược
  const thueSuat = items[0]?.thue_suat ?? (tongHang > 0 ? `${Math.round(tienThue / tongHang * 100)}%` : '10%')

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8"/>
<title>${loaiLabel}${hdt.so_hoa_don ? ' ' + hdt.so_hoa_don : ' — Nháp'}</title>
<style>
  @page { size: A4 portrait; margin: 10mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', serif; font-size: 10pt; color: #000; position: relative; }

  .no-print { margin-bottom: 10px; }
  @media print { .no-print { display: none; } }

  /* Watermark */
  .watermark {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 80pt; font-weight: bold; color: rgba(255,140,0,0.10);
    pointer-events: none; white-space: nowrap; z-index: 0;
    font-family: 'Times New Roman', serif; letter-spacing: 8px;
  }
  .content { position: relative; z-index: 1; }

  /* Header */
  .hd-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
  .company-block { width: 45%; }
  .company-block img { height: 48px; margin-bottom: 4px; }
  .company-name { font-size: 10.5pt; font-weight: bold; color: #b22222; line-height: 1.4; }
  .company-info { font-size: 8.5pt; line-height: 1.5; color: #333; }
  .invoice-title-block { text-align: center; flex: 1; padding: 0 8px; }
  .invoice-title-block h1 { font-size: 15pt; font-weight: bold; letter-spacing: 1px; line-height: 1.3; }
  .invoice-title-block .en { font-style: italic; font-size: 10pt; color: #444; }
  .invoice-meta { text-align: right; font-size: 9pt; min-width: 130px; }
  .invoice-meta .meta-row { margin-bottom: 3px; }
  .invoice-meta .meta-label { color: #666; }
  .invoice-meta .meta-val { font-weight: bold; font-size: 11pt; }

  /* Date / CQT */
  .date-line { text-align: center; font-size: 9.5pt; margin: 4px 0; font-style: italic; }
  .cqt-line  { text-align: center; font-size: 8.5pt; color: #555; margin-bottom: 6px; }

  /* Seller / Buyer */
  .party-block { font-size: 9.5pt; line-height: 1.7; margin: 3px 0; }
  .party-block .company-big { font-size: 12pt; font-weight: bold; text-transform: uppercase; }
  .party-block .row { display: flex; }
  .party-block .lbl { min-width: 155px; font-style: italic; color: #444; flex-shrink: 0; }

  /* Items table */
  table.items { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 9pt; }
  table.items th {
    background: #fff; border: 1px solid #333;
    padding: 4px 5px; text-align: center; font-weight: bold; font-size: 8.5pt;
  }
  table.items td { border: 1px solid #555; padding: 3px 5px; vertical-align: top; min-height: 20px; }
  table.items .center { text-align: center; }
  table.items .right  { text-align: right; }

  /* Totals */
  .totals { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  .totals td { padding: 3px 5px; }
  .totals .lbl { color: #333; font-style: italic; }
  .totals .val { text-align: right; font-weight: bold; border-bottom: 1px solid #ccc; min-width: 110px; }
  .totals .total-row td { font-weight: bold; font-size: 10pt; }

  .chu { font-style: italic; font-size: 9pt; margin: 5px 0; }
  .chu span { font-weight: bold; }

  /* Signatures */
  .sig-table { width: 100%; border-collapse: collapse; margin-top: 14px; }
  .sig-table td { text-align: center; vertical-align: top; padding: 0 4px; font-size: 9pt; width: 50%; }
  .sig-table .sig-title { font-weight: bold; font-size: 9.5pt; }
  .sig-table .sig-sub   { font-style: italic; color: #555; font-size: 8.5pt; }
  .sig-table .sig-name  { margin-top: 36px; font-weight: bold; }

  /* Draft stamp */
  .draft-stamp {
    display: inline-block; border: 3px solid #c00; color: #c00;
    padding: 2px 14px; font-size: 22pt; font-weight: bold; letter-spacing: 4px;
    transform: rotate(-15deg); opacity: 0.55; margin: 8px 0;
  }

  /* MISA footer */
  .misa-footer { font-size: 7.5pt; color: #555; margin-top: 10px; border-top: 1px solid #ddd; padding-top: 4px; text-align: center; }
</style>
</head>
<body>
<div class="no-print">
  <button onclick="window.print()" style="padding:6px 20px;cursor:pointer;font-size:13px;">🖨 In hóa đơn</button>
</div>

<div class="watermark">NAM PHƯƠNG</div>

<div class="content">
  <!-- Header -->
  <div class="hd-header">
    <div class="company-block">
      ${logoSrc ? `<img src="${logoSrc}" alt="logo"/>` : ''}
      <div class="company-name">${phapNhan?.ten ?? 'CÔNG TY TNHH SẢN XUẤT THƯƠNG MẠI NAM PHƯƠNG'}</div>
      <div class="company-info">
        Mã số thuế <i>(Tax code)</i>: <b>${phapNhan?.ma_so_thue ?? ''}</b><br/>
        Địa chỉ <i>(Address)</i>: ${phapNhan?.dia_chi ?? ''}<br/>
        Điện thoại <i>(Tel)</i>: ${phapNhan?.so_dien_thoai ?? ''}<br/>
        Số tài khoản <i>(Bank account)</i>: ${phapNhan?.tai_khoan ?? ''} ${phapNhan?.ngan_hang ? '• ' + phapNhan.ngan_hang : ''}
      </div>
    </div>

    <div class="invoice-title-block">
      <h1>${loaiLabel}</h1>
      <div class="en">${loaiEn}</div>
      ${isDraft ? `<div style="margin-top:6px"><span class="draft-stamp">NHÁP</span></div>` : ''}
    </div>

    <div class="invoice-meta">
      <div class="meta-row"><span class="meta-label">Ký hiệu <i>(Serial)</i>: </span><b>${hdt.ky_hieu ?? (isDraft ? '---' : '')}</b></div>
      <div class="meta-row"><span class="meta-label">Số <i>(No.)</i>: </span>
        <span class="meta-val">${hdt.so_hoa_don ?? (isDraft ? '<span style="color:#c00">NHÁP</span>' : '---')}</span>
      </div>
    </div>
  </div>

  <div class="date-line">${ngayStr(hdt.ngay_lap)}</div>
  ${hdt.ma_cqt ? `<div class="cqt-line">Mã CQT <i>(Code)</i>: <b>${hdt.ma_cqt}</b></div>` : ''}

  <hr style="border:1.5px solid #333; margin: 4px 0;"/>

  <!-- Seller -->
  <div class="party-block">
    <div class="company-big">${phapNhan?.ten ?? 'CÔNG TY TNHH SẢN XUẤT THƯƠNG MẠI NAM PHƯƠNG'}</div>
    <div class="row"><span class="lbl">Mã số thuế <i>(Tax code)</i>:</span> <b>${phapNhan?.ma_so_thue ?? ''}</b></div>
    <div class="row"><span class="lbl">Địa chỉ <i>(Address)</i>:</span> ${phapNhan?.dia_chi ?? ''}</div>
    <div class="row"><span class="lbl">Điện thoại <i>(Tel)</i>:</span> ${phapNhan?.so_dien_thoai ?? ''}</div>
    <div class="row"><span class="lbl">Số tài khoản <i>(Bank account)</i>:</span> ${phapNhan?.tai_khoan ?? ''} ${phapNhan?.ngan_hang ? '• ' + phapNhan.ngan_hang : ''}</div>
  </div>

  <div style="margin: 4px 0; font-size:9.5pt; font-style:italic;">Họ tên người mua hàng <i>(Buyer):</i></div>

  <!-- Buyer -->
  <div class="party-block">
    <div class="row"><span class="lbl">Tên đơn vị <i>(Company's name)</i>:</span> <b>${hdt.ten_khach_hang}</b></div>
    <div class="row"><span class="lbl">Mã số thuế <i>(Tax code)</i>:</span> ${hdt.ma_so_thue_kh ?? ''}</div>
    <div class="row"><span class="lbl">Địa chỉ <i>(Address)</i>:</span> ${hdt.dia_chi_kh ?? ''}</div>
    <div style="display:flex; gap:40px;">
      <div class="row"><span class="lbl">Hình thức thanh toán <i>(Payment method)</i>:</span> TM/CK</div>
      <div class="row"><span class="lbl">Số tài khoản <i>(Bank account)</i>:</span></div>
    </div>
  </div>

  <!-- Items -->
  <table class="items">
    <thead>
      <tr>
        <th style="width:30px">STT<br/><i>(No)</i></th>
        <th>Tên hàng hóa, dịch vụ<br/><i>(Name of goods and services)</i></th>
        <th style="width:55px">Đơn vị tính<br/><i>(Unit)</i></th>
        <th style="width:65px">Số lượng<br/><i>(Quantity)</i></th>
        <th style="width:80px">Đơn giá<br/><i>(Unit price)</i></th>
        <th style="width:90px">Thành tiền<br/><i>(Amount)</i></th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      ${emptyRows}
    </tbody>
  </table>

  <!-- Totals -->
  <table class="totals">
    <tr>
      <td class="lbl" colspan="3"></td>
      <td style="text-align:right;font-style:italic;font-size:9pt;">Cộng tiền hàng <i>(Total amount excl. VAT)</i>:</td>
      <td class="val">${fmt(tongHang)}</td>
    </tr>
    <tr>
      <td class="lbl" style="width:120px">Thuế suất GTGT <i>(VAT rate)</i>: <b>${thueSuat}</b></td>
      <td colspan="2"></td>
      <td style="text-align:right;font-style:italic;font-size:9pt;">Tiền thuế GTGT <i>(VAT amount)</i>:</td>
      <td class="val">${fmt(tienThue)}</td>
    </tr>
    <tr class="total-row">
      <td colspan="3"></td>
      <td style="text-align:right;font-style:italic;">Tổng tiền thanh toán <i>(Total amount)</i>:</td>
      <td class="val" style="font-size:11pt;">${fmt(tongCong)}</td>
    </tr>
  </table>

  <div class="chu">
    Số tiền viết bằng chữ <i>(Total amount in words)</i>: <span>${soThanhChu(tongCong)}</span>
  </div>

  ${hdt.ghi_chu ? `<div style="font-size:9pt;margin:4px 0;font-style:italic;">Ghi chú: ${hdt.ghi_chu}</div>` : ''}

  <!-- Signatures -->
  <table class="sig-table">
    <tr>
      <td>
        <div class="sig-title">Người mua hàng <i>(Buyer)</i></div>
        <div class="sig-sub">(Chữ ký số nếu có)<br/><i>(Digital signature if any)</i></div>
        <div class="sig-name"></div>
      </td>
      <td>
        <div class="sig-title">Người bán hàng <i>(Seller)</i></div>
        <div class="sig-sub">(Ký điện tử, Chữ ký số)<br/><i>(E-signature, Digital signature)</i></div>
        ${!isDraft && hdt.so_hoa_don ? `
        <div style="margin-top:8px;border:2px solid #2e7d32;padding:6px 10px;display:inline-block;text-align:left;font-size:8.5pt;color:#2e7d32;">
          <b>Signature Valid</b><br/>
          Ký bởi <i>(Signed By)</i>: <b>${phapNhan?.ten ?? ''}</b><br/>
          Ký ngày <i>(Signing Date)</i>: ${dayjs(hdt.ngay_lap).format('DD/MM/YYYY')}
        </div>` : '<div class="sig-name"></div>'}
      </td>
    </tr>
  </table>

  <div class="misa-footer">
    Phát hành bởi phần mềm MISA meInvoice — Công ty Cổ phần MISA (www.misa.vn) • MST 0101243150
  </div>
</div>
</body>
</html>`

  const w = window.open('', '_blank', 'width=820,height=1160')
  if (w) { w.document.write(html); w.document.close() }
}
