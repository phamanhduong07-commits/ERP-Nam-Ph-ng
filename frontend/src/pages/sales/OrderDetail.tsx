import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Card, Descriptions, Tag, Table, Space, Button, Typography,
  Divider, Popconfirm, message, Skeleton, Row, Col, Modal, DatePicker, Form,
  Drawer, Tooltip,
} from 'antd'
import {
  ArrowLeftOutlined, CheckOutlined, CloseOutlined,
  PrinterOutlined, ThunderboltOutlined, CalculatorOutlined,
  FileExcelOutlined, FilePdfOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { salesOrdersApi, TRANG_THAI_LABELS, TRANG_THAI_COLORS } from '../../api/salesOrders'
import type { SalesOrderItem } from '../../api/salesOrders'
import { productionOrdersApi } from '../../api/productionOrders'
import BomCalculatorPanel from '../production/BomCalculatorPanel'
import { exportToExcel, printToPdf, fmtVND, fmtDate, buildHtmlTable } from '../../utils/exportUtils'

const { Title, Text } = Typography

interface Props {
  orderId?: number
  embedded?: boolean
}

export default function OrderDetail({ orderId, embedded = false }: Props) {
  const params = useParams<{ id: string }>()
  const id = orderId ?? (params.id ? Number(params.id) : undefined)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [lenhModal, setLenhModal] = useState(false)
  const [lenhLoading, setLenhLoading] = useState(false)
  const [lenhForm] = Form.useForm()
  const [bomItemId, setBomItemId] = useState<number | null>(null)

  const { data: order, isLoading, refetch } = useQuery({
    queryKey: ['sales-order', id],
    queryFn: () => salesOrdersApi.get(Number(id)).then((r) => r.data),
    enabled: !!id,
  })

  const handleApprove = async () => {
    try {
      await salesOrdersApi.approve(Number(id))
      message.success('Đã duyệt đơn hàng')
      refetch()
    } catch {
      message.error('Duyệt thất bại')
    }
  }

  const handleCancel = async () => {
    try {
      await salesOrdersApi.cancel(Number(id))
      message.success('Đã huỷ đơn hàng')
      refetch()
    } catch {
      message.error('Huỷ thất bại')
    }
  }

  const handleTaoLenh = async () => {
    try {
      const vals = await lenhForm.validateFields()
      setLenhLoading(true)
      const res = await productionOrdersApi.createFromOrder(Number(id), {
        ngay_lenh: vals.ngay_lenh?.format('YYYY-MM-DD'),
        ngay_hoan_thanh_ke_hoach: vals.ngay_hoan_thanh_ke_hoach?.format('YYYY-MM-DD'),
      })
      message.success(`Đã tạo lệnh sản xuất ${res.data.so_lenh}`)
      setLenhModal(false)
      refetch()
      navigate(`/production/orders/${res.data.id}`)
    } catch (err: any) {
      if (err?.response?.data?.detail) {
        message.error(err.response.data.detail)
      }
      // validateFields lỗi thì bỏ qua (inline error hiển thị)
    } finally {
      setLenhLoading(false)
    }
  }

  const fmt = (v: number) => new Intl.NumberFormat('vi-VN').format(v)

  const handleExportExcel = () => {
    if (!order) return
    const tongTienEx = order.items.reduce((s, i) => s + Number(i.thanh_tien), 0)
    exportToExcel(`${order.so_don}_${new Date().toISOString().slice(0,10)}`, [
      {
        name: 'Thông tin đơn hàng',
        headers: ['Thông tin', 'Giá trị'],
        rows: [
          ['Số đơn hàng', order.so_don],
          ['Ngày đặt hàng', fmtDate(order.ngay_don)],
          ['Ngày giao hàng', fmtDate(order.ngay_giao_hang)],
          ['Khách hàng', `[${order.customer?.ma_kh}] ${order.customer?.ten_viet_tat}`],
          ['Đơn vị', order.customer?.ten_don_vi ?? ''],
          ['Điện thoại', order.customer?.dien_thoai ?? ''],
          ['Địa chỉ giao hàng', order.dia_chi_giao ?? ''],
          ['Ghi chú', order.ghi_chu ?? ''],
          ['Trạng thái', order.trang_thai],
          ['Tổng tiền (đ)', tongTienEx],
        ],
        colWidths: [24, 40],
      },
      {
        name: 'Chi tiết sản phẩm',
        headers: ['STT', 'Mã SP', 'Tên hàng hoá', 'Loại thùng', 'Kích thước', 'Lớp', 'Số lượng', 'ĐVT', 'Đơn giá', 'Thành tiền', 'Ngày giao', 'Ghi chú'],
        rows: order.items.map((r, i) => {
          const d = r.dai ?? r.product?.dai
          const rw = r.rong ?? r.product?.rong
          const c = r.cao ?? r.product?.cao
          return [
            i + 1,
            r.product?.ma_amis ?? '',
            r.ten_hang || r.product?.ten_hang || '',
            r.loai_thung ?? '',
            d ? `${d}×${rw}×${c} cm` : '',
            r.so_lop ?? r.product?.so_lop ?? '',
            Number(r.so_luong),
            r.dvt,
            Number(r.don_gia),
            Number(r.thanh_tien),
            fmtDate(r.ngay_giao_hang),
            r.ghi_chu_san_pham ?? '',
          ]
        }),
        colWidths: [5, 14, 30, 12, 18, 6, 10, 8, 12, 14, 12, 20],
      },
    ])
  }

  const handleExportPdf = () => {
    if (!order) return
    const tongTienEx = order.items.reduce((s, i) => s + Number(i.thanh_tien), 0)
    const cols = [
      { header: 'STT', align: 'center' as const }, { header: 'Mã SP' }, { header: 'Tên hàng hoá' },
      { header: 'Loại thùng' }, { header: 'Kích thước' }, { header: 'L', align: 'center' as const },
      { header: 'Số lượng', align: 'right' as const }, { header: 'ĐVT' },
      { header: 'Đơn giá', align: 'right' as const }, { header: 'Thành tiền', align: 'right' as const },
      { header: 'Ngày giao' },
    ]
    const rows = order.items.map((r, i) => {
      const d = r.dai ?? r.product?.dai
      const rw = r.rong ?? r.product?.rong
      const c = r.cao ?? r.product?.cao
      return [
        i + 1, r.product?.ma_amis ?? '—', r.ten_hang || r.product?.ten_hang || '—',
        r.loai_thung ?? '—', d ? `${d}×${rw}×${c}` : '—',
        r.so_lop ?? r.product?.so_lop ?? '—',
        fmt(Number(r.so_luong)), r.dvt,
        fmtVND(r.don_gia), fmtVND(r.thanh_tien),
        fmtDate(r.ngay_giao_hang),
      ]
    })
    const totalRow = ['', '', '', '', '', '', '', '', '<strong>Tổng tiền:</strong>', `<strong>${fmtVND(tongTienEx)} đ</strong>`, '']
    const table = buildHtmlTable(cols, rows, { totalRow })
    const infoHtml = `
      <div class="info-grid">
        <div><div class="info-label">Số đơn hàng</div><div class="info-value">${order.so_don}</div></div>
        <div><div class="info-label">Ngày đặt hàng</div><div class="info-value">${fmtDate(order.ngay_don)}</div></div>
        <div><div class="info-label">Ngày giao hàng</div><div class="info-value">${fmtDate(order.ngay_giao_hang)}</div></div>
        <div><div class="info-label">Khách hàng</div><div class="info-value">[${order.customer?.ma_kh}] ${order.customer?.ten_viet_tat}</div></div>
        <div><div class="info-label">Địa chỉ giao</div><div class="info-value">${order.dia_chi_giao ?? '—'}</div></div>
        <div><div class="info-label">Điện thoại</div><div class="info-value">${order.customer?.dien_thoai ?? '—'}</div></div>
      </div>`
    printToPdf(
      `Đơn hàng ${order.so_don}`,
      `<h2>ĐƠN HÀNG: ${order.so_don}</h2>
       <p class="meta">Xuất ngày: ${new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
       ${infoHtml}${table}`,
      true,
    )
  }

  const columns: ColumnsType<SalesOrderItem> = [
    {
      title: 'STT',
      width: 50,
      render: (_, __, i) => i + 1,
    },
    {
      title: 'Mã SP',
      width: 110,
      render: (_, r) => <Text code style={{ fontSize: 11 }}>{r.product?.ma_amis}</Text>,
    },
    {
      title: 'Tên hàng hoá',
      render: (_, r) => r.ten_hang || r.product?.ten_hang || '—',
      ellipsis: true,
    },
    {
      title: 'Loại thùng',
      width: 90,
      render: (_, r) => r.loai_thung || '—',
    },
    {
      title: 'Kích thước (D×R×C)',
      width: 140,
      render: (_, r) => {
        const d = r.dai ?? r.product?.dai
        const rr = r.rong ?? r.product?.rong
        const c = r.cao ?? r.product?.cao
        return d ? `${d}×${rr}×${c} cm` : '—'
      },
    },
    {
      title: 'Lớp',
      width: 55,
      align: 'center',
      render: (_, r) => r.so_lop ?? r.product?.so_lop ?? '—',
    },
    {
      title: 'Số lượng',
      dataIndex: 'so_luong',
      width: 90,
      align: 'right',
      render: (v, r) => `${fmt(v)} ${r.dvt}`,
    },
    {
      title: 'Đơn giá',
      dataIndex: 'don_gia',
      width: 110,
      align: 'right',
      render: (v) => fmt(v),
    },
    {
      title: 'Thành tiền',
      dataIndex: 'thanh_tien',
      width: 120,
      align: 'right',
      render: (v) => <Text strong>{fmt(v)}</Text>,
    },
    {
      title: 'Ngày giao',
      dataIndex: 'ngay_giao_hang',
      width: 100,
      render: (v) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Ghi chú',
      dataIndex: 'ghi_chu_san_pham',
      ellipsis: true,
    },
    {
      title: 'BOM',
      width: 90,
      align: 'center' as const,
      render: (_: unknown, r: SalesOrderItem) => {
        if (!r.production_order_item_id) {
          return (
            <Tooltip title="Cần lập lệnh SX trước">
              <Button size="small" icon={<CalculatorOutlined />} disabled>BOM</Button>
            </Tooltip>
          )
        }
        return (
          <Button
            size="small"
            icon={<CalculatorOutlined />}
            type="dashed"
            onClick={() => setBomItemId(r.production_order_item_id!)}
          >
            BOM
          </Button>
        )
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai_dong',
      width: 100,
      render: (v) => {
        const map: Record<string, [string, string]> = {
          cho_sx: ['blue', 'Chờ SX'],
          dang_sx: ['orange', 'Đang SX'],
          da_xuat: ['green', 'Đã xuất'],
          huy: ['red', 'Huỷ'],
        }
        const [color, label] = map[v] || ['default', v]
        return <Tag color={color}>{label}</Tag>
      },
    },
  ]

  const renderKetCau = (r: SalesOrderItem) => {
    const layers: { label: string; code: string | null; dl: number | null }[] = [
      { label: 'Mặt ngoài', code: r.mat,    dl: r.mat_dl },
      { label: 'Sóng 1',   code: r.song_1,  dl: r.song_1_dl },
      { label: 'Mặt 1',    code: r.mat_1,   dl: r.mat_1_dl },
      { label: 'Sóng 2',   code: r.song_2,  dl: r.song_2_dl },
      { label: 'Mặt 2',    code: r.mat_2,   dl: r.mat_2_dl },
      { label: 'Sóng 3',   code: r.song_3,  dl: r.song_3_dl },
      { label: 'Mặt trong',code: r.mat_3,   dl: r.mat_3_dl },
    ].filter(l => l.dl)

    if (!layers.length) return null
    return (
      <div style={{ padding: '6px 0', fontSize: 12, color: '#595959' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Kết cấu: {r.so_lop} lớp {r.to_hop_song ? `(${r.to_hop_song})` : ''} &nbsp;·&nbsp;
          {layers.map(l => `${l.label}: ${l.code || '?'} ${l.dl}g/m²`).join(' / ')}
          {r.loai_in && r.loai_in !== 'khong_in' && (
            <>&nbsp;·&nbsp; In: {r.loai_in === 'flexo' ? `Flexo ${r.so_mau} màu` : 'Kỹ thuật số'}</>
          )}
        </Text>
      </div>
    )
  }

  if (isLoading) return <Skeleton active />
  if (!order) return <Text type="secondary" style={{ padding: 24, display: 'block' }}>Không tìm thấy đơn hàng</Text>

  const tongTien = order.items.reduce((s, i) => s + Number(i.thanh_tien), 0)

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            {!embedded && (
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/sales/orders')}>
                Quay lại
              </Button>
            )}
            <Title level={4} style={{ margin: 0 }}>
              {embedded ? order.so_don : <>Đơn hàng: <Text style={{ color: '#1677ff' }}>{order.so_don}</Text></>}
            </Title>
            <Tag color={TRANG_THAI_COLORS[order.trang_thai]} style={{ fontSize: 13 }}>
              {TRANG_THAI_LABELS[order.trang_thai]}
            </Tag>
          </Space>
        </Col>
        <Col>
          <Space>
            <Button
              size={embedded ? 'small' : 'middle'}
              icon={<PrinterOutlined />}
              onClick={() => window.print()}
            >
              In đơn
            </Button>
            <Tooltip title="Xuất Excel">
              <Button
                size={embedded ? 'small' : 'middle'}
                icon={<FileExcelOutlined />}
                style={{ color: '#217346', borderColor: '#217346' }}
                onClick={handleExportExcel}
              />
            </Tooltip>
            <Tooltip title="Xuất PDF">
              <Button
                size={embedded ? 'small' : 'middle'}
                icon={<FilePdfOutlined />}
                style={{ color: '#e53935', borderColor: '#e53935' }}
                onClick={handleExportPdf}
              />
            </Tooltip>
            {order.trang_thai === 'moi' && (
              <Popconfirm title="Duyệt đơn hàng này?" onConfirm={handleApprove} okText="Duyệt">
                <Button size={embedded ? 'small' : 'middle'} type="primary" icon={<CheckOutlined />}>
                  Duyệt đơn
                </Button>
              </Popconfirm>
            )}
            {['da_duyet', 'dang_sx'].includes(order.trang_thai) && (
              <Button
                size={embedded ? 'small' : 'middle'}
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={() => { lenhForm.resetFields(); setLenhModal(true) }}
              >
                Lập lệnh SX
              </Button>
            )}
            {['moi', 'da_duyet'].includes(order.trang_thai) && (
              <Popconfirm title="Huỷ đơn hàng này?" onConfirm={handleCancel} okText="Huỷ" okButtonProps={{ danger: true }}>
                <Button size={embedded ? 'small' : 'middle'} danger icon={<CloseOutlined />}>
                  Huỷ đơn
                </Button>
              </Popconfirm>
            )}
          </Space>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2, lg: embedded ? 2 : 3 }} bordered size="small">
          <Descriptions.Item label="Số đơn hàng">{order.so_don}</Descriptions.Item>
          <Descriptions.Item label="Ngày đặt hàng">
            {dayjs(order.ngay_don).format('DD/MM/YYYY')}
          </Descriptions.Item>
          <Descriptions.Item label="Ngày giao hàng">
            {order.ngay_giao_hang ? dayjs(order.ngay_giao_hang).format('DD/MM/YYYY') : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Khách hàng" span={2}>
            <Text strong>[{order.customer?.ma_kh}]</Text> {order.customer?.ten_viet_tat}
            {order.customer?.ten_don_vi && <Text type="secondary"> — {order.customer.ten_don_vi}</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="Điện thoại">
            {order.customer?.dien_thoai || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Địa chỉ giao hàng" span={3}>
            {order.dia_chi_giao || '—'}
          </Descriptions.Item>
          {order.ghi_chu && (
            <Descriptions.Item label="Ghi chú" span={3}>{order.ghi_chu}</Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Card title={`Chi tiết sản phẩm (${order.items.length} dòng)`}>
        <Table
          columns={columns}
          dataSource={order.items}
          rowKey="id"
          pagination={false}
          size="small"
          scroll={{ x: 1200 }}
          expandable={{
            expandedRowRender: (r) => renderKetCau(r),
            rowExpandable: (r) => !!(r.mat_dl || r.song_1_dl),
            showExpandColumn: true,
          }}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={7} align="right">
                  <Text strong>Tổng tiền hàng:</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <Text strong style={{ fontSize: 16, color: '#1677ff' }}>
                    {new Intl.NumberFormat('vi-VN').format(tongTien)} đ
                  </Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} colSpan={4} />
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />

        <Divider />
        <Text type="secondary" style={{ fontSize: 12 }}>
          Tạo lúc: {dayjs(order.created_at).format('DD/MM/YYYY HH:mm')} •
          Cập nhật: {dayjs(order.updated_at).format('DD/MM/YYYY HH:mm')}
        </Text>
      </Card>

      {/* Drawer BOM */}
      <Drawer
        open={!!bomItemId}
        onClose={() => setBomItemId(null)}
        width={Math.min(1200, window.innerWidth - 48)}
        title={
          bomItemId
            ? `Định mức BOM — ${order.items.find(i => i.production_order_item_id === bomItemId)?.ten_hang ?? ''}`
            : 'Định mức BOM'
        }
        destroyOnClose
        bodyStyle={{ padding: 0 }}
      >
        {bomItemId && (
          <BomCalculatorPanel
            key={bomItemId}
            production_order_item_id={bomItemId}
            onBomSaved={() => {
              qc.invalidateQueries({ queryKey: ['sales-order', id] })
            }}
          />
        )}
      </Drawer>

      {/* Modal lập lệnh sản xuất */}
      <Modal
        title="Lập lệnh sản xuất"
        open={lenhModal}
        onOk={handleTaoLenh}
        onCancel={() => setLenhModal(false)}
        okText="Tạo lệnh SX"
        cancelText="Huỷ"
        confirmLoading={lenhLoading}
      >
        <Form form={lenhForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="ngay_lenh"
            label="Ngày lệnh"
            initialValue={dayjs()}
            rules={[{ required: true, message: 'Chọn ngày lệnh' }]}
          >
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="ngay_hoan_thanh_ke_hoach"
            label="Ngày hoàn thành dự kiến"
            initialValue={order.ngay_giao_hang ? dayjs(order.ngay_giao_hang) : undefined}
          >
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Lệnh SX sẽ được tạo cho tất cả {order.items.length} dòng hàng của đơn hàng này.
            Thông số kỹ thuật (kết cấu giấy, kích thước) được kế thừa tự động từ báo giá.
          </Text>
        </Form>
      </Modal>
    </div>
  )
}
