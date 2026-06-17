/**
 * Sản lượng tháng — Sprint D.2.
 *
 * Đầu vào cho engine tính lương sản phẩm (Sprint D.3).
 * Theo Điều 14 Quy chế: sản lượng phải có mã hàng, đơn giá, đạt chất lượng và được xác nhận.
 *
 * Bố cục:
 * - Hero filter: tháng + bộ phận + nút import bulk
 * - 4 KPI: Tổng SL hợp lệ / SL lỗi / Quỹ lương ước tính / Chờ xác nhận
 * - 2 phân tích: theo mã hàng + theo bộ phận
 * - Bảng list sản lượng (filter + xác nhận inline)
 */
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Avatar, Button, Card, Col, DatePicker, Form, Input, InputNumber,
  Modal, Popconfirm, Row, Select, Space, Statistic, Table, Tag, Typography, message,
} from 'antd'
import {
  AppstoreOutlined, PlusOutlined, CheckCircleOutlined, EditOutlined, DeleteOutlined,
  WarningOutlined, DollarOutlined, CalendarOutlined, UploadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { hrApi } from '../../api/hr'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Title, Text } = Typography
const fmtNum = (v: number) => Number(v || 0).toLocaleString('vi-VN')
const fmtVND = (v: number) => fmtNum(v) + 'đ'

const CA_OPTIONS = [
  { value: 'all',    label: '🕐 Cả ngày' },
  { value: 'sang',   label: '🌅 Ca sáng' },
  { value: 'chieu',  label: '☀️ Ca chiều' },
  { value: 'dem',    label: '🌙 Ca đêm' },
]

const TRANG_THAI_META: Record<string, { color: string; label: string }> = {
  cho_xac_nhan: { color: 'gold',  label: '⏳ Chờ xác nhận' },
  da_xac_nhan:  { color: 'green', label: '✓ Đã xác nhận' },
  huy:          { color: 'red',   label: '✗ Đã hủy' },
}

