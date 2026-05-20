import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Collapse,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  notification,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DownloadOutlined,
  FilterOutlined,
  MinusOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { purchaseApi, DuBaoNhuCauRow, CreatePOPayload } from '../../api/purchase'
import { suppliersApi } from '../../api/suppliers'
import { usePhapNhan, usePhanXuong } from '../../hooks/useMasterData'
import { exportToExcel, fmtVND } from '../../utils/exportUtils'

const { Text } = Typography

// ── Màu sắc & nhãn ──────────────────────────────────────────────────────────
const MUC_DO_COLOR: Record<string, string> = { cao: 'red', trung_binh: 'orange', thap: 'green' }
const MUC_DO_LABEL: Record<string, string> = { cao: 'Ưu tiên cao', trung_binh: 'Trung bình', thap: 'Thấp' }

function NgayTonBar({ days }: { days: number }) {
  const capped = Math.min(days, 60)
  const pct = Math.round((capped / 60) * 100)
  const color = days < 7 ? '#f5222d' : days < 30 ? '#faad14' : '#52c41a'
  const label = days >= 999 ? '∞' : `${days}n`
  return (
    <Tooltip title={days >= 999 ? 'Không có dữ liệu tiêu thụ' : `${days} ngày tồn kho`}>
      <div style={{ minWidth: 80 }}>
        <Progress
          percent={pct}
          strokeColor={color}
          showInfo={false}
          size="small"
          style={{ marginBottom: 2 }}
        />
        <Text style={{ fontSize: 11, color }}>{label}</Text>
      </div>
    </Tooltip>
  )
}

function XuHuongIcon({ xu_huong, pct }: { xu_huong: string; pct: number }) {
  if (xu_huong === 'tang') return (
    <Tooltip title={`Tăng ${pct}% so kỳ trước`}>
      <span style={{ color: '#f5222d', fontWeight: 600 }}>
        <ArrowUpOutlined /> {pct > 0 ? `+${pct}%` : `${pct}%`}
      </span>
    </Tooltip>
  )
  if (xu_huong === 'giam') return (
    <Tooltip title={`Giảm ${Math.abs(pct)}% so kỳ trước`}>
      <span style={{ color: '#52c41a', fontWeight: 600 }}>
        <ArrowDownOutlined /> {pct}%
      </span>
    </Tooltip>
  )
  if (xu_huong === 'moi') return <Text type="secondary" style={{ fontSize: 11 }}>Mới</Text>
  return (
    <Tooltip title="Ổn định (±10%)">
      <span style={{ color: '#8c8c8c' }}><MinusOutlined /> ổn</span>
    </Tooltip>
  )
}

// ── Biểu đồ top 10 (CSS bar chart, không cần thư viện) ──────────────────────
function TopItemsChart({ rows }: { rows: DuBaoNhuCauRow[] }) {
  const top10 = [...rows]
    .filter(r => r.can_mua_thuc > 0)
    .sort((a, b) => b.uoc_tinh_tien_mua - a.uoc_tinh_tien_mua)
    .slice(0, 10)

  if (!top10.length) return <Text type="secondary">Không có dữ liệu để hiển thị biểu đồ.</Text>

  const maxVal = top10[0].uoc_tinh_tien_mua
  return (
    <div style={{ padding: '4px 0' }}>
      {top10.map((r, i) => {
        const pct = maxVal > 0 ? (r.uoc_tinh_tien_mua / maxVal) * 100 : 0
        const barColor = r.muc_do_uu_tien === 'cao' ? '#f5222d' : r.muc_do_uu_tien === 'trung_binh' ? '#faad14' : '#52c41a'
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 8 }}>
            <Text style={{ width: 160, fontSize: 12, flexShrink: 0 }} ellipsis={{ tooltip: r.ten_hang }}>
              {r.ten_hang || r.ma_hang}
            </Text>
            <div style={{ flex: 1, background: '#f0f0f0', borderRadius: 3, height: 18, position: 'relative' }}>
              <div style={{
                width: `${pct}%`, background: barColor, height: '100%',
                borderRadius: 3, transition: 'width 0.3s',
              }} />
            </div>
            <Text style={{ width: 100, fontSize: 12, textAlign: 'right', flexShrink: 0 }}>
              {fmtVND(r.uoc_tinh_tien_mua)}
            </Text>
          </div>
        )
      })}
    </div>
  )
}

