import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Button, Card, Col, DatePicker, Descriptions, Divider, Drawer,
  Form, Input, Popconfirm, Row, Select, Space, Statistic, Table, Tag, Typography, message,
} from 'antd'
import { PlusOutlined, DeleteOutlined, EyeOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { qcNvlApi, QCNvl, QCNvlCreatePayload, QCNvlItemResult, ChiTieuItem, TieuChuanInfo } from '../../api/qcNvl'
import client from '../../api/client'
import EmptyState from '../../components/EmptyState'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

// ── Helpers ──────────────────────────────────────────────────────────────────

function ketQuaTag(val: string | null) {
  if (!val) return <Tag>Chưa đánh giá</Tag>
  return val === 'dat'
    ? <Tag color="green">Đạt</Tag>
    : <Tag color="red">Không đạt</Tag>
}

function autoEval(
  kieu: string,
  ketQuaDo: string | null,
  min: number | null,
  max: number | null,
): 'dat' | 'khong_dat' | null {
  if (!ketQuaDo) return null
  const num = parseFloat(ketQuaDo)
  if (isNaN(num)) return null
  if (kieu === 'range' && min != null && max != null) return num >= min && num <= max ? 'dat' : 'khong_dat'
  if (kieu === 'min' && min != null) return num >= min ? 'dat' : 'khong_dat'
  if (kieu === 'max' && max != null) return num <= max ? 'dat' : 'khong_dat'
  return null
}

// ── Chi tiêu row trong form ────────────────────────────────────────────────

function ChiTieuFormRow({
  ct,
  value,
  onChange,
}: {
  ct: ChiTieuItem
  value: QCNvlItemResult
  onChange: (v: QCNvlItemResult) => void
}) {
  const autoKq = autoEval(ct.kieu_kiem_tra, value.ket_qua_do ?? null, ct.gia_tri_min, ct.gia_tri_max)

  const handleDoChange = (val: string) => {
    const computed = autoEval(ct.kieu_kiem_tra, val, ct.gia_tri_min, ct.gia_tri_max)
    onChange({ ...value, ket_qua_do: val, ket_qua: computed ?? value.ket_qua })
  }

  const handleKqChange = (kq: 'dat' | 'khong_dat') => {
    onChange({ ...value, ket_qua: kq })
  }

  const yeuCauStr = ct.yeu_cau_text ?? (
    ct.kieu_kiem_tra === 'range' && ct.gia_tri_min != null && ct.gia_tri_max != null
      ? `${ct.gia_tri_min} – ${ct.gia_tri_max}${ct.don_vi ? ' ' + ct.don_vi : ''}`
      : ct.kieu_kiem_tra === 'min' && ct.gia_tri_min != null
        ? `≥ ${ct.gia_tri_min}${ct.don_vi ? ' ' + ct.don_vi : ''}`
        : ct.kieu_kiem_tra === 'max' && ct.gia_tri_max != null
          ? `≤ ${ct.gia_tri_max}${ct.don_vi ? ' ' + ct.don_vi : ''}`
          : '—'
  )

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
      <div style={{ width: 28, color: '#888', fontSize: 12 }}>{ct.stt}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: 13 }}>
          {ct.ten_chi_tieu}
          {ct.bat_buoc && <span style={{ color: '#f5222d', marginLeft: 2 }}>*</span>}
        </div>
        <div style={{ color: '#888', fontSize: 11 }}>Yêu cầu: {yeuCauStr}</div>
      </div>
      <Input
        placeholder="Kết quả đo"
        style={{ width: 110 }}
        value={value.ket_qua_do ?? ''}
        onChange={e => handleDoChange(e.target.value)}
        suffix={ct.don_vi ? <span style={{ color: '#999', fontSize: 11 }}>{ct.don_vi}</span> : undefined}
      />
      {ct.kieu_kiem_tra === 'pass_fail' ? (
        <Select
          style={{ width: 120 }}
          value={value.ket_qua ?? undefined}
          placeholder="Đạt / KĐạt"
          onChange={handleKqChange}
          options={[
            { value: 'dat', label: 'Đạt' },
            { value: 'khong_dat', label: 'Không đạt' },
          ]}
        />
      ) : (
        <div style={{ width: 120, textAlign: 'center' }}>
          {value.ket_qua === 'dat' && (
            <Tag color="green" icon={<CheckCircleOutlined />}>Đạt</Tag>
          )}
          {value.ket_qua === 'khong_dat' && (
            <Tag color="red" icon={<CloseCircleOutlined />}>KĐạt</Tag>
          )}
          {!value.ket_qua && autoKq && (
            autoKq === 'dat'
              ? <Tag color="green" icon={<CheckCircleOutlined />}>Đạt</Tag>
              : <Tag color="red" icon={<CloseCircleOutlined />}>KĐạt</Tag>
          )}
          {!value.ket_qua && !autoKq && <Tag>—</Tag>}
        </div>
      )}
    </div>
  )
}

// ── Create Drawer ─────────────────────────────────────────────────────────────

