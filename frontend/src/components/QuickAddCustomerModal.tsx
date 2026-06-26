import { useState } from 'react'
import { Alert, Col, Form, Input, InputNumber, Modal, Row, Select, Space, Spin, Switch, message } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { customersApi, type SaleUser } from '../api/customers'
import MSTLookupButton from './MSTLookupButton'
import client from '../api/client'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (record: Record<string, unknown>) => void
}

export default function QuickAddCustomerModal({ open, onClose, onCreated }: Props) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: saleUsers = [] } = useQuery({
    queryKey: ['sale-users'],
    queryFn: () => customersApi.saleUsers().then(r => r.data),
    enabled: open,
  })

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      setError(null)
      const res = await client.post<Record<string, unknown>>('/customers', values)
      onCreated(res.data)
      message.success(`Đã tạo: ${res.data.ten_viet_tat}`)
      onClose()
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      const apiErr = err as { response?: { data?: { detail?: string } } }
      setError(apiErr?.response?.data?.detail ?? 'Có lỗi xảy ra, vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="Thêm nhanh Khách hàng"
      open={open}
      onCancel={() => { if (!loading) onClose() }}
      onOk={handleSubmit}
      okText="Lưu"
      cancelText="Hủy"
      confirmLoading={loading}
      destroyOnClose
      width={680}
      afterOpenChange={(visible) => {
        if (visible) {
          form.resetFields()
          form.setFieldsValue({ la_khach_vip: false, no_tran: 0, so_ngay_no: 30 })
          setError(null)
        }
      }}
    >
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}
      <Form form={form} layout="vertical" size="small">
        <Row gutter={12}>
          <Col span={8}>
            <Form.Item label="Mã KH" name="ma_kh" rules={[{ required: true, message: 'Nhập mã KH' }]}>
              <Input placeholder="VD: KH001" />
            </Form.Item>
          </Col>
          <Col span={16}>
            <Form.Item label="Tên viết tắt" name="ten_viet_tat" rules={[{ required: true, message: 'Nhập tên viết tắt' }]}>
              <Input placeholder="Tên viết tắt khách hàng" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Tên đơn vị" name="ten_don_vi">
          <Input placeholder="Tên đầy đủ công ty/đơn vị" />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="Địa chỉ" name="dia_chi">
              <Input placeholder="Địa chỉ trụ sở" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Địa chỉ giao hàng" name="dia_chi_giao_hang">
              <Input placeholder="Địa chỉ nhận hàng" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={8}>
            <Form.Item label="Điện thoại" name="dien_thoai">
              <Input placeholder="Số điện thoại" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Fax" name="fax">
              <Input placeholder="Số fax" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="ma_so_thue"
              label={
                <Space size={8}>
                  Mã số thuế
                  <MSTLookupButton
                    getMST={() => form.getFieldValue('ma_so_thue') ?? ''}
                    onFound={info => form.setFieldsValue({
                      ten_don_vi: info.name || form.getFieldValue('ten_don_vi'),
                      ten_viet_tat: info.shortName || form.getFieldValue('ten_viet_tat'),
                      dia_chi: info.address || form.getFieldValue('dia_chi'),
                    })}
                  />
                </Space>
              }
            >
              <Input placeholder="MST" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={8}>
            <Form.Item label="Người đại diện" name="nguoi_dai_dien">
              <Input placeholder="Họ tên người đại diện" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Người liên hệ" name="nguoi_lien_he">
              <Input placeholder="Họ tên người liên hệ" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="SĐT liên hệ" name="so_dien_thoai_lh">
              <Input placeholder="Số điện thoại liên hệ" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="Nợ trần (VND)" name="no_tran">
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                step={1000000}
                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                placeholder="0"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Số ngày nợ" name="so_ngay_no">
              <InputNumber style={{ width: '100%' }} min={0} placeholder="30" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="NV phụ trách" name="nv_ids">
              <Select
                mode="multiple"
                allowClear
                placeholder="Chọn 1 hoặc nhiều NV..."
                options={(saleUsers as SaleUser[]).map(u => ({ value: u.id, label: u.ho_ten }))}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label="Xếp loại" name="xep_loai">
              <Select
                allowClear
                placeholder="Chọn xếp loại"
                options={[
                  { value: 'A', label: 'A - Ưu tiên cao' },
                  { value: 'B', label: 'B - Trung bình' },
                  { value: 'C', label: 'C - Thấp' },
                ]}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label="Khách VIP" name="la_khach_vip" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={8}>
            <Form.Item label="Email" name="email">
              <Input placeholder="Email liên hệ" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Pháp nhân" name="phap_nhan">
              <Input placeholder="VD: Nam Phương, Visunpack" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Kế toán phụ trách" name="ke_toan_phu_trach">
              <Input placeholder="Tên kế toán" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="Điều khoản thanh toán" name="dieu_khoan_tt">
              <Input placeholder="VD: Net 30, Tiền mặt" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="SA - CSKH" name="sa_cskh">
              <Input placeholder="Tên SA hoặc CSKH phụ trách" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Ghi chú" name="ghi_chu">
          <Input.TextArea rows={2} placeholder="Ghi chú thêm" />
        </Form.Item>

        {loading && (
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <Spin size="small" />
          </div>
        )}
      </Form>
    </Modal>
  )
}
