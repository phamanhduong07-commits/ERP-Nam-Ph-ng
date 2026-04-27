import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Form, Input, InputNumber,
  message, Modal, Pagination, Row, Select, Space, Spin, Table, Tag, Tabs, Typography, Tooltip,
} from 'antd'
import {
  PlusOutlined, PrinterOutlined, SearchOutlined, DeleteOutlined,
  FileExcelOutlined, FilePdfOutlined,
  PlayCircleOutlined, StopOutlined, ClockCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import client from '../../api/client'
import {
  productionOrdersApi,
  TRANG_THAI_LABELS,
  TRANG_THAI_COLORS,
} from '../../api/productionOrders'
import type {
  ProductionOrderListItem,
  ProductionOrder,
  PhieuNhapPhoiSong,
} from '../../api/productionOrders'
import PhieuNhapPhoiSongModal, { phoiSessionKey } from './PhieuNhapPhoiSongModal'

const { Text, Title } = Typography
const { RangePicker } = DatePicker

// ── Shared helpers ────────────────────────────────────────────────────────────

const fmtN = (v: number | null | undefined) =>
  v != null ? new Intl.NumberFormat('vi-VN').format(v) : '—'
const fmtDate = (v: string | null | undefined) =>
  v ? dayjs(v).format('DD/MM/YYYY') : '—'
const calcDuration = (bd: string | null, kt: string | null): string => {
  if (!bd || !kt) return '—'
  const diff = dayjs(`2000-01-01 ${kt}`).diff(dayjs(`2000-01-01 ${bd}`), 'minute')
  if (diff <= 0) return '—'
  const h = Math.floor(diff / 60); const m = diff % 60
  return h > 0 ? `${h} giờ ${m} phút` : `${m} phút`
}

// ── API types phiếu xuất ──────────────────────────────────────────────────────

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
interface PagedResult<T> { total: number; page: number; page_size: number; items: T[] }

const phieuPhoiApi = {
  listXuat: (params: Record<string, string | number | undefined>) =>
    client.get<PagedResult<PhieuXuat>>('/phieu-phoi/xuat', { params }),
  createXuat: (data: object) => client.post<PhieuXuat>('/phieu-phoi/xuat', data),
}

// ── Loại session ──────────────────────────────────────────────────────────────

interface Session { ngay: string; gio_bat_dau: string }
type Sessions = Record<number, Session>

function readAllSessions(): Sessions {
  const result: Sessions = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('phoi-session-')) {
      try {
        const id = parseInt(key.replace('phoi-session-', ''))
        const val = JSON.parse(localStorage.getItem(key) || 'null')
        if (val && !isNaN(id)) result[id] = val
      } catch { /* ignore */ }
    }
  }
  return result
}

// ── Gom nhóm lệnh SX theo đơn hàng ──────────────────────────────────────────

interface DonHangGroup {
  key: string
  sales_order_id: number | null
  so_don: string | null
  ten_khach_hang: string | null
  so_lenh_count: number
  tong_sl: number
  orders: ProductionOrderListItem[]
}

function groupOrders(orders: ProductionOrderListItem[]): DonHangGroup[] {
  const map = new Map<string, DonHangGroup>()
  orders.forEach(o => {
    // Lệnh có đơn hàng → gom cùng nhóm; lệnh độc lập → mỗi lệnh là 1 nhóm riêng
    const key = o.sales_order_id != null
      ? `don-${o.sales_order_id}`
      : `standalone-${o.id}`
    if (!map.has(key)) {
      map.set(key, {
        key,
        sales_order_id: o.sales_order_id,
        so_don: o.so_don,
        ten_khach_hang: o.ten_khach_hang,
        so_lenh_count: 0,
        tong_sl: 0,
        orders: [],
      })
    }
    const g = map.get(key)!
    g.so_lenh_count += 1
    g.tong_sl += Number(o.tong_sl_ke_hoach)
    g.orders.push(o)
  })
  return Array.from(map.values())
}

// ── Sub-component: danh sách phiếu nhập của 1 lệnh SX ────────────────────────

