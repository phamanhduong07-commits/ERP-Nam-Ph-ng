import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Descriptions, Drawer, Form, Input, InputNumber,
  Popconfirm, Row, Select, Space, Statistic, Table, Tag, Typography, message, Divider, Alert,
} from 'antd'
import { PlusOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  qcGiayCuonApi, QCGiayCuon, QCGiayCuonCreatePayload,
} from '../../api/qcGiayCuon'
import { paperMaterialsFullApi, PaperMaterial } from '../../api/paperMaterials'
import client from '../../api/client'
import EmptyState from "../../components/EmptyState"

const { Title, Text } = Typography
const { RangePicker } = DatePicker

// ── Helpers ──────────────────────────────────────────────────────────────────

interface PaperTC {
  ma_chinh: string
  ten: string
  kho: number | null
  dinh_luong: number | null
  tieu_chuan_dinh_luong: number | null
  do_buc_tieu_chuan: number | null
  do_nen_vong_tc: number | null
}

function ketQuaTag(val: string | null) {
  if (!val) return <Tag>Chưa đánh giá</Tag>
  return val === 'dat'
    ? <Tag color="green">Đạt</Tag>
    : <Tag color="red">Không đạt</Tag>
}

function calcTb(vals: (number | null | undefined)[]): number | null {
  const filled = vals.filter((v): v is number => v != null)
  if (!filled.length) return null
  return Math.round((filled.reduce((a, b) => a + b, 0) / filled.length) * 1000) / 1000
}

function evalDL(tb: number | null, tc: number | null, ss: number | null): 'dat' | 'khong_dat' | null {
  if (tb == null || tc == null || ss == null) return null
  return tb >= tc * (1 - ss / 100) && tb <= tc * (1 + ss / 100) ? 'dat' : 'khong_dat'
}

function evalMin(tb: number | null, tc: number | null): 'dat' | 'khong_dat' | null {
  if (tb == null || tc == null) return null
  return tb >= tc ? 'dat' : 'khong_dat'
}

function evalKho(tt: number | null, tc: number | null): 'dat' | 'khong_dat' | null {
  if (tt == null || tc == null) return null
  return Math.abs(tt - tc) <= 4 ? 'dat' : 'khong_dat'
}

// ── Sub-component: Badge kết quả real-time ───────────────────────────────────

function KQBadge({ kq }: { kq: 'dat' | 'khong_dat' | null }) {
  if (!kq) return null
  return kq === 'dat'
    ? <Tag color="green" style={{ marginLeft: 8 }}>Đạt</Tag>
    : <Tag color="red" style={{ marginLeft: 8 }}>Không đạt</Tag>
}

// ── Sub-component: Tiêu chuẩn reference ─────────────────────────────────────

function TCReference({ tc }: { tc: PaperTC | null }) {
  if (!tc) return null
  return (
    <Alert
      type="info"
      style={{ marginBottom: 16 }}
      message={`Tiêu chuẩn: ${tc.ma_chinh}`}
      description={
        <Space direction="vertical" size={2}>
          {tc.dinh_luong != null && (
            <span>
              Định lượng: <b>{tc.dinh_luong} g/m²</b>
              {tc.tieu_chuan_dinh_luong != null && ` ± ${tc.tieu_chuan_dinh_luong}%`}
              {tc.tieu_chuan_dinh_luong != null && tc.dinh_luong != null && (
                <Text type="secondary"> ({(tc.dinh_luong * (1 - tc.tieu_chuan_dinh_luong / 100)).toFixed(1)}–{(tc.dinh_luong * (1 + tc.tieu_chuan_dinh_luong / 100)).toFixed(1)})</Text>
              )}
            </span>
          )}
          {tc.do_buc_tieu_chuan != null
            ? <span>Độ bục: ≥ <b>{tc.do_buc_tieu_chuan} kgf/cm²</b></span>
            : <span style={{ color: '#faad14' }}>Độ bục: chưa có tiêu chuẩn</span>
          }
          {tc.do_nen_vong_tc != null
            ? <span>Nén vòng: ≥ <b>{tc.do_nen_vong_tc} kgf/6inch</b></span>
            : <span style={{ color: '#faad14' }}>Nén vòng: chưa có tiêu chuẩn</span>
          }
          {tc.kho != null && <span>Khổ TC: <b>{tc.kho} cm</b> (± 4 cm)</span>}
        </Space>
      }
    />
  )
}

