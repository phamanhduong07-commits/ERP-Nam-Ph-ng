import { useState } from 'react'
import {
  Button, DatePicker, Form, Input, InputNumber, message,
  Modal, Select, Space, Table, TimePicker, Tag, Typography,
} from 'antd'
import { PrinterOutlined, CheckOutlined, ClockCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { productionOrdersApi } from '../../api/productionOrders'
import type { ProductionOrder, PhieuNhapPhoiSong, ProductionOrderItem } from '../../api/productionOrders'
import { fmtN } from '../../utils/exportUtils'
import { calcBoxDimensions } from '../../api/quotes'

// Làm tròn lên bội số 5 (giống SxParamsTab)
const roundUpTo5 = (v: number) => Math.ceil(v / 5) * 5

// Lấy chiều khổ: ưu tiên kho_tt đã lưu, fallback tính từ kích thước thùng
function getChieuKho(oi: ProductionOrderItem): number | null {
  if (oi.kho_tt != null) return Number(oi.kho_tt)
  const dims = calcBoxDimensions(
    oi.loai_thung,
    oi.dai != null ? Number(oi.dai) : null,
    oi.rong != null ? Number(oi.rong) : null,
    oi.cao != null ? Number(oi.cao) : null,
    oi.so_lop ?? (oi.product?.so_lop ?? 3),
  )
  if (!dims || !dims.kho_tt) return null
  return roundUpTo5(dims.kho_tt)
}

// Lấy chiều cắt: ưu tiên dai_tt đã lưu, fallback tính từ kích thước thùng
function getChieuCat(oi: ProductionOrderItem): number | null {
  if (oi.dai_tt != null) return Number(oi.dai_tt)
  const dims = calcBoxDimensions(
    oi.loai_thung,
    oi.dai != null ? Number(oi.dai) : null,
    oi.rong != null ? Number(oi.rong) : null,
    oi.cao != null ? Number(oi.cao) : null,
    oi.so_lop ?? (oi.product?.so_lop ?? 3),
  )
  return dims?.dai_tt ?? null
}

const { Text, Title } = Typography

// localStorage key lưu phiên bắt đầu
export const phoiSessionKey = (orderId: number) => `phoi-session-${orderId}`

interface RowState {
  poi_id: number
  ten_hang: string
  so_luong_ke_hoach: number
  so_luong_thuc_te: number | null
  so_luong_loi: number | null
  so_tam: number | null
  ghi_chu: string | null
}

interface Props {
  open: boolean
  order: ProductionOrder
  onClose: () => void
  onSuccess: () => void
}

function getStoredSession(orderId: number): { ngay: string; gio_bat_dau: string } | null {
  try {
    const raw = localStorage.getItem(phoiSessionKey(orderId))
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return null
}

export default function PhieuNhapPhoiSongModal({ open, order, onClose, onSuccess }: Props) {
  const session = getStoredSession(order.id)

  const [ngay, setNgay] = useState(session?.ngay ?? dayjs().format('YYYY-MM-DD'))
  const [ca, setCa] = useState<string | null>(null)
  const [ghiChu, setGhiChu] = useState('')
  const [gioBatDau, setGioBatDau] = useState<dayjs.Dayjs | null>(
    session?.gio_bat_dau ? dayjs(session.gio_bat_dau, 'HH:mm') : dayjs()
  )
  const [gioKetThuc, setGioKetThuc] = useState<dayjs.Dayjs | null>(dayjs())

  const [rows, setRows] = useState<RowState[]>(() =>
    order.items.map(it => ({
      poi_id: it.id,
      ten_hang: it.ten_hang,
      so_luong_ke_hoach: Number(it.so_luong_ke_hoach),
      so_luong_thuc_te: null,
      so_luong_loi: null,
      so_tam: null,
      ghi_chu: null,
    }))
  )
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PhieuNhapPhoiSong | null>(null)

  const updateRow = (poi_id: number, patch: Partial<RowState>) =>
    setRows(prev => prev.map(r => r.poi_id === poi_id ? { ...r, ...patch } : r))

  // Tính thời gian thực hiện
  const getDuration = (): string | null => {
    if (!gioBatDau || !gioKetThuc) return null
    const diffMin = gioKetThuc.diff(gioBatDau, 'minute')
    if (diffMin <= 0) return null
    const h = Math.floor(diffMin / 60)
    const m = diffMin % 60
    return h > 0 ? `${h} giờ ${m} phút` : `${m} phút`
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const res = await productionOrdersApi.createPhieu(order.id, {
        ngay,
        ca: ca || null,
        ghi_chu: ghiChu || null,
        gio_bat_dau: gioBatDau?.format('HH:mm') ?? null,
        gio_ket_thuc: gioKetThuc?.format('HH:mm') ?? null,
        items: rows.map(r => {
          const oi = order.items.find(i => i.id === r.poi_id)
          return {
            production_order_item_id: r.poi_id,
            so_luong_ke_hoach: r.so_luong_ke_hoach,
            so_luong_thuc_te: r.so_luong_thuc_te,
            so_luong_loi: r.so_luong_loi,
            chieu_kho: oi ? getChieuKho(oi) : null,  // tự động từ lệnh SX (fallback tính từ kích thước)
            chieu_cat: oi ? getChieuCat(oi) : null,  // tự động từ lệnh SX (fallback tính từ kích thước)
            so_tam: r.so_tam,
            ghi_chu: r.ghi_chu,
          }
        }),
      })
      // Xóa phiên khỏi localStorage sau khi tạo phiếu thành công
      localStorage.removeItem(phoiSessionKey(order.id))
      setResult(res.data)
      message.success(`Đã tạo ${res.data.so_phieu}`)
      onSuccess()
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Lỗi tạo phiếu')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = (phieu: PhieuNhapPhoiSong) => {
    const ngayFmt = dayjs(phieu.ngay).format('DD/MM/YYYY')
    const duration = (() => {
      if (!phieu.gio_bat_dau || !phieu.gio_ket_thuc) return null
      const bd = dayjs(`2000-01-01 ${phieu.gio_bat_dau}`)
      const kt = dayjs(`2000-01-01 ${phieu.gio_ket_thuc}`)
      const diff = kt.diff(bd, 'minute')
      if (diff <= 0) return null
      const h = Math.floor(diff / 60); const m = diff % 60
      return h > 0 ? `${h} giờ ${m} phút` : `${m} phút`
    })()

    const itemRows = phieu.items.map((it, i) => {
      const orderItem = order.items.find(oi => oi.id === it.production_order_item_id)
      const dims = orderItem
        ? [orderItem.dai, orderItem.rong, orderItem.cao].filter(Boolean).join('×')
        : ''
      const sl_thuc = it.so_luong_thuc_te
      const sl_loi = it.so_luong_loi
      const sl_nhap = sl_thuc != null ? (sl_thuc - (sl_loi ?? 0)) : null
      // chiều khổ/cắt: ưu tiên giá trị đã lưu trong phiếu, fallback tính từ kích thước thùng
      const chieuKho = it.chieu_kho != null ? it.chieu_kho : (orderItem ? getChieuKho(orderItem) : null)
      const chieuCat = it.chieu_cat != null ? it.chieu_cat : (orderItem ? getChieuCat(orderItem) : null)
      return `
        <tr>
          <td style="text-align:center">${i + 1}</td>
          <td>${orderItem?.ten_hang ?? ''}</td>
          <td style="text-align:center">${dims || '—'}</td>
          <td style="text-align:center">${orderItem?.so_lop ?? '—'}</td>
          <td style="text-align:center">${chieuKho != null ? chieuKho : ''}</td>
          <td style="text-align:center">${chieuCat != null ? chieuCat : ''}</td>
          <td style="text-align:right">${fmtN(it.so_luong_ke_hoach, 0)}</td>
          <td style="text-align:right">${sl_thuc != null ? fmtN(sl_thuc, 0) : ''}</td>
          <td style="text-align:right">${sl_loi != null ? fmtN(sl_loi, 0) : ''}</td>
          <td style="text-align:right;color:${sl_nhap != null && sl_nhap < 0 ? '#cf1322' : '#389e0d'}">${sl_nhap != null ? fmtN(sl_nhap, 0) : ''}</td>
          <td style="text-align:center">${it.so_tam ?? ''}</td>
          <td>${it.ghi_chu ?? ''}</td>
        </tr>`
    }).join('')

    const html = `<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>${phieu.so_phieu}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 20px; }
        .header { text-align: center; margin-bottom: 16px; }
        .company { font-size: 11px; color: #555; margin-bottom: 4px; }
        h2 { font-size: 16px; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; }
        .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 8px; border: 1px solid #ccc; padding: 8px; border-radius: 4px; }
        .time-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; border: 1px solid #ccc; padding: 8px; border-radius: 4px; background: #f9f9f9; }
        .meta-item .label { font-size: 10px; color: #777; }
        .meta-item .value { font-weight: 600; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th { background: #f0f0f0; font-size: 11px; padding: 5px 6px; border: 1px solid #ccc; text-align: center; }
        td { padding: 4px 6px; border: 1px solid #ddd; font-size: 11px; vertical-align: middle; }
        tr:nth-child(even) td { background: #fafafa; }
        .sig-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 24px; }
        .sig-box { text-align: center; }
        .sig-label { font-size: 11px; font-weight: 600; margin-bottom: 40px; }
        .sig-name { font-size: 11px; color: #777; }
        @media print { @page { margin: 12mm; } }
      </style>
    </head><body>
      <div class="header">
        <div class="company">CÔNG TY CP BAO BÌ NAM PHƯƠNG</div>
        <h2>PHIẾU NHẬP PHÔI SÓNG</h2>
        <div style="font-size:11px;color:#555">Số phiếu: <strong>${phieu.so_phieu}</strong></div>
      </div>
      <div class="meta-grid">
        <div class="meta-item"><div class="label">Lệnh sản xuất</div><div class="value">${order.so_lenh}</div></div>
        <div class="meta-item"><div class="label">Ngày</div><div class="value">${ngayFmt}</div></div>
        <div class="meta-item"><div class="label">Ca sản xuất</div><div class="value">${phieu.ca ?? '—'}</div></div>
        <div class="meta-item"><div class="label">Khách hàng</div><div class="value">${order.ten_khach_hang ?? '—'}</div></div>
      </div>
      <div class="time-row">
        <div class="meta-item"><div class="label">Giờ bắt đầu</div><div class="value">${phieu.gio_bat_dau ?? '—'}</div></div>
        <div class="meta-item"><div class="label">Giờ kết thúc</div><div class="value">${phieu.gio_ket_thuc ?? '—'}</div></div>
        <div class="meta-item"><div class="label">Thời gian thực hiện</div><div class="value">${duration ?? '—'}</div></div>
      </div>
      ${phieu.ghi_chu ? `<p style="margin-bottom:10px;font-size:11px"><em>Ghi chú: ${phieu.ghi_chu}</em></p>` : ''}
      <table>
        <thead>
          <tr>
            <th width="32">STT</th>
            <th>Tên hàng</th>
            <th width="80">Kích thước</th>
            <th width="36">Lớp</th>
            <th width="60">Chiều khổ</th>
            <th width="60">Chiều cắt</th>
            <th width="70">SL kế hoạch</th>
            <th width="70">SL thực tế</th>
            <th width="65">Phôi lỗi</th>
            <th width="70">Nhập kho</th>
            <th width="55">Số tấm</th>
            <th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div class="sig-row">
        <div class="sig-box"><div class="sig-label">Người lập phiếu</div><div class="sig-name">(Ký, ghi rõ họ tên)</div></div>
        <div class="sig-box"><div class="sig-label">Vận hành máy sóng</div><div class="sig-name">(Ký, ghi rõ họ tên)</div></div>
        <div class="sig-box"><div class="sig-label">Quản lý sản xuất</div><div class="sig-name">(Ký, ghi rõ họ tên)</div></div>
      </div>
      <script>window.onload = () => { window.print(); }</script>
    </body></html>`

    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }

  const duration = getDuration()

  const columns: ColumnsType<RowState> = [
    {
      title: '#',
      width: 36,
      render: (_: unknown, __: RowState, i: number) => (
        <Text type="secondary" style={{ fontSize: 11 }}>{i + 1}</Text>
      ),
    },
    {
      title: 'Tên hàng',
      dataIndex: 'ten_hang',
      render: (v: string, r: RowState) => {
        const oi = order.items.find(i => i.id === r.poi_id)
        return (
          <Space direction="vertical" size={0}>
            <Text style={{ fontSize: 12 }}>{v}</Text>
            {oi && (oi.dai || oi.so_lop) && (
              <Text type="secondary" style={{ fontSize: 10 }}>
                {[oi.dai, oi.rong, oi.cao].filter(Boolean).join('×')}
                {oi.so_lop ? ` · ${oi.so_lop}L` : ''}
                {oi.to_hop_song ? ` ${oi.to_hop_song}` : ''}
              </Text>
            )}
          </Space>
        )
      },
    },
    {
      title: 'SL kế hoạch',
      dataIndex: 'so_luong_ke_hoach',
      width: 100,
      align: 'right' as const,
      render: (v: number) => <Text strong>{new Intl.NumberFormat('vi-VN').format(v)}</Text>,
    },
    {
      title: 'SL thực tế',
      width: 110,
      render: (_: unknown, r: RowState) => (
        <InputNumber
          size="small"
          style={{ width: 100 }}
          min={0}
          value={r.so_luong_thuc_te ?? undefined}
          placeholder="Thực tế"
          onChange={v => updateRow(r.poi_id, { so_luong_thuc_te: v ?? null })}
        />
      ),
    },
    {
      title: 'Phôi lỗi',
      width: 100,
      render: (_: unknown, r: RowState) => (
        <InputNumber
          size="small"
          style={{ width: 88 }}
          min={0}
          value={r.so_luong_loi ?? undefined}
          placeholder="Hư hao"
          onChange={v => updateRow(r.poi_id, { so_luong_loi: v ?? null })}
        />
      ),
    },
    {
      title: 'Chiều khổ',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, r: RowState) => {
        const oi = order.items.find(i => i.id === r.poi_id)
        const val = oi ? getChieuKho(oi) : null
        return val != null
          ? <Text style={{ fontSize: 12 }}>{val}</Text>
          : <Text type="secondary">—</Text>
      },
    },
    {
      title: 'Chiều cắt',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, r: RowState) => {
        const oi = order.items.find(i => i.id === r.poi_id)
        const val = oi ? getChieuCat(oi) : null
        return val != null
          ? <Text style={{ fontSize: 12 }}>{val}</Text>
          : <Text type="secondary">—</Text>
      },
    },
    {
      title: 'Nhập kho',
      width: 90,
      align: 'right' as const,
      render: (_: unknown, r: RowState) => {
        const net = (r.so_luong_thuc_te ?? 0) - (r.so_luong_loi ?? 0)
        return r.so_luong_thuc_te != null
          ? <Text strong style={{ color: net < 0 ? '#cf1322' : '#389e0d' }}>
              {new Intl.NumberFormat('vi-VN').format(net)}
            </Text>
          : <Text type="secondary">—</Text>
      },
    },
    {
      title: 'Số tấm',
      width: 85,
      render: (_: unknown, r: RowState) => (
        <InputNumber
          size="small"
          style={{ width: 75 }}
          min={0}
          value={r.so_tam ?? undefined}
          placeholder="Tấm"
          onChange={v => updateRow(r.poi_id, { so_tam: v ?? null })}
        />
      ),
    },
    {
      title: 'Ghi chú',
      render: (_: unknown, r: RowState) => (
        <Input
          size="small"
          value={r.ghi_chu ?? ''}
          placeholder="Ghi chú dòng..."
          onChange={e => updateRow(r.poi_id, { ghi_chu: e.target.value || null })}
        />
      ),
    },
  ]

  return (
    <Modal
      open={open}
      title={
        <Space>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Phiếu nhập phôi sóng</span>
          {session && (
            <Tag color="blue" icon={<ClockCircleOutlined />} style={{ fontSize: 11 }}>
              Phiên đang chạy
            </Tag>
          )}
        </Space>
      }
      width={980}
      onCancel={() => { setResult(null); onClose() }}
      destroyOnClose
      footer={
        result ? (
          <Space>
            <Button icon={<PrinterOutlined />} type="primary" onClick={() => handlePrint(result)}>
              In phiếu {result.so_phieu}
            </Button>
            <Button onClick={() => { setResult(null); onClose() }}>Đóng</Button>
          </Space>
        ) : (
          <Space>
            <Button onClick={onClose}>Hủy</Button>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              loading={loading}
              onClick={handleSubmit}
            >
              Tạo phiếu
            </Button>
          </Space>
        )
      }
    >
      {result ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
          <Title level={4} style={{ margin: 0 }}>Đã tạo phiếu thành công</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Số phiếu: <strong>{result.so_phieu}</strong>
          </Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Nhấn "In phiếu" để in hoặc "Đóng" để tiếp tục.
          </Text>
        </div>
      ) : (
        <>
          <Form layout="inline" style={{ marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
            <Form.Item label="Ngày" style={{ marginBottom: 8 }}>
              <DatePicker
                format="DD/MM/YYYY"
                value={dayjs(ngay)}
                onChange={d => setNgay(d ? d.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'))}
                style={{ width: 140 }}
              />
            </Form.Item>
            <Form.Item label="Ca" style={{ marginBottom: 8 }}>
              <Select
                placeholder="Chọn ca"
                allowClear
                style={{ width: 100 }}
                value={ca ?? undefined}
                onChange={v => setCa(v ?? null)}
                options={[
                  { value: 'Ca 1', label: 'Ca 1' },
                  { value: 'Ca 2', label: 'Ca 2' },
                  { value: 'Ca 3', label: 'Ca 3' },
                ]}
              />
            </Form.Item>
            <Form.Item label="Giờ bắt đầu" style={{ marginBottom: 8 }}>
              <TimePicker
                format="HH:mm"
                value={gioBatDau}
                onChange={v => setGioBatDau(v)}
                style={{ width: 100 }}
                placeholder="HH:mm"
              />
            </Form.Item>
            <Form.Item label="Giờ kết thúc" style={{ marginBottom: 8 }}>
              <TimePicker
                format="HH:mm"
                value={gioKetThuc}
                onChange={v => setGioKetThuc(v)}
                style={{ width: 100 }}
                placeholder="HH:mm"
              />
            </Form.Item>
            {duration && (
              <Form.Item style={{ marginBottom: 8 }}>
                <Tag color="green" icon={<ClockCircleOutlined />} style={{ fontSize: 12, padding: '3px 8px' }}>
                  {duration}
                </Tag>
              </Form.Item>
            )}
          </Form>
          <Form.Item label="Ghi chú" style={{ marginBottom: 12 }}>
            <Input
              style={{ width: 360 }}
              value={ghiChu}
              onChange={e => setGhiChu(e.target.value)}
              placeholder="Ghi chú phiếu..."
            />
          </Form.Item>

          <Table<RowState>
            rowKey="poi_id"
            dataSource={rows}
            columns={columns}
            size="small"
            pagination={false}
            scroll={{ x: 900 }}
          />
        </>
      )}
    </Modal>
  )
}