function PhieuNhapForOrder({
  orderId,
  soLenh,
  onPrint,
}: {
  orderId: number
  soLenh: string
  onPrint: (phieu: PhieuNhapPhoiSong, soLenh: string) => void
}) {
  const { data: phieus, isLoading } = useQuery({
    queryKey: ['phieu-nhap-per-order', orderId],
    queryFn: () =>
      client
        .get<PhieuNhapPhoiSong[]>(`/production-orders/${orderId}/phieu-nhap-phoi-song`)
        .then((r) => r.data),
  })

  if (isLoading) return <div style={{ padding: 12 }}><Spin size="small" /></div>
  if (!phieus?.length)
    return (
      <div style={{ padding: '10px 48px', color: '#999', fontStyle: 'italic', fontSize: 12 }}>
        Chưa có phiếu nhập phôi nào cho lệnh này.
      </div>
    )

  const tong_tt = phieus.reduce((s, p) => s + p.items.reduce((ss, it) => ss + (it.so_luong_thuc_te ?? 0), 0), 0)
  const tong_loi = phieus.reduce((s, p) => s + p.items.reduce((ss, it) => ss + (it.so_luong_loi ?? 0), 0), 0)

  const cols: ColumnsType<PhieuNhapPhoiSong> = [
    {
      title: 'Số phiếu', dataIndex: 'so_phieu', width: 155,
      render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text>,
    },
    { title: 'Ngày', dataIndex: 'ngay', width: 90, render: (v: string) => fmtDate(v) },
    { title: 'Ca', dataIndex: 'ca', width: 55, render: (v: string | null) => v ?? '—' },
    {
      title: 'Giờ BD → KT', width: 130,
      render: (_: unknown, p: PhieuNhapPhoiSong) =>
        p.gio_bat_dau || p.gio_ket_thuc ? (
          <Space size={2}>
            <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>{p.gio_bat_dau ?? '?'}</Tag>
            <Text type="secondary" style={{ fontSize: 10 }}>→</Text>
            <Tag color="green" style={{ fontSize: 10, margin: 0 }}>{p.gio_ket_thuc ?? '?'}</Tag>
          </Space>
        ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'SL thực tế', width: 95, align: 'right' as const,
      render: (_: unknown, p: PhieuNhapPhoiSong) =>
        fmtN(p.items.reduce((s, it) => s + (it.so_luong_thuc_te ?? 0), 0)),
    },
    {
      title: 'Phôi lỗi', width: 80, align: 'right' as const,
      render: (_: unknown, p: PhieuNhapPhoiSong) => {
        const loi = p.items.reduce((s, it) => s + (it.so_luong_loi ?? 0), 0)
        return loi > 0
          ? <Text style={{ color: '#cf1322' }}>{fmtN(loi)}</Text>
          : <Text type="secondary">—</Text>
      },
    },
    {
      title: 'Nhập kho', width: 90, align: 'right' as const,
      render: (_: unknown, p: PhieuNhapPhoiSong) => {
        const tt = p.items.reduce((s, it) => s + (it.so_luong_thuc_te ?? 0), 0)
        const loi = p.items.reduce((s, it) => s + (it.so_luong_loi ?? 0), 0)
        return <Text strong style={{ color: '#389e0d' }}>{fmtN(tt - loi)}</Text>
      },
    },
    {
      title: '', width: 50,
      render: (_: unknown, p: PhieuNhapPhoiSong) => (
        <Button size="small" icon={<PrinterOutlined />} onClick={() => onPrint(p, soLenh)} />
      ),
    },
  ]

  return (
    <div style={{ padding: '4px 16px 12px 40px' }}>
      <Table<PhieuNhapPhoiSong>
        rowKey="id" size="small" pagination={false} dataSource={phieus} columns={cols}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={4} align="right">
              <Text strong>Tổng ({phieus.length} phiếu):</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="right"><Text strong>{fmtN(tong_tt)}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={2} align="right">
              {tong_loi > 0 && <Text strong style={{ color: '#cf1322' }}>{fmtN(tong_loi)}</Text>}
            </Table.Summary.Cell>
            <Table.Summary.Cell index={3} align="right">
              <Text strong style={{ color: '#389e0d' }}>{fmtN(tong_tt - tong_loi)}</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={4} />
          </Table.Summary.Row>
        )}
      />
    </div>
  )
}

// ── Tab phiếu nhập ────────────────────────────────────────────────────────────

