import { useState } from 'react'
import { useHotkey } from '../../hooks/useHotkey'
import type { ApiError } from '../../api/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Modal, Form, Input,
  Tag, Popconfirm, message, Typography, Row, Col, Switch,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { tinhThanhApi, type TinhThanh } from '../../api/simpleApis'
import ImportExcelButton from '../../components/ImportExcelButton'
import EmptyState from "../../components/EmptyState"
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Title } = Typography

export default function TinhThanhList() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TinhThanh | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['tinh-thanh'],
    queryFn: () => tinhThanhApi.list().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: Omit<TinhThanh, 'id'>) => tinhThanhApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tinh-thanh'] })
      closeModal()
      message.success('Đã thêm tỉnh thành')
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi thêm'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<TinhThanh, 'id'>> }) =>
      tinhThanhApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tinh-thanh'] })
      closeModal()
      message.success('Đã cập nhật')
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi cập nhật'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => tinhThanhApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tinh-thanh'] })
      message.success('Đã xoá')
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi xoá'),
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ trang_thai: true })
    setModalOpen(true)
  }

  const openEdit = (row: TinhThanh) => {
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
    const payload: Omit<TinhThanh, 'id'> = {
      ma_tinh: vals.ma_tinh,
      ten_tinh: vals.ten_tinh,
      trang_thai: vals.trang_thai ?? true,
    }
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload })
    } else {
      createMut.mutate(payload)
    }
  }

  useHotkey('ctrl+n', openCreate, 'Thêm tỉnh/thành phố mới')
  useHotkey('ctrl+s', handleSave, 'Lưu tỉnh/thành phố', 'Trang hiện tại', modalOpen)

  const columns: ColumnsType<TinhThanh> = [
    { title: 'Mã tỉnh', dataIndex: 'ma_tinh', width: 120 },
    { title: 'Tên tỉnh', dataIndex: 'ten_tinh' },
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
      render: (_: unknown, r: TinhThanh) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xoá tỉnh thành này?" onConfirm={() => deleteMut.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]
  const { displayColumns, settingsButton } = useColumnPrefs('danhmuc-tinh-thanh', columns, { nonHideable: ['ma_tinh'] })

  return (
    <div>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Title level={4} style={{ margin: 0 }}>Tỉnh / Thành phố</Title>
          </Col>
          <Col>
            <Space>
              <ImportExcelButton
                endpoint="/api/tinh-thanh"
                templateFilename="mau_import_tinh_thanh.xlsx"
                buttonText="Import Excel"
                onImported={() => queryClient.invalidateQueries({ queryKey: ['tinh-thanh'] })}
              />
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Thêm mới
              </Button>
              {settingsButton}
            </Space>
          </Col>
        </Row>

        <Table
                    locale={{ emptyText: <EmptyState size="small" /> }}
                    rowKey="id"
          dataSource={data}
          columns={displayColumns}
          loading={isLoading}
          pagination={{ pageSize: 20 }}
          size="small"
        />
      </Card>

      <Modal
        title={editing ? 'Sửa tỉnh thành' : 'Thêm tỉnh thành'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={createMut.isPending || updateMut.isPending}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item label="Mã tỉnh" name="ma_tinh" rules={[{ required: true, message: 'Nhập mã tỉnh' }]}>
            <Input placeholder="VD: HCM, HN, CT..." disabled={!!editing} />
          </Form.Item>
          <Form.Item label="Tên tỉnh" name="ten_tinh" rules={[{ required: true, message: 'Nhập tên tỉnh' }]}>
            <Input placeholder="VD: TP. Hồ Chí Minh" />
          </Form.Item>
          <Form.Item label="Đang dùng" name="trang_thai" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