// ── Create Drawer ─────────────────────────────────────────────────────────────

function CreateDrawer({
  open, onClose, onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [form] = Form.useForm()
  const [tc, setTc] = useState<PaperTC | null>(null)
  const [pmSearch, setPmSearch] = useState('')
  const [pmOptions, setPmOptions] = useState<PaperMaterial[]>([])

  // Real-time giá trị đo để tính TB và badge
  const dlL1 = Form.useWatch('dl_l1', form)
  const dlL2 = Form.useWatch('dl_l2', form)
  const bucL1 = Form.useWatch('buc_l1', form)
  const bucL2 = Form.useWatch('buc_l2', form)
  const bucL3 = Form.useWatch('buc_l3', form)
  const bucL4 = Form.useWatch('buc_l4', form)
  const nenL1 = Form.useWatch('nen_vong_l1', form)
  const nenL2 = Form.useWatch('nen_vong_l2', form)
  const nenL3 = Form.useWatch('nen_vong_l3', form)
  const khoTt = Form.useWatch('kho_thuc_te', form)
  const khoTc = Form.useWatch('kho_tc', form)

  // Computed TB + KQ
  const dlTb = calcTb([dlL1, dlL2])
  const dlKq = evalDL(dlTb, tc?.dinh_luong ?? null, tc?.tieu_chuan_dinh_luong ?? null)
  const bucTb = calcTb([bucL1, bucL2, bucL3, bucL4])
  const bucKq = evalMin(bucTb, tc?.do_buc_tieu_chuan ?? null)
  const nenTb = calcTb([nenL1, nenL2, nenL3])
  const nenKq = evalMin(nenTb, tc?.do_nen_vong_tc ?? null)
  const khoKq = evalKho(khoTt ?? null, khoTc ?? tc?.kho ?? null)

  const allKqs = [dlKq, bucKq, nenKq, khoKq].filter(Boolean)
  const ketQuaTong = allKqs.length > 0
    ? (allKqs.every(k => k === 'dat') ? 'dat' : 'khong_dat')
    : null

  // Search paper materials
  const handlePmSearch = useCallback(async (val: string) => {
    setPmSearch(val)
    if (!val || val.length < 2) { setPmOptions([]); return }
    try {
      const res = await paperMaterialsFullApi.list({ search: val, page_size: 30 })
      setPmOptions(res.data.items ?? res.data as unknown as PaperMaterial[])
    } catch { setPmOptions([]) }
  }, [])

  const handlePmSelect = useCallback(async (id: number) => {
    try {
      const res = await client.get<PaperTC>(`/qc-giay-cuon/tieu-chuan/${id}`)
      setTc(res.data)
      // Pre-fill kho_tc từ TC nếu chưa nhập
      if (res.data.kho != null) {
        form.setFieldValue('kho_tc', res.data.kho)
      }
    } catch { setTc(null) }
  }, [form])

  const mutation = useMutation({
    mutationFn: (payload: QCGiayCuonCreatePayload) => qcGiayCuonApi.create(payload),
    onSuccess: () => {
      message.success('Tạo phiếu QC thành công')
      form.resetFields()
      setTc(null)
      onCreated()
      onClose()
    },
    onError: () => message.error('Lỗi khi tạo phiếu'),
  })

  const handleSubmit = () => {
    form.validateFields().then(vals => {
      const payload: QCGiayCuonCreatePayload = {
        ...vals,
        ngay_kiem_tra: vals.ngay_kiem_tra?.format('YYYY-MM-DD'),
        ngay_nhap_giay: vals.ngay_nhap_giay?.format('YYYY-MM-DD') ?? null,
      }
      mutation.mutate(payload)
    })
  }

  const handleClose = () => {
    form.resetFields()
    setTc(null)
    onClose()
  }

  return (
    <Drawer
      title="Tạo phiếu QC giấy cuộn"
      width={620}
      open={open}
      onClose={handleClose}
      footer={
        <Space>
          <Button onClick={handleClose}>Hủy</Button>
          <Button type="primary" onClick={handleSubmit} loading={mutation.isPending}>
            Tạo phiếu
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        {/* ── Thông tin chung ── */}
        <Form.Item
          name="paper_material_id"
          label="Mã nguyên vật liệu"
          rules={[{ required: true, message: 'Chọn mã NVL' }]}
        >
          <Select
            showSearch
            placeholder="Tìm mã NVL (VD: DOT, CLO, ...)"
            filterOption={false}
            onSearch={handlePmSearch}
            onSelect={handlePmSelect}
            options={pmOptions.map(pm => ({
              value: pm.id,
              label: `${pm.ma_chinh} — ${pm.ten}`,
            }))}
          />
        </Form.Item>

        <TCReference tc={tc} />

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="ngay_kiem_tra" label="Ngày kiểm tra" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" defaultValue={dayjs()} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="ngay_nhap_giay" label="Ngày nhập giấy">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="nguoi_kiem_tra" label="Người kiểm tra">
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="trong_luong_tem" label="TL trên tem (KG)">
              <InputNumber style={{ width: '100%' }} min={0} step={0.1} />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left" orientationMargin={0}>
          Khổ giấy
          {khoKq && <KQBadge kq={khoKq} />}
        </Divider>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="kho_tc" label="Khổ tiêu chuẩn (cm)">
              <InputNumber style={{ width: '100%' }} min={0} step={0.5} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="kho_thuc_te" label="Khổ thực tế (cm)">
              <InputNumber style={{ width: '100%' }} min={0} step={0.5} />
            </Form.Item>
          </Col>
        </Row>

        {/* ── Định lượng GSM ── */}
        <Divider orientation="left" orientationMargin={0}>
          Định lượng GSM
          {dlTb != null && <Text type="secondary" style={{ marginLeft: 8 }}>TB: {dlTb}</Text>}
          <KQBadge kq={dlKq} />
        </Divider>
        {tc?.dinh_luong == null && (
          <Alert type="warning" message="Chưa có TC định lượng — không đánh giá chỉ tiêu này" style={{ marginBottom: 8 }} showIcon />
        )}
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="dl_l1" label="L1 (g/m²)">
              <InputNumber style={{ width: '100%' }} min={0} step={0.1} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="dl_l2" label="L2 (g/m²)">
              <InputNumber style={{ width: '100%' }} min={0} step={0.1} />
            </Form.Item>
          </Col>
        </Row>

        {/* ── Độ bục ── */}
        <Divider orientation="left" orientationMargin={0}>
          Độ bục (kgf/cm²)
          {bucTb != null && <Text type="secondary" style={{ marginLeft: 8 }}>TB: {bucTb.toFixed(3)}</Text>}
          <KQBadge kq={bucKq} />
        </Divider>
        {tc?.do_buc_tieu_chuan == null && tc && (
          <Alert type="warning" message="Chưa có TC độ bục — không đánh giá chỉ tiêu này" style={{ marginBottom: 8 }} showIcon />
        )}
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="buc_l1" label="L1"><InputNumber style={{ width: '100%' }} step={0.01} /></Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="buc_l2" label="L2"><InputNumber style={{ width: '100%' }} step={0.01} /></Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="buc_l3" label="L3"><InputNumber style={{ width: '100%' }} step={0.01} /></Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="buc_l4" label="L4"><InputNumber style={{ width: '100%' }} step={0.01} /></Form.Item>
          </Col>
        </Row>

        {/* ── Độ nén vòng ── */}
        <Divider orientation="left" orientationMargin={0}>
          Độ nén vòng (kgf/6inch)
          {nenTb != null && <Text type="secondary" style={{ marginLeft: 8 }}>TB: {nenTb.toFixed(3)}</Text>}
          <KQBadge kq={nenKq} />
        </Divider>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="nen_vong_l1" label="L1"><InputNumber style={{ width: '100%' }} step={0.01} /></Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="nen_vong_l2" label="L2"><InputNumber style={{ width: '100%' }} step={0.01} /></Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="nen_vong_l3" label="L3"><InputNumber style={{ width: '100%' }} step={0.01} /></Form.Item>
          </Col>
        </Row>

        {/* ── Kết quả tổng ── */}
        <Divider />
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <span style={{ marginRight: 8 }}>Kết quả tổng:</span>
          {ketQuaTong === 'dat' && <Tag color="green" style={{ fontSize: 16, padding: '4px 12px' }}>ĐẠT</Tag>}
          {ketQuaTong === 'khong_dat' && <Tag color="red" style={{ fontSize: 16, padding: '4px 12px' }}>KHÔNG ĐẠT</Tag>}
          {!ketQuaTong && <Tag color="default" style={{ fontSize: 14 }}>Chưa nhập số đo</Tag>}
        </div>

        <Form.Item name="ghi_chu" label="Ghi chú" style={{ marginTop: 16 }}>
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Drawer>
  )
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({ record, onClose }: { record: QCGiayCuon | null; onClose: () => void }) {
  if (!record) return null

  const rows = (
    label: string,
    vals: (number | null)[],
    tb: number | null,
    kq: string | null,
    tc: number | null,
    mode: 'dl' | 'min' | 'kho',
  ) => {
    const tcStr = tc != null
      ? mode === 'dl' ? `TC: ${tc}` : mode === 'min' ? `TC min: ${tc}` : `TC: ${tc} ± 4`
      : 'Chưa có TC'
    return (
      <Descriptions.Item label={label} span={3}>
        <Space wrap>
          {vals.map((v, i) => v != null && <Tag key={i}>L{i + 1}: {v}</Tag>)}
          {tb != null && <Tag color="blue">TB: {tb}</Tag>}
          <Text type="secondary">{tcStr}</Text>
          {ketQuaTag(kq)}
        </Space>
      </Descriptions.Item>
    )
  }

  return (
    <Drawer
      title={`Chi tiết phiếu ${record.so_phieu}`}
      width={640}
      open={!!record}
      onClose={onClose}
    >
      <Descriptions bordered column={2} size="small">
        <Descriptions.Item label="Số phiếu">{record.so_phieu}</Descriptions.Item>
        <Descriptions.Item label="Kết quả tổng">{ketQuaTag(record.ket_qua)}</Descriptions.Item>
        <Descriptions.Item label="Mã NVL">{record.paper_material_ma}</Descriptions.Item>
        <Descriptions.Item label="Tên NVL">{record.paper_material_ten}</Descriptions.Item>
        <Descriptions.Item label="NCC">{record.ncc_ten}</Descriptions.Item>
        <Descriptions.Item label="Ngày KT">{record.ngay_kiem_tra}</Descriptions.Item>
        <Descriptions.Item label="Ngày nhập">{record.ngay_nhap_giay ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="Người KT">{record.nguoi_kiem_tra ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="TL tem (KG)">{record.trong_luong_tem ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="Khổ TC/TT">
          {record.kho_tc ?? '—'} / {record.kho_thuc_te ?? '—'} cm {ketQuaTag(record.kho_ket_qua)}
        </Descriptions.Item>
      </Descriptions>

      <Divider orientation="left">Định lượng</Divider>
      <Descriptions bordered column={1} size="small">
        {rows('Đo', [record.dl_l1, record.dl_l2], record.dl_tb, record.dl_ket_qua, record.tc_dinh_luong, 'dl')}
      </Descriptions>

      <Divider orientation="left">Độ bục (kgf/cm²)</Divider>
      <Descriptions bordered column={1} size="small">
        {rows('Đo', [record.buc_l1, record.buc_l2, record.buc_l3, record.buc_l4], record.buc_tb, record.buc_ket_qua, record.tc_do_buc, 'min')}
      </Descriptions>

      <Divider orientation="left">Độ nén vòng (kgf/6inch)</Divider>
      <Descriptions bordered column={1} size="small">
        {rows('Đo', [record.nen_vong_l1, record.nen_vong_l2, record.nen_vong_l3], record.nen_vong_tb, record.nen_vong_ket_qua, record.tc_do_nen_vong, 'min')}
      </Descriptions>

      {record.ghi_chu && (
        <>
          <Divider orientation="left">Ghi chú</Divider>
          <Text>{record.ghi_chu}</Text>
        </>
      )}
    </Drawer>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function QCGiayCuonPage() {
  const qc = useQueryClient()
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null])
  const [filterKetQua, setFilterKetQua] = useState<string | undefined>()
  const [createOpen, setCreateOpen] = useState(false)
  const [detail, setDetail] = useState<QCGiayCuon | null>(null)

  const params = {
    tu_ngay: dateRange[0]?.format('YYYY-MM-DD'),
    den_ngay: dateRange[1]?.format('YYYY-MM-DD'),
    ket_qua: filterKetQua,
    limit: 200,
  }

  const { data: stats } = useQuery({
    queryKey: ['qc-gc-stats', params],
    queryFn: () => qcGiayCuonApi.stats(params),
  })

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['qc-gc-list', params],
    queryFn: () => qcGiayCuonApi.list(params),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => qcGiayCuonApi.delete(id),
    onSuccess: () => {
      message.success('Đã xóa phiếu')
      qc.invalidateQueries({ queryKey: ['qc-gc-list'] })
      qc.invalidateQueries({ queryKey: ['qc-gc-stats'] })
    },
  })

  const handleCreated = () => {
    qc.invalidateQueries({ queryKey: ['qc-gc-list'] })
    qc.invalidateQueries({ queryKey: ['qc-gc-stats'] })
  }

  const columns = [
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 160 },
    {
      title: 'Mã NVL',
      dataIndex: 'paper_material_ma',
      width: 180,
      render: (v: string, r: QCGiayCuon) => (
        <div>
          <div style={{ fontWeight: 500 }}>{v}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{r.ncc_ten}</div>
        </div>
      ),
    },
    { title: 'Ngày KT', dataIndex: 'ngay_kiem_tra', width: 110 },
    {
      title: 'Định lượng',
      width: 120,
      render: (_: unknown, r: QCGiayCuon) => (
        <Space size={4}>
          {r.dl_tb != null && <span>{r.dl_tb}</span>}
          {ketQuaTag(r.dl_ket_qua)}
        </Space>
      ),
    },
    {
      title: 'Độ bục',
      width: 120,
      render: (_: unknown, r: QCGiayCuon) => (
        <Space size={4}>
          {r.buc_tb != null && <span>{r.buc_tb?.toFixed(2)}</span>}
          {ketQuaTag(r.buc_ket_qua)}
        </Space>
      ),
    },
    {
      title: 'Nén vòng',
      width: 110,
      render: (_: unknown, r: QCGiayCuon) => (
        <Space size={4}>
          {r.nen_vong_tb != null && <span>{r.nen_vong_tb?.toFixed(2)}</span>}
          {ketQuaTag(r.nen_vong_ket_qua)}
        </Space>
      ),
    },
    {
      title: 'Khổ',
      width: 100,
      render: (_: unknown, r: QCGiayCuon) => (
        <Space size={4}>
          {r.kho_thuc_te != null && <span>{r.kho_thuc_te} cm</span>}
          {ketQuaTag(r.kho_ket_qua)}
        </Space>
      ),
    },
    {
      title: 'Kết quả',
      dataIndex: 'ket_qua',
      width: 110,
      render: (v: string | null) => ketQuaTag(v),
    },
    {
      title: '',
      width: 80,
      render: (_: unknown, r: QCGiayCuon) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetail(r)} />
          <Popconfirm title="Xóa phiếu này?" onConfirm={() => deleteMutation.mutate(r.id)} okText="Xóa" cancelText="Hủy">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>QC Giấy Cuộn</Title>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            Tạo phiếu
          </Button>
        </Col>
      </Row>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Tổng phiếu" value={stats?.tong ?? 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Đạt" value={stats?.dat ?? 0} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Không đạt" value={stats?.khong_dat ?? 0} valueStyle={{ color: '#f5222d' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Tỷ lệ đạt"
              value={stats?.ty_le_dat_pct ?? 0}
              suffix="%"
              valueStyle={{ color: (stats?.ty_le_dat_pct ?? 0) >= 90 ? '#52c41a' : '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <RangePicker
            format="DD/MM/YYYY"
            onChange={v => setDateRange(v ? [v[0], v[1]] : [null, null])}
          />
          <Select
            allowClear
            placeholder="Kết quả"
            style={{ width: 140 }}
            onChange={setFilterKetQua}
            options={[
              { value: 'dat', label: 'Đạt' },
              { value: 'khong_dat', label: 'Không đạt' },
            ]}
          />
        </Space>
      </Card>

      {/* Table */}
      <Table
                locale={{ emptyText: <EmptyState size="small" /> }}
                dataSource={list}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 50, showTotal: t => `${t} phiếu` }}
        scroll={{ x: 900 }}
      />

      <CreateDrawer open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
      <DetailDrawer record={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
