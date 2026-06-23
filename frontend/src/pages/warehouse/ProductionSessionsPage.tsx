import { useState, useMemo } from 'react'
import {
  Button, Card, Table, Tag, Space, Typography, Modal, Form, Input,
  DatePicker, InputNumber, Select, Divider, Descriptions, Drawer,
  Tabs, Tooltip, Popconfirm, Empty, Alert, Badge, Statistic, Row, Col,
  message,
} from 'antd'
import {
  PlusOutlined, ReloadOutlined, EyeOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, FileTextOutlined, BarChartOutlined,
  CloseCircleOutlined, LinkOutlined, DisconnectOutlined,
  MergeCellsOutlined, ScissorOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  warehouseApi,
  type ProductionSessionSummary,
  type ProductionSessionDetail,
  type ProductionSessionAllocation,
} from '../../api/warehouse'
import { otherMaterialsApi } from '../../api/otherMaterials'
import { productionOrdersApi } from '../../api/productionOrders'

const { Title, Text } = Typography
const { TabPane } = Tabs

// ── Trạng thái badge ─────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  dang_chay: 'processing',
  cho_phan_bo: 'warning',
  da_chot: 'success',
}
const STATUS_LABEL: Record<string, string> = {
  dang_chay: 'Đang chạy',
  cho_phan_bo: 'Chờ phân bổ',
  da_chot: 'Đã chốt',
}

const FLUTE_TYPES = ['B', 'C', 'E', 'A', 'CHUNG']

// ── Format tiền VNĐ ──────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 0 })
}
function fmtKg(n: number) {
  return `${n.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} kg`
}

