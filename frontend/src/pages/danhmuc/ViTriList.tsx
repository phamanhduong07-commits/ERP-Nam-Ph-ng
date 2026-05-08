import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Modal, Form, Input,
  Tag, Popconfirm, message, Typography, Row, Col, Switch, Select,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { viTriApi, type ViTri } from '../../api/simpleApis'
import ImportExcelButton from '../../components/ImportExcelButton'

const { Title } = Typography

const LOAI_OPTIONS = [
  { value: 'nhan_vien', label: 'Nhân viên' },
  { value: 'kho', label: 'Kho' },
  { value: 'san_xuat', label: 'Sản xuất' },
]

const loaiLabel = (v: string | null) => {
  if (!v) return '—'
  return LOAI_OPTIONS.find(o => o.value === v)?.label ?? v
}

export default function ViTriList() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ViTri | null>(null)
  const [filterLoai, setFilterLoai] = useState<string | undefined>(undefined)

  const { data = [], isLoading } = useQuery({
    queryKey: ['vi-tri', filterLoai],
    queryFn: () => viTriApi.list({ loai: filterLoai }).then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: Omit<ViTri, 'id'>) => viTriApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vi-tri'] })
      closeModal()
      message.success('Đã thêm vị trí')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi thêm'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<ViTri, 'id'>> }) =>
      viTriApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vi-tri'] })
      closeModal()
      message.success('Đã cập nhật')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi cập nhật'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => viTriApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vi-tri'] })
      message.success('Đã xoá')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi xoá'),
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ trang_thai: true })
    setModalOpen(true)
  }

  const openEdit = (row: ViTri) => {
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
    const payload: Omit<ViTri, 'id'> = {
      ma_vi_tri: vals.ma_vi_tri,
      ten_vi_tri: vals.ten_vi_tri,
      loai: vals.loai || null,
      ghi_chu: vals.ghi_chu || null,
      trang_thai: vals.trang_thai ?? true,
    }
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload })
    } else {
      createMut.mutate(payload)
    }
  }

  const columns: ColumnsType<ViTri> = [
    { title: 'Mã vị trí', dataIndex: 'ma_vi_tri', width: 120 },
    { title: 'Tên vị trí', dataIndex: 'ten_vi_tri' },
    {
      title: 'Loại',
      dataIndex: 'loai',
      width: 120,
      render: (v: string | null) => loaiLabel(v),
    },
    { title: 'Ghi chú', dataIndex: 'ghi_chu', render: (v: string | null) => v ?? '—' },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 110,
      align: 'center',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Đang dùng' : 'Ngừng'}</Tag>,
    },
    {
      title: '',
      key: 'act',
      width: 90,
      render: (_: unknown, r: ViTri) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xoá vị trí này?" onConfirm={() => deleteMut.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Title level={4} style={{ margin: 0 }}>Vị trí</Title>
          </Col>
          <Col>
            <Space>
              <Select
                placeholder="Lọc theo loại"
                allowClear
                style={{ width: 150 }}
                value={filterLoai}
                onChange={setFilterLoai}
                options={[
                  { value: 'nhan_vien', label: 'Nhân viên' },
                  { value: 'kho', label: 'Kho' },
                  { value: 'san_xuat', label: 'Sản xuất' },
                ]}
              />
              <ImportExcelButton
                endpoint="/api/vi-tri"
                templateFilename="mau_import_vi_tri.xlsx"
                buttonText="Import Excel"
                onImported={() => queryClient.invalidateQueries({ queryKey: ['vi-tri'] })}
              />
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Thêm mới
              </Button>
            </Space>
          </Col>
        </Row>

        <Table
          rowKey="id"
          dataSource={data}
          columns={columns}
          loading={isLoading}
          pagination={{ pageSize: 20 }}
          size="small"
        />
      </Card>

      <Modal
        title={editing ? 'Sửa vị trí' : 'Thêm vị trí'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={createMut.isPending || updateMut.isPending}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item label="Mã vị trí" name="ma_vi_tri" rules={[{ required: true, message: 'Nhập mã vị trí' }]}>
            <Input placeholder="VD: VT001" disabled={!!editing} />
          </Form.Item>
          <Form.Item label="Tên vị trí" name="ten_vi_tri" rules={[{ required: true, message: 'Nhập tên vị trí' }]}>
            <Input placeholder="VD: Kho A, Phòng kế toán..." />
          </Form.Item>
          <Form.Item label="Loại" name="loai">
            <Select
              allowClear
              placeholder="Chọn loại..."
              options={LOAI_OPTIONS}
            />
          </Form.Item>
          <Form.Item label="Ghi chú" name="ghi_chu">
            <Input placeholder="Ghi chú thêm (không bắt buộc)" />
          </Form.Item>
          <Form.Item label="Đang dùng" name="trang_thai" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
