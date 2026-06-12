/**
 * Khám sức khỏe định kỳ — Phase 1.2.
 *
 * Quy định: Thông tư 14/2013/TT-BYT
 *  - NV thường: 1 lần/năm
 *  - NV nặng nhọc/độc hại: 6 tháng/lần
 *  - Phân loại sức khỏe: I (rất tốt) → V (rất yếu)
 *
 * Bố cục:
 * - Hàng KPI: tổng NV / đã khám / chưa khám / sắp đến hạn / quá hạn
 * - Bộ lọc: Bộ phận / Phân loại / Khoảng ngày khám
 * - Bảng danh sách lần khám
 * - Modal thêm/sửa
 */
import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Avatar, Badge, Button, Card, Col, DatePicker, Form, Input, InputNumber,
  Modal, Row, Select, Space, Statistic, Table, Tag, Tooltip, Typography, message,
  Popconfirm,
} from 'antd'
import {
  MedicineBoxOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  WarningOutlined, CheckCircleOutlined, ClockCircleOutlined, UserOutlined,
  FileTextOutlined, DownloadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { hrApi, type HealthCheckRecord, type Employee } from '../../api/hr'

const { Title, Text } = Typography

const LOAI_KHAM_OPTIONS = [
  { value: 'dinh_ky',           label: '🩺 Định kỳ' },
  { value: 'dot_xuat',          label: '🚨 Đột xuất' },
  { value: 'truoc_tuyen_dung',  label: '📋 Trước tuyển dụng' },
  { value: 'sau_om_dau',        label: '🤒 Sau ốm đau' },
]
const PHAN_LOAI_OPTIONS = [
  { value: 'I',   label: 'I — Rất tốt',     color: 'green' },
  { value: 'II',  label: 'II — Tốt',         color: 'cyan' },
  { value: 'III', label: 'III — Trung bình', color: 'gold' },
  { value: 'IV',  label: 'IV — Yếu',         color: 'orange' },
  { value: 'V',   label: 'V — Rất yếu',      color: 'red' },
]

const PHAN_LOAI_META: Record<string, { color: string; label: string }> = {
  I:   { color: 'green',  label: 'I — Rất tốt' },
  II:  { color: 'cyan',   label: 'II — Tốt' },
  III: { color: 'gold',   label: 'III — Trung bình' },
  IV:  { color: 'orange', label: 'IV — Yếu' },
  V:   { color: 'red',    label: 'V — Rất yếu' },
}

export default function HealthCheckPage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<HealthCheckRecord | null>(null)
  const [filterPhanLoai, setFilterPhanLoai] = useState<string | undefined>()
  const [filterDept, setFilterDept] = useState<number | undefined>()
  const [filterDueSoon, setFilterDueSoon] = useState<number | undefined>()
  const [showOverdueOnly, setShowOverdueOnly] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  // URL param từ Dashboard: ?filter=overdue
  useEffect(() => {
    if (searchParams.get('filter') === 'overdue') {
      setShowOverdueOnly(true)
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  const [form] = Form.useForm()

  // Queries
  const { data: records = [], isLoading } = useQuery({
    queryKey: ['hr-health-checks', filterPhanLoai, filterDueSoon],
    queryFn: () => hrApi.listHealthChecks({
      phan_loai: filterPhanLoai,
      due_soon_days: filterDueSoon,
    }).then(r => r.data),
  })

  const { data: summary } = useQuery({
    queryKey: ['hr-health-checks-summary'],
    queryFn: () => hrApi.healthCheckSummary().then(r => r.data),
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['hr-employees-for-health'],
    queryFn: () => hrApi.listEmployees().then(r => r.data),
  })

  const { data: depts = [] } = useQuery({
    queryKey: ['hr-depts'],
    queryFn: () => hrApi.listDepartments().then(r => r.data),
  })

  // Mutations
  const saveMut = useMutation({
    mutationFn: (data: Partial<HealthCheckRecord>) =>
      editing?.id ? hrApi.updateHealthCheck(editing.id, data) : hrApi.createHealthCheck(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-health-checks'] })
      qc.invalidateQueries({ queryKey: ['hr-health-checks-summary'] })
      message.success('Đã lưu lần khám')
      setOpen(false)
      setEditing(null)
      form.resetFields()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi lưu'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => hrApi.deleteHealthCheck(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-health-checks'] })
      qc.invalidateQueries({ queryKey: ['hr-health-checks-summary'] })
      message.success('Đã xóa')
    },
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      ngay_kham: dayjs(),
      loai_kham: 'dinh_ky',
    })
    setOpen(true)
  }

  const openEdit = (r: HealthCheckRecord) => {
    setEditing(r)
    form.setFieldsValue({
      ...r,
      ngay_kham: r.ngay_kham ? dayjs(r.ngay_kham) : undefined,
      ngay_kham_tiep_theo: r.ngay_kham_tiep_theo ? dayjs(r.ngay_kham_tiep_theo) : undefined,
    })
    setOpen(true)
  }

  const onSubmit = (values: any) => {
    const data = {
      ...values,
      ngay_kham: values.ngay_kham ? values.ngay_kham.format('YYYY-MM-DD') : undefined,
      ngay_kham_tiep_theo: values.ngay_kham_tiep_theo ? values.ngay_kham_tiep_theo.format('YYYY-MM-DD') : undefined,
    }
    saveMut.mutate(data)
  }

  // Filter theo bộ phận ở client
  const filteredRecords = useMemo(() => {
    const today = dayjs()
    return records.filter(r => {
      if (filterDept) {
        const emp = employees.find(e => e.id === r.employee_id)
        if (emp?.bo_phan_id !== filterDept) return false
      }
      if (showOverdueOnly) {
        if (!r.ngay_kham_tiep_theo) return false
        if (dayjs(r.ngay_kham_tiep_theo).isBefore(today, 'day') === false) return false
      }
      return true
    })
  }, [records, filterDept, employees, showOverdueOnly])

  const today = dayjs()
  const columns = [
    {
      title: 'Nhân viên',
      dataIndex: 'ho_ten',
      render: (v: string, r: HealthCheckRecord) => (
        <Space>
          <Avatar icon={<UserOutlined />} size="small" style={{ backgroundColor: '#1677ff' }} />
          <div>
            <div style={{ fontWeight: 500 }}>{v}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>{r.ma_nv} · {r.ten_bo_phan || '—'}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Ngày khám',
      dataIndex: 'ngay_kham',
      width: 110,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
      sorter: (a: HealthCheckRecord, b: HealthCheckRecord) =>
        dayjs(a.ngay_kham).valueOf() - dayjs(b.ngay_kham).valueOf(),
    },
    {
      title: 'Loại',
      dataIndex: 'loai_kham',
      width: 130,
      render: (v: string) => LOAI_KHAM_OPTIONS.find(o => o.value === v)?.label || v,
    },
    {
      title: 'Phân loại',
      dataIndex: 'phan_loai_suc_khoe',
      width: 130,
      render: (v: string | null) => {
        if (!v) return <Text type="secondary">—</Text>
        const m = PHAN_LOAI_META[v]
        return m ? <Tag color={m.color}>{m.label}</Tag> : <Tag>{v}</Tag>
      },
    },
    {
      title: 'Nơi khám',
      dataIndex: 'noi_kham',
      width: 180,
      ellipsis: true,
      render: (v: string) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Khám tiếp theo',
      dataIndex: 'ngay_kham_tiep_theo',
      width: 140,
      render: (v: string) => {
        if (!v) return <Text type="secondary">—</Text>
        const d = dayjs(v)
        const diff = d.diff(today, 'day')
        if (diff < 0) return <Tag color="red"><ClockCircleOutlined /> Quá hạn {Math.abs(diff)}d</Tag>
        if (diff <= 30) return <Tag color="orange"><WarningOutlined /> {d.format('DD/MM/YYYY')} ({diff}d)</Tag>
        if (diff <= 60) return <Tag color="gold">{d.format('DD/MM/YYYY')} ({diff}d)</Tag>
        return <Text>{d.format('DD/MM/YYYY')}</Text>
      },
      sorter: (a: HealthCheckRecord, b: HealthCheckRecord) =>
        dayjs(a.ngay_kham_tiep_theo || '9999').valueOf() - dayjs(b.ngay_kham_tiep_theo || '9999').valueOf(),
    },
    {
      title: 'Chi phí',
      dataIndex: 'chi_phi',
      width: 100,
      align: 'right' as const,
      render: (v: number) => v ? `${(v / 1000).toLocaleString('vi')}k` : '—',
    },
    {
      title: '',
      width: 100,
      render: (_: any, r: HealthCheckRecord) => (
        <Space size={4}>
          {r.file_url && (
            <Tooltip title="Tải file kết quả">
              <Button size="small" icon={<DownloadOutlined />} type="link"
                href={r.file_url} target="_blank" />
            </Tooltip>
          )}
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xóa lần khám?" onConfirm={() => deleteMut.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            <MedicineBoxOutlined style={{ color: '#13c2c2' }} /> Khám sức khỏe định kỳ
          </Title>
          <Text type="secondary">
            Theo Thông tư 14/2013/TT-BYT — NV thường: 1 lần/năm · NV nặng nhọc/độc hại: 6 tháng/lần
          </Text>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm lần khám
          </Button>
        </Col>
      </Row>

      {/* Stats */}
      {summary && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic
                title="Tổng NV đang làm"
                value={summary.total_nv}
                prefix={<UserOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" style={{ borderColor: '#b7eb8f' }}>
              <Statistic
                title="Đã khám"
                value={summary.nv_da_kham}
                suffix={`/ ${summary.total_nv}`}
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" style={{ borderColor: '#ffd591', cursor: 'pointer' }}
              onClick={() => setFilterDueSoon(filterDueSoon === 60 ? undefined : 60)}>
              <Statistic
                title="Sắp đến hạn (60 ngày)"
                value={summary.due_60}
                valueStyle={{ color: '#fa8c16' }}
                prefix={<WarningOutlined />}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>Click để lọc</Text>
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" style={{ borderColor: '#ffccc7' }}>
              <Statistic
                title="Quá hạn"
                value={summary.overdue}
                valueStyle={{ color: '#cf1322' }}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Alert nếu có NV chưa khám */}
      {summary && summary.nv_chua_kham > 0 && (
        <Alert
          type="warning" showIcon icon={<WarningOutlined />}
          message={`Có ${summary.nv_chua_kham} nhân viên chưa từng được khám sức khỏe.`}
          description="Theo luật, mọi NV phải được khám tối thiểu 1 lần/năm. Liên hệ đơn vị y tế để lập kế hoạch khám tập thể."
          style={{ marginBottom: 16 }}
          closable
        />
      )}

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[12, 8]} align="middle">
          <Col xs={24} md={6}>
            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>🏢 Bộ phận</Text>
            <Select
              size="middle" allowClear placeholder="Tất cả bộ phận"
              value={filterDept} onChange={setFilterDept}
              style={{ width: '100%' }} showSearch optionFilterProp="label"
              options={depts.map((d: any) => ({ value: d.id, label: d.ten_bo_phan }))}
            />
          </Col>
          <Col xs={24} md={6}>
            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>🩺 Phân loại sức khỏe</Text>
            <Select
              size="middle" allowClear placeholder="Tất cả phân loại"
              value={filterPhanLoai} onChange={setFilterPhanLoai}
              style={{ width: '100%' }}
              options={PHAN_LOAI_OPTIONS}
            />
          </Col>
          <Col xs={24} md={6}>
            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>⏰ Sắp đến hạn</Text>
            <Select
              size="middle" allowClear placeholder="Bất kỳ ngày khám tiếp"
              value={filterDueSoon} onChange={setFilterDueSoon}
              style={{ width: '100%' }}
              options={[
                { value: 30,  label: 'Trong 30 ngày tới' },
                { value: 60,  label: 'Trong 60 ngày tới' },
                { value: 90,  label: 'Trong 90 ngày tới' },
              ]}
            />
          </Col>
          <Col xs={24} md={6}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              Hiển thị <strong>{filteredRecords.length}</strong> / {records.length} lần khám
            </Text>
          </Col>
        </Row>
      </Card>

      {showOverdueOnly && (
        <Alert
          type="info" showIcon style={{ marginBottom: 12 }}
          message={<Space>
            <span>Đang lọc: <strong>Chỉ hiển thị các lần khám đã quá hạn khám tiếp theo</strong></span>
            <Button size="small" type="link" onClick={() => {
              setShowOverdueOnly(false)
              setSearchParams({})
            }}>✕ Bỏ lọc</Button>
          </Space>}
        />
      )}

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={filteredRecords}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `Tổng ${t} lần khám` }}
        />
      </Card>

      <Modal
        open={open}
        title={editing ? `Sửa lần khám: ${editing.ho_ten}` : 'Thêm lần khám sức khỏe'}
        onCancel={() => { setOpen(false); setEditing(null); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={saveMut.isPending}
        okText="Lưu"
        cancelText="Hủy"
        width={680}
      >
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="employee_id" label="Nhân viên" rules={[{ required: true }]}>
                <Select
                  showSearch optionFilterProp="label" disabled={!!editing}
                  options={employees.map(e => ({ value: e.id, label: `${e.ma_nv} — ${e.ho_ten}` }))}
                  placeholder="Chọn nhân viên"
                />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="loai_kham" label="Loại khám" rules={[{ required: true }]}>
                <Select options={LOAI_KHAM_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="ngay_kham" label="Ngày khám" rules={[{ required: true }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="phan_loai_suc_khoe" label="Phân loại sức khỏe">
                <Select allowClear options={PHAN_LOAI_OPTIONS} placeholder="I-V" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="ngay_kham_tiep_theo" label="Khám tiếp theo (auto 12 tháng)">
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="noi_kham" label="Nơi khám">
                <Input placeholder="VD: BV Đa khoa Hóc Môn" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="bac_si" label="Bác sĩ khám">
                <Input placeholder="VD: BS. Nguyễn Văn A" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="ket_luan" label="Kết luận">
            <Input.TextArea rows={2} placeholder="Kết luận tổng thể về tình trạng sức khỏe" />
          </Form.Item>
          <Form.Item name="benh_man_tinh" label="Bệnh mãn tính (nếu có)">
            <Input.TextArea rows={2} placeholder="VD: Tăng huyết áp, tiểu đường…" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="chi_phi" label="Chi phí (VNĐ)">
                <InputNumber style={{ width: '100%' }} step={10000} min={0}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="file_url" label="Link file kết quả (PDF/ảnh)">
                <Input prefix={<FileTextOutlined />} placeholder="https://…" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="ghi_chu" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