// ─────────────────────────────────────────────────────────────────────────────
// Component chính
// ─────────────────────────────────────────────────────────────────────────────
export default function ProductionSessionsPage() {
  const qc = useQueryClient()

  // Bộ lọc danh sách
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)

  // Modal tạo phiên
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm] = Form.useForm()

  // Drawer chi tiết
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Drawer gán phiếu phôi sóng
  const [assignDrawerOpen, setAssignDrawerOpen] = useState(false)
  const [selectedPhieuIds, setSelectedPhieuIds] = useState<number[]>([])

  // Modal chốt phiên
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false)

  // Preview phân bổ
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewData, setPreviewData] = useState<ProductionSessionAllocation | null>(null)

  // Wastes + Materials form state
  const [wastes, setWastes] = useState<{ flute_type: string; so_kg_hao_hut: number }[]>([])
  const [materials, setMaterials] = useState<{ other_material_id: number; so_luong: number; don_gia: number }[]>([])

  // Merge modal
  const [mergeModalOpen, setMergeModalOpen] = useState(false)
  const [mergeTargetId, setMergeTargetId] = useState<number | null>(null)
  const [mergeSrcId, setMergeSrcId] = useState<number | null>(null)

  // Split modal
  const [splitModalOpen, setSplitModalOpen] = useState(false)
  const [splitPhieuIds, setSplitPhieuIds] = useState<number[]>([])
  const [splitRollIds, setSplitRollIds] = useState<number[]>([])
  const [splitForm] = Form.useForm()

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ['production-sessions', filterStatus, page],
    queryFn: () => warehouseApi.listProductionSessions({
      trang_thai: filterStatus,
      page,
      page_size: 20,
    }).then(r => r.data),
  })

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['production-session-detail', selectedId],
    queryFn: () => selectedId ? warehouseApi.getProductionSession(selectedId).then(r => r.data) : null,
    enabled: !!selectedId && detailOpen,
  })

  const { data: allPhieuSong } = useQuery({
    queryKey: ['phieu-nhap-phoi-song-list', 'all'],
    queryFn: () => productionOrdersApi.listAllPhieu().then(r => r.data),
    enabled: assignDrawerOpen,
  })

  const { data: phanXuongs } = useQuery({
    queryKey: ['phan-xuong-list'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
  })

  const { data: otherMaterials } = useQuery({
    queryKey: ['other-materials-all'],
    queryFn: () => otherMaterialsApi.list({ page_size: 200 }).then(r => r.data.items),
  })

  const { data: suggestedFlutes } = useQuery({
    queryKey: ['suggested-flutes', selectedId],
    queryFn: () => selectedId ? warehouseApi.getSuggestedFlutes(selectedId).then(r => r.data) : null,
    enabled: !!selectedId && detailOpen,
  })

  const { data: defaultMaterials } = useQuery({
    queryKey: ['default-materials', selectedId],
    queryFn: () => selectedId ? warehouseApi.getDefaultMaterials(selectedId).then(r => r.data) : null,
    enabled: !!selectedId && detailOpen,
  })

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (d: { ten_phien: string; ngay_tao?: string; phan_xuong_id?: number }) =>
      warehouseApi.createProductionSession(d),
    onSuccess: () => {
      message.success('Tạo phiên sản xuất thành công')
      setCreateOpen(false)
      createForm.resetFields()
      qc.invalidateQueries({ queryKey: ['production-sessions'] })
    },
    onError: (e: unknown) => {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      message.error(typeof detail === 'string' ? detail : 'Tạo phiên thất bại')
    },
  })

  const assignMutation = useMutation({
    mutationFn: ({ session_id, phieu_ids }: { session_id: number; phieu_ids: number[] }) =>
      warehouseApi.assignPhieuSong(session_id, phieu_ids),
    onSuccess: (r) => {
      message.success(`Đã gán ${r.data.assigned.length} phiếu vào phiên`)
      setAssignDrawerOpen(false)
      setSelectedPhieuIds([])
      qc.invalidateQueries({ queryKey: ['production-session-detail', selectedId] })
      qc.invalidateQueries({ queryKey: ['production-sessions'] })
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      message.error(msg || 'Gán phiếu thất bại')
    },
  })

  const unassignMutation = useMutation({
    mutationFn: ({ session_id, phieu_ids }: { session_id: number; phieu_ids: number[] }) =>
      warehouseApi.unassignPhieuSong(session_id, phieu_ids),
    onSuccess: () => {
      message.success('Đã bỏ gán phiếu')
      qc.invalidateQueries({ queryKey: ['production-session-detail', selectedId] })
      qc.invalidateQueries({ queryKey: ['production-sessions'] })
    },
  })

  const wastesMutation = useMutation({
    mutationFn: ({ session_id, wastes }: { session_id: number; wastes: { flute_type: string; so_kg_hao_hut: number }[] }) =>
      warehouseApi.updateSessionWastes(session_id, wastes),
    onSuccess: () => {
      message.success('Cập nhật hao hụt thành công')
      qc.invalidateQueries({ queryKey: ['production-session-detail', selectedId] })
    },
  })

  const materialsMutation = useMutation({
    mutationFn: ({ session_id, materials }: { session_id: number; materials: { other_material_id: number; so_luong: number; don_gia?: number }[] }) =>
      warehouseApi.updateSessionMaterials(session_id, materials),
    onSuccess: () => {
      message.success('Cập nhật NVL phụ thành công')
      qc.invalidateQueries({ queryKey: ['production-session-detail', selectedId] })
    },
  })

  const previewMutation = useMutation({
    mutationFn: (session_id: number) => warehouseApi.previewSessionAllocation(session_id),
    onSuccess: (r) => {
      setPreviewData(r.data)
      setPreviewOpen(true)
    },
    onError: () => message.error('Không thể tính phân bổ'),
  })

  const closeMutation = useMutation({
    mutationFn: (session_id: number) => warehouseApi.closeProductionSession(session_id),
    onSuccess: (r) => {
      message.success(r.data.message || 'Phiên đã được chốt thành công')
      setCloseConfirmOpen(false)
      setDetailOpen(false)
      qc.invalidateQueries({ queryKey: ['production-sessions'] })
      qc.invalidateQueries({ queryKey: ['production-session-detail', selectedId] })
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      message.error(msg || 'Chốt phiên thất bại')
    },
  })

  const mergeMutation = useMutation({
    mutationFn: ({ target_id, src_id }: { target_id: number; src_id: number }) =>
      warehouseApi.mergeSession(target_id, src_id),
    onSuccess: (r) => {
      message.success(r.data.message || 'Gộp phiên thành công')
      setMergeModalOpen(false)
      setMergeSrcId(null)
      qc.invalidateQueries({ queryKey: ['production-sessions'] })
      qc.invalidateQueries({ queryKey: ['production-session-detail'] })
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      message.error(msg || 'Gộp phiên thất bại')
    },
  })

  const splitMutation = useMutation({
    mutationFn: ({ session_id, ten_phien_moi, phieu_ids, roll_ids }: {
      session_id: number; ten_phien_moi: string; phieu_ids: number[]; roll_ids: number[]
    }) => warehouseApi.splitSession(session_id, { ten_phien_moi, phieu_ids, roll_ids }),
    onSuccess: (r) => {
      message.success(r.data.message || 'Tách phiên thành công')
      setSplitModalOpen(false)
      setSplitPhieuIds([])
      setSplitRollIds([])
      splitForm.resetFields()
      qc.invalidateQueries({ queryKey: ['production-sessions'] })
      qc.invalidateQueries({ queryKey: ['production-session-detail'] })
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      message.error(msg || 'Tách phiên thất bại')
    },
  })

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function openDetail(session: ProductionSessionSummary) {
    setSelectedId(session.id)
    setDetailOpen(true)
    // Khởi tạo wastes/materials từ detail khi load xong
  }

  // Sync wastes/materials khi detail load; auto-populate từ BOM/defaults khi rỗng
  useMemo(() => {
    if (!detail) return

    const savedWastes = detail.paper_wastes.map(w => ({ flute_type: w.flute_type, so_kg_hao_hut: w.so_kg_hao_hut }))
    if (savedWastes.length === 0 && detail.trang_thai !== 'da_chot' && suggestedFlutes?.flute_types?.length) {
      setWastes(suggestedFlutes.flute_types.map(ft => ({ flute_type: ft, so_kg_hao_hut: 0 })))
    } else {
      setWastes(savedWastes)
    }

    const savedMaterials = detail.materials.map(m => ({ other_material_id: m.other_material_id, so_luong: m.so_luong, don_gia: m.don_gia }))
    if (savedMaterials.length === 0 && detail.trang_thai !== 'da_chot' && defaultMaterials?.materials?.length) {
      setMaterials(defaultMaterials.materials.map(m => ({ other_material_id: m.id, so_luong: 0, don_gia: 0 })))
    } else {
      setMaterials(savedMaterials)
    }
  }, [detail?.id, detail?.paper_wastes?.length, detail?.materials?.length, suggestedFlutes?.flute_types?.join(','), defaultMaterials?.materials?.length])

  // ── Columns danh sách phiên ──────────────────────────────────────────────────
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
      render: (v: number) => <Text type="secondary">#{v}</Text>,
    },
    {
      title: 'Tên phiên',
      dataIndex: 'ten_phien',
      render: (v: string, r: ProductionSessionSummary) => (
        <Button type="link" onClick={() => openDetail(r)} style={{ padding: 0 }}>
          {v}
        </Button>
      ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'ngay_tao',
      width: 110,
      render: (v: string | null) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Phân xưởng',
      dataIndex: 'phan_xuong_ten',
      width: 140,
      render: (v: string | null) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 130,
      render: (v: string) => (
        <Badge status={STATUS_COLOR[v] as 'processing' | 'warning' | 'success'} text={STATUS_LABEL[v] || v} />
      ),
    },
    {
      title: 'Cuộn cân',
      dataIndex: 'so_cuon',
      width: 90,
      align: 'center' as const,
      render: (v: number) => <Tag color="blue">{v} cuộn</Tag>,
    },
    {
      title: 'Phiếu phôi',
      dataIndex: 'so_phieu',
      width: 90,
      align: 'center' as const,
      render: (v: number) => <Tag color="geekblue">{v} phiếu</Tag>,
    },
    {
      title: '',
      width: 130,
      render: (_: unknown, r: ProductionSessionSummary) => (
        <Space>
          <Tooltip title="Xem chi tiết">
            <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r)} />
          </Tooltip>
          {r.trang_thai !== 'da_chot' && (
            <Tooltip title="Gộp phiên khác vào đây">
              <Button
                size="small"
                icon={<MergeCellsOutlined />}
                onClick={() => { setMergeTargetId(r.id); setMergeSrcId(null); setMergeModalOpen(true) }}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '16px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          🏭 Phiên sản xuất giấy sóng
        </Title>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => qc.invalidateQueries({ queryKey: ['production-sessions'] })}
          >
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            Tạo phiên mới
          </Button>
        </Space>
      </div>

      {/* Bộ lọc */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space>
          <Text>Trạng thái:</Text>
          <Select
            allowClear
            placeholder="Tất cả"
            value={filterStatus}
            onChange={v => { setFilterStatus(v); setPage(1) }}
            style={{ width: 160 }}
            options={[
              { label: '🔄 Đang chạy', value: 'dang_chay' },
              { label: '⏳ Chờ phân bổ', value: 'cho_phan_bo' },
              { label: '✅ Đã chốt', value: 'da_chot' },
            ]}
          />
        </Space>
      </Card>

      {/* Bảng danh sách */}
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={sessionsData?.items || []}
        columns={columns}
        size="small"
        pagination={{
          current: page,
          total: sessionsData?.total || 0,
          pageSize: 20,
          onChange: setPage,
          showSizeChanger: false,
          showTotal: total => `Tổng ${total} phiên`,
        }}
      />

      {/* ── Modal Tạo phiên ────────────────────────────────────────────────────── */}
      <Modal
        title="Tạo phiên sản xuất mới"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={values => {
            createMutation.mutate({
              ten_phien: values.ten_phien,
              ngay_tao: values.ngay_tao ? dayjs(values.ngay_tao).format('YYYY-MM-DD') : undefined,
              phan_xuong_id: values.phan_xuong_id,
            })
          }}
        >
          <Form.Item name="ten_phien" label="Tên phiên" rules={[{ required: true }]}>
            <Input
              placeholder="VD: Ca 1 - 22/06/2026"
              id="session-name-input"
            />
          </Form.Item>
          <Form.Item name="ngay_tao" label="Ngày tạo">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="phan_xuong_id" label="Phân xưởng">
            <Select
              allowClear
              placeholder="Chọn phân xưởng (tùy chọn)"
              options={(phanXuongs as import('../../api/warehouse').PhanXuong[] | undefined)?.map((p) => ({
                label: p.ten_xuong,
                value: p.id,
              }))}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCreateOpen(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
                Tạo phiên
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Drawer Chi tiết Phiên ────────────────────────────────────────────────── */}
      <Drawer
        title={
          detail ? (
            <Space>
              <Text strong>Phiên #{detail.id}: {detail.ten_phien}</Text>
              <Badge status={STATUS_COLOR[detail.trang_thai] as 'processing' | 'warning' | 'success'} text={STATUS_LABEL[detail.trang_thai]} />
            </Space>
          ) : 'Chi tiết phiên sản xuất'
        }
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={900}
        destroyOnClose
        extra={
          detail && detail.trang_thai !== 'da_chot' && (
            <Space>
              <Button
                icon={<ScissorOutlined />}
                onClick={() => { setSplitPhieuIds([]); setSplitRollIds([]); setSplitModalOpen(true) }}
              >
                Tách phiên
              </Button>
              <Button
                icon={<BarChartOutlined />}
                onClick={() => previewMutation.mutate(detail.id)}
                loading={previewMutation.isPending}
              >
                Xem trước phân bổ
              </Button>
              <Popconfirm
                title="Chốt phiên sản xuất?"
                description="Sau khi chốt, dữ liệu sẽ bị khóa và không thể chỉnh sửa."
                onConfirm={() => closeMutation.mutate(detail.id)}
                okText="Xác nhận chốt"
                cancelText="Hủy"
                icon={<ExclamationCircleOutlined style={{ color: 'orange' }} />}
              >
                <Button
                  type="primary"
                  danger
                  icon={<CheckCircleOutlined />}
                  loading={closeMutation.isPending}
                >
                  Chốt phiên &amp; Ghi sổ
                </Button>
              </Popconfirm>
            </Space>
          )
        }
      >
        {detailLoading && <div style={{ textAlign: 'center', padding: 40 }}>Đang tải...</div>}
        {detail && (
          <Tabs defaultActiveKey="rolls">

            {/* Tab: Cuộn giấy */}
            <TabPane
              tab={<span><FileTextOutlined /> Cuộn giấy cân ({detail.rolls.length})</span>}
              key="rolls"
            >
              {detail.rolls.length === 0
                ? <Empty description="Chưa có cuộn giấy nào được cân trong phiên này" />
                : (
                  <Table
                    size="small"
                    rowKey="id"
                    dataSource={detail.rolls}
                    pagination={false}
                    columns={[
                      { title: 'Barcode', dataIndex: 'barcode', width: 130 },
                      { title: 'Loại giấy', dataIndex: 'ten_nvl' },
                      { title: 'Khổ (cm)', dataIndex: 'kho', width: 80, render: (v: number | null) => v ?? '—' },
                      { title: 'ĐL (gsm)', dataIndex: 'dinh_luong', width: 80, render: (v: number | null) => v ?? '—' },
                      {
                        title: 'TL đầu (kg)',
                        dataIndex: 'trong_luong_dau',
                        width: 110,
                        render: (v: number) => fmtKg(v),
                      },
                      {
                        title: 'TL cuối (kg)',
                        dataIndex: 'trong_luong_cuoi',
                        width: 110,
                        render: (v: number | null) => v !== null ? fmtKg(v) : '—',
                      },
                      {
                        title: 'Tiêu hao (kg)',
                        dataIndex: 'trong_luong_tieu_hao',
                        width: 120,
                        render: (v: number | null) => v !== null ? <Text type="danger">{fmtKg(v)}</Text> : '—',
                      },
                    ]}
                  />
                )
              }
            </TabPane>

            {/* Tab: Phiếu phôi sóng */}
            <TabPane
              tab={<span><LinkOutlined /> Phiếu phôi sóng ({detail.phieu_nhap_phoi_songs.length})</span>}
              key="phieu"
            >
              <div style={{ marginBottom: 12 }}>
                {detail.trang_thai !== 'da_chot' && (
                  <Button
                    icon={<LinkOutlined />}
                    onClick={() => setAssignDrawerOpen(true)}
                    type="dashed"
                  >
                    Gán thêm phiếu phôi sóng
                  </Button>
                )}
              </div>
              {detail.phieu_nhap_phoi_songs.length === 0
                ? <Empty description="Chưa có phiếu nhập phôi sóng nào được gán" />
                : detail.phieu_nhap_phoi_songs.map(p => (
                  <Card
                    key={p.id}
                    size="small"
                    style={{ marginBottom: 8 }}
                    title={
                      <Space>
                        <Text strong>{p.so_phieu}</Text>
                        {p.ca && <Tag color="purple">{p.ca}</Tag>}
                        {p.ngay && <Text type="secondary">{dayjs(p.ngay).format('DD/MM')}</Text>}
                      </Space>
                    }
                    extra={
                      detail.trang_thai !== 'da_chot' && (
                        <Popconfirm
                          title="Bỏ gán phiếu này?"
                          onConfirm={() => unassignMutation.mutate({ session_id: detail.id, phieu_ids: [p.id] })}
                          okText="Bỏ gán"
                        >
                          <Button size="small" danger icon={<DisconnectOutlined />}>Bỏ gán</Button>
                        </Popconfirm>
                      )
                    }
                  >
                    <Table
                      size="small"
                      rowKey="id"
                      dataSource={p.items}
                      pagination={false}
                      columns={[
                        { title: 'Tên hàng', dataIndex: 'ten_hang' },
                        { title: 'Lớp', dataIndex: 'so_lop', width: 60 },
                        {
                          title: 'Khổ × Cắt',
                          width: 120,
                          render: (_: unknown, r: { chieu_kho: number | null; chieu_cat: number | null }) =>
                            r.chieu_kho && r.chieu_cat ? `${r.chieu_kho} × ${r.chieu_cat}` : '—',
                        },
                        {
                          title: 'SL KH',
                          dataIndex: 'so_luong_ke_hoach',
                          width: 90,
                          render: (v: number) => v.toLocaleString(),
                        },
                        {
                          title: 'SL Thực tế',
                          dataIndex: 'so_luong_thuc_te',
                          width: 100,
                          render: (v: number | null) => v !== null
                            ? <Text type="success">{v.toLocaleString()}</Text>
                            : <Text type="secondary">—</Text>,
                        },
                      ]}
                    />
                  </Card>
                ))
              }
            </TabPane>

            {/* Tab: Hao hụt giấy */}
            <TabPane
              tab={<span>🗑️ Hao hụt giấy</span>}
              key="wastes"
            >
              <div style={{ maxWidth: 480 }}>
                <Alert
                  message="Nhập số kg phế liệu giấy thu hồi của từng loại sóng sau khi chạy xong"
                  type="info"
                  style={{ marginBottom: 16 }}
                  showIcon
                />
                {FLUTE_TYPES.map(ft => {
                  const w = wastes.find(w => w.flute_type === ft)
                  return (
                    <div key={ft} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <Tag color={ft === 'CHUNG' ? 'default' : 'blue'} style={{ width: 60, textAlign: 'center' }}>
                        {ft === 'CHUNG' ? 'Chung' : `Sóng ${ft}`}
                      </Tag>
                      <InputNumber
                        id={`waste-${ft}`}
                        value={w?.so_kg_hao_hut ?? 0}
                        min={0}
                        precision={1}
                        addonAfter="kg"
                        style={{ width: 180 }}
                        disabled={detail.trang_thai === 'da_chot'}
                        onChange={v => {
                          const val = v ?? 0
                          setWastes(prev => {
                            const existing = prev.find(x => x.flute_type === ft)
                            if (existing) {
                              return prev.map(x => x.flute_type === ft ? { ...x, so_kg_hao_hut: val } : x)
                            }
                            return [...prev, { flute_type: ft, so_kg_hao_hut: val }]
                          })
                        }}
                      />
                    </div>
                  )
                })}
                {detail.trang_thai !== 'da_chot' && (
                  <Button
                    type="primary"
                    onClick={() => wastesMutation.mutate({
                      session_id: detail.id,
                      wastes: wastes.filter(w => w.so_kg_hao_hut > 0),
                    })}
                    loading={wastesMutation.isPending}
                    style={{ marginTop: 8 }}
                  >
                    Lưu hao hụt
                  </Button>
                )}
                <Divider />
                <Text type="secondary">
                  Tổng hao hụt: <Text strong>{fmtKg(wastes.reduce((s, w) => s + w.so_kg_hao_hut, 0))}</Text>
                </Text>
              </div>
            </TabPane>

            {/* Tab: NVL phụ */}
            <TabPane
              tab={<span>🧪 NVL phụ pha keo</span>}
              key="materials"
            >
              <Alert
                message="Nhập số lượng nguyên vật liệu phụ đã sử dụng để pha keo trong phiên này"
                type="info"
                style={{ marginBottom: 16 }}
                showIcon
              />
              <Table
                size="small"
                rowKey="other_material_id"
                dataSource={materials}
                pagination={false}
                footer={() =>
                  detail.trang_thai !== 'da_chot' && (
                    <Button
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        const firstAvail = (otherMaterials as import('../../api/otherMaterials').OtherMaterial[] | undefined)?.find(
                          m => !materials.find(x => x.other_material_id === m.id)
                        )
                        if (firstAvail) {
                          setMaterials(prev => [...prev, { other_material_id: firstAvail.id, so_luong: 0, don_gia: 0 }])
                        }
                      }}
                    >
                      Thêm NVL
                    </Button>
                  )
                }
                columns={[
                  {
                    title: 'Nguyên vật liệu',
                    dataIndex: 'other_material_id',
                    render: (v: number, _: unknown, idx: number) => (
                      <Select
                        value={v}
                        style={{ width: 220 }}
                        disabled={detail.trang_thai === 'da_chot'}
                        onChange={newId => setMaterials(prev =>
                          prev.map((m, i) => i === idx ? { ...m, other_material_id: newId } : m)
                        )}
                        options={(otherMaterials as import('../../api/otherMaterials').OtherMaterial[] | undefined)?.map(m => ({
                          label: m.ten,
                          value: m.id,
                        }))}
                        showSearch
                        filterOption={(input, option) =>
                          (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                        }
                      />
                    ),
                  },
                  {
                    title: 'Số lượng (kg)',
                    dataIndex: 'so_luong',
                    render: (v: number, _: unknown, idx: number) => (
                      <InputNumber
                        value={v}
                        min={0}
                        precision={1}
                        style={{ width: 130 }}
                        disabled={detail.trang_thai === 'da_chot'}
                        onChange={val => setMaterials(prev =>
                          prev.map((m, i) => i === idx ? { ...m, so_luong: val ?? 0 } : m)
                        )}
                      />
                    ),
                  },
                  {
                    title: 'Đơn giá',
                    dataIndex: 'don_gia',
                    render: (v: number, _: unknown, idx: number) => (
                      <InputNumber
                        value={v}
                        min={0}
                        style={{ width: 130 }}
                        disabled={detail.trang_thai === 'da_chot'}
                        formatter={val => val ? Number(val).toLocaleString('vi-VN') : '0'}
                        onChange={val => setMaterials(prev =>
                          prev.map((m, i) => i === idx ? { ...m, don_gia: val ?? 0 } : m)
                        )}
                      />
                    ),
                  },
                  {
                    title: 'Thành tiền',
                    render: (_: unknown, r: { so_luong: number; don_gia: number }) => (
                      <Text>{fmt(r.so_luong * r.don_gia)} ₫</Text>
                    ),
                  },
                  !detail || detail.trang_thai === 'da_chot' ? {} : {
                    title: '',
                    width: 50,
                    render: (_: unknown, __: unknown, idx: number) => (
                      <Button
                        size="small"
                        danger
                        icon={<CloseCircleOutlined />}
                        onClick={() => setMaterials(prev => prev.filter((_, i) => i !== idx))}
                      />
                    ),
                  },
                ].filter(c => Object.keys(c).length > 0)}
              />
              {detail.trang_thai !== 'da_chot' && (
                <Button
                  type="primary"
                  style={{ marginTop: 12 }}
                  onClick={() => materialsMutation.mutate({
                    session_id: detail.id,
                    materials: materials.filter(m => m.so_luong > 0),
                  })}
                  loading={materialsMutation.isPending}
                >
                  Lưu NVL phụ
                </Button>
              )}
              <Divider />
              <Text type="secondary">
                Tổng chi phí NVL phụ:{' '}
                <Text strong type="danger">
                  {fmt(materials.reduce((s, m) => s + m.so_luong * m.don_gia, 0))} ₫
                </Text>
              </Text>
            </TabPane>

            {/* Tab: Kết quả phân bổ (chỉ hiện khi đã chốt) */}
            {detail.trang_thai === 'da_chot' && (
              <TabPane
                tab={<span><BarChartOutlined /> Kết quả phân bổ</span>}
                key="allocation"
              >
                {!detail.allocation_detail || detail.allocation_detail.length === 0
                  ? <Empty description="Không có dữ liệu phân bổ" />
                  : (
                    <>
                      <Row gutter={16} style={{ marginBottom: 16 }}>
                        <Col span={8}>
                          <Statistic
                            title="Tổng chi phí giấy"
                            value={detail.allocation_detail.reduce((s, r) => s + r.chi_phi_giay, 0)}
                            formatter={v => fmt(Number(v))}
                            suffix="₫"
                          />
                        </Col>
                        <Col span={8}>
                          <Statistic
                            title="Chi phí NVL phụ"
                            value={detail.allocation_detail.reduce((s, r) => s + r.chi_phi_nvl_phu, 0)}
                            formatter={v => fmt(Number(v))}
                            suffix="₫"
                          />
                        </Col>
                        <Col span={8}>
                          <Statistic
                            title="Tổng chi phí phiên"
                            value={detail.allocation_detail.reduce((s, r) => s + r.chi_phi_tong, 0)}
                            formatter={v => fmt(Number(v))}
                            suffix="₫"
                            valueStyle={{ color: '#cf1322' }}
                          />
                        </Col>
                      </Row>
                      <Table
                        size="small"
                        rowKey="production_order_item_id"
                        dataSource={detail.allocation_detail}
                        pagination={false}
                        columns={[
                          { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
                          { title: 'Lớp', dataIndex: 'so_lop', width: 55 },
                          {
                            title: 'SL (cái)',
                            dataIndex: 'so_luong',
                            width: 90,
                            render: (v: number) => v.toLocaleString(),
                          },
                          {
                            title: 'Diện tích (m²)',
                            dataIndex: 'dien_tich_m2',
                            width: 115,
                            render: (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 2 }),
                          },
                          {
                            title: 'DT quy đổi (m²)',
                            dataIndex: 'dien_tich_quy_doi',
                            width: 120,
                            render: (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 2 }),
                          },
                          {
                            title: 'CP giấy',
                            dataIndex: 'chi_phi_giay',
                            width: 120,
                            render: (v: number) => `${fmt(v)} ₫`,
                          },
                          {
                            title: 'CP NVL phụ',
                            dataIndex: 'chi_phi_nvl_phu',
                            width: 110,
                            render: (v: number) => `${fmt(v)} ₫`,
                          },
                          {
                            title: 'Tổng chi phí',
                            dataIndex: 'chi_phi_tong',
                            width: 130,
                            render: (v: number) => <Text strong type="danger">{fmt(v)} ₫</Text>,
                          },
                        ]}
                        summary={rows => {
                          const data = [...rows]
                          const totGiay = data.reduce((s, r) => s + (r.chi_phi_giay || 0), 0)
                          const totNvl = data.reduce((s, r) => s + (r.chi_phi_nvl_phu || 0), 0)
                          const totAll = data.reduce((s, r) => s + (r.chi_phi_tong || 0), 0)
                          return (
                            <Table.Summary.Row>
                              <Table.Summary.Cell index={0} colSpan={5}>
                                <Text strong>Tổng cộng</Text>
                              </Table.Summary.Cell>
                              <Table.Summary.Cell index={5}>
                                <Text strong>{fmt(totGiay)} ₫</Text>
                              </Table.Summary.Cell>
                              <Table.Summary.Cell index={6}>
                                <Text strong>{fmt(totNvl)} ₫</Text>
                              </Table.Summary.Cell>
                              <Table.Summary.Cell index={7}>
                                <Text strong type="danger">{fmt(totAll)} ₫</Text>
                              </Table.Summary.Cell>
                            </Table.Summary.Row>
                          )
                        }}
                      />
                    </>
                  )
                }
              </TabPane>
            )}

          </Tabs>
        )}
      </Drawer>

      {/* ── Drawer Gán phiếu nhập phôi sóng ─────────────────────────────────────── */}
      <Drawer
        title="Gán thêm phiếu nhập phôi sóng vào phiên"
        open={assignDrawerOpen}
        onClose={() => { setAssignDrawerOpen(false); setSelectedPhieuIds([]) }}
        width={720}
        extra={
          <Button
            type="primary"
            icon={<LinkOutlined />}
            disabled={selectedPhieuIds.length === 0}
            loading={assignMutation.isPending}
            onClick={() => {
              if (selectedId) {
                assignMutation.mutate({ session_id: selectedId, phieu_ids: selectedPhieuIds })
              }
            }}
          >
            Gán {selectedPhieuIds.length > 0 ? `(${selectedPhieuIds.length})` : ''} phiếu được chọn
          </Button>
        }
      >
        <Alert
          message="Chỉ hiển thị các phiếu nhập phôi sóng chưa bị chốt bởi phiên khác. Có thể gán phiếu từ bất kỳ ngày nào."
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
        />
        <Table
          size="small"
          rowKey="id"
          dataSource={(allPhieuSong as import('../../api/productionOrders').PhieuNhapPhoiSongListItem[] | undefined)?.filter(p => !p.session_id || p.session_id === selectedId) || []}
          rowSelection={{
            type: 'checkbox',
            selectedRowKeys: selectedPhieuIds,
            onChange: keys => setSelectedPhieuIds(keys as number[]),
          }}
          columns={[
            { title: 'Số phiếu', dataIndex: 'so_phieu' },
            {
              title: 'Ngày',
              dataIndex: 'ngay',
              render: (v: string | null) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
            },
            { title: 'Ca', dataIndex: 'ca', render: (v: string | null) => v ? <Tag color="purple">{v}</Tag> : '—' },
            {
              title: 'Phiên hiện tại',
              dataIndex: 'session_id',
              render: (v: number | null) => v === selectedId
                ? <Tag color="green">Phiên này</Tag>
                : v ? <Tag color="orange">Phiên #{v}</Tag> : <Tag color="default">Chưa gán</Tag>,
            },
          ]}
        />
      </Drawer>

      {/* ── Modal Gộp phiên (D5) ─────────────────────────────────────────────────── */}
      <Modal
        title={<><MergeCellsOutlined /> Gộp phiên vào #{mergeTargetId}</>}
        open={mergeModalOpen}
        onCancel={() => { setMergeModalOpen(false); setMergeSrcId(null) }}
        onOk={() => {
          if (!mergeTargetId || !mergeSrcId) {
            message.warning('Vui lòng chọn phiên nguồn')
            return
          }
          mergeMutation.mutate({ target_id: mergeTargetId, src_id: mergeSrcId })
        }}
        okText="Xác nhận gộp"
        cancelText="Hủy"
        confirmLoading={mergeMutation.isPending}
        okButtonProps={{ danger: true }}
        destroyOnHidden
      >
        <Alert
          type="warning"
          message="Toàn bộ cuộn giấy và phiếu phôi từ phiên nguồn sẽ chuyển sang phiên đích. Hao hụt cùng loại sóng sẽ được cộng gộp. Phiên nguồn sẽ bị xóa."
          showIcon
          style={{ marginBottom: 16 }}
        />
        <div style={{ marginBottom: 8 }}>
          <Text strong>Phiên đích: </Text>
          <Tag color="blue">#{mergeTargetId} — {sessionsData?.items?.find(s => s.id === mergeTargetId)?.ten_phien}</Tag>
        </div>
        <div>
          <Text strong>Chọn phiên nguồn (sẽ bị xóa):</Text>
          <Select
            style={{ width: '100%', marginTop: 8 }}
            placeholder="Chọn phiên cần gộp vào đây..."
            value={mergeSrcId}
            onChange={setMergeSrcId}
            options={
              (sessionsData?.items || [])
                .filter(s => s.id !== mergeTargetId && s.trang_thai !== 'da_chot')
                .map(s => ({ label: `#${s.id} — ${s.ten_phien} (${STATUS_LABEL[s.trang_thai]})`, value: s.id }))
            }
          />
        </div>
      </Modal>

      {/* ── Modal Tách phiên (D6) ─────────────────────────────────────────────────── */}
      <Modal
        title={<><ScissorOutlined /> Tách phiên #{selectedId}</>}
        open={splitModalOpen}
        onCancel={() => { setSplitModalOpen(false); setSplitPhieuIds([]); setSplitRollIds([]); splitForm.resetFields() }}
        onOk={() => splitForm.submit()}
        okText="Tách phiên"
        cancelText="Hủy"
        confirmLoading={splitMutation.isPending}
        width={700}
        destroyOnHidden
      >
        <Alert
          type="info"
          message="Các phiếu và cuộn được chọn sẽ chuyển sang phiên mới. Phiên mới có hao hụt và NVL phụ rỗng — cần nhập lại."
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form
          form={splitForm}
          layout="vertical"
          onFinish={values => {
            if (!selectedId) return
            splitMutation.mutate({
              session_id: selectedId,
              ten_phien_moi: values.ten_phien_moi,
              phieu_ids: splitPhieuIds,
              roll_ids: splitRollIds,
            })
          }}
        >
          <Form.Item name="ten_phien_moi" label="Tên phiên mới" rules={[{ required: true }]}>
            <Input placeholder="VD: Ca 2 - 23/06/2026" />
          </Form.Item>
        </Form>
        {detail && (
          <>
            <Divider>Chọn phiếu phôi sóng cần tách</Divider>
            <Table
              size="small"
              rowKey="id"
              dataSource={detail.phieu_nhap_phoi_songs}
              pagination={false}
              rowSelection={{
                type: 'checkbox',
                selectedRowKeys: splitPhieuIds,
                onChange: keys => setSplitPhieuIds(keys as number[]),
              }}
              columns={[
                { title: 'Số phiếu', dataIndex: 'so_phieu' },
                { title: 'Ngày', dataIndex: 'ngay', render: (v: string | null) => v ? dayjs(v).format('DD/MM') : '—' },
                { title: 'Ca', dataIndex: 'ca', render: (v: string | null) => v ? <Tag color="purple">{v}</Tag> : '—' },
              ]}
            />
            {detail.rolls.length > 0 && (
              <>
                <Divider>Chọn cuộn giấy cần tách</Divider>
                <Table
                  size="small"
                  rowKey="id"
                  dataSource={detail.rolls}
                  pagination={false}
                  rowSelection={{
                    type: 'checkbox',
                    selectedRowKeys: splitRollIds,
                    onChange: keys => setSplitRollIds(keys as number[]),
                  }}
                  columns={[
                    { title: 'Barcode', dataIndex: 'barcode' },
                    { title: 'Loại giấy', dataIndex: 'ten_nvl' },
                    { title: 'TL tiêu hao', dataIndex: 'trong_luong_tieu_hao', render: (v: number | null) => v !== null ? fmtKg(v) : '—' },
                  ]}
                />
              </>
            )}
          </>
        )}
      </Modal>

      {/* ── Modal Xem trước phân bổ ───────────────────────────────────────────────── */}
      <Modal
        title={<><BarChartOutlined /> Bảng phân bổ chi phí dự kiến</>}
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={null}
        width={900}
      >
        {previewData && (
          <>
            {previewData.errors.length > 0 && (
              <Alert
                type="warning"
                message={previewData.errors.join('; ')}
                style={{ marginBottom: 12 }}
                showIcon
              />
            )}
            {/* Tổng quan */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Statistic
                  title="Tổng tiêu hao giấy"
                  value={previewData.total_tieu_hao_giay_kg}
                  precision={2}
                  suffix="kg"
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Tổng hao hụt"
                  value={previewData.total_hao_hut_kg}
                  precision={2}
                  suffix="kg"
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Chi phí giấy"
                  value={previewData.total_chi_phi_giay}
                  formatter={v => fmt(Number(v))}
                  suffix="₫"
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Chi phí NVL phụ"
                  value={previewData.total_chi_phi_nvl_phu}
                  formatter={v => fmt(Number(v))}
                  suffix="₫"
                />
              </Col>
            </Row>

            <Divider>Phân bổ về từng LSX</Divider>
            <Table
              size="small"
              rowKey="production_order_item_id"
              dataSource={previewData.allocation_by_lsx}
              pagination={false}
              columns={[
                { title: 'Tên hàng', dataIndex: 'ten_hang' },
                { title: 'Lớp', dataIndex: 'so_lop', width: 55 },
                {
                  title: 'SL (cái)',
                  dataIndex: 'so_luong',
                  width: 90,
                  render: (v: number) => v.toLocaleString(),
                },
                {
                  title: 'Diện tích (m²)',
                  dataIndex: 'dien_tich_m2',
                  width: 110,
                  render: (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 2 }),
                },
                {
                  title: 'DT quy đổi (m²)',
                  dataIndex: 'dien_tich_quy_doi',
                  width: 120,
                  render: (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 2 }),
                },
                {
                  title: 'Chi phí giấy',
                  dataIndex: 'chi_phi_giay',
                  width: 130,
                  render: (v: number) => <Text>{fmt(v)} ₫</Text>,
                },
                {
                  title: 'CP NVL phụ',
                  dataIndex: 'chi_phi_nvl_phu',
                  width: 110,
                  render: (v: number) => <Text>{fmt(v)} ₫</Text>,
                },
                {
                  title: 'Tổng chi phí',
                  dataIndex: 'chi_phi_tong',
                  width: 130,
                  render: (v: number) => <Text strong type="danger">{fmt(v)} ₫</Text>,
                },
              ]}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={5}><Text strong>Tổng cộng</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={5}>
                    <Text strong>{fmt(previewData.total_chi_phi_giay)} ₫</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={6}>
                    <Text strong>{fmt(previewData.total_chi_phi_nvl_phu)} ₫</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={7}>
                    <Text strong type="danger">{fmt(previewData.total_chi_phi_phien)} ₫</Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />
          </>
        )}
      </Modal>
    </div>
  )
}
