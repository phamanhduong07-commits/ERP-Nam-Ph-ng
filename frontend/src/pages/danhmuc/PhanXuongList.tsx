import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, Drawer, Form, Input, Popconfirm, Row,
  Select, Space, Switch, Table, Tag, Typography, message,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { warehouseApi, PhanXuong, CreatePhanXuongPayload } from '../../api/warehouse'
import ImportExcelButton from '../../components/ImportExcelButton'

const { Title, Text } = Typography

const CONG_DOAN_OPTIONS = [
  { value: 'cd1_cd2', label: 'CD1 + CD2 (Cán + In)' },
  { value: 'cd2',     label: 'CD2 (In)' },
]

const CONG_DOAN_LABEL: Record<string, { text: string; color: string }> = {
  cd1_cd2: { text: 'CD1 + CD2', color: 'blue' },
  cd2:     { text: 'CD2',       color: 'cyan' },
}

export default function PhanXuongList() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PhanXuong | null>(null)
  const [form] = Form.useForm()

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['phan-xuong'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (data: CreatePhanXuongPayload) => warehouseApi.createPhanXuong(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['phan-xuong'] })
      message.success('Đã thêm phân xưởng')
      setOpen(false)
      form.resetFields()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi lưu'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreatePhanXuongPayload }) =>
      warehouseApi.updatePhanXuong(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['phan-xuong'] })
      message.success('Đã cập nhật phân xưởng')
      setOpen(false)
      setEditing(null)
      form.resetFields()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi lưu'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => warehouseApi.deletePhanXuong(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['phan-xuong'] })
      message.success('Đã xoá phân xưởng')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Không thể xoá (đang được dùng bởi kho)'),
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ cong_doan: 'cd2', trang_thai: true })
    setOpen(true)
  }

  const openEdit = (r: PhanXuong) => {
    setEditing(r)
    form.setFieldsValue({
      ma_xuong:  r.ma_xuong,
      ten_xuong: r.ten_xuong,
      dia_chi:   r.dia_chi,
      cong_doan: r.cong_doan,
      phoi_tu_phan_xuong_id: r.phoi_tu_phan_xuong_id ?? undefined,
      trang_thai: r.trang_thai,
    })
    setOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields()
      const payload: CreatePhanXuongPayload = {
        ma_xuong:  v.ma_xuong,
        ten_xuong: v.ten_xuong,
        dia_chi:   v.dia_chi || null,
        cong_doan: v.cong_doan,
        phoi_tu_phan_xuong_id: v.cong_doan === 'cd2' ? (v.phoi_tu_phan_xuong_id ?? null) : null,
        trang_thai: v.trang_thai ?? true,
      }
      if (editing) {
        updateMut.mutate({ id: editing.id, data: payload })
      } else {
        createMut.mutate(payload)
      }
    } catch { /* validation shown inline */ }
  }

  const columns = [
    {
      title: 'Mã xưởng', dataIndex: 'ma_xuong', width: 130,
      render: (v: string) => <Text strong style={{ color: '#1677ff' }}>{v}</Text>,
    },
    { title: 'Tên phân xưởng', dataIndex: 'ten_xuong', ellipsis: true },
    { title: 'Địa chỉ', dataIndex: 'dia_chi', ellipsis: true },
    {
      title: 'Công đoạn', dataIndex: 'cong_doan', width: 140,
      render: (v: string) => {
        const cfg = CONG_DOAN_LABEL[v] ?? { text: v, color: 'default' }
        return <Tag color={cfg.color}>{cfg.text}</Tag>
      },
    },
    {
      title: 'Nhận phôi từ', dataIndex: 'ten_phoi_tu_phan_xuong', width: 160, ellipsis: true,
      render: (v: string | null, r: PhanXuong) =>
        r.cong_doan === 'cd2'
          ? (v ? <Text style={{ color: '#722ed1' }}>{v}</Text> : <Text type="warning">Chưa cấu hình</Text>)
          : <Text type="secondary">—</Text>,
    },
    {
      title: 'Hoạt động', dataIndex: 'trang_thai', width: 100, align: 'center' as const,
      render: (v: boolean) => <Switch checked={v} size="small" disabled />,
    },
    {
      title: '', width: 80,
      render: (_: unknown, r: PhanXuong) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm
            title="Xoá phân xưởng này?"
            description="Chỉ xoá được nếu không có kho nào thuộc xưởng này."
            onConfirm={() => deleteMut.mutate(r.id)}
            okButtonProps={{ danger: true }}
          >
            <Button danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Danh mục nơi sản xuất (Phân xưởng)</Title>
        </Col>
        <Col>
          <Space>
            <ImportExcelButton
              endpoint="/api/warehouse/phan-xuong"
              templateFilename="mau_import_phan_xuong.xlsx"
              buttonText="Import Excel"
              onImported={() => qc.invalidateQueries({ queryKey: ['phan-xuong'] })}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Thêm phân xưởng
            </Button>
          </Space>
        </Col>
      </Row>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={list}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size="small"
          pagination={{ pageSize: 20 }}
          scroll={{ x: 700 }}
        />
      </Card>

      <Drawer
        open={open}
        onClose={() => { setOpen(false); setEditing(null); form.resetFields() }}
        title={editing ? 'Chỉnh sửa phân xưởng' : 'Thêm phân xưởng'}
        width={480}
        footer={
          <Space>
            <Button onClick={() => { setOpen(false); setEditing(null) }}>Huỷ</Button>
            <Button
              type="primary"
              loading={createMut.isPending || updateMut.isPending}
              onClick={handleSubmit}
            >
              {editing ? 'Cập nhật' : 'Thêm mới'}
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ cong_doan: 'cd2', trang_thai: true }}>
          <Row gutter={12}>
            <Col span={10}>
              <Form.Item
                name="ma_xuong"
                label="Mã xưởng"
                rules={[{ required: true, message: 'Nhập mã xưởng' }]}
              >
                <Input placeholder="VD: hoang_gia" disabled={!!editing} />
              </Form.Item>
            </Col>
            <Col span={14}>
              <Form.Item
                name="ten_xuong"
                label="Tên phân xưởng"
                rules={[{ required: true, message: 'Nhập tên' }]}
              >
                <Input placeholder="VD: Xưởng Hoàng Gia" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="dia_chi" label="Địa chỉ">
            <Input placeholder="Địa chỉ xưởng..." />
          </Form.Item>
          <Form.Item
            name="cong_doan"
            label="Công đoạn sản xuất"
            rules={[{ required: true, message: 'Chọn công đoạn' }]}
          >
            <Select options={CONG_DOAN_OPTIONS} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.cong_doan !== cur.cong_doan}>
            {({ getFieldValue }) => getFieldValue('cong_doan') === 'cd2' && (
              <Form.Item
                name="phoi_tu_phan_xuong_id"
                label="Nhận phôi từ xưởng"
                extra="Xưởng CD1+CD2 cung cấp phôi sóng cho xưởng này"
              >
                <Select
                  allowClear
                  placeholder="Chọn xưởng cung cấp phôi..."
                  options={list
                    .filter(px => px.cong_doan === 'cd1_cd2' && px.trang_thai)
                    .map(px => ({ value: px.id, label: `${px.ten_xuong} (${px.ma_xuong})` }))
                  }
                />
              </Form.Item>
            )}
          </Form.Item>
          <Form.Item name="trang_thai" label="Hoạt động" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}
