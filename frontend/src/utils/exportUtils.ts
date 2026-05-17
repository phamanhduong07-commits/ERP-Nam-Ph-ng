import * as XLSX from 'xlsx'
import QRCode from 'qrcode'

import { saveAs } from 'file-saver'
import { systemApi } from '../api/system'
import { phapNhanApi } from '../api/phap_nhan'

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

/** 
 * Export data using a template configuration.
 * @param filename Name of the file
 * @param sheetName Name of the sheet
 * @param data Array of objects containing raw data
 * @param config Array of column configurations [{key, label, width}]
 */
export function exportExcelWithTemplate(filename: string, sheetName: string, data: any[], config: { key: string, label: string, width?: number }[]) {
  const headers = config.map(c => c.label)
  const rows = data.map(item => config.map(c => item[c.key]))
  const colWidths = config.map(c => c.width || 12)

  exportToExcel(filename, [{
    name: sheetName,
    headers,
    rows,
    colWidths
  }])
}

export function resolveSinglePhapNhanId(items: any[], keys: string[] = ['phap_nhan_id_for_print', 'phap_nhan_id']): number | null {
  const result = analyzeSinglePhapNhanId(items, keys)
  return result.ok ? result.phapNhanId : null
}

export type SinglePhapNhanResult =
  | { ok: true; phapNhanId: number }
  | { ok: false; reason: 'empty' | 'missing' | 'multiple'; ids: number[] }

export function analyzeSinglePhapNhanId(items: any[], keys: string[] = ['phap_nhan_id_for_print', 'phap_nhan_id']): SinglePhapNhanResult {
  if (!items.length) return { ok: false, reason: 'empty', ids: [] }
  const ids = new Set<number>()
  let missingCount = 0
  for (const item of items) {
    let found = false
    for (const key of keys) {
      const value = item?.[key]
      if (value != null) {
        ids.add(Number(value))
        found = true
        break
      }
    }
    if (!found) missingCount += 1
  }
  const values = Array.from(ids)
  if (values.length === 1 && missingCount === 0) return { ok: true, phapNhanId: values[0] }
  if (values.length > 1) return { ok: false, reason: 'multiple', ids: values }
  return { ok: false, reason: 'missing', ids: values }
}

export function singlePhapNhanError(result: SinglePhapNhanResult, label = 'du lieu'): string {
  if (result.ok) return ''
  if (result.reason === 'empty') return `Khong co ${label} de in/xuat.`
  if (result.reason === 'multiple') return `${label} dang co nhieu phap nhan (${result.ids.join(', ')}). Vui long loc ve mot phap nhan truoc khi in/xuat.`
  return `${label} chua co du phap nhan. Vui long cap nhat chung tu hoac loc theo phap nhan truoc khi in/xuat.`
}

type StrictTemplateOptions = {
  throwOnError?: boolean
  landscape?: boolean
}

/**
 * Smart Export Excel: Tự động lấy template từ DB và xuất dữ liệu.
 */
export async function smartExportExcel(
  ma_mau: string, 
  data: any[], 
  defaultConfig: { key: string, label: string, width?: number }[],
  filename?: string,
  phapNhanId?: number,
  options: StrictTemplateOptions = {},
) {
  let config: { key: string, label: string, width?: number }[] = []
  try {
    const tpl = await systemApi.getExcelTemplate(ma_mau, phapNhanId, true)
    if (tpl && tpl.column_config && tpl.column_config.length > 0) {
      config = tpl.column_config
    }
  } catch (e: any) {
    const detail = e?.response?.data?.detail || e?.message || `Không tìm thấy mẫu Excel ${ma_mau}`
    console.error(`[ExcelExport] ${detail}`, e)
    if (options.throwOnError) throw new Error(detail)
    alert(detail)
    return
  }

  if (!config.length) {
    const detail = `Mau Excel ${ma_mau} chua cau hinh cot. Vui long kiem tra cau hinh bieu mau.`
    if (options.throwOnError) throw new Error(detail)
    alert(detail)
    return
  }

  exportExcelWithTemplate(
    filename || `${ma_mau}_${new Date().getTime()}`,
    "Data",
    data,
    config
  )
}

// ─── PDF (print-window) Export ────────────────────────────────────────────────