function CreateDrawer({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form] = Form.useForm()
  const [tcInfo, setTcInfo] = useState<TieuChuanInfo | null>(null)
  const [items, setItems] = useState<QCNvlItemResult[]>([])
  const [omSearch, setOmSearch] = useState('')
  const [omOptions, setOmOptions] = useState<{ value: number; label: string }[]>([])

  const ketQuaTong: 'dat' | 'khong_dat' | null = (() => {
    const filled = items.filter(i => i.ket_qua != null)
    if (!filled.length) return null
    return filled.every(i => i.ket_qua === 'dat') ? 'dat' : 'khong_dat'
  })()

  const handleOmSearch = useCallback(async (val: string) => {
    setOmSearch(val)
    if (!val || val.length < 2) { setOmOptions([]); return }
    try {
      const res = await client.get<{ id: number; value: string; label: string; ten: string }[]>(
        '/other-materials/search', { params: { q: val, limit: 30 } }
      )
      setOmOptions(res.data.map(d => ({ value: d.id, label: d.label })))
    } catch { setOmOptions([]) }
  }, [])

  const handleOmSelect = useCallback(async (id: number) => {
    try {
      const info = await qcNvlApi.getTieuChuan(id)
      setTcInfo(info)
      if (info.chi_tieu_list?.length) {
        setItems(info.chi_tieu_list.map(ct => ({
          stt: ct.stt,
          ten_chi_tieu: ct.ten_chi_tieu,
          yeu_cau: ct.yeu_cau_text ?? null,
          ket_qua_do: null,
          ket_qua: null,
          ghi_chu: null,
        })))
        if (info.tieu_chuan_id) form.setFieldValue('tieu_chuan_id', info.tieu_chuan_id)
      } else {
        setItems([])
        setTcInfo(info)
      }
    } catch { setTcInfo(null); setItems([]) }
  }, [form])

  const mutation = useMutation({
    mutationFn: (payload: QCNvlCreatePayload) => qcNvlApi.create(payload),
    onSuccess: () => {
      message.success('Tạo phiếu QC NVL thành công')
      form.resetFields()
      setTcInfo(null)
      setItems([])
      onCreated()
      onClose()
    },
    onError: () => message.error('Lỗi khi tạo phiếu'),
  })

  const handleSubmit = () => {
    form.validateFields().then(vals => {
      const payload: QCNvlCreatePayload = {
        ...vals,
        ngay_kiem_tra: vals.ngay_kiem_tra?.format('YYYY-MM-DD'),
        items_json: items.length > 0 ? items : null,
      }
      mutation.mutate(payload)
    })
  }

  const handleClose = () => {
    form.resetFields()
    setTcInfo(null)
    setItems([])
    onClose()
  }

  const updateItem = (idx: number, val: QCNvlItemResult) => {
    setItems(prev => prev.map((it, i) => i === idx ? val : it))
  }

  return (
    <Drawer
      title="Tạo phiếu QC NVL"
      width={680}
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
        <Form.Item
          name="other_material_id"
          label="Loại NVL"
          rules={[{ required: true, message: 'Chọn NVL' }]}
        >
          <Select
            showSearch
            placeholder="Tìm mã NVL (keo, băng keo, mực in...)"
            filterOption={false}
            onSearch={handleOmSearch}
            onSelect={handleOmSelect}
            notFoundContent={omSearch.length < 2 ? 'Nhập ít nhất 2 ký tự' : 'Không tìm thấy'}
            options={omOptions}
          />
        </Form.Item>

        {tcInfo && !tcInfo.chi_tieu_list?.length && (
          <Alert
            type="warning"
            showIcon
            message={`NVL "${tcInfo.ten_vt}" chưa có danh sách chỉ tiêu`}
            description="Vào Danh mục → Tiêu chuẩn kỹ thuật để thêm chỉ tiêu, sau đó gán vào NVL này."
            style={{ marginBottom: 16 }}
          />
        )}

        {tcInfo?.chi_tieu_list?.length ? (
          <Alert
            type="info"
            message={`Tiêu chuẩn: ${tcInfo.tieu_chuan_ten ?? tcInfo.tieu_chuan_ma ?? '—'} (${tcInfo.chi_tieu_list.length} chỉ tiêu)`}
            style={{ marginBottom: 12 }}
          />
        ) : null}

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="ngay_kiem_tra" label="Ngày kiểm tra" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" defaultValue={dayjs()} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="nguoi_kiem_tra" label="Người kiểm tra">
              <Input />
            </Form.Item>
          </Col>
        </Row>

        {/* Danh sách chỉ tiêu */}
        {items.length > 0 && (
          <>
            <Divider orientation="left" orientationMargin={0}>Kết quả kiểm tra từng chỉ tiêu</Divider>
            {items.map((item, idx) => {
              const ct = tcInfo!.chi_tieu_list![idx]
              return (
                <ChiTieuFormRow
                  key={item.stt}
                  ct={ct}
                  value={item}
                  onChange={val => updateItem(idx, val)}
                />
              )
            })}

            <Divider />
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <span style={{ marginRight: 8 }}>Kết quả tổng:</span>
              {ketQuaTong === 'dat' && <Tag color="green" style={{ fontSize: 16, padding: '4px 12px' }}>ĐẠT</Tag>}
              {ketQuaTong === 'khong_dat' && <Tag color="red" style={{ fontSize: 16, padding: '4px 12px' }}>KHÔNG ĐẠT</Tag>}
              {!ketQuaTong && <Tag color="default" style={{ fontSize: 14 }}>Chưa đánh giá</Tag>}
            </div>
          </>
        )}

        <Form.Item name="ghi_chu" label="Ghi chú" style={{ marginTop: 12 }}>
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Drawer>
  )
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({ record, onClose }: { record: QCNvl | null; onClose: () => void }) {
  if (!record) return null

  const columns = [
    { title: 'STT', dataIndex: 'stt', width: 50 },
    { title: 'Chỉ tiêu', dataIndex: 'ten_chi_tieu' },
    { title: 'Yêu cầu', dataIndex: 'yeu_cau', width: 130 },
    { title: 'Kết quả đo', dataIndex: 'ket_qua_do', width: 110 },
    {
      title: 'Đánh giá',
      dataIndex: 'ket_qua',
      width: 110,
      render: (v: string | null) => ketQuaTag(v),
    },
    { title: 'Ghi chú', dataIndex: 'ghi_chu', width: 140 },
  ]

  return (
    <Drawer
      title={`Chi tiết phiếu ${record.so_phieu}`}
      width={700}
      open={!!record}
      onClose={onClose}
    >
      <Descriptions bordered column={2} size="small">
        <Descriptions.Item label="Số phiếu">{record.so_phieu}</Descriptions.Item>
        <Descriptions.Item label="Kết quả">{ketQuaTag(record.ket_qua)}</Descriptions.Item>
        <Descriptions.Item label="Mã NVL">{record.other_material_ma}</Descriptions.Item>
        <Descriptions.Item label="Tên NVL">{record.other_material_ten}</Descriptions.Item>
        <Descriptions.Item label="NCC">{record.ncc_ten ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="Ngày KT">{record.ngay_kiem_tra}</Descriptions.Item>
        <Descriptions.Item label="Người KT">{record.nguoi_kiem_tra ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="Tiêu chuẩn">{record.tieu_chuan_ten ?? '—'}</Descriptions.Item>
      </Descriptions>

      {record.items_json?.length ? (
        <>
          <Divider orientation="left">Kết quả từng chỉ tiêu</Divider>
          <Table
            dataSource={record.items_json}
            columns={columns}
            rowKey="stt"
            size="small"
            pagination={false}
            rowClassName={r => r.ket_qua === 'khong_dat' ? 'row-red' : ''}
          />
        </>
      ) : (
        <Alert type="info" message="Phiếu không có danh sách chỉ tiêu chi tiết" style={{ marginTop: 16 }} />
      )}

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

export default function QCNvlPage() {
  const qc = useQueryClient()
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null])
  const [filterKetQua, setFilterKetQua] = useState<string | undefined>()
  const [createOpen, setCreateOpen] = useState(false)
  const [detail, setDetail] = useState<QCNvl | null>(null)

  const params = {
    tu_ngay: dateRange[0]?.format('YYYY-MM-DD'),
    den_ngay: dateRange[1]?.format('YYYY-MM-DD'),
    ket_qua: filterKetQua,
    limit: 200,
  }

  const { data: stats } = useQuery({
    queryKey: ['qc-nvl-stats', params],
    queryFn: () => qcNvlApi.stats(params),
  })

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['qc-nvl-list', params],
    queryFn: () => qcNvlApi.list(params),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => qcNvlApi.delete(id),
    onSuccess: () => {
      message.success('Đã xóa phiếu')
      qc.invalidateQueries({ queryKey: ['qc-nvl-list'] })
      qc.invalidateQueries({ queryKey: ['qc-nvl-stats'] })
    },
  })

  const handleCreated = () => {
    qc.invalidateQueries({ queryKey: ['qc-nvl-list'] })
    qc.invalidateQueries({ queryKey: ['qc-nvl-stats'] })
  }

  const columns = [
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 170 },
    {
      title: 'Tên NVL',
      width: 220,
      render: (_: unknown, r: QCNvl) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.other_material_ten}</div>
          <div style={{ fontSize: 11, color: '#888' }}>{r.other_material_ma} {r.ncc_ten ? `· ${r.ncc_ten}` : ''}</div>
        </div>
      ),
    },
    { title: 'Ngày KT', dataIndex: 'ngay_kiem_tra', width: 110 },
    { title: 'Người KT', dataIndex: 'nguoi_kiem_tra', width: 120 },
    {
      title: 'Chỉ tiêu',
      width: 80,
      render: (_: unknown, r: QCNvl) => (
        <Tag>{r.items_json?.length ?? 0}</Tag>
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
      render: (_: unknown, r: QCNvl) => (
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
          <Title level={4} style={{ margin: 0 }}>QC Nguyên Vật Liệu</Title>
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

      <Table
        locale={{ emptyText: <EmptyState size="small" /> }}
        dataSource={list}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 50, showTotal: t => `${t} phiếu` }}
        scroll={{ x: 800 }}
      />

      <CreateDrawer open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
      <DetailDrawer record={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