function TabNhap() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [trangThai, setTrangThai] = useState<string | undefined>(undefined)
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const [page, setPage] = useState(1)
  const [exportLoading, setExportLoading] = useState(false)

  // Sessions: lưu giờ bắt đầu từng lệnh SX
  const [sessions, setSessions] = useState<Sessions>(readAllSessions)

  // Tạo phiếu nhập
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null)
  const [loadingOrderId, setLoadingOrderId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['prod-orders-phoi-tab', search, trangThai, dateRange, page],
    queryFn: () =>
      productionOrdersApi.list({
        search: search || undefined,
        trang_thai: trangThai,
        tu_ngay: dateRange?.[0],
        den_ngay: dateRange?.[1],
        page,
        page_size: 50,
      }).then((r) => r.data),
  })

  // ── Bắt đầu: ghi nhận giờ vào localStorage ───────────────────────────────
  const handleBatDau = (orderId: number) => {
    const session: Session = {
      ngay: dayjs().format('YYYY-MM-DD'),
      gio_bat_dau: dayjs().format('HH:mm'),
    }
    localStorage.setItem(phoiSessionKey(orderId), JSON.stringify(session))
    setSessions(prev => ({ ...prev, [orderId]: session }))
    message.success(`Đã ghi nhận giờ bắt đầu: ${session.gio_bat_dau}`)
  }

  // ── Kết thúc: load lệnh SX đầy đủ → mở modal nhập kết quả ───────────────
  const handleKetThuc = async (orderId: number) => {
    setLoadingOrderId(orderId)
    try {
      const res = await productionOrdersApi.get(orderId)
      setSelectedOrder(res.data)
    } catch {
      message.error('Không thể tải thông tin lệnh SX')
    } finally {
      setLoadingOrderId(null)
    }
  }

  const handlePhieuSuccess = () => {
    if (selectedOrder) {
      // Xóa session sau khi tạo phiếu thành công (modal cũng tự xóa, nhưng sync state)
      setSessions(prev => {
        const next = { ...prev }
        delete next[selectedOrder.id]
        return next
      })
      qc.invalidateQueries({ queryKey: ['phieu-nhap-per-order', selectedOrder.id] })
      qc.invalidateQueries({ queryKey: ['prod-orders-phoi-tab'] })
    }
    setSelectedOrder(null)
  }

  // ── Hàm in phiếu ─────────────────────────────────────────────────────────
  const handlePrint = (phieu: PhieuNhapPhoiSong, soLenh: string) => {
    const ngayFmt = fmtDate(phieu.ngay)
    const duration = calcDuration(phieu.gio_bat_dau, phieu.gio_ket_thuc)
    const tong_tt = phieu.items.reduce((s, it) => s + (it.so_luong_thuc_te ?? 0), 0)
    const tong_loi = phieu.items.reduce((s, it) => s + (it.so_luong_loi ?? 0), 0)

    const rows = phieu.items.map((it, i) => {
      const sl_thuc = it.so_luong_thuc_te
      const sl_loi = it.so_luong_loi
      const sl_nhap = sl_thuc != null ? sl_thuc - (sl_loi ?? 0) : null
      return `<tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${it.ten_hang ?? '—'}</td>
        <td style="text-align:center">${it.chieu_kho != null ? it.chieu_kho : '—'}</td>
        <td style="text-align:center">${it.chieu_cat != null ? it.chieu_cat : '—'}</td>
        <td style="text-align:right">${fmtN(it.so_luong_ke_hoach)}</td>
        <td style="text-align:right">${sl_thuc != null ? fmtN(sl_thuc) : ''}</td>
        <td style="text-align:right;color:#cf1322">${sl_loi ? fmtN(sl_loi) : ''}</td>
        <td style="text-align:right;font-weight:600;color:#389e0d">${sl_nhap != null ? fmtN(sl_nhap) : ''}</td>
        <td style="text-align:center">${it.so_tam ?? ''}</td>
        <td>${it.ghi_chu ?? ''}</td>
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${phieu.so_phieu}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px;padding:20px}
    h2{font-size:16px;text-align:center;margin-bottom:6px}.info{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;border:1px solid #ccc;padding:8px;margin-bottom:12px;border-radius:4px}
    .lbl{font-size:10px;color:#777}.val{font-weight:600;font-size:13px}
    table{width:100%;border-collapse:collapse;margin-bottom:16px}
    th{background:#f0f0f0;padding:5px 6px;border:1px solid #ccc;font-size:11px;text-align:center}
    td{padding:4px 6px;border:1px solid #ddd;font-size:11px;vertical-align:middle}
    .sig{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:24px;text-align:center}
    .sig-label{font-weight:600;font-size:11px;margin-bottom:40px}
    @media print{@page{margin:10mm;size:A4 landscape}}</style></head><body>
    <div style="text-align:center;margin-bottom:12px">
      <div style="font-size:11px;color:#555">CÔNG TY CP BAO BÌ NAM PHƯƠNG</div>
      <h2>PHIẾU NHẬP PHÔI SÓNG</h2>
      <div style="font-size:11px">Số phiếu: <strong>${phieu.so_phieu}</strong></div>
    </div>
    <div class="info">
      <div><div class="lbl">Lệnh SX</div><div class="val">${soLenh}</div></div>
      <div><div class="lbl">Ngày</div><div class="val">${ngayFmt}</div></div>
      <div><div class="lbl">Ca</div><div class="val">${phieu.ca ?? '—'}</div></div>
      <div><div class="lbl">Ghi chú</div><div class="val" style="font-size:11px">${phieu.ghi_chu ?? '—'}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;border:1px solid #ccc;padding:8px;margin-bottom:12px;border-radius:4px;background:#f9f9f9">
      <div><div class="lbl">Giờ bắt đầu</div><div class="val">${phieu.gio_bat_dau ?? '—'}</div></div>
      <div><div class="lbl">Giờ kết thúc</div><div class="val">${phieu.gio_ket_thuc ?? '—'}</div></div>
      <div><div class="lbl">Thời gian TH</div><div class="val">${duration}</div></div>
    </div>
    <table><thead><tr>
      <th width="32">STT</th><th>Tên hàng</th>
      <th width="68">Chiều khổ</th><th width="68">Chiều cắt</th>
      <th width="75">SL kế hoạch</th><th width="75">SL thực tế</th>
      <th width="65">Phôi lỗi</th><th width="75">Nhập kho</th>
      <th width="50">Số tấm</th><th>Ghi chú</th>
    </tr></thead><tbody>${rows}</tbody>
    <tfoot><tr style="background:#f5f5f5;font-weight:600">
      <td colspan="5" style="text-align:right;padding:5px 6px">Tổng cộng:</td>
      <td style="text-align:right;padding:5px 6px">${fmtN(tong_tt)}</td>
      <td style="text-align:right;padding:5px 6px;color:#cf1322">${tong_loi ? fmtN(tong_loi) : ''}</td>
      <td style="text-align:right;padding:5px 6px;color:#389e0d">${fmtN(tong_tt - tong_loi)}</td>
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

  // ── Hàm chung: tải phiếu nhập theo đúng bộ lọc đang active ─────────────
  const fetchFilteredPhieu = async () => {
    // 1. Lấy tất cả lệnh SX theo filter hiện tại (không phân trang)
    const ordersRes = await productionOrdersApi.list({
      search: search || undefined,
      trang_thai: trangThai,
      tu_ngay: dateRange?.[0],
      den_ngay: dateRange?.[1],
      page: 1,
      page_size: 9999,
    })
    const orders = ordersRes.data.items
    if (!orders.length) return []

    // 2. Lấy phiếu nhập của từng lệnh SX song song
    const results = await Promise.all(
      orders.map(o =>
        client
          .get<PhieuNhapPhoiSong[]>(`/production-orders/${o.id}/phieu-nhap-phoi-song`)
          .then(r => ({ order: o, phieus: r.data }))
          .catch(() => ({ order: o, phieus: [] as PhieuNhapPhoiSong[] }))
      )
    )
    // Chỉ giữ các lệnh có phiếu nhập
    return results.filter(r => r.phieus.length > 0)
  }

  // ── Export Excel ──────────────────────────────────────────────────────────
  const handleExportExcel = async () => {
    setExportLoading(true)
    const hide = message.loading('Đang tải dữ liệu...', 0)
    try {
      const grouped = await fetchFilteredPhieu()
      hide()
      if (!grouped.length) { message.warning('Không có phiếu nhập nào trong bộ lọc này'); return }

      const wb = XLSX.utils.book_new()

      // Sheet 1: Tổng hợp — mỗi dòng = 1 phiếu
      const summaryHeader = [
        'STT', 'Số phiếu', 'Lệnh SX', 'Mã/Tên hàng', 'Khách hàng', 'Ngày', 'Ca',
        'Giờ bắt đầu', 'Giờ kết thúc', 'Thời gian thực hiện',
        'SL thực tế', 'Phôi lỗi', 'Nhập kho',
      ]
      const summaryRows: any[][] = []
      let sttPhieu = 0
      grouped.forEach(({ order, phieus }) => {
        phieus.forEach(p => {
          sttPhieu++
          const tong_tt = p.items.reduce((s, it) => s + (it.so_luong_thuc_te ?? 0), 0)
          const tong_loi = p.items.reduce((s, it) => s + (it.so_luong_loi ?? 0), 0)
          summaryRows.push([
            sttPhieu, p.so_phieu, order.so_lenh,
            order.ten_hang ?? '', order.ten_khach_hang ?? '',
            dayjs(p.ngay).format('DD/MM/YYYY'), p.ca ?? '',
            p.gio_bat_dau ?? '', p.gio_ket_thuc ?? '',
            calcDuration(p.gio_bat_dau, p.gio_ket_thuc),
            tong_tt, tong_loi, tong_tt - tong_loi,
          ])
        })
      })
      const totalTT = summaryRows.reduce((s, r) => s + (r[10] ?? 0), 0)
      const totalLoi = summaryRows.reduce((s, r) => s + (r[11] ?? 0), 0)
      summaryRows.push(['', 'TỔNG CỘNG', '', '', '', '', '', '', '', '',
        totalTT, totalLoi, totalTT - totalLoi])
      const ws1 = XLSX.utils.aoa_to_sheet([summaryHeader, ...summaryRows])
      ws1['!cols'] = [
        { wch: 5 }, { wch: 18 }, { wch: 14 }, { wch: 28 }, { wch: 20 }, { wch: 12 }, { wch: 6 },
        { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
      ]
      XLSX.utils.book_append_sheet(wb, ws1, 'Tổng hợp phiếu')

      // Sheet 2: Chi tiết — mỗi dòng = 1 item trong phiếu
      const detailHeader = [
        'Số phiếu', 'Lệnh SX', 'Mã/Tên hàng', 'Khách hàng', 'Ngày', 'Ca',
        'Giờ BD', 'Giờ KT', 'Thời gian TH',
        'Tên hàng (item)', 'Chiều khổ', 'Chiều cắt',
        'SL kế hoạch', 'SL thực tế', 'Phôi lỗi', 'Nhập kho', 'Số tấm', 'Ghi chú',
      ]
      const detailRows: any[][] = []
      grouped.forEach(({ order, phieus }) => {
        phieus.forEach(p => {
          const dur = calcDuration(p.gio_bat_dau, p.gio_ket_thuc)
          if (!p.items.length) {
            detailRows.push([
              p.so_phieu, order.so_lenh, order.ten_hang ?? '', order.ten_khach_hang ?? '',
              dayjs(p.ngay).format('DD/MM/YYYY'), p.ca ?? '',
              p.gio_bat_dau ?? '', p.gio_ket_thuc ?? '', dur,
              '(không có hàng)', '', '', '', '', '', '', '', '',
            ])
          } else {
            p.items.forEach(it => {
              const nhap = (it.so_luong_thuc_te ?? 0) - (it.so_luong_loi ?? 0)
              detailRows.push([
                p.so_phieu, order.so_lenh, order.ten_hang ?? '', order.ten_khach_hang ?? '',
                dayjs(p.ngay).format('DD/MM/YYYY'), p.ca ?? '',
                p.gio_bat_dau ?? '', p.gio_ket_thuc ?? '', dur,
                it.ten_hang ?? '', it.chieu_kho ?? '', it.chieu_cat ?? '',
                it.so_luong_ke_hoach ?? 0, it.so_luong_thuc_te ?? '',
                it.so_luong_loi ?? '', nhap > 0 ? nhap : '',
                it.so_tam ?? '', it.ghi_chu ?? '',
              ])
            })
          }
        })
      })
      const ws2 = XLSX.utils.aoa_to_sheet([detailHeader, ...detailRows])
      ws2['!cols'] = [
        { wch: 18 }, { wch: 14 }, { wch: 28 }, { wch: 20 }, { wch: 12 }, { wch: 6 },
        { wch: 8 }, { wch: 8 }, { wch: 18 },
        { wch: 28 }, { wch: 10 }, { wch: 10 },
        { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 20 },
      ]
      XLSX.utils.book_append_sheet(wb, ws2, 'Chi tiết')
      XLSX.writeFile(wb, `PhieuNhapPhoi_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`)
      message.success(`Đã xuất ${sttPhieu} phiếu (${grouped.length} lệnh SX)`)
    } catch (err: unknown) {
      hide()
      message.error(`Lỗi xuất Excel: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setExportLoading(false)
    }
  }

  const handleExportPdf = async () => {
    const win = window.open('', '_blank')
    if (!win) { message.error('Trình duyệt đang chặn popup.'); return }
    win.document.write('<html><head><meta charset="utf-8"/></head><body style="font-family:Arial;padding:30px"><p>⏳ Đang tải dữ liệu...</p></body></html>')
    setExportLoading(true)
    try {
      const grouped = await fetchFilteredPhieu()
      if (!grouped.length) { win.close(); message.warning('Không có phiếu nhập nào trong bộ lọc này'); return }

      const dateStr = dayjs().format('DD/MM/YYYY HH:mm')
      let tongPhieu = 0
      let tongThucTe = 0; let tongLoi = 0; let stt = 0

      grouped.forEach(({ phieus }) => {
        phieus.forEach(p => {
          tongPhieu++
          tongThucTe += p.items.reduce((s, it) => s + (it.so_luong_thuc_te ?? 0), 0)
          tongLoi += p.items.reduce((s, it) => s + (it.so_luong_loi ?? 0), 0)
        })
      })
      const tongNhap = tongThucTe - tongLoi

      const flatRows = grouped.flatMap(({ order, phieus }) =>
        phieus.flatMap(p => {
          const dur = calcDuration(p.gio_bat_dau, p.gio_ket_thuc)
          if (!p.items.length) {
            stt++
            return [`<tr style="background:${stt % 2 === 0 ? '#f9f9f9' : '#fff'}">
              <td style="text-align:center">${stt}</td>
              <td style="font-family:monospace;font-size:10px">${p.so_phieu}</td>
              <td>${order.so_lenh}</td>
              <td>${order.ten_hang ?? '—'}</td>
              <td>${order.ten_khach_hang ?? '—'}</td>
              <td style="text-align:center">${fmtDate(p.ngay)}</td>
              <td style="text-align:center">${p.ca ?? '—'}</td>
              <td style="text-align:center">${p.gio_bat_dau ?? '—'}</td>
              <td style="text-align:center">${p.gio_ket_thuc ?? '—'}</td>
              <td style="text-align:center">${dur}</td>
              <td style="color:#888;font-style:italic">(không có hàng)</td>
              <td></td><td></td><td></td><td></td><td></td><td></td>
            </tr>`]
          }
          return p.items.map(it => {
            stt++
            const nhap = (it.so_luong_thuc_te ?? 0) - (it.so_luong_loi ?? 0)
            return `<tr style="background:${stt % 2 === 0 ? '#f9f9f9' : '#fff'}">
              <td style="text-align:center">${stt}</td>
              <td style="font-family:monospace;font-size:10px">${p.so_phieu}</td>
              <td>${order.so_lenh}</td>
              <td>${order.ten_hang ?? '—'}</td>
              <td>${order.ten_khach_hang ?? '—'}</td>
              <td style="text-align:center">${fmtDate(p.ngay)}</td>
              <td style="text-align:center">${p.ca ?? '—'}</td>
              <td style="text-align:center">${p.gio_bat_dau ?? '—'}</td>
              <td style="text-align:center">${p.gio_ket_thuc ?? '—'}</td>
              <td style="text-align:center">${dur}</td>
              <td>${it.ten_hang ?? '—'}</td>
              <td style="text-align:center">${it.chieu_kho != null ? it.chieu_kho : ''}</td>
              <td style="text-align:center">${it.chieu_cat != null ? it.chieu_cat : ''}</td>
              <td style="text-align:right">${fmtN(it.so_luong_ke_hoach)}</td>
              <td style="text-align:right">${it.so_luong_thuc_te != null ? fmtN(it.so_luong_thuc_te) : ''}</td>
              <td style="text-align:right;color:#c00">${it.so_luong_loi ? fmtN(it.so_luong_loi) : ''}</td>
              <td style="text-align:right;font-weight:700;color:#1a7a1a">${it.so_luong_thuc_te != null ? fmtN(nhap) : ''}</td>
            </tr>`
          })
        })
      ).join('')

      // Lọc mô tả
      const filterDesc = [
        search ? `Tìm: "${search}"` : '',
        trangThai ? `Trạng thái: ${TRANG_THAI_LABELS[trangThai] ?? trangThai}` : '',
        dateRange ? `Từ ${fmtDate(dateRange[0])} đến ${fmtDate(dateRange[1])}` : '',
      ].filter(Boolean).join(' &nbsp;·&nbsp; ') || 'Tất cả lệnh SX'

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>Phiếu nhập phôi sóng - ${dateStr}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:16px}
        .page-header{text-align:center;margin-bottom:14px}.company{font-size:10px;color:#666;margin-bottom:2px}
        h2{font-size:15px;font-weight:bold;text-transform:uppercase}.meta{font-size:10px;color:#555;margin-top:4px}
        .filter-badge{display:inline-block;background:#e6f4ff;border:1px solid #91caff;border-radius:4px;padding:2px 8px;font-size:10px;margin-top:4px}
        table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px}
        th{background:#1677ff;color:#fff;padding:5px 6px;border:1px solid #1677ff;text-align:center;font-weight:600;white-space:nowrap}
        td{padding:4px 6px;border:1px solid #ddd;vertical-align:middle}
        tfoot td{background:#f0f4ff;font-weight:700;border-top:2px solid #1677ff}
        .totals-box{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:8px 0 14px}
        .tot{border:1px solid #ddd;padding:8px 12px;border-radius:6px;text-align:center}
        .tot .lbl{font-size:10px;color:#777}.tot .val{font-size:16px;font-weight:700;margin-top:2px}
        @media print{@page{margin:8mm;size:A4 landscape}}
      </style></head><body>
      <div class="page-header">
        <div class="company">CÔNG TY CP BAO BÌ NAM PHƯƠNG</div>
        <h2>DANH SÁCH PHIẾU NHẬP PHÔI SÓNG</h2>
        <div class="meta">Xuất lúc: ${dateStr} &nbsp;|&nbsp; ${tongPhieu} phiếu &nbsp;·&nbsp; ${grouped.length} lệnh SX &nbsp;·&nbsp; ${stt} dòng hàng</div>
        <div class="filter-badge">Bộ lọc: ${filterDesc}</div>
      </div>
      <div class="totals-box">
        <div class="tot"><div class="lbl">Tổng SL thực tế</div><div class="val">${fmtN(tongThucTe)}</div></div>
        <div class="tot"><div class="lbl">Phôi lỗi</div><div class="val" style="color:#c00">${fmtN(tongLoi)}</div></div>
        <div class="tot"><div class="lbl">Tổng nhập kho</div><div class="val" style="color:#1a7a1a">${fmtN(tongNhap)}</div></div>
      </div>
      <table><thead><tr>
        <th width="28">STT</th><th width="100">Số phiếu</th><th width="82">Lệnh SX</th>
        <th>Mã/Tên hàng</th><th width="90">Khách hàng</th>
        <th width="72">Ngày</th><th width="34">Ca</th>
        <th width="44">Giờ BD</th><th width="44">Giờ KT</th><th width="82">Thời gian TH</th>
        <th>Tên hàng</th><th width="52">C. khổ</th><th width="52">C. cắt</th>
        <th width="62">SL kế hoạch</th><th width="62">SL thực tế</th>
        <th width="56">Phôi lỗi</th><th width="62">Nhập kho</th>
      </tr></thead>
      <tbody>${flatRows}</tbody>
      <tfoot><tr>
        <td colspan="14" style="text-align:right">TỔNG CỘNG (${tongPhieu} phiếu · ${grouped.length} lệnh SX · ${stt} dòng):</td>
        <td style="text-align:right">${fmtN(tongThucTe)}</td>
        <td style="text-align:right;color:#c00">${tongLoi > 0 ? fmtN(tongLoi) : ''}</td>
        <td style="text-align:right;color:#1a7a1a">${fmtN(tongNhap)}</td>
      </tr></tfoot></table>
      <script>window.onload=()=>{window.print()}</script>
      </body></html>`
      win.document.open(); win.document.write(html); win.document.close()
    } catch (err: unknown) {
      win.close()
      message.error(`Lỗi xuất PDF: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setExportLoading(false)
    }
  }

  // ── Gom nhóm lệnh SX theo đơn hàng ────────────────────────────────────────
  const groups = useMemo(() => groupOrders(data?.items ?? []), [data?.items])

  // ── Cột bảng con (lệnh SX bên trong đơn hàng) ────────────────────────────
  const orderColumns: ColumnsType<ProductionOrderListItem> = [
    {
      title: 'Lệnh SX / Mã hàng',
      render: (_, o) => (
        <Space direction="vertical" size={1}>
          <Text code style={{ fontSize: 12 }}>{o.so_lenh}</Text>
          {o.ten_hang && <Text style={{ fontSize: 12, fontWeight: 500 }}>{o.ten_hang}</Text>}
        </Space>
      ),
    },
    {
      title: 'Ngày lệnh',
      dataIndex: 'ngay_lenh',
      width: 100,
      render: (v: string) => fmtDate(v),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 115,
      render: (v: string) => (
        <Tag color={TRANG_THAI_COLORS[v] ?? 'default'} style={{ fontSize: 11 }}>
          {TRANG_THAI_LABELS[v] ?? v}
        </Tag>
      ),
    },
    {
      title: 'SL kế hoạch',
      dataIndex: 'tong_sl_ke_hoach',
      width: 110,
      align: 'right' as const,
      render: (v: number) => <Text strong>{fmtN(v)}</Text>,
    },
    {
      title: 'Ngày HT KH',
      dataIndex: 'ngay_hoan_thanh_ke_hoach',
      width: 105,
      render: (v: string | null) => fmtDate(v),
    },
    {
      title: 'Phiên sản xuất',
      width: 155,
      render: (_, o) => {
        const session = sessions[o.id]
        if (!session) return <Text type="secondary" style={{ fontSize: 11 }}>Chưa bắt đầu</Text>
        return (
          <Space direction="vertical" size={2}>
            <Tag icon={<ClockCircleOutlined />} color="processing" style={{ fontSize: 11 }}>
              Bắt đầu: {session.gio_bat_dau}
            </Tag>
            <Text type="secondary" style={{ fontSize: 10 }}>{fmtDate(session.ngay)}</Text>
          </Space>
        )
      },
    },
    {
      title: 'Thao tác',
      width: 160,
      align: 'center' as const,
      render: (_, o) => {
        const session = sessions[o.id]
        const isDone = o.trang_thai === 'hoan_thanh' || o.trang_thai === 'huy'
        if (isDone) {
          return (
            <Tag color={o.trang_thai === 'hoan_thanh' ? 'green' : 'red'} style={{ fontSize: 11 }}>
              {TRANG_THAI_LABELS[o.trang_thai]}
            </Tag>
          )
        }
        if (session) {
          return (
            <Button size="small" type="primary" danger icon={<StopOutlined />}
              loading={loadingOrderId === o.id} onClick={() => handleKetThuc(o.id)}>
              Kết thúc
            </Button>
          )
        }
        return (
          <Space size={4}>
            <Button size="small" type="primary" icon={<PlayCircleOutlined />}
              onClick={() => handleBatDau(o.id)}
              style={{ background: '#52c41a', borderColor: '#52c41a' }}>
              Bắt đầu
            </Button>
            <Tooltip title="Tạo phiếu không cần bắt đầu phiên">
              <Button size="small" icon={<PlusOutlined />}
                loading={loadingOrderId === o.id} onClick={() => handleKetThuc(o.id)} />
            </Tooltip>
          </Space>
        )
      },
    },
  ]

  // ── Cột bảng cha (đơn hàng) ───────────────────────────────────────────────
  const groupColumns: ColumnsType<DonHangGroup> = [
    {
      title: 'Đơn hàng',
      render: (_, g) => g.so_don ? (
        <Space direction="vertical" size={1}>
          <Text strong style={{ fontSize: 13, color: '#1677ff' }}>{g.so_don}</Text>
          {g.ten_khach_hang && (
            <Text type="secondary" style={{ fontSize: 12 }}>{g.ten_khach_hang}</Text>
          )}
        </Space>
      ) : (
        <Text type="secondary" style={{ fontStyle: 'italic', fontSize: 12 }}>Lệnh SX độc lập</Text>
      ),
    },
    {
      title: 'Số lệnh SX',
      width: 100,
      align: 'center' as const,
      render: (_, g) => (
        <Tag color="blue" style={{ fontSize: 12 }}>{g.so_lenh_count} lệnh</Tag>
      ),
    },
    {
      title: 'Tổng SL kế hoạch',
      width: 145,
      align: 'right' as const,
      render: (_, g) => <Text strong>{fmtN(g.tong_sl)}</Text>,
    },
    {
      title: 'Đang SX',
      width: 110,
      align: 'center' as const,
      render: (_, g) => {
        const active = g.orders.filter(o => sessions[o.id]).length
        if (!active) return null
        return (
          <Tag color="processing" icon={<ClockCircleOutlined />} style={{ fontSize: 11 }}>
            {active} đang chạy
          </Tag>
        )
      },
    },
  ]

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      {/* Bộ lọc */}
      <Row gutter={[8, 8]} align="middle" justify="space-between" wrap>
        <Col>
          <Space wrap>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Số lệnh SX / mã hàng..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              allowClear
              style={{ width: 220 }}
            />
            <Select
              placeholder="Trạng thái"
              allowClear
              style={{ width: 130 }}
              value={trangThai}
              onChange={(v) => { setTrangThai(v); setPage(1) }}
              options={Object.entries(TRANG_THAI_LABELS).map(([k, v]) => ({ value: k, label: v }))}
            />
            <RangePicker
              format="DD/MM/YYYY"
              style={{ width: 240 }}
              placeholder={['Từ ngày lệnh', 'Đến ngày']}
              onChange={(v) => {
                setDateRange(v ? [v[0]!.format('YYYY-MM-DD'), v[1]!.format('YYYY-MM-DD')] : null)
                setPage(1)
              }}
            />
          </Space>
        </Col>
        <Col>
          <Space>
            <Tooltip title="Xuất Excel (tổng hợp + chi tiết)">
              <Button icon={<FileExcelOutlined />} loading={exportLoading} onClick={handleExportExcel}
                style={{ color: '#217346', borderColor: '#217346' }}>Excel</Button>
            </Tooltip>
            <Tooltip title="Xuất PDF / In danh sách">
              <Button icon={<FilePdfOutlined />} loading={exportLoading} onClick={handleExportPdf}
                style={{ color: '#e53935', borderColor: '#e53935' }}>PDF</Button>
            </Tooltip>
          </Space>
        </Col>
      </Row>

      {/* Bảng cha: Đơn hàng — expand ra các lệnh SX (mã hàng) bên trong */}
      <Table<DonHangGroup>
        rowKey="key"
        size="small"
        loading={isLoading}
        dataSource={groups}
        columns={groupColumns}
        defaultExpandAllRows
        expandable={{
          expandedRowRender: (g) => (
            <div style={{ padding: '2px 0 10px 36px', background: '#fafafa' }}>
              <Table<ProductionOrderListItem>
                rowKey="id"
                size="small"
                dataSource={g.orders}
                columns={orderColumns}
                pagination={false}
                rowClassName={(o) => sessions[o.id] ? 'ant-table-row-selected' : ''}
                expandable={{
                  expandedRowRender: (o) => (
                    <PhieuNhapForOrder orderId={o.id} soLenh={o.so_lenh} onPrint={handlePrint} />
                  ),
                  rowExpandable: () => true,
                }}
                scroll={{ x: 820 }}
              />
            </div>
          ),
        }}
        pagination={false}
        scroll={{ x: 700 }}
      />

      {/* Phân trang lệnh SX (điều khiển fetch API) */}
      {(data?.total ?? 0) > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {groups.length} đơn hàng &nbsp;·&nbsp; {data?.total} lệnh SX
          </Text>
          <Pagination
            total={data?.total}
            current={page}
            pageSize={50}
            onChange={setPage}
            showSizeChanger={false}
            size="small"
          />
        </div>
      )}

      {/* Modal nhập kết quả — mở khi bấm Kết thúc */}
      {selectedOrder && (
        <PhieuNhapPhoiSongModal
          open
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onSuccess={handlePhieuSuccess}
        />
      )}
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
        expandable={{
          expandedRowRender: (p: PhieuXuat) => (
            <Table rowKey="id" size="small" pagination={false} dataSource={p.items}
              columns={[
                { title: 'Tên hàng', dataIndex: 'ten_hang' },
                { title: 'SL xuất', dataIndex: 'so_luong', width: 100, align: 'right' as const, render: fmtN },
                { title: 'Ghi chú', dataIndex: 'ghi_chu', render: (v: string | null) => v ?? '—' },
              ]} />
          ),
          rowExpandable: (r: PhieuXuat) => r.items.length > 0,
        }}
        pagination={{ total: data?.total, current: page, pageSize: 30, showTotal: t => `${t} phiếu`, onChange: setPage, showSizeChanger: false }}
        scroll={{ x: 700 }}
      />

      <Modal
        open={modalOpen}
        title="Tạo phiếu xuất phôi sóng"
        width={720}
        onCancel={() => {
          setModalOpen(false); setCa(null)
          setNgay(dayjs().format('YYYY-MM-DD'))
          setGhiChu(''); setXuatRows([{ ten_hang: '', so_luong: null, ghi_chu: '' }])
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

        <Table rowKey={(_, i) => String(i)} size="small" pagination={false} dataSource={xuatRows}
          columns={[
            {
              title: 'Tên hàng / Mã phôi',
              render: (_: unknown, r: XuatRowState, i: number) => (
                <Input size="small" value={r.ten_hang} placeholder="Tên hàng..."
                  onChange={e => updateXuatRow(i, { ten_hang: e.target.value })} />
              ),
            },
            {
              title: 'SL xuất', width: 110,
              render: (_: unknown, r: XuatRowState, i: number) => (
                <InputNumber size="small" style={{ width: 100 }} min={0} value={r.so_luong ?? undefined}
                  placeholder="Số lượng" onChange={v => updateXuatRow(i, { so_luong: v ?? null })} />
              ),
            },
            {
              title: 'Ghi chú',
              render: (_: unknown, r: XuatRowState, i: number) => (
                <Input size="small" value={r.ghi_chu} onChange={e => updateXuatRow(i, { ghi_chu: e.target.value })} />
              ),
            },
            {
              title: '', width: 40,
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PhieuPhoiPage() {
  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 16 }}>Quản lý phiếu phôi sóng</Title>
      <Card>
        <Tabs
          defaultActiveKey="nhap"
          items={[
            { key: 'nhap', label: 'Phiếu nhập phôi', children: <TabNhap /> },
            { key: 'xuat', label: 'Phiếu xuất phôi', children: <TabXuat /> },
          ]}
        />
      </Card>
    </div>
  )
}
