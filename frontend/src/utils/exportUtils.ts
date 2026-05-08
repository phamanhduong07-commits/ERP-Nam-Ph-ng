import * as XLSX from 'xlsx'
import QRCode from 'qrcode'

import { saveAs } from 'file-saver'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExcelSheet = {
  name: string
  headers: string[]
  rows: (string | number | null | undefined)[][]
  colWidths?: number[]   // character widths per column
}

// ─── Excel Export ─────────────────────────────────────────────────────────────

/** Build an .xlsx file with one or more sheets and trigger browser download */
export function exportToExcel(filename: string, sheets: ExcelSheet[]) {
  const wb = XLSX.utils.book_new()
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet([sheet.headers, ...sheet.rows])
    // Column widths
    const widths = sheet.colWidths ?? sheet.headers.map(h => Math.max(h.length + 4, 12))
    ws['!cols'] = widths.map(w => ({ wch: w }))
    // Bold header row
    const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c })]
      if (cell) cell.s = { font: { bold: true }, fill: { fgColor: { rgb: 'DCE6F1' } } }
    }
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31))
  }
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), `${filename}.xlsx`)
}

// ─── PDF (print-window) Export ────────────────────────────────────────────────

/**
 * Opens a new window with the provided HTML content and triggers print dialog.
 * The user saves as PDF from the browser's print dialog.
 * This approach gives perfect Vietnamese text rendering.
 */
