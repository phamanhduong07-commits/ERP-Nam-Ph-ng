import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button, Col, DatePicker, Divider, Form, InputNumber, message,
  Modal, Row, Select, Space, Spin, Table, Tag, Tooltip, Typography, Empty,
} from 'antd'
import {
  PrinterOutlined, ReloadOutlined,
  InboxOutlined, CheckSquareOutlined,
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import client from '../../api/client'
import { printProductionTagBatch } from '../../utils/exportUtils'
import { productionOrdersApi } from '../../api/productionOrders'
import type { ProductionOrder } from '../../api/productionOrders'
import { warehouseApi } from '../../api/warehouse'
import { warehousesApi } from '../../api/warehouses'
import PhieuNhapPhoiSongModal from './PhieuNhapPhoiSongModal'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

interface TanDungItem {
  production_order_id: number
  production_order_item_id: number
  so_lenh: string
  ma_kh: string | null
  ten_khach_hang: string | null
  ten_hang: string | null
  so_don_hang: string | null
  ngay_giao_hang: string | null
  ngay_giao_kh: string | null
  loai_thung: string | null
  to_hop_song: string | null
  ket_cau: string | null
  dai: number | null
  rong: number | null
  cao: number | null
  so_lop: number | null
  kho_tt: number | null
  so_luong_ke_hoach: number
  cong_doan: string | null
  loai_lan: string | null
  qccl: string | null
  ten_phan_xuong: string | null
  cat: string | null
  so_luong_tam: number | null
  ghi_chu: string | null
  tong_nhap_phoi: number
  ton_kho_tp: number
}

interface PhanXuong {
  id: number
  ten_xuong: string
}

async function fetchTanDung(params: {
  from_date?: string
  to_date?: string
  phan_xuong_id?: number
}): Promise<TanDungItem[]> {
  const res = await client.get('/ke-hoach-tan-dung', { params })
  return res.data
}

async function fetchPhanXuong(): Promise<PhanXuong[]> {
  const res = await client.get('/warehouse/phan-xuong')
  return res.data
}

function fmt(v: number | null | undefined): string {
  if (v == null) return ''
  return Number(v) % 1 === 0 ? String(Math.round(Number(v))) : Number(v).toFixed(1)
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return ''
  return dayjs(d).format('DD/MM/YYYY')
}

export default function TanDungPlanPage() {
  const qc = useQueryClient()

  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null])
  const [phanXuongId, setPhanXuongId] = useState<number | undefined>()
  const [selectedKeys, setSelectedKeys] = useState<number[]>([])

  // ── In tem ───────────────────────────────────────────────────────────────────
  const [inTemItem, setInTemItem] = useState<TanDungItem | null>(null)
  const [soPallet, setSoPallet] = useState(1)

  // ── Nhập phôi sóng ───────────────────────────────────────────────────────────
  const [phoiOrder, setPhoiOrder] = useState<ProductionOrder | null>(null)
  const [phoiLoading, setPhoiLoading] = useState(false)

  // ── Nhập thành phẩm ──────────────────────────────────────────────────────────
  const [tpItem, setTpItem] = useState<TanDungItem | null>(null)
  const [tpSubmitting, setTpSubmitting] = useState(false)
  const [tpForm] = Form.useForm()

  const fromDate = dateRange[0]?.format('YYYY-MM-DD')
  const toDate = dateRange[1]?.format('YYYY-MM-DD')

  const { data: items = [], isLoading, refetch } = useQuery<TanDungItem[]>({
    queryKey: ['tan-dung-plan', fromDate, toDate, phanXuongId],
    queryFn: () => fetchTanDung({ from_date: fromDate, to_date: toDate, phan_xuong_id: phanXuongId }),
  })

  useEffect(() => { setSelectedKeys([]) }, [fromDate, toDate, phanXuongId])

  const { data: phanXuongList = [] } = useQuery({
    queryKey: ['phan-xuong-list'],
    queryFn: fetchPhanXuong,
    staleTime: 5 * 60 * 1000,
  })

  const { data: allWarehouses = [] } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: () => warehousesApi.list().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
  const tpWarehouses = allWarehouses.filter(w => w.loai_kho === 'THANH_PHAM' && w.trang_thai)

  // ── Dữ liệu in ───────────────────────────────────────────────────────────────
  const printItems = selectedKeys.length > 0
    ? items.filter(r => selectedKeys.includes(r.production_order_item_id))
    : items

  const handlePrint = () => window.print()

  // ── Handler: In tem ──────────────────────────────────────────────────────────
  const handleInTem = (r: TanDungItem) => {
    setSoPallet(1)
    setInTemItem(r)
  }

  const doPrintTem = async () => {
    if (!inTemItem) return
    const r = inTemItem
    const slTamStr = r.so_luong_tam != null ? `${r.so_luong_tam.toLocaleString('vi-VN')} tấm` : ''
    const slTamLon = [r.cat ? `${r.cat} cm` : '', slTamStr].filter(Boolean).join(' | ')
    const loaiLanLabel = r.loai_lan === 'lan_bang' ? 'Lằn Bằng'
                       : r.loai_lan === 'lan_am_duong' ? 'Lằn Âm Dương'
                       : r.loai_lan ?? ''
    await printProductionTagBatch({
      so_lenh:          r.so_lenh,
      ten_khach_hang:   r.ten_khach_hang ?? r.ma_kh ?? '',
      so_don_hang:      r.so_don_hang ?? '',
      so_po_kh:         '',
      loai_sp:          r.loai_thung ?? '',
      song:             r.to_hop_song ?? '',
      phan_xuong:       r.ten_phan_xuong ?? 'Nam Phương',
      qccl:             r.qccl ?? '',
      ngay_chay_song:   '',
      ngay_giao_cu_chi: r.ngay_giao_hang ? dayjs(r.ngay_giao_hang).format('DD/MM/YYYY') : '',
      ngay_giao_kh:     r.ngay_giao_kh   ? dayjs(r.ngay_giao_kh).format('DD/MM/YYYY')   : '',
      cong_doan:        r.cong_doan ?? '',
      loai_lan:         loaiLanLabel,
      ten_san_pham:     r.ten_hang ?? `${r.loai_thung ?? ''} ${r.dai != null ? +r.dai : ''}×${r.rong != null ? +r.rong : ''}×${r.cao != null ? +r.cao : ''} cm`,
      sl_tam_lon:       slTamLon,
      sl_tam_nho:       '',
      sl_thung:         `${Number(r.so_luong_ke_hoach).toLocaleString('vi-VN')} thùng`,
      can_mang:         '',
      chong_tham:       '',
      bo_phan:          'Tận Dụng',
      ghi_chu:          r.ghi_chu ?? '',
    }, soPallet)
    setInTemItem(null)
  }

  // ── Handler: Nhập phôi sóng ──────────────────────────────────────────────────
  const handleNhapPhoi = async (r: TanDungItem) => {
    setPhoiLoading(true)
    try {
      const { data } = await productionOrdersApi.get(r.production_order_id)
      setPhoiOrder(data)
    } catch {
      message.error('Không tải được lệnh SX')
    } finally {
      setPhoiLoading(false)
    }
  }

  // ── Handler: Nhập thành phẩm ─────────────────────────────────────────────────
  const handleOpenTP = (r: TanDungItem) => {
    setTpItem(r)
    tpForm.setFieldsValue({
      ngay_nhap: dayjs(),
      so_luong_nhap: Number(r.so_luong_ke_hoach),
      so_luong_loi: 0,
      warehouse_id: tpWarehouses.length === 1 ? tpWarehouses[0].id : undefined,
      ghi_chu: '',
    })
  }

  const doSubmitTP = async () => {
    if (!tpItem) return
    try {
      const values = await tpForm.validateFields()
      setTpSubmitting(true)
      await warehouseApi.createProductionOutput({
        ngay_nhap: values.ngay_nhap.format('YYYY-MM-DD'),
        production_order_id: tpItem.production_order_id,
        warehouse_id: values.warehouse_id ?? null,
        ten_hang: tpItem.ten_hang ?? undefined,
        so_luong_nhap: values.so_luong_nhap,
        so_luong_loi: values.so_luong_loi ?? 0,
        dvt: 'Thùng',
        ghi_chu: values.ghi_chu || null,
      })
      message.success(`Đã nhập kho thành phẩm lệnh ${tpItem.so_lenh}`)
      setTpItem(null)
      tpForm.resetFields()
      qc.invalidateQueries({ queryKey: ['tan-dung-plan'] })
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'errorFields' in e) return
      message.error('Nhập kho thất bại')
    } finally {
      setTpSubmitting(false)
    }
  }

  // ── Columns ───────────────────────────────────────────────────────────────────
  const columns: ColumnsType<TanDungItem> = [
    { title: 'STT', key: 'stt', width: 40, align: 'center',
      render: (_: unknown, __: TanDungItem, i: number) => i + 1 },
    { title: 'Mã KH', dataIndex: 'ma_kh', key: 'ma_kh', width: 60 },
    { title: 'Ngày GH', dataIndex: 'ngay_giao_hang', key: 'ngay_giao_hang', width: 85, render: fmtDate },
    { title: 'Lệnh SX', dataIndex: 'so_lenh', key: 'so_lenh', width: 115 },
    { title: 'Kiểu', dataIndex: 'loai_thung', key: 'loai_thung', width: 90 },
    { title: 'Sóng', dataIndex: 'to_hop_song', key: 'to_hop_song', width: 55, align: 'center' },
    { title: 'Kết Cấu', dataIndex: 'ket_cau', key: 'ket_cau', width: 110 },
    { title: 'D', dataIndex: 'dai', key: 'dai', width: 45, align: 'right', render: fmt },
    { title: 'R', dataIndex: 'rong', key: 'rong', width: 45, align: 'right', render: fmt },
    { title: 'C', dataIndex: 'cao', key: 'cao', width: 45, align: 'right', render: fmt },
    { title: 'Số Lượng', dataIndex: 'so_luong_ke_hoach', key: 'so_luong_ke_hoach', width: 75, align: 'right',
      render: (v: number) => Number(v).toLocaleString('vi-VN') },
    { title: 'Công Đoạn', dataIndex: 'cong_doan', key: 'cong_doan', width: 130 },
    { title: 'Kho', dataIndex: 'ten_phan_xuong', key: 'ten_phan_xuong', width: 100 },
    { title: 'Cắt', dataIndex: 'cat', key: 'cat', width: 90, align: 'center' },
    { title: 'SL Tấm', dataIndex: 'so_luong_tam', key: 'so_luong_tam', width: 65, align: 'right',
      render: (v: number | null) => v != null ? Number(v).toLocaleString('vi-VN') : '' },
    { title: 'Ghi chú', dataIndex: 'ghi_chu', key: 'ghi_chu' },
    {
      title: 'Nhập kho',
      key: 'nhap_kho_status',
      width: 110,
      align: 'center' as const,
      render: (_: unknown, r: TanDungItem) => {
        if (r.ton_kho_tp > 0)
          return <Tag color="success" style={{ fontSize: 11 }}>✓ Nhập TP</Tag>
        if (r.tong_nhap_phoi > 0)
          return <Tag color="blue" style={{ fontSize: 11 }}>✓ Nhập phôi</Tag>
        return <Tag color="default" style={{ fontSize: 11, color: '#999' }}>Chưa nhập</Tag>
      },
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: unknown, r: TanDungItem) => (
        <Space size={4}>
          <Tooltip title="In tem nhận dạng">
            <Button size="small" icon={<PrinterOutlined />}
              onClick={(e) => { e.stopPropagation(); handleInTem(r) }} />
          </Tooltip>
          <Tooltip title="Nhập kho phôi sóng">
            <Button size="small" icon={<InboxOutlined />}
              style={{ color: '#1677ff', borderColor: '#1677ff' }}
              loading={phoiLoading}
              onClick={(e) => { e.stopPropagation(); handleNhapPhoi(r) }} />
          </Tooltip>
          <Tooltip title="Nhập kho thành phẩm">
            <Button size="small" icon={<CheckSquareOutlined />}
              style={{ color: '#52c41a', borderColor: '#52c41a' }}
              onClick={(e) => { e.stopPropagation(); handleOpenTP(r) }} />
          </Tooltip>
        </Space>
      ),
    },
  ]

  const today = dayjs().format('DD/MM/YYYY')

  return (
    <div style={{ padding: '16px 20px' }}>
      {/* Toolbar — ẩn khi in */}
      <div className="no-print" style={{ marginBottom: 16 }}>
        <Space wrap>
          <RangePicker
            value={dateRange}
            onChange={(v) => setDateRange(v as [Dayjs | null, Dayjs | null])}
            placeholder={['Từ ngày GH', 'Đến ngày GH']}
            format="DD/MM/YYYY"
          />
          <Select
            placeholder="Tất cả xưởng"
            allowClear
            style={{ width: 180 }}
            value={phanXuongId}
            onChange={setPhanXuongId}
            options={phanXuongList.map((p) => ({ value: p.id, label: p.ten_xuong }))}
          />
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>Tải lại</Button>
          <Button
            icon={<PrinterOutlined />}
            type="primary"
            onClick={handlePrint}
            disabled={printItems.length === 0}
          >
            {selectedKeys.length > 0 ? `In ${selectedKeys.length} LSX` : 'In tất cả'}
          </Button>
          {selectedKeys.length > 0 && (
            <Tag closable onClose={() => setSelectedKeys([])}>
              Đã chọn {selectedKeys.length} dòng
            </Tag>
          )}
        </Space>
      </div>

      {/* Bảng chọn — hiện trên màn hình, ẩn khi in */}
      <div className="no-print">
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
        ) : items.length === 0 ? (
          <Empty description="Chưa có LSX tận dụng nào. Đánh dấu 'Tận dụng' trong chi tiết lệnh SX." />
        ) : (
          <Table
            dataSource={items}
            columns={columns}
            rowKey="production_order_item_id"
            pagination={false}
            size="small"
            bordered
            style={{ fontSize: 12 }}
            scroll={{ x: 1300 }}
            rowSelection={{
              type: 'checkbox',
              selectedRowKeys: selectedKeys,
              onChange: (keys) => setSelectedKeys(keys as number[]),
            }}
          />
        )}
      </div>

      {/* Vùng in — chỉ hiện khi print */}
      <div className="print-area" style={{ display: 'none' }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <Title level={3} style={{ margin: 0, letterSpacing: 2 }}>
            KẾ HOẠCH SẢN XUẤT TẬN DỤNG
          </Title>
        </div>
        <div style={{ textAlign: 'right', marginBottom: 12, fontSize: 13 }}>
          <Text>Ngày: {today}</Text>
        </div>
        <Table
          dataSource={printItems}
          columns={columns.filter(c => c.key !== 'action')}
          rowKey="production_order_item_id"
          pagination={false}
          size="small"
          bordered
          style={{ fontSize: 12 }}
        />
      </div>

      {/* ── Modal: In tem ─────────────────────────────────────────────────────── */}
      <Modal
        title={`In tem nhận dạng — ${inTemItem?.so_lenh ?? ''}`}
        open={inTemItem !== null}
        onCancel={() => setInTemItem(null)}
        footer={[
          <Button key="cancel" onClick={() => setInTemItem(null)}>Đóng</Button>,
          <Button key="print" type="primary" size="large" icon={<PrinterOutlined />} onClick={doPrintTem}>
            In {soPallet} tem
          </Button>,
        ]}
        width={500}
        destroyOnClose
      >
        {inTemItem && (
          <>
            <div style={{ border: '2px solid #333', borderRadius: 6, padding: 12, marginBottom: 16, background: '#fafafa' }}>
              <Row gutter={8} style={{ marginBottom: 8 }}>
                <Col span={14}>
                  <Text type="secondary" style={{ fontSize: 10 }}>KHÁCH HÀNG</Text>
                  <div><Text strong style={{ fontSize: 13 }}>{inTemItem.ten_khach_hang ?? inTemItem.ma_kh ?? '—'}</Text></div>
                </Col>
                <Col span={10}>
                  <Text type="secondary" style={{ fontSize: 10 }}>SỐ ĐH</Text>
                  <div><Text style={{ fontSize: 12 }}>{inTemItem.so_don_hang ?? '—'}</Text></div>
                </Col>
              </Row>
              <div style={{ padding: '6px 0', borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', marginBottom: 8 }}>
                <Text type="secondary" style={{ fontSize: 10 }}>TÊN SẢN PHẨM</Text>
                <div>
                  <Text strong style={{ fontSize: 15 }}>
                    {inTemItem.ten_hang ?? `${inTemItem.loai_thung ?? ''} ${inTemItem.dai != null ? +inTemItem.dai : ''}×${inTemItem.rong != null ? +inTemItem.rong : ''}×${inTemItem.cao != null ? +inTemItem.cao : ''} cm`}
                  </Text>
                </div>
              </div>
              <Row gutter={6} style={{ marginBottom: 10 }}>
                <Col span={8}>
                  <Text type="secondary" style={{ fontSize: 10 }}>LOẠI THÙNG</Text>
                  <div><Text>{inTemItem.loai_thung ?? '—'}</Text></div>
                </Col>
                <Col span={8}>
                  <Text type="secondary" style={{ fontSize: 10 }}>SÓNG</Text>
                  <div><Text strong>{inTemItem.to_hop_song ?? '—'}</Text></div>
                </Col>
                <Col span={8}>
                  <Text type="secondary" style={{ fontSize: 10 }}>KẾT CẤU</Text>
                  <div><Text style={{ fontSize: 12 }}>{inTemItem.ket_cau ?? '—'}</Text></div>
                </Col>
              </Row>
              <Row gutter={8} style={{ marginBottom: 10 }}>
                <Col span={8}>
                  <div style={{ border: '2px solid #1677ff', borderRadius: 6, textAlign: 'center', padding: '8px 4px', background: '#e6f4ff' }}>
                    <div style={{ fontSize: 10, color: '#1677ff', fontWeight: 600, marginBottom: 2 }}>CẮT</div>
                    <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>{inTemItem.cat ?? '—'}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>cm</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ border: '2px solid #722ed1', borderRadius: 6, textAlign: 'center', padding: '8px 4px', background: '#f9f0ff' }}>
                    <div style={{ fontSize: 10, color: '#722ed1', fontWeight: 600, marginBottom: 2 }}>SL TẤM</div>
                    <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>
                      {inTemItem.so_luong_tam != null ? inTemItem.so_luong_tam.toLocaleString('vi-VN') : '—'}
                    </div>
                    <div style={{ fontSize: 11, color: '#888' }}>tấm</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ border: '2px solid #52c41a', borderRadius: 6, textAlign: 'center', padding: '8px 4px', background: '#f6ffed' }}>
                    <div style={{ fontSize: 10, color: '#52c41a', fontWeight: 600, marginBottom: 2 }}>SỐ THÙNG</div>
                    <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>
                      {Number(inTemItem.so_luong_ke_hoach).toLocaleString('vi-VN')}
                    </div>
                    <div style={{ fontSize: 11, color: '#888' }}>thùng</div>
                  </div>
                </Col>
              </Row>
              <Row gutter={8}>
                {inTemItem.ngay_giao_hang && (
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: 10 }}>NGÀY GIAO HÀNG</Text>
                    <div><Text strong style={{ color: '#d4380d', fontSize: 12 }}>{fmtDate(inTemItem.ngay_giao_hang)}</Text></div>
                  </Col>
                )}
                {inTemItem.cong_doan && (
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: 10 }}>CÔNG ĐOẠN</Text>
                    <div><Text style={{ fontSize: 12 }}>{inTemItem.cong_doan}</Text></div>
                  </Col>
                )}
              </Row>
            </div>
            <Divider style={{ margin: '10px 0' }} />
            <Row align="middle" gutter={12}>
              <Col span={12}><Text strong>Số pallet cần in tem:</Text></Col>
              <Col span={12}>
                <InputNumber
                  min={1} max={99} value={soPallet}
                  onChange={v => setSoPallet(v ?? 1)}
                  size="large"
                  style={{ width: '100%' }}
                />
              </Col>
            </Row>
          </>
        )}
      </Modal>

      {/* ── Nhập phôi sóng — dùng lại modal hiện có ─────────────────────────── */}
      {phoiOrder && (
        <PhieuNhapPhoiSongModal
          open={phoiOrder !== null}
          order={phoiOrder}
          onClose={() => setPhoiOrder(null)}
          onSuccess={() => {
            setPhoiOrder(null)
            qc.invalidateQueries({ queryKey: ['tan-dung-plan'] })
          }}
        />
      )}

      {/* ── Modal: Nhập kho thành phẩm ──────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <CheckSquareOutlined style={{ color: '#52c41a' }} />
            <span>Nhập kho thành phẩm — {tpItem?.so_lenh ?? ''}</span>
          </Space>
        }
        open={tpItem !== null}
        onCancel={() => { setTpItem(null); tpForm.resetFields() }}
        onOk={doSubmitTP}
        okText="Nhập kho"
        okButtonProps={{ loading: tpSubmitting, style: { background: '#52c41a', borderColor: '#52c41a' } }}
        width={440}
        destroyOnClose
      >
        {tpItem && (
          <>
            {/* Thông tin sản phẩm */}
            <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, padding: '10px 12px', marginBottom: 16 }}>
              <Text strong style={{ fontSize: 13 }}>
                {tpItem.ten_hang ?? `${tpItem.loai_thung ?? ''} ${tpItem.dai != null ? +tpItem.dai : ''}×${tpItem.rong != null ? +tpItem.rong : ''}×${tpItem.cao != null ? +tpItem.cao : ''} cm`}
              </Text>
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {tpItem.ma_kh} · {tpItem.ten_khach_hang ?? ''}
                  {tpItem.so_don_hang ? ` · ĐH: ${tpItem.so_don_hang}` : ''}
                </Text>
              </div>
              <div style={{ marginTop: 2 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  KH: {Number(tpItem.so_luong_ke_hoach).toLocaleString('vi-VN')} thùng
                  {tpItem.ngay_giao_hang ? ` · Giao: ${fmtDate(tpItem.ngay_giao_hang)}` : ''}
                </Text>
              </div>
            </div>

            <Form form={tpForm} layout="vertical" size="small">
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="ngay_nhap" label="Ngày nhập kho" rules={[{ required: true }]}>
                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="warehouse_id"
                    label="Kho thành phẩm"
                    rules={[{ required: tpWarehouses.length > 0, message: 'Chọn kho' }]}
                  >
                    <Select
                      placeholder="Chọn kho TP"
                      options={tpWarehouses.map(w => ({
                        value: w.id,
                        label: w.ten_kho + (w.ten_xuong ? ` (${w.ten_xuong})` : ''),
                      }))}
                      allowClear
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="so_luong_nhap" label="Số lượng nhập (thùng)" rules={[{ required: true, type: 'number', min: 1, message: 'Số lượng nhập phải ≥ 1' }]}>
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="so_luong_loi" label="Số lượng lỗi">
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="ghi_chu" label="Ghi chú">
                <input
                  style={{ width: '100%', border: '1px solid #d9d9d9', borderRadius: 6, padding: '4px 8px', fontSize: 13 }}
                  placeholder="Ghi chú nhập kho..."
                  onChange={e => tpForm.setFieldValue('ghi_chu', e.target.value)}
                />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-area { display: block !important; }
          .ant-layout-sider,
          .ant-layout-header,
          nav,
          header { display: none !important; }
          body { margin: 0; padding: 0; }
          .ant-table-thead > tr > th {
            background: #eee !important;
            color: #000 !important;
            font-size: 10pt !important;
            padding: 4px 6px !important;
          }
          .ant-table-tbody > tr > td {
            font-size: 10pt !important;
            padding: 3px 6px !important;
          }
          @page { size: A4 landscape; margin: 12mm 10mm; }
        }
      `}</style>
    </div>
  )
}
