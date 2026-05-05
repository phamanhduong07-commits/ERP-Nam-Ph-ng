import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Button, Space, Typography, Tag, Descriptions, Table, message,
  Modal, Form, Input, InputNumber, Select, Row, Col, Divider, Alert,
} from 'antd'
import {
  ArrowLeftOutlined, EditOutlined, CheckCircleOutlined, CloseCircleOutlined,
  SaveOutlined, PrinterOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { salesReturnsApi, type SalesReturn, SALES_RETURN_TRANG_THAI_LABELS, SALES_RETURN_TRANG_THAI_COLORS, TINH_TRANG_HANG_LABELS } from '../../api/salesReturns'

const { Title, Text } = Typography
const { confirm } = Modal

export default function SalesReturnDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form] = Form.useForm()

  const { data: returnData, isLoading } = useQuery({
    queryKey: ['sales-return', id],
    queryFn: () => salesReturnsApi.get(Number(id)).then(r => r.data),
    enabled: !!id,
  })

  const approveMutation = useMutation({
    mutationFn: () => salesReturnsApi.approve(Number(id)),
    onSuccess: () => {
      message.success('Đã duyệt phiếu trả hàng')
      queryClient.invalidateQueries({ queryKey: ['sales-return', id] })
      queryClient.invalidateQueries({ queryKey: ['sales-returns'] })
    },
    onError: (err: any) => {
      message.error(err.response?.data?.detail || 'Có lỗi xảy ra')
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () => salesReturnsApi.cancel(Number(id)),
    onSuccess: () => {
      message.success('Đã hủy phiếu trả hàng')
      queryClient.invalidateQueries({ queryKey: ['sales-return', id] })
      queryClient.invalidateQueries({ queryKey: ['sales-returns'] })
    },
    onError: (err: any) => {
      message.error(err.response?.data?.detail || 'Có lỗi xảy ra')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => salesReturnsApi.update(Number(id), data),
    onSuccess: () => {
      message.success('Đã cập nhật phiếu trả hàng')
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['sales-return', id] })
      queryClient.invalidateQueries({ queryKey: ['sales-returns'] })
    },
    onError: (err: any) => {
      message.error(err.response?.data?.detail || 'Có lỗi xảy ra')
    },
  })

  const handleApprove = () => {
    confirm({
      title: 'Xác nhận duyệt phiếu trả hàng',
      content: `Bạn có chắc muốn duyệt phiếu trả hàng ${returnData?.so_phieu_tra}?`,
      okText: 'Duyệt',
      cancelText: 'Hủy',
      onOk: () => approveMutation.mutate(),
    })
  }

  const handleCancel = () => {
    confirm({
      title: 'Xác nhận hủy phiếu trả hàng',
      content: `Bạn có chắc muốn hủy phiếu trả hàng ${returnData?.so_phieu_tra}?`,
      okText: 'Hủy phiếu',
      okType: 'danger',
      cancelText: 'Không',
      onOk: () => cancelMutation.mutate(),
    })
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const payload = {
        ngay_tra: dayjs(values.ngay_tra).format('YYYY-MM-DD'),
        ly_do_tra: values.ly_do_tra,
        ghi_chu: values.ghi_chu,
        items: returnData?.items.map(item => ({
          sales_order_item_id: item.sales_order_item_id,
          so_luong_tra: values[`so_luong_tra_${item.id}`],
          don_gia_tra: values[`don_gia_tra_${item.id}`],
          ly_do_tra: values[`ly_do_tra_${item.id}`],
          tinh_trang_hang: values[`tinh_trang_hang_${item.id}`],
          ghi_chu: values[`ghi_chu_${item.id}`],
        })),
      }
      updateMutation.mutate(payload)
    } catch (err) {
      // Form validation error
    }
  }

  const columns: ColumnsType<SalesReturn['items'][0]> = [
    {
      title: 'Tên hàng',
      dataIndex: ['sales_order_item', 'ten_hang'],
      ellipsis: true,
    },
    {
      title: 'SL đã bán',
      width: 100,
      align: 'center',
      render: (_, r) => r.sales_order_item?.so_luong || 0,
    },
    {
      title: 'SL trả',
      width: 100,
      render: (_, r) => editing ? (
        <Form.Item
          name={`so_luong_tra_${r.id}`}
          initialValue={r.so_luong_tra}
          rules={[{ required: true, message: 'Nhập số lượng' }]}
        >
          <InputNumber
            min={1}
            max={r.sales_order_item?.so_luong || 0}
            style={{ width: 80 }}
          />
        </Form.Item>
      ) : (
        r.so_luong_tra
      ),
    },
    {
      title: 'Đơn giá trả',
      width: 120,
      render: (_, r) => editing ? (
        <Form.Item
          name={`don_gia_tra_${r.id}`}
          initialValue={r.don_gia_tra}
          rules={[{ required: true, message: 'Nhập đơn giá' }]}
        >
          <InputNumber
            min={0}
            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            style={{ width: 100 }}
          />
        </Form.Item>
      ) : (
        new Intl.NumberFormat('vi-VN').format(r.don_gia_tra) + 'đ'
      ),
    },
    {
      title: 'Thành tiền',
      width: 120,
      align: 'right',
      render: (_, r) => (
        <Text strong>
          {new Intl.NumberFormat('vi-VN').format(r.thanh_tien_tra)}đ
        </Text>
      ),
    },
    {
      title: 'Tình trạng',
      width: 120,
      render: (_, r) => editing ? (
        <Form.Item
          name={`tinh_trang_hang_${r.id}`}
          initialValue={r.tinh_trang_hang}
        >
          <Select style={{ width: 100 }}>
            {Object.entries(TINH_TRANG_HANG_LABELS).map(([k, v]) => (
              <Select.Option key={k} value={k}>{v}</Select.Option>
            ))}
          </Select>
        </Form.Item>
      ) : (
        TINH_TRANG_HANG_LABELS[r.tinh_trang_hang] || r.tinh_trang_hang
      ),
    },
    {
      title: 'Lý do',
      width: 150,
      render: (_, r) => editing ? (
        <Form.Item name={`ly_do_tra_${r.id}`} initialValue={r.ly_do_tra}>
          <Input placeholder="Lý do trả..." size="small" />
        </Form.Item>
      ) : (
        r.ly_do_tra || '—'
      ),
    },
  ]

  if (isLoading || !returnData) {
    return <div>Loading...</div>
  }

  const canEdit = returnData.trang_thai === 'moi'
  const canApprove = returnData.trang_thai === 'moi'
  const canCancel = returnData.trang_thai === 'moi'

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/sales/returns')}>
            Quay lại
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            Phiếu trả hàng: {returnData.so_phieu_tra}
          </Title>
          <Tag color={SALES_RETURN_TRANG_THAI_COLORS[returnData.trang_thai]}>
            {SALES_RETURN_TRANG_THAI_LABELS[returnData.trang_thai]}
          </Tag>
        </Space>
        <Space>
          {canEdit && !editing && (
            <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
              Sửa
            </Button>
          )}
          {editing && (
            <>
              <Button onClick={() => setEditing(false)}>Hủy</Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={updateMutation.isPending}
                onClick={handleSave}
              >
                Lưu
              </Button>
            </>
          )}
          {canApprove && (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={approveMutation.isPending}
              onClick={handleApprove}
            >
              Duyệt
            </Button>
          )}
          {canCancel && (
            <Button
              danger
              icon={<CloseCircleOutlined />}
              loading={cancelMutation.isPending}
              onClick={handleCancel}
            >
              Hủy phiếu
            </Button>
          )}
          <Button icon={<PrinterOutlined />}>
            In phiếu
          </Button>
        </Space>
      </Space>

      <Row gutter={16}>
        <Col span={24}>
          <Card title="Thông tin phiếu trả">
            {editing ? (
              <Form form={form} layout="vertical">
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      name="ngay_tra"
                      label="Ngày trả"
                      initialValue={dayjs(returnData.ngay_tra)}
                      rules={[{ required: true }]}
                    >
                      <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="ly_do_tra"
                      label="Lý do trả"
                      initialValue={returnData.ly_do_tra}
                      rules={[{ required: true }]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="ghi_chu" label="Ghi chú" initialValue={returnData.ghi_chu}>
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            ) : (
              <Descriptions bordered column={2}>
                <Descriptions.Item label="Số phiếu">{returnData.so_phieu_tra}</Descriptions.Item>
                <Descriptions.Item label="Ngày trả">{dayjs(returnData.ngay_tra).format('DD/MM/YYYY')}</Descriptions.Item>
                <Descriptions.Item label="Đơn hàng bán">
                  {returnData.sales_order ? (
                    <Button
                      type="link"
                      onClick={() => navigate(`/sales/orders/${returnData.sales_order.id}`)}
                    >
                      {returnData.sales_order.so_don}
                    </Button>
                  ) : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Khách hàng">
                  {returnData.customer ? `[${returnData.customer.ma_kh}] ${returnData.customer.ten_viet_tat}` : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Lý do trả">{returnData.ly_do_tra}</Descriptions.Item>
                <Descriptions.Item label="Tổng tiền trả">
                  <Text strong style={{ fontSize: 16, color: '#1677ff' }}>
                    {new Intl.NumberFormat('vi-VN').format(returnData.tong_tien_tra)}đ
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="Người tạo">{returnData.ten_nguoi_tao || '—'}</Descriptions.Item>
                <Descriptions.Item label="Người duyệt">{returnData.ten_nguoi_duyet || '—'}</Descriptions.Item>
                <Descriptions.Item label="Ghi chú" span={2}>{returnData.ghi_chu || '—'}</Descriptions.Item>
              </Descriptions>
            )}
          </Card>
        </Col>
      </Row>

      <Divider />

      <Card title="Chi tiết sản phẩm trả">
        {editing && (
          <Alert
            message="Đang ở chế độ chỉnh sửa"
            description="Thay đổi thông tin và nhấn Lưu để cập nhật phiếu trả hàng."
            type="info"
            style={{ marginBottom: 16 }}
          />
        )}
        <Table
          columns={columns}
          dataSource={returnData.items}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  )
}