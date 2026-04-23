import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Card, Descriptions, Tag, Table, Space, Button, Typography,
  Divider, Popconfirm, message, Skeleton, Row, Col,
} from 'antd'
import {
  ArrowLeftOutlined, CheckOutlined, CloseOutlined,
  PrinterOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { salesOrdersApi, TRANG_THAI_LABELS, TRANG_THAI_COLORS } from '../../api/salesOrders'
import type { SalesOrderItem } from '../../api/salesOrders'

const { Title, Text } = Typography

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

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
      title: 'Kích thước',
      width: 120,
      render: (_, r) => r.product?.dai
        ? `${r.product.dai}×${r.product.rong}×${r.product.cao} cm`
        : '—',
    },
    {
      title: 'Lớp',
      width: 50,
      align: 'center',
      render: (_, r) => r.product?.so_lop,
    },
    {
      title: 'Số lượng',
      dataIndex: 'so_luong',
      width: 90,
      align: 'right',
      render: (v, r) => `${new Intl.NumberFormat('vi-VN').format(v)} ${r.dvt}`,
    },
    {
      title: 'Đơn giá',
      dataIndex: 'don_gia',
      width: 110,
      align: 'right',
      render: (v) => new Intl.NumberFormat('vi-VN').format(v),
    },
    {
      title: 'Thành tiền',
      dataIndex: 'thanh_tien',
      width: 120,
      align: 'right',
      render: (v) => <Text strong>{new Intl.NumberFormat('vi-VN').format(v)}</Text>,
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

  if (isLoading) return <Skeleton active />
  if (!order) return <Text type="danger">Không tìm thấy đơn hàng</Text>

  const tongTien = order.items.reduce((s, i) => s + Number(i.thanh_tien), 0)

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/sales/orders')}>
              Quay lại
            </Button>
            <Title level={4} style={{ margin: 0 }}>
              Đơn hàng: <Text style={{ color: '#1677ff' }}>{order.so_don}</Text>
            </Title>
            <Tag color={TRANG_THAI_COLORS[order.trang_thai]} style={{ fontSize: 13 }}>
              {TRANG_THAI_LABELS[order.trang_thai]}
            </Tag>
          </Space>
        </Col>
        <Col>
          <Space>
            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>In đơn</Button>
            {order.trang_thai === 'moi' && (
              <Popconfirm title="Duyệt đơn hàng này?" onConfirm={handleApprove} okText="Duyệt">
                <Button type="primary" icon={<CheckOutlined />}>Duyệt đơn</Button>
              </Popconfirm>
            )}
            {['moi', 'da_duyet'].includes(order.trang_thai) && (
              <Popconfirm title="Huỷ đơn hàng này?" onConfirm={handleCancel} okText="Huỷ" okButtonProps={{ danger: true }}>
                <Button danger icon={<CloseOutlined />}>Huỷ đơn</Button>
              </Popconfirm>
            )}
          </Space>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} bordered size="small">
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
          scroll={{ x: 1100 }}
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
    </div>
  )
}
