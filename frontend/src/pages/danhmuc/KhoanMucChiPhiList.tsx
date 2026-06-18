import { useState } from 'react'
import { useHotkey } from '../../hooks/useHotkey'
import type { ApiError } from '../../api/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Modal, Form, Input,
  Tag, Popconfirm, message, Typography, Row, Col, Switch, Select, Tooltip,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import client from '../../api/client'
import EmptyState from '../../components/EmptyState'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Title } = Typography
const { TextArea } = Input

interface KhoanMucChiPhi {
  id: number
  ma_kmcp: string
  ten_kmcp: string
  loai_chi_phi: string | null
  ma_loai_tk_no: string | null
  ghi_chu: string | null
  trang_thai: boolean
}

interface TaiKhoanNgamDinh {
  id: number
  ma_loai: string
  ten_loai: string
  nhom: string
  so_tk: string | null
}

type KhoanMucChiPhiInput = Omit<KhoanMucChiPhi, 'id'>

const ENDPOINT = '/khoan-muc-chi-phi'

const api = {
  list: () => client.get<KhoanMucChiPhi[]>(ENDPOINT),
  create: (d: KhoanMucChiPhiInput) => client.post<KhoanMucChiPhi>(ENDPOINT, d),
  update: (id: number, d: KhoanMucChiPhiInput) => client.put<KhoanMucChiPhi>(`${ENDPOINT}/${id}`, d),
  delete: (id: number) => client.delete(`${ENDPOINT}/${id}`),
}

const LOAI_OPTIONS = [
  { value: 'nhan_cong', label: 'Nhân công' },
  { value: 'nguyen_vat_lieu', label: 'NVL' },
  { value: 'may_moc', label: 'Máy móc' },
  { value: 'tieu_hao', label: 'Tiêu hao' },
  { value: 'chi_phi_chung', label: 'Chi phí chung' },
  { value: 'khac', label: 'Khác' },
]

const LOAI_TAG: Record<string, { label: string; color: string }> = {
  nhan_cong: { label: 'Nhân công', color: 'cyan' },
  nguyen_vat_lieu: { label: 'NVL', color: 'blue' },
  may_moc: { label: 'Máy móc', color: 'orange' },
  tieu_hao: { label: 'Tiêu hao', color: 'gold' },
  chi_phi_chung: { label: 'Chi phí chung', color: 'purple' },
  khac: { label: 'Khác', color: 'default' },
}

export default function KhoanMucChiPhiList() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<KhoanMucChiPhi | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['khoan-muc-chi-phi'],
    queryFn: () => api.list().then(r => r.data),
  })

  const { data: tkNgamDinhList = [] } = useQuery<TaiKhoanNgamDinh[]>({
    queryKey: ['tai-khoan-ngam-dinh'],
    queryFn: () => client.get<TaiKhoanNgamDinh[]>('/tai-khoan-ngam-dinh').then(r => r.data),
    staleTime: 30 * 60 * 1000,
  })

  const tkMap = Object.fromEntries(tkNgamDinhList.map(t => [t.ma_loai, t]))

  const createMut = useMutation({
    mutationFn: (d: KhoanMucChiPhiInput) => api.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['khoan-muc-chi-phi'] })
      closeModal()
      message.success('Đã thêm khoản mục chi phí')
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi thêm'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: KhoanMucChiPhiInput }) => api.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['khoan-muc-chi-phi'] })
      closeModal()
      message.success('Đã cập nhật')
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi cập nhật'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['khoan-muc-chi-phi'] })
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

  const openEdit = (row: KhoanMucChiPhi) => {
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
    const payload: KhoanMucChiPhiInput = {
      ma_kmcp: vals.ma_kmcp,
      ten_kmcp: vals.ten_kmcp,
      loai_chi_phi: vals.loai_chi_phi || null,
      ma_loai_tk_no: vals.ma_loai_tk_no || null,
      ghi_chu: vals.ghi_chu || null,
      trang_thai: vals.trang_thai ?? true,
    }
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload })
    } else {
      createMut.mutate(payload)
    }
  }

  useHotkey('ctrl+n', openCreate, 'Thêm khoản mục chi phí mới')
  useHotkey('ctrl+s', handleSave, 'Lưu khoản mục chi phí', 'Trang hiện tại', modalOpen)

  const columns: ColumnsType<KhoanMucChiPhi> = [
    {
      title: 'STT',
      width: 55,
      align: 'center',
      render: (_: unknown, __: KhoanMucChiPhi, index: number) => index + 1,
    },
    { title: 'Mã', dataIndex: 'ma_kmcp', width: 120 },
    { title: 'Tên', dataIndex: 'ten_kmcp' },
    {
      title: 'Loại chi phí',
      dataIndex: 'loai_chi_phi',
      width: 150,
      render: (v: string | null) => {
        if (!v) return '—'
        const cfg = LOAI_TAG[v]
        return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : <Tag>{v}</Tag>
      },
    },
    {
      title: 'TK Nợ ngầm định',
      dataIndex: 'ma_loai_tk_no',
      width: 160,
      render: (v: string | null) => {
        if (!v) return '—'
        const tk = tkMap[v]
        if (!tk) return <Tag>{v}</Tag>
        return (
          <Tooltip title={tk.ten_loai}>
            <Tag color="blue">{tk.so_tk} — {tk.ten_loai}</Tag>
          </Tooltip>
        )
      },
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
      render: (_: unknown, r: KhoanMucChiPhi) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xoá khoản mục chi phí này?" onConfirm={() => deleteMut.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]
  const { displayColumns, settingsButton } = useColumnPrefs('danhmuc-khoan-muc-chi-phi', columns)

  const tkNgamDinhOptions = tkNgamDinhList.map(t => ({
    value: t.ma_loai,
    label: `${t.so_tk ?? '—'} — ${t.ten_loai}`,
  }))

  return (
    <div>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Title level={4} style={{ margin: 0 }}>Khoản mục chi phí</Title>
          </Col>
          <Col>
            <Space>
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
          pagination={false}
          size="small"
        />
      </Card>

      <Modal
        title={editing ? 'Sửa khoản mục chi phí' : 'Thêm khoản mục chi phí'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={createMut.isPending || updateMut.isPending}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item label="Mã" name="ma_kmcp" rules={[{ required: true, message: 'Nhập mã khoản mục' }]}>
            <Input placeholder="VD: CP-NC, CP-NVL..." />
          </Form.Item>
          <Form.Item label="Tên" name="ten_kmcp" rules={[{ required: true, message: 'Nhập tên khoản mục' }]}>
            <Input placeholder="VD: Chi phí nhân công trực tiếp" />
          </Form.Item>
          <Form.Item label="Loại chi phí" name="loai_chi_phi">
            <Select allowClear placeholder="Chọn loại chi phí" options={LOAI_OPTIONS} />
          </Form.Item>
          <Form.Item
            label="TK Nợ ngầm định"
            name="ma_loai_tk_no"
            extra="Khi chọn khoản mục này trong phiếu chi, TK Nợ sẽ tự điền theo tài khoản ngầm định"
          >
            <Select
              allowClear
              showSearch
              placeholder="Chọn tài khoản kế toán ngầm định"
              filterOption={(input, opt) =>
                (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={tkNgamDinhOptions}
            />
          </Form.Item>
          <Form.Item label="Ghi chú" name="ghi_chu">
            <TextArea rows={3} placeholder="Ghi chú thêm (không bắt buộc)" />
          </Form.Item>
          <Form.Item label="Đang dùng" name="trang_thai" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