export function printToPdf(title: string, html: string, landscape = false) {
  const win = window.open('', '_blank', 'width=1050,height=780')
  if (!win) {
    alert('Vui lòng cho phép popup để xuất PDF')
    return
  }
  win.document.write(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, 'Helvetica Neue', sans-serif; font-size: 11px; color: #222; padding: 10mm; }
    h2  { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
    .meta { font-size: 10px; color: #666; margin-bottom: 10px; }
    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px 16px; margin-bottom: 10px; font-size: 10px; border: 1px solid #ddd; padding: 6px; border-radius: 3px; }
    .info-label { color: #888; font-size: 9px; }
    .info-value { font-weight: 600; }
    .doc-panel { border: 1px solid #ddd; border-radius: 10px; padding: 18px; }
    .doc-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; border-bottom: 2px solid #1b168e; padding-bottom: 10px; }
    .doc-brand { flex: 0 0 100px; }
    .doc-brand img { max-height: 75px; max-width: 100px; object-fit: contain; }
    .doc-title-block { flex: 1; padding: 0 20px; }
    .company-name { font-size: 14px; font-weight: 700; color: #1b168e; text-transform: uppercase; margin-bottom: 4px; }
    .co-details .co-line { font-size: 10px; color: #333; margin-top: 2px; line-height: 1.3; }
    .document-type { font-size: 22px; font-weight: 700; color: #d32f2f; margin-top: 8px; text-transform: uppercase; }
    .doc-meta { flex: 0 0 160px; text-align: right; font-size: 11px; }
    .meta-row { margin-bottom: 4px; }
    .meta-label { color: #555; margin-right: 4px; }
    .doc-info { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 20px; }
    .doc-body { margin-bottom: 20px; font-size: 12px; line-height: 1.5; }
    .doc-footer { padding: 12px; background: #fff7e6; border-left: 4px solid #ff8200; border-radius: 6px; margin-bottom: 20px; font-size: 12px; }
    .signature-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 24px; }
    .signature-box { min-height: 90px; padding-top: 6px; border-top: 1px dashed #999; color: #555; font-size: 12px; }
    .sign-name { font-weight: 700; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; page-break-inside: auto; }
    thead { background: #1b168e; color: #fff; display: table-header-group; }
    th { padding: 4px 5px; font-size: 9px; font-weight: 700; text-align: left; white-space: nowrap; }
    td { padding: 3px 5px; font-size: 9px; border-bottom: 1px solid #eee; vertical-align: top; }
    tr:nth-child(even) td { background: #f9f9f9; }
    .right { text-align: right; }
    .center { text-align: center; }
    .total-row td { font-weight: 700; background: #e6f4ff !important; border-top: 2px solid #1b168e; }
    .footer-row td { font-weight: 600; background: #fffbe6 !important; border-top: 2px solid #ff8200; font-style: italic; }
    .summary-box { margin-top: 12px; border: 1px solid #ddd; padding: 8px; border-radius: 3px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
    .summary-item .s-label { font-size: 9px; color: #888; }
    .summary-item .s-value { font-size: 13px; font-weight: 700; }
    @page { size: ${landscape ? 'A4 landscape' : 'A4 portrait'}; margin: 12mm; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  ${html}
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() { window.print(); }, 400);
    });
  <\/script>
</body>
</html>`)
  win.document.close()
}

export type PrintDocumentField = { label: string; value: string }

export interface PrintCompanyInfo {
  ten: string
  dia_chi?: string | null
  ma_so_thue?: string | null
  so_dien_thoai?: string | null
  tai_khoan?: string | null
  ngan_hang?: string | null
}

export interface PrintDocumentOptions {
  title: string
  subtitle?: string
  logoUrl?: string
  /** @deprecated dùng companyInfo thay thế */
  companyName?: string
  companyInfo?: PrintCompanyInfo
  documentNumber?: string
  documentDate?: string
  status?: string
  fields?: PrintDocumentField[]
  bodyHtml: string
  footerHtml?: string
}

// ─── Company Configurations ───────────────────────────────────────────────────

export const COMPANY_CONFIGS: Record<string, PrintCompanyInfo & { logo?: string }> = {
  "CÔNG TY TNHH SX TM NAM PHƯƠNG": {
    ten: "CÔNG TY TNHH SX TM NAM PHƯƠNG",
    dia_chi: "12/2 Ấp 2, Xã Xuân Thới Sơn, Thành phố Hồ Chí Minh, Việt Nam.",
    so_dien_thoai: "0903.113.638",
    tai_khoan: "Email: banhang.namphuong@gmail.com", // Dùng trường này để hiển thị email hoặc hotline linh hoạt
  },
  "CÔNG TY TNHH SX TM NAM PHƯƠNG L.A": {
    ten: "CÔNG TY TNHH SX TM NAM PHƯƠNG L.A",
    dia_chi: "Lô Q3, Đường N11 và Lô Q18, đường N9, Khu Công Nghiệp Nam Thuận, Xã Mỹ Hạnh, Tỉnh Tây Ninh, Việt Nam.",
    so_dien_thoai: "0909.969.559",
    tai_khoan: "Email: namphuongbaobi@gmail.com",
  },
  "CÔNG TY TNHH BAO BÌ VISUNPACK": {
    ten: "CÔNG TY TNHH BAO BÌ VISUNPACK",
    dia_chi: "96 Tỉnh Lộ 15, Ấp 11A, Xã Phú Hòa Đông, Thành phố Hồ Chí Minh, Việt Nam.",
    so_dien_thoai: "0377.959.323",
    tai_khoan: "Email: visunpack@gmail.com",
  }
}

export function buildDocumentHtml(opts: PrintDocumentOptions): string {
  const fieldsHtml = opts.fields?.map(field => `
      <div class="info-row">
        <div class="info-label">${field.label}</div>
        <div class="info-value">${field.value}</div>
      </div>
    `).join('') ?? ''

  let co = opts.companyInfo
  const coName = co?.ten ?? opts.companyName ?? 'CÔNG TY TNHH SX TM NAM PHƯƠNG'
  
  // Tự động lấy config chuẩn từ tên nếu không truyền companyInfo đầy đủ
  const config = COMPANY_CONFIGS[coName]
  if (config && !co?.dia_chi) {
    co = { ...config, ...co } // Gộp thông tin mặc định với thông tin từ DB (nếu có)
  }

  const coLines = [
    co?.dia_chi ? `<div class="co-line">Địa chỉ: ${co.dia_chi}</div>` : '',
    co?.so_dien_thoai ? `<div class="co-line">Hotline: ${co.so_dien_thoai}</div>` : '',
    co?.tai_khoan && co.tai_khoan.includes('@') ? `<div class="co-line">Email: ${co.tai_khoan}</div>` : '',
    (co?.tai_khoan && !co.tai_khoan.includes('@')) ? `<div class="co-line">Số TK: <b>${co.tai_khoan}</b> ${co.ngan_hang ? ' — ' + co.ngan_hang : ''}</div>` : '',
    co?.ma_so_thue ? `<div class="co-line">MST: ${co.ma_so_thue}</div>` : '',
  ].filter(Boolean).join('')

  const logoSrc = opts.logoUrl || (coName.includes('VISUNPACK') ? '/logo_visunpack.png' : '/logo_namphuong.png')

  return `
    <div class="doc-panel">
      <div class="doc-head" style="border-bottom: 2px solid #1b168e; padding-bottom: 10px; margin-bottom: 15px;">
        <div class="doc-brand" style="flex: 0 0 100px;">
          ${logoSrc ? `<img src="${logoSrc}" alt="Logo" style="max-height: 70px; object-fit: contain;" />` : ''}
        </div>
        <div class="doc-title-block" style="flex: 1; padding-left: 15px;">
          <div class="company-name" style="font-size: 14px; color: #1b168e;">${coName}</div>
          ${coLines ? `<div class="co-details" style="font-size: 10px; line-height: 1.4;">${coLines}</div>` : ''}
          <div class="document-type" style="margin-top: 10px; font-size: 18px; color: #d32f2f;">${opts.subtitle ?? opts.title}</div>
        </div>
        <div class="doc-meta" style="flex: 0 0 150px; text-align: right; font-size: 10px;">
          ${opts.documentNumber ? `<div class="meta-row"><span class="meta-label">Số:</span> <b>${opts.documentNumber}</b></div>` : ''}
          ${opts.documentDate ? `<div class="meta-row"><span class="meta-label">Ngày:</span> ${opts.documentDate}</div>` : ''}
          ${opts.status ? `<div class="meta-row"><span class="meta-label">Trạng thái:</span> ${opts.status}</div>` : ''}
        </div>
      </div>
      ${fieldsHtml ? `<div class="doc-info">${fieldsHtml}</div>` : ''}
      <div class="doc-body">${opts.bodyHtml}</div>
      ${opts.footerHtml ? `<div class="doc-footer">${opts.footerHtml}</div>` : ''}
      <div class="signature-grid">
        <div class="signature-box">
          <div class="sign-name">Người lập</div>
          <div class="sign-line"></div>
        </div>
        <div class="signature-box">
          <div class="sign-name">Người duyệt</div>
          <div class="sign-line"></div>
        </div>
        <div class="signature-box">
          <div class="sign-name">Kế toán</div>
          <div class="sign-line"></div>
        </div>
      </div>
    </div>
  `
}

export function printDocument(opts: PrintDocumentOptions, landscape = false) {
  const html = buildDocumentHtml(opts)
  printToPdf(opts.title, html, landscape)
}

// ─── Formatting Helpers ───────────────────────────────────────────────────────

export const fmtVND = (v: number | null | undefined): string =>
  v != null ? new Intl.NumberFormat('vi-VN').format(Math.round(Number(v))) : '—'

export const fmtDate = (v: string | null | undefined): string => {
  if (!v) return '—'
  const d = new Date(v)
  if (isNaN(d.getTime())) return v
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export const fmtNum = (v: number | null | undefined): string =>
  v != null ? new Intl.NumberFormat('vi-VN').format(Number(v)) : '—'

/** Format số đo (cm, mm...) — bỏ trailing zeros: 170.00→170  20.10→20.1  85.50→85.5 */
export const fmtDim = (v: number | string | null | undefined): string => {
  if (v == null || v === '') return ''
  const n = Number(v)
  if (isNaN(n)) return String(v)
  return parseFloat(n.toFixed(4)).toString()
}

/**
 * Smart number — bỏ trailing zeros sau dấu thập phân.
 * 140.00 → "140"   |   191.50 → "191,5"   |   0.25 → "0,25"
 * @param v          Giá trị cần format
 * @param maxDec     Số chữ số thập phân tối đa (mặc định 4)
 * @param locale     Locale (mặc định vi-VN: dấu phẩy thập phân, chấm nghìn)
 */
export function fmtN(
  v: number | string | null | undefined,
  maxDec = 4,
  locale = 'vi-VN',
): string {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (isNaN(n)) return String(v)
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDec,
  }).format(n)
}

// ─── HTML Table Builder ───────────────────────────────────────────────────────

type ColDef = { header: string; align?: 'left' | 'right' | 'center' }

/** Build a plain HTML <table> from column definitions and data rows */
export function buildHtmlTable(
  cols: ColDef[],
  rows: (string | number | null | undefined)[][],
  opts?: { totalRow?: (string | number | null | undefined)[]; footerRows?: { label: string; cells: (string | number | null | undefined)[] }[] }
): string {
  const ths = cols.map(c => `<th>${c.header}</th>`).join('')
  const trs = rows.map(row => {
    const tds = row.map((cell, i) => {
      const cls = cols[i]?.align === 'right' ? ' class="right"' : cols[i]?.align === 'center' ? ' class="center"' : ''
      return `<td${cls}>${cell ?? '—'}</td>`
    }).join('')
    return `<tr>${tds}</tr>`
  }).join('\n')

  let totalHtml = ''
  if (opts?.totalRow) {
    const tds = opts.totalRow.map((cell, i) => {
      const cls = cols[i]?.align === 'right' ? ' class="right"' : cols[i]?.align === 'center' ? ' class="center"' : ''
      return `<td${cls}>${cell ?? ''}</td>`
    }).join('')
    totalHtml = `<tr class="total-row">${tds}</tr>`
  }

  return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}${totalHtml}</tbody></table>`
}

/**
 * In Tem nhận dạng sản phẩm (LSX)
 */
export async function printProductionTag(data: any) {
  const qrDataUrl = await QRCode.toDataURL(data.so_lenh || 'N/A', { margin: 1 })

  // 6 cột: C1=label, C2=value, C3=label, C4=value, C5=label/value, C6=QR(rows1-4)/value
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A5 portrait; margin: 5mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
    table { width: 100%; border-collapse: collapse; border: 2px solid #000; table-layout: fixed; }
    td { border: 1px solid #000; padding: 3px 5px; vertical-align: middle; word-break: break-word; }
    .hdr  { font-size: 26px; font-weight: bold; letter-spacing: 3px; text-align: center;
            background: #dcdcdc; padding: 7px 4px; }
    .lbl  { font-size: 9px; font-weight: bold; text-transform: uppercase; text-align: center;
            background: #f0f0f0; line-height: 1.4; color: #000; }
    .val  { font-size: 13px; }
    .vmd  { font-size: 15px; font-weight: bold; text-align: center; }
    .vlg  { font-size: 19px; font-weight: bold; text-align: center; }
    .vxl  { font-size: 22px; font-weight: bold; text-align: center; }
    .v2xl { font-size: 26px; font-weight: bold; text-align: center; }
    .qr   { text-align: center; vertical-align: middle; padding: 4px; }
    .qr img { width: 108px; height: 108px; display: block; margin: 0 auto 3px; }
    .qr-num { font-size: 10px; font-weight: bold; }
  </style>
</head>
<body>
<table>
  <colgroup>
    <col style="width:12%">
    <col style="width:17%">
    <col style="width:12%">
    <col style="width:17%">
    <col style="width:13%">
    <col style="width:29%">
  </colgroup>

  <!-- R1: Header + QR (rowspan=4) -->
  <tr>
    <td colspan="5" class="hdr">TEM NHẬN DẠNG</td>
    <td rowspan="4" class="qr">
      <img src="${qrDataUrl}">
      <div class="qr-num">${data.so_lenh || ''}</div>
    </td>
  </tr>

  <!-- R2: Khách hàng + Ngày giao về Củ Chi -->
  <tr>
    <td class="lbl" style="height:38px">KHÁCH<br>HÀNG</td>
    <td colspan="2" class="vxl">${data.ten_khach_hang || ''}</td>
    <td class="lbl">NGÀY GIAO<br>VỀ CỦ CHI</td>
    <td class="vmd">${data.ngay_giao_cu_chi || ''}</td>
  </tr>

  <!-- R3: Số ĐH + Loại/Sóng (rowspan=2) + song -->
  <tr>
    <td class="lbl">SỐ ĐH</td>
    <td class="val">${data.so_don_hang || ''}</td>
    <td rowspan="2" class="lbl">LOẠI /<br>SÓNG</td>
    <td rowspan="2" class="vlg">${data.loai_sp || ''}</td>
    <td class="vxl">${data.song || ''}</td>
  </tr>

  <!-- R4: Số PO KH -->
  <tr>
    <td class="lbl">SỐ PO KH</td>
    <td class="val">${data.so_po_kh || ''}</td>
    <td></td>
  </tr>

  <!-- R5: Xưởng SX + Cán sóng/lần + tiêu đề Cán màng / Chống thấm -->
  <tr>
    <td class="lbl">XƯỞNG<br>SX</td>
    <td class="vlg">${data.phan_xuong || 'Nam Phương'}</td>
    <td class="lbl">CÁN LẰN<br>(QCCL)</td>
    <td class="vmd" style="font-size:13px;line-height:1.6">${(data.qccl || '').split('+').join('<br>')}</td>
    <td class="lbl">Cán<br>màng</td>
    <td class="lbl">Chống<br>thấm</td>
  </tr>

  <!-- R6: NSX máy sóng + Ngày giao KH + giá trị Cán màng / Chống thấm -->
  <tr>
    <td class="lbl">NSX MÁY<br>SÓNG</td>
    <td class="val" style="text-align:center">${data.ngay_chay_song || ''}</td>
    <td class="lbl">NGÀY GIAO<br>CHO KH</td>
    <td class="vlg" style="font-size:20px">${data.ngay_giao_kh || ''}</td>
    <td class="val" style="text-align:center">${data.can_mang || 'Không'}</td>
    <td class="val" style="text-align:center">${data.chong_tham || 'Không'}</td>
  </tr>

  <!-- R7: Công đoạn SX -->
  <tr>
    <td class="lbl">CÔNG<br>ĐOẠN SX</td>
    <td colspan="3" class="vlg">${data.cong_doan || ''}</td>
    <td colspan="2" class="vmd">+ 0</td>
  </tr>

  <!-- R8: Tên sản phẩm -->
  <tr>
    <td class="lbl">TÊN SẢN<br>PHẨM</td>
    <td colspan="5" class="vxl" style="font-size:${
      (data.ten_san_pham || '').length > 60 ? 11 :
      (data.ten_san_pham || '').length > 40 ? 13 :
      (data.ten_san_pham || '').length > 25 ? 15 : 18
    }px;height:52px;line-height:1.4;white-space:normal;word-break:break-word">${data.ten_san_pham || ''}</td>
  </tr>

  <!-- R9: SL Tấm lớn -->
  <tr>
    <td class="lbl">SL TẤM<br>LỚN</td>
    <td colspan="5" class="vxl">${data.sl_tam_lon || ''}</td>
  </tr>

  <!-- R10: SL Tấm nhỏ -->
  <tr>
    <td class="lbl">SL TẤM<br>NHỎ</td>
    <td colspan="5" class="vxl">${data.sl_tam_nho || ''}</td>
  </tr>

  <!-- R11: SL Thùng -->
  <tr>
    <td class="lbl">SL THÙNG</td>
    <td colspan="5" class="v2xl" style="font-size:28px">${data.sl_thung || ''}</td>
  </tr>

  <!-- R12: Bộ phận -->
  <tr>
    <td class="lbl">BỘ PHẬN</td>
    <td colspan="5" class="vmd" style="height:32px">${data.bo_phan || ''}</td>
  </tr>

  <!-- R13: Ghi chú -->
  <tr>
    <td class="lbl">GHI CHÚ</td>
    <td colspan="5" class="val">${data.ghi_chu || ''}</td>
  </tr>
</table>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  setTimeout(() => win.print(), 500)
}


