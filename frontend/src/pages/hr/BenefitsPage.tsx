import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Avatar, Button, Card, Col, DatePicker, Divider, Form, Input, InputNumber, Modal, Popconfirm,
  Row, Segmented, Select, Space, Statistic, Switch, Table, Tabs, Tag, Typography, message,
} from 'antd'
import {
  GiftOutlined, PlusOutlined, EditOutlined, DeleteOutlined, CalendarOutlined,
  CheckCircleOutlined, DollarOutlined, CloseCircleOutlined, ScanOutlined, TrophyOutlined,
  FileExcelOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'
import { hrApi } from '../../api/hr'
import { getVnHolidaysForMonth } from '../../utils/vnHolidays'

const { Title, Text } = Typography
const { TextArea } = Input

const LOAI_LABEL: Record<string, { text: string; icon: string }> = {
  sinh_nhat: { text: 'Sinh nhật', icon: '🎂' },
  hieu: { text: 'Hiếu', icon: '🕯️' },
  hi: { text: 'Hỉ (cưới)', icon: '💒' },
  sinh_con: { text: 'Sinh con', icon: '👶' },
  tet_am: { text: 'Tết Âm Lịch', icon: '🧧' },
  le_30_4: { text: 'Lễ 30/4', icon: '🎉' },
  le_2_9: { text: 'Quốc Khánh 2/9', icon: '🇻🇳' },
  le_8_3: { text: 'Quốc tế Phụ nữ 8/3', icon: '🌹' },
  le_20_10: { text: 'Phụ nữ VN 20/10', icon: '🌸' },
  trung_thu: { text: 'Trung thu', icon: '🥮' },
  khac: { text: 'Khác', icon: '🎁' },
}

const AP_DUNG_LABEL: Record<string, string> = {
  all: 'Tất cả',
  female: 'Chỉ nữ',
  male: 'Chỉ nam',
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  de_xuat: { text: 'Đề xuất', color: 'orange' },
  da_duyet: { text: 'Đã duyệt', color: 'blue' },
  da_chi: { text: 'Đã chi', color: 'green' },
  huy: { text: 'Đã hủy', color: 'default' },
}

function exportBenefitsToExcel(records: any[], filterStatus: string, filterLoai: string) {
  const today = dayjs().format('YYYY-MM-DD')
  const rows = records.map((r, idx) => ({
    'STT': idx + 1,
    'Mã NV': r.employee?.ma_nv ?? '',
    'Họ tên': r.employee?.ho_ten ?? '',
    'Loại phúc lợi': LOAI_LABEL[r.loai]?.text ?? r.loai,
    'Ngày sự kiện': r.ngay_su_kien ? dayjs(r.ngay_su_kien).format('DD/MM/YYYY') : '',
    'Mức tiền (VNĐ)': Number(r.muc_tien ?? 0),
    'Kỳ lương áp dụng': `${r.thang_ap_dung}/${r.nam_ap_dung}`,
    'Trạng thái': STATUS_LABEL[r.trang_thai]?.text ?? r.trang_thai,
    'Ghi chú': r.ghi_chu ?? '',
    'Người đề xuất ID': r.nguoi_de_xuat_id ?? '',
    'Người duyệt ID': r.nguoi_duyet_id ?? '',
    'Ngày duyệt': r.ngay_duyet ? dayjs(r.ngay_duyet).format('DD/MM/YYYY HH:mm') : '',
    'Ngày tạo': r.created_at ? dayjs(r.created_at).format('DD/MM/YYYY HH:mm') : '',
  }))
  const totalAmount = rows.reduce((s, r) => s + Number(r['Mức tiền (VNĐ)'] || 0), 0)
  rows.push({
    'STT': '' as any, 'Mã NV': '', 'Họ tên': 'TỔNG CỘNG',
    'Loại phúc lợi': '', 'Ngày sự kiện': '',
    'Mức tiền (VNĐ)': totalAmount,
    'Kỳ lương áp dụng': '', 'Trạng thái': '', 'Ghi chú': `${rows.length} bản ghi`,
    'Người đề xuất ID': '', 'Người duyệt ID': '', 'Ngày duyệt': '', 'Ngày tạo': '',
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  // Column widths
  ws['!cols'] = [
    { wch: 5 }, { wch: 12 }, { wch: 25 }, { wch: 22 }, { wch: 13 },
    { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 30 },
    { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 18 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Phuc loi')
  const fileSuffix = [
    filterStatus !== 'all' ? `status-${filterStatus}` : null,
    filterLoai !== 'all' ? `loai-${filterLoai}` : null,
  ].filter(Boolean).join('_')
  XLSX.writeFile(wb, `Bao_cao_phuc_loi_${today}${fileSuffix ? '_' + fileSuffix : ''}.xlsx`)
}

export default function BenefitsPage() {
  const [activeTab, setActiveTab] = useState('dashboard')

  return (
    <div style={{ padding: '16px 24px' }}>
      <Title level={4} style={{ margin: 0, marginBottom: 4 }}>
        <GiftOutlined style={{ color: '#fa8c16' }} /> Phúc lợi nhân viên
      </Title>
      <Text type="secondary">
        Cấu hình chính sách + theo dõi cấp phát phúc lợi (sinh nhật, hiếu hỉ, lễ Tết...)
      </Text>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ marginTop: 16 }}
        items={[
          { key: 'dashboard', label: <span>📊 Tổng quan</span>, children: <DashboardTab /> },
          { key: 'records', label: <span><DollarOutlined /> Cấp phát phúc lợi</span>, children: <RecordsTab /> },
          { key: 'policies', label: <span><GiftOutlined /> Chính sách</span>, children: <PoliciesTab /> },
          { key: 'events', label: <span><TrophyOutlined /> Sự kiện gia đình sắp tới</span>, children: <FamilyEventsTab /> },
        ]}
      />
    </div>
  )
}

// ─── TAB 1: RECORDS ───────────────────────────────────────────────────────────

function RecordsTab() {
  const qc = useQueryClient()
  const [filterStatus, setFilterStatus] = useState<string>('de_xuat')
  const [filterLoai, setFilterLoai] = useState<string>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)

  const { data: records = [], isLoading, refetch } = useQuery({
    queryKey: ['hr-benefit-records', filterStatus, filterLoai],
    queryFn: () => hrApi.listBenefitRecords({
      ...(filterStatus !== 'all' && { status: filterStatus }),
    }).then(r => r.data.filter((x: any) => filterLoai === 'all' || x.loai === filterLoai)),
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['hr-employees-simple'],
    queryFn: () => hrApi.listEmployees().then(r => r.data),
  })

  const approveMut = useMutation({
    mutationFn: (id: number) => hrApi.approveBenefitRecord(id),
    onSuccess: () => { message.success('Đã duyệt'); refetch() },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi duyệt'),
  })

  const paidMut = useMutation({
    mutationFn: (id: number) => hrApi.markBenefitPaid(id),
    onSuccess: () => { message.success('Đã đánh dấu đã chi'); refetch() },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })

  const cancelMut = useMutation({
    mutationFn: ({ id, ly_do }: { id: number; ly_do: string }) =>
      hrApi.cancelBenefitRecord(id, ly_do),
    onSuccess: () => { message.success('Đã hủy'); refetch() },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })

  const askCancel = (id: number) => {
    let lyDo = ''
    Modal.confirm({
      title: 'Hủy bản ghi phúc lợi này?',
      content: (
        <div>
          <p style={{ marginBottom: 8 }}>Vui lòng nhập lý do hủy (để lưu vết audit):</p>
          <Input.TextArea rows={3} placeholder="VD: Nhập sai mức tiền, NV đã nghỉ việc..."
            onChange={(e) => { lyDo = e.target.value }} />
        </div>
      ),
      okText: 'Xác nhận hủy',
      okButtonProps: { danger: true },
      cancelText: 'Đóng',
      onOk: () => {
        if (!lyDo.trim()) {
          message.warning('Lý do hủy là bắt buộc')
          return Promise.reject()
        }
        return cancelMut.mutateAsync({ id, ly_do: lyDo.trim() })
      },
    })
  }

  const scanBirthdayMut = useMutation({
    mutationFn: () => hrApi.scanBirthday(),
    onSuccess: (r) => {
      message.success(`Đã quét: tìm thấy ${r.data.found}, tạo mới ${r.data.created}`)
      refetch()
      qc.invalidateQueries({ queryKey: ['hr-benefit-records'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi quét'),
  })

  const columns = [
    {
      title: 'Loại', dataIndex: 'loai', width: 180,
      render: (v: string) => {
        const cfg = LOAI_LABEL[v] || { text: v, icon: '🎁' }
        return <Tag>{cfg.icon} {cfg.text}</Tag>
      },
    },
    {
      title: 'Nhân viên', dataIndex: 'employee', width: 200,
      render: (v: any) => v ? (
        <div>
          <Text strong>{v.ho_ten}</Text>
          <br /><Text type="secondary" style={{ fontSize: 11 }}>{v.ma_nv}</Text>
        </div>
      ) : '—',
    },
    {
      title: 'Ngày sự kiện', dataIndex: 'ngay_su_kien', width: 130,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Mức tiền', dataIndex: 'muc_tien', align: 'right' as const, width: 140,
      render: (v: number) => <Text strong style={{ color: '#1677ff' }}>{Number(v).toLocaleString('vi-VN')}đ</Text>,
    },
    {
      title: 'Kỳ lương', width: 110,
      render: (_: any, r: any) => <Text>{r.thang_ap_dung}/{r.nam_ap_dung}</Text>,
    },
    { title: 'Ghi chú', dataIndex: 'ghi_chu', ellipsis: true },
    {
      title: 'Trạng thái', dataIndex: 'trang_thai', width: 110,
      render: (v: string) => {
        const cfg = STATUS_LABEL[v] || { text: v, color: 'default' }
        return <Tag color={cfg.color}>{cfg.text}</Tag>
      },
    },
    {
      title: 'Thao tác', width: 200, fixed: 'right' as const,
      render: (_: any, r: any) => (
        <Space size={4}>
          {r.trang_thai === 'de_xuat' && (
            <>
              <Button type="link" size="small" icon={<CheckCircleOutlined />}
                onClick={() => approveMut.mutate(r.id)}>Duyệt</Button>
              <Button type="link" size="small" danger icon={<CloseCircleOutlined />} onClick={() => askCancel(r.id)}>
                Hủy
              </Button>
            </>
          )}
          {r.trang_thai === 'da_duyet' && (
            <Button type="link" size="small" icon={<DollarOutlined />}
              onClick={() => paidMut.mutate(r.id)}>Đã chi</Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Text>Trạng thái:</Text>
          <Select size="small" value={filterStatus} onChange={setFilterStatus} style={{ width: 150 }}
            options={[
              { value: 'all', label: 'Tất cả' },
              ...Object.entries(STATUS_LABEL).map(([k, v]) => ({ value: k, label: v.text })),
            ]}
          />
          <Text>Loại:</Text>
          <Select size="small" value={filterLoai} onChange={setFilterLoai} style={{ width: 200 }}
            options={[
              { value: 'all', label: 'Tất cả' },
              ...Object.entries(LOAI_LABEL).map(([k, v]) => ({ value: k, label: `${v.icon} ${v.text}` })),
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            Thêm cấp phát
          </Button>
          <Button icon={<CalendarOutlined />} onClick={() => setBulkOpen(true)}>
            Bulk cấp lễ Tết
          </Button>
          <Button icon={<ScanOutlined />} onClick={() => scanBirthdayMut.mutate()} loading={scanBirthdayMut.isPending}>
            Quét sinh nhật hôm nay
          </Button>
          <Button
            icon={<FileExcelOutlined />}
            disabled={records.length === 0}
            onClick={() => exportBenefitsToExcel(records, filterStatus, filterLoai)}
          >
            Xuất Excel ({records.length})
          </Button>
        </Space>
      </Card>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={records} columns={columns} rowKey="id"
          loading={isLoading} size="small"
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <CreateRecordModal
        open={createOpen} onClose={() => setCreateOpen(false)}
        employees={employees} onCreated={refetch}
      />
      <BulkHolidayModal
        open={bulkOpen} onClose={() => setBulkOpen(false)}
        onCreated={refetch}
      />
    </>
  )
}

// ─── TAB 2: POLICIES ──────────────────────────────────────────────────────────

function PoliciesTab() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<any | null>(null)
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ['hr-benefit-policies'],
    queryFn: () => hrApi.listBenefitPolicies().then(r => r.data),
  })

  const saveMut = useMutation({
    mutationFn: (data: any) => editing
      ? hrApi.updateBenefitPolicy(editing.id, data)
      : hrApi.createBenefitPolicy(data),
    onSuccess: () => {
      message.success(editing ? 'Đã cập nhật' : 'Đã thêm chính sách')
      qc.invalidateQueries({ queryKey: ['hr-benefit-policies'] })
      setOpen(false); setEditing(null); form.resetFields()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi lưu'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => hrApi.deleteBenefitPolicy(id),
    onSuccess: () => {
      message.success('Đã chuyển sang ngừng sử dụng')
      qc.invalidateQueries({ queryKey: ['hr-benefit-policies'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })

  const openEdit = (r: any) => {
    setEditing(r)
    form.setFieldsValue(r)
    setOpen(true)
  }
  const openCreate = () => { setEditing(null); form.resetFields(); setOpen(true) }

  const columns = [
    {
      title: 'Loại', dataIndex: 'loai', width: 200,
      render: (v: string) => {
        const cfg = LOAI_LABEL[v] || { text: v, icon: '🎁' }
        return <Tag>{cfg.icon} {cfg.text}</Tag>
      },
    },
    { title: 'Tên chính sách', dataIndex: 'ten', render: (v: string) => <Text strong>{v}</Text> },
    {
      title: 'Mức tiền', dataIndex: 'muc_tien', align: 'right' as const, width: 140,
      render: (v: number) => <Text strong style={{ color: '#1677ff' }}>{Number(v).toLocaleString('vi-VN')}đ</Text>,
    },
    {
      title: 'Đối tượng', dataIndex: 'ap_dung_cho', width: 110,
      render: (v: string) => AP_DUNG_LABEL[v] || v,
    },
    { title: 'Mô tả', dataIndex: 'mo_ta', ellipsis: true },
    {
      title: 'Trạng thái', dataIndex: 'is_active', width: 110,
      render: (v: boolean) => v
        ? <Tag color="green">Đang dùng</Tag>
        : <Tag color="default">Ngừng</Tag>,
    },
    {
      title: 'Thao tác', width: 110, fixed: 'right' as const,
      render: (_: any, r: any) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Chuyển sang ngừng sử dụng?" onConfirm={() => deleteMut.mutate(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space>
          <Text type="secondary">Định nghĩa các chính sách phúc lợi của công ty</Text>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Thêm chính sách</Button>
        </Space>
      </Card>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={policies} columns={columns} rowKey="id"
          loading={isLoading} size="small"
          pagination={false}
          scroll={{ x: 1000 }}
        />
      </Card>

      <Modal
        open={open} title={editing ? 'Sửa chính sách' : 'Thêm chính sách phúc lợi'}
        onCancel={() => setOpen(false)} onOk={() => form.submit()}
        confirmLoading={saveMut.isPending}
        destroyOnClose width={520}
      >
        <Form form={form} layout="vertical" onFinish={v => saveMut.mutate(v)} requiredMark={false}>
          <Form.Item name="loai" label="Loại phúc lợi" rules={[{ required: true }]}>
            <Select disabled={!!editing} options={Object.entries(LOAI_LABEL).map(([k, v]) => ({
              value: k, label: `${v.icon} ${v.text}`,
            }))} />
          </Form.Item>
          <Form.Item name="ten" label="Tên chính sách" rules={[{ required: true }]}>
            <Input placeholder="VD: Sinh nhật nhân viên" />
          </Form.Item>
          <Form.Item name="muc_tien" label="Mức tiền (VNĐ)" rules={[{ required: true }]}>
            <InputNumber
              style={{ width: '100%' }} min={0} step={100000}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>
          <Form.Item name="ap_dung_cho" label="Đối tượng" initialValue="all" rules={[{ required: true }]}>
            <Select options={[
              { value: 'all', label: 'Tất cả NV' },
              { value: 'female', label: 'Chỉ nữ' },
              { value: 'male', label: 'Chỉ nam' },
            ]} />
          </Form.Item>
          <Form.Item name="mo_ta" label="Mô tả">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="is_active" label="Trạng thái" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="Đang dùng" unCheckedChildren="Ngừng" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

// ─── TAB 3: FAMILY EVENTS ─────────────────────────────────────────────────────

const EVENT_TYPE: Record<string, { color: string; label: string; icon: string }> = {
  sinh_nhat_nv: { color: '#fa8c16', label: 'Sinh nhật NV', icon: '🎂' },
  co_con_nho: { color: '#1677ff', label: 'Có con nhỏ', icon: '👶' },
  tham_nien: { color: '#722ed1', label: 'Thâm niên', icon: '🏆' },
  hd_het_han: { color: '#cf1322', label: 'HĐLĐ hết hạn', icon: '📅' },
}

// Preset nhóm tuổi con — dùng cho dropdown filter tuổi
const AGE_PRESETS = [
  { key: 'all',      icon: '👶', label: 'Tất cả 0–16 tuổi',         min: 0,  max: 16 },
  { key: 'baby',     icon: '🍼', label: 'Trẻ nhỏ (0–6 tuổi)',       min: 0,  max: 6  },
  { key: 'kid',      icon: '🎈', label: 'Quà 1/6 (5–10 tuổi)',      min: 5,  max: 10 },
  { key: 'trungthu', icon: '🥮', label: 'Trung thu (0–14 tuổi)',    min: 0,  max: 14 },
  { key: 'student',  icon: '🎒', label: 'Học sinh (11–18 tuổi)',    min: 11, max: 18 },
  { key: 'custom',   icon: '⚙️', label: 'Tùy chỉnh khoảng tuổi…',   min: null, max: null },
] as const

function FamilyEventsTab() {
  const [filterLoai, setFilterLoai] = useState<string>('all')
  const [days, setDays] = useState<number>(60)
  const [conTuoiMin, setConTuoiMin] = useState<number>(0)
  const [conTuoiMax, setConTuoiMax] = useState<number>(16)
  const [conTuoiPreset, setConTuoiPreset] = useState<string>('all')

  const { data: summary } = useQuery({
    queryKey: ['hr-family-events-summary', days, conTuoiMin, conTuoiMax],
    queryFn: () => hrApi.familyEventsSummary({
      days, con_tuoi_min: conTuoiMin, con_tuoi_max: conTuoiMax,
    }).then(r => r.data),
  })

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['hr-family-events', days, filterLoai, conTuoiMin, conTuoiMax],
    queryFn: () => hrApi.familyEvents({
      days,
      loai: filterLoai === 'all' ? undefined : filterLoai,
      con_tuoi_min: conTuoiMin,
      con_tuoi_max: conTuoiMax,
    }).then(r => r.data),
  })

  const applyPreset = (min: number, max: number) => {
    setConTuoiMin(min)
    setConTuoiMax(max)
    setFilterLoai('co_con_nho')
  }

  // Chỉ show filter tuổi khi đang xem Con NV hoặc Tất cả
  const showAgeFilter = filterLoai === 'co_con_nho' || filterLoai === 'all'

  // Group events theo bucket thời gian (hiển thị section dividers trong bảng)
  const groupedEvents = (() => {
    const buckets: { key: string; label: string; color: string; rows: any[] }[] = [
      { key: 'today', label: '🔥 Hôm nay', color: '#cf1322', rows: [] },
      { key: 'week', label: '⏰ Trong tuần (1-7 ngày)', color: '#fa541c', rows: [] },
      { key: 'month', label: '📅 Trong tháng (8-30 ngày)', color: '#1677ff', rows: [] },
      { key: 'later', label: '🗓️ Sau này (> 30 ngày)', color: '#8c8c8c', rows: [] },
      { key: 'no_date', label: '👤 Tham khảo (không có ngày)', color: '#722ed1', rows: [] },
    ]
    for (const e of (events as any[])) {
      const d = e.con_lai_ngay
      if (d == null) buckets[4].rows.push(e)
      else if (d === 0) buckets[0].rows.push(e)
      else if (d <= 7) buckets[1].rows.push(e)
      else if (d <= 30) buckets[2].rows.push(e)
      else buckets[3].rows.push(e)
    }
    return buckets.filter(b => b.rows.length > 0)
  })()

  // Empty state context-aware
  const emptyText = (() => {
    if (filterLoai === 'all') return `Không có sự kiện nào trong ${days} ngày tới`
    const cfg = EVENT_TYPE[filterLoai]
    if (!cfg) return 'Không có dữ liệu'
    if (filterLoai === 'co_con_nho')
      return `Không có NV nào có con từ ${conTuoiMin}–${conTuoiMax} tuổi`
    return `Không có "${cfg.label}" nào trong ${days} ngày tới`
  })()

  // KPI helper — opacity giảm khi count=0
  const renderKpi = (key: string, icon: string, title: string, value: number, suffix: string, color: string) => {
    const active = filterLoai === key
    const isEmpty = value === 0
    return (
      <Card
        hoverable={!isEmpty}
        onClick={() => !isEmpty && setFilterLoai(active ? 'all' : key)}
        style={{
          borderColor: active ? color : undefined,
          borderWidth: active ? 2 : 1,
          opacity: isEmpty ? 0.55 : 1,
          cursor: isEmpty ? 'default' : 'pointer',
          background: active ? `${color}08` : undefined,
        }}
      >
        <Statistic
          title={<span style={{ fontSize: 12 }}>{icon} {title}</span>}
          value={value}
          valueStyle={{ color: isEmpty ? '#bfbfbf' : color, fontSize: 22 }}
          suffix={<span style={{ fontSize: 12, color: isEmpty ? '#bfbfbf' : '#8c8c8c' }}>{suffix}</span>}
        />
      </Card>
    )
  }

  return (
    <>
      {/* 4 KPI cards — click để filter, faded khi 0 */}
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>{renderKpi('sinh_nhat_nv', '🎂', 'Sinh nhật NV', summary?.sinh_nhat_nv ?? 0, 'người', EVENT_TYPE.sinh_nhat_nv.color)}</Col>
        <Col span={6}>{renderKpi('co_con_nho', '👶', `Con NV (${conTuoiMin}–${conTuoiMax} tuổi)`, summary?.co_con_nho ?? 0, 'con', EVENT_TYPE.co_con_nho.color)}</Col>
        <Col span={6}>{renderKpi('tham_nien', '🏆', 'Mốc thâm niên', summary?.tham_nien ?? 0, 'NV', EVENT_TYPE.tham_nien.color)}</Col>
        <Col span={6}>{renderKpi('hd_het_han', '📅', 'HĐLĐ sắp hết hạn', summary?.hd_het_han ?? 0, 'HĐ', EVENT_TYPE.hd_het_han.color)}</Col>
      </Row>

      {/* Filter bar — dùng Select (dropdown) cho dễ nhìn + dễ chọn */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[16, 12]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              📅 Khoảng thời gian
            </Text>
            <Select
              size="middle"
              value={days}
              onChange={(v) => setDays(Number(v))}
              style={{ width: '100%' }}
              options={[
                { label: '7 ngày tới',   value: 7   },
                { label: '30 ngày tới',  value: 30  },
                { label: '60 ngày tới',  value: 60  },
                { label: '90 ngày tới',  value: 90  },
                { label: '6 tháng tới',  value: 180 },
                { label: '1 năm tới',    value: 365 },
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              🏷️ Loại sự kiện
            </Text>
            <Select
              size="middle"
              value={filterLoai}
              onChange={(v) => setFilterLoai(String(v))}
              style={{ width: '100%' }}
              options={[
                { label: '🔍 Tất cả các loại', value: 'all' },
                ...Object.entries(EVENT_TYPE).map(([k, v]) => ({
                  label: <span>{v.icon} {v.label}</span>,
                  value: k,
                })),
              ]}
            />
          </Col>
          {showAgeFilter && (
            <Col xs={24} sm={24} md={8}>
              <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                👶 Lọc theo độ tuổi con
              </Text>
              <Select
                size="middle"
                style={{ width: '100%' }}
                placeholder="Chọn nhóm tuổi…"
                value={conTuoiPreset}
                onChange={(v) => {
                  setConTuoiPreset(v)
                  const preset = AGE_PRESETS.find(p => p.key === v)
                  if (preset && preset.min !== null) {
                    setConTuoiMin(preset.min); setConTuoiMax(preset.max!)
                  }
                }}
                options={AGE_PRESETS.map(p => ({
                  value: p.key,
                  label: <span>{p.icon} {p.label}</span>,
                }))}
              />
            </Col>
          )}
        </Row>

        {/* Custom age range — chỉ hiện khi preset = 'custom' */}
        {showAgeFilter && conTuoiPreset === 'custom' && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #e8e8e8' }}>
            <Space size={6} align="center">
              <Text type="secondary" style={{ fontSize: 12 }}>Khoảng tuổi tùy chỉnh:</Text>
              <InputNumber size="small" min={0} max={30} value={conTuoiMin}
                onChange={(v) => setConTuoiMin(Number(v ?? 0))}
                style={{ width: 70 }} addonAfter="t" />
              <Text type="secondary" style={{ fontSize: 12 }}>đến</Text>
              <InputNumber size="small" min={0} max={30} value={conTuoiMax}
                onChange={(v) => setConTuoiMax(Number(v ?? 16))}
                style={{ width: 70 }} addonAfter="t" />
              {(conTuoiMin !== 0 || conTuoiMax !== 16) && (
                <Button size="small" type="link" onClick={() => {
                  setConTuoiMin(0); setConTuoiMax(16); setConTuoiPreset('all')
                }}>
                  Reset
                </Button>
              )}
            </Space>
          </div>
        )}
      </Card>

      {/* Grouped events — chia theo bucket thời gian */}
      {isLoading ? (
        <Card loading style={{ minHeight: 200 }} />
      ) : groupedEvents.length === 0 ? (
        <Card size="small" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>📭</div>
          <Text type="secondary" style={{ fontSize: 14 }}>{emptyText}</Text>
        </Card>
      ) : (
        <>
          {groupedEvents.map(bucket => (
            <Card
              key={bucket.key}
              size="small"
              title={
                <Space>
                  <span style={{ color: bucket.color, fontWeight: 700 }}>{bucket.label}</span>
                  <Tag color={bucket.color}>{bucket.rows.length}</Tag>
                </Space>
              }
              style={{ marginBottom: 8 }}
              styles={{ body: { padding: 0 } }}
            >
              <Table
                dataSource={bucket.rows}
                rowKey={(r: any) => `${r.employee_id}_${r.loai}_${r.ngay_sap_toi || r.ten_su_kien}`}
                size="small" pagination={false} showHeader={false}
                columns={[
                  {
                    width: 36, align: 'center' as const, dataIndex: 'icon',
                    render: (icon: string, r: any) => <span style={{ fontSize: 18 }}>{icon || EVENT_TYPE[r.loai]?.icon || '📌'}</span>,
                  },
                  {
                    dataIndex: 'ho_ten', width: 200,
                    render: (v: string, r: any) => (
                      <div>
                        <Text strong style={{ fontSize: 13 }}>{v}</Text>
                        <br /><Text type="secondary" style={{ fontSize: 11 }}>{r.ma_nv}</Text>
                      </div>
                    ),
                  },
                  {
                    dataIndex: 'ten_su_kien',
                    render: (v: string, r: any) => (
                      <div>
                        <Text>{v}</Text>
                        {r.mo_ta_them && (
                          <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>{r.mo_ta_them}</div>
                        )}
                      </div>
                    ),
                  },
                  {
                    width: 130, dataIndex: 'ngay_sap_toi', align: 'right' as const,
                    render: (v: string | null, r: any) => v ? (
                      <div>
                        <Text strong style={{ color: bucket.color }}>{dayjs(v).format('DD/MM/YYYY')}</Text>
                        {r.con_lai_ngay != null && r.con_lai_ngay > 0 && (
                          <div style={{ fontSize: 11, color: '#8c8c8c' }}>còn {r.con_lai_ngay} ngày</div>
                        )}
                      </div>
                    ) : <Text type="secondary">—</Text>,
                  },
                ]}
              />
            </Card>
          ))}
        </>
      )}
    </>
  )
}

// ─── Sub-modals ───

function CreateRecordModal({ open, onClose, employees, onCreated }: any) {
  const [form] = Form.useForm()
  const { data: policies = [] } = useQuery({
    queryKey: ['hr-benefit-policies-active'],
    queryFn: () => hrApi.listBenefitPolicies({ is_active: true }).then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (v: any) => hrApi.createBenefitRecord({
      ...v,
      ngay_su_kien: v.ngay_su_kien.format('YYYY-MM-DD'),
      thang_ap_dung: v.ky_luong.month() + 1,
      nam_ap_dung: v.ky_luong.year(),
    }),
    onSuccess: () => {
      message.success('Đã tạo bản ghi cấp phát')
      form.resetFields()
      onClose()
      onCreated()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo'),
  })

  // Khi chọn policy → auto fill loai + muc_tien
  const onPolicyChange = (pid: number) => {
    const p = policies.find((x: any) => x.id === pid)
    if (p) form.setFieldsValue({ loai: p.loai, muc_tien: p.muc_tien })
  }

  return (
    <Modal
      open={open} title="Thêm bản ghi cấp phát phúc lợi"
      onCancel={onClose} onOk={() => form.submit()}
      confirmLoading={createMut.isPending}
      destroyOnClose width={520}
    >
      <Form form={form} layout="vertical" onFinish={v => createMut.mutate(v)} requiredMark={false}>
        <Form.Item name="employee_id" label="Nhân viên" rules={[{ required: true }]}>
          <Select showSearch placeholder="Chọn nhân viên"
            options={employees.map((e: any) => ({
              value: e.id, label: `${e.ma_nv} — ${e.ho_ten}`,
            }))}
            filterOption={(i, o) => String(o?.label ?? '').toLowerCase().includes(i.toLowerCase())}
          />
        </Form.Item>
        <Form.Item name="policy_id" label="Chính sách áp dụng">
          <Select allowClear placeholder="Chọn chính sách (tự fill mức tiền)" onChange={onPolicyChange}
            options={policies.map((p: any) => ({
              value: p.id,
              label: `${LOAI_LABEL[p.loai]?.icon || '🎁'} ${p.ten} (${Number(p.muc_tien).toLocaleString('vi-VN')}đ)`,
            }))}
          />
        </Form.Item>
        <Form.Item name="loai" label="Loại" rules={[{ required: true }]}>
          <Select options={Object.entries(LOAI_LABEL).map(([k, v]) => ({
            value: k, label: `${v.icon} ${v.text}`,
          }))} />
        </Form.Item>
        <Form.Item name="ngay_su_kien" label="Ngày sự kiện" rules={[{ required: true }]}>
          <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="muc_tien" label="Mức tiền (VNĐ)" rules={[{ required: true }]}>
          <InputNumber style={{ width: '100%' }} min={0} step={100000}
            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
        </Form.Item>
        <Form.Item name="ky_luong" label="Kỳ lương áp dụng (tự cộng vào lương tháng nào)"
          rules={[{ required: true }]} initialValue={dayjs()}>
          <DatePicker picker="month" format="MM/YYYY" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="ghi_chu" label="Ghi chú">
          <TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

function BulkHolidayModal({ open, onClose, onCreated }: any) {
  const [form] = Form.useForm()
  const { data: policies = [] } = useQuery({
    queryKey: ['hr-benefit-policies-active-holiday'],
    queryFn: () => hrApi.listBenefitPolicies({ is_active: true }).then(r =>
      r.data.filter((p: any) => p.loai.startsWith('tet') || p.loai.startsWith('le_') || p.loai === 'trung_thu')
    ),
  })

  const bulkMut = useMutation({
    mutationFn: (v: any) => hrApi.bulkCreateHolidayBenefit({
      policy_id: v.policy_id,
      ngay_su_kien: v.ngay_su_kien.format('YYYY-MM-DD'),
      thang_ap_dung: v.ky_luong.month() + 1,
      nam_ap_dung: v.ky_luong.year(),
      ghi_chu: v.ghi_chu,
    }),
    onSuccess: (r) => {
      message.success(`Đã tạo ${r.data.created} bản ghi (${r.data.skipped_existing} đã có sẵn)`, 5)
      form.resetFields()
      onClose()
      onCreated()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo bulk'),
  })

  return (
    <Modal
      open={open} title="Bulk cấp phát phúc lợi lễ Tết"
      onCancel={onClose} onOk={() => form.submit()}
      confirmLoading={bulkMut.isPending}
      destroyOnClose width={520}
    >
      <div style={{ marginBottom: 16, padding: 10, background: '#fff7e6', borderRadius: 8 }}>
        <Text style={{ fontSize: 12 }}>
          💡 Hệ thống sẽ tự tạo bản ghi cho TẤT CẢ nhân viên đang làm việc theo đối tượng chính sách
          (vd: chính sách 8/3 chỉ tạo cho NV nữ). Tự skip NV đã có bản ghi cùng tháng.
        </Text>
      </div>
      <Form form={form} layout="vertical" onFinish={v => bulkMut.mutate(v)} requiredMark={false}>
        <Form.Item name="policy_id" label="Chọn chính sách lễ Tết" rules={[{ required: true }]}>
          <Select placeholder="Chính sách lễ"
            options={policies.map((p: any) => ({
              value: p.id,
              label: `${LOAI_LABEL[p.loai]?.icon || '🎁'} ${p.ten} — ${Number(p.muc_tien).toLocaleString('vi-VN')}đ (${AP_DUNG_LABEL[p.ap_dung_cho]})`,
            }))}
          />
        </Form.Item>
        <Form.Item name="ngay_su_kien" label="Ngày lễ" rules={[{ required: true }]}>
          <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="ky_luong" label="Kỳ lương áp dụng" rules={[{ required: true }]}
          initialValue={dayjs()}>
          <DatePicker picker="month" format="MM/YYYY" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="ghi_chu" label="Ghi chú chung">
          <TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  )
}


// ─── TAB 0: DASHBOARD (HR Manager view) ─────────────────────────────────────

function DashboardTab() {
  const [thang, setThang] = useState(dayjs().month() + 1)
  const [nam, setNam] = useState(dayjs().year())

  const { data, isLoading } = useQuery({
    queryKey: ['hr-benefit-dashboard', thang, nam],
    queryFn: () => hrApi.benefitDashboard(thang, nam).then(r => r.data),
  })

  if (isLoading || !data) {
    return <Card loading style={{ minHeight: 400 }} />
  }

  const kpi = data.kpi
  const pctChange = kpi.pct_change_yoy
  const pctColor = pctChange == null ? '#8c8c8c' : pctChange > 0 ? '#cf1322' : '#52c41a'
  const pctIcon = pctChange == null ? '—' : pctChange > 0 ? '↑' : '↓'

  const maxLoai = Math.max(...data.by_loai.map(x => x.tong_tien), 1)
  const maxDept = Math.max(...data.by_phong_ban.map(x => x.tong_tien), 1)
  const maxTrend = Math.max(...data.trend_12_thang.map(x => x.tong_tien), 1)

  const daysInMonth = dayjs(`${nam}-${String(thang).padStart(2, '0')}-01`).daysInMonth()
  const firstDayWeek = dayjs(`${nam}-${String(thang).padStart(2, '0')}-01`).day()
  const vnHolidays = getVnHolidaysForMonth(nam, thang)

  const fmtVND = (v: number) => Number(v || 0).toLocaleString('vi-VN') + 'đ'
  const hasAnyData = kpi.chi_thang > 0 || kpi.chi_nam > 0 || kpi.so_record_thang > 0
  const isCurrentMonth = thang === dayjs().month() + 1 && nam === dayjs().year()

  return (
    <>
      {/* ─── Hero filter card ─── */}
      <Card
        size="small"
        style={{
          marginBottom: 16,
          background: 'linear-gradient(135deg, #fa8c16 0%, #eb2f96 100%)',
          border: 'none',
        }}
        styles={{ body: { padding: '12px 16px' } }}
      >
        <Row justify="space-between" align="middle" wrap>
          <Col>
            <Space size={12} align="center">
              <span style={{ color: '#fff', fontWeight: 600 }}>📅 Kỳ phân tích</span>
              <Select value={thang} onChange={setThang} size="middle" style={{ width: 120 }}
                options={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Tháng ${i + 1}` }))}
              />
              <Select value={nam} onChange={setNam} size="middle" style={{ width: 110 }}
                options={Array.from({ length: 7 }, (_, i) => {
                  const y = dayjs().year() - 3 + i
                  return { value: y, label: y.toString() }
                })}
              />
              {!isCurrentMonth && (
                <Button size="middle" type="default"
                  onClick={() => { setThang(dayjs().month() + 1); setNam(dayjs().year()) }}>
                  ↻ Về tháng hiện tại
                </Button>
              )}
            </Space>
          </Col>
          <Col>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>
              💡 So sánh cùng kỳ · Phân tích theo loại + bộ phận · Xu hướng 12 tháng
            </Text>
          </Col>
        </Row>
      </Card>

      {/* ─── 4 KPI cards đồng nhất ─── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <BenefitKpiCard
            icon="💰"
            label={`Chi phí tháng ${thang}/${nam}`}
            value={fmtVND(kpi.chi_thang)}
            color="#1677ff"
            sub={
              pctChange != null ? (
                <Tag color={pctChange > 0 ? 'red' : 'green'} style={{ margin: 0 }}>
                  {pctIcon} {Math.abs(pctChange)}% so cùng kỳ
                </Tag>
              ) : (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Cùng kỳ năm trước: {fmtVND(kpi.chi_cung_ky_nam_truoc)}
                </Text>
              )
            }
          />
        </Col>
        <Col xs={12} md={6}>
          <BenefitKpiCard
            icon="📅"
            label={`Tổng năm ${nam}`}
            value={fmtVND(kpi.chi_nam)}
            color="#722ed1"
            sub={
              <Text type="secondary" style={{ fontSize: 11 }}>
                Trung bình {fmtVND(kpi.chi_nam / 12)}/tháng
              </Text>
            }
          />
        </Col>
        <Col xs={12} md={6}>
          <BenefitKpiCard
            icon="👥"
            label="Nhân viên được nhận tháng này"
            value={`${kpi.so_nv_nhan_thang} người`}
            color="#52c41a"
            sub={
              <Text type="secondary" style={{ fontSize: 11 }}>
                Bình quân: {kpi.so_nv_nhan_thang > 0
                  ? fmtVND(Math.round(kpi.chi_thang / kpi.so_nv_nhan_thang))
                  : '0đ'}/người
              </Text>
            }
          />
        </Col>
        <Col xs={12} md={6}>
          <BenefitKpiCard
            icon="📋"
            label="Số bản ghi tháng này"
            value={`${kpi.so_record_thang} bản ghi`}
            color="#fa8c16"
            sub={
              <Text type="secondary" style={{ fontSize: 11 }}>
                Gồm đề xuất + đã duyệt + đã chi
              </Text>
            }
          />
        </Col>
      </Row>

      {/* ─── 2 phân tích cạnh nhau ─── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12}>
          <Card size="small" title="💡 Chi tiêu theo loại phúc lợi" extra={<Text type="secondary" style={{ fontSize: 11 }}>Tháng {thang}/{nam}</Text>}>
            {data.by_loai.length === 0 ? (
              <BenefitEmpty
                icon="📊"
                title="Chưa có chi tiêu nào trong tháng"
                desc="Khi HR cấp phát phúc lợi cho NV, số liệu sẽ hiện ra đây phân theo từng loại (sinh nhật, hiếu hỉ, Tết...)"
              />
            ) : (
              <div>
                {data.by_loai.map((row) => {
                  const pct = (row.tong_tien / maxLoai) * 100
                  const cfg = LOAI_LABEL[row.loai] || { text: row.loai, icon: '🎁' }
                  return (
                    <div key={row.loai} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span><span style={{ fontSize: 14 }}>{cfg.icon}</span> {cfg.text} <Text type="secondary">({row.so_luot} lượt)</Text></span>
                        <Text strong style={{ color: '#1677ff' }}>{fmtVND(row.tong_tien)}</Text>
                      </div>
                      <div style={{ background: '#f5f5f5', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          width: `${pct}%`, height: '100%',
                          background: 'linear-gradient(90deg, #1677ff, #722ed1)',
                          transition: 'width 0.3s',
                        }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card size="small" title="🏢 Top bộ phận tốn kém nhất" extra={<Text type="secondary" style={{ fontSize: 11 }}>Tháng {thang}/{nam}</Text>}>
            {data.by_phong_ban.length === 0 ? (
              <BenefitEmpty
                icon="🏢"
                title="Chưa có phát sinh theo bộ phận"
                desc="Khi có cấp phát phúc lợi, hệ thống sẽ xếp hạng các bộ phận theo chi phí từ cao xuống thấp."
              />
            ) : (
              <div>
                {data.by_phong_ban.map((row, idx) => {
                  const pct = (row.tong_tien / maxDept) * 100
                  const color = idx === 0 ? '#cf1322' : idx === 1 ? '#fa541c' : idx === 2 ? '#fa8c16' : '#1677ff'
                  return (
                    <div key={idx} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span>
                          <Avatar size={20} style={{ backgroundColor: color, fontSize: 11, marginRight: 6, verticalAlign: 'middle' }}>{idx + 1}</Avatar>
                          {row.ten_bo_phan} <Text type="secondary">({row.so_luot} lượt)</Text>
                        </span>
                        <Text strong style={{ color }}>{fmtVND(row.tong_tien)}</Text>
                      </div>
                      <div style={{ background: '#f5f5f5', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* ─── Bar chart xu hướng 12 tháng ─── */}
      <Card
        size="small"
        title={`📈 Xu hướng chi phí phúc lợi năm ${nam}`}
        extra={hasAnyData ? <Text type="secondary" style={{ fontSize: 11 }}>Đơn vị: triệu đồng</Text> : null}
        style={{ marginBottom: 16 }}
      >
        {maxTrend === 0 ? (
          <BenefitEmpty
            icon="📉"
            title={`Chưa có chi tiêu nào trong năm ${nam}`}
            desc="Tạo phúc lợi đầu tiên hoặc đợi cron sinh nhật/lễ tự chạy để biểu đồ xu hướng có dữ liệu."
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', height: 160, gap: 6, paddingTop: 10 }}>
            {data.trend_12_thang.map((row) => {
              const pct = maxTrend > 0 ? (row.tong_tien / maxTrend) * 100 : 0
              const isCurrent = row.thang === thang
              return (
                <div key={row.thang} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontSize: 10, color: isCurrent ? '#1677ff' : '#8c8c8c', height: 14, fontWeight: isCurrent ? 700 : 400 }}>
                    {row.tong_tien > 0 ? `${(row.tong_tien / 1_000_000).toFixed(1)}` : ''}
                  </div>
                  <div style={{
                    width: '70%', height: `${pct}%`, minHeight: row.tong_tien > 0 ? 4 : 2,
                    background: isCurrent ? 'linear-gradient(180deg, #1677ff, #722ed1)' : '#bae0ff',
                    borderRadius: '6px 6px 0 0',
                    transition: 'height 0.3s',
                  }} title={`Tháng ${row.thang}: ${fmtVND(row.tong_tien)}`} />
                  <div style={{ fontSize: 11, color: isCurrent ? '#1677ff' : '#595959', fontWeight: isCurrent ? 700 : 400, marginTop: 6 }}>
                    T{row.thang}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Card
        size="small"
        title={`🗓️ Lịch sự kiện tháng ${thang}/${nam}`}
        extra={
          <Space size={8} style={{ fontSize: 11 }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#fff1f0', border: '1px solid #ffa39e' }} /> Lễ nghỉ</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#fff7e6', border: '1px solid #ffd591' }} /> Lễ kỷ niệm</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#f9f0ff', border: '1px solid #d3adf7' }} /> Tâm linh</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#e6f4ff' }} /> Hôm nay</span>
          </Space>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((d, i) => (
            <div key={d} style={{
              textAlign: 'center', fontWeight: 700, fontSize: 11,
              color: i === 0 ? '#cf1322' : '#8c8c8c', padding: 4,
            }}>{d}</div>
          ))}
          {Array.from({ length: firstDayWeek }).map((_, i) => <div key={`empty-${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1
            const dateKey = dayjs(`${nam}-${String(thang).padStart(2, '0')}-${String(day).padStart(2, '0')}`).format('YYYY-MM-DD')
            const events = data.calendar_events[dateKey] || []
            const holidays = vnHolidays[dateKey] || []
            const isToday = dayjs().format('YYYY-MM-DD') === dateKey

            // Background priority: today > lễ nghỉ > lễ kỷ niệm > lễ tâm linh > thường
            const publicHoliday = holidays.find(h => h.nghi_le)
            const memorialHoliday = holidays.find(h => h.loai === 'le_phu' || h.loai === 'le_nganh')
            const spiritualHoliday = holidays.find(h => h.loai === 'tam_linh')
            const dayOfWeek = dayjs(dateKey).day()
            const isSunday = dayOfWeek === 0

            const bg = isToday ? '#e6f4ff'
              : publicHoliday ? '#fff1f0'
              : spiritualHoliday ? '#f9f0ff'
              : memorialHoliday ? '#fff7e6'
              : '#fff'
            const borderColor = isToday ? '#1677ff'
              : publicHoliday ? '#ffa39e'
              : spiritualHoliday ? '#d3adf7'
              : memorialHoliday ? '#ffd591'
              : '#f0f0f0'

            // Tooltip gộp cả lễ + sự kiện
            const tooltipLines = [
              ...holidays.map(h => `${h.icon} ${h.ten}${h.nghi_le ? ' (nghỉ lễ)' : ''}${h.am_lich ? ' [ÂL]' : ''}`),
              ...events.map(e => `${LOAI_LABEL[e.loai]?.icon || '🎁'} ${e.ho_ten}: ${e.muc_tien.toLocaleString('vi-VN')}đ`),
            ]

            return (
              <div
                key={day}
                style={{
                  minHeight: 72, border: `1px solid ${borderColor}`, borderRadius: 4,
                  padding: 4, fontSize: 11, position: 'relative', background: bg,
                  borderWidth: isToday || publicHoliday ? 2 : 1,
                }}
                title={tooltipLines.length > 0 ? tooltipLines.join('\n') : ''}
              >
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontWeight: isToday || publicHoliday ? 700 : 400,
                  color: isToday ? '#1677ff' : publicHoliday ? '#cf1322' : isSunday ? '#cf1322' : '#262626',
                }}>
                  <span>{day}</span>
                  {holidays.length > 0 && (
                    <span style={{ fontSize: 12 }}>{holidays[0].icon}</span>
                  )}
                </div>

                {/* Tên lễ — ưu tiên lễ nghỉ > lễ kỷ niệm */}
                {holidays.length > 0 && (
                  <div style={{
                    marginTop: 2, fontSize: 9,
                    color: publicHoliday ? '#cf1322' : spiritualHoliday ? '#722ed1' : '#fa541c',
                    fontWeight: publicHoliday ? 600 : 500,
                    lineHeight: 1.2,
                  }}>
                    {holidays[0].ten}
                    {holidays.length > 1 && <span style={{ color: '#8c8c8c' }}> +{holidays.length - 1}</span>}
                  </div>
                )}

                {/* Benefit events — icon nhỏ */}
                {events.length > 0 && (
                  <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {events.slice(0, 3).map((e, idx) => (
                      <span key={idx} title={`${e.ho_ten} · ${e.muc_tien.toLocaleString('vi-VN')}đ`}
                        style={{ fontSize: 11 }}>
                        {LOAI_LABEL[e.loai]?.icon || '🎁'}
                      </span>
                    ))}
                    {events.length > 3 && <span style={{ fontSize: 9, color: '#8c8c8c' }}>+{events.length - 3}</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>
    </>
  )
}

// ─── KPI card đồng nhất cho Benefits Dashboard ───
function BenefitKpiCard({
  icon, label, value, color, sub,
}: {
  icon: string; label: string; value: string; color: string; sub?: React.ReactNode
}) {
  return (
    <Card size="small" style={{ borderLeft: `4px solid ${color}`, height: '100%' }}>
      <Row gutter={12} align="middle">
        <Col>
          <div
            style={{
              width: 44, height: 44, borderRadius: 10,
              background: `${color}15`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}
          >
            {icon}
          </div>
        </Col>
        <Col flex={1} style={{ overflow: 'hidden' }}>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', lineHeight: 1.2 }}>{label}</Text>
          <Text strong style={{ fontSize: 20, color, lineHeight: 1.2, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {value}
          </Text>
          {sub && <div style={{ marginTop: 4 }}>{sub}</div>}
        </Col>
      </Row>
    </Card>
  )
}

// ─── Empty state đẹp ───
function BenefitEmpty({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '24px 16px' }}>
      <div style={{ fontSize: 40, marginBottom: 8, opacity: 0.5 }}>{icon}</div>
      <Text strong style={{ display: 'block', marginBottom: 4 }}>{title}</Text>
      <Text type="secondary" style={{ fontSize: 12, maxWidth: 400, display: 'inline-block' }}>
        {desc}
      </Text>
    </div>
  )
}
