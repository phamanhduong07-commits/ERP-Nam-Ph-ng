import { useRef, useState } from 'react'
import type { ApiError } from '../../api/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Modal, Form, Input, Select, Tag, message,
  Typography, Row, Col, Tabs, Image, Tooltip,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, FilePdfOutlined, UploadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { tieuChuanApi, type TieuChuanKyThuat, type TieuChuanCreate, type TieuChuanFile } from '../../api/tieuChuanKyThuat'
import EmptyState from '../../components/EmptyState'
import { usePermission } from '../../hooks/usePermission'

const { Title } = Typography

const AP_DUNG_OPTS = [
  { value: 'tat_ca', label: 'Tất cả' },
  { value: 'giay', label: 'Giấy cuộn' },
  { value: 'nvl', label: 'NVL khác' },
]

const AP_DUNG_COLOR: Record<string, string> = {
  tat_ca: 'blue',
  giay: 'cyan',
  nvl: 'green',
}

function FileItem({ f, onDelete, canManage }: { f: TieuChuanFile; onDelete: (id: number) => void; canManage: boolean }) {
  const isPdf = f.mime_type === 'application/pdf'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
      {isPdf ? (
        <div style={{ width: 60, height: 60, background: '#fff1f0', borderRadius: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <FilePdfOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />
          <span style={{ fontSize: 9, color: '#ff4d4f' }}>PDF</span>
        </div>
      ) : (
        <Image
          src={f.url}
          width={60}
          height={60}
          style={{ objectFit: 'cover', borderRadius: 4 }}
          preview={{ src: f.url }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <a href={f.url} target="_blank" rel="noreferrer">{f.filename}</a>
        </div>
        {f.note && <div style={{ fontSize: 11, color: '#888' }}>{f.note}</div>}
        {f.size_bytes && <div style={{ fontSize: 11, color: '#aaa' }}>{(f.size_bytes / 1024).toFixed(1)} KB</div>}
      </div>
      {canManage && (
        <Tooltip title="Xóa file">
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onDelete(f.id)}
          />
        </Tooltip>
      )}
    </div>
  )
}

export default function TieuChuanKyThuatList() {
  const queryClient = useQueryClient()
  const { hasPermission } = usePermission()
  const canManage = hasPermission('master.materials.manage')
  const [form] = Form.useForm()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TieuChuanKyThuat | null>(null)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [filterApDung, setFilterApDung] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['tieu-chuan-ky-thuat', search, filterApDung, page],
    queryFn: () =>
      tieuChuanApi.list({
        search: search || undefined,
        ap_dung_cho: filterApDung,
        page,
        page_size: 20,
      }).then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: TieuChuanCreate) => tieuChuanApi.create(d),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['tieu-chuan-ky-thuat'] })
      message.success('Đã thêm tiêu chuẩn')
      setEditing(res.data)
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi thêm'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TieuChuanCreate> }) =>
      tieuChuanApi.update(id, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['tieu-chuan-ky-thuat'] })
      message.success('Đã cập nhật')
      setEditing(res.data)
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi cập nhật'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => tieuChuanApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tieu-chuan-ky-thuat'] })
      closeModal()
      message.success('Đã xóa')
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Không thể xóa'),
  })

  const deleteFileMut = useMutation({
    mutationFn: (mediaId: number) => tieuChuanApi.deleteFile(mediaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tieu-chuan-ky-thuat'] })
      message.success('Đã xóa file')
    },
    onError: () => message.error('Không thể xóa file'),
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ ap_dung_cho: 'tat_ca' })
    setModalOpen(true)
  }

  const openEdit = (row: TieuChuanKyThuat) => {
    setEditing(row)
    form.setFieldsValue({ ma_tc: row.ma_tc, ten: row.ten, mo_ta: row.mo_ta, ap_dung_cho: row.ap_dung_cho })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
  }

  const handleSave = async () => {
    const vals = await form.validateFields()
    const payload: TieuChuanCreate = {
      ma_tc: vals.ma_tc,
      ten: vals.ten,
      mo_ta: vals.mo_ta || null,
      ap_dung_cho: vals.ap_dung_cho ?? 'tat_ca',
    }
    if (editing) updateMut.mutate({ id: editing.id, data: payload })
    else createMut.mutate(payload)
  }

  const handleFileUpload = async (file: File) => {
    if (!editing) return
    setUploading(true)
    try {
      await tieuChuanApi.uploadFile(editing.id, file)
      queryClient.invalidateQueries({ queryKey: ['tieu-chuan-ky-thuat'] })
      // refresh editing record's files
      const res = await tieuChuanApi.get(editing.id)
      setEditing(res.data)
      message.success('Đã tải lên file')
    } catch {
      message.error('Lỗi khi tải file lên')
    } finally {
      setUploading(false)
    }
  }

  const items = data?.items ?? []
  const total = data?.total ?? 0

  const editingFiles: TieuChuanFile[] = editing?.files ?? []

  const columns: ColumnsType<TieuChuanKyThuat> = [
    { title: 'Mã TC', dataIndex: 'ma_tc', width: 120 },
    { title: 'Tên tiêu chuẩn', dataIndex: 'ten', ellipsis: true },
    {
      title: 'Áp dụng cho',
      dataIndex: 'ap_dung_cho',
      width: 130,
      render: (v: string) => {
        const opt = AP_DUNG_OPTS.find(o => o.value === v)
        return <Tag color={AP_DUNG_COLOR[v] ?? 'default'}>{opt?.label ?? v}</Tag>
      },
    },
    {
      title: 'Tài liệu',
      dataIndex: 'file_count',
      width: 90,
      align: 'center',
      render: (v: number) => v > 0 ? <Tag color="gold">{v} file</Tag> : <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: '',
      key: 'act',
      width: 60,
      render: (_: unknown, r: TieuChuanKyThuat) => canManage ? (
        <Button size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); openEdit(r) }} />
      ) : null,
    },
  ]

  return (
    <div>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Title level={4} style={{ margin: 0 }}>Tiêu chuẩn kỹ thuật</Title>
          </Col>
          <Col>
            <Space>
              <Input.Search
                placeholder="Tìm mã, tên tiêu chuẩn..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onSearch={v => { setSearch(v); setPage(1) }}
                allowClear
                style={{ width: 240 }}
              />
              <Select
                placeholder="Áp dụng cho"
                allowClear
                style={{ width: 140 }}
                value={filterApDung}
                onChange={v => { setFilterApDung(v); setPage(1) }}
                options={AP_DUNG_OPTS}
              />
              {canManage && (
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                  Thêm tiêu chuẩn
                </Button>
              )}
            </Space>
          </Col>
        </Row>

        <Table
          locale={{ emptyText: <EmptyState size="small" /> }}
          rowKey="id"
          dataSource={items}
          columns={columns}
          loading={isLoading}
          size="small"
          pagination={{
            current: page,
            pageSize: 20,
            total,
            showTotal: (t) => `Tổng ${t} tiêu chuẩn`,
            onChange: (p) => setPage(p),
          }}
          onRow={(r) => ({ onClick: () => openEdit(r), style: { cursor: 'pointer' } })}
        />
      </Card>

      <Modal
        title={editing ? `Sửa tiêu chuẩn — ${editing.ma_tc}` : 'Thêm tiêu chuẩn kỹ thuật'}
        open={modalOpen}
        onCancel={closeModal}
        footer={null}
        width={700}
        destroyOnClose
      >
        <Tabs
          defaultActiveKey="1"
          items={[
            {
              key: '1',
              label: 'Thông tin',
              children: (
                <Form form={form} layout="vertical" size="small">
                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item label="Mã tiêu chuẩn" name="ma_tc" rules={[{ required: true, message: 'Nhập mã TC' }]}>
                        <Input disabled={!!editing} placeholder="VD: TC-GIAY-A" />
                      </Form.Item>
                    </Col>
                    <Col span={16}>
                      <Form.Item label="Tên tiêu chuẩn" name="ten" rules={[{ required: true, message: 'Nhập tên' }]}>
                        <Input placeholder="Tên tiêu chuẩn kỹ thuật" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={12}>
                    <Col span={10}>
                      <Form.Item label="Áp dụng cho" name="ap_dung_cho">
                        <Select options={AP_DUNG_OPTS} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item label="Mô tả" name="mo_ta">
                    <Input.TextArea rows={4} placeholder="Mô tả nội dung tiêu chuẩn, phạm vi áp dụng..." />
                  </Form.Item>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                    <Space>
                      {canManage && editing && (
                        <Button
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => {
                            Modal.confirm({
                              title: 'Xóa tiêu chuẩn này?',
                              content: 'Thao tác không thể hoàn tác.',
                              okText: 'Xóa',
                              okType: 'danger',
                              cancelText: 'Huỷ',
                              onOk: () => deleteMut.mutate(editing.id),
                            })
                          }}
                        >
                          Xóa
                        </Button>
                      )}
                    </Space>
                    <Space>
                      <Button onClick={closeModal}>Huỷ</Button>
                      {canManage && (
                        <Button
                          type="primary"
                          onClick={handleSave}
                          loading={createMut.isPending || updateMut.isPending}
                        >
                          Lưu
                        </Button>
                      )}
                    </Space>
                  </div>
                </Form>
              ),
            },
            {
              key: '2',
              label: `Tài liệu${editingFiles.length > 0 ? ` (${editingFiles.length})` : ''}`,
              children: editing ? (
                <div>
                  {canManage && (
                    <div style={{ marginBottom: 16 }}>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (file) await handleFileUpload(file)
                          if (fileInputRef.current) fileInputRef.current.value = ''
                        }}
                      />
                      <Button
                        icon={<UploadOutlined />}
                        loading={uploading}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Tải lên tài liệu (PDF / Ảnh)
                      </Button>
                      <span style={{ marginLeft: 8, fontSize: 12, color: '#888' }}>
                        Tối đa 20 MB mỗi file
                      </span>
                    </div>
                  )}
                  {editingFiles.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#bbb', padding: '24px 0' }}>
                      Chưa có tài liệu nào
                    </div>
                  ) : (
                    <div>
                      {editingFiles.map(f => (
                        <FileItem
                          key={f.id}
                          f={f}
                          onDelete={(id) => {
                            Modal.confirm({
                              title: 'Xóa file này?',
                              okText: 'Xóa',
                              okType: 'danger',
                              cancelText: 'Huỷ',
                              onOk: async () => {
                                deleteFileMut.mutate(id)
                                setEditing(prev => prev
                                  ? { ...prev, files: prev.files.filter(x => x.id !== id), file_count: prev.file_count - 1 }
                                  : prev
                                )
                              },
                            })
                          }}
                          canManage={canManage}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#888', padding: '32px 0' }}>
                  Lưu tiêu chuẩn trước để tải lên tài liệu
                </div>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  )
}
