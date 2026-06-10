/**
 * KPI / Đánh giá hiệu suất — Phase 1.4.
 *
 * 3 tab:
 * 1. Tổng quan — stats theo chu kỳ
 * 2. Templates — bộ tiêu chí mẫu theo vị trí
 * 3. Chu kỳ — quy/6 tháng/năm + sinh evaluations bulk
 * 4. Đánh giá — list + edit/submit/duyệt
 */
import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Avatar, Badge, Button, Card, Col, DatePicker, Form, Input, InputNumber,
  Modal, Row, Select, Space, Statistic, Table, Tabs, Tag, Typography, message,
  Popconfirm, Drawer, Empty, Progress, Tooltip,
} from 'antd'
import {
  AimOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  CheckCircleOutlined, UserOutlined, FileTextOutlined, TrophyOutlined,
  CalendarOutlined, RocketOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { hrApi } from '../../api/hr'

const { Title, Text } = Typography

const NHOM_TIEU_CHI = [
  { value: 'ket_qua',     label: '🎯 Kết quả công việc', color: 'blue' },
  { value: 'hanh_vi',     label: '🤝 Hành vi / Thái độ',  color: 'cyan' },
  { value: 'phat_trien',  label: '🚀 Phát triển bản thân', color: 'purple' },
]
const LOAI_CYCLE = [
  { value: 'quy',      label: '📅 Theo quý' },
  { value: '6_thang',  label: '📅 6 tháng' },
  { value: 'nam',      label: '📅 Cả năm' },
]
const TRANG_THAI_CYCLE = [
  { value: 'chuan_bi', label: '🔧 Chuẩn bị',   color: 'default' },
  { value: 'mo',       label: '🟢 Đang đánh giá', color: 'green' },
  { value: 'dong',     label: '🔒 Đã đóng',     color: 'red' },
]
const TRANG_THAI_EVAL: Record<string, { label: string; color: string }> = {
  chua_lam:       { label: 'Chưa làm',       color: 'default' },
  nv_dang_cham:   { label: 'NV đang chấm',   color: 'gold' },
  cho_ql:         { label: 'Chờ QL đánh giá', color: 'orange' },
  cho_duyet:      { label: 'Chờ HR/BGĐ duyệt', color: 'cyan' },
  hoan_tat:       { label: 'Hoàn tất',        color: 'green' },
}
const XEP_LOAI_COLOR: Record<string, string> = {
  A: '#52c41a', B: '#1677ff', C: '#fa8c16', D: '#fa541c', E: '#cf1322',
}

export default function KPIPage() {
  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <Title level={4} style={{ margin: 0 }}>
        <AimOutlined style={{ color: '#722ed1' }} /> KPI / Đánh giá hiệu suất
      </Title>
      <Text type="secondary">
        Quy trình: Template → Chu kỳ → Sinh đánh giá → NV tự chấm → QL chấm → HR/BGĐ duyệt
      </Text>
      <Tabs
        defaultActiveKey="overview"
        style={{ marginTop: 12 }}
        items={[
          { key: 'overview',     label: <span><ThunderboltOutlined /> Tổng quan</span>, children: <OverviewTab /> },
          { key: 'templates',    label: <span><FileTextOutlined /> Templates</span>,    children: <TemplatesTab /> },
          { key: 'cycles',       label: <span><CalendarOutlined /> Chu kỳ</span>,       children: <CyclesTab /> },
          { key: 'evaluations',  label: <span><CheckCircleOutlined /> Đánh giá</span>, children: <EvaluationsTab /> },
        ]}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// TAB 1: Tổng quan
// ═══════════════════════════════════════════════════════════════
function OverviewTab() {
  const [cycleId, setCycleId] = useState<number | undefined>()

  const { data: cycles = [] } = useQuery({
    queryKey: ['kpi-cycles'],
    queryFn: () => hrApi.kpiListCycles().then(r => r.data),
  })
  const { data: s } = useQuery({
    queryKey: ['kpi-summary', cycleId],
    queryFn: () => hrApi.kpiSummary({ cycle_id: cycleId }).then(r => r.data),
  })

  return (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Select
            placeholder="Chọn chu kỳ để xem (mặc định: tất cả)"
            allowClear value={cycleId} onChange={setCycleId}
            options={cycles.map((c: any) => ({ value: c.id, label: c.ten }))}
            style={{ width: '100%' }}
          />
        </Col>
      </Row>

      {s && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={12} md={6}>
              <Card size="small"><Statistic title="Tổng bản đánh giá" value={s.total} prefix={<UserOutlined />} /></Card>
            </Col>
            <Col xs={12} md={6}>
              <Card size="small"><Statistic title="Đã hoàn tất" value={s.by_status?.hoan_tat || 0} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} /></Card>
            </Col>
            <Col xs={12} md={6}>
              <Card size="small"><Statistic title="Chờ QL chấm" value={s.by_status?.cho_ql || 0} valueStyle={{ color: '#fa8c16' }} /></Card>
            </Col>
            <Col xs={12} md={6}>
              <Card size="small">
                <Statistic
                  title="Điểm TB toàn hệ thống" value={s.avg_score} precision={2} suffix="/ 10"
                  valueStyle={{ color: s.avg_score >= 8 ? '#52c41a' : s.avg_score >= 6 ? '#fa8c16' : '#cf1322' }}
                  prefix={<TrophyOutlined />}
                />
              </Card>
            </Col>
          </Row>

          <Card title="Phân bố xếp loại" size="small">
            {s.by_xep_loai.length === 0 ? <Empty description="Chưa có NV nào được duyệt" /> : (
              <Row gutter={[16, 8]}>
                {s.by_xep_loai.map((x: any) => (
                  <Col xs={24} md={5} key={x.name}>
                    <div style={{ textAlign: 'center', padding: '12px 8px', borderRadius: 6,
                                  background: `${XEP_LOAI_COLOR[x.name]}15`, border: `1px solid ${XEP_LOAI_COLOR[x.name]}40` }}>
                      <div style={{ fontSize: 32, fontWeight: 700, color: XEP_LOAI_COLOR[x.name] }}>{x.name}</div>
                      <div style={{ fontSize: 20, fontWeight: 600 }}>{x.value} NV</div>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {x.name === 'A' ? 'Rất tốt (≥9.0)'
                          : x.name === 'B' ? 'Tốt (7.5-8.9)'
                          : x.name === 'C' ? 'Trung bình (6.0-7.4)'
                          : x.name === 'D' ? 'Yếu (4.5-5.9)'
                          : 'Rất yếu (<4.5)'}
                      </Text>
                    </div>
                  </Col>
                ))}
              </Row>
            )}
          </Card>
        </>
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// TAB 2: Templates
// ═══════════════════════════════════════════════════════════════
function TemplatesTab() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['kpi-templates'],
    queryFn: () => hrApi.kpiListTemplates().then(r => r.data),
  })
  const { data: positions = [] } = useQuery({
    queryKey: ['hr-positions'],
    queryFn: () => hrApi.listPositions().then(r => r.data),
  })

  const saveMut = useMutation({
    mutationFn: (data: any) => editing?.id ? hrApi.kpiUpdateTemplate(editing.id, data) : hrApi.kpiCreateTemplate(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kpi-templates'] });
      message.success('Đã lưu template'); setOpen(false); setEditing(null); form.resetFields() },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })
  const delMut = useMutation({
    mutationFn: (id: number) => hrApi.kpiDeleteTemplate(id),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ['kpi-templates'] });
      message.success(r.data?.soft_deleted ? 'Đã ẩn (do đã có evaluation dùng template này)' : 'Đã xóa') },
  })

  const openCreate = () => {
    setEditing(null); form.resetFields()
    form.setFieldsValue({ trang_thai: true, criteria: [
      { ten: '', nhom: 'ket_qua', trong_so: 25, thang_diem_max: 10, thu_tu: 1 },
    ] })
    setOpen(true)
  }
  const openEdit = (r: any) => { setEditing(r); form.setFieldsValue(r); setOpen(true) }

  return (
    <>
      <Row justify="end" style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Tạo template</Button>
      </Row>
      <Row gutter={[16, 16]}>
        {templates.map((t: any) => (
          <Col xs={24} md={12} lg={8} key={t.id}>
            <Card size="small" title={<><Tag color="purple">Template</Tag>{t.ten}</>}
              extra={
                <Space size={4}>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(t)} />
                  <Popconfirm title="Xóa template?" onConfirm={() => delMut.mutate(t.id)}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              }>
              {t.mo_ta && <Text type="secondary" style={{ fontSize: 12 }}>{t.mo_ta}</Text>}
              <div style={{ margin: '8px 0' }}>
                <Tag color={t.tong_trong_so === 100 ? 'green' : 'red'}>
                  Tổng trọng số: {t.tong_trong_so}%
                </Tag>
                <Tag color="blue">{t.criteria.length} tiêu chí</Tag>
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {t.criteria.map((c: any, idx: number) => (
                  <div key={c.id} style={{ padding: '4px 0', borderBottom: '1px dashed #f0f0f0' }}>
                    <Text strong style={{ fontSize: 12 }}>{idx + 1}. {c.ten}</Text>
                    <div style={{ marginTop: 2 }}>
                      <Tag color={NHOM_TIEU_CHI.find(n => n.value === c.nhom)?.color}>
                        {NHOM_TIEU_CHI.find(n => n.value === c.nhom)?.label}
                      </Tag>
                      <Tag>Trọng số: {c.trong_so}%</Tag>
                      <Tag>Thang: {c.thang_diem_max}</Tag>
                    </div>
                    {c.muc_tieu && <Text type="secondary" style={{ fontSize: 11 }}>Mục tiêu: {c.muc_tieu}</Text>}
                  </div>
                ))}
              </div>
            </Card>
          </Col>
        ))}
        {templates.length === 0 && (
          <Col span={24}>
            <Card><Empty description="Chưa có template nào. Bấm 'Tạo template' để thêm." /></Card>
          </Col>
        )}
      </Row>

      <Modal
        open={open} title={editing ? 'Sửa template' : 'Tạo template KPI'}
        onCancel={() => { setOpen(false); setEditing(null); form.resetFields() }}
        onOk={() => form.submit()} confirmLoading={saveMut.isPending} width={900}
      >
        <Form form={form} layout="vertical" onFinish={(v) => saveMut.mutate(v)}>
          <Row gutter={12}>
            <Col span={14}><Form.Item name="ten" label="Tên template" rules={[{ required: true }]}>
              <Input placeholder="VD: NV Sale - Mục tiêu doanh số" /></Form.Item></Col>
            <Col span={10}><Form.Item name="chuc_vu_id" label="Áp dụng cho chức vụ">
              <Select allowClear showSearch optionFilterProp="label"
                options={positions.map((p: any) => ({ value: p.id, label: p.ten_chuc_vu }))} /></Form.Item></Col>
          </Row>
          <Form.Item name="mo_ta" label="Mô tả"><Input.TextArea rows={2} /></Form.Item>

          <Title level={5}>Tiêu chí đánh giá <Tag color="orange">Tổng trọng số phải = 100%</Tag></Title>
          <Form.List name="criteria">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => (
                  <Row key={key} gutter={8} style={{ marginBottom: 8 }} align="middle">
                    <Col span={1}>
                      <Form.Item {...rest} name={[name, 'thu_tu']} noStyle initialValue={name + 1}><InputNumber size="small" style={{ width: '100%' }} /></Form.Item>
                    </Col>
                    <Col span={6}><Form.Item {...rest} name={[name, 'ten']} rules={[{ required: true }]} noStyle><Input size="small" placeholder="Tên tiêu chí" /></Form.Item></Col>
                    <Col span={4}><Form.Item {...rest} name={[name, 'nhom']} noStyle initialValue="ket_qua"><Select size="small" options={NHOM_TIEU_CHI} /></Form.Item></Col>
                    <Col span={3}><Form.Item {...rest} name={[name, 'trong_so']} noStyle initialValue={0}>
                      <InputNumber size="small" min={0} max={100} step={5} addonAfter="%" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={3}><Form.Item {...rest} name={[name, 'thang_diem_max']} noStyle initialValue={10}>
                      <InputNumber size="small" min={1} max={100} addonBefore="/" style={{ width: '100%' }} /></Form.Item></Col>
                    <Col span={6}><Form.Item {...rest} name={[name, 'muc_tieu']} noStyle><Input size="small" placeholder="Mục tiêu (target)" /></Form.Item></Col>
                    <Col span={1}><Button size="small" danger icon={<DeleteOutlined />} onClick={() => remove(name)} /></Col>
                  </Row>
                ))}
                <Button size="small" icon={<PlusOutlined />} onClick={() => add({ thu_tu: fields.length + 1, nhom: 'ket_qua', trong_so: 0, thang_diem_max: 10 })}>
                  Thêm tiêu chí
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// TAB 3: Cycles
// ═══════════════════════════════════════════════════════════════
function CyclesTab() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [genOpen, setGenOpen] = useState<any>(null)
  const [form] = Form.useForm()
  const [genForm] = Form.useForm()

  const { data: cycles = [], isLoading } = useQuery({
    queryKey: ['kpi-cycles'],
    queryFn: () => hrApi.kpiListCycles().then(r => r.data),
  })
  const { data: templates = [] } = useQuery({
    queryKey: ['kpi-templates'],
    queryFn: () => hrApi.kpiListTemplates().then(r => r.data),
  })
  const { data: depts = [] } = useQuery({
    queryKey: ['hr-depts'],
    queryFn: () => hrApi.listDepartments().then(r => r.data),
  })

  const saveMut = useMutation({
    mutationFn: (d: any) => editing?.id ? hrApi.kpiUpdateCycle(editing.id, d) : hrApi.kpiCreateCycle(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kpi-cycles'] });
      message.success('Đã lưu'); setOpen(false); setEditing(null); form.resetFields() },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })
  const delMut = useMutation({
    mutationFn: (id: number) => hrApi.kpiDeleteCycle(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kpi-cycles'] }); message.success('Đã xóa') },
  })
  const generateMut = useMutation({
    mutationFn: (data: any) => hrApi.kpiGenerateEvaluations(data),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ['kpi-evaluations'] });
      message.success(`Đã sinh ${r.data?.created} đánh giá, skip ${r.data?.skipped} (đã có)`); setGenOpen(null); genForm.resetFields() },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })

  const openCreate = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ loai: 'quy', trang_thai: 'chuan_bi', ty_le_nv: 30, ty_le_ql: 70 }); setOpen(true) }
  const openEdit = (r: any) => {
    setEditing(r); form.setFieldsValue({
      ...r,
      ngay_bat_dau: dayjs(r.ngay_bat_dau), ngay_ket_thuc: dayjs(r.ngay_ket_thuc),
      han_nv_tu_danh_gia: r.han_nv_tu_danh_gia ? dayjs(r.han_nv_tu_danh_gia) : undefined,
      han_ql_danh_gia: r.han_ql_danh_gia ? dayjs(r.han_ql_danh_gia) : undefined,
    }); setOpen(true)
  }
  const onSubmit = (v: any) => saveMut.mutate({
    ...v,
    ngay_bat_dau: v.ngay_bat_dau.format('YYYY-MM-DD'),
    ngay_ket_thuc: v.ngay_ket_thuc.format('YYYY-MM-DD'),
    han_nv_tu_danh_gia: v.han_nv_tu_danh_gia?.format('YYYY-MM-DD'),
    han_ql_danh_gia: v.han_ql_danh_gia?.format('YYYY-MM-DD'),
  })

  return (
    <>
      <Row justify="end" style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Tạo chu kỳ</Button>
      </Row>
      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          size="small" rowKey="id" loading={isLoading} dataSource={cycles}
          columns={[
            { title: 'Tên chu kỳ', dataIndex: 'ten', render: (v: string) => <strong>{v}</strong> },
            { title: 'Loại', dataIndex: 'loai', width: 110,
              render: (v: string) => LOAI_CYCLE.find(o => o.value === v)?.label },
            { title: 'Thời gian', width: 180,
              render: (_, r: any) => `${dayjs(r.ngay_bat_dau).format('DD/MM/YY')} → ${dayjs(r.ngay_ket_thuc).format('DD/MM/YY')}` },
            { title: 'Tỷ lệ NV/QL', width: 110, align: 'center' as const,
              render: (_, r: any) => `${r.ty_le_nv}% / ${r.ty_le_ql}%` },
            { title: 'Đánh giá', dataIndex: 'so_evaluation', width: 100, align: 'center' as const,
              render: (v: number) => <Badge count={v} showZero color="#1677ff" /> },
            { title: 'Trạng thái', dataIndex: 'trang_thai', width: 140,
              render: (v: string) => {
                const m = TRANG_THAI_CYCLE.find(t => t.value === v)
                return <Tag color={m?.color}>{m?.label || v}</Tag>
              }},
            { title: '', width: 180, render: (_, r: any) => (
              <Space size={4}>
                <Tooltip title="Sinh đánh giá hàng loạt cho NV">
                  <Button size="small" icon={<RocketOutlined />} onClick={() => { setGenOpen(r); genForm.resetFields(); genForm.setFieldsValue({ cycle_id: r.id }) }}>
                    Sinh
                  </Button>
                </Tooltip>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
                <Popconfirm title="Xóa chu kỳ? (xóa cả evaluations bên trong)" onConfirm={() => delMut.mutate(r.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            )},
          ]}
          pagination={false}
        />
      </Card>

      <Modal
        open={open} title={editing ? 'Sửa chu kỳ' : 'Tạo chu kỳ KPI'}
        onCancel={() => { setOpen(false); setEditing(null); form.resetFields() }}
        onOk={() => form.submit()} confirmLoading={saveMut.isPending} width={680}
      >
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Row gutter={12}>
            <Col span={14}><Form.Item name="ten" label="Tên chu kỳ" rules={[{ required: true }]}>
              <Input placeholder="VD: Q3/2026" /></Form.Item></Col>
            <Col span={10}><Form.Item name="loai" label="Loại" rules={[{ required: true }]}>
              <Select options={LOAI_CYCLE} /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="ngay_bat_dau" label="Ngày bắt đầu" rules={[{ required: true }]}><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="ngay_ket_thuc" label="Ngày kết thúc" rules={[{ required: true }]}><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="han_nv_tu_danh_gia" label="Hạn NV tự đánh giá"><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="han_ql_danh_gia" label="Hạn QL đánh giá"><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}><Form.Item name="ty_le_nv" label="Tỷ lệ NV (%)" rules={[{ required: true }]}><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="ty_le_ql" label="Tỷ lệ QL (%)" rules={[{ required: true }]}><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="trang_thai" label="Trạng thái">
              <Select options={TRANG_THAI_CYCLE.map(t => ({ value: t.value, label: t.label }))} /></Form.Item></Col>
          </Row>
          <Form.Item name="ghi_chu" label="Ghi chú"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal
        open={!!genOpen} title={`Sinh bản đánh giá cho chu kỳ: ${genOpen?.ten}`}
        onCancel={() => { setGenOpen(null); genForm.resetFields() }}
        onOk={() => genForm.submit()} confirmLoading={generateMut.isPending}
      >
        <Alert
          message="Sinh hàng loạt — sẽ tạo 1 đánh giá cho mỗi NV đang làm việc thuộc các bộ phận chỉ định."
          description="Skip các NV đã có đánh giá trong chu kỳ này. Mỗi NV được gán template theo chức vụ hoặc template mặc định."
          type="info" showIcon style={{ marginBottom: 16 }}
        />
        <Form form={genForm} layout="vertical" onFinish={(v) => generateMut.mutate(v)}>
          <Form.Item name="cycle_id" hidden><Input /></Form.Item>
          <Form.Item name="bo_phan_ids" label="Bộ phận (để trống = tất cả)">
            <Select mode="multiple" allowClear placeholder="Chọn các bộ phận"
              options={depts.map((d: any) => ({ value: d.id, label: d.ten_bo_phan }))} />
          </Form.Item>
          <Form.Item name="template_id" label="Template mặc định (nếu NV không match chức vụ)">
            <Select allowClear placeholder="Không bắt buộc — sẽ tự pick theo chức vụ NV"
              options={templates.filter((t: any) => t.trang_thai).map((t: any) => ({ value: t.id, label: t.ten }))} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// TAB 4: Evaluations
// ═══════════════════════════════════════════════════════════════
function EvaluationsTab() {
  const qc = useQueryClient()
  const [filterCycle, setFilterCycle] = useState<number | undefined>()
  const [filterStatus, setFilterStatus] = useState<string | undefined>()
  const [drawerId, setDrawerId] = useState<number | null>(null)

  const { data: cycles = [] } = useQuery({
    queryKey: ['kpi-cycles'],
    queryFn: () => hrApi.kpiListCycles().then(r => r.data),
  })
  const { data: evals = [], isLoading } = useQuery({
    queryKey: ['kpi-evaluations', filterCycle, filterStatus],
    queryFn: () => hrApi.kpiListEvaluations({ cycle_id: filterCycle, trang_thai: filterStatus }).then(r => r.data),
  })

  return (
    <>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={12} align="middle">
          <Col xs={24} md={8}>
            <Select placeholder="Lọc theo chu kỳ" allowClear value={filterCycle} onChange={setFilterCycle}
              style={{ width: '100%' }}
              options={cycles.map((c: any) => ({ value: c.id, label: c.ten }))} />
          </Col>
          <Col xs={24} md={8}>
            <Select placeholder="Lọc theo trạng thái" allowClear value={filterStatus} onChange={setFilterStatus}
              style={{ width: '100%' }}
              options={Object.entries(TRANG_THAI_EVAL).map(([k, v]) => ({ value: k, label: v.label }))} />
          </Col>
          <Col xs={24} md={8}>
            <Text type="secondary">Hiển thị <strong>{evals.length}</strong> bản đánh giá</Text>
          </Col>
        </Row>
      </Card>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          size="small" rowKey="id" loading={isLoading} dataSource={evals}
          columns={[
            { title: 'Nhân viên', dataIndex: 'ho_ten', render: (v: string, r: any) => (
              <Space>
                <Avatar icon={<UserOutlined />} size="small" style={{ backgroundColor: '#722ed1' }}>{(v || '?').charAt(0)}</Avatar>
                <div><div><a onClick={() => setDrawerId(r.id)}>{v}</a></div>
                  <Text type="secondary" style={{ fontSize: 11 }}>{r.ma_nv} · {r.ten_bo_phan}</Text></div>
              </Space>
            )},
            { title: 'Chu kỳ', dataIndex: 'ten_chu_ky', width: 130 },
            { title: 'Quản lý', dataIndex: 'ten_quan_ly', width: 150,
              render: (v: string) => v || <Text type="secondary">— chưa gán —</Text> },
            { title: 'Điểm NV', dataIndex: 'diem_nv_tu_cham', width: 90, align: 'center' as const,
              render: (v: number) => v != null ? <Text strong>{v.toFixed(2)}</Text> : '—' },
            { title: 'Điểm QL', dataIndex: 'diem_quan_ly', width: 90, align: 'center' as const,
              render: (v: number) => v != null ? <Text strong>{v.toFixed(2)}</Text> : '—' },
            { title: 'Điểm cuối', dataIndex: 'diem_cuoi_cung', width: 110, align: 'center' as const,
              render: (v: number, r: any) => v != null ? (
                <>
                  <Text strong style={{ color: XEP_LOAI_COLOR[r.xep_loai] || '#000', fontSize: 16 }}>{v.toFixed(2)}</Text>
                  {r.xep_loai && <Tag style={{ marginLeft: 4, fontWeight: 700, color: XEP_LOAI_COLOR[r.xep_loai] }}>{r.xep_loai}</Tag>}
                </>
              ) : '—' },
            { title: 'Trạng thái', dataIndex: 'trang_thai', width: 160,
              render: (v: string) => { const m = TRANG_THAI_EVAL[v]; return <Tag color={m?.color}>{m?.label || v}</Tag> }},
          ]}
          pagination={{ pageSize: 30 }}
        />
      </Card>

      <EvaluationDrawer evaluationId={drawerId} onClose={() => setDrawerId(null)} />
    </>
  )
}

function EvaluationDrawer({ evaluationId, onClose }: { evaluationId: number | null; onClose: () => void }) {
  const qc = useQueryClient()
  const open = !!evaluationId
  const [byRole, setByRole] = useState<'nv' | 'ql'>('nv')

  const { data: ev, isLoading } = useQuery({
    queryKey: ['kpi-evaluation', evaluationId],
    queryFn: () => evaluationId ? hrApi.kpiGetEvaluation(evaluationId).then(r => r.data) : Promise.resolve(null),
    enabled: !!evaluationId,
  })
  const { data: employees = [] } = useQuery({
    queryKey: ['hr-employees-org'],
    queryFn: () => hrApi.listEmployees().then(r => r.data),
  })

  const [scoreEdits, setScoreEdits] = useState<Record<number, any>>({})
  const [nhanXetNv, setNhanXetNv] = useState('')
  const [nhanXetQl, setNhanXetQl] = useState('')
  const [quanLyId, setQuanLyId] = useState<number | undefined>()

  // Reset state when load new evaluation
  useMemo(() => {
    if (ev) {
      setScoreEdits({})
      setNhanXetNv(ev.nhan_xet_nv || '')
      setNhanXetQl(ev.nhan_xet_ql || '')
      setQuanLyId(ev.quan_ly_id || undefined)
    }
  }, [ev?.id])

  const submitMut = useMutation({
    mutationFn: (body: any) => hrApi.kpiSubmitEvaluation(evaluationId!, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kpi-evaluation', evaluationId] });
      qc.invalidateQueries({ queryKey: ['kpi-evaluations'] }); message.success('Đã lưu') },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })
  const approveMut = useMutation({
    mutationFn: () => hrApi.kpiApproveEvaluation(evaluationId!, ev?.nhan_xet_bgd || undefined),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kpi-evaluation', evaluationId] });
      qc.invalidateQueries({ queryKey: ['kpi-evaluations'] }); message.success('Đã duyệt + tính điểm cuối') },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })

  const onSubmit = () => {
    const scores = Object.entries(scoreEdits).map(([sid, vals]: any) => ({ score_id: Number(sid), ...vals }))
    const payload: any = { by_role: byRole, scores }
    if (byRole === 'nv') {
      payload.nhan_xet_nv = nhanXetNv
      payload.quan_ly_id = quanLyId
    } else {
      payload.nhan_xet_ql = nhanXetQl
    }
    submitMut.mutate(payload)
  }

  return (
    <Drawer open={open} onClose={onClose} width={920}
      title={ev ? `${ev.ho_ten} (${ev.ma_nv})` : 'Loading…'}
      extra={ev && (
        <Space>
          <Tag color="purple">{ev.ten_chu_ky}</Tag>
          <Tag color={TRANG_THAI_EVAL[ev.trang_thai]?.color}>{TRANG_THAI_EVAL[ev.trang_thai]?.label}</Tag>
          {ev.diem_cuoi_cung != null && (
            <Tag style={{ fontWeight: 700, color: XEP_LOAI_COLOR[ev.xep_loai] || '#000', fontSize: 14 }}>
              {ev.diem_cuoi_cung.toFixed(2)} ({ev.xep_loai})
            </Tag>
          )}
        </Space>
      )}
    >
      {isLoading ? <Card loading /> : ev && (
        <>
          <Card size="small" style={{ marginBottom: 12 }}>
            <Row gutter={[12, 8]}>
              <Col span={12}><strong>Bộ phận:</strong> {ev.ten_bo_phan || '—'}</Col>
              <Col span={12}><strong>Chức vụ:</strong> {ev.ten_chuc_vu || '—'}</Col>
              <Col span={12}><strong>Template:</strong> {ev.ten_template || '—'}</Col>
              <Col span={12}><strong>Quản lý:</strong> {ev.ten_quan_ly || <Text type="warning">⚠ Chưa gán</Text>}</Col>
            </Row>
          </Card>

          {ev.trang_thai !== 'hoan_tat' && (
            <Card size="small" style={{ marginBottom: 12 }}
              title={<>Chế độ chấm <Select size="small" value={byRole} onChange={setByRole} style={{ width: 140 }}
                options={[{ value: 'nv', label: '👤 NV tự chấm' }, { value: 'ql', label: '👔 QL chấm' }]} /></>}
            >
              {byRole === 'nv' && !ev.quan_ly_id && (
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary">Chọn quản lý trực tiếp của bạn:</Text>
                  <Select size="small" showSearch optionFilterProp="label" style={{ width: 300, marginLeft: 8 }}
                    placeholder="Chọn NV làm quản lý" value={quanLyId} onChange={setQuanLyId}
                    options={employees.map(e => ({ value: e.id, label: `${e.ma_nv} — ${e.ho_ten}` }))} />
                </div>
              )}
            </Card>
          )}

          <Title level={5}>Bảng tiêu chí</Title>
          <Table
            size="small" rowKey="id" dataSource={ev.scores} pagination={false}
            columns={[
              { title: '#', width: 40, render: (_, __, i) => i + 1 },
              { title: 'Tiêu chí', dataIndex: 'ten_tieu_chi',
                render: (v: string, r: any) => <>
                  <div>{v}</div>
                  <Space size={4} style={{ marginTop: 4 }}>
                    <Tag color={NHOM_TIEU_CHI.find(n => n.value === r.nhom)?.color}>
                      {NHOM_TIEU_CHI.find(n => n.value === r.nhom)?.label}
                    </Tag>
                    <Tag>Trọng số: {r.trong_so}%</Tag>
                  </Space>
                </> },
              { title: <>Điểm NV<br/><Text type="secondary" style={{ fontSize: 11 }}>tự chấm</Text></>, width: 120,
                render: (_, r: any) => (
                  <InputNumber size="small" min={0} max={r.thang_diem_max} step={0.5}
                    disabled={byRole !== 'nv' || ev.trang_thai === 'hoan_tat'}
                    value={scoreEdits[r.id]?.diem_nv ?? r.diem_nv}
                    onChange={(v) => setScoreEdits(prev => ({ ...prev, [r.id]: { ...prev[r.id], diem_nv: v } }))}
                    addonAfter={`/${r.thang_diem_max}`}
                  />
                ) },
              { title: <>Điểm QL<br/><Text type="secondary" style={{ fontSize: 11 }}>quản lý chấm</Text></>, width: 120,
                render: (_, r: any) => (
                  <InputNumber size="small" min={0} max={r.thang_diem_max} step={0.5}
                    disabled={byRole !== 'ql' || ev.trang_thai === 'hoan_tat'}
                    value={scoreEdits[r.id]?.diem_ql ?? r.diem_ql}
                    onChange={(v) => setScoreEdits(prev => ({ ...prev, [r.id]: { ...prev[r.id], diem_ql: v } }))}
                    addonAfter={`/${r.thang_diem_max}`}
                  />
                ) },
              { title: 'Ghi chú', render: (_, r: any) => (
                <Input.TextArea size="small" rows={1}
                  placeholder={byRole === 'nv' ? 'Ghi chú NV' : 'Ghi chú QL'}
                  disabled={ev.trang_thai === 'hoan_tat'}
                  defaultValue={byRole === 'nv' ? r.ghi_chu_nv : r.ghi_chu_ql}
                  onBlur={(e) => {
                    const v = e.target.value
                    setScoreEdits(prev => ({ ...prev, [r.id]: { ...prev[r.id], [byRole === 'nv' ? 'ghi_chu_nv' : 'ghi_chu_ql']: v } }))
                  }}
                />
              )},
            ]}
          />

          <Title level={5} style={{ marginTop: 16 }}>Nhận xét chung</Title>
          {byRole === 'nv' ? (
            <Input.TextArea rows={3} placeholder="Nhận xét của NV về bản thân" value={nhanXetNv} onChange={(e) => setNhanXetNv(e.target.value)}
              disabled={ev.trang_thai === 'hoan_tat'} />
          ) : (
            <Input.TextArea rows={3} placeholder="Nhận xét của QL" value={nhanXetQl} onChange={(e) => setNhanXetQl(e.target.value)}
              disabled={ev.trang_thai === 'hoan_tat'} />
          )}

          {ev.nhan_xet_bgd && (
            <Card size="small" style={{ marginTop: 12 }} title="Nhận xét BGĐ">
              {ev.nhan_xet_bgd}
            </Card>
          )}

          {ev.trang_thai === 'hoan_tat' ? (
            <Alert
              style={{ marginTop: 16 }} type="success" showIcon icon={<TrophyOutlined />}
              message={<>Đánh giá đã hoàn tất — Điểm: <strong>{ev.diem_cuoi_cung?.toFixed(2)}</strong> · Xếp loại: <strong style={{ color: XEP_LOAI_COLOR[ev.xep_loai] }}>{ev.xep_loai}</strong></>}
            />
          ) : (
            <Space style={{ marginTop: 16, width: '100%', justifyContent: 'flex-end' }}>
              {ev.trang_thai === 'cho_duyet' && (
                <Popconfirm title="Duyệt + tính điểm cuối + xếp loại?" onConfirm={() => approveMut.mutate()}>
                  <Button type="primary" icon={<CheckCircleOutlined />} loading={approveMut.isPending}>HR/BGĐ Duyệt</Button>
                </Popconfirm>
              )}
              <Button type="primary" onClick={onSubmit} loading={submitMut.isPending}>
                Lưu chấm ({byRole === 'nv' ? 'NV' : 'QL'})
              </Button>
            </Space>
          )}
        </>
      )}
    </Drawer>
  )
}
