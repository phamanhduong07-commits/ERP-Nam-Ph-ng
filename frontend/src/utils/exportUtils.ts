import * as XLSX from 'xlsx'
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
    table { width: 100%; border-collapse: collapse; margin-top: 6px; page-break-inside: auto; }
    thead { background: #1677ff; color: #fff; display: table-header-group; }
    th { padding: 4px 5px; font-size: 9px; font-weight: 700; text-align: left; white-space: nowrap; }
    td { padding: 3px 5px; font-size: 9px; border-bottom: 1px solid #eee; vertical-align: top; }
    tr:nth-child(even) td { background: #f9f9f9; }
    .right { text-align: right; }
    .center { text-align: center; }
    .total-row td { font-weight: 700; background: #e6f4ff !important; border-top: 2px solid #1677ff; }
    .footer-row td { font-weight: 600; background: #fffbe6 !important; border-top: 2px solid #fa8c16; font-style: italic; }
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