/**
 * Opens a new window with the provided HTML content and triggers print dialog.
 * The user saves as PDF from the browser's print dialog.
 * This approach gives perfect Vietnamese text rendering.
 */
export function printToPdf(title: string, html: string, landscape = false, companyInfo?: PrintCompanyInfo) {
  const win = window.open('', '_blank', 'width=1050,height=780')
  if (!win) {
    alert('Vui lòng cho phép popup để xuất PDF')
    return
  }
  const theme = getPrintThemeVars(companyInfo)
  win.document.write(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
	    :root {
	      --primary: ${theme.primary};
	      --accent: ${theme.accent};
	      --footer-accent: ${theme.footer};
	    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, 'Helvetica Neue', sans-serif; font-size: 11px; color: #222; padding: 10mm; }
    h2  { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
    .meta { font-size: 10px; color: #666; margin-bottom: 10px; }
    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px 16px; margin-bottom: 10px; font-size: 10px; border: 1px solid #ddd; padding: 6px; border-radius: 3px; }
    .info-label { color: #888; font-size: 9px; }
    .info-value { font-weight: 600; }
    .doc-panel { border: 1px solid #ddd; border-radius: 10px; padding: 18px; }
    .doc-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; border-bottom: 2px solid var(--primary); padding-bottom: 10px; }
    .doc-brand { flex: 0 0 100px; }
    .doc-brand img { max-height: 75px; max-width: 100px; object-fit: contain; }
    .doc-title-block { flex: 1; padding: 0 20px; }
    .company-name { font-size: 14px; font-weight: 700; color: var(--primary); text-transform: uppercase; margin-bottom: 4px; }
    .co-details .co-line { font-size: 10px; color: #333; margin-top: 2px; line-height: 1.3; }
    .document-type { font-size: 22px; font-weight: 700; color: var(--accent); margin-top: 8px; text-transform: uppercase; }
    .doc-meta { flex: 0 0 160px; text-align: right; font-size: 11px; }
    .meta-row { margin-bottom: 4px; }
    .meta-label { color: #555; margin-right: 4px; }
    .doc-info { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 20px; }
    .doc-body { margin-bottom: 20px; font-size: 12px; line-height: 1.5; }
    .doc-footer { padding: 12px; background: #fff7e6; border-left: 4px solid var(--footer-accent); border-radius: 6px; margin-bottom: 20px; font-size: 12px; }
    .signature-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 24px; }
    .signature-box { min-height: 90px; padding-top: 6px; border-top: 1px dashed #999; color: #555; font-size: 12px; }
    .sign-name { font-weight: 700; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; page-break-inside: auto; }
    thead { background: var(--primary); color: #fff; display: table-header-group; }
    th { padding: 4px 5px; font-size: 9px; font-weight: 700; text-align: left; white-space: nowrap; }
    td { padding: 3px 5px; font-size: 9px; border-bottom: 1px solid #eee; vertical-align: top; }
    tr:nth-child(even) td { background: #f9f9f9; }
    .right { text-align: right; }
    .center { text-align: center; }
    .total-row td { font-weight: 700; background: #e6f4ff !important; border-top: 2px solid var(--primary); }
    .footer-row td { font-weight: 600; background: #fffbe6 !important; border-top: 2px solid var(--footer-accent); font-style: italic; }
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
  logo?: string
  primary_color?: string
  accent_color?: string
  footer_accent_color?: string
}

export function getPrintThemeVars(companyInfo?: PrintCompanyInfo) {
  const primary = companyInfo?.primary_color || "#1b168e"
  const accent = companyInfo?.accent_color || "#d32f2f"
  const footer = companyInfo?.footer_accent_color || accent
  return { primary, accent, footer }
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
  customHtml?: string // New: allow full HTML override
  vars?: Record<string, string> // New: arbitrary variables for template
}

// ─── Company Configurations ───────────────────────────────────────────────────
//
// Bảng màu thương hiệu — nguồn gốc:
//   primary_color  = màu chủ đạo trích tự động từ pixel logo (lưu trong DB: phap_nhan.mau_sac_chinh)
//   accent_color   = màu nhấn dùng cho header/border biểu mẫu in ấn (chọn thủ công theo thiết kế)
//
//  Pháp nhân            Logo file               primary (logo)   accent (tài liệu)
//  ─────────────────────────────────────────────────────────────────────────────
//  Nam Phương           logo_namphuong.png       #202878          #d32f2f
//  Nam Phương L.A       logo_namphuong.png       #202878          #2e7d32
//  Visunpack            logo_visunpack.png        #F0B018          #E65100

export const COMPANY_CONFIGS: Record<string, PrintCompanyInfo & { logo?: string }> = {
  "NAM PHUONG": {
    ten: "CÔNG TY TNHH SX TM NAM PHƯƠNG",
    dia_chi: "12/2 Ấp 2, Xã Xuân Thới Sơn, Thành phố Hồ Chí Minh, Việt Nam.",
    so_dien_thoai: "0903.113.638",
    tai_khoan: "banhang.namphuong@gmail.com",
    logo: "/logo_namphuong.png",
    primary_color: "#202878",  // trích từ logo_namphuong.png
    accent_color: "#d32f2f",
    footer_accent_color: "#ff8200",
  },
  "NAM PHUONG LONG AN": {
    ten: "CÔNG TY TNHH SX TM NAM PHƯƠNG L.A",
    dia_chi: "Lô Q3, Đường N11 và Lô Q18, đường N9, Khu Công Nghiệp Nam Thuận, Xã Mỹ Hạnh, Tỉnh Tây Ninh, Việt Nam.",
    so_dien_thoai: "0909.969.559",
    tai_khoan: "namphuongbaobi@gmail.com",
    logo: "/logo_namphuong.png",
    primary_color: "#202878",  // trích từ logo_namphuong.png (cùng hệ thống Nam Phương)
    accent_color: "#2e7d32",
    footer_accent_color: "#2e7d32",
  },
  "VISUNPACK": {
    ten: "CÔNG TY TNHH BAO BÌ VISUNPACK",
    dia_chi: "96 Tỉnh Lộ 15, Ấp 11A, Xã Phú Hòa Đông, Thành phố Hồ Chí Minh, Việt Nam.",
    so_dien_thoai: "0377.959.323",
    tai_khoan: "visunpack@gmail.com",
    logo: "/logo_visunpack.png",
    primary_color: "#F0B018",  // trích từ logo_visunpack.png
    accent_color: "#E65100",
    footer_accent_color: "#E65100",
  }
}

// Fallback configs based on partial name match
const CONFIG_MAPPING: Record<string, string> = {
  "NAM PHUONG": "NAM PHUONG",
  "NAM PHƯƠNG": "NAM PHUONG",
  "NAM PHUONG L.A": "NAM PHUONG LONG AN",
  "NAM PHƯƠNG L.A": "NAM PHUONG LONG AN",
  "NAM PHUONG LA": "NAM PHUONG LONG AN",
  "NAM PHƯƠNG LA": "NAM PHUONG LONG AN",
  "LONG AN": "NAM PHUONG LONG AN",
  "VISUNPACK": "VISUNPACK"
}

export function buildDocumentHtml(opts: PrintDocumentOptions): string {
  const fieldsHtml = opts.fields?.map(field => `
      <div class="info-row">
        <div class="info-label">${field.label}</div>
        <div class="info-value">${field.value}</div>
      </div>
    `).join('') ?? ''

  let co = opts.companyInfo
  const coName = co?.ten ?? opts.companyName ?? ''
  
  // Tự động lấy config chuẩn từ tên nếu không truyền companyInfo đầy đủ
  let configKey = ""
  for (const [k, v] of Object.entries(CONFIG_MAPPING)) {
    if (coName.toUpperCase().includes(k)) {
      configKey = v
      break
    }
  }
  
  const config = configKey ? COMPANY_CONFIGS[configKey] : undefined
  if (config && !co?.dia_chi) {
    co = { ...config, ...co } // Gộp thông tin mặc định với thông tin từ DB (nếu có)
  }

  const themePrimary = co?.primary_color || config?.primary_color || "#1b168e"
  const themeAccent = co?.accent_color || config?.accent_color || "#d32f2f"
  const themeFooter = co?.footer_accent_color || config?.footer_accent_color || themeAccent

  const coLines = [
    co?.dia_chi ? `<div class="co-line">Địa chỉ: ${co.dia_chi}</div>` : '',
    co?.so_dien_thoai ? `<div class="co-line">Hotline: ${co.so_dien_thoai}</div>` : '',
    co?.tai_khoan && co.tai_khoan.includes('@') ? `<div class="co-line">Email: ${co.tai_khoan}</div>` : '',
    (co?.tai_khoan && !co.tai_khoan.includes('@')) ? `<div class="co-line">Số TK: <b>${co.tai_khoan}</b> ${co.ngan_hang ? ' — ' + co.ngan_hang : ''}</div>` : '',
    co?.ma_so_thue ? `<div class="co-line">MST: ${co.ma_so_thue}</div>` : '',
  ].filter(Boolean).join('')

  const logoSrc = opts.logoUrl || co?.logo || config?.logo || ''

  if (opts.customHtml) {
    // Replace variables in customHtml
    let html = opts.customHtml
    const vars: Record<string, string> = {
      company_name: coName,
      company_details: coLines,
      subtitle: opts.subtitle ?? opts.title,
      document_number: opts.documentNumber ?? '',
      document_date: opts.documentDate ?? '',
      status: opts.status ?? '',
      body_html: opts.bodyHtml,
      footer_html: opts.footerHtml ?? '',
      logo_img: logoSrc ? `<img src="${logoSrc}" alt="Logo" style="max-height: 70px; object-fit: contain;" />` : '',
      ...opts.vars,
    }
    for (const [k, v] of Object.entries(vars)) {
      html = html.replace(new RegExp(`{{${k}}}`, 'g'), v ?? '')
    }
    return html
  }

  return `
    <style>
      :root { --primary: ${themePrimary}; --accent: ${themeAccent}; --footer-accent: ${themeFooter}; }
    </style>
    <div class="doc-panel">
      <div class="doc-head" style="border-bottom: 2px solid var(--primary); padding-bottom: 10px; margin-bottom: 15px;">
        <div class="doc-brand" style="flex: 0 0 100px;">
          ${logoSrc ? `<img src="${logoSrc}" alt="Logo" style="max-height: 70px; object-fit: contain;" />` : ''}
        </div>
        <div class="doc-title-block" style="flex: 1; padding-left: 15px;">
          <div class="company-name" style="font-size: 14px; color: var(--primary);">${coName}</div>
          ${coLines ? `<div class="co-details" style="font-size: 10px; line-height: 1.4;">${coLines}</div>` : ''}
          <div class="document-type" style="margin-top: 10px; font-size: 18px; color: var(--accent);">${opts.subtitle ?? opts.title}</div>
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
  printToPdf(opts.title, html, landscape, opts.companyInfo)
}

/**
 * In từ template thuần túy — không dùng layout mặc định.
 * Template chứa {{variable}} — được thay thế bởi vars + company info.
 * Template tự kiểm soát 100% HTML: table, header, chữ ký, CSS.
 */
export function renderTemplateAndPrint(
  title: string,
  templateHtml: string,
  vars: Record<string, string>,
  companyInfo?: PrintCompanyInfo,
  landscape = false,
) {
  const co = companyInfo
  const coName = co?.ten ?? ''
  const coLines = [
    co?.dia_chi ? `<div class="co-line">${co.dia_chi}</div>` : '',
    co?.so_dien_thoai ? `<div class="co-line">ĐT: ${co.so_dien_thoai}</div>` : '',
    co?.ma_so_thue ? `<div class="co-line">MST: ${co.ma_so_thue}</div>` : '',
  ].filter(Boolean).join('')
  const logoSrc = co?.logo || ''

  const allVars: Record<string, string> = {
    company_name: coName,
    company_details: coLines,
    logo_img: logoSrc ? `<img src="${logoSrc}" alt="Logo" style="max-height:70px;object-fit:contain;" />` : '',
    ...vars,
  }

  let html = templateHtml
  for (const [k, v] of Object.entries(allVars)) {
    html = html.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v ?? '')
  }

  printToPdf(title, html, landscape, companyInfo)
}

// ─── Formatting Helpers ───────────────────────────────────────────────────────

export const fmtVND = (v: number | null | undefined): string =>
  v != null ? new Intl.NumberFormat('vi-VN').format(Math.round(Number(v))) : '—'

export function numberToVietnameseWords(value: number | null | undefined): string {
  const amount = Math.round(Number(value || 0))
  if (amount === 0) return 'Không đồng'

  const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
  const units = ['', 'nghìn', 'triệu', 'tỷ']

  function readTriple(num: number, full = false) {
    const hundred = Math.floor(num / 100)
    const ten = Math.floor((num % 100) / 10)
    const one = num % 10
    const parts: string[] = []

    if (hundred > 0 || full) {
      parts.push(`${digits[hundred]} trăm`)
    }
    if (ten > 1) {
      parts.push(`${digits[ten]} mươi`)
      if (one === 1) parts.push('mốt')
      else if (one === 5) parts.push('lăm')
      else if (one > 0) parts.push(digits[one])
    } else if (ten === 1) {
      parts.push('mười')
      if (one === 5) parts.push('lăm')
      else if (one > 0) parts.push(digits[one])
    } else if (one > 0) {
      if (hundred > 0 || full) parts.push('lẻ')
      parts.push(one === 5 && (hundred > 0 || full) ? 'năm' : digits[one])
    }
    return parts.join(' ')
  }

  const groups: number[] = []
  let n = amount
  while (n > 0) {
    groups.push(n % 1000)
    n = Math.floor(n / 1000)
  }

  const words: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i]
    if (group === 0) continue
    const full = i < groups.length - 1 && group < 100
    words.push(`${readTriple(group, full)} ${units[i]}`.trim())
  }
  const result = words.join(' ').replace(/\s+/g, ' ').trim()
  return `${result.charAt(0).toUpperCase()}${result.slice(1)} đồng`
}

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
  win.document.write(`<html><head><title>Tem nhan dang</title></head><body>${html}</body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => {
    win.print()
    win.close()
  }, 250)
}

/**
 * In Tem nhận dạng theo lô (N pallet) — mỗi pallet 1 tờ A5, in 1 lần.
 */
export async function printProductionTagBatch(data: any, totalPallets: number) {
  if (totalPallets < 1) return
  const qrDataUrl = await QRCode.toDataURL(data.so_lenh || 'N/A', { margin: 1 })

  const makeTable = (ghiChu: string) => `<table>
  <colgroup>
    <col style="width:12%"><col style="width:17%"><col style="width:12%">
    <col style="width:17%"><col style="width:13%"><col style="width:29%">
  </colgroup>
  <tr>
    <td colspan="5" class="hdr">TEM NHẬN DẠNG</td>
    <td rowspan="4" class="qr"><img src="${qrDataUrl}"><div class="qr-num">${data.so_lenh || ''}</div></td>
  </tr>
  <tr>
    <td class="lbl" style="height:38px">KHÁCH<br>HÀNG</td>
    <td colspan="2" class="vxl">${data.ten_khach_hang || ''}</td>
    <td class="lbl">NGÀY GIAO<br>VỀ CỦ CHI</td>
    <td class="vmd">${data.ngay_giao_cu_chi || ''}</td>
  </tr>
  <tr>
    <td class="lbl">SỐ ĐH</td>
    <td class="val">${data.so_don_hang || ''}</td>
    <td rowspan="2" class="lbl">LOẠI /<br>SÓNG</td>
    <td rowspan="2" class="vlg">${data.loai_sp || ''}</td>
    <td class="vxl">${data.song || ''}</td>
  </tr>
  <tr>
    <td class="lbl">SỐ PO KH</td>
    <td class="val">${data.so_po_kh || ''}</td>
    <td></td>
  </tr>
  <tr>
    <td class="lbl">XƯỞNG<br>SX</td>
    <td class="vlg">${data.phan_xuong || 'Nam Phương'}</td>
    <td class="lbl">CÁN LẰN<br>(QCCL)</td>
    <td class="vmd" style="font-size:13px;line-height:1.6">${(data.qccl || '').split('+').join('<br>')}</td>
    <td class="lbl">Cán<br>màng</td>
    <td class="lbl">Chống<br>thấm</td>
  </tr>
  <tr>
    <td class="lbl">NSX MÁY<br>SÓNG</td>
    <td class="val" style="text-align:center">${data.ngay_chay_song || ''}</td>
    <td class="lbl">NGÀY GIAO<br>CHO KH</td>
    <td class="vlg" style="font-size:20px">${data.ngay_giao_kh || ''}</td>
    <td class="val" style="text-align:center">${data.can_mang || 'Không'}</td>
    <td class="val" style="text-align:center">${data.chong_tham || 'Không'}</td>
  </tr>
  <tr>
    <td class="lbl">CÔNG<br>ĐOẠN SX</td>
    <td colspan="3" class="vlg">${data.cong_doan || ''}</td>
    <td colspan="2" class="vmd">+ 0</td>
  </tr>
  <tr>
    <td class="lbl">TÊN SẢN<br>PHẨM</td>
    <td colspan="5" class="vxl" style="font-size:${
      (data.ten_san_pham || '').length > 60 ? 11 :
      (data.ten_san_pham || '').length > 40 ? 13 :
      (data.ten_san_pham || '').length > 25 ? 15 : 18
    }px;height:52px;line-height:1.4;white-space:normal;word-break:break-word">${data.ten_san_pham || ''}</td>
  </tr>
  <tr>
    <td class="lbl">SL TẤM<br>LỚN</td>
    <td colspan="5" class="vxl">${data.sl_tam_lon || ''}</td>
  </tr>
  <tr>
    <td class="lbl">SL TẤM<br>NHỎ</td>
    <td colspan="5" class="vxl">${data.sl_tam_nho || ''}</td>
  </tr>
  <tr>
    <td class="lbl">SL THÙNG</td>
    <td colspan="5" class="v2xl" style="font-size:28px">${data.sl_thung || ''}</td>
  </tr>
  <tr>
    <td class="lbl">BỘ PHẬN</td>
    <td colspan="5" class="vmd" style="height:32px">${data.bo_phan || ''}</td>
  </tr>
  <tr>
    <td class="lbl">GHI CHÚ</td>
    <td colspan="5" class="val">${ghiChu}</td>
  </tr>
</table>`

  const css = `
    @page { size: A5 portrait; margin: 5mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
    .pg { page-break-after: always; }
    .pg:last-child { page-break-after: auto; }
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
  `

  const pages = Array.from({ length: totalPallets }, (_, i) => {
    const ghiChu = `Pallet ${i + 1}/${totalPallets}${data.ghi_chu ? ' | ' + data.ghi_chu : ''}`
    return `<div class="pg">${makeTable(ghiChu)}</div>`
  }).join('\n')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Tem nhan dang</title><style>${css}</style></head><body>${pages}</body></html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 300)
}

/**
 * Smart Print PDF: Lấy template HTML từ DB và render dữ liệu.
 * @param ma_mau Mã mẫu in
 * @param data Object chứa các biến mapping {{key}} -> value
 * @param phapNhanId ID pháp nhân
 */
export async function smartPrintPdf(ma_mau: string, data: Record<string, any>, phapNhanId?: number, options: StrictTemplateOptions = {}) {
  try {
    const tpl = await systemApi.getTemplate(ma_mau, phapNhanId, true)
    if (!tpl || !tpl.html_content) throw new Error("Template empty")

    let html = tpl.html_content
    
    // Tự động bổ sung thông tin pháp nhân nếu chưa có trong data
    const finalData = { ...data }
    if (!finalData.company_name || !finalData.logo_img) {
      // Tìm config pháp nhân
      let config: PrintCompanyInfo | undefined
      if (phapNhanId) {
        try {
          const res = await phapNhanApi.list({ active_only: false })
          const pn = res.data.find(p => p.id === phapNhanId)
          if (pn) {
            config = {
              ten: pn.ten_phap_nhan || '',
              dia_chi: pn.dia_chi ?? '',
              ma_so_thue: pn.ma_so_thue ?? '',
              so_dien_thoai: pn.so_dien_thoai ?? '',
              tai_khoan: pn.tai_khoan ?? '',
              ngan_hang: pn.ngan_hang ?? '',
              logo: pn.logo_path ? `/${pn.logo_path.replace(/^\//, '')}` : '',
              primary_color: pn.mau_sac_chinh ?? undefined,
              accent_color: pn.mau_sac_chinh ?? undefined,
              footer_accent_color: pn.mau_sac_chinh ?? undefined,
            }
          } else {
            throw new Error(`Khong tim thay phap nhan ID ${phapNhanId}`)
          }
        } catch (e) { throw e }
      }
      
      if (!config) {
        throw new Error(`Chung tu ${ma_mau} chua co phap nhan de in`)
      }

      if (!finalData.company_name) finalData.company_name = config.ten
      if (!finalData.logo_img) {
        const logoSrc = config.logo || ''
        finalData.logo_img = logoSrc ? `<img src="${logoSrc}" alt="Logo" style="max-height: 70px; object-fit: contain;" />` : ''
      }
      if (!finalData.company_details) {
        finalData.company_details = [
          config.dia_chi ? `Địa chỉ: ${config.dia_chi}` : '',
          config.so_dien_thoai ? `SĐT: ${config.so_dien_thoai}` : '',
          config.ma_so_thue ? `MST: ${config.ma_so_thue}` : '',
        ].filter(Boolean).join(' - ')
      }
    }

    // Thay thế các biến
    Object.entries(finalData).forEach(([k, v]) => {
      html = html.replace(new RegExp(`{{${k}}}`, 'g'), v === null || v === undefined ? '' : String(v))
    })

    printToPdf(tpl.ten_mau || ma_mau, html, Boolean(options.landscape)) // Mặc định portrait cho chuyên nghiệp
  } catch (e: any) {
    const detail = e?.response?.data?.detail || e?.message || `Không thể tải mẫu in ${ma_mau}`
    console.error(`[PrintPdf] ${detail}`, e)
    if (options.throwOnError) throw new Error(detail)
    alert(detail)
    return
  }
}

/**
 * Tải xuống file PDF trực tiếp (không qua dialog in).
 * Dùng html2canvas + jsPDF — render HTML trong DOM ẩn rồi export.
 * @param html   Content HTML (cùng định dạng với printToPdf)
 * @param filename  Tên file xuất (không có .pdf)
 */
export async function downloadAsPdf(
  html: string,
  filename: string,
  landscape = false,
  companyInfo?: PrintCompanyInfo,
) {
  const { default: html2canvas } = await import('html2canvas')
  const { jsPDF } = await import('jspdf')

  const theme = getPrintThemeVars(companyInfo)
  const pageW = landscape ? 297 : 210
  const pageH = landscape ? 210 : 297
  const margin = 12

  const container = document.createElement('div')
  container.style.cssText = [
    'position:fixed',
    'left:-9999px',
    'top:0',
    `width:${pageW}mm`,
    'background:#fff',
    `padding:${margin}mm`,
    'box-sizing:border-box',
  ].join(';')

  container.innerHTML = `
    <style>
      :root{--primary:${theme.primary};--accent:${theme.accent};--footer-accent:${theme.footer};}
      *{box-sizing:border-box;margin:0;padding:0;}
      div{font-family:Arial,"Helvetica Neue",sans-serif;font-size:11px;color:#222;}
      table{width:100%;border-collapse:collapse;}
      thead{background:var(--primary);color:#fff;}
      th{padding:4px 5px;font-size:9px;font-weight:700;text-align:left;white-space:nowrap;}
      td{padding:3px 5px;font-size:9px;border-bottom:1px solid #eee;vertical-align:top;}
      tr:nth-child(even) td{background:#f9f9f9;}
      .right{text-align:right;}.center{text-align:center;}
      .total-row td{font-weight:700;background:#e6f4ff!important;border-top:2px solid var(--primary);}
      .footer-row td{font-weight:600;background:#fffbe6!important;border-top:2px solid var(--footer-accent);font-style:italic;}
    </style>
    ${html}
  `
  document.body.appendChild(container)

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    })

    const renderW = pageW
    const renderH = (canvas.height / canvas.width) * pageW
    const totalPages = Math.ceil(renderH / pageH)
    const imgData = canvas.toDataURL('image/jpeg', 0.92)

    const pdf = new jsPDF({
      orientation: landscape ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    for (let i = 0; i < totalPages; i++) {
      if (i > 0) pdf.addPage()
      // Shift image upward per page — jsPDF clips at page boundary
      pdf.addImage(imgData, 'JPEG', 0, -i * pageH, renderW, renderH)
    }

    pdf.save(`${filename}.pdf`)
  } finally {
    document.body.removeChild(container)
  }
}
