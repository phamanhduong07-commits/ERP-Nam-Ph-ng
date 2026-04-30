import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Modal, Form, Input, InputNumber,
  Select, Tag, message, Typography, Row, Col, Switch,
} from 'antd'
import { PlusOutlined, EditOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { customersApi, type Customer } from '../../api/customers'

const { Title } = Typography

export default function CustomerList() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [filterActive, setFilterActive] = useState<boolean | undefined>(true)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search, filterActive, page],
    queryFn: () =>
      customersApi.list({ search: search || undefined, page, page_size: 20 }).then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: Partial<Customer>) => customersApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      closeModal()
      message.success('Đã thêm khách hàng')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi thêm khách hàng'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Customer> }) =>
      customersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      closeModal()
      message.success('Đã cập nhật khách hàng')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi cập nhật'),
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ trang_thai: true, khach_vip: false, no_tran: 0, so_ngay_no: 30 })
    setModalOpen(true)
  }

  const openEdit = (row: Customer) => {
    setEditing(row)
    form.setFieldsValue({ ...row })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
  }

  const handleSave = async () => {
    const vals = await form.validateFields()
    if (editing) {
      updateMut.mutate({ id: editing.id, data: vals })
    } else {
      createMut.mutate(vals)
    }
  }

  const columns: ColumnsType<Customer> = [
    { title: 'Mã KH', dataIndex: 'ma_kh', width: 100 },
    { title: 'Tên viết tắt', dataIndex: 'ten_viet_tat', width: 160 },
    { title: 'Tên đơn vị', dataIndex: 'ten_don_vi', ellipsis: true },
    { title: 'Điện thoại', dataIndex: 'dien_thoai', width: 120 },
    { title: 'Mã số thuế', dataIndex: 'ma_so_thue', width: 130 },
    {
      title: 'Nợ trần',
      dataIndex: 'no_tran',
      width: 110,
      align: 'right',
      render: (v: number) => v ? v.toLocaleString('vi-VN') : '—',
    },
    {
      title: 'Xếp loại',
      dataIndex: 'xep_loai',
      width: 80,
      align: 'center',
      render: (v: string) => v ? <Tag color="blue">{v}</Tag> : '—',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 130,
      align: 'center',
      render: (v: boolean) => (
        <Tag color={v ? 'green' : 'default'}>{v ? 'Đang hoạt động' : 'Ngừng hoạt động'}</Tag>
      ),
    },
    {
      title: '',
      key: 'act',
      width: 60,
      render: (_: unknown, r: Customer) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
      ),
    },
  ]

  const items = data?.items ?? []
  const total = data?.total ?? 0

  return (
    <div>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Title level={4} style={{ margin: 0 }}>Danh mục khách hàng</Title>
          </Col>
          <Col>
            <Space>
              <Input.Search
                placeholder="Tìm mã KH, tên..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onSearch={v => { setSearch(v); setPage(1) }}
                allowClear
                style={{ width: 220 }}
              />
              <Select
                value={filterActive === undefined ? 'all' : filterActive ? 'active' : 'inactive'}
                style={{ width: 160 }}
                onChange={v => {
                  setFilterActive(v === 'all' ? undefined : v === 'active')
                  setPage(1)
                }}
                options={[
                  { value: 'active', label: 'Đang hoạt động' },
                  { value: 'all', label: 'Tất cả' },
                  { value: 'inactive', label: 'Ngừng hoạt động' },
                ]}
              />
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Thêm khách hàng
              </Button>
            </Space>
          </Col>
        </Row>

        <Table
          rowKey="id"
          dataSource={items}
          columns={columns}
          loading={isLoading}
          size="small"
          pagination={{
            current: page,
            pageSize: 20,
            total,
            showTotal: (t) => `Tổng ${t} khách hàng`,
            onChange: (p) => setPage(p),
          }}
          onRow={(r) => ({ onClick: () => openEdit(r), style: { cursor: 'pointer' } })}
        />
      </Card>

      <Modal
        title={editing ? 'Sửa khách hàng' : 'Thêm khách hàng mới'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={createMut.isPending || updateMut.isPending}
        width={680}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="small">
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="Mã KH" name="ma_kh" rules={[{ required: true, message: 'Nhập mã KH' }]}>
                <Input disabled={!!editing} placeholder="VD: KH001" />
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
              <Form.Item label="Mã số thuế" name="ma_so_thue">
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
              <Form.Item label="SĐT liên hệ" name="sdt_lien_he">
                <Input placeholder="Số điện thoại liên hệ" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={8}>
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
            <Col span={8}>
              <Form.Item label="Số ngày nợ" name="so_ngay_no">
                <InputNumber style={{ width: '100%' }} min={0} placeholder="30" />
              </Form.Item>
            </Col>
            <Col span={8}>
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
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Ghi chú" name="ghi_chu">
                <Input.TextArea rows={2} placeholder="Ghi chú thêm" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Khách VIP" name="khach_vip" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            {editing && (
              <Col span={6}>
                <Form.Item label="Trạng thái" name="trang_thai" valuePropName="checked">
                  <Switch checkedChildren="Hoạt động" unCheckedChildren="Ngừng" />
                </Form.Item>
              </Col>
            )}
          </Row>
        </Form>
      </Modal>
    </div>
  )
}
