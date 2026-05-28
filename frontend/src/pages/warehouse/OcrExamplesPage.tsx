import { DeleteOutlined, PlusOutlined, RobotOutlined } from '@ant-design/icons'
import type { ApiError } from '../../api/types'
import {
  Alert, Button, Card, Col, Form, Image, Input, message,
  Modal, Popconfirm, Row, Space, Spin, Tag, Typography, Upload,
} from 'antd'
import { useEffect, useState } from 'react'
import { ocrExamplesApi, OcrExample } from '../../api/ocrExamples'

const { Title, Text } = Typography

export default function OcrExamplesPage() {
  const [examples, setExamples] = useState<OcrExample[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [fileList, setFileList] = useState<import('antd').UploadFile[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const res = await ocrExamplesApi.list()
      setExamples(res.data)
    } catch {
      message.error('Không tải được danh sách ảnh mẫu')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Group by supplier
  const bySupplier: Record<string, OcrExample[]> = {}
  for (const ex of examples) {
    const key = ex.ten_ncc
    if (!bySupplier[key]) bySupplier[key] = []
    bySupplier[key].push(ex)
  }

  const handleDelete = async (id: number) => {
    try {
      await ocrExamplesApi.delete(id)
      message.success('Đã xóa ảnh mẫu')
      load()
    } catch {
      message.error('Xóa thất bại')
    }
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      if (!fileList[0]?.originFileObj) {
        message.error('Chưa chọn ảnh')
        return
      }
      setSaving(true)
      const fd = new FormData()
      fd.append('ten_ncc', values.ten_ncc)
      fd.append('extracted_json', values.extracted_json)
      if (values.ghi_chu) fd.append('ghi_chu', values.ghi_chu)
      fd.append('file', fileList[0].originFileObj as File)
      await ocrExamplesApi.create(fd)
      message.success('Đã lưu ảnh mẫu')
      setModalOpen(false)
      form.resetFields()
      setFileList([])
      load()
    } catch (e: unknown) {
      message.error((e as ApiError)?.response?.data?.detail || 'Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1100 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Space align="center">
            <RobotOutlined style={{ fontSize: 24, color: '#722ed1' }} />
            <Title level={4} style={{ margin: 0 }}>Ảnh mẫu OCR — Huấn luyện AI đọc phiếu NCC</Title>
          </Space>
          <div style={{ marginTop: 4 }}>
            <Text type="secondary">
              Thêm 2–5 ảnh mẫu mỗi NCC để AI nhận diện chính xác hơn (few-shot learning).
              Mỗi lần OCR sẽ tự dùng ảnh mẫu của NCC đó làm ví dụ.
            </Text>
          </div>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Thêm ảnh mẫu
          </Button>
        </Col>
      </Row>

      {examples.length === 0 && !loading && (
        <Alert
          type="info"
          message="Chưa có ảnh mẫu nào"
          description="Thêm ít nhất 2 ảnh phiếu xuất cho mỗi NCC để AI học và đọc chính xác hơn. Sau khi OCR thành công, bạn có thể lưu kết quả đó làm ảnh mẫu ngay từ trang nhập kho."
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Spin spinning={loading}>
        {Object.entries(bySupplier).map(([ncc, items]) => (
          <Card
            key={ncc}
            title={
              <Space>
                <Text strong>{ncc}</Text>
                <Tag color="purple">{items.length} mẫu</Tag>
                {items.length >= 3 && <Tag color="green">✓ Đủ mẫu</Tag>}
                {items.length < 2 && <Tag color="orange">Cần thêm mẫu</Tag>}
              </Space>
            }
            style={{ marginBottom: 16 }}
            size="small"
          >
            <Row gutter={[12, 12]}>
              {items.map(ex => (
                <Col key={ex.id} xs={24} sm={12} md={8} lg={6}>
                  <Card
                    size="small"
                    cover={
                      <Image
                        src={`http://localhost:8001${ex.img_url}`}
                        alt={ex.ten_ncc}
                        style={{ height: 160, objectFit: 'cover' }}
                        fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                      />
                    }
                    actions={[
                      <Popconfirm
                        key="del"
                        title="Xóa ảnh mẫu này?"
                        onConfirm={() => handleDelete(ex.id)}
                        okText="Xóa"
                        cancelText="Hủy"
                      >
                        <Button danger size="small" icon={<DeleteOutlined />} type="text">
                          Xóa
                        </Button>
                      </Popconfirm>,
                    ]}
                  >
                    <div style={{ fontSize: 11, color: '#666' }}>
                      {ex.ghi_chu && <div>{ex.ghi_chu}</div>}
                      <div style={{ marginTop: 2 }}>
                        {ex.created_at ? new Date(ex.created_at).toLocaleDateString('vi-VN') : ''}
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        ))}
      </Spin>

      <Modal
        title="Thêm ảnh mẫu phiếu xuất NCC"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); setFileList([]) }}
        onOk={handleSave}
        okText="Lưu ảnh mẫu"
        confirmLoading={saving}
        width={600}
      >
        <Alert
          type="info"
          message="Hướng dẫn"
          description="Chọn ảnh phiếu xuất đã đọc đúng, dán JSON kết quả đúng vào ô bên dưới. AI sẽ dùng ví dụ này để đọc ảnh mới chính xác hơn."
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={form} layout="vertical">
          <Form.Item
            name="ten_ncc"
            label="Tên nhà cung cấp"
            rules={[{ required: true, message: 'Nhập tên NCC' }]}
          >
            <Input placeholder="Ví dụ: Công ty Giấy Xuân Phú" />
          </Form.Item>
          <Form.Item label="Ảnh phiếu xuất" required>
            <Upload
              listType="picture"
              maxCount={1}
              fileList={fileList}
              beforeUpload={() => false}
              onChange={({ fileList: fl }) => setFileList(fl)}
              accept="image/*"
            >
              <Button icon={<PlusOutlined />}>Chọn ảnh</Button>
            </Upload>
          </Form.Item>
          <Form.Item
            name="extracted_json"
            label="JSON kết quả đúng"
            rules={[
              { required: true, message: 'Dán JSON vào đây' },
              {
                validator: (_, v) => {
                  try { JSON.parse(v); return Promise.resolve() }
                  catch { return Promise.reject('JSON không hợp lệ') }
                },
              },
            ]}
          >
            <Input.TextArea
              rows={8}
              placeholder={'{\n  "ten_ncc": "...",\n  "so_xe": "...",\n  "hang_hoa": [...]\n}'}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          </Form.Item>
          <Form.Item name="ghi_chu" label="Ghi chú (tùy chọn)">
            <Input placeholder="Ví dụ: Phiếu tháng 5/2026" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
