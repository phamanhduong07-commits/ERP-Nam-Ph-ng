/**
 * An toàn lao động & BHLĐ — Phase 1.3.
 *
 * Theo Luật ATVSLĐ 2015, NĐ 44/2016/NĐ-CP, TT 28/2021/TT-BLĐTBXH.
 *
 * 4 tab:
 * 1. Tổng quan — KPI 3 mảng + cảnh báo
 * 2. Bảo hộ lao động (BHLĐ) — danh mục thiết bị + cấp phát
 * 3. Huấn luyện ATVSLĐ — buổi học + NV tham gia
 * 4. Tai nạn lao động — báo cáo TNLĐ
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Avatar, Badge, Button, Card, Col, DatePicker, Form, Input, InputNumber,
  Modal, Row, Select, Space, Statistic, Table, Tabs, Tag, Typography, message,
  Popconfirm, Drawer, List,
} from 'antd'
import {
  SafetyOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  WarningOutlined, AlertOutlined, MedicineBoxOutlined, BookOutlined,
  ToolOutlined, ThunderboltOutlined, UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { hrApi } from '../../api/hr'

const { Title, Text } = Typography

const NHOM_LABEL: Record<string, { color: string; label: string }> = {
  nhom_1: { color: 'purple', label: 'Nhóm 1 — BGĐ / Người sử dụng LĐ' },
  nhom_2: { color: 'blue',   label: 'Nhóm 2 — Cán bộ ATVSLĐ' },
  nhom_3: { color: 'orange', label: 'Nhóm 3 — Yêu cầu nghiêm ngặt' },
  nhom_4: { color: 'cyan',   label: 'Nhóm 4 — NV còn lại' },
}
const TRANG_THAI_TRAINING = [
  { value: 'sap_dien_ra', label: '📅 Sắp diễn ra', color: 'gold' },
  { value: 'da_dien_ra',  label: '✅ Đã diễn ra',   color: 'green' },
  { value: 'huy',         label: '❌ Hủy',          color: 'red' },
]
const MUC_DO_TNLD = [
  { value: 'nhe',     label: '🟡 Nhẹ',     color: 'gold' },
  { value: 'nang',    label: '🔴 Nặng',    color: 'red' },
  { value: 'tu_vong', label: '⚫ Tử vong', color: 'black' },
]
const LY_DO_CAP_BHLD = [
  { value: 'cap_moi',   label: 'Cấp mới' },
  { value: 'thay_the',  label: 'Thay thế định kỳ' },
  { value: 'hong',      label: 'Hỏng' },
  { value: 'mat',       label: 'Mất' },
]

export default function SafetyPage() {
  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <Title level={4} style={{ margin: 0 }}>
        <SafetyOutlined style={{ color: '#fa8c16' }} /> An toàn Lao động & BHLĐ
      </Title>
      <Text type="secondary">
        Theo Luật ATVSLĐ 2015 · NĐ 44/2016 (huấn luyện) · TT 28/2021 (báo cáo TNLĐ)
      </Text>

      <Tabs
        defaultActiveKey="overview"
        style={{ marginTop: 12 }}
        items={[
          { key: 'overview',  label: <span><ThunderboltOutlined /> Tổng quan</span>, children: <OverviewTab /> },
          { key: 'bhld',      label: <span><ToolOutlined /> Bảo hộ lao động</span>,  children: <BHLDTab /> },
          { key: 'trainings', label: <span><BookOutlined /> Huấn luyện ATVSLĐ</span>, children: <TrainingsTab /> },
          { key: 'accidents', label: <span><AlertOutlined /> Tai nạn lao động</span>, children: <AccidentsTab /> },
        ]}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// TAB 1: Tổng quan
// ═══════════════════════════════════════════════════════════════
function OverviewTab() {
  const { data: s } = useQuery({
    queryKey: ['hr-safety-summary'],
    queryFn: () => hrApi.safetySummary().then(r => r.data),
    refetchInterval: 60_000,
  })
  if (!s) return <Card loading style={{ minHeight: 200 }} />

  return (
    <>
      {s.accidents.unreported_serious > 0 && (
        <Alert
          type="error" showIcon icon={<AlertOutlined />}
          message={`Có ${s.accidents.unreported_serious} vụ TNLĐ nặng/tử vong CHƯA BÁO CÁO Sở LĐ-TBXH!`}
          description="Theo luật, TNLĐ nặng/tử vong phải báo cáo trong vòng 24h. Vào tab 'Tai nạn lao động' để cập nhật trạng thái báo cáo."
          style={{ marginBottom: 16 }}
        />
      )}

      <Title level={5} style={{ marginTop: 8 }}>🛡️ Bảo hộ lao động</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="Danh mục thiết bị" value={s.bhld.total_equipments} prefix={<ToolOutlined />} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="Đã cấp 30 ngày qua" value={s.bhld.issues_30d} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small" style={{ borderColor: '#ffd591' }}>
            <Statistic title="Sắp hết hạn 30 ngày" value={s.bhld.expiring_30d}
              valueStyle={{ color: '#fa8c16' }} prefix={<WarningOutlined />} />
          </Card>
        </Col>
      </Row>

      <Title level={5}>📚 Huấn luyện ATVSLĐ</Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={8}>
          <Card size="small">
            <Statistic title={`Buổi huấn luyện ${new Date().getFullYear()}`} value={s.training.trainings_ytd} prefix={<BookOutlined />} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="Lượt NV tham gia" value={s.training.participants_ytd} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small" style={{ borderColor: '#ffd591' }}>
            <Statistic title="Chứng chỉ sắp hết hạn" value={s.training.expiring_certs_30d}
              valueStyle={{ color: '#fa8c16' }} prefix={<WarningOutlined />} />
          </Card>
        </Col>
      </Row>

      <Title level={5}>🚨 Tai nạn lao động</Title>
      <Row gutter={[16, 16]}>
        <Col xs={6}>
          <Card size="small">
            <Statistic title={`Tổng ${new Date().getFullYear()}`} value={s.accidents.ytd} prefix={<AlertOutlined />} />
          </Card>
        </Col>
        <Col xs={6}>
          <Card size="small"><Statistic title="Nhẹ" value={s.accidents.nhe} valueStyle={{ color: '#fa8c16' }} /></Card>
        </Col>
        <Col xs={6}>
          <Card size="small"><Statistic title="Nặng" value={s.accidents.nang} valueStyle={{ color: '#cf1322' }} /></Card>
        </Col>
        <Col xs={6}>
          <Card size="small"><Statistic title="Tử vong" value={s.accidents.tu_vong} valueStyle={{ color: '#000' }} /></Card>
        </Col>
      </Row>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// TAB 2: BHLĐ — Danh mục + Cấp phát
// ═══════════════════════════════════════════════════════════════
function BHLDTab() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'catalog' | 'issues'>('catalog')
  const [modal, setModal] = useState<'equip' | 'issue' | null>(null)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const { data: equipments = [], isLoading: loadingEq } = useQuery({
    queryKey: ['safety-equipments'],
    queryFn: () => hrApi.safetyListEquipments().then(r => r.data),
  })
  const { data: issues = [], isLoading: loadingIs } = useQuery({
    queryKey: ['safety-issues'],
    queryFn: () => hrApi.safetyListIssues().then(r => r.data),
  })
  const { data: employees = [] } = useQuery({
    queryKey: ['hr-employees-org'],
    queryFn: () => hrApi.listEmployees().then(r => r.data),
  })

  const saveEqMut = useMutation({
    mutationFn: (d: any) => editing?.id ? hrApi.safetyUpdateEquipment(editing.id, d) : hrApi.safetyCreateEquipment(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['safety-equipments'] }); message.success('Đã lưu'); setModal(null); setEditing(null); form.resetFields() },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi lưu'),
  })
  const delEqMut = useMutation({
    mutationFn: (id: number) => hrApi.safetyDeleteEquipment(id),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ['safety-equipments'] });
      message.success(r.data?.soft_deleted ? 'Đã ẩn (vì còn lần cấp phát liên quan)' : 'Đã xóa') },
  })
  const saveIssueMut = useMutation({
    mutationFn: (d: any) => hrApi.safetyCreateIssue(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['safety-issues'] }); message.success('Đã cấp phát'); setModal(null); form.resetFields() },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })
  const delIssueMut = useMutation({
    mutationFn: (id: number) => hrApi.safetyDeleteIssue(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['safety-issues'] }); message.success('Đã xóa') },
  })

  const openCreateEq = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ don_vi: 'cái', trang_thai: true }); setModal('equip') }
  const openEditEq = (r: any) => { setEditing(r); form.setFieldsValue(r); setModal('equip') }
  const openCreateIssue = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ ngay_cap: dayjs(), so_luong: 1, ly_do: 'cap_moi' }); setModal('issue') }

  const today = dayjs()
  return (
    <>
      <Tabs activeKey={tab} onChange={(k) => setTab(k as any)} type="card" size="small"
        items={[
          { key: 'catalog', label: '📦 Danh mục thiết bị' },
          { key: 'issues',  label: '🎁 Lần cấp phát' },
        ]}
        tabBarExtraContent={
          tab === 'catalog'
            ? <Button type="primary" icon={<PlusOutlined />} onClick={openCreateEq}>Thêm thiết bị</Button>
            : <Button type="primary" icon={<PlusOutlined />} onClick={openCreateIssue}>Cấp phát mới</Button>
        }
      />

      {tab === 'catalog' && (
        <Card size="small" styles={{ body: { padding: 0 } }}>
          <Table
            size="small" rowKey="id" loading={loadingEq} dataSource={equipments}
            columns={[
              { title: 'Mã', dataIndex: 'ma', width: 120, render: (v) => <Text strong>{v}</Text> },
              { title: 'Tên thiết bị', dataIndex: 'ten' },
              { title: 'Loại', dataIndex: 'loai', width: 120, render: (v) => v && <Tag>{v}</Tag> },
              { title: 'Đơn vị', dataIndex: 'don_vi', width: 80 },
              { title: 'Hạn SD (tháng)', dataIndex: 'han_su_dung_thang', width: 130, align: 'center' as const,
                render: (v: number) => v ? <Tag color="blue">{v} tháng</Tag> : '—' },
              { title: 'Đơn giá', dataIndex: 'don_gia', width: 110, align: 'right' as const,
                render: (v: number) => v ? `${(v / 1000).toLocaleString('vi')}k` : '—' },
              { title: 'Trạng thái', dataIndex: 'trang_thai', width: 100,
                render: (v: boolean) => v ? <Tag color="green">Đang dùng</Tag> : <Tag>Ngưng</Tag> },
              { title: '', width: 90, render: (_, r: any) => (
                <Space size={4}>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEditEq(r)} />
                  <Popconfirm title="Xóa thiết bị?" onConfirm={() => delEqMut.mutate(r.id)}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              )},
            ]}
            pagination={{ pageSize: 15 }}
          />
        </Card>
      )}

      {tab === 'issues' && (
        <Card size="small" styles={{ body: { padding: 0 } }}>
          <Table
            size="small" rowKey="id" loading={loadingIs} dataSource={issues}
            columns={[
              { title: 'Nhân viên', dataIndex: 'ho_ten',
                render: (v: string, r: any) => <Space>
                  <Avatar icon={<UserOutlined />} size="small" />
                  <div><div>{v}</div><Text type="secondary" style={{ fontSize: 11 }}>{r.ma_nv}</Text></div>
                </Space> },
              { title: 'Thiết bị', dataIndex: 'ten_equipment' },
              { title: 'Ngày cấp', dataIndex: 'ngay_cap', width: 110, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
              { title: 'Số lượng', dataIndex: 'so_luong', width: 80, align: 'center' as const },
              { title: 'Hạn sử dụng', dataIndex: 'han_su_dung_den', width: 140,
                render: (v: string) => {
                  if (!v) return <Text type="secondary">—</Text>
                  const d = dayjs(v); const diff = d.diff(today, 'day')
                  if (diff < 0) return <Tag color="red">Quá hạn {Math.abs(diff)}d</Tag>
                  if (diff <= 30) return <Tag color="orange">{d.format('DD/MM/YYYY')} ({diff}d)</Tag>
                  return <Text>{d.format('DD/MM/YYYY')}</Text>
                }},
              { title: 'Lý do', dataIndex: 'ly_do', width: 130, render: (v: string) => LY_DO_CAP_BHLD.find(o => o.value === v)?.label || v },
              { title: '', width: 60, render: (_, r: any) => (
                <Popconfirm title="Xóa lần cấp?" onConfirm={() => delIssueMut.mutate(r.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              )},
            ]}
            pagination={{ pageSize: 15 }}
          />
        </Card>
      )}

      <Modal
        open={modal !== null} title={modal === 'equip' ? (editing ? 'Sửa thiết bị BHLĐ' : 'Thêm thiết bị BHLĐ') : 'Cấp phát BHLĐ'}
        onCancel={() => { setModal(null); setEditing(null); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={saveEqMut.isPending || saveIssueMut.isPending}
        width={modal === 'issue' ? 560 : 600}
      >
        {modal === 'equip' && (
          <Form form={form} layout="vertical" onFinish={(v) => saveEqMut.mutate(v)}>
            <Row gutter={12}>
              <Col span={10}><Form.Item name="ma" label="Mã" rules={[{ required: true }]}><Input disabled={!!editing} placeholder="BHLD001" /></Form.Item></Col>
              <Col span={14}><Form.Item name="ten" label="Tên thiết bị" rules={[{ required: true }]}><Input placeholder="Nón bảo hộ vàng" /></Form.Item></Col>
            </Row>
            <Row gutter={12}>
              <Col span={8}><Form.Item name="loai" label="Loại"><Select allowClear options={[
                { value: 'non', label: 'Nón' }, { value: 'giay', label: 'Giày' },
                { value: 'gang_tay', label: 'Găng tay' }, { value: 'khau_trang', label: 'Khẩu trang' },
                { value: 'kinh', label: 'Kính' }, { value: 'ao_phan_quang', label: 'Áo phản quang' },
                { value: 'day_dai', label: 'Dây đai an toàn' },
              ]} /></Form.Item></Col>
              <Col span={6}><Form.Item name="don_vi" label="Đơn vị"><Input /></Form.Item></Col>
              <Col span={10}><Form.Item name="han_su_dung_thang" label="Định mức (tháng) — auto khi cấp"><InputNumber style={{ width: '100%' }} min={0} step={1} /></Form.Item></Col>
            </Row>
            <Row gutter={12}>
              <Col span={12}><Form.Item name="don_gia" label="Đơn giá (VNĐ)"><InputNumber style={{ width: '100%' }} step={10000} min={0}
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} /></Form.Item></Col>
              <Col span={12}><Form.Item name="trang_thai" label="Trạng thái" valuePropName="checked">
                <Select options={[{ value: true, label: 'Đang dùng' }, { value: false, label: 'Ngưng' }]} /></Form.Item></Col>
            </Row>
            <Form.Item name="mo_ta" label="Mô tả"><Input.TextArea rows={2} /></Form.Item>
          </Form>
        )}
        {modal === 'issue' && (
          <Form form={form} layout="vertical" onFinish={(v) => saveIssueMut.mutate({
            ...v, ngay_cap: v.ngay_cap.format('YYYY-MM-DD'),
            han_su_dung_den: v.han_su_dung_den?.format('YYYY-MM-DD'),
          })}>
            <Form.Item name="employee_id" label="Nhân viên" rules={[{ required: true }]}>
              <Select showSearch optionFilterProp="label"
                options={employees.map(e => ({ value: e.id, label: `${e.ma_nv} — ${e.ho_ten}` }))} />
            </Form.Item>
            <Form.Item name="equipment_id" label="Thiết bị" rules={[{ required: true }]}>
              <Select showSearch optionFilterProp="label"
                options={equipments.filter((e: any) => e.trang_thai).map((e: any) => ({ value: e.id, label: `${e.ma} — ${e.ten} (${e.don_vi})` }))} />
            </Form.Item>
            <Row gutter={12}>
              <Col span={8}><Form.Item name="ngay_cap" label="Ngày cấp" rules={[{ required: true }]}><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={8}><Form.Item name="so_luong" label="Số lượng" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={8}><Form.Item name="ly_do" label="Lý do"><Select options={LY_DO_CAP_BHLD} /></Form.Item></Col>
            </Row>
            <Form.Item name="han_su_dung_den" label="Hạn sử dụng đến (auto theo định mức nếu để trống)">
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="ghi_chu" label="Ghi chú"><Input.TextArea rows={2} /></Form.Item>
          </Form>
        )}
      </Modal>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// TAB 3: Huấn luyện
// ═══════════════════════════════════════════════════════════════
function TrainingsTab() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [drawerTraining, setDrawerTraining] = useState<any>(null)
  const [form] = Form.useForm()

  const { data: trainings = [], isLoading } = useQuery({
    queryKey: ['safety-trainings'],
    queryFn: () => hrApi.safetyListTrainings().then(r => r.data),
  })

  const saveMut = useMutation({
    mutationFn: (d: any) => editing?.id ? hrApi.safetyUpdateTraining(editing.id, d) : hrApi.safetyCreateTraining(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['safety-trainings'] }); message.success('Đã lưu'); setOpen(false); setEditing(null); form.resetFields() },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })
  const delMut = useMutation({
    mutationFn: (id: number) => hrApi.safetyDeleteTraining(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['safety-trainings'] }); message.success('Đã xóa') },
  })

  const openCreate = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ trang_thai: 'sap_dien_ra', nhom_doi_tuong: 'nhom_3' }); setOpen(true) }
  const openEdit = (r: any) => {
    setEditing(r); form.setFieldsValue({
      ...r,
      ngay_bat_dau: r.ngay_bat_dau ? dayjs(r.ngay_bat_dau) : undefined,
      ngay_ket_thuc: r.ngay_ket_thuc ? dayjs(r.ngay_ket_thuc) : undefined,
    }); setOpen(true)
  }
  const onSubmit = (v: any) => saveMut.mutate({
    ...v,
    ngay_bat_dau: v.ngay_bat_dau?.format('YYYY-MM-DD'),
    ngay_ket_thuc: v.ngay_ket_thuc?.format('YYYY-MM-DD'),
  })

  return (
    <>
      <Row justify="end" style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Tạo buổi huấn luyện</Button>
      </Row>
      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          size="small" rowKey="id" loading={isLoading} dataSource={trainings}
          columns={[
            { title: 'Tên khóa', dataIndex: 'ten_khoa_hoc',
              render: (v: string, r: any) => <a onClick={() => setDrawerTraining(r)}>{v}</a> },
            { title: 'Nhóm', dataIndex: 'nhom_doi_tuong', width: 240,
              render: (v: string) => <Tag color={NHOM_LABEL[v]?.color}>{NHOM_LABEL[v]?.label || v}</Tag> },
            { title: 'Thời gian', width: 180,
              render: (_, r: any) => `${dayjs(r.ngay_bat_dau).format('DD/MM/YY')} → ${r.ngay_ket_thuc ? dayjs(r.ngay_ket_thuc).format('DD/MM/YY') : '—'}` },
            { title: 'Giảng viên', dataIndex: 'giang_vien', width: 150, ellipsis: true },
            { title: 'NV tham gia', dataIndex: 'so_tham_gia', width: 110, align: 'center' as const,
              render: (v: number, r: any) => (
                <Button size="small" type="link" onClick={() => setDrawerTraining(r)}>
                  <Badge count={v} showZero color="#1677ff" /> Xem
                </Button>
              )},
            { title: 'Trạng thái', dataIndex: 'trang_thai', width: 130,
              render: (v: string) => {
                const m = TRANG_THAI_TRAINING.find(t => t.value === v)
                return <Tag color={m?.color}>{m?.label || v}</Tag>
              }},
            { title: '', width: 90, render: (_, r: any) => (
              <Space size={4}>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
                <Popconfirm title="Xóa buổi này? (xóa luôn danh sách NV tham gia)" onConfirm={() => delMut.mutate(r.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            )},
          ]}
          pagination={{ pageSize: 15 }}
        />
      </Card>

      <Modal
        open={open} title={editing ? 'Sửa buổi huấn luyện' : 'Tạo buổi huấn luyện ATVSLĐ'}
        onCancel={() => { setOpen(false); setEditing(null); form.resetFields() }}
        onOk={() => form.submit()} confirmLoading={saveMut.isPending} width={680}
      >
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item name="ten_khoa_hoc" label="Tên khóa học" rules={[{ required: true }]}>
            <Input placeholder="VD: Huấn luyện ATVSLĐ Nhóm 3 - Q3/2026" />
          </Form.Item>
          <Form.Item name="nhom_doi_tuong" label="Nhóm đối tượng" rules={[{ required: true }]}>
            <Select options={Object.entries(NHOM_LABEL).map(([k, v]) => ({ value: k, label: v.label }))} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}><Form.Item name="ngay_bat_dau" label="Ngày bắt đầu" rules={[{ required: true }]}><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="ngay_ket_thuc" label="Ngày kết thúc"><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="so_gio" label="Số giờ"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="don_vi_dao_tao" label="Đơn vị đào tạo"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="giang_vien" label="Giảng viên"><Input /></Form.Item></Col>
          </Row>
          <Form.Item name="chu_de" label="Chủ đề / Nội dung"><Input.TextArea rows={2} /></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="chi_phi" label="Chi phí (VNĐ)"><InputNumber style={{ width: '100%' }} step={10000} min={0}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} /></Form.Item></Col>
            <Col span={12}><Form.Item name="trang_thai" label="Trạng thái">
              <Select options={TRANG_THAI_TRAINING} /></Form.Item></Col>
          </Row>
          <Form.Item name="file_url" label="Link tài liệu / giáo trình (URL)"><Input placeholder="https://..." /></Form.Item>
          <Form.Item name="ghi_chu" label="Ghi chú"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* Drawer xem & quản lý NV tham gia */}
      <ParticipantDrawer training={drawerTraining} onClose={() => setDrawerTraining(null)} />
    </>
  )
}

