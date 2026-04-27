import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Descriptions, Table, Tag, Button, Space, Popconfirm, message, Spin, Divider, Typography,
} from 'antd'
import { CheckOutlined, CloseOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { procurementApi, PO_TRANG_THAI, PO_LOAI } from '../../api/procurement'
import type { POItemResponse } from '../../api/procurement'
import type { ColumnsType } from 'antd/es/table'

const { Title } = Typography

interface Props {
  orderId: number
  embedded?: boolean
}

export default function PurchaseOrderDetail({ orderId, embedded }: Props) {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: po, isLoading } = useQuery({
    queryKey: ['purchase-order', orderId],
    queryFn: () => procurementApi.getPO(orderId).then(r => r.data),
  })

  const approve = useMutation({
    mutationFn: () => procurementApi.approvePO(orderId),
    onSuccess: () => {
      message.success('Đã duyệt đơn mua')
      qc.invalidateQueries({ queryKey: ['purchase-order', orderId] })
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
    },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Lỗi duyệt đơn'),
  })

  const cancel = useMutation({
    mutationFn: () => procurementApi.cancelPO(orderId),
    onSuccess: () => {
      message.success('Đã hủy đơn mua')
      qc.invalidateQueries({ queryKey: ['purchase-order', orderId] })
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
    },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Lỗi hủy đơn'),
  })

  if (isLoading) return <Spin style={{ display: 'block', margin: '40px auto' }} />
  if (!po) return null

  const tt = PO_TRANG_THAI[po.trang_thai]

  const columns: ColumnsType<POItemResponse> = [
    { title: 'STT', width: 50, render: (_, __, i) => i + 1, align: 'center' },
    {
      title: 'Nguyên liệu',
      render: (_, row) => row.ten_hang || row.ten_nguyen_lieu || '—',
    },
    { title: 'Mã NL', dataIndex: 'ma_nguyen_lieu', width: 100 },
    { title: 'Số cuộn', dataIndex: 'so_cuon', width: 80, align: 'center' },
    { title: 'SL', dataIndex: 'so_luong', width: 90, align: 'right', render: v => Number(v).toLocaleString('vi-VN') },
    { title: 'ĐVT', dataIndex: 'dvt', width: 60 },
    { title: 'Đơn giá', dataIndex: 'don_gia', width: 110, align: 'right', render: v => Number(v).toLocaleString('vi-VN') },
    { title: 'Thành tiền', dataIndex: 'thanh_tien', width: 120, align: 'right', render: v => Number(v).toLocaleString('vi-VN') },
    { title: 'Đã nhập', dataIndex: 'so_luong_da_nhap', width: 90, align: 'right', render: v => Number(v).toLocaleString('vi-VN') },
    { title: 'Ghi chú', dataIndex: 'ghi_chu', ellipsis: true },
  ]

  return (
    <Card
      size="small"
      title={
        <Space>
          {!embedded && (
            <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate(-1)} />
          )}
          <Title level={5} style={{ margin: 0 }}>
            {po.so_don_mua} — {PO_LOAI[po.loai_don] || po.loai_don}
          </Title>
          {tt && <Tag color={tt.color}>{tt.label}</Tag>}
        </Space>
      }
      extra={
        <Space>
          {po.trang_thai === 'cho_duyet' && (
            <>
              <Popconfirm
                title="Duyệt đơn mua này?"
                onConfirm={() => approve.mutate()}
                okText="Duyệt"
                cancelText="Hủy"
              >
                <Button type="primary" icon={<CheckOutlined />} size="small" loading={approve.isPending}>
                  Duyệt
                </Button>
              </Popconfirm>
              <Popconfirm
                title="Hủy đơn mua này?"
                onConfirm={() => cancel.mutate()}
                okText="Hủy đơn"
                cancelText="Không"
                okButtonProps={{ danger: true }}
              >
                <Button danger icon={<CloseOutlined />} size="small" loading={cancel.isPending}>
                  Hủy
                </Button>
              </Popconfirm>
            </>
          )}
          {po.trang_thai === 'da_duyet' && (
            <Popconfirm
              title="Hủy đơn mua đã duyệt?"
              onConfirm={() => cancel.mutate()}
              okText="Hủy đơn"
              cancelText="Không"
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<CloseOutlined />} size="small" loading={cancel.isPending}>
                Hủy
              </Button>
            </Popconfirm>
          )}
        </Space>
      }
    >
      <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Số đơn">{po.so_don_mua}</Descriptions.Item>
        <Descriptions.Item label="Loại đơn">{PO_LOAI[po.loai_don] || po.loai_don}</Descriptions.Item>
        <Descriptions.Item label="Ngày đặt">{dayjs(po.ngay_dat).format('DD/MM/YYYY')}</Descriptions.Item>
        <Descriptions.Item label="Nhà cung cấp">{po.ten_nha_cung_cap}</Descriptions.Item>
        <Descriptions.Item label="NV thu mua">{po.ten_nv_thu_mua || '—'}</Descriptions.Item>
        <Descriptions.Item label="Người duyệt">{po.ten_nguoi_duyet || '—'}</Descriptions.Item>
        {po.ngay_duyet && (
          <Descriptions.Item label="Ngày duyệt">
            {dayjs(po.ngay_duyet).format('DD/MM/YYYY HH:mm')}
          </Descriptions.Item>
        )}
        {po.ten_nhom_hang && (
          <Descriptions.Item label="Nhóm hàng">{po.ten_nhom_hang}</Descriptions.Item>
        )}
        {po.noi_dung && (
          <Descriptions.Item label="Nội dung" span={2}>{po.noi_dung}</Descriptions.Item>
        )}
        {po.ghi_chu && (
          <Descriptions.Item label="Ghi chú" span={2}>{po.ghi_chu}</Descriptions.Item>
        )}
      </Descriptions>

      <Divider orientation="left" style={{ margin: '8px 0' }}>Chi tiết đơn hàng</Divider>

      <Table
        size="small"
        rowKey="id"
        columns={columns}
        dataSource={po.items}
        pagination={false}
        scroll={{ x: 800 }}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={7} align="right">
              <strong>Tổng cộng:</strong>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="right">
              <strong>{Number(po.tong_tien).toLocaleString('vi-VN')}</strong>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={2} colSpan={2} />
          </Table.Summary.Row>
        )}
      />
    </Card>
  )
}
