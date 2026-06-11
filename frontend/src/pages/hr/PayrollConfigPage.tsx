/**
 * Cấu hình lương sản phẩm — Sprint D.1.
 *
 * Theo Quy chế Lương Nam Phương:
 * - Tab 1 (Điều 6): Bảng đơn giá theo mã hàng
 * - Tab 2 (Điều 9): Bảng quy đổi giờ → công
 * - Tab 3 (NĐ 74/2024): Lương tối thiểu vùng I-IV
 * - Tab 4: Config chung (giờ/ngày chuẩn, vùng áp dụng)
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Button, Card, Form, Input, InputNumber, Modal, Popconfirm,
  Row, Col, Select, Space, Table, Tabs, Tag, Typography, message,
} from 'antd'
import {
  PlusOutlined, EditOutlined, SettingOutlined, DeleteOutlined,
  ClockCircleOutlined, GlobalOutlined, DollarOutlined, ToolOutlined,
} from '@ant-design/icons'
import { hrApi } from '../../api/hr'

const { Title, Text } = Typography

const fmtVND = (v: number | string) => Number(v || 0).toLocaleString('vi-VN') + 'đ'

export default function PayrollConfigPage() {
  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <SettingOutlined style={{ color: '#1677ff' }} /> Cấu hình lương sản phẩm
        </Title>
        <Text type="secondary">
          Master data theo <strong>Quy chế Lương Nam Phương</strong> (Điều 6, 9, 11) + Nghị định 74/2024/NĐ-CP
        </Text>
      </div>

      <Tabs
        defaultActiveKey="san_pham"
        items={[
          { key: 'san_pham',     label: <span><DollarOutlined /> Bảng đơn giá</span>,        children: <UnitPriceTab /> },
          { key: 'gio_quy_doi',  label: <span><ClockCircleOutlined /> Quy đổi giờ → công</span>, children: <HourConversionTab /> },
          { key: 'min_wage',     label: <span><GlobalOutlined /> Lương tối thiểu vùng</span>, children: <MinWageTab /> },
          { key: 'config',       label: <span><ToolOutlined /> Cấu hình chung</span>,        children: <GeneralConfigTab /> },
        ]}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// TAB 1: Bảng đơn giá theo mã hàng (Điều 6 quy chế)
// ═══════════════════════════════════════════════════════════════
function UnitPriceTab() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['hr-payroll-configs', 'san_pham'],
    queryFn: () => hrApi.listPayrollConfigs({ loai: 'san_pham' } as any).then(r => r.data),
  })

  const saveMut = useMutation({
    mutationFn: (data: any) =>
      editing?.id ? hrApi.updatePayrollConfig(editing.id, data) : hrApi.createPayrollConfig(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-payroll-configs', 'san_pham'] })
      message.success('Đã lưu mã hàng')
      setOpen(false); setEditing(null); form.resetFields()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi lưu'),
  })

  const openCreate = () => {
    setEditing(null); form.resetFields()
    form.setFieldsValue({ loai: 'san_pham', phan_tram_luong_sp: 100 })
    setOpen(true)
  }
  const openEdit = (r: any) => { setEditing(r); form.setFieldsValue(r); setOpen(true) }

  return (
    <>
      <Alert
        type="info" showIcon style={{ marginBottom: 12 }}
        message="Điều 6 Quy chế: Bảng đơn giá sản phẩm — công thức Quỹ lương SP = Sản lượng × Đơn giá × % lương SP"
      />
      <Row justify="end" style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Thêm mã hàng</Button>
      </Row>
      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          size="small" rowKey="id" loading={isLoading} dataSource={items}
          columns={[
            { title: 'Mã hàng', dataIndex: 'ma_hang', width: 150,
              render: (v: string) => <Text strong style={{ color: '#1677ff' }}>{v}</Text> },
            { title: 'Tên', dataIndex: 'ten_hang' },
            { title: 'Công đoạn', dataIndex: 'cong_doan', width: 150,
              render: (v: string) => v ? <Tag>{v}</Tag> : '—' },
            { title: '% lương SP', dataIndex: 'phan_tram_luong_sp', width: 120, align: 'center' as const,
              render: (v: number) => <Tag color="blue">{v}%</Tag> },
            { title: 'Đơn giá (VNĐ/đơn vị)', dataIndex: 'don_gia', width: 180, align: 'right' as const,
              render: (v: number) => <Text strong style={{ color: '#fa8c16' }}>{fmtVND(v)}</Text> },
            { title: '', width: 80, render: (_, r: any) => (
              <Space size={4}>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
              </Space>
            )},
          ]}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        open={open} title={editing ? `Sửa mã hàng: ${editing.ma_hang}` : 'Thêm mã hàng mới'}
        onCancel={() => { setOpen(false); setEditing(null); form.resetFields() }}
        onOk={() => form.submit()} confirmLoading={saveMut.isPending} width={560}
      >
        <Form form={form} layout="vertical" onFinish={(v) => saveMut.mutate({ ...v, loai: 'san_pham' })}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="ma_hang" label="Mã hàng" rules={[{ required: true }]}>
                <Input placeholder="VD: IN, MAYSONG_A, CM_A..." disabled={!!editing} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="cong_doan" label="Công đoạn">
                <Input placeholder="VD: In, Máy sóng, Cán màng..." />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="ten_hang" label="Tên hàng" rules={[{ required: true }]}>
            <Input placeholder="VD: In offset 4 màu" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="phan_tram_luong_sp" label="% lương sản phẩm" rules={[{ required: true }]}>
                <InputNumber min={0} max={500} addonAfter="%" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="don_gia" label="Đơn giá (VNĐ/đơn vị)" rules={[{ required: true }]}>
                <InputNumber min={0} step={1} style={{ width: '100%' }}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// TAB 2: Bảng quy đổi giờ → công (Điều 9 quy chế, Table 5)
// ═══════════════════════════════════════════════════════════════
function HourConversionTab() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['hr-payroll-configs', 'gio_quy_doi'],
    queryFn: () => hrApi.listPayrollConfigs({ loai: 'gio_quy_doi' } as any).then(r => r.data),
  })

  const saveMut = useMutation({
    mutationFn: (data: any) =>
      editing?.id ? hrApi.updatePayrollConfig(editing.id, data) : hrApi.createPayrollConfig(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-payroll-configs', 'gio_quy_doi'] })
      message.success('Đã lưu'); setOpen(false); setEditing(null); form.resetFields()
    },
  })

  const openCreate = () => { setEditing(null); form.resetFields(); setOpen(true) }
  const openEdit = (r: any) => { setEditing(r); form.setFieldsValue(r); setOpen(true) }

  return (
    <>
      <Alert
        type="info" showIcon style={{ marginBottom: 12 }}
        message="Điều 9 Quy chế: Công quy đổi = Tổng giờ làm việc thực tế / Giờ công chuẩn"
        description="Quy ước hiện hành: 4 giờ = 0.5 công · 8 giờ = 1 công · 10 giờ = 1.25 công · 12 giờ = 1.5 công"
      />
      <Row justify="end" style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Thêm mức quy đổi</Button>
      </Row>
      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          size="small" rowKey="id" loading={isLoading} dataSource={items}
          columns={[
            { title: 'Mã cấu hình', dataIndex: 'ma_cau_hinh', width: 180,
              render: (v: string) => <Text strong style={{ color: '#722ed1' }}>{v}</Text> },
            { title: 'Diễn giải', dataIndex: 'ten_cau_hinh' },
            { title: 'Công quy đổi', dataIndex: 'gia_tri', width: 160, align: 'center' as const,
              render: (v: string) => <Tag color="cyan" style={{ fontSize: 14 }}>{Number(v).toFixed(2)} công</Tag> },
            { title: '', width: 80, render: (_, r: any) => (
              <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
            )},
          ]}
          pagination={false}
        />
      </Card>

      <Modal
        open={open} title={editing ? 'Sửa mức quy đổi' : 'Thêm mức quy đổi'}
        onCancel={() => { setOpen(false); setEditing(null); form.resetFields() }}
        onOk={() => form.submit()} confirmLoading={saveMut.isPending}
      >
        <Form form={form} layout="vertical" onFinish={(v) => saveMut.mutate({ ...v, loai: 'gio_quy_doi' })}>
          <Form.Item name="ma_cau_hinh" label="Mã cấu hình" rules={[{ required: true }]}>
            <Input placeholder="VD: QD_4H, QD_8H..." disabled={!!editing} />
          </Form.Item>
          <Form.Item name="ten_cau_hinh" label="Diễn giải" rules={[{ required: true }]}>
            <Input placeholder="VD: 4 giờ làm việc" />
          </Form.Item>
          <Form.Item name="gia_tri" label="Công quy đổi" rules={[{ required: true }]}>
            <InputNumber min={0} max={3} step={0.01} style={{ width: '100%' }} addonAfter="công" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// TAB 3: Lương tối thiểu vùng (NĐ 74/2024)
// ═══════════════════════════════════════════════════════════════
function MinWageTab() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['hr-payroll-configs', 'min_wage'],
    queryFn: () => hrApi.listPayrollConfigs({ loai: 'min_wage' } as any).then(r => r.data),
  })

  const saveMut = useMutation({
    mutationFn: (data: any) =>
      editing?.id ? hrApi.updatePayrollConfig(editing.id, data) : hrApi.createPayrollConfig(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-payroll-configs', 'min_wage'] })
      message.success('Đã lưu'); setOpen(false); setEditing(null); form.resetFields()
    },
  })

  return (
    <>
      <Alert
        type="warning" showIcon style={{ marginBottom: 12 }}
        message="Theo Nghị định 74/2024/NĐ-CP (hiệu lực 01/07/2024) — Lương tối thiểu tháng theo 4 vùng"
        description="Nam Phương Bao bì ở Hóc Môn (TP.HCM) thuộc Vùng I → 4.960.000đ/tháng. Điều 4.8 Quy chế: nếu lương SP < mức tối thiểu do lý do khách quan, công ty bù phần chênh lệch."
      />
      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          size="small" rowKey="id" loading={isLoading} dataSource={items}
          columns={[
            { title: 'Mã vùng', dataIndex: 'ma_cau_hinh', width: 180,
              render: (v: string) => {
                const vung = v.replace('MIN_WAGE_', '')
                const color: Record<string, string> = { I: 'red', II: 'orange', III: 'gold', IV: 'green' }
                return <Tag color={color[vung] || 'default'} style={{ fontSize: 14, fontWeight: 600 }}>Vùng {vung}</Tag>
              } },
            { title: 'Mô tả', dataIndex: 'ten_cau_hinh' },
            { title: 'Mức lương tối thiểu', dataIndex: 'gia_tri', width: 220, align: 'right' as const,
              render: (v: string) => <Text strong style={{ color: '#cf1322', fontSize: 16 }}>{fmtVND(v)}</Text> },
            { title: '', width: 80, render: (_, r: any) => (
              <Button size="small" icon={<EditOutlined />}
                onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true) }} />
            )},
          ]}
          pagination={false}
        />
      </Card>

      <Modal
        open={open} title={`Sửa mức lương: ${editing?.ten_cau_hinh || ''}`}
        onCancel={() => { setOpen(false); setEditing(null); form.resetFields() }}
        onOk={() => form.submit()} confirmLoading={saveMut.isPending}
      >
        <Form form={form} layout="vertical" onFinish={(v) => saveMut.mutate({ ...v, loai: 'min_wage' })}>
          <Form.Item name="ma_cau_hinh" label="Mã vùng" rules={[{ required: true }]}>
            <Input disabled />
          </Form.Item>
          <Form.Item name="ten_cau_hinh" label="Mô tả" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="gia_tri" label="Mức lương tối thiểu / tháng (VNĐ)" rules={[{ required: true }]}>
            <InputNumber min={0} step={10000} style={{ width: '100%' }}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// TAB 4: Cấu hình chung
// ═══════════════════════════════════════════════════════════════
function GeneralConfigTab() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['hr-payroll-configs', 'config'],
    queryFn: () => hrApi.listPayrollConfigs({ loai: 'config' } as any).then(r => r.data),
  })

  const saveMut = useMutation({
    mutationFn: (data: any) => hrApi.updatePayrollConfig(editing.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-payroll-configs', 'config'] })
      message.success('Đã lưu'); setEditing(null); form.resetFields()
    },
  })

  return (
    <>
      <Alert
        type="info" showIcon style={{ marginBottom: 12 }}
        message="Cấu hình chung của hệ thống lương — dùng cho engine tính lương tự động"
      />
      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          size="small" rowKey="id" loading={isLoading} dataSource={items}
          columns={[
            { title: 'Tham số', dataIndex: 'ten_cau_hinh' },
            { title: 'Mã', dataIndex: 'ma_cau_hinh', width: 200,
              render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text> },
            { title: 'Giá trị', dataIndex: 'gia_tri', width: 180, align: 'right' as const,
              render: (v: string, r: any) => {
                const label = r.ma_cau_hinh === 'VUNG_AP_DUNG' ? `Vùng ${v}`
                  : r.ma_cau_hinh === 'HE_SO_THU_VIEC' ? Number(v).toFixed(2)
                  : r.ma_cau_hinh === 'GIO_CHUAN_NGAY' ? `${v} giờ`
                  : r.ma_cau_hinh === 'NGAY_CHUAN_THANG' ? `${v} ngày`
                  : v
                return <Text strong style={{ color: '#1677ff', fontSize: 15 }}>{label}</Text>
              } },
            { title: '', width: 80, render: (_, r: any) => (
              <Button size="small" icon={<EditOutlined />}
                onClick={() => { setEditing(r); form.setFieldsValue(r) }} />
            )},
          ]}
          pagination={false}
        />
      </Card>

      <Modal
        open={!!editing} title={`Sửa: ${editing?.ten_cau_hinh || ''}`}
        onCancel={() => { setEditing(null); form.resetFields() }}
        onOk={() => form.submit()} confirmLoading={saveMut.isPending}
      >
        <Form form={form} layout="vertical" onFinish={(v) => saveMut.mutate({ ...v, loai: 'config' })}>
          <Form.Item name="ma_cau_hinh" label="Mã"><Input disabled /></Form.Item>
          <Form.Item name="ten_cau_hinh" label="Tên"><Input /></Form.Item>
          <Form.Item name="gia_tri" label="Giá trị" rules={[{ required: true }]}>
            <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