// ── Modal tạo PO nhanh ───────────────────────────────────────────────────────
interface CreatePOModalProps {
  selectedRows: DuBaoNhuCauRow[]
  onClose: () => void
  onSuccess: () => void
}

function CreatePOModal({ selectedRows, onClose, onSuccess }: CreatePOModalProps) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const { data: supplierResp } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.all().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
  const suppliers = supplierResp ?? []

  const itemsToCreate = selectedRows.filter(r => r.can_mua_thuc > 0)
  const tongUocTinh = itemsToCreate.reduce((s, r) => s + r.uoc_tinh_tien_mua, 0)

  async function handleSubmit() {
    const vals = await form.validateFields()
    setLoading(true)
    try {
      const payload: CreatePOPayload = {
        supplier_id: vals.supplier_id,
        ngay_po: dayjs().format('YYYY-MM-DD'),
        ngay_du_kien_nhan: vals.ngay_du_kien_nhan
          ? (vals.ngay_du_kien_nhan as dayjs.Dayjs).format('YYYY-MM-DD')
          : null,
        ghi_chu: vals.ghi_chu || 'Tạo từ dự báo nhu cầu',
        items: itemsToCreate.map(r => ({
          paper_material_id: r.paper_material_id,
          other_material_id: r.other_material_id,
          ten_hang: r.ten_hang,
          so_luong: r.can_mua_thuc,
          dvt: r.don_vi || (r.loai === 'giay_cuon' ? 'Kg' : 'Cái'),
          don_gia: r.don_gia_mua_gan_nhat,
        })),
      }
      const res = await purchaseApi.create(payload)
      onSuccess()
      notification.success({
        message: 'Tạo đơn mua hàng thành công',
        description: (
          <span>
            Đã tạo {itemsToCreate.length} mặt hàng.{' '}
            <Button
              type="link"
              size="small"
              style={{ padding: 0 }}
              onClick={() => navigate('/purchasing/orders')}
            >
              Xem danh sách PO →
            </Button>
          </span>
        ),
        duration: 8,
      })
      void res
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      message.error(msg ?? 'Lỗi khi tạo đơn mua hàng')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={<><ShoppingCartOutlined /> Tạo đơn mua hàng từ dự báo</>}
      open
      onCancel={onClose}
      width={720}
      footer={[
        <Button key="cancel" onClick={onClose}>Hủy</Button>,
        <Button key="submit" type="primary" loading={loading} onClick={handleSubmit}>
          Tạo đơn mua hàng
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical" size="small">
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="Nhà cung cấp" name="supplier_id" rules={[{ required: true, message: 'Chọn NCC' }]}>
              <Select
                showSearch
                placeholder="Chọn nhà cung cấp..."
                filterOption={(input, opt) =>
                  (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={suppliers.map(s => ({
                  value: s.id,
                  label: `${s.ma_ncc} — ${s.ten_viet_tat || s.ten_don_vi}`,
                }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Ngày giao dự kiến" name="ngay_du_kien_nhan">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" disabledDate={d => d.isBefore(dayjs(), 'day')} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="Ghi chú" name="ghi_chu">
          <Input placeholder="Tạo từ dự báo nhu cầu..." />
        </Form.Item>
      </Form>

      <Table
        size="small"
        dataSource={itemsToCreate}
        rowKey={r => `${r.paper_material_id}-${r.other_material_id}`}
        pagination={false}
        scroll={{ y: 200 }}
        columns={[
          { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
          { title: 'ĐVT', dataIndex: 'don_vi', width: 55 },
          { title: 'Cần mua', dataIndex: 'can_mua_thuc', align: 'right', render: v => v.toLocaleString('vi-VN') },
          { title: 'Đơn giá gần nhất', dataIndex: 'don_gia_mua_gan_nhat', align: 'right', render: fmtVND },
          {
            title: 'Ước tính',
            dataIndex: 'uoc_tinh_tien_mua',
            align: 'right',
            render: v => <Text strong>{fmtVND(v)}</Text>,
          },
        ]}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={4}><Text strong>Tổng ước tính</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">
                <Text strong style={{ color: '#1677ff' }}>{fmtVND(tongUocTinh)}</Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />

      <Alert
        style={{ marginTop: 12 }}
        type="info"
        showIcon
        message="Bút toán tự động khi duyệt Phiếu nhập kho"
        description={
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#e6f4ff' }}>
                <th style={{ padding: '4px 8px', textAlign: 'left' }}>Tài khoản</th>
                <th style={{ padding: '4px 8px', textAlign: 'left' }}>Tên TK</th>
                <th style={{ padding: '4px 8px', textAlign: 'center' }}>Nợ</th>
                <th style={{ padding: '4px 8px', textAlign: 'center' }}>Có</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '3px 8px' }}>1521 / 1522</td>
                <td style={{ padding: '3px 8px' }}>Nguyên vật liệu tồn kho</td>
                <td style={{ padding: '3px 8px', textAlign: 'center', color: '#1677ff' }}>✓</td>
                <td style={{ padding: '3px 8px', textAlign: 'center' }} />
              </tr>
              <tr style={{ background: '#fafafa' }}>
                <td style={{ padding: '3px 8px' }}>3311</td>
                <td style={{ padding: '3px 8px' }}>Phải trả nhà cung cấp</td>
                <td style={{ padding: '3px 8px', textAlign: 'center' }} />
                <td style={{ padding: '3px 8px', textAlign: 'center', color: '#389e0d' }}>✓</td>
              </tr>
            </tbody>
          </table>
        }
      />
    </Modal>
  )
}

// ── Page chính ────────────────────────────────────────────────────────────────
export default function DuBaoNhuCauPage() {
  const [thangPhanTich, setThangPhanTich] = useState(3)
  const [thangDuTru, setThangDuTru] = useState(1)
  const [loaiNvl, setLoaiNvl] = useState<string | undefined>()
  const [phanXuongId, setPhanXuongId] = useState<number | undefined>()
  const [phapNhanId, setPhapNhanId] = useState<number | undefined>()
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [showCreatePO, setShowCreatePO] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [chiCanMua, setChiCanMua] = useState(true)
  const [searchText, setSearchText] = useState('')

  const { phanXuongList } = usePhanXuong()
  const { phapNhanList } = usePhapNhan()

  const { data: rows = [], isFetching, refetch } = useQuery({
    queryKey: ['du-bao-nhu-cau', thangPhanTich, thangDuTru, loaiNvl, phanXuongId, phapNhanId],
    queryFn: () =>
      purchaseApi.duBaoNhuCau({
        thang_phan_tich: thangPhanTich,
        thang_du_tru: thangDuTru,
        loai_nvl: loaiNvl,
        phan_xuong_id: phanXuongId,
        phap_nhan_id: phapNhanId,
      }).then(r => {
        setUpdatedAt(new Date())
        return r.data
      }),
  })

  // ── KPI tổng hợp ─────────────────────────────────────────────────────────
  const mucDoCao = useMemo(() => rows.filter(r => r.muc_do_uu_tien === 'cao').length, [rows])
  const tongCanMua = useMemo(() => rows.reduce((s, r) => s + r.uoc_tinh_tien_mua, 0), [rows])
  const tongMatHang = useMemo(() => rows.filter(r => r.can_mua_thuc > 0).length, [rows])
  const tongDangDat = useMemo(() => rows.reduce((s, r) => s + r.ton_dang_dat, 0), [rows])

  // ── KPI theo pháp nhân ───────────────────────────────────────────────────
  const kpiByPhapNhan = useMemo(() => {
    if (phapNhanId) return []
    const map: Record<string, { ten: string; cao: number; tongTien: number }> = {}
    rows.forEach(r => {
      const key = String(r.phap_nhan_id ?? 'khac')
      const ten = phapNhanList.find(p => p.id === r.phap_nhan_id)?.ten_viet_tat ?? 'Không xác định'
      if (!map[key]) map[key] = { ten, cao: 0, tongTien: 0 }
      if (r.muc_do_uu_tien === 'cao') map[key].cao++
      map[key].tongTien += r.uoc_tinh_tien_mua
    })
    return Object.values(map).filter(v => v.tongTien > 0)
  }, [rows, phapNhanList, phapNhanId])

  // ── Hàng hiển thị sau lọc client-side ───────────────────────────────────
  const displayRows = useMemo(() => {
    let r = rows
    if (chiCanMua) r = r.filter(x => x.can_mua_thuc > 0)
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase()
      r = r.filter(x =>
        x.ten_hang.toLowerCase().includes(q) ||
        x.ma_hang.toLowerCase().includes(q)
      )
    }
    return r
  }, [rows, chiCanMua, searchText])

  // ── Hàng được chọn để tạo PO ─────────────────────────────────────────────
  const selectedRows = useMemo(
    () => rows.filter(r => {
      const k = `${r.paper_material_id ?? 'p'}-${r.other_material_id ?? 'o'}`
      return selectedKeys.includes(k)
    }),
    [rows, selectedKeys],
  )

  function handleSelectAllCao() {
    const caoKeys = rows
      .filter(r => r.muc_do_uu_tien === 'cao' && r.can_mua_thuc > 0)
      .map(r => `${r.paper_material_id ?? 'p'}-${r.other_material_id ?? 'o'}`)
    setSelectedKeys(caoKeys)
    if (caoKeys.length > 0)
      message.success(`Đã chọn ${caoKeys.length} mặt hàng ưu tiên cao`)
    else
      message.info('Không có mặt hàng ưu tiên cao cần mua')
  }

  const hasActiveFilter = !!(phanXuongId || phapNhanId || loaiNvl)

  function handleReset() {
    setPhanXuongId(undefined)
    setPhapNhanId(undefined)
    setLoaiNvl(undefined)
    setSearchText('')
  }

  function handleExport() {
    exportToExcel('du_bao_nhu_cau', [{
      name: 'Dự báo nhu cầu',
      headers: [
        'Mã hàng', 'Tên hàng', 'Loại', 'ĐVT', 'Mức độ',
        'TB xuất/tháng', 'Tồn hiện tại', 'Đang đặt', 'Dự kiến cần',
        'Cần mua', 'Cần mua thực', 'Ngày tồn', 'Xu hướng',
        'Đơn giá gần nhất', 'Ước tính tiền',
      ],
      rows: rows.map(r => [
        r.ma_hang, r.ten_hang, r.loai === 'giay_cuon' ? 'Giấy cuộn' : 'NVL khác',
        r.don_vi,
        MUC_DO_LABEL[r.muc_do_uu_tien] ?? r.muc_do_uu_tien,
        r.tb_xuat_thang, r.ton_hien_tai, r.ton_dang_dat, r.du_kien_can,
        r.can_mua, r.can_mua_thuc,
        r.so_ngay_con >= 999 ? 'N/A' : `${r.so_ngay_con} ngày`,
        r.xu_huong, r.don_gia_mua_gan_nhat, r.uoc_tinh_tien_mua,
      ]),
      colWidths: [12, 30, 10, 8, 12, 14, 14, 12, 14, 12, 12, 10, 10, 18, 18],
    }])
  }

  // ── Columns bảng ─────────────────────────────────────────────────────────
  const columns: ColumnsType<DuBaoNhuCauRow> = [
    {
      title: 'Mức độ',
      dataIndex: 'muc_do_uu_tien',
      width: 110,
      filters: [
        { text: 'Ưu tiên cao', value: 'cao' },
        { text: 'Trung bình', value: 'trung_binh' },
        { text: 'Thấp', value: 'thap' },
      ],
      onFilter: (v, r) => r.muc_do_uu_tien === v,
      render: (v: string) => <Tag color={MUC_DO_COLOR[v]}>{MUC_DO_LABEL[v] ?? v}</Tag>,
    },
    { title: 'Mã hàng', dataIndex: 'ma_hang', width: 95 },
    { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true, width: 200 },
    {
      title: 'Loại',
      dataIndex: 'loai',
      width: 75,
      render: (v: string) => v === 'giay_cuon' ? <Tag color="blue">Giấy</Tag> : <Tag>NVL</Tag>,
    },
    { title: 'ĐVT', dataIndex: 'don_vi', width: 55 },
    {
      title: `TB xuất/tháng`,
      dataIndex: 'tb_xuat_thang',
      width: 120,
      align: 'right',
      render: v => v.toLocaleString('vi-VN'),
    },
    {
      title: 'Ngày tồn',
      dataIndex: 'so_ngay_con',
      width: 110,
      sorter: (a, b) => a.so_ngay_con - b.so_ngay_con,
      defaultSortOrder: 'ascend',
      render: (v: number) => <NgayTonBar days={v} />,
    },
    {
      title: 'Tồn kho',
      dataIndex: 'ton_hien_tai',
      width: 100,
      align: 'right',
      render: (v: number, r) => (
        <Tooltip title={`Đang đặt: ${r.ton_dang_dat.toLocaleString('vi-VN')}`}>
          <span style={{
            color: v < r.tb_xuat_thang * 0.5 ? '#f5222d' : v < r.tb_xuat_thang ? '#faad14' : '#52c41a',
          }}>
            {v.toLocaleString('vi-VN')}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Đang đặt',
      dataIndex: 'ton_dang_dat',
      width: 95,
      align: 'right',
      render: (v: number) => v > 0
        ? <Text style={{ color: '#1677ff' }}>{v.toLocaleString('vi-VN')}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: `Cần đảm bảo (${thangDuTru}T)`,
      dataIndex: 'du_kien_can',
      width: 140,
      align: 'right',
      render: v => v.toLocaleString('vi-VN'),
    },
    {
      title: 'Cần mua thực',
      dataIndex: 'can_mua_thuc',
      width: 115,
      align: 'right',
      sorter: (a, b) => b.can_mua_thuc - a.can_mua_thuc,
      render: (v: number, r) => (
        <Tooltip title={`Cần mua gộc: ${r.can_mua.toLocaleString('vi-VN')} − Đang đặt: ${r.ton_dang_dat.toLocaleString('vi-VN')}`}>
          <span style={{ fontWeight: v > 0 ? 700 : undefined, color: v > 0 ? '#1677ff' : '#52c41a' }}>
            {v > 0 ? v.toLocaleString('vi-VN') : '✓'}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Xu hướng',
      dataIndex: 'xu_huong',
      width: 95,
      render: (_: string, r) => <XuHuongIcon xu_huong={r.xu_huong} pct={r.xu_huong_pct} />,
    },
    {
      title: 'Đơn giá gần nhất',
      dataIndex: 'don_gia_mua_gan_nhat',
      width: 140,
      align: 'right',
      render: fmtVND,
    },
    {
      title: 'Ước tính tiền',
      dataIndex: 'uoc_tinh_tien_mua',
      width: 140,
      align: 'right',
      sorter: (a, b) => b.uoc_tinh_tien_mua - a.uoc_tinh_tien_mua,
      render: (v: number) => v > 0 ? <Text strong>{fmtVND(v)}</Text> : <Text type="secondary">—</Text>,
    },
  ]

  const rowKey = (r: DuBaoNhuCauRow) =>
    `${r.paper_material_id ?? 'p'}-${r.other_material_id ?? 'o'}`

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Dự báo nhu cầu mua hàng</h2>
          {updatedAt && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              Cập nhật lúc: {updatedAt.toLocaleTimeString('vi-VN')}
            </Text>
          )}
        </div>
        <Space>
          <Tooltip title={selectedKeys.length === 0 ? 'Tick chọn các mặt hàng cần mua trong bảng bên dưới, sau đó bấm nút này' : ''}>
            <Button
              type="primary"
              icon={<ShoppingCartOutlined />}
              disabled={selectedKeys.length === 0}
              onClick={() => setShowCreatePO(true)}
            >
              {selectedKeys.length > 0 ? `Tạo PO (${selectedKeys.length} mặt hàng)` : 'Tạo đơn mua hàng'}
            </Button>
          </Tooltip>
          <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={!rows.length}>
            Xuất Excel
          </Button>
        </Space>
      </div>

      {/* Controls */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap size="middle">
          <Space>
            <span>Phân tích</span>
            <InputNumber
              min={1} max={12} value={thangPhanTich}
              onChange={v => setThangPhanTich(v ?? 3)}
              addonAfter="tháng"
              style={{ width: 130 }}
            />
          </Space>
          <Space>
            <span>Đảm bảo tồn</span>
            <InputNumber
              min={1} max={6} value={thangDuTru}
              onChange={v => setThangDuTru(v ?? 1)}
              addonAfter="tháng"
              style={{ width: 120 }}
            />
          </Space>
          <Select
            allowClear
            placeholder="Pháp nhân"
            style={{ width: 160 }}
            options={phapNhanList.map(p => ({ value: p.id, label: p.ten_viet_tat ?? p.ten_phap_nhan }))}
            value={phapNhanId}
            onChange={v => { setPhapNhanId(v); setPhanXuongId(undefined) }}
          />
          <Select
            allowClear
            placeholder="Xưởng"
            style={{ width: 150 }}
            options={phanXuongList.map(p => ({ value: p.id, label: p.ten_xuong }))}
            value={phanXuongId}
            onChange={setPhanXuongId}
          />
          <Select
            allowClear
            placeholder="Loại NVL"
            style={{ width: 130 }}
            options={[
              { value: 'giay_cuon', label: 'Giấy cuộn' },
              { value: 'nvl_khac', label: 'NVL khác' },
            ]}
            value={loaiNvl}
            onChange={setLoaiNvl}
          />
          <Button icon={<ReloadOutlined />} loading={isFetching} onClick={() => refetch()}>
            Tính toán
          </Button>
          {hasActiveFilter && (
            <Button icon={<FilterOutlined />} onClick={handleReset} danger size="small">
              Reset bộ lọc
            </Button>
          )}
        </Space>
        {/* Bộ lọc nhanh và tìm kiếm */}
        <div style={{ marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Space>
            <Switch
              size="small"
              checked={chiCanMua}
              onChange={setChiCanMua}
            />
            <span style={{ fontSize: 13 }}>Chỉ hiển thị cần mua</span>
          </Space>
          <Input
            prefix={<SearchOutlined style={{ color: '#bbb' }} />}
            placeholder="Tìm mã hoặc tên hàng..."
            allowClear
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 220 }}
            size="small"
          />
          <Button
            size="small"
            onClick={handleSelectAllCao}
            disabled={!rows.length}
          >
            Chọn tất cả ưu tiên cao
          </Button>
        </div>
      </Card>

      {/* KPI tổng */}
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card size="small" style={{ borderLeft: '3px solid #f5222d' }}>
            <Statistic
              title={<><Badge color="red" /> Ưu tiên cao</>}
              value={mucDoCao}
              suffix="mặt hàng"
              valueStyle={{ color: mucDoCao > 0 ? '#f5222d' : '#52c41a', fontSize: 22 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderLeft: '3px solid #1677ff' }}>
            <Statistic title="Cần mua ngay" value={tongMatHang} suffix="loại"
              valueStyle={{ fontSize: 22 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderLeft: '3px solid #faad14' }}>
            <Statistic
              title="Đang đặt (tổng)"
              value={tongDangDat.toLocaleString('vi-VN')}
              valueStyle={{ fontSize: 22 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderLeft: '3px solid #52c41a' }}>
            <Statistic
              title="Ước tính tổng chi"
              value={tongCanMua}
              formatter={v => fmtVND(Number(v))}
              valueStyle={{ fontSize: 18 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Biểu đồ + KPI theo pháp nhân */}
      <Collapse
        size="small"
        style={{ marginBottom: 12 }}
        items={[
          {
            key: 'chart',
            label: 'Biểu đồ Top 10 mặt hàng cần mua nhiều nhất',
            children: <TopItemsChart rows={rows} />,
          },
          ...(kpiByPhapNhan.length > 1 ? [{
            key: 'phap-nhan',
            label: 'Tóm tắt theo pháp nhân',
            children: (
              <Table
                size="small"
                dataSource={kpiByPhapNhan}
                rowKey="ten"
                pagination={false}
                columns={[
                  { title: 'Pháp nhân', dataIndex: 'ten' },
                  { title: 'Ưu tiên cao', dataIndex: 'cao', align: 'right',
                    render: (v: number) => v > 0 ? <Tag color="red">{v}</Tag> : <Tag color="green">0</Tag> },
                  { title: 'Ước tính chi', dataIndex: 'tongTien', align: 'right',
                    render: (v: number) => fmtVND(v) },
                ]}
              />
            ),
          }] : []),
        ]}
      />

      {/* Bảng dự báo */}
      {rows.length > 0 && (
        <div style={{ marginBottom: 6, fontSize: 12, color: '#595959' }}>
          <ShoppingCartOutlined style={{ marginRight: 4 }} />
          Tick chọn các mặt hàng muốn đặt mua → bấm <strong>Tạo đơn mua hàng</strong> ở trên.
          Checkbox chỉ hiển thị cho dòng có <em>Cần mua thực &gt; 0</em>.
          {displayRows.length !== rows.length && (
            <Tag style={{ marginLeft: 8 }} color="blue">
              Đang lọc: {displayRows.length}/{rows.length} mặt hàng
            </Tag>
          )}
        </div>
      )}

      {!isFetching && rows.length === 0 && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span>
              Chưa có dữ liệu dự báo.
              Bấm <strong>Tính toán</strong> để phân tích, hoặc kiểm tra lại bộ lọc.
              {hasActiveFilter && (
                <Button type="link" size="small" onClick={handleReset}>Reset bộ lọc</Button>
              )}
            </span>
          }
          style={{ padding: '40px 0' }}
        />
      )}

      {rows.length > 0 && (
        <Table<DuBaoNhuCauRow>
          rowKey={rowKey}
          columns={columns}
          dataSource={displayRows}
          loading={isFetching}
          size="small"
          scroll={{ x: 1450 }}
          pagination={{ pageSize: 50, showSizeChanger: true, showTotal: t => `${t} mặt hàng` }}
          rowClassName={r => r.muc_do_uu_tien === 'cao' ? 'row-urgent' : ''}
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: keys => setSelectedKeys(keys as string[]),
            getCheckboxProps: r => ({ disabled: r.can_mua_thuc <= 0 }),
          }}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row style={{ fontWeight: 600, background: '#fafafa' }}>
                {/* checkbox(1) + Mức độ(1) + Mã(1) + Tên(1) + Loại(1) + DVT(1) + TB(1) + Ngày(1) + Tồn(1) + Đặt(1) + Cần(1) + CanMua(1) + Xu(1) = 13 cols */}
                <Table.Summary.Cell index={0} colSpan={13}>Tổng cộng</Table.Summary.Cell>
                <Table.Summary.Cell index={1} />
                <Table.Summary.Cell index={2} align="right">{fmtVND(tongCanMua)}</Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      )}

      <style>{`
        .row-urgent td { background: #fff1f0 !important; }
        .row-urgent:hover td { background: #ffe4e4 !important; }
      `}</style>

      <div style={{ marginTop: 8, color: '#888', fontSize: 12 }}>
        Thuật toán: Cần mua thực = max(0, TB tiêu thụ/tháng × {thangDuTru}T đảm bảo − tồn kho − đang đặt).
        Dữ liệu dựa trên xuất kho sản xuất (XUAT_SX) trong {thangPhanTich} tháng gần nhất.
        Ưu tiên dựa trên số ngày tồn kho còn lại: &lt;7 ngày = Cao, 7–30 ngày = Trung bình, &gt;30 ngày = Thấp.
      </div>

      {showCreatePO && (
        <CreatePOModal
          selectedRows={selectedRows}
          onClose={() => setShowCreatePO(false)}
          onSuccess={() => { setShowCreatePO(false); setSelectedKeys([]) }}
        />
      )}
    </div>
  )
}
