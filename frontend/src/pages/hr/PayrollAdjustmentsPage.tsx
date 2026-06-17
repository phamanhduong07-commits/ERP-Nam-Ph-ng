/**
 * Phụ cấp + Khấu trừ + Tạm ứng — Sprint D.4.
 *
 * Theo Điều 12 Quy chế Lương Nam Phương:
 * - 8 khoản cộng thêm: Tăng thưởng SP / Bồi dưỡng / Công nhật / 5 loại phụ cấp
 * - 7 khoản khấu trừ: BHXH (8%) / BHYT (1.5%) / BHTN (1%) / Cơm / Tạm ứng / Công đoàn phí / Phạt
 *
 * Workflow: du_thao (HR tạo) → da_duyet (HR/BGĐ duyệt, 4-eyes) → engine D.3 dùng.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Avatar, Button, Card, Col, DatePicker, Form, Input, InputNumber, Modal,
  Popconfirm, Row, Select, Space, Statistic, Table, Tabs, Tag, Typography, message,
} from 'antd'
import {
  DollarOutlined, PlusOutlined, CheckCircleOutlined, EditOutlined,
  DeleteOutlined, ThunderboltOutlined, ArrowUpOutlined, ArrowDownOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { hrApi } from '../../api/hr'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Title, Text } = Typography
const fmtVND = (v: number) => Number(v || 0).toLocaleString('vi-VN') + 'đ'

export default function PayrollAdjustmentsPage() {
  const qc = useQueryClient()
  const [nam, setNam] = useState(dayjs().year())
  const [thang, setThang] = useState(dayjs().month() + 1)
  const [filterDept, setFilterDept] = useState<number | undefined>()
  const [filterLoai, setFilterLoai] = useState<string | undefined>()
  const [filterTrangThai, setFilterTrangThai] = useState<string | undefined>()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [bhOpen, setBhOpen] = useState(false)
  const [form] = Form.useForm()
  const [bhForm] = Form.useForm()

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['hr-adjustments', nam, thang, filterDept, filterLoai, filterTrangThai],
    queryFn: () => hrApi.listAdjustments({
      nam, thang,
      bo_phan_id: filterDept,
      loai: filterLoai,
      trang_thai: filterTrangThai,
    }).then(r => r.data),
  })

  const { data: summary } = useQuery({
    queryKey: ['hr-adjustments-summary', nam, thang, filterDept],
    queryFn: () => hrApi.adjustmentSummary({ nam, thang, bo_phan_id: filterDept }).then(r => r.data),
  })

  const { data: enumData } = useQuery({
    queryKey: ['hr-adjustments-enum'],
    queryFn: () => hrApi.adjustmentEnum().then(r => r.data),
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['hr-employees-org'],
    queryFn: () => hrApi.listEmployees().then(r => r.data),
  })

  const { data: depts = [] } = useQuery({
    queryKey: ['hr-depts'],
    queryFn: () => hrApi.listDepartments().then(r => r.data),
  })

  // Mutations
  const saveMut = useMutation({
    mutationFn: (d: any) => editing?.id
      ? hrApi.updateAdjustment(editing.id, d)
      : hrApi.createAdjustment(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-adjustments'] })
      qc.invalidateQueries({ queryKey: ['hr-adjustments-summary'] })
      message.success('Đã lưu')
      setOpen(false); setEditing(null); form.resetFields()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })

  const approveMut = useMutation({
    mutationFn: (id: number) => hrApi.approveAdjustment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-adjustments'] })
      qc.invalidateQueries({ queryKey: ['hr-adjustments-summary'] })
      message.success('Đã duyệt')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })

  const delMut = useMutation({
    mutationFn: (id: number) => hrApi.deleteAdjustment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-adjustments'] })
      qc.invalidateQueries({ queryKey: ['hr-adjustments-summary'] })
      message.success('Đã xóa')
    },
  })

  const autoBhMut = useMutation({
    mutationFn: (d: any) => hrApi.autoGenBhxh(d),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ['hr-adjustments'] })
      qc.invalidateQueries({ queryKey: ['hr-adjustments-summary'] })
      message.success(r.data?.message || 'Đã sinh BHXH/BHYT/BHTN')
      setBhOpen(false); bhForm.resetFields()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })

  const openCreate = () => {
    setEditing(null); form.resetFields()
    form.setFieldsValue({ thang, nam, loai: 'cong_them', sub_loai: 'pc_chuc_vu' })
    setOpen(true)
  }
  const openEdit = (r: any) => {
    setEditing(r)
    form.setFieldsValue({
      ...r,
      ngay_phat_sinh: r.ngay_phat_sinh ? dayjs(r.ngay_phat_sinh) : undefined,
    })
    setOpen(true)
  }

  const onSubmit = (v: any) => saveMut.mutate({
    ...v,
    ngay_phat_sinh: v.ngay_phat_sinh ? v.ngay_phat_sinh.format('YYYY-MM-DD') : undefined,
  })

  const loaiWatch = Form.useWatch('loai', form)
  const subLoaiOptions = loaiWatch === 'khau_tru' ? (enumData?.khau_tru || []) : (enumData?.cong_them || [])

  const columns = [
    { title: 'Nhân viên', dataIndex: 'ho_ten', render: (v: string, r: any) => (
      <Space>
        <Avatar size="small" style={{ backgroundColor: '#fa8c16' }}>{(v || '?').charAt(0)}</Avatar>
        <div><div>{v}</div><Text type="secondary" style={{ fontSize: 11 }}>{r.ma_nv} · {r.ten_bo_phan}</Text></div>
      </Space>
    )},
    { title: 'Loại', dataIndex: 'loai', width: 110,
      render: (v: string) => v === 'cong_them' ? <Tag color="green">🟢 Cộng thêm</Tag> : <Tag color="red">🔴 Khấu trừ</Tag> },
    { title: 'Chi tiết', dataIndex: 'sub_loai_label' },
    { title: 'Số tiền', dataIndex: 'so_tien', width: 140, align: 'right' as const,
      render: (v: number, r: any) => (
        <Text strong style={{ color: r.loai === 'cong_them' ? '#52c41a' : '#cf1322', fontSize: 14 }}>
          {r.loai === 'cong_them' ? '+' : '−'} {fmtVND(v)}
        </Text>
      ) },
    { title: 'Ngày phát sinh', dataIndex: 'ngay_phat_sinh', width: 130,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—' },
    { title: 'Trạng thái', dataIndex: 'trang_thai', width: 120,
      render: (v: string) => v === 'da_duyet' ? <Tag color="green">✓ Đã duyệt</Tag> : <Tag color="gold">⏳ Chờ duyệt</Tag> },
    { title: '', width: 130, render: (_: unknown, r: any) => (
      <Space size={4}>
        {r.trang_thai === 'du_thao' && (
          <Popconfirm title="Duyệt khoản này?" onConfirm={() => approveMut.mutate(r.id)}>
            <Button size="small" type="primary" icon={<CheckCircleOutlined />}>OK</Button>
          </Popconfirm>
        )}
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
        <Popconfirm title="Xóa khoản này?" onConfirm={() => delMut.mutate(r.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    )},
  ]
  const { displayColumns, settingsButton } = useColumnPrefs('hr-payroll-adjustments', columns)

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <Title level={4} style={{ margin: 0 }}>
        <DollarOutlined style={{ color: '#fa8c16' }} /> Phụ cấp & Khấu trừ
      </Title>
      <Text type="secondary">
        Theo Điều 12 Quy chế Lương Nam Phương · 8 khoản cộng thêm + 7 khoản khấu trừ
      </Text>

      {/* Hero filter */}
      <Card
        size="small"
        style={{
          marginTop: 12, marginBottom: 16,
          background: 'linear-gradient(135deg, #fa8c16 0%, #eb2f96 100%)',
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
                style={{ width: 200 }} showSearch optionFilterProp="label"
                options={depts.map((d: any) => ({ value: d.id, label: d.ten_bo_phan }))} />
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<ThunderboltOutlined />} size="middle"
                onClick={() => { bhForm.resetFields(); bhForm.setFieldsValue({ thang, nam, bo_phan_id: filterDept }); setBhOpen(true) }}>
                Auto-tính BHXH/BHYT/BHTN
              </Button>
              <Button type="primary" icon={<PlusOutlined />} size="middle" onClick={openCreate}>
                Thêm khoản
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 4 KPI cards */}
      {summary && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} md={6}>
            <Card size="small" style={{ borderLeft: '4px solid #52c41a' }}>
              <Statistic title="Tổng cộng thêm" value={fmtVND(summary.total_cong_them)}
                valueStyle={{ color: '#52c41a' }} prefix={<ArrowUpOutlined />} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" style={{ borderLeft: '4px solid #cf1322' }}>
              <Statistic title="Tổng khấu trừ" value={fmtVND(summary.total_khau_tru)}
                valueStyle={{ color: '#cf1322' }} prefix={<ArrowDownOutlined />} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" style={{ borderLeft: '4px solid #1677ff' }}>
              <Statistic title="Ròng (Cộng − Trừ)" value={fmtVND(summary.rong)}
                valueStyle={{ color: summary.rong >= 0 ? '#1677ff' : '#cf1322' }} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" style={{ borderLeft: '4px solid #fa8c16' }}>
              <Statistic title="Chờ duyệt" value={summary.so_record_cho_duyet}
                suffix={`/ ${summary.so_record_da_duyet + summary.so_record_cho_duyet}`}
                valueStyle={{ color: '#fa8c16' }} />
            </Card>
          </Col>
        </Row>
      )}

      {/* Alert nếu có chờ duyệt */}
      {summary && summary.so_record_cho_duyet > 0 && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }}
          message={<>Có <strong>{summary.so_record_cho_duyet} khoản chờ duyệt</strong>. Engine tính lương chỉ dùng khoản đã duyệt.</>}
          action={<Button size="small" onClick={() => setFilterTrangThai('du_thao')}>Xem ngay</Button>} />
      )}

      {/* Phân tích theo sub_loai */}
      {summary && summary.by_sub_loai.length > 0 && (
        <Card size="small" title="📊 Phân tích theo loại" style={{ marginBottom: 12 }}>
          <Row gutter={[12, 12]}>
            {summary.by_sub_loai.slice(0, 8).map((r: any) => (
              <Col xs={12} md={6} key={r.sub_loai}>
                <div style={{
                  padding: 10, borderRadius: 6,
                  background: r.loai === 'cong_them' ? '#f6ffed' : '#fff1f0',
                  borderLeft: `3px solid ${r.loai === 'cong_them' ? '#52c41a' : '#cf1322'}`,
                }}>
                  <Text style={{ fontSize: 11, display: 'block' }} type="secondary">{r.label}</Text>
                  <Text strong style={{ fontSize: 16, color: r.loai === 'cong_them' ? '#52c41a' : '#cf1322' }}>
                    {fmtVND(r.tong)}
                  </Text>
                  <Text style={{ fontSize: 11, display: 'block' }} type="secondary">{r.so_record} bản ghi</Text>
                </div>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* Filter + Table */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Select allowClear placeholder="Loại" value={filterLoai} onChange={setFilterLoai} style={{ width: 160 }}
            options={[
              { value: 'cong_them', label: '🟢 Cộng thêm' },
              { value: 'khau_tru', label: '🔴 Khấu trừ' },
            ]} />
          <Select allowClear placeholder="Trạng thái" value={filterTrangThai} onChange={setFilterTrangThai} style={{ width: 160 }}
            options={[
              { value: 'du_thao', label: '⏳ Chờ duyệt' },
              { value: 'da_duyet', label: '✓ Đã duyệt' },
            ]} />
          <Text type="secondary">Hiển thị <strong>{items.length}</strong> bản ghi</Text>
        </Space>
      </Card>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table size="small" rowKey="id" loading={isLoading} dataSource={items}
          columns={displayColumns}
          title={() => <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 8px' }}>{settingsButton}</div>}
          pagination={{ pageSize: 30, showTotal: (t) => `Tổng ${t} bản ghi` }} />
      </Card>

      {/* Modal thêm/sửa */}
      <Modal open={open} title={editing ? 'Sửa khoản' : 'Thêm khoản phụ cấp / khấu trừ'}
        onCancel={() => { setOpen(false); setEditing(null); form.resetFields() }}
        onOk={() => form.submit()} confirmLoading={saveMut.isPending} width={620}>
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="employee_id" label="Nhân viên" rules={[{ required: true }]}>
                <Select showSearch optionFilterProp="label" disabled={!!editing}
                  options={employees.map(e => ({ value: e.id, label: `${e.ma_nv} — ${e.ho_ten}` }))} />
              </Form.Item>
            </Col>
            <Col span={5}><Form.Item name="thang" label="Tháng" rules={[{ required: true }]}>
              <InputNumber min={1} max={12} style={{ width: '100%' }} disabled={!!editing} /></Form.Item></Col>
            <Col span={5}><Form.Item name="nam" label="Năm" rules={[{ required: true }]}>
              <InputNumber min={2020} max={2100} style={{ width: '100%' }} disabled={!!editing} /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={10}>
              <Form.Item name="loai" label="Loại" rules={[{ required: true }]}>
                <Select disabled={!!editing} onChange={() => form.setFieldValue('sub_loai', undefined)}
                  options={[
                    { value: 'cong_them', label: '🟢 Cộng thêm (tăng lương)' },
                    { value: 'khau_tru', label: '🔴 Khấu trừ (giảm lương)' },
                  ]} />
              </Form.Item>
            </Col>
            <Col span={14}>
              <Form.Item name="sub_loai" label="Chi tiết" rules={[{ required: true }]}>
                <Select disabled={!!editing} options={subLoaiOptions} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="so_tien" label="Số tiền (VNĐ)" rules={[{ required: true }]}>
                <InputNumber min={0} step={10000} style={{ width: '100%' }}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="ngay_phat_sinh" label="Ngày phát sinh">
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="ghi_chu" label="Ghi chú">
            <Input.TextArea rows={2} placeholder="VD: Phụ cấp tổ trưởng tháng 6, Tạm ứng đợt 1..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal auto-tính BHXH/BHYT/BHTN */}
      <Modal open={bhOpen} title="Tự động tính BHXH / BHYT / BHTN"
        onCancel={() => { setBhOpen(false); bhForm.resetFields() }}
        onOk={() => bhForm.submit()} confirmLoading={autoBhMut.isPending}>
        <Alert
          type="info" showIcon
          message="Hệ thống tự sinh 3 khoản khấu trừ BH cho tất cả NV trong tháng"
          description="BHXH = 8% × Lương BHXH HĐLĐ · BHYT = 1.5% · BHTN = 1%. Skip NV không có lương BHXH hoặc đã có khoản BH cho tháng này."
          style={{ marginBottom: 16 }} />
        <Form form={bhForm} layout="vertical" onFinish={(v) => autoBhMut.mutate(v)}>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="thang" label="Tháng" rules={[{ required: true }]}>
              <InputNumber min={1} max={12} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="nam" label="Năm" rules={[{ required: true }]}>
              <InputNumber min={2020} max={2100} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Form.Item name="bo_phan_id" label="Bộ phận (bỏ trống = tất cả NV)">
            <Select allowClear showSearch optionFilterProp="label"
              options={depts.map((d: any) => ({ value: d.id, label: d.ten_bo_phan }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