function ParticipantDrawer({ training, onClose }: { training: any | null; onClose: () => void }) {
  const qc = useQueryClient()
  const open = !!training
  const trainingId = training?.id
  const [pickedIds, setPickedIds] = useState<number[]>([])

  const { data: participants = [], isLoading } = useQuery({
    queryKey: ['safety-participants', trainingId],
    queryFn: () => trainingId ? hrApi.safetyListParticipants(trainingId).then(r => r.data) : Promise.resolve([]),
    enabled: !!trainingId,
  })
  const { data: employees = [] } = useQuery({
    queryKey: ['hr-employees-org'],
    queryFn: () => hrApi.listEmployees().then(r => r.data),
  })

  const addMut = useMutation({
    mutationFn: (ids: number[]) => hrApi.safetyAddParticipants(trainingId, ids.map(id => ({ employee_id: id }))),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ['safety-participants', trainingId] });
      qc.invalidateQueries({ queryKey: ['safety-trainings'] });
      message.success(`Đã thêm ${r.data?.added || 0} NV`); setPickedIds([]) },
  })
  const updMut = useMutation({
    mutationFn: ({ id, data }: any) => hrApi.safetyUpdateParticipant(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['safety-participants', trainingId] }),
  })
  const delMut = useMutation({
    mutationFn: (id: number) => hrApi.safetyDeleteParticipant(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['safety-participants', trainingId] });
      qc.invalidateQueries({ queryKey: ['safety-trainings'] }) },
  })

  return (
    <Drawer
      open={open} onClose={onClose} width={720}
      title={training?.ten_khoa_hoc || ''}
      extra={training && <Tag color={NHOM_LABEL[training.nhom_doi_tuong]?.color}>{NHOM_LABEL[training.nhom_doi_tuong]?.label}</Tag>}
    >
      {training && (
        <>
          <Card size="small" style={{ marginBottom: 12 }}>
            <Space wrap>
              <span><strong>Thời gian:</strong> {dayjs(training.ngay_bat_dau).format('DD/MM/YYYY')} → {training.ngay_ket_thuc ? dayjs(training.ngay_ket_thuc).format('DD/MM/YYYY') : '—'}</span>
              <span>·</span>
              <span><strong>Số giờ:</strong> {training.so_gio || '—'}</span>
              <span>·</span>
              <span><strong>Đơn vị ĐT:</strong> {training.don_vi_dao_tao || '—'}</span>
            </Space>
          </Card>

          <Title level={5}>Thêm NV tham gia</Title>
          <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
            <Select
              mode="multiple" showSearch optionFilterProp="label" style={{ flex: 1 }}
              placeholder="Chọn NV để thêm vào buổi huấn luyện này"
              value={pickedIds} onChange={setPickedIds}
              options={employees
                .filter(e => !participants.some((p: any) => p.employee_id === e.id))
                .map(e => ({ value: e.id, label: `${e.ma_nv} — ${e.ho_ten}` }))}
              maxTagCount={3}
            />
            <Button type="primary" onClick={() => pickedIds.length && addMut.mutate(pickedIds)}
              loading={addMut.isPending} disabled={!pickedIds.length}>
              Thêm {pickedIds.length || ''}
            </Button>
          </Space.Compact>

          <Title level={5}>Danh sách NV ({participants.length})</Title>
          <List
            loading={isLoading}
            dataSource={participants}
            locale={{ emptyText: 'Chưa có NV nào tham gia' }}
            renderItem={(p: any) => (
              <List.Item
                actions={[
                  <Popconfirm title="Xóa khỏi danh sách?" onConfirm={() => delMut.mutate(p.id)} key="del">
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  avatar={<Avatar icon={<UserOutlined />} />}
                  title={<>{p.ho_ten} <Text type="secondary" style={{ fontSize: 12 }}>({p.ma_nv})</Text></>}
                  description={
                    <Space wrap size={6}>
                      <Tag color={p.da_hoan_thanh ? 'green' : 'default'}
                        onClick={() => updMut.mutate({ id: p.id, data: { employee_id: p.employee_id, da_hoan_thanh: !p.da_hoan_thanh } })}
                        style={{ cursor: 'pointer' }}>
                        {p.da_hoan_thanh ? '✅ Đạt' : '⏳ Chưa đạt'}
                      </Tag>
                      {p.diem !== null && p.diem !== undefined && <Tag>Điểm: {p.diem}</Tag>}
                      {p.han_chung_chi && (() => {
                        const d = dayjs(p.han_chung_chi); const diff = d.diff(dayjs(), 'day')
                        if (diff < 0) return <Tag color="red">Chứng chỉ quá hạn</Tag>
                        if (diff <= 60) return <Tag color="orange">CC hết hạn {d.format('DD/MM/YY')}</Tag>
                        return <Tag>CC hết hạn {d.format('DD/MM/YY')}</Tag>
                      })()}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </>
      )}
    </Drawer>
  )
}

// ═══════════════════════════════════════════════════════════════
// TAB 4: Tai nạn lao động
// ═══════════════════════════════════════════════════════════════
function AccidentsTab() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [filterMucDo, setFilterMucDo] = useState<string | undefined>()
  const [form] = Form.useForm()

  const { data: accidents = [], isLoading } = useQuery({
    queryKey: ['safety-accidents', filterMucDo],
    queryFn: () => hrApi.safetyListAccidents({ muc_do: filterMucDo }).then(r => r.data),
  })
  const { data: employees = [] } = useQuery({
    queryKey: ['hr-employees-org'],
    queryFn: () => hrApi.listEmployees().then(r => r.data),
  })

  const saveMut = useMutation({
    mutationFn: (d: any) => editing?.id ? hrApi.safetyUpdateAccident(editing.id, d) : hrApi.safetyCreateAccident(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['safety-accidents'] });
      message.success('Đã lưu'); setOpen(false); setEditing(null); form.resetFields() },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })
  const delMut = useMutation({
    mutationFn: (id: number) => hrApi.safetyDeleteAccident(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['safety-accidents'] }); message.success('Đã xóa') },
  })

  const openCreate = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ ngay_xay_ra: dayjs(), muc_do: 'nhe', so_ngay_nghi: 0 }); setOpen(true) }
  const openEdit = (r: any) => {
    setEditing(r); form.setFieldsValue({
      ...r, ngay_xay_ra: dayjs(r.ngay_xay_ra),
      ngay_bao_cao: r.ngay_bao_cao ? dayjs(r.ngay_bao_cao) : undefined,
    }); setOpen(true)
  }

  return (
    <>
      <Row justify="space-between" style={{ marginBottom: 12 }}>
        <Select allowClear placeholder="Lọc theo mức độ" value={filterMucDo} onChange={setFilterMucDo}
          options={MUC_DO_TNLD} style={{ width: 200 }} />
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Báo cáo TNLĐ</Button>
      </Row>
      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          size="small" rowKey="id" loading={isLoading} dataSource={accidents}
          columns={[
            { title: 'Nhân viên', dataIndex: 'ho_ten', width: 200,
              render: (v: string, r: any) => <Space>
                <Avatar icon={<UserOutlined />} size="small" style={{ backgroundColor: '#cf1322' }} />
                <div><div>{v}</div><Text type="secondary" style={{ fontSize: 11 }}>{r.ma_nv} · {r.ten_bo_phan}</Text></div>
              </Space> },
            { title: 'Ngày', dataIndex: 'ngay_xay_ra', width: 100,
              render: (v: string, r: any) => <>{dayjs(v).format('DD/MM/YY')}{r.gio_xay_ra && <><br/><Text type="secondary" style={{ fontSize: 11 }}>{r.gio_xay_ra}</Text></>}</> },
            { title: 'Địa điểm', dataIndex: 'dia_diem', ellipsis: true },
            { title: 'Mức độ', dataIndex: 'muc_do', width: 110,
              render: (v: string) => { const m = MUC_DO_TNLD.find(o => o.value === v); return <Tag color={m?.color}>{m?.label}</Tag> } },
            { title: 'Nghỉ', dataIndex: 'so_ngay_nghi', width: 80, align: 'center' as const, render: (v: number) => `${v}d` },
            { title: 'Chi phí', dataIndex: 'chi_phi_y_te', width: 100, align: 'right' as const,
              render: (v: number) => v ? `${(v / 1000).toLocaleString('vi')}k` : '—' },
            { title: 'Báo Sở LĐ', dataIndex: 'da_bao_cao_so_lao_dong', width: 110, align: 'center' as const,
              render: (v: boolean, r: any) => v
                ? <Tag color="green">✓ Đã báo {r.ngay_bao_cao && `(${dayjs(r.ngay_bao_cao).format('DD/MM')})`}</Tag>
                : (r.muc_do !== 'nhe' ? <Tag color="red">⚠ Chưa báo</Tag> : <Tag>—</Tag>) },
            { title: '', width: 90, render: (_, r: any) => (
              <Space size={4}>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
                <Popconfirm title="Xóa báo cáo?" onConfirm={() => delMut.mutate(r.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            )},
          ]}
          pagination={{ pageSize: 15 }}
          expandable={{
            expandedRowRender: (r: any) => (
              <Card size="small">
                <Row gutter={[16, 8]}>
                  <Col span={12}><strong>Mô tả:</strong> {r.mo_ta}</Col>
                  <Col span={12}><strong>Nguyên nhân:</strong> {r.nguyen_nhan || '—'}</Col>
                  <Col span={6}><strong>BH chi trả:</strong> {r.bao_hiem_chi_tra ? `${(r.bao_hiem_chi_tra / 1000).toLocaleString('vi')}k` : '—'}</Col>
                  <Col span={18}>{r.file_bien_ban && <a href={r.file_bien_ban} target="_blank" rel="noreferrer">📎 Biên bản</a>}</Col>
                  {r.ghi_chu && <Col span={24}><strong>Ghi chú:</strong> {r.ghi_chu}</Col>}
                </Row>
              </Card>
            ),
          }}
        />
      </Card>

      <Modal
        open={open} title={editing ? 'Sửa báo cáo TNLĐ' : 'Báo cáo Tai nạn Lao động'}
        onCancel={() => { setOpen(false); setEditing(null); form.resetFields() }}
        onOk={() => form.submit()} confirmLoading={saveMut.isPending} width={720}
      >
        <Alert
          type="warning" showIcon
          message="Tai nạn lao động nặng/tử vong PHẢI báo Sở LĐ-TBXH trong vòng 24h"
          description="Theo Điều 39 Luật ATVSLĐ 2015 + TT 28/2021/TT-BLĐTBXH"
          style={{ marginBottom: 16 }}
        />
        <Form form={form} layout="vertical" onFinish={(v) => saveMut.mutate({
          ...v,
          ngay_xay_ra: v.ngay_xay_ra.format('YYYY-MM-DD'),
          ngay_bao_cao: v.ngay_bao_cao?.format('YYYY-MM-DD'),
        })}>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="employee_id" label="Nhân viên bị nạn" rules={[{ required: true }]}>
                <Select showSearch optionFilterProp="label" disabled={!!editing}
                  options={employees.map(e => ({ value: e.id, label: `${e.ma_nv} — ${e.ho_ten}` }))} />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="muc_do" label="Mức độ" rules={[{ required: true }]}>
                <Select options={MUC_DO_TNLD} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}><Form.Item name="ngay_xay_ra" label="Ngày xảy ra" rules={[{ required: true }]}><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="gio_xay_ra" label="Giờ"><Input placeholder="14:30" /></Form.Item></Col>
            <Col span={8}><Form.Item name="so_ngay_nghi" label="Số ngày nghỉ"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
          </Row>
          <Form.Item name="dia_diem" label="Địa điểm"><Input placeholder="VD: Khu vực máy bế #3, xưởng CĐ2" /></Form.Item>
          <Form.Item name="mo_ta" label="Mô tả sự việc" rules={[{ required: true, min: 5 }]}>
            <Input.TextArea rows={3} placeholder="Chi tiết về cách thức tai nạn xảy ra" />
          </Form.Item>
          <Form.Item name="nguyen_nhan" label="Nguyên nhân (phân tích)">
            <Input.TextArea rows={2} placeholder="Do thiết bị / con người / quy trình / môi trường" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="chi_phi_y_te" label="Chi phí y tế (VNĐ)"><InputNumber style={{ width: '100%' }} step={10000} min={0}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} /></Form.Item></Col>
            <Col span={12}><Form.Item name="bao_hiem_chi_tra" label="BH chi trả (VNĐ)"><InputNumber style={{ width: '100%' }} step={10000} min={0}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="da_bao_cao_so_lao_dong" label="Đã báo Sở LĐ-TBXH?" valuePropName="checked">
                <Select options={[{ value: true, label: '✓ Đã báo cáo' }, { value: false, label: 'Chưa' }]} />
              </Form.Item>
            </Col>
            <Col span={12}><Form.Item name="ngay_bao_cao" label="Ngày báo cáo"><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Form.Item name="file_bien_ban" label="Link file biên bản"><Input placeholder="https://..." /></Form.Item>
          <Form.Item name="ghi_chu" label="Ghi chú"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </>
  )
}
