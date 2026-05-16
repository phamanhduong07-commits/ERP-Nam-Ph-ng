import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Divider, Form, Input, InputNumber,
  message, Modal, Popconfirm, Row, Select, Space, Spin, Switch, Table, Tag,
  TimePicker, Typography,
} from 'antd'
import {
  HistoryOutlined, PlusOutlined, PrinterOutlined, ReloadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  productionOrdersApi, TRANG_THAI_LABELS, TRANG_THAI_COLORS,
} from '../../api/productionOrders'
import type {
  ProductionOrder, ProductionOrderItem, ProductionOrderListItem,
  PhieuNhapPhoiSong, PhieuNhapPhoiSongPayload,
} from '../../api/productionOrders'
import { warehouseApi } from '../../api/warehouse'
import { calcBoxDimensions } from '../../api/quotes'
import { printProductionTagBatch } from '../../utils/exportUtils'

const { Text, Title } = Typography

// Pallet tiêu chuẩn (cm)
const PALLET_W = 100
const PALLET_L = 120
const PALLET_H = 200

// Độ dày tờ phôi theo số lớp (mm → /10 = cm)
const MM_PER_SHEET: Record<number, number> = { 3: 4, 5: 7, 7: 12 }

function calcTamPerPallet(soLop: number, khoCm: number | null, catCm: number | null): number {
  const cmSheet = (MM_PER_SHEET[soLop] ?? 7) / 10
  const layers = Math.floor(PALLET_H / cmSheet)
  if (!khoCm || !catCm || khoCm <= 0 || catCm <= 0) return layers
  const optA = Math.floor(PALLET_W / khoCm) * Math.floor(PALLET_L / catCm)
  const optB = Math.floor(PALLET_W / catCm) * Math.floor(PALLET_L / khoCm)
  return Math.max(optA, optB, 1) * layers
}

// Trả về cm — kho_tt trong ProductionOrderItem lưu mm, chia 10 để ra cm
function getKhoCm(oi: ProductionOrderItem): number | null {
  if (oi.kho_tt != null) return Math.round(Number(oi.kho_tt) / 10 * 10) / 10
  if (!oi.loai_thung || !oi.dai || !oi.rong || !oi.cao) return null
  const soLop = oi.so_lop ?? oi.product?.so_lop ?? 3
  const dims = calcBoxDimensions(oi.loai_thung, Number(oi.dai), Number(oi.rong), Number(oi.cao), soLop)
  // calcBoxDimensions trả mm → chia 10 + làm tròn lên 5cm
  return dims?.kho_tt ? Math.ceil(dims.kho_tt / 10 / 5) * 5 : null
}

// Trả về cm
function getCatCm(oi: ProductionOrderItem): number | null {
  if (oi.dai_tt != null) return Math.round(Number(oi.dai_tt) / 10 * 10) / 10
  if (!oi.loai_thung || !oi.dai || !oi.rong || !oi.cao) return null
  const soLop = oi.so_lop ?? oi.product?.so_lop ?? 3
  const dims = calcBoxDimensions(oi.loai_thung, Number(oi.dai), Number(oi.rong), Number(oi.cao), soLop)
  return dims?.dai_tt ? Math.round(dims.dai_tt / 10 * 10) / 10 : null
}

function calcSoTam(oi: ProductionOrderItem, soThung: number): number | null {
  if (!oi.loai_thung || !oi.dai || !oi.rong || !oi.cao) return null
  const soLop = oi.so_lop ?? oi.product?.so_lop ?? 3
  const dims = calcBoxDimensions(oi.loai_thung, Number(oi.dai), Number(oi.rong), Number(oi.cao), soLop)
  if (!dims || dims.so_dao < 1) return null
  return Math.ceil(soThung / dims.so_dao)
}

// Hiển thị kho_tt (mm) từ list item thành cm
function mmToCm(mm: number | null | undefined): string {
  if (mm == null) return '?'
  return (mm / 10).toFixed(1).replace(/\.0$/, '')
}

interface InTemState {
  order: ProductionOrder
  phieu: PhieuNhapPhoiSong | null
  soTam: number
  soPallet: number
  tamPerPallet: number
}

const LY_DO_OPTIONS = [
  { value: 'hong_may', label: 'Hỏng máy' },
  { value: 'het_nguyen_lieu', label: 'Hết nguyên liệu' },
  { value: 'nghi_giai_lao', label: 'Nghỉ giải lao' },
  { value: 'giao_ca', label: 'Giao ca' },
  { value: 'khac', label: 'Khác' },
]

