import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Table, Button, Modal, Form, Input, Space, Typography, message, Tag, Switch, Row, Col, Select,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, BankOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons'
import { phapNhanApi, PhapNhan } from '../../api/phap-nhan'
import { warehouseApi } from '../../api/warehouse'
import PageLayout from '../../components/PageLayout'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Text } = Typography

export default function PhapNhanPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PhapNhan | null>(null)
  const [form] = Form.useForm()
  const queryClient = useQueryClient()

  const { data: phapNhans, isLoading } = useQuery({
    queryKey: ['phap-nhans'],
    queryFn: () => phapNhanApi.list().then(r => r.data)
  })

  const { data: phanXuongList = [] } = useQuery({
    queryKey: ['phan-xuong-all'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
    staleTime: 300_000,
  })

  const saveMut = useMutation({
    mutationFn: (data: PhapNhan) => editing 
      ? phapNhanApi.update(editing.id!, data) 
      : phapNhanApi.create(data),
    onSuccess: () => {
      message.success(editing ? 'Đã cập nhật' : 'Đã thêm mới')
      setModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['phap-nhans'] })
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => message.error(e?.response?.data?.detail || 'Thao tác thất bại')
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => phapNhanApi.delete(id),
    onSuccess: () => {
      message.success('Đã xóa')
      queryClient.invalidateQueries({ queryKey: ['phap-nhans'] })
    }
  })

  const handleEdit = (record: PhapNhan) => {
    setEditing(record)
    form.setFieldsValue(record)
    setModalOpen(true)
  }

  const columns: import('antd/es/table').ColumnsType<PhapNhan> = [
    {
      title: 'Mã/Tên pháp nhân',
      key: 'name',
      render: (r: PhapNhan) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.ten_phap_nhan}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>Mã: {r.ma_phap_nhan} | Viết tắt: {r.ten_viet_tat}</Text>
        </Space>
      )
    },
    {
      title: 'Liên hệ',
      key: 'contact',
      render: (r: PhapNhan) => (
        <Space direction="vertical" size={2}>
          <Text style={{ fontSize: 13 }}><PhoneOutlined /> {r.so_dien_thoai || '—'}</Text>
          <Text style={{ fontSize: 13 }}><MailOutlined /> {r.email || '—'}</Text>
        </Space>
      )
    },
    {
      title: 'Thông tin thuế/NH',
      key: 'tax',
      render: (r: PhapNhan) => (
        <Space direction="vertical" size={2}>
          <Tag color="blue">MST: {r.ma_so_thue || '—'}</Tag>
          <Text style={{ fontSize: 11 }}><BankOutlined /> {r.ngan_hang} - {r.tai_khoan}</Text>
        </Space>
      )
    },
    {
      title: 'Xưởng phôi',
      dataIndex: 'ten_phoi_phan_xuong',
      render: (v: string | null) => v ? <Tag color="green">{v}</Tag> : <Text type="secondary" style={{ fontSize: 12 }}>Chưa cấu hình</Text>
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      render: (v: boolean) => <Tag color={v ? 'success' : 'default'}>{v ? 'Hoạt động' : 'Ngừng'}</Tag>
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (r: PhapNhan) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(r)} />
          <Button danger icon={<DeleteOutlined />} onClick={() => {
            Modal.confirm({
              title: 'Xóa pháp nhân này?',
              onOk: () => deleteMut.mutate(r.id!)
            })
          }} />
        </Space>
      )
    }
  ]

  const { displayColumns, settingsButton } = useColumnPrefs('master-phap-nhan', columns)

  return (
    <PageLayout
      title="Quản lý Pháp nhân (Công ty)"
      actions={
        <Space>
          {settingsButton}
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            setEditing(null)
            form.resetFields()
            setModalOpen(true)
          }}>
            Thêm mới
          </Button>
        </Space>
      }
    >
      <Alert
        message="Thông tin tại đây sẽ được dùng để hiển thị trên tiêu đề của các phiếu in (Báo giá, Đơn hàng, Phiếu thu...)"
        type="info" showIcon style={{ marginBottom: 16 }}
      />

      <Table
        dataSource={phapNhans}
        columns={displayColumns}
        loading={isLoading}
        rowKey="id"
        pagination={false}
      />

      <Modal
        title={editing ? 'Chỉnh sửa thông tin Pháp nhân' : 'Thêm Pháp nhân mới'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={saveMut.mutate}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="ma_phap_nhan" label="Mã pháp nhân" rules={[{ required: true }]}>
                <Input placeholder="VD: NP, VISUN..." disabled={!!editing} />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="ten_phap_nhan" label="Tên đầy đủ (Dùng trên phiếu in)" rules={[{ required: true }]}>
                <Input placeholder="CÔNG TY TNHH SX TM NAM PHƯƠNG" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="ten_viet_tat" label="Tên viết tắt">
                <Input />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="dia_chi" label="Địa chỉ trụ sở">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="ma_so_thue" label="Mã số thuế">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="so_dien_thoai" label="Số điện thoại">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="email" label="Email">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="ngan_hang" label="Tên ngân hàng">
                <Input />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="tai_khoan" label="Số tài khoản">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="ky_hieu_hd" label="Ký hiệu HĐ">
                <Input placeholder="VD: AA" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="trang_thai" label="Trạng thái hoạt động" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item
            name="phoi_phan_xuong_id"
            label="Xưởng phôi mặc định"
            tooltip="Xưởng CD1+CD2 cung cấp phôi sóng cho pháp nhân này. NP/Visunpack → Hoàng Gia, NP Long An → Nam Thuận."
          >
            <Select allowClear placeholder="Chọn xưởng cung cấp phôi">
              {phanXuongList
                .filter(px => px.cong_doan === 'cd1_cd2' && px.trang_thai)
                .map(px => (
                  <Select.Option key={px.id} value={px.id}>{px.ten_xuong}</Select.Option>
                ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </PageLayout>
  )
}

