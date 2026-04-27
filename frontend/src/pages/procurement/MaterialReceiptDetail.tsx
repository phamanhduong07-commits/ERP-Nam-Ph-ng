import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Descriptions, Table, Tag, Button, Space, Popconfirm, message, Spin, Divider, Typography,
} from 'antd'
import { CheckOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { procurementApi, RECEIPT_TRANG_THAI } from '../../api/procurement'
import type { ReceiptItemResponse } from '../../api/procurement'
import type { ColumnsType } from 'antd/es/table'

const { Title } = Typography

interface Props {
  receiptId: number
  embedded?: boolean
}

export default function MaterialReceiptDetail({ receiptId, embedded }: Props) {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: receipt, isLoading } = useQuery({
    queryKey: ['material-receipt', receiptId],
    queryFn: () => procurementApi.getReceipt(receiptId).then(r => r.data),
  })

  const confirm = useMutation({
    mutationFn: () => procurementApi.confirmReceipt(receiptId),
    onSuccess: () => {
      message.success('Đã xác nhận nhập kho — tồn kho đã được cập nhật')
      qc.invalidateQueries({ queryKey: ['material-receipt', receiptId] })
      qc.invalidateQueries({ queryKey: ['material-receipts'] })
    },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Lỗi xác nhận'),
  })

  if (isLoading) return <Spin style={{ display: 'block', margin: '40px auto' }} />
  if (!receipt) return null

  const tt = RECEIPT_TRANG_THAI[receipt.trang_thai]

  const columns: ColumnsType<ReceiptItemResponse> = [
    { title: 'STT', width: 45, render: (_, __, i) => i + 1, align: 'center' },
    { title: 'Nguyên liệu', render: (_, row) => row.ten_hang || row.ten_nguyen_lieu || '—' },
    { title: 'Mã NL', dataIndex: 'ma_nguyen_lieu', width: 110 },
    { title: 'SL', dataIndex: 'so_luong', width: 90, align: 'right', render: v => Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 3 }) },
    { title: 'ĐVT', dataIndex: 'dvt', width: 60 },
    { title: 'Đơn giá', dataIndex: 'don_gia', width: 110, align: 'right', render: v => Number(v).toLocaleString('vi-VN') },
    { title: 'Thành tiền', dataIndex: 'thanh_tien', width: 120, align: 'right', render: v => Number(v).toLocaleString('vi-VN') },
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
          <Title level={5} style={{ margin: 0 }}>{receipt.so_phieu}</Title>
          {tt && <Tag color={tt.color}>{tt.label}</Tag>}
        </Space>
      }
      extra={
        receipt.trang_thai === 'nhap' && (
          <Popconfirm
            title="Xác nhận nhập kho? Tồn kho sẽ được cập nhật và không thể hoàn tác."
            onConfirm={() => confirm.mutate()}
            okText="Xác nhận"
            cancelText="Hủy"
          >
            <Button type="primary" icon={<CheckOutlined />} size="small" loading={confirm.isPending}>
              Xác nhận nhập kho
            </Button>
          </Popconfirm>
        )
      }
    >
      <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Số phiếu">{receipt.so_phieu}</Descriptions.Item>
        <Descriptions.Item label="Ngày nhập">{dayjs(receipt.ngay_nhap).format('DD/MM/YYYY')}</Descriptions.Item>
        <Descriptions.Item label="Kho">{receipt.ten_kho}</Descriptions.Item>
        <Descriptions.Item label="Nhà cung cấp">{receipt.ten_nha_cung_cap}</Descriptions.Item>
        {receipt.phan_xuong && (
          <Descriptions.Item label="Phân xưởng">{receipt.phan_xuong}</Descriptions.Item>
        )}
        {receipt.so_don_mua && (
          <Descriptions.Item label="Đơn mua">{receipt.so_don_mua}</Descriptions.Item>
        )}
        {receipt.so_phieu_can && (
          <Descriptions.Item label="Phiếu cân">{receipt.so_phieu_can}</Descriptions.Item>
        )}
        {receipt.bien_so_xe && (
          <Descriptions.Item label="Biển số xe">{receipt.bien_so_xe}</Descriptions.Item>
        )}
        {receipt.trong_luong_xe != null && (
          <Descriptions.Item label="TL xe (tấn)">{Number(receipt.trong_luong_xe).toLocaleString('vi-VN', { maximumFractionDigits: 3 })}</Descriptions.Item>
        )}
        {receipt.trong_luong_hang != null && (
          <Descriptions.Item label="TL hàng (tấn)">{Number(receipt.trong_luong_hang).toLocaleString('vi-VN', { maximumFractionDigits: 3 })}</Descriptions.Item>
        )}
        {receipt.ghi_chu && (
          <Descriptions.Item label="Ghi chú" span={2}>{receipt.ghi_chu}</Descriptions.Item>
        )}
        <Descriptions.Item label="Tổng tiền">
          <strong>{Number(receipt.tong_tien).toLocaleString('vi-VN')} đ</strong>
        </Descriptions.Item>
      </Descriptions>

      <Divider orientation="left" style={{ margin: '8px 0' }}>Chi tiết nguyên liệu</Divider>

      <Table
        size="small"
        rowKey="id"
        columns={columns}
        dataSource={receipt.items}
        pagination={false}
        scroll={{ x: 700 }}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={6} align="right">
              <strong>Tổng cộng:</strong>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="right">
              <strong>{Number(receipt.tong_tien).toLocaleString('vi-VN')}</strong>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={2} />
          </Table.Summary.Row>
        )}
      />
    </Card>
  )
}