export default function ProductionOutputPage() {
  const qc = useQueryClient()
  const [nam, setNam] = useState(dayjs().year())
  const [thang, setThang] = useState(dayjs().month() + 1)
  const [filterDept, setFilterDept] = useState<number | undefined>()
  const [filterMa, setFilterMa] = useState<string | undefined>()
  const [filterTrangThai, setFilterTrangThai] = useState<string | undefined>()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  // Queries
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['hr-production-outputs', nam, thang, filterDept, filterMa, filterTrangThai],
    queryFn: () => hrApi.listProductionOutputs({
      nam, thang,
      bo_phan_id: filterDept,
      ma_hang: filterMa,
      trang_thai: filterTrangThai,
    }).then(r => r.data),
  })

  const { data: summary } = useQuery({
    queryKey: ['hr-production-summary', nam, thang, filterDept],
    queryFn: () => hrApi.productionSummary({ nam, thang, bo_phan_id: filterDept }).then(r => r.data),
  })

  const { data: workUnits = [] } = useQuery({
    queryKey: ['hr-payroll-configs', 'san_pham'],
    queryFn: () => hrApi.listPayrollConfigs({ loai: 'san_pham' } as any).then(r => r.data),
  })

  const { data: depts = [] } = useQuery({
    queryKey: ['hr-depts'],
    queryFn: () => hrApi.listDepartments().then(r => r.data),
  })

  const { data: teams = [] } = useQuery({
    queryKey: ['hr-teams'],
    queryFn: () => hrApi.listTeams().then(r => r.data),
  })

  // Mutations
  const saveMut = useMutation({
    mutationFn: (d: any) => editing?.id
      ? hrApi.updateProductionOutput(editing.id, d)
      : hrApi.createProductionOutput(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-production-outputs'] })
      qc.invalidateQueries({ queryKey: ['hr-production-summary'] })
      message.success('Đã lưu sản lượng')
      setOpen(false); setEditing(null); form.resetFields()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi lưu'),
  })

  const confirmMut = useMutation({
    mutationFn: (id: number) => hrApi.confirmProductionOutput(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-production-outputs'] })
      qc.invalidateQueries({ queryKey: ['hr-production-summary'] })
      message.success('Đã xác nhận sản lượng')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })

  const delMut = useMutation({
    mutationFn: (id: number) => hrApi.deleteProductionOutput(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-production-outputs'] })
      qc.invalidateQueries({ queryKey: ['hr-production-summary'] })
      message.success('Đã xóa')
    },
  })

  const openCreate = () => {
    setEditing(null); form.resetFields()
    form.setFieldsValue({ ngay: dayjs(), ca: 'all', san_luong_loi: 0 })
    setOpen(true)
  }
  const openEdit = (r: any) => {
    setEditing(r)
    form.setFieldsValue({ ...r, ngay: dayjs(r.ngay) })
    setOpen(true)
  }
  const onSubmit = (v: any) => saveMut.mutate({
    ...v, ngay: v.ngay.format('YYYY-MM-DD'),
  })

  const columns = [
    { title: 'Ngày', dataIndex: 'ngay', width: 110,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
      sorter: (a: any, b: any) => dayjs(a.ngay).valueOf() - dayjs(b.ngay).valueOf() },
    { title: 'Mã hàng', dataIndex: 'ma_hang', width: 130,
      render: (v: string, r: any) => (
        <>
          <Tag color="blue">{v}</Tag>
          <div><Text type="secondary" style={{ fontSize: 11 }}>{r.ten_hang}</Text></div>
        </>
      ) },
    { title: 'Bộ phận / Tổ', width: 200,
      render: (_: unknown, r: any) => (
        <>
          <div>{r.ten_bo_phan || <Text type="secondary">—</Text>}</div>
          {r.ten_to && <Text type="secondary" style={{ fontSize: 11 }}>🏷 {r.ten_to}</Text>}
        </>
      ) },
    { title: 'Ca', dataIndex: 'ca', width: 110,
      render: (v: string) => CA_OPTIONS.find((o: any) => o.value === v)?.label || v },
    { title: 'Sản lượng', dataIndex: 'san_luong', width: 110, align: 'right' as const,
      render: (v: number) => <Text strong style={{ color: '#52c41a' }}>{fmtNum(v)}</Text> },
    { title: 'Lỗi', dataIndex: 'san_luong_loi', width: 80, align: 'right' as const,
      render: (v: number) => v > 0 ? <Text type="danger">{fmtNum(v)}</Text> : '—' },
    { title: 'Quỹ lương SP (ước tính)', dataIndex: 'quy_luong_uoc_tinh', width: 170, align: 'right' as const,
      render: (v: number) => <Text strong style={{ color: '#1677ff' }}>{fmtVND(v)}</Text> },
    { title: 'Trạng thái', dataIndex: 'trang_thai', width: 140,
      render: (v: string) => {
        const m = TRANG_THAI_META[v]
        return <Tag color={m?.color}>{m?.label || v}</Tag>
      } },
    { title: '', width: 140, render: (_: unknown, r: any) => (
      <Space size={4}>
        {r.trang_thai === 'cho_xac_nhan' && (
          <Popconfirm title="Xác nhận sản lượng này?" onConfirm={() => confirmMut.mutate(r.id)}>
            <Button size="small" type="primary" icon={<CheckCircleOutlined />}>OK</Button>
          </Popconfirm>
        )}
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
        <Popconfirm title="Xóa bản ghi này?" onConfirm={() => delMut.mutate(r.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ) },
  ]
  const { displayColumns, settingsButton } = useColumnPrefs('hr-production-output', columns)

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <Title level={4} style={{ margin: 0 }}>
        <AppstoreOutlined style={{ color: '#1677ff' }} /> Sản lượng tháng
      </Title>
      <Text type="secondary">
        Nhập sản lượng theo mã hàng × tổ × ca · Đầu vào cho engine tính lương sản phẩm
      </Text>

      {/* ─── Hero filter card ─── */}
      <Card
        size="small"
        style={{
          marginTop: 12, marginBottom: 16,
          background: 'linear-gradient(135deg, #1677ff 0%, #13c2c2 100%)',
          border: 'none',
        }}
        styles={{ body: { padding: '12px 16px' } }}
      >
        <Row justify="space-between" align="middle" wrap>
          <Col>
            <Space size={10} wrap>
              <span style={{ color: '#fff', fontWeight: 600 }}>📅 Kỳ:</span>
              <Select value={thang} onChange={setThang} size="middle" style={{ width: 120 }}
                options={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Tháng ${i + 1}` }))} />
              <Select value={nam} onChange={setNam} size="middle" style={{ width: 110 }}
                options={Array.from({ length: 5 }, (_, i) => {
                  const y = dayjs().year() - 2 + i
                  return { value: y, label: y.toString() }
                })} />
              <Select size="middle" allowClear placeholder="Bộ phận"
                value={filterDept} onChange={setFilterDept}
                style={{ width: 180 }} showSearch optionFilterProp="label"
                options={depts.map((d: any) => ({ value: d.id, label: d.ten_bo_phan }))} />
            </Space>
          </Col>
          <Col>
            <Button type="primary" icon={<PlusOutlined />} size="middle" onClick={openCreate}>
              Nhập sản lượng
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Alert nếu còn record chờ xác nhận */}
      {summary && summary.so_record_cho_xac_nhan > 0 && (
        <Alert
          type="warning" showIcon icon={<WarningOutlined />}
          message={<>Còn <strong>{summary.so_record_cho_xac_nhan} bản ghi sản lượng</strong> chờ xác nhận trong tháng {summary.ky}. Engine tính lương chỉ dùng sản lượng đã xác nhận.</>}
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" onClick={() => setFilterTrangThai('cho_xac_nhan')}>
              Xem ngay
            </Button>
          }
        />
      )}

      {/* ─── 4 KPI cards ─── */}
      {summary && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} md={6}>
            <Card size="small" style={{ borderLeft: '4px solid #52c41a' }}>
              <Statistic title="Tổng sản lượng hợp lệ" value={fmtNum(summary.tong_san_luong)} suffix="đơn vị"
                valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} />
              <Text type="secondary" style={{ fontSize: 11 }}>
                Trong {summary.so_ngay_co_sl} ngày có phát sinh
              </Text>
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" style={{ borderLeft: '4px solid #cf1322' }}>
              <Statistic title="Sản lượng lỗi (không tính lương)" value={fmtNum(summary.tong_san_luong_loi)} suffix="đơn vị"
                valueStyle={{ color: '#cf1322' }} prefix={<WarningOutlined />} />
              <Text type="secondary" style={{ fontSize: 11 }}>
                Tỉ lệ lỗi: {summary.tong_san_luong > 0
                  ? ((summary.tong_san_luong_loi / (summary.tong_san_luong + summary.tong_san_luong_loi)) * 100).toFixed(2)
                  : 0}%
              </Text>
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" style={{ borderLeft: '4px solid #1677ff' }}>
              <Statistic title="Quỹ lương SP ước tính" value={fmtVND(summary.tong_quy_luong_sp)}
                valueStyle={{ color: '#1677ff', fontSize: 22 }} prefix={<DollarOutlined />} />
              <Text type="secondary" style={{ fontSize: 11 }}>
                Dựa trên bảng đơn giá hiện hành
              </Text>
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" style={{ borderLeft: '4px solid #fa8c16' }}>
              <Statistic title="Chờ xác nhận"
                value={summary.so_record_cho_xac_nhan}
                suffix={`/ ${summary.so_record_da_xac_nhan + summary.so_record_cho_xac_nhan}`}
                valueStyle={{ color: '#fa8c16' }} prefix={<CalendarOutlined />} />
              <Text type="secondary" style={{ fontSize: 11 }}>
                Đã xác nhận: {summary.so_record_da_xac_nhan} bản ghi
              </Text>
            </Card>
          </Col>
        </Row>
      )}

      {/* ─── 2 phân tích ─── */}
      {summary && (summary.by_ma_hang.length > 0 || summary.by_bo_phan.length > 0) && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={12}>
            <Card size="small" title="📦 Quỹ lương theo mã hàng">
              {summary.by_ma_hang.length === 0
                ? <Text type="secondary">Chưa có dữ liệu</Text>
                : (() => {
                  const maxQ = Math.max(...summary.by_ma_hang.map(x => x.quy_luong), 1)
                  return summary.by_ma_hang.slice(0, 6).map((r: any) => {
                    const pct = (r.quy_luong / maxQ) * 100
                    return (
                      <div key={r.ma_hang} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                          <span><Tag color="blue">{r.ma_hang}</Tag>{r.ten_hang}</span>
                          <Text strong style={{ color: '#1677ff' }}>{fmtVND(r.quy_luong)}</Text>
                        </div>
                        <div style={{ background: '#f5f5f5', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #1677ff, #722ed1)' }} />
                        </div>
                        <Text type="secondary" style={{ fontSize: 11 }}>{fmtNum(r.san_luong)} đơn vị</Text>
                      </div>
                    )
                  })
                })()}
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card size="small" title="🏢 Quỹ lương theo bộ phận">
              {summary.by_bo_phan.length === 0
                ? <Text type="secondary">Chưa có dữ liệu</Text>
                : (() => {
                  const maxQ = Math.max(...summary.by_bo_phan.map(x => x.quy_luong), 1)
                  return summary.by_bo_phan.slice(0, 6).map((r: any, idx: number) => {
                    const pct = (r.quy_luong / maxQ) * 100
                    const color = idx === 0 ? '#cf1322' : idx === 1 ? '#fa541c' : idx === 2 ? '#fa8c16' : '#1677ff'
                    return (
                      <div key={r.ten_bo_phan} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                          <span><Avatar size={18} style={{ backgroundColor: color, fontSize: 10, marginRight: 6, verticalAlign: 'middle' }}>{idx + 1}</Avatar>{r.ten_bo_phan}</span>
                          <Text strong style={{ color }}>{fmtVND(r.quy_luong)}</Text>
                        </div>
                        <div style={{ background: '#f5f5f5', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: color }} />
                        </div>
                      </div>
                    )
                  })
                })()}
            </Card>
          </Col>
        </Row>
      )}

      {/* ─── Filter bổ sung + bảng ─── */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={12} align="middle">
          <Col xs={24} md={8}>
            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Lọc mã hàng</Text>
            <Select allowClear placeholder="Tất cả mã hàng" value={filterMa} onChange={setFilterMa}
              style={{ width: '100%' }} showSearch optionFilterProp="label"
              options={workUnits.map((w: any) => ({ value: w.ma_hang, label: `${w.ma_hang} — ${w.ten_hang}` }))} />
          </Col>
          <Col xs={24} md={8}>
            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Trạng thái</Text>
            <Select allowClear placeholder="Tất cả trạng thái" value={filterTrangThai} onChange={setFilterTrangThai}
              style={{ width: '100%' }}
              options={Object.entries(TRANG_THAI_META).map(([k, v]) => ({ value: k, label: v.label }))} />
          </Col>
          <Col xs={24} md={8}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              Hiển thị <strong>{items.length}</strong> bản ghi
            </Text>
          </Col>
        </Row>
      </Card>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          size="small" rowKey="id" loading={isLoading} dataSource={items}
          columns={displayColumns}
          title={() => <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 8px' }}>{settingsButton}</div>}
          pagination={{ pageSize: 30, showSizeChanger: true, showTotal: (t) => `Tổng ${t} bản ghi` }}
        />
      </Card>

      <Modal
        open={open} title={editing ? `Sửa sản lượng — ${editing.ma_hang}` : 'Nhập sản lượng mới'}
        onCancel={() => { setOpen(false); setEditing(null); form.resetFields() }}
        onOk={() => form.submit()} confirmLoading={saveMut.isPending} width={680}
      >
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Row gutter={12}>
            <Col span={10}>
              <Form.Item name="ngay" label="Ngày sản xuất" rules={[{ required: true }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={14}>
              <Form.Item name="ma_hang" label="Mã hàng" rules={[{ required: true }]}>
                <Select showSearch optionFilterProp="label"
                  options={workUnits.map((w: any) => ({
                    value: w.ma_hang,
                    label: `${w.ma_hang} — ${w.ten_hang} (${fmtVND(w.don_gia)} × ${w.phan_tram_luong_sp}%)`,
                  }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={10}>
              <Form.Item name="bo_phan_id" label="Bộ phận">
                <Select allowClear showSearch optionFilterProp="label"
                  options={depts.map((d: any) => ({ value: d.id, label: d.ten_bo_phan }))} />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="to_id" label="Tổ (không bắt buộc)">
                <Select allowClear showSearch optionFilterProp="label"
                  options={teams.map((t: any) => ({ value: t.id, label: `${t.ten_to} (${t.ten_bo_phan})` }))} />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="ca" label="Ca" rules={[{ required: true }]}>
                <Select options={CA_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="san_luong" label="Sản lượng hợp lệ" rules={[{ required: true }]}>
                <InputNumber min={0} step={1} style={{ width: '100%' }}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                  addonAfter="đơn vị" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="san_luong_loi" label="Sản lượng lỗi (không tính lương)">
                <InputNumber min={0} step={1} style={{ width: '100%' }}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                  addonAfter="đơn vị" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="ghi_chu" label="Ghi chú">
            <Input.TextArea rows={2} placeholder="VD: Tăng ca đêm, máy số 3 hỏng giữa ca..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
