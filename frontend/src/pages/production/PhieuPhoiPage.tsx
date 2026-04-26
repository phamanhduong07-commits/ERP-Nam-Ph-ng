import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Form, Input, InputNumber,
  message, Modal, Row, Select, Space, Table, Tag, Tabs, Typography, Tooltip,
} from 'antd'
import {
  PlusOutlined, PrinterOutlined, SearchOutlined, DeleteOutlined,
  FileExcelOutlined, FilePdfOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import client from '../../api/client'

const { Text, Title } = Typography
const { RangePicker } = DatePicker

// ── API types ────────────────────────────────────────────────────────────────

interface NhapItem {
  id: number
  production_order_item_id: number
  ten_hang: string | null
  so_luong_ke_hoach: number
  so_luong_thuc_te: number | null
  so_luong_loi: number | null
  so_luong_nhap: number | null
  so_tam: number | null
  ghi_chu: string | null
}

interface PhieuNhap {
  id: number
  so_phieu: string
  production_order_id: number
  so_lenh: string | null
  ngay: string
  ca: string | null
  ghi_chu: string | null
  gio_bat_dau: string | null
  gio_ket_thuc: string | null
  created_at: string | null
  tong_thuc_te: number
  tong_loi: number
  tong_nhap: number
  items: NhapItem[]
}

interface XuatItem {
  id: number
  production_order_item_id: number | null
  ten_hang: string
  so_luong: number
  ghi_chu: string | null
}

interface PhieuXuat {
  id: number
  so_phieu: string
  ngay: string
  ca: string | null
  ghi_chu: string | null
  created_at: string | null
  tong_so_luong: number
  items: XuatItem[]
}

interface PagedResult<T> {
  total: number
  page: number
  page_size: number
  items: T[]
}

const phieuPhoiApi = {
  listNhap: (params: Record<string, string | number | undefined>) =>
    client.get<PagedResult<PhieuNhap>>('/phieu-phoi/nhap', { params }),
  listXuat: (params: Record<string, string | number | undefined>) =>
    client.get<PagedResult<PhieuXuat>>('/phieu-phoi/xuat', { params }),
  createXuat: (data: object) => client.post<PhieuXuat>('/phieu-phoi/xuat', data),
}

const fmtN = (v: number | null | undefined) =>
  v != null ? new Intl.NumberFormat('vi-VN').format(v) : '—'
const fmtDate = (v: string | null) => v ? dayjs(v).format('DD/MM/YYYY') : '—'

const calcDuration = (bd: string | null, kt: string | null): string => {
  if (!bd || !kt) return '—'
  const diff = dayjs(`2000-01-01 ${kt}`).diff(dayjs(`2000-01-01 ${bd}`), 'minute')
  if (diff <= 0) return '—'
  const h = Math.floor(diff / 60); const m = diff % 60
  return h > 0 ? `${h} giờ ${m} phút` : `${m} phút`
}

// ── Tab phiếu nhập ───────────────────────────────────────────────────────────

function TabNhap() {
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const [page, setPage] = useState(1)
  const [expandedRows, setExpandedRows] = useState<number[]>([])
  const [exportLoading, setExportLoading] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['phieu-nhap-phoi', search, dateRange, page],
    queryFn: () => phieuPhoiApi.listNhap({
      search: search || undefined,
      tu_ngay: dateRange?.[0],
      den_ngay: dateRange?.[1],
      page,
      page_size: 30,
    }).then(r => r.data),
  })

  // Fetch toàn bộ dữ liệu (không phân trang) theo bộ lọc hiện tại
  const fetchAll = async (): Promise<PhieuNhap[]> => {
    const res = await phieuPhoiApi.listNhap({
      search: search || undefined,
      tu_ngay: dateRange?.[0],
      den_ngay: dateRange?.[1],
      page: 1,
      page_size: 9999,
    })
    return res.data.items
  }

  const filterLabel = (): string => {
    const parts: string[] = []
    if (search) parts.push(`Tìm: "${search}"`)
    if (dateRange) parts.push(`Từ ${dayjs(dateRange[0]).format('DD/MM/YYYY')} đến ${dayjs(dateRange[1]).format('DD/MM/YYYY')}`)
    return parts.length ? parts.join(' · ') : 'Tất cả'
  }

  // Helper: trigger download an array buffer as xlsx file
  const triggerXlsxDownload = (wb: XLSX.WorkBook, filename: string) => {
    // XLSX.writeFile tự xử lý download trong browser - không cần user gesture
    XLSX.writeFile(wb, filename)
  }

  const handleExportExcel = async () => {
    setExportLoading(true)
    const hide = message.loading('Đang tải dữ liệu...', 0)
    try {
      const items = await fetchAll()
      hide()
      if (!items.length) { message.warning('Không có dữ liệu để xuất'); return }

      const wb = XLSX.utils.book_new()

      // ── Sheet 1: Tổng hợp phiếu ─────────────────────────────────────────────
      const summaryHeader = [
        'STT', 'Số phiếu', 'Lệnh SX', 'Ngày', 'Ca',
        'Giờ bắt đầu', 'Giờ kết thúc', 'Thời gian thực hiện',
        'SL thực tế', 'Phôi lỗi', 'Nhập kho',
      ]
      const summaryRows: (string | number)[][] = items.map((p, i) => [
        i + 1,
        p.so_phieu,
        p.so_lenh ?? '',
        dayjs(p.ngay).format('DD/MM/YYYY'),
        p.ca ?? '',
        p.gio_bat_dau ?? '',
        p.gio_ket_thuc ?? '',
        calcDuration(p.gio_bat_dau, p.gio_ket_thuc),
        p.tong_thuc_te,
        p.tong_loi,
        p.tong_nhap,
      ])
      summaryRows.push([
        '', 'TỔNG CỘNG', '', '', '', '', '', '',
        items.reduce((s, p) => s + p.tong_thuc_te, 0),
        items.reduce((s, p) => s + p.tong_loi, 0),
        items.reduce((s, p) => s + p.tong_nhap, 0),
      ])
      const ws1 = XLSX.utils.aoa_to_sheet([summaryHeader, ...summaryRows])
      ws1['!cols'] = [
        { wch: 5 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 6 },
        { wch: 12 }, { wch: 12 }, { wch: 22 },
        { wch: 12 }, { wch: 10 }, { wch: 12 },
      ]
      XLSX.utils.book_append_sheet(wb, ws1, 'Tổng hợp phiếu')

      // ── Sheet 2: Chi tiết từng dòng ──────────────────────────────────────────
      const detailHeader = [
        'Số phiếu', 'Lệnh SX', 'Ngày', 'Ca',
        'Giờ BD', 'Giờ KT', 'Thời gian TH',
        'Tên hàng', 'SL kế hoạch', 'SL thực tế', 'Phôi lỗi', 'Nhập kho', 'Số tấm', 'Ghi chú',
      ]
      const detailRows: (string | number | null)[][] = []
      items.forEach(p => {
        const dur = calcDuration(p.gio_bat_dau, p.gio_ket_thuc)
        if (!p.items || p.items.length === 0) {
          // Phiếu không có item vẫn xuất dòng header
          detailRows.push([
            p.so_phieu, p.so_lenh ?? '', dayjs(p.ngay).format('DD/MM/YYYY'), p.ca ?? '',
            p.gio_bat_dau ?? '', p.gio_ket_thuc ?? '', dur,
            '(không có hàng)', '', '', '', '', '', '',
          ])
        } else {
          p.items.forEach(it => {
            detailRows.push([
              p.so_phieu, p.so_lenh ?? '', dayjs(p.ngay).format('DD/MM/YYYY'), p.ca ?? '',
              p.gio_bat_dau ?? '', p.gio_ket_thuc ?? '', dur,
              it.ten_hang ?? '', it.so_luong_ke_hoach ?? 0,
              it.so_luong_thuc_te ?? '', it.so_luong_loi ?? '', it.so_luong_nhap ?? '',
              it.so_tam ?? '', it.ghi_chu ?? '',
            ])
          })
        }
      })
      const ws2 = XLSX.utils.aoa_to_sheet([detailHeader, ...detailRows])
      ws2['!cols'] = [
        { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 6 },
        { wch: 8 }, { wch: 8 }, { wch: 18 },
        { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 20 },
      ]
      XLSX.utils.book_append_sheet(wb, ws2, 'Chi tiết')

      triggerXlsxDownload(wb, `PhieuNhapPhoi_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`)
      message.success(`Đã xuất ${items.length} phiếu (${detailRows.length} dòng chi tiết)`)
    } catch (err: unknown) {
      hide()
      console.error('Export Excel error:', err)
      const msg = err instanceof Error ? err.message : String(err)
      message.error(`Lỗi xuất Excel: ${msg}`)
    } finally {
      setExportLoading(false)
    }
  }

  const handleExportPdf = async () => {
    // Mở cửa sổ TRƯỚC KHI await để không bị popup-blocker chặn
    const win = window.open('', '_blank')
    if (!win) {
      message.error('Trình duyệt đang chặn popup. Hãy cho phép popup từ trang này và thử lại.')
      return
    }
    win.document.write(
      '<html><head><meta charset="utf-8"/></head><body style="font-family:Arial;padding:30px;color:#333">' +
      '<p style="font-size:16px">⏳ Đang tải dữ liệu, vui lòng chờ...</p></body></html>'
    )

    setExportLoading(true)
    try {
      const items = await fetchAll()
      if (!items.length) {
        win.close()
        message.warning('Không có dữ liệu để xuất')
        return
      }

      const label = filterLabel()
      const dateStr = dayjs().format('DD/MM/YYYY HH:mm')
      const tongThucTe = items.reduce((s, p) => s + p.tong_thuc_te, 0)
      const tongLoi = items.reduce((s, p) => s + p.tong_loi, 0)
      const tongNhap = items.reduce((s, p) => s + p.tong_nhap, 0)

      // Bảng phẳng gộp tất cả dòng — mỗi item là 1 hàng (giống sheet "Chi tiết" Excel)
      let stt = 0
      const flatRows = items.flatMap(p => {
        const dur = calcDuration(p.gio_bat_dau, p.gio_ket_thuc)
        if (!p.items || p.items.length === 0) {
          stt++
          return [`<tr style="background:${stt % 2 === 0 ? '#f9f9f9' : '#fff'}">
            <td style="text-align:center">${stt}</td>
            <td style="font-family:monospace;font-size:10px">${p.so_phieu}</td>
            <td>${p.so_lenh ?? '—'}</td>
            <td style="text-align:center">${fmtDate(p.ngay)}</td>
            <td style="text-align:center">${p.ca ?? '—'}</td>
            <td style="text-align:center">${p.gio_bat_dau ?? '—'}</td>
            <td style="text-align:center">${p.gio_ket_thuc ?? '—'}</td>
            <td style="text-align:center">${dur}</td>
            <td style="color:#888;font-style:italic">(không có hàng)</td>
            <td></td><td></td><td></td><td></td><td></td>
          </tr>`]
        }
        return p.items.map(it => {
          stt++
          return `<tr style="background:${stt % 2 === 0 ? '#f9f9f9' : '#fff'}">
            <td style="text-align:center">${stt}</td>
            <td style="font-family:monospace;font-size:10px">${p.so_phieu}</td>
            <td>${p.so_lenh ?? '—'}</td>
            <td style="text-align:center">${fmtDate(p.ngay)}</td>
            <td style="text-align:center">${p.ca ?? '—'}</td>
            <td style="text-align:center">${p.gio_bat_dau ?? '—'}</td>
            <td style="text-align:center">${p.gio_ket_thuc ?? '—'}</td>
            <td style="text-align:center">${dur}</td>
            <td>${it.ten_hang ?? '—'}</td>
            <td style="text-align:right">${fmtN(it.so_luong_ke_hoach)}</td>
            <td style="text-align:right">${fmtN(it.so_luong_thuc_te)}</td>
            <td style="text-align:right;color:#c00">${it.so_luong_loi ? fmtN(it.so_luong_loi) : ''}</td>
            <td style="text-align:right;font-weight:700;color:#1a7a1a">${fmtN(it.so_luong_nhap)}</td>
            <td style="text-align:center">${it.so_tam ?? ''}</td>
          </tr>`
        })
      }).join('')

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>Phiếu nhập phôi sóng - ${dateStr}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 16px; }
        .page-header { text-align: center; margin-bottom: 14px; }
        .company { font-size: 10px; color: #666; margin-bottom: 2px; }
        h2 { font-size: 15px; font-weight: bold; text-transform: uppercase; }
        .meta { font-size: 10px; color: #555; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
        th { background: #1677ff; color: #fff; padding: 5px 6px; border: 1px solid #1677ff; text-align: center; font-weight: 600; white-space: nowrap; }
        td { padding: 4px 6px; border: 1px solid #ddd; vertical-align: middle; }
        tfoot td { background: #f0f4ff; font-weight: 700; border-top: 2px solid #1677ff; }
        .totals-box { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 8px 0 14px; }
        .tot { border: 1px solid #ddd; padding: 8px 12px; border-radius: 6px; text-align: center; }
        .tot .lbl { font-size: 10px; color: #777; }
        .tot .val { font-size: 16px; font-weight: 700; margin-top: 2px; }
        @media print { @page { margin: 8mm; size: A4 landscape; } }
      </style>
      </head><body>
      <div class="page-header">
        <div class="company">CÔNG TY CP BAO BÌ NAM PHƯƠNG</div>
        <h2>DANH SÁCH PHIẾU NHẬP PHÔI SÓNG</h2>
        <div class="meta">Bộ lọc: ${label} &nbsp;|&nbsp; Xuất lúc: ${dateStr} &nbsp;|&nbsp; ${items.length} phiếu &nbsp;·&nbsp; ${stt} dòng hàng</div>
      </div>

      <div class="totals-box">
        <div class="tot"><div class="lbl">Tổng SL thực tế</div><div class="val">${fmtN(tongThucTe)}</div></div>
        <div class="tot"><div class="lbl">Phôi lỗi</div><div class="val" style="color:#c00">${fmtN(tongLoi)}</div></div>
        <div class="tot"><div class="lbl">Tổng nhập kho</div><div class="val" style="color:#1a7a1a">${fmtN(tongNhap)}</div></div>
      </div>

      <table>
        <thead><tr>
          <th width="30">STT</th>
          <th width="115">Số phiếu</th>
          <th width="95">Lệnh SX</th>
          <th width="82">Ngày</th>
          <th width="40">Ca</th>
          <th width="52">Giờ BD</th>
          <th width="52">Giờ KT</th>
          <th width="95">Thời gian TH</th>
          <th>Tên hàng</th>
          <th width="72">SL kế hoạch</th>
          <th width="72">SL thực tế</th>
          <th width="65">Phôi lỗi</th>
          <th width="72">Nhập kho</th>
          <th width="50">Số tấm</th>
        </tr></thead>
        <tbody>${flatRows}</tbody>
        <tfoot><tr>
          <td colspan="10" style="text-align:right">TỔNG CỘNG (${items.length} phiếu · ${stt} dòng):</td>
          <td style="text-align:right">${fmtN(tongThucTe)}</td>
          <td style="text-align:right;color:#c00">${tongLoi > 0 ? fmtN(tongLoi) : ''}</td>
          <td style="text-align:right;color:#1a7a1a">${fmtN(tongNhap)}</td>
          <td></td>
        </tr></tfoot>
      </table>
      <script>window.onload=()=>{window.print()}</script>
      </body></html>`

      // Ghi nội dung vào cửa sổ đã mở trước
      win.document.open()
      win.document.write(html)
      win.document.close()
    } catch (err: unknown) {
      win.close()
      console.error('Export PDF error:', err)
      const msg = err instanceof Error ? err.message : String(err)
      message.error(`Lỗi xuất PDF: ${msg}`)
    } finally {
      setExportLoading(false)
    }
  }

  const handlePrint = (p: PhieuNhap) => {
    const duration = (() => {
      if (!p.gio_bat_dau || !p.gio_ket_thuc) return null
      const bd = dayjs(`2000-01-01 ${p.gio_bat_dau}`)
      const kt = dayjs(`2000-01-01 ${p.gio_ket_thuc}`)
      const diff = kt.diff(bd, 'minute')
      if (diff <= 0) return null
      const h = Math.floor(diff / 60); const m = diff % 60
      return h > 0 ? `${h} giờ ${m} phút` : `${m} phút`
    })()
    const rows = p.items.map((it, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${it.ten_hang ?? '—'}</td>
        <td style="text-align:right">${fmtN(it.so_luong_ke_hoach)}</td>
        <td style="text-align:right">${fmtN(it.so_luong_thuc_te)}</td>
        <td style="text-align:right;color:#cf1322">${it.so_luong_loi ? fmtN(it.so_luong_loi) : ''}</td>
        <td style="text-align:right;font-weight:600;color:#389e0d">${fmtN(it.so_luong_nhap)}</td>
        <td style="text-align:center">${it.so_tam ?? ''}</td>
        <td>${it.ghi_chu ?? ''}</td>
      </tr>`).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${p.so_phieu}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px;padding:20px}
    h2{font-size:16px;text-align:center;margin-bottom:6px}.info{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;border:1px solid #ccc;padding:8px;margin-bottom:12px;border-radius:4px}
    .lbl{font-size:10px;color:#777}.val{font-weight:600;font-size:13px}
    table{width:100%;border-collapse:collapse;margin-bottom:16px}
    th{background:#f0f0f0;padding:5px 6px;border:1px solid #ccc;font-size:11px;text-align:center}
    td{padding:4px 6px;border:1px solid #ddd;font-size:11px;vertical-align:middle}
    .sig{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:24px;text-align:center}
    .sig-label{font-weight:600;font-size:11px;margin-bottom:40px}
    @media print{@page{margin:12mm}}</style></head><body>
    <div style="text-align:center;margin-bottom:12px">
      <div style="font-size:11px;color:#555">CÔNG TY CP BAO BÌ NAM PHƯƠNG</div>
      <h2>PHIẾU NHẬP PHÔI SÓNG</h2>
      <div style="font-size:11px">Số phiếu: <strong>${p.so_phieu}</strong></div>
    </div>
    <div class="info">
      <div><div class="lbl">Lệnh SX</div><div class="val">${p.so_lenh ?? '—'}</div></div>
      <div><div class="lbl">Ngày</div><div class="val">${fmtDate(p.ngay)}</div></div>
      <div><div class="lbl">Ca</div><div class="val">${p.ca ?? '—'}</div></div>
      <div><div class="lbl">Ghi chú</div><div class="val" style="font-size:11px">${p.ghi_chu ?? '—'}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;border:1px solid #ccc;padding:8px;margin-bottom:12px;border-radius:4px;background:#f9f9f9">
      <div><div class="lbl">Giờ bắt đầu</div><div class="val">${p.gio_bat_dau ?? '—'}</div></div>
      <div><div class="lbl">Giờ kết thúc</div><div class="val">${p.gio_ket_thuc ?? '—'}</div></div>
      <div><div class="lbl">Thời gian TH</div><div class="val">${duration ?? '—'}</div></div>
    </div>
    <table><thead><tr>
      <th width="32">STT</th><th>Tên hàng</th>
      <th width="80">SL kế hoạch</th><th width="80">SL thực tế</th>
      <th width="70">Phôi lỗi</th><th width="80">Nhập kho</th>
      <th width="55">Số tấm</th><th>Ghi chú</th>
    </tr></thead><tbody>${rows}</tbody>
    <tfoot><tr style="background:#f5f5f5;font-weight:600">
      <td colspan="3" style="text-align:right;padding:5px 6px">Tổng cộng:</td>
      <td style="text-align:right;padding:5px 6px">${fmtN(p.tong_thuc_te)}</td>
      <td style="text-align:right;padding:5px 6px;color:#cf1322">${p.tong_loi ? fmtN(p.tong_loi) : ''}</td>
      <td style="text-align:right;padding:5px 6px;color:#389e0d">${fmtN(p.tong_nhap)}</td>
      <td colspan="2"></td>
    </tr></tfoot></table>
    <div class="sig">
      <div><div class="sig-label">Người lập phiếu</div><div style="font-size:10px;color:#777">(Ký, ghi rõ họ tên)</div></div>
      <div><div class="sig-label">Vận hành máy sóng</div><div style="font-size:10px;color:#777">(Ký, ghi rõ họ tên)</div></div>
      <div><div class="sig-label">Quản lý sản xuất</div><div style="font-size:10px;color:#777">(Ký, ghi rõ họ tên)</div></div>
    </div>
    <script>window.onload=()=>{window.print()}</script></body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }

  const columns: ColumnsType<PhieuNhap> = [
    {
      title: 'Số phiếu',
      dataIndex: 'so_phieu',
      width: 150,
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Lệnh SX',
      dataIndex: 'so_lenh',
      width: 130,
      render: (v: string | null) => <Text style={{ fontSize: 12 }}>{v ?? '—'}</Text>,
    },
    {
      title: 'Ngày',
      dataIndex: 'ngay',
      width: 100,
      render: (v: string) => fmtDate(v),
    },
    {
      title: 'Giờ BD → KT',
      width: 140,
      render: (_: unknown, r: PhieuNhap) => (
        r.gio_bat_dau || r.gio_ket_thuc
          ? <Space size={2}>
              <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>{r.gio_bat_dau ?? '?'}</Tag>
              <Text type="secondary" style={{ fontSize: 10 }}>→</Text>
              <Tag color="green" style={{ fontSize: 10, margin: 0 }}>{r.gio_ket_thuc ?? '?'}</Tag>
            </Space>
          : <Text type="secondary">—</Text>
      ),
    },
    { title: 'Ca', dataIndex: 'ca', width: 60, render: (v: string | null) => v ?? '—' },
    {
      title: 'SL thực tế',
      dataIndex: 'tong_thuc_te',
      width: 100,
      align: 'right' as const,
      render: (v: number) => fmtN(v),
    },
    {
      title: 'Phôi lỗi',
      dataIndex: 'tong_loi',
      width: 90,
      align: 'right' as const,
      render: (v: number) => v > 0
        ? <Text style={{ color: '#cf1322' }}>{fmtN(v)}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Nhập kho',
      dataIndex: 'tong_nhap',
      width: 100,
      align: 'right' as const,
      render: (v: number) => <Text strong style={{ color: '#389e0d' }}>{fmtN(v)}</Text>,
    },
    {
      title: '',
      width: 60,
      render: (_: unknown, r: PhieuNhap) => (
        <Button size="small" icon={<PrinterOutlined />} onClick={() => handlePrint(r)}>In</Button>
      ),
    },
  ]

  const expandedRowRender = (p: PhieuNhap) => (
    <Table
      rowKey="id"
      size="small"
      pagination={false}
      dataSource={p.items}
      columns={[
        { title: 'Tên hàng', dataIndex: 'ten_hang', render: (v: string | null) => v ?? '—' },
        { title: 'SL kế hoạch', dataIndex: 'so_luong_ke_hoach', width: 110, align: 'right' as const, render: fmtN },
        { title: 'SL thực tế', dataIndex: 'so_luong_thuc_te', width: 110, align: 'right' as const, render: fmtN },
        {
          title: 'Phôi lỗi',
          dataIndex: 'so_luong_loi',
          width: 90,
          align: 'right' as const,
          render: (v: number | null) => v ? <Text style={{ color: '#cf1322' }}>{fmtN(v)}</Text> : <Text type="secondary">—</Text>,
        },
        {
          title: 'Nhập kho',
          dataIndex: 'so_luong_nhap',
          width: 90,
          align: 'right' as const,
          render: (v: number | null) => <Text strong style={{ color: '#389e0d' }}>{fmtN(v)}</Text>,
        },
        { title: 'Số tấm', dataIndex: 'so_tam', width: 70, align: 'center' as const, render: (v: number | null) => v ?? '—' },
        { title: 'Ghi chú', dataIndex: 'ghi_chu', render: (v: string | null) => v ?? '—' },
      ]}
    />
  )

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <Row gutter={[8, 8]} align="middle" justify="space-between" wrap>
        <Col>
          <Space wrap>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Số phiếu / lệnh SX..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              allowClear
              style={{ width: 220 }}
            />
            <RangePicker
              format="DD/MM/YYYY"
              style={{ width: 240 }}
              onChange={v => {
                setDateRange(v ? [v[0]!.format('YYYY-MM-DD'), v[1]!.format('YYYY-MM-DD')] : null)
                setPage(1)
              }}
            />
          </Space>
        </Col>
        <Col>
          <Space>
            <Tooltip title="Xuất Excel (2 sheet: tổng hợp + chi tiết)">
              <Button
                icon={<FileExcelOutlined />}
                loading={exportLoading}
                onClick={handleExportExcel}
                style={{ color: '#217346', borderColor: '#217346' }}
              >
                Excel
              </Button>
            </Tooltip>
            <Tooltip title="Xuất PDF / In danh sách (tổng hợp + chi tiết)">
              <Button
                icon={<FilePdfOutlined />}
                loading={exportLoading}
                onClick={handleExportPdf}
                style={{ color: '#e53935', borderColor: '#e53935' }}
              >
                PDF
              </Button>
            </Tooltip>
          </Space>
        </Col>
      </Row>
      <Table<PhieuNhap>
        rowKey="id"
        size="small"
        loading={isLoading}
        dataSource={data?.items ?? []}
        columns={columns}
        expandable={{ expandedRowRender, rowExpandable: r => r.items.length > 0 }}
        pagination={{
          total: data?.total,
          current: page,
          pageSize: 30,
          showTotal: t => `${t} phiếu`,
          onChange: setPage,
          showSizeChanger: false,
        }}
        scroll={{ x: 900 }}
      />
    </Space>
  )
}

// ── Tab phiếu xuất ───────────────────────────────────────────────────────────

interface XuatRowState { ten_hang: string; so_luong: number | null; ghi_chu: string }

function TabXuat() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [ngay, setNgay] = useState(dayjs().format('YYYY-MM-DD'))
  const [ca, setCa] = useState<string | null>(null)
  const [ghiChu, setGhiChu] = useState('')
  const [xuatRows, setXuatRows] = useState<XuatRowState[]>([{ ten_hang: '', so_luong: null, ghi_chu: '' }])

  const { data, isLoading } = useQuery({
    queryKey: ['phieu-xuat-phoi', search, dateRange, page],
    queryFn: () => phieuPhoiApi.listXuat({
      search: search || undefined,
      tu_ngay: dateRange?.[0],
      den_ngay: dateRange?.[1],
      page,
      page_size: 30,
    }).then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: () => phieuPhoiApi.createXuat({
      ngay,
      ca: ca || null,
      ghi_chu: ghiChu || null,
      items: xuatRows
        .filter(r => r.ten_hang && r.so_luong)
        .map(r => ({ ten_hang: r.ten_hang, so_luong: r.so_luong, ghi_chu: r.ghi_chu || null })),
    }),
    onSuccess: (res) => {
      message.success(`Đã tạo ${res.data.so_phieu}`)
      qc.invalidateQueries({ queryKey: ['phieu-xuat-phoi'] })
      // Đóng modal qua onCancel để reset toàn bộ state
      setModalOpen(false)
      setCa(null)
      setNgay(dayjs().format('YYYY-MM-DD'))
      setGhiChu('')
      setXuatRows([{ ten_hang: '', so_luong: null, ghi_chu: '' }])
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo phiếu xuất'),
  })

  const updateXuatRow = (i: number, patch: Partial<XuatRowState>) =>
    setXuatRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))

  const columns: ColumnsType<PhieuXuat> = [
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 150, render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text> },
    { title: 'Ngày', dataIndex: 'ngay', width: 100, render: (v: string) => fmtDate(v) },
    { title: 'Ca', dataIndex: 'ca', width: 60, render: (v: string | null) => v ?? '—' },
    { title: 'Số dòng', width: 80, align: 'center' as const, render: (_: unknown, r: PhieuXuat) => r.items.length },
    { title: 'Tổng SL xuất', dataIndex: 'tong_so_luong', width: 110, align: 'right' as const, render: fmtN },
    { title: 'Ghi chú', dataIndex: 'ghi_chu', ellipsis: true, render: (v: string | null) => v ?? '—' },
  ]

  const expandedRowRender = (p: PhieuXuat) => (
    <Table rowKey="id" size="small" pagination={false} dataSource={p.items}
      columns={[
        { title: 'Tên hàng', dataIndex: 'ten_hang' },
        { title: 'SL xuất', dataIndex: 'so_luong', width: 100, align: 'right' as const, render: fmtN },
        { title: 'Ghi chú', dataIndex: 'ghi_chu', render: (v: string | null) => v ?? '—' },
      ]} />
  )

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <Row gutter={8} align="middle" justify="space-between" wrap>
        <Col>
          <Space>
            <Input prefix={<SearchOutlined />} placeholder="Số phiếu..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }} allowClear style={{ width: 200 }} />
            <RangePicker format="DD/MM/YYYY" style={{ width: 240 }}
              onChange={v => { setDateRange(v ? [v[0]!.format('YYYY-MM-DD'), v[1]!.format('YYYY-MM-DD')] : null); setPage(1) }} />
          </Space>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Tạo phiếu xuất
          </Button>
        </Col>
      </Row>

      <Table<PhieuXuat>
        rowKey="id" size="small" loading={isLoading}
        dataSource={data?.items ?? []} columns={columns}
        expandable={{ expandedRowRender, rowExpandable: r => r.items.length > 0 }}
        pagination={{ total: data?.total, current: page, pageSize: 30, showTotal: t => `${t} phiếu`, onChange: setPage, showSizeChanger: false }}
        scroll={{ x: 700 }}
      />

      <Modal
        open={modalOpen}
        title="Tạo phiếu xuất phôi sóng"
        width={720}
        onCancel={() => {
          setModalOpen(false)
          setCa(null)
          setNgay(dayjs().format('YYYY-MM-DD'))
          setGhiChu('')
          setXuatRows([{ ten_hang: '', so_luong: null, ghi_chu: '' }])
        }}
        onOk={() => createMut.mutate()}
        okText="Tạo phiếu"
        confirmLoading={createMut.isPending}
        destroyOnClose
      >
        <Form layout="inline" style={{ marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
          <Form.Item label="Ngày" style={{ marginBottom: 8 }}>
            <DatePicker format="DD/MM/YYYY" value={dayjs(ngay)}
              onChange={d => setNgay(d ? d.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'))}
              style={{ width: 140 }} />
          </Form.Item>
          <Form.Item label="Ca" style={{ marginBottom: 8 }}>
            <Select placeholder="Chọn ca" allowClear style={{ width: 110 }} value={ca ?? undefined}
              onChange={v => setCa(v ?? null)}
              options={[{ value: 'Ca 1', label: 'Ca 1' }, { value: 'Ca 2', label: 'Ca 2' }, { value: 'Ca 3', label: 'Ca 3' }]} />
          </Form.Item>
          <Form.Item label="Ghi chú" style={{ marginBottom: 8 }}>
            <Input style={{ width: 200 }} value={ghiChu} onChange={e => setGhiChu(e.target.value)} placeholder="Ghi chú phiếu..." />
          </Form.Item>
        </Form>

        <Table
          rowKey={(_, i) => String(i)}
          size="small"
          pagination={false}
          dataSource={xuatRows}
          columns={[
            {
              title: 'Tên hàng / Mã phôi',
              render: (_: unknown, r: XuatRowState, i: number) => (
                <Input size="small" value={r.ten_hang} placeholder="Tên hàng..."
                  onChange={e => updateXuatRow(i, { ten_hang: e.target.value })} />
              ),
            },
            {
              title: 'SL xuất',
              width: 110,
              render: (_: unknown, r: XuatRowState, i: number) => (
                <InputNumber size="small" style={{ width: 100 }} min={0} value={r.so_luong ?? undefined}
                  placeholder="Số lượng"
                  onChange={v => updateXuatRow(i, { so_luong: v ?? null })} />
              ),
            },
            {
              title: 'Ghi chú',
              render: (_: unknown, r: XuatRowState, i: number) => (
                <Input size="small" value={r.ghi_chu}
                  onChange={e => updateXuatRow(i, { ghi_chu: e.target.value })} />
              ),
            },
            {
              title: '',
              width: 40,
              render: (_: unknown, __: XuatRowState, i: number) => (
                <Button size="small" type="text" danger icon={<DeleteOutlined />}
                  onClick={() => setXuatRows(prev => prev.filter((_, idx) => idx !== i))}
                  disabled={xuatRows.length === 1} />
              ),
            },
          ]}
          footer={() => (
            <Button size="small" icon={<PlusOutlined />}
              onClick={() => setXuatRows(prev => [...prev, { ten_hang: '', so_luong: null, ghi_chu: '' }])}>
              Thêm dòng
            </Button>
          )}
        />
      </Modal>
    </Space>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function PhieuPhoiPage() {
  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 16 }}>Quản lý phiếu phôi sóng</Title>
      <Card>
        <Tabs
          defaultActiveKey="nhap"
          items={[
            {
              key: 'nhap',
              label: 'Phiếu nhập phôi',
              children: <TabNhap />,
            },
            {
              key: 'xuat',
              label: 'Phiếu xuất phôi',
              children: <TabXuat />,
            },
          ]}
        />
      </Card>
    </div>
  )
}