export default function MaySongPage() {
  const [showHoanThanh, setShowHoanThanh] = useState(false)
  const [filterPxId, setFilterPxId] = useState<number | undefined>(undefined)
  const [nhapLsxId, setNhapLsxId] = useState<number | null>(null)
  const [inTemState, setInTemState] = useState<InTemState | null>(null)
  const [inTemLoading, setInTemLoading] = useState(false)
  const [pauseTarget, setPauseTarget] = useState<ProductionOrderListItem | null>(null)
  const [historyLsxId, setHistoryLsxId] = useState<number | null>(null)
  const [nhapForm] = Form.useForm()
  const [pauseForm] = Form.useForm()
  const qc = useQueryClient()

  // Chỉ hiện 2 xưởng có máy sóng
  const { data: pxList = [] } = useQuery({
    queryKey: ['phan-xuong-list'],
    queryFn: () =>
      warehouseApi.listPhanXuong().then(r =>
        r.data.filter(px => ['Hoàng Gia', 'Nam Thuận'].some(n => (px.ten_xuong ?? '').includes(n)))
      ),
    staleTime: 60_000,
  })

  // Danh sách LSX
  const { data: lsxRes, isLoading, refetch } = useQuery({
    queryKey: ['may-song-list', filterPxId, showHoanThanh],
    queryFn: () =>
      productionOrdersApi
        .list({
          page_size: 200,
          phan_xuong_id: filterPxId,
          trang_thai: showHoanThanh ? undefined : undefined,
        })
        .then(r => r.data),
  })

  const lsxItems = (lsxRes?.items ?? []).filter(o =>
    showHoanThanh ? true : !['hoan_thanh', 'huy'].includes(o.trang_thai)
  )

  // Full order khi mở nhập modal
  const { data: fullOrder, isLoading: orderLoading } = useQuery({
    queryKey: ['may-song-order', nhapLsxId],
    queryFn: () => productionOrdersApi.get(nhapLsxId!).then(r => r.data),
    enabled: nhapLsxId !== null,
  })

  // Lịch sử phiếu
  const { data: historyPhieu = [], isLoading: historyLoading } = useQuery({
    queryKey: ['may-song-history', historyLsxId],
    queryFn: () => productionOrdersApi.listPhieu(historyLsxId!).then(r => r.data),
    enabled: historyLsxId !== null,
  })

  // Mutations trạng thái
  const invalidateList = () => qc.invalidateQueries({ queryKey: ['may-song-list'] })

  const startMutation = useMutation({
    mutationFn: (id: number) => productionOrdersApi.start(id),
    onSuccess: () => { message.success('Đã bắt đầu sản xuất'); invalidateList() },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi khi bắt đầu'),
  })

  const pauseMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof productionOrdersApi.pause>[1] }) =>
      productionOrdersApi.pause(id, data),
    onSuccess: () => {
      message.success('Đã tạm dừng')
      setPauseTarget(null)
      pauseForm.resetFields()
      invalidateList()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi khi tạm dừng'),
  })

  const resumeMutation = useMutation({
    mutationFn: (id: number) =>
      productionOrdersApi.resume(id, { gio_tiep_tuc: dayjs().format('HH:mm') }),
    onSuccess: () => { message.success('Đã tiếp tục sản xuất'); invalidateList() },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi khi tiếp tục'),
  })

  const completeMutation = useMutation({
    mutationFn: (id: number) => productionOrdersApi.complete(id),
    onSuccess: () => { message.success('Đã hoàn thành lệnh SX'); invalidateList() },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi khi hoàn thành'),
  })

  // Tạo phiếu nhập
  const createPhieu = useMutation({
    mutationFn: (vars: { orderId: number; data: PhieuNhapPhoiSongPayload }) =>
      productionOrdersApi.createPhieu(vars.orderId, vars.data).then(r => r.data),
    onSuccess: (phieu) => {
      message.success('Đã lưu phiếu nhập phôi!')
      qc.invalidateQueries({ queryKey: ['may-song-list'] })
      if (fullOrder) openInTem(fullOrder, phieu)
      setNhapLsxId(null)
      nhapForm.resetFields()
    },
    onError: () => message.error('Lỗi khi lưu phiếu, vui lòng thử lại'),
  })

  const openInTem = (order: ProductionOrder, phieu: PhieuNhapPhoiSong | null) => {
    const soTam = phieu ? phieu.items.reduce((s, it) => s + (it.so_tam ?? 0), 0) : 0
    const oi = order.items[0]
    const soLop = oi?.so_lop ?? oi?.product?.so_lop ?? 5
    const khoCm = phieu?.items[0]?.chieu_kho ?? getKhoCm(oi)
    const catCm = phieu?.items[0]?.chieu_cat ?? getCatCm(oi)
    const tamPerPallet = calcTamPerPallet(soLop, khoCm, catCm)
    const soPallet = soTam > 0 ? Math.ceil(soTam / tamPerPallet) : 1
    setInTemState({ order, phieu, soTam, soPallet, tamPerPallet })
  }

  const handleInTemBo = async (lsx: ProductionOrderListItem) => {
    setInTemLoading(true)
    try {
      const [orderRes, phieuListRes] = await Promise.all([
        productionOrdersApi.get(lsx.id),
        productionOrdersApi.listPhieu(lsx.id),
      ])
      const latest = phieuListRes.data.length > 0 ? phieuListRes.data[phieuListRes.data.length - 1] : null
      openInTem(orderRes.data, latest)
    } catch {
      message.error('Lỗi khi tải dữ liệu')
    } finally {
      setInTemLoading(false)
    }
  }

  const handleNhapSubmit = (values: any) => {
    if (!fullOrder) return
    const ngay = values.ngay
      ? (values.ngay as dayjs.Dayjs).format('YYYY-MM-DD')
      : dayjs().format('YYYY-MM-DD')
    const items: PhieuNhapPhoiSongPayload['items'] = fullOrder.items.map((oi, idx) => {
      const slTT: number | null = values.items?.[idx]?.so_luong_thuc_te ?? null
      const khoCm: number | null = values.items?.[idx]?.chieu_kho ?? getKhoCm(oi)
      const catCm: number | null = values.items?.[idx]?.chieu_cat ?? getCatCm(oi)
      return {
        production_order_item_id: oi.id,
        so_luong_ke_hoach: oi.so_luong_ke_hoach,
        so_luong_thuc_te: slTT,
        so_luong_loi: values.items?.[idx]?.so_luong_loi ?? null,
        chieu_kho: khoCm,
        chieu_cat: catCm,
        so_tam: slTT != null ? calcSoTam(oi, slTT) : null,
      }
    })
    createPhieu.mutate({
      orderId: fullOrder.id,
      data: {
        ngay,
        ca: values.ca,
        ghi_chu: values.ghi_chu ?? null,
        gio_bat_dau: values.gio_bat_dau ? (values.gio_bat_dau as dayjs.Dayjs).format('HH:mm') : null,
        gio_ket_thuc: values.gio_ket_thuc ? (values.gio_ket_thuc as dayjs.Dayjs).format('HH:mm') : null,
        items,
      },
    })
  }

  const handlePrint = async () => {
    if (!inTemState) return
    const { order, phieu, soPallet } = inTemState
    const oi = order.items[0]
    const phieuItem = phieu?.items[0]
    const tagData = {
      so_lenh: order.so_lenh,
      ten_khach_hang: order.ten_khach_hang ?? '',
      so_don_hang: order.so_don ?? '',
      so_po_kh: order.so_po_kh ?? '',
      loai_sp: oi?.loai_thung ?? '',
      song: oi?.to_hop_song ?? '',
      phan_xuong: order.ten_phan_xuong ?? 'Nam Phương',
      qccl: oi?.qccl ?? '',
      ngay_chay_song: order.ngay_bat_dau_ke_hoach ?? '',
      ngay_giao_cu_chi: oi?.ngay_giao_hang ?? '',
      ngay_giao_kh: order.ngay_hoan_thanh_ke_hoach ?? '',
      cong_doan: oi?.cong_doan ?? '',
      ten_san_pham: oi?.ten_hang ?? '',
      sl_tam_lon: phieuItem
        ? `${phieuItem.chieu_kho ?? '?'} × ${phieuItem.chieu_cat ?? '?'} cm × ${phieuItem.so_tam ?? '?'} tấm`
        : `${getKhoCm(oi) ?? '?'} × ${getCatCm(oi) ?? '?'} cm`,
      sl_tam_nho: '',
      sl_thung: phieu
        ? `${phieu.items.reduce((s, it) => s + (it.so_luong_thuc_te ?? 0), 0)} ${oi?.dvt ?? 'thùng'}`
        : `${oi?.so_luong_ke_hoach ?? ''} ${oi?.dvt ?? 'thùng'}`,
      can_mang: oi?.loai_in ? 'Có' : 'Không',
      chong_tham: 'Không',
      bo_phan: 'Máy Sóng',
      ghi_chu: order.ghi_chu ?? '',
    }
    await printProductionTagBatch(tagData, soPallet)
    setInTemState(null)
  }

  const handlePauseSubmit = (values: any) => {
    if (!pauseTarget) return
    pauseMutation.mutate({
      id: pauseTarget.id,
      data: {
        gio_bat_dau_dung: (values.gio_bat_dau_dung as dayjs.Dayjs).format('HH:mm'),
        ly_do: values.ly_do,
        ghi_chu: values.ghi_chu ?? null,
      },
    })
  }

  // Cột bảng
  const columns: ColumnsType<ProductionOrderListItem> = [
    {
      title: 'Lệnh SX',
      dataIndex: 'so_lenh',
      width: 150,
      render: (v: string) => <Text strong style={{ fontSize: 15 }}>{v}</Text>,
    },
    {
      title: 'Khách hàng',
      dataIndex: 'ten_khach_hang',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Mặt hàng',
      dataIndex: 'ten_hang',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Khổ × Cắt (cm)',
      width: 130,
      align: 'center' as const,
      render: (_: unknown, r: ProductionOrderListItem) => {
        const kho = mmToCm(r.kho_tt)
        const cat = mmToCm(r.dai_tt)
        return <Text type="secondary">{kho} × {cat}</Text>
      },
    },
    {
      title: 'Số lớp',
      dataIndex: 'so_lop',
      width: 70,
      align: 'center' as const,
      render: (v: number | null) => v ? <Tag>{v}L</Tag> : '—',
    },
    {
      title: 'Sóng',
      dataIndex: 'to_hop_song',
      width: 70,
      align: 'center' as const,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'SL KH',
      dataIndex: 'tong_sl_ke_hoach',
      width: 80,
      align: 'right' as const,
      render: (v: number) => v?.toLocaleString() ?? '—',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 120,
      render: (v: string) => <Tag color={TRANG_THAI_COLORS[v]}>{TRANG_THAI_LABELS[v] ?? v}</Tag>,
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 340,
      render: (_: unknown, record: ProductionOrderListItem) => (
        <Space wrap>
          {record.trang_thai === 'moi' && (
            <Popconfirm
              title={`Bắt đầu SX lệnh ${record.so_lenh}?`}
              onConfirm={() => startMutation.mutate(record.id)}
              okText="Bắt đầu"
            >
              <Button type="primary" size="small" loading={startMutation.isPending}>
                Bắt đầu
              </Button>
            </Popconfirm>
          )}
          {record.trang_thai === 'dang_chay' && (
            <>
              <Button
                size="small"
                onClick={() => { setPauseTarget(record); pauseForm.setFieldValue('gio_bat_dau_dung', dayjs()) }}
              >
                Tạm dừng
              </Button>
              <Popconfirm
                title={`Hoàn thành lệnh ${record.so_lenh}?`}
                onConfirm={() => completeMutation.mutate(record.id)}
                okText="Hoàn thành"
              >
                <Button type="primary" size="small" loading={completeMutation.isPending}>
                  Hoàn thành
                </Button>
              </Popconfirm>
            </>
          )}
          {record.trang_thai === 'tam_dung' && (
            <Popconfirm
              title="Tiếp tục sản xuất?"
              onConfirm={() => resumeMutation.mutate(record.id)}
              okText="Tiếp tục"
            >
              <Button type="primary" size="small" loading={resumeMutation.isPending}>
                Tiếp tục
              </Button>
            </Popconfirm>
          )}
          <Button
            icon={<PlusOutlined />}
            type={['dang_chay', 'moi'].includes(record.trang_thai) ? 'default' : 'default'}
            size="small"
            onClick={() => setNhapLsxId(record.id)}
          >
            Nhập
          </Button>
          <Button
            icon={<PrinterOutlined />}
            size="small"
            loading={inTemLoading}
            onClick={() => handleInTemBo(record)}
          >
            In tem
          </Button>
          <Button
            icon={<HistoryOutlined />}
            size="small"
            onClick={() => setHistoryLsxId(record.id)}
          >
            Lịch sử
          </Button>
        </Space>
      ),
    },
  ]

  // Cột bảng lịch sử phiếu
  const historyColumns: ColumnsType<PhieuNhapPhoiSong> = [
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 160 },
    { title: 'Ngày', dataIndex: 'ngay', width: 110 },
    { title: 'Ca', dataIndex: 'ca', width: 80 },
    {
      title: 'Giờ',
      width: 100,
      render: (_: unknown, r: PhieuNhapPhoiSong) =>
        r.gio_bat_dau || r.gio_ket_thuc
          ? `${r.gio_bat_dau ?? '?'} – ${r.gio_ket_thuc ?? '?'}`
          : '—',
    },
    {
      title: 'SL thực tế',
      align: 'right' as const,
      render: (_: unknown, r: PhieuNhapPhoiSong) =>
        r.items.reduce((s, it) => s + (it.so_luong_thuc_te ?? 0), 0).toLocaleString(),
    },
    {
      title: 'Phôi lỗi',
      align: 'right' as const,
      render: (_: unknown, r: PhieuNhapPhoiSong) =>
        r.items.reduce((s, it) => s + (it.so_luong_loi ?? 0), 0) || '—',
    },
    { title: 'Ghi chú', dataIndex: 'ghi_chu', render: (v: string | null) => v ?? '—' },
  ]

  return (
    <div style={{ padding: 16 }}>
      <Row align="middle" justify="space-between" style={{ marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>🌊 Máy Sóng — Nhập Phôi & In Tem</Title>
        <Space>
          <Select
            placeholder="Tất cả xưởng"
            allowClear
            style={{ width: 160 }}
            value={filterPxId}
            onChange={v => setFilterPxId(v)}
            options={pxList.map(px => ({ value: px.id, label: px.ten_xuong }))}
          />
          <Switch
            checked={showHoanThanh}
            onChange={setShowHoanThanh}
            checkedChildren="Có HT"
            unCheckedChildren="Ẩn HT"
          />
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>Làm mới</Button>
        </Space>
      </Row>

      <Table
        dataSource={lsxItems}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={false}
        size="middle"
        locale={{ emptyText: 'Không có lệnh SX nào' }}
        rowClassName={(r) => r.trang_thai === 'tam_dung' ? 'row-tam-dung' : ''}
      />

      {/* ── Modal Nhập Phôi ── */}
      <Modal
        title={`Nhập phôi — ${fullOrder?.so_lenh ?? '...'}`}
        open={nhapLsxId !== null}
        onCancel={() => { setNhapLsxId(null); nhapForm.resetFields() }}
        onOk={() => nhapForm.submit()}
        okText="Lưu & In tem"
        confirmLoading={createPhieu.isPending}
        width={620}
        destroyOnHidden
      >
        {orderLoading ? (
          <div style={{ textAlign: 'center', padding: 32 }}><Spin size="large" /></div>
        ) : (
          <Form form={nhapForm} layout="vertical" onFinish={handleNhapSubmit} size="large">
            <Row gutter={12}>
              <Col span={8}>
                <Form.Item name="ca" label="Ca" rules={[{ required: true, message: 'Chọn ca' }]}>
                  <Select options={['Ca 1', 'Ca 2', 'Ca 3', 'Ca đêm'].map(c => ({ value: c, label: c }))} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="ngay" label="Ngày">
                  <DatePicker defaultValue={dayjs()} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item name="gio_bat_dau" label="Giờ BĐ">
                  <TimePicker format="HH:mm" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item name="gio_ket_thuc" label="Giờ KT">
                  <TimePicker format="HH:mm" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            {fullOrder?.items.map((oi, idx) => (
              <Card
                key={oi.id}
                size="small"
                style={{ marginBottom: 8, background: '#fafafa' }}
                title={<Text strong>{oi.ten_hang}</Text>}
                extra={<Text type="secondary">KH: {oi.so_luong_ke_hoach} {oi.dvt}</Text>}
              >
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item
                      name={['items', idx, 'so_luong_thuc_te']}
                      label="SL thực tế"
                      rules={[{ required: true, message: 'Nhập SL' }]}
                      style={{ marginBottom: 8 }}
                    >
                      <InputNumber min={0} style={{ width: '100%', fontSize: 18 }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name={['items', idx, 'so_luong_loi']}
                      label="Phôi lỗi"
                      style={{ marginBottom: 8 }}
                    >
                      <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name={['items', idx, 'chieu_kho']}
                      label="Khổ thực tế (cm)"
                      initialValue={getKhoCm(oi)}
                      style={{ marginBottom: 0 }}
                    >
                      <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name={['items', idx, 'chieu_cat']}
                      label="Cắt thực tế (cm)"
                      initialValue={getCatCm(oi)}
                      style={{ marginBottom: 0 }}
                    >
                      <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            ))}

            <Form.Item name="ghi_chu" label="Ghi chú" style={{ marginTop: 8 }}>
              <Input.TextArea rows={2} />
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* ── Modal Tạm Dừng ── */}
      <Modal
        title={`Tạm dừng — ${pauseTarget?.so_lenh ?? ''}`}
        open={pauseTarget !== null}
        onCancel={() => { setPauseTarget(null); pauseForm.resetFields() }}
        onOk={() => pauseForm.submit()}
        okText="Xác nhận tạm dừng"
        confirmLoading={pauseMutation.isPending}
        width={420}
        destroyOnHidden
      >
        <Form form={pauseForm} layout="vertical" onFinish={handlePauseSubmit}>
          <Form.Item
            name="gio_bat_dau_dung"
            label="Giờ tạm dừng"
            rules={[{ required: true, message: 'Chọn giờ' }]}
          >
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="ly_do"
            label="Lý do"
            initialValue="khac"
            rules={[{ required: true }]}
          >
            <Select options={LY_DO_OPTIONS} />
          </Form.Item>
          <Form.Item name="ghi_chu" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Modal Lịch Sử Phiếu ── */}
      <Modal
        title={`Lịch sử nhập phôi — LSX ${historyLsxId ?? ''}`}
        open={historyLsxId !== null}
        onCancel={() => setHistoryLsxId(null)}
        footer={<Button onClick={() => setHistoryLsxId(null)}>Đóng</Button>}
        width={760}
        destroyOnHidden
      >
        <Table
          dataSource={historyPhieu}
          columns={historyColumns}
          rowKey="id"
          loading={historyLoading}
          pagination={false}
          size="small"
          locale={{ emptyText: 'Chưa có phiếu nhập nào' }}
        />
      </Modal>

      {/* ── Dialog In Tem ── */}
      <Modal
        title={`In tem nhận dạng — ${inTemState?.order.so_lenh ?? ''}`}
        open={inTemState !== null}
        onCancel={() => setInTemState(null)}
        footer={[
          <Button key="cancel" onClick={() => setInTemState(null)}>Đóng</Button>,
          <Button
            key="print"
            type="primary"
            size="large"
            icon={<PrinterOutlined />}
            onClick={handlePrint}
          >
            In {inTemState?.soPallet ?? 1} tem
          </Button>,
        ]}
        width={420}
        destroyOnHidden
      >
        {inTemState && (
          <>
            <Row style={{ marginBottom: 8 }}>
              <Col span={10}><Text type="secondary">Lệnh SX</Text></Col>
              <Col span={14}><Text strong>{inTemState.order.so_lenh}</Text></Col>
            </Row>
            <Row style={{ marginBottom: 8 }}>
              <Col span={10}><Text type="secondary">Khách hàng</Text></Col>
              <Col span={14}><Text>{inTemState.order.ten_khach_hang ?? '—'}</Text></Col>
            </Row>
            <Row style={{ marginBottom: 8 }}>
              <Col span={10}><Text type="secondary">Tổng số tấm</Text></Col>
              <Col span={14}>
                <Text strong style={{ fontSize: 20 }}>
                  {inTemState.soTam > 0 ? inTemState.soTam : '—'} tấm
                </Text>
              </Col>
            </Row>
            <Row style={{ marginBottom: 8 }}>
              <Col span={10}><Text type="secondary">Tấm/pallet</Text></Col>
              <Col span={14}><Text type="secondary">{inTemState.tamPerPallet} tấm</Text></Col>
            </Row>
            {inTemState.phieu === null && (
              <Text type="warning" style={{ display: 'block', marginBottom: 8 }}>
                Chưa có phiếu nhập — số tấm tính theo kế hoạch
              </Text>
            )}
            <Divider style={{ margin: '12px 0' }} />
            <Row align="middle">
              <Col span={14}><Text>Số pallet cần in tem:</Text></Col>
              <Col span={10}>
                <InputNumber
                  min={1}
                  max={99}
                  value={inTemState.soPallet}
                  onChange={v => setInTemState(s => s ? { ...s, soPallet: v ?? 1 } : null)}
                  size="large"
                  style={{ width: '100%' }}
                />
              </Col>
            </Row>
          </>
        )}
      </Modal>
    </div>
  )
}
