import { useRef, useState } from 'react'
import type { ApiError } from '../../api/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Modal, Form, Input, Select, Tag, message,
  Typography, Row, Col, Tabs, Image, Tooltip, InputNumber, Switch,
  Alert, Popconfirm,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, FilePdfOutlined,
  UploadOutlined, MinusCircleOutlined, ThunderboltOutlined, EyeOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { tieuChuanApi, type TieuChuanKyThuat, type TieuChuanCreate, type TieuChuanFile, type ChiTieuItem } from '../../api/tieuChuanKyThuat'
import { suppliersApi } from '../../api/suppliers'
import { materialGroupsApi } from '../../api/materialGroups'
import EmptyState from '../../components/EmptyState'
import { usePermission } from '../../hooks/usePermission'
import { useHotkey } from '../../hooks/useHotkey'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

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

const LOAI_GIAY_OPTS = [
  { value: 'nau', label: 'Nâu' },
  { value: 'trang', label: 'Trắng' },
  { value: 'xeo', label: 'Xeo' },
  { value: 'vang', label: 'Vàng' },
  { value: 'khac', label: 'Khác' },
]

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
        <Image src={f.url} width={60} height={60} style={{ objectFit: 'cover', borderRadius: 4 }} preview={{ src: f.url }} />
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
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(f.id)} />
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
  const [chiTieuList, setChiTieuList] = useState<ChiTieuItem[]>([])
  const [apDungCho, setApDungCho] = useState<string>('tat_ca')
  const [previewGiay, setPreviewGiay] = useState<{ count: number; papers: { ma_chinh: string; ten: string; loai_giay: string | null }[] } | null>(null)
  const [previewNvl, setPreviewNvl] = useState<{ count: number; nvls: { id: number; ma_chinh: string; ten: string }[] } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['tieu-chuan-ky-thuat', search, filterApDung, page],
    queryFn: () =>
      tieuChuanApi.list({ search: search || undefined, ap_dung_cho: filterApDung, page, page_size: 20 }).then(r => r.data),
  })

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.all().then(r => r.data),
  })

  const { data: paperGroups } = useQuery({
    queryKey: ['material-groups-giay'],
    queryFn: () => materialGroupsApi.list({ la_nhom_giay: true }).then(r => r.data),
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
    mutationFn: ({ id, data }: { id: number; data: Partial<TieuChuanCreate> }) => tieuChuanApi.update(id, data),
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

  const apDungMut = useMutation({
    mutationFn: (id: number) => tieuChuanApi.apDungChoGiay(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['tieu-chuan-ky-thuat'] })
      message.success(`Đã áp dụng tiêu chuẩn cho ${res.data.updated} loại giấy`)
      setPreviewGiay(null)
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi áp dụng'),
  })

  const apDungNvlMut = useMutation({
    mutationFn: (id: number) => tieuChuanApi.apDungChoNvl(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['tieu-chuan-ky-thuat'] })
      message.success(`Đã áp dụng tiêu chuẩn cho ${res.data.updated} NVL`)
      setPreviewNvl(null)
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi áp dụng'),
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ ap_dung_cho: 'tat_ca' })
    setApDungCho('tat_ca')
    setChiTieuList([])
    setPreviewGiay(null)
    setPreviewNvl(null)
    setModalOpen(true)
  }

  const openEdit = (row: TieuChuanKyThuat) => {
    setEditing(row)
    form.setFieldsValue({
      ma_tc: row.ma_tc,
      ten: row.ten,
      mo_ta: row.mo_ta,
      ap_dung_cho: row.ap_dung_cho,
      ncc_id: row.ncc_id,
      nhom_id: row.nhom_id,
      loai_giay: row.loai_giay,
      tc_dinh_luong: row.tc_dinh_luong,
      tc_sai_so_pct: row.tc_sai_so_pct,
      tc_do_buc: row.tc_do_buc,
      tc_do_nen_vong: row.tc_do_nen_vong,
    })
    setApDungCho(row.ap_dung_cho)
    setChiTieuList(row.chi_tieu_list ?? [])
    setPreviewGiay(null)
    setPreviewNvl(null)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
    setChiTieuList([])
    setPreviewGiay(null)
    setPreviewNvl(null)
  }

  const handleSave = async () => {
    const vals = await form.validateFields()
    const isGiay = vals.ap_dung_cho === 'giay' || vals.ap_dung_cho === 'tat_ca'
    const payload: TieuChuanCreate = {
      ma_tc: vals.ma_tc,
      ten: vals.ten,
      mo_ta: vals.mo_ta || null,
      ap_dung_cho: vals.ap_dung_cho ?? 'tat_ca',
      chi_tieu_list: chiTieuList.length > 0 ? chiTieuList : null,
      ncc_id: isGiay ? (vals.ncc_id ?? null) : null,
      nhom_id: isGiay ? (vals.nhom_id ?? null) : null,
      loai_giay: isGiay ? (vals.loai_giay ?? null) : null,
      tc_dinh_luong: isGiay ? (vals.tc_dinh_luong ?? null) : null,
      tc_sai_so_pct: isGiay ? (vals.tc_sai_so_pct ?? null) : null,
      tc_do_buc: isGiay ? (vals.tc_do_buc ?? null) : null,
      tc_do_nen_vong: isGiay ? (vals.tc_do_nen_vong ?? null) : null,
    }
    if (editing) updateMut.mutate({ id: editing.id, data: payload })
    else createMut.mutate(payload)
  }

  useHotkey('ctrl+n', openCreate, 'Thêm tiêu chuẩn kỹ thuật mới')
  useHotkey('ctrl+s', handleSave, 'Lưu tiêu chuẩn kỹ thuật', 'Trang hiện tại', modalOpen)

  const handlePreviewGiay = async () => {
    if (!editing) return
    try {
      const res = await tieuChuanApi.previewGiay(editing.id)
      setPreviewGiay(res.data)
    } catch {
      message.error('Lỗi khi preview')
    }
  }

  const handlePreviewNvl = async () => {
    if (!editing) return
    try {
      const res = await tieuChuanApi.previewNvl(editing.id)
      setPreviewNvl(res.data)
    } catch {
      message.error('Lỗi khi preview NVL')
    }
  }

  const addChiTieu = () => {
    const nextStt = chiTieuList.length > 0 ? Math.max(...chiTieuList.map(c => c.stt)) + 1 : 1
    setChiTieuList(prev => [...prev, {
      stt: nextStt, ten_chi_tieu: '', don_vi: null, yeu_cau_text: null,
      kieu_kiem_tra: 'pass_fail', gia_tri_min: null, gia_tri_max: null,
      bat_buoc: true, so_lan_do: null, tolerance_pct: null,
    }])
  }

  const handleMigratePaperTc = async () => {
    try {
      const res = await tieuChuanApi.migratePaperTcToChiTieuList()
      message.success(`Đã chuyển ${res.data.migrated} tiêu chuẩn giấy sang chi_tieu_list (bỏ qua ${res.data.skipped})`)
      queryClient.invalidateQueries({ queryKey: ['tieu-chuan-ky-thuat'] })
      if (editing) {
        const updated = await tieuChuanApi.get(editing.id)
        setEditing(updated.data)
        setChiTieuList(updated.data.chi_tieu_list ?? [])
      }
    } catch {
      message.error('Lỗi khi migrate')
    }
  }

  const removeChiTieu = (idx: number) => setChiTieuList(prev => prev.filter((_, i) => i !== idx))

  const updateChiTieu = (idx: number, field: keyof ChiTieuItem, value: unknown) => {
    setChiTieuList(prev => prev.map((ct, i) => i === idx ? { ...ct, [field]: value } : ct))
  }

  const saveChiTieuList = () => {
    if (!editing) return
    updateMut.mutate({ id: editing.id, data: { chi_tieu_list: chiTieuList.length > 0 ? chiTieuList : null } })
  }

  const handleFileUpload = async (file: File) => {
    if (!editing) return
    setUploading(true)
    try {
      await tieuChuanApi.uploadFile(editing.id, file)
      queryClient.invalidateQueries({ queryKey: ['tieu-chuan-ky-thuat'] })
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
  const showGiayFields = apDungCho === 'giay' || apDungCho === 'tat_ca'
  const showNvlFields = apDungCho === 'nvl' || apDungCho === 'tat_ca'

  const supplierOptions = (suppliers ?? []).map(s => ({
    value: s.id,
    label: `${s.ma_ncc} — ${s.ten_viet_tat}`,
  }))

  const paperGroupOptions = (paperGroups ?? []).map(g => ({
    value: g.id,
    label: `${g.ma_nhom} — ${g.ten_nhom}`,
  }))

  const columns: ColumnsType<TieuChuanKyThuat> = [
    { title: 'Mã TC', dataIndex: 'ma_tc', width: 130 },
    { title: 'Tên tiêu chuẩn', dataIndex: 'ten', ellipsis: true },
    {
      title: 'NCC',
      dataIndex: 'ncc_ten',
      width: 120,
      render: (v: string | null) => v ? <Tag color="cyan">{v}</Tag> : <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Nhóm giấy',
      dataIndex: 'nhom_ten',
      width: 110,
      render: (v: string | null) => v ? <Tag color="geekblue">{v}</Tag> : <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Loại giấy',
      dataIndex: 'loai_giay',
      width: 90,
      render: (v: string | null) => {
        if (!v) return <span style={{ color: '#bbb' }}>—</span>
        const opt = LOAI_GIAY_OPTS.find(o => o.value === v)
        return <Tag>{opt?.label ?? v}</Tag>
      },
    },
    {
      title: 'Sai số',
      dataIndex: 'tc_sai_so_pct',
      width: 80,
      align: 'center',
      render: (v: number | null) => v != null ? <span>±{v}%</span> : <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Độ bục TC',
      dataIndex: 'tc_do_buc',
      width: 90,
      align: 'center',
      render: (v: number | null) => v != null ? <span>≥{v}</span> : <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Áp dụng cho',
      dataIndex: 'ap_dung_cho',
      width: 120,
      render: (v: string) => {
        const opt = AP_DUNG_OPTS.find(o => o.value === v)
        return <Tag color={AP_DUNG_COLOR[v] ?? 'default'}>{opt?.label ?? v}</Tag>
      },
    },
    {
      title: 'Chỉ tiêu',
      dataIndex: 'chi_tieu_list',
      width: 80,
      align: 'center',
      render: (v: ChiTieuItem[] | null) => v?.length ? <Tag color="geekblue">{v.length} CT</Tag> : <span style={{ color: '#bbb' }}>—</span>,
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
  const { displayColumns, settingsButton } = useColumnPrefs('danhmuc-tieu-chuan-ky-thuat', columns, { nonHideable: ['ma_tc'] })

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
              {settingsButton}
            </Space>
          </Col>
        </Row>

        <Table
          locale={{ emptyText: <EmptyState size="small" /> }}
          rowKey="id"
          dataSource={items}
          columns={displayColumns}
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
        width={760}
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
                        <Input disabled={!!editing} placeholder="VD: TC-VH-NAU-5PCT" />
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
                        <Select options={AP_DUNG_OPTS} onChange={v => setApDungCho(v)} />
                      </Form.Item>
                    </Col>
                  </Row>

                  {showGiayFields && (
                    <>
                      <div style={{ background: '#f0f7ff', border: '1px solid #91caff', borderRadius: 6, padding: '12px 16px', marginBottom: 16 }}>
                        <div style={{ fontWeight: 600, color: '#1677ff', marginBottom: 10, fontSize: 13 }}>
                          Tiêu chuẩn giấy cuộn — áp dụng theo NCC + nhóm giấy + loại giấy
                        </div>
                        <Row gutter={12}>
                          <Col span={12}>
                            <Form.Item label="Nhà cung cấp (NCC)" name="ncc_id" style={{ marginBottom: 8 }}>
                              <Select
                                showSearch
                                allowClear
                                placeholder="Chọn NCC..."
                                options={supplierOptions}
                                filterOption={(input, opt) =>
                                  (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                              />
                            </Form.Item>
                          </Col>
                          <Col span={7}>
                            <Form.Item label="Nhóm giấy" name="nhom_id" style={{ marginBottom: 8 }}>
                              <Select
                                showSearch
                                allowClear
                                placeholder="Tất cả nhóm"
                                options={paperGroupOptions}
                                filterOption={(input, opt) =>
                                  (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                              />
                            </Form.Item>
                          </Col>
                          <Col span={5}>
                            <Form.Item label="Loại giấy" name="loai_giay" style={{ marginBottom: 8 }}>
                              <Select allowClear placeholder="Tất cả loại" options={LOAI_GIAY_OPTS} />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Row gutter={12}>
                          <Col span={6}>
                            <Form.Item label="Định lượng TC (g/m²)" name="tc_dinh_luong" style={{ marginBottom: 8 }}>
                              <InputNumber min={0} step={1} style={{ width: '100%' }} placeholder="VD: 100" />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item label="Sai số định lượng (%)" name="tc_sai_so_pct" style={{ marginBottom: 8 }}>
                              <InputNumber min={0} max={20} step={0.5} style={{ width: '100%' }} placeholder="VD: 5" addonAfter="%" />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item label="Độ bục tối thiểu (kPa)" name="tc_do_buc" style={{ marginBottom: 0 }}>
                              <InputNumber min={0} step={0.01} style={{ width: '100%' }} placeholder="VD: 200" />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item label="Độ nén vòng tối thiểu" name="tc_do_nen_vong" style={{ marginBottom: 0 }}>
                              <InputNumber min={0} step={0.01} style={{ width: '100%' }} placeholder="VD: 100" />
                            </Form.Item>
                          </Col>
                        </Row>
                      </div>

                      {editing && editing.ncc_id && (
                        <div style={{ marginBottom: 16 }}>
                          {previewGiay ? (
                            <Alert
                              type="info"
                              message={
                                <div>
                                  <b>{previewGiay.count} loại giấy</b> từ NCC này
                                  {editing.nhom_ten ? ` (nhóm ${editing.nhom_ten})` : ''}
                                  {editing.loai_giay ? ` (loại ${LOAI_GIAY_OPTS.find(o => o.value === editing.loai_giay)?.label ?? editing.loai_giay})` : ''} sẽ được áp dụng tiêu chuẩn này.
                                  {previewGiay.papers.length > 0 && (
                                    <div style={{ marginTop: 6, fontSize: 12, color: '#555' }}>
                                      {previewGiay.papers.slice(0, 5).map(p => (
                                        <div key={p.ma_chinh}>{p.ma_chinh} — {p.ten}</div>
                                      ))}
                                      {previewGiay.count > 5 && <div>...và {previewGiay.count - 5} loại khác</div>}
                                    </div>
                                  )}
                                  <div style={{ marginTop: 8 }}>
                                    <Popconfirm
                                      title={`Áp dụng tiêu chuẩn cho ${previewGiay.count} loại giấy?`}
                                      description="Thao tác này sẽ ghi đè sai_so_pct, độ bục, độ nén vòng của các giấy phù hợp."
                                      okText="Áp dụng"
                                      cancelText="Huỷ"
                                      onConfirm={() => apDungMut.mutate(editing.id)}
                                    >
                                      <Button
                                        type="primary"
                                        size="small"
                                        icon={<ThunderboltOutlined />}
                                        loading={apDungMut.isPending}
                                      >
                                        Áp dụng cho {previewGiay.count} loại giấy
                                      </Button>
                                    </Popconfirm>
                                  </div>
                                </div>
                              }
                            />
                          ) : (
                            <Button size="small" icon={<EyeOutlined />} onClick={handlePreviewGiay}>
                              Xem giấy sẽ được áp dụng
                            </Button>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {showNvlFields && editing && (editing.ncc_id || editing.nhom_id) && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontWeight: 600, color: '#389e0d', marginBottom: 8, fontSize: 13 }}>
                        Áp dụng cho NVL khác
                      </div>
                      {previewNvl ? (
                        <Alert
                          type="success"
                          message={
                            <div>
                              <b>{previewNvl.count} NVL</b> phù hợp sẽ được gán tiêu chuẩn này.
                              {previewNvl.nvls.length > 0 && (
                                <div style={{ marginTop: 6, fontSize: 12, color: '#555' }}>
                                  {previewNvl.nvls.slice(0, 5).map(n => (
                                    <div key={n.ma_chinh}>{n.ma_chinh} — {n.ten}</div>
                                  ))}
                                  {previewNvl.count > 5 && <div>...và {previewNvl.count - 5} NVL khác</div>}
                                </div>
                              )}
                              <div style={{ marginTop: 8 }}>
                                <Popconfirm
                                  title={`Áp dụng tiêu chuẩn cho ${previewNvl.count} NVL?`}
                                  description="Thao tác này sẽ gán tieu_chuan_id cho các NVL phù hợp."
                                  okText="Áp dụng"
                                  cancelText="Huỷ"
                                  onConfirm={() => apDungNvlMut.mutate(editing.id)}
                                >
                                  <Button
                                    type="primary"
                                    size="small"
                                    icon={<ThunderboltOutlined />}
                                    loading={apDungNvlMut.isPending}
                                    style={{ background: '#389e0d' }}
                                  >
                                    Áp dụng cho {previewNvl.count} NVL
                                  </Button>
                                </Popconfirm>
                              </div>
                            </div>
                          }
                        />
                      ) : (
                        <Button size="small" icon={<EyeOutlined />} onClick={handlePreviewNvl}>
                          Xem NVL sẽ được áp dụng
                        </Button>
                      )}
                    </div>
                  )}

                  <Form.Item label="Mô tả" name="mo_ta">
                    <Input.TextArea rows={3} placeholder="Mô tả nội dung tiêu chuẩn, phạm vi áp dụng..." />
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
              key: '3',
              label: `Chỉ tiêu KT${chiTieuList.length > 0 ? ` (${chiTieuList.length})` : ''}`,
              children: editing ? (
                <div>
                  <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#888', fontSize: 12 }}>
                      {apDungCho === 'giay'
                        ? 'Chỉ tiêu giấy cuộn — dùng cho phiếu QC (Phase 3)'
                        : 'Danh sách chỉ tiêu kiểm tra — dùng trong phiếu QC NVL'}
                    </span>
                    {canManage && (
                      <Space>
                        {apDungCho === 'giay' && chiTieuList.length === 0 && (
                          <Popconfirm
                            title="Chuyển TC giấy sang chi_tieu_list?"
                            description="Điền từ các giá trị tc_dinh_luong, tc_do_buc, tc_do_nen_vong hiện có."
                            okText="Chuyển"
                            cancelText="Huỷ"
                            onConfirm={handleMigratePaperTc}
                          >
                            <Button size="small">Auto-fill từ TC cứng</Button>
                          </Popconfirm>
                        )}
                        <Button size="small" icon={<PlusOutlined />} onClick={addChiTieu}>Thêm chỉ tiêu</Button>
                        <Button size="small" type="primary" loading={updateMut.isPending} onClick={saveChiTieuList}>Lưu</Button>
                      </Space>
                    )}
                  </div>
                  {chiTieuList.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#bbb', padding: '24px 0' }}>
                      Chưa có chỉ tiêu — nhấn "Thêm chỉ tiêu" để bắt đầu
                    </div>
                  ) : (
                    chiTieuList.map((ct, idx) => (
                      <div key={idx} style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: 10, marginBottom: 8 }}>
                        <Row gutter={8} align="middle">
                          <Col flex="36px">
                            <div style={{ color: '#888', fontSize: 12, textAlign: 'center' }}>{ct.stt}</div>
                          </Col>
                          <Col flex="1">
                            <Input
                              size="small"
                              placeholder="Tên chỉ tiêu *"
                              value={ct.ten_chi_tieu}
                              onChange={e => updateChiTieu(idx, 'ten_chi_tieu', e.target.value)}
                            />
                          </Col>
                          <Col flex="72px">
                            <Input
                              size="small"
                              placeholder="Đơn vị"
                              value={ct.don_vi ?? ''}
                              onChange={e => updateChiTieu(idx, 'don_vi', e.target.value || null)}
                            />
                          </Col>
                          <Col flex="140px">
                            <Select
                              size="small"
                              style={{ width: '100%' }}
                              value={ct.kieu_kiem_tra}
                              onChange={v => updateChiTieu(idx, 'kieu_kiem_tra', v)}
                              options={[
                                { value: 'pass_fail', label: 'Đạt/Không đạt' },
                                { value: 'range', label: 'Khoảng (min–max)' },
                                { value: 'min', label: 'Tối thiểu (≥)' },
                                { value: 'max', label: 'Tối đa (≤)' },
                                { value: 'average_range', label: 'TB ± sai số %' },
                                { value: 'average_min', label: 'TB tối thiểu (≥)' },
                              ]}
                            />
                          </Col>
                          {(ct.kieu_kiem_tra === 'range' || ct.kieu_kiem_tra === 'min') && (
                            <Col flex="72px">
                              <InputNumber size="small" style={{ width: '100%' }} placeholder="Min"
                                value={ct.gia_tri_min ?? undefined}
                                onChange={v => updateChiTieu(idx, 'gia_tri_min', v)} />
                            </Col>
                          )}
                          {(ct.kieu_kiem_tra === 'range' || ct.kieu_kiem_tra === 'max') && (
                            <Col flex="72px">
                              <InputNumber size="small" style={{ width: '100%' }} placeholder="Max"
                                value={ct.gia_tri_max ?? undefined}
                                onChange={v => updateChiTieu(idx, 'gia_tri_max', v)} />
                            </Col>
                          )}
                          {ct.kieu_kiem_tra === 'pass_fail' && (
                            <Col flex="150px">
                              <Input size="small" placeholder="Yêu cầu (mô tả)"
                                value={ct.yeu_cau_text ?? ''}
                                onChange={e => updateChiTieu(idx, 'yeu_cau_text', e.target.value || null)} />
                            </Col>
                          )}
                          {(ct.kieu_kiem_tra === 'average_range' || ct.kieu_kiem_tra === 'average_min') && (
                            <Col flex="72px">
                              <InputNumber size="small" style={{ width: '100%' }}
                                placeholder={ct.kieu_kiem_tra === 'average_range' ? 'Trung tâm' : 'Min (≥)'}
                                value={ct.gia_tri_min ?? undefined}
                                onChange={v => updateChiTieu(idx, 'gia_tri_min', v)} />
                            </Col>
                          )}
                          {ct.kieu_kiem_tra === 'average_range' && (
                            <Col flex="72px">
                              <InputNumber size="small" style={{ width: '100%' }} placeholder="Sai số %"
                                min={0} max={50} step={0.5} addonAfter="%"
                                value={ct.tolerance_pct ?? undefined}
                                onChange={v => updateChiTieu(idx, 'tolerance_pct', v)} />
                            </Col>
                          )}
                          {(ct.kieu_kiem_tra === 'average_range' || ct.kieu_kiem_tra === 'average_min') && (
                            <Col flex="60px">
                              <InputNumber size="small" style={{ width: '100%' }} placeholder="N lần"
                                min={1} max={20}
                                value={ct.so_lan_do ?? undefined}
                                onChange={v => updateChiTieu(idx, 'so_lan_do', v)} />
                            </Col>
                          )}
                          <Col flex="80px" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Switch size="small" checked={ct.bat_buoc}
                              onChange={v => updateChiTieu(idx, 'bat_buoc', v)} />
                            <span style={{ fontSize: 11, color: '#888' }}>Bắt buộc</span>
                          </Col>
                          {canManage && (
                            <Col flex="28px">
                              <Button size="small" danger type="text" icon={<MinusCircleOutlined />}
                                onClick={() => removeChiTieu(idx)} />
                            </Col>
                          )}
                        </Row>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#888', padding: '32px 0' }}>
                  Lưu tiêu chuẩn trước để quản lý chỉ tiêu
                </div>
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
                      <span style={{ marginLeft: 8, fontSize: 12, color: '#888' }}>Tối đa 20 MB mỗi file</span>
                    </div>
                  )}
                  {editingFiles.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#bbb', padding: '24px 0' }}>Chưa có tài liệu nào</div>
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
