import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Form, Input, Button, Space, message, Spin, Row, Col,
  Typography, Divider, InputNumber, Descriptions
} from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import { salesOrdersApi } from '../../api/salesOrders'

const { Title, Text } = Typography

export default function OrderDiscountUpdate() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const queryClient = useQueryClient()

  const { data: order, isLoading } = useQuery({
    queryKey: ['sales-order', id],
    queryFn: () => salesOrdersApi.get(Number(id)).then(r => r.data),
    enabled: !!id
  })

  const updateDiscountMutation = useMutation({
    mutationFn: (data: { ty_le_giam_gia?: number; so_tien_giam_gia?: number; ghi_chu?: string }) =>
      salesOrdersApi.updateDiscount(Number(id), data),
    onSuccess: () => {
      message.success('Cập nhật giảm giá thành công')
      queryClient.invalidateQueries({ queryKey: ['sales-order', id] })
      navigate(`/sales/orders/${id}`)
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.detail || 'Có lỗi xảy ra')
    }
  })

  useEffect(() => {
    if (order) {
      form.setFieldsValue({
        ty_le_giam_gia: order.ty_le_giam_gia || 0,
        so_tien_giam_gia: order.so_tien_giam_gia || 0,
        ghi_chu: order.ghi_chu || ''
      })
    }
  }, [order, form])

  const handleSubmit = (values: any) => {
    updateDiscountMutation.mutate({
      ty_le_giam_gia: values.ty_le_giam_gia || undefined,
      so_tien_giam_gia: values.so_tien_giam_gia || undefined,
      ghi_chu: values.ghi_chu || undefined
    })
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!order) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Text type="danger">Không tìm thấy đơn hàng</Text>
      </div>
    )
  }

  // Check if order can be updated
  const canUpdateDiscount = ['da_duyet', 'dang_xuat', 'hoan_thanh'].includes(order.trang_thai)

  if (!canUpdateDiscount) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Text type="danger">
          Chỉ có thể cập nhật giảm giá cho đơn hàng đã duyệt. Trạng thái hiện tại: {order.trang_thai}
        </Text>
      </div>
    )
  }

  const tongTienHang = order.tong_tien || 0
  const tongTienGiamGia = order.ty_le_giam_gia > 0
    ? order.tong_tien * (order.ty_le_giam_gia / 100)
    : (order.so_tien_giam_gia || 0)
  const tongThanhToan = order.tong_tien_sau_giam || 0

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/sales/orders/${id}`)}>
          Quay lại
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          Cập nhật giảm giá - {order.so_don}
        </Title>
      </Space>

      <Row gutter={16}>
        <Col span={16}>
          <Card title="Thông tin giảm giá">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="Tỷ lệ giảm giá (%)"
                    name="ty_le_giam_gia"
                    rules={[
                      { type: 'number', min: 0, max: 100, message: 'Tỷ lệ giảm giá phải từ 0-100%' }
                    ]}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      min={0}
                      max={100}
                      precision={2}
                      placeholder="0.00"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="Số tiền giảm giá (VNĐ)"
                    name="so_tien_giam_gia"
                    rules={[
                      { type: 'number', min: 0, message: 'Số tiền giảm giá không được âm' }
                    ]}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      min={0}
                      precision={0}
                      placeholder="0"
                      formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="Ghi chú" name="ghi_chu">
                <Input.TextArea rows={3} placeholder="Lý do giảm giá..." />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    htmlType="submit"
                    loading={updateDiscountMutation.isPending}
                  >
                    Cập nhật giảm giá
                  </Button>
                  <Button onClick={() => navigate(`/sales/orders/${id}`)}>
                    Hủy
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col span={8}>
          <Card title="Tóm tắt đơn hàng">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Khách hàng">
                {order.customer?.ten_don_vi}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Text type="success">
                  {order.trang_thai}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Ngày đặt">{order.ngay_don}</Descriptions.Item>
            </Descriptions>

            <Divider />

            <Descriptions column={1} size="small">
              <Descriptions.Item label="Tổng tiền hàng">
                <Text strong>{new Intl.NumberFormat('vi-VN').format(tongTienHang)}đ</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Tổng tiền giảm giá">
                <Text type="danger">-{new Intl.NumberFormat('vi-VN').format(tongTienGiamGia)}đ</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Tổng thanh toán">
                <Text strong style={{ fontSize: '16px', color: '#1890ff' }}>
                  {new Intl.NumberFormat('vi-VN').format(tongThanhToan)}đ
                </Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
    </div>
  )
}