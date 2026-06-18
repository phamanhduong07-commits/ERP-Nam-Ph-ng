import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Modal, Form, Input, InputNumber, Select,
  Tag, Badge, Popconfirm, message, Typography, Row, Col, Switch, Divider, Checkbox,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { ApiError } from '../../api/types'
import client from '../../api/client'
import EmptyState from '../../components/EmptyState'
import { useHotkey } from '../../hooks/useHotkey'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Title } = Typography

interface ChartOfAccount {
  id: number
  so_tk: string
  ten_tk: string
  loai_tk: string
  cap: number
  so_tk_cha: string | null
  trang_thai: boolean
  theo_doi_doi_tuong: boolean
  loai_doi_tuong: string | null
}

const coaApi = {
  list: (params?: { q?: string; loai_tk?: string }) =>
    client.get<ChartOfAccount[]>('/chart-of-accounts', { params }),
  create: (d: Omit<ChartOfAccount, 'id'>) =>
    client.post<ChartOfAccount>('/chart-of-accounts', d),
  update: (id: number, d: Partial<Omit<ChartOfAccount, 'id'>>) =>
    client.put<ChartOfAccount>(`/chart-of-accounts/${id}`, d),
  delete: (id: number) => client.delete(`/chart-of-accounts/${id}`),
}

// Map loại tài khoản → màu Tag + nhãn tiếng Việt. Source of truth cho hiển thị.
const LOAI_TK_META: Record<string, { color: string; label: string }> = {
  tai_san: { color: 'blue', label: 'Tài sản' },
  no_phai_tra: { color: 'orange', label: 'Nợ phải trả' },
  von_chu_so_huu: { color: 'purple', label: 'Vốn CSH' },
  doanh_thu: { color: 'green', label: 'Doanh thu' },
  chi_phi: { color: 'red', label: 'Chi phí' },
}

const LOAI_TK_OPTIONS = [
  { value: 'tai_san', label: 'Tài sản' },
  { value: 'no_phai_tra', label: 'Nợ phải trả' },
  { value: 'von_chu_so_huu', label: 'Vốn chủ sở hữu' },
  { value: 'doanh_thu', label: 'Doanh thu' },
  { value: 'chi_phi', label: 'Chi phí' },
]

export default function ChartOfAccountsPage() {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ChartOfAccount | null>(null)
  const [q, setQ] = useState('')
  const [loaiFilter, setLoaiFilter] = useState<string | undefined>(undefined)
  const [exporting, setExporting] = useState(false)

  const { data = [], isLoading } = useQuery({
    queryKey: ['chart-of-accounts', q, loaiFilter],
    queryFn: () =>
      coaApi
        .list({ q: q || undefined, loai_tk: loaiFilter || undefined })
        .then(r => r.data),
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] })

  const createMut = useMutation({
    mutationFn: (d: Omit<ChartOfAccount, 'id'>) => coaApi.create(d),
    onSuccess: () => {
      invalidate()
      closeModal()
      message.success('Đã thêm tài khoản')
    },
    onError: (e: unknown) =>
      message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi thêm'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<ChartOfAccount, 'id'>> }) =>
      coaApi.update(id, data),
    onSuccess: () => {
      invalidate()
      closeModal()
      message.success('Đã cập nhật')
    },
    onError: (e: unknown) =>
      message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi cập nhật'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => coaApi.delete(id),
    onSuccess: () => {
      invalidate()
      message.success('Đã xoá')
    },
    onError: (e: unknown) =>
      message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi xoá'),
  })

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await client.get('/chart-of-accounts/export-excel', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = 'he_thong_tai_khoan.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi xuất Excel')
    } finally {
      setExporting(false)
    }
  }

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ cap: 1, trang_thai: true })
    setModalOpen(true)
  }

  const openEdit = (row: ChartOfAccount) => {
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
    const payload: Omit<ChartOfAccount, 'id'> = {
      so_tk: vals.so_tk,
      ten_tk: vals.ten_tk,
      loai_tk: vals.loai_tk,
      cap: vals.cap ?? 1,
      so_tk_cha: vals.so_tk_cha || null,
      trang_thai: vals.trang_thai ?? true,
      theo_doi_doi_tuong: vals.theo_doi_doi_tuong ?? false,
      loai_doi_tuong: vals.theo_doi_doi_tuong ? (vals.loai_doi_tuong || null) : null,
    }
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload })
    } else {
      createMut.mutate(payload)
    }
  }

  useHotkey('ctrl+n', openCreate, 'Thêm tài khoản kế toán mới')
  useHotkey('ctrl+s', handleSave, 'Lưu tài khoản kế toán', 'Trang hiện tại', modalOpen)

  const columns: ColumnsType<ChartOfAccount> = [
    {
      title: 'Số TK',
      dataIndex: 'so_tk',
      width: 120,
      render: (v: string, r: ChartOfAccount) => {
        const indent = r.cap === 2 ? 16 : r.cap === 3 ? 32 : 0
        return (
          <span style={{ paddingLeft: indent, fontWeight: r.cap === 1 ? 700 : 400 }}>{v}</span>
        )
      },
    },
    { title: 'Tên tài khoản', dataIndex: 'ten_tk' },
    {
      title: 'Loại',
      dataIndex: 'loai_tk',
      width: 130,
      render: (v: string) => {
        const meta = LOAI_TK_META[v]
        return meta ? <Tag color={meta.color}>{meta.label}</Tag> : <Tag>{v}</Tag>
      },
    },
    {
      title: 'Cấp',
      dataIndex: 'cap',
      width: 70,
      align: 'center',
      render: (v: number) => <Badge count={v} showZero color="#1565C0" />,
    },
    { title: 'TK cha', dataIndex: 'so_tk_cha', width: 100, render: (v: string | null) => v ?? '—' },
    {
      title: 'Theo dõi đối tượng',
      key: 'theo_doi',
      width: 160,
      render: (_: unknown, r: ChartOfAccount) => {
        if (!r.theo_doi_doi_tuong) return <Tag color="default">Không</Tag>
        const label = r.loai_doi_tuong === 'khach_hang' ? 'Khách hàng'
          : r.loai_doi_tuong === 'nha_cung_cap' ? 'Nhà cung cấp'
          : r.loai_doi_tuong === 'nhan_vien' ? 'Nhân viên'
          : r.loai_doi_tuong ?? ''
        return <Tag color="blue">Đối tượng: {label}</Tag>
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 110,
      align: 'center',
      render: (v: boolean) => (
        <Tag color={v ? 'green' : 'default'}>{v ? 'Đang dùng' : 'Ngừng'}</Tag>
      ),
    },
    {
      title: '',
      key: 'act',
      width: 90,
      render: (_: unknown, r: ChartOfAccount) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xoá tài khoản này?" onConfirm={() => deleteMut.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]
  const { displayColumns, settingsButton } = useColumnPrefs('danhmuc-chart-of-accounts', columns, { nonHideable: ['so_tk'] })

  return (
    <div>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }} gutter={[8, 8]}>
          <Col>
            <Title level={4} style={{ margin: 0 }}>Hệ thống tài khoản kế toán</Title>
          </Col>
          <Col>
            <Space wrap>
              <Input.Search
                allowClear
                placeholder="Tìm số TK hoặc tên..."
                style={{ width: 240 }}
                onSearch={(v) => setQ(v.trim())}
              />
              <Select
                allowClear
                placeholder="Lọc theo loại"
                style={{ width: 170 }}
                value={loaiFilter}
                onChange={(v) => setLoaiFilter(v)}
                options={LOAI_TK_OPTIONS}
              />
              <Button icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>
                Xuất Excel
              </Button>
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
        title={editing ? 'Sửa tài khoản' : 'Thêm tài khoản'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={createMut.isPending || updateMut.isPending}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item label="Số TK" name="so_tk" rules={[{ required: true, message: 'Nhập số tài khoản' }]}>
            <Input placeholder="VD: 111, 131..." disabled={!!editing} />
          </Form.Item>
          <Form.Item label="Tên tài khoản" name="ten_tk" rules={[{ required: true, message: 'Nhập tên tài khoản' }]}>
            <Input placeholder="VD: Tiền mặt, Phải thu khách hàng..." />
          </Form.Item>
          <Form.Item label="Loại" name="loai_tk" rules={[{ required: true, message: 'Chọn loại tài khoản' }]}>
            <Select placeholder="Chọn loại" options={LOAI_TK_OPTIONS} />
          </Form.Item>
          <Form.Item label="Cấp" name="cap">
            <InputNumber min={1} max={3} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="TK cha" name="so_tk_cha">
            <Input placeholder="Nhập mã TK cha" />
          </Form.Item>
          <Form.Item label="Đang dùng" name="trang_thai" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
