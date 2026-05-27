import { useEffect, useState } from 'react'
import type { ApiError } from '../../api/types'
import {
  Button, Card, Col, DatePicker, Descriptions, Drawer, Form, Input, InputNumber,
  Modal, Popconfirm, Row, Select, Space, Statistic, Table, Tabs, Tag, Typography, message,
} from 'antd'
import { EditOutlined, PlusOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import ImportExcelButton from '../../components/ImportExcelButton'
import {
  fixedAssetApi,
  type DepreciationEntry,
  type DepreciationReportItem,
  type FixedAsset,
} from '../../api/fixedAssets'
import { useAuthStore } from '../../store/auth'
import EmptyState from "../../components/EmptyState"

const { Title } = Typography

const FILTER_KEY = 'accounting.fixed_assets.filters'
const REPORT_FILTER_KEY = 'accounting.fixed_assets.report.filters'

const TRANG_THAI: Record<string, { label: string; color: string }> = {
  dang_su_dung: { label: 'Đang sử dụng', color: 'green' },
  da_kh_het: { label: 'Đã KH hết', color: 'blue' },
  thanh_ly: { label: 'Thanh lý', color: 'red' },
}

const fmt = (n: number) => Number(n || 0).toLocaleString('vi-VN')

function loadStoredFilters<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

function hasPermission(permissions: string[] | undefined, permission: string) {
  return Boolean(permissions?.includes(permission) || permissions?.includes('accounting.fixed_assets'))
}

function statusTag(v: string) {
  const s = TRANG_THAI[v] || { label: v, color: 'default' }
  return <Tag color={s.color}>{s.label}</Tag>
}

function khauHaoThang(asset: FixedAsset | DepreciationReportItem) {
  if (!asset.so_thang_khau_hao) return 0
  return Math.min(
    Number(asset.nguyen_gia) / asset.so_thang_khau_hao,
    Number(asset.nguyen_gia) - Number(asset.gia_tri_da_khau_hao),
  )
}

function DanhMucTab() {
  const queryClient = useQueryClient()
  const permissions = useAuthStore(s => s.user?.permissions)
  const canCreate = hasPermission(permissions, 'accounting.fixed_assets.create')
  const canUpdate = hasPermission(permissions, 'accounting.fixed_assets.update')
  const canDepreciate = hasPermission(permissions, 'accounting.fixed_assets.depreciate')
  const canImport = hasPermission(permissions, 'accounting.fixed_assets.import')
  const saved = loadStoredFilters(FILTER_KEY, {
    search: '',
    trangThai: undefined as string | undefined,
    phapNhanId: undefined as number | undefined,
    phanXuongId: undefined as number | undefined,
  })
  const [form] = Form.useForm()
  const [depForm] = Form.useForm()
  const [inputSearch, setInputSearch] = useState(saved.search)
  const [search, setSearch] = useState(saved.search)
  const [trangThai, setTrangThai] = useState<string | undefined>(saved.trangThai)
  const [phapNhanId, setPhapNhanId] = useState<number | undefined>(saved.phapNhanId)
  const [phanXuongId, setPhanXuongId] = useState<number | undefined>(saved.phanXuongId)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<FixedAsset | null>(null)
  const [detail, setDetail] = useState<FixedAsset | null>(null)
  const [depModal, setDepModal] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(inputSearch.trim()), 400)
    return () => window.clearTimeout(timer)
  }, [inputSearch])

  useEffect(() => {
    sessionStorage.setItem(FILTER_KEY, JSON.stringify({ search: inputSearch, trangThai, phapNhanId, phanXuongId }))
  }, [inputSearch, trangThai, phapNhanId, phanXuongId])

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['fixed-assets', search, trangThai, phapNhanId, phanXuongId],
    queryFn: () => fixedAssetApi.list({
      search: search || undefined,
      trang_thai: trangThai,
      phap_nhan_id: phapNhanId,
      phan_xuong_id: phanXuongId,
    }),
  })

  const { data: depEntries = [] } = useQuery({
    queryKey: ['fixed-asset-depreciation', detail?.id],
    queryFn: () => fixedAssetApi.depreciation(detail!.id),
    enabled: !!detail,
  })

  const createMut = useMutation({
    mutationFn: (values: Partial<FixedAsset>) => fixedAssetApi.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] })
      setCreateOpen(false)
      form.resetFields()
      message.success('Đã thêm TSCĐ')
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi lưu TSCĐ'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, values }: { id: number; values: Partial<FixedAsset> }) => fixedAssetApi.update(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] })
      setCreateOpen(false)
      setEditing(null)
      form.resetFields()
      message.success('Đã cập nhật TSCĐ')
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi cập nhật'),
  })

  const runDepMut = useMutation({
    mutationFn: (ky: string) => fixedAssetApi.runDepreciation(ky),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] })
      queryClient.invalidateQueries({ queryKey: ['fixed-asset-report'] })
      setDepModal(false)
      message.success(`Khấu hao ${data.ky}: ${data.so_tscd_da_kh} tài sản - ${fmt(data.tong_so_tien_kh)} đ`)
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi chạy khấu hao'),
  })

  const totalNguyenGia = assets.reduce((s, a) => s + Number(a.nguyen_gia), 0)
  const totalDaKhauHao = assets.reduce((s, a) => s + Number(a.gia_tri_da_khau_hao), 0)
  const dangDungCount = assets.filter(a => a.trang_thai === 'dang_su_dung').length

  function openCreate() {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      ngay_mua: dayjs(),
      so_thang_khau_hao: 36,
      tk_nguyen_gia: '211',
      tk_khau_hao: '214',
      tk_chi_phi: '154',
      bo_qua_hach_toan: false,
    })
    setCreateOpen(true)
  }

  function openEdit(asset: FixedAsset) {
    setEditing(asset)
    form.setFieldsValue({
      ...asset,
      ngay_mua: dayjs(asset.ngay_mua),
    })
    setCreateOpen(true)
  }

  function submitAsset(values: Partial<FixedAsset> & { ngay_mua?: { format: (f: string) => string } }) {
    const payload = {
      ...values,
      ngay_mua: values.ngay_mua ? values.ngay_mua.format('YYYY-MM-DD') : undefined,
    }
    if (editing) updateMut.mutate({ id: editing.id, values: payload })
    else createMut.mutate(payload)
  }

  const columns: ColumnsType<FixedAsset> = [
    { title: 'Mã TSCĐ', dataIndex: 'ma_ts', width: 120, render: t => <b>{t}</b> },
    { title: 'Tên tài sản', dataIndex: 'ten_ts', ellipsis: true },
    { title: 'Ngày mua', dataIndex: 'ngay_mua', width: 110, render: v => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Nguyên giá', dataIndex: 'nguyen_gia', align: 'right', width: 130, render: v => fmt(v) },
    { title: 'Đã KH', dataIndex: 'gia_tri_da_khau_hao', align: 'right', width: 130, render: v => fmt(v) },
    {
      title: 'Còn lại',
      align: 'right',
      width: 130,
      render: (_, r) => <b>{fmt(Number(r.nguyen_gia) - Number(r.gia_tri_da_khau_hao))}</b>,
    },
    { title: 'KH/tháng', align: 'right', width: 120, render: (_, r) => fmt(khauHaoThang(r)) },
    { title: 'Tháng KH', align: 'center', width: 100, render: (_, r) => `${r.da_khau_hao_thang}/${r.so_thang_khau_hao}` },
    { title: 'TK CP', dataIndex: 'tk_chi_phi', width: 80 },
    { title: 'TK HM', dataIndex: 'tk_khau_hao', width: 80 },
    { title: 'Trạng thái', dataIndex: 'trang_thai', width: 120, render: statusTag },
    {
      title: '',
      width: 170,
      render: (_, r) => (
        <Space size="small" wrap>
          <Button size="small" onClick={() => setDetail(r)}>Lịch sử</Button>
          {canUpdate && <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />}
        </Space>
      ),
    },
  ]

  return (
    <>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="Tổng nguyên giá" value={totalNguyenGia} formatter={v => fmt(Number(v))} suffix="đ" /></Card></Col>
        <Col span={6}><Card><Statistic title="Đã khấu hao" value={totalDaKhauHao} formatter={v => fmt(Number(v))} suffix="đ" /></Card></Col>
        <Col span={6}><Card><Statistic title="Còn lại" value={totalNguyenGia - totalDaKhauHao} formatter={v => fmt(Number(v))} suffix="đ" /></Card></Col>
        <Col span={6}><Card><Statistic title="Đang sử dụng" value={dangDungCount} /></Card></Col>
      </Row>

      <Space style={{ marginBottom: 12 }} wrap>
        <Input.Search
          allowClear
          placeholder="Tìm mã, tên tài sản..."
          style={{ width: 260 }}
          value={inputSearch}
          onChange={e => setInputSearch(e.target.value)}
          onSearch={v => { setInputSearch(v); setSearch(v.trim()) }}
        />
        <Select
          allowClear
          placeholder="Trạng thái"
          style={{ width: 160 }}
          value={trangThai}
          onChange={setTrangThai}
          options={Object.entries(TRANG_THAI).map(([value, info]) => ({ value, label: info.label }))}
        />
        <InputNumber placeholder="Pháp nhân ID" value={phapNhanId} onChange={v => setPhapNhanId(v || undefined)} />
        <InputNumber placeholder="Phân xưởng ID" value={phanXuongId} onChange={v => setPhanXuongId(v || undefined)} />
        <Button onClick={() => { setInputSearch(''); setSearch(''); setTrangThai(undefined); setPhapNhanId(undefined); setPhanXuongId(undefined) }}>
          Xóa lọc
        </Button>
        {canImport && (
          <ImportExcelButton
            endpoint="/fixed-assets"
            templateFilename="mau_import_tai_san_co_dinh.xlsx"
            buttonText="Import TSCĐ"
            onImported={() => queryClient.invalidateQueries({ queryKey: ['fixed-assets'] })}
          />
        )}
        {canDepreciate && <Button icon={<PlayCircleOutlined />} onClick={() => setDepModal(true)}>Chạy khấu hao kỳ</Button>}
        {canCreate && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Thêm TSCĐ</Button>}
      </Space>

      <Table
                locale={{ emptyText: <EmptyState size="small" /> }}
                rowKey="id"
        loading={isLoading}
        dataSource={assets}
        columns={columns}
        pagination={{ pageSize: 20 }}
        size="small"
        scroll={{ x: 1300 }}
      />

      <Drawer
        title={editing ? 'Sửa TSCĐ' : 'Thêm TSCĐ mới'}
        open={createOpen}
        onClose={() => { setCreateOpen(false); setEditing(null); form.resetFields() }}
        width={520}
        footer={<Space><Button onClick={() => setCreateOpen(false)}>Hủy</Button><Button type="primary" loading={createMut.isPending || updateMut.isPending} onClick={() => form.submit()}>Lưu</Button></Space>}
      >
        <Form form={form} layout="vertical" onFinish={submitAsset}>
          <Form.Item name="ma_ts" label="Mã TSCĐ" rules={[{ required: true }]}><Input disabled={!!editing} /></Form.Item>
          <Form.Item name="ten_ts" label="Tên tài sản" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="ngay_mua" label="Ngày mua" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="nguyen_gia" label="Nguyên giá (đ)" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} disabled={!!editing} /></Form.Item>
          <Form.Item name="so_thang_khau_hao" label="Thời gian KH (tháng)" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} disabled={!!editing} /></Form.Item>
          <Space>
            <Form.Item name="phap_nhan_id" label="Pháp nhân ID"><InputNumber style={{ width: 150 }} /></Form.Item>
            <Form.Item name="phan_xuong_id" label="Phân xưởng ID"><InputNumber style={{ width: 150 }} /></Form.Item>
          </Space>
          <Space>
            <Form.Item name="tk_nguyen_gia" label="TK nguyên giá"><Input style={{ width: 120 }} /></Form.Item>
            <Form.Item name="tk_khau_hao" label="TK hao mòn"><Input style={{ width: 120 }} /></Form.Item>
            <Form.Item name="tk_chi_phi" label="TK chi phí"><Input style={{ width: 120 }} /></Form.Item>
          </Space>
          {editing && (
            <Form.Item name="trang_thai" label="Trạng thái">
              <Select options={Object.entries(TRANG_THAI).map(([value, info]) => ({ value, label: info.label }))} />
            </Form.Item>
          )}
          <Form.Item name="bo_qua_hach_toan" label="Bỏ qua hạch toán tự động">
            <Select
              options={[
                { value: false, label: 'Không' },
                { value: true, label: 'Có' },
              ]}
            />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer title={`Lịch sử KH - ${detail?.ma_ts}`} open={!!detail} onClose={() => setDetail(null)} width={520}>
        {detail && (
          <>
            <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Nguyên giá">{fmt(detail.nguyen_gia)} đ</Descriptions.Item>
              <Descriptions.Item label="Đã KH">{fmt(detail.gia_tri_da_khau_hao)} đ</Descriptions.Item>
              <Descriptions.Item label="Tháng KH">{detail.da_khau_hao_thang}/{detail.so_thang_khau_hao}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">{statusTag(detail.trang_thai)}</Descriptions.Item>
            </Descriptions>
            <Table<DepreciationEntry>
              rowKey="id"
              size="small"
              dataSource={depEntries}
              pagination={false}
              columns={[
                { title: 'Kỳ', dataIndex: 'ky' },
                { title: 'Số tiền KH', dataIndex: 'so_tien_kh', align: 'right', render: v => fmt(v) },
                { title: 'Lũy kế KH', dataIndex: 'gia_tri_da_kh_sau', align: 'right', render: v => fmt(v) },
                { title: 'Bút toán', dataIndex: 'journal_entry_id', align: 'right' },
              ]}
            />
          </>
        )}
      </Drawer>

      <Modal title="Chạy khấu hao kỳ" open={depModal} onCancel={() => setDepModal(false)} onOk={() => depForm.submit()} confirmLoading={runDepMut.isPending} okText="Chạy khấu hao">
        <Form form={depForm} layout="vertical" onFinish={(v) => runDepMut.mutate(v.ky.format('YYYY-MM'))}>
          <Form.Item name="ky" label="Kỳ khấu hao" rules={[{ required: true }]} initialValue={dayjs()}>
            <DatePicker picker="month" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

function BaoCaoKhauHaoTab() {
  const queryClient = useQueryClient()
  const permissions = useAuthStore(s => s.user?.permissions)
  const canDepreciate = hasPermission(permissions, 'accounting.fixed_assets.depreciate')
  const saved = loadStoredFilters(REPORT_FILTER_KEY, { ky: dayjs().format('YYYY-MM') })
  const [ky, setKy] = useState(saved.ky)

  useEffect(() => {
    sessionStorage.setItem(REPORT_FILTER_KEY, JSON.stringify({ ky }))
  }, [ky])

  const { data, isLoading } = useQuery({
    queryKey: ['fixed-asset-report', ky],
    queryFn: () => fixedAssetApi.depreciationReport({ ky }),
  })

  const runAssetMut = useMutation({
    mutationFn: (id: number) => fixedAssetApi.runAssetDepreciation(id, ky),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] })
      queryClient.invalidateQueries({ queryKey: ['fixed-asset-report'] })
      message.success('Đã hạch toán khấu hao tài sản')
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi khấu hao tài sản'),
  })

  const runAllMut = useMutation({
    mutationFn: () => fixedAssetApi.runDepreciation(ky),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] })
      queryClient.invalidateQueries({ queryKey: ['fixed-asset-report'] })
      message.success(`Đã khấu hao ${result.so_tscd_da_kh} tài sản`)
    },
    onError: (e: { response?: { data?: { detail?: string } } }) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi khi chạy khấu hao'),
  })

  const columns: ColumnsType<DepreciationReportItem> = [
    { title: 'Mã TSCĐ', dataIndex: 'ma_ts', width: 120, render: t => <b>{t}</b> },
    { title: 'Tên tài sản', dataIndex: 'ten_ts', ellipsis: true },
    { title: 'Nguyên giá', dataIndex: 'nguyen_gia', align: 'right', width: 130, render: v => fmt(v) },
    { title: 'Còn lại', dataIndex: 'gia_tri_con_lai', align: 'right', width: 130, render: v => fmt(v) },
    { title: 'Tháng KH', align: 'center', width: 100, render: (_, r) => `${r.da_khau_hao_thang}/${r.so_thang_khau_hao}` },
    { title: 'Dự kiến', dataIndex: 'so_tien_du_kien', align: 'right', width: 130, render: v => fmt(v) },
    { title: 'Đã hạch toán', dataIndex: 'so_tien_da_hach_toan', align: 'right', width: 140, render: v => fmt(v) },
    { title: 'Trạng thái', dataIndex: 'da_hach_toan', width: 130, render: v => v ? <Tag color="green">Đã hạch toán</Tag> : <Tag color="orange">Chưa hạch toán</Tag> },
    {
      title: '',
      width: 120,
      render: (_, r) => (
        canDepreciate && !r.da_hach_toan && Number(r.so_tien_du_kien) > 0 ? (
          <Popconfirm title={`Hạch toán khấu hao kỳ ${ky}?`} onConfirm={() => runAssetMut.mutate(r.id)}>
            <Button size="small" loading={runAssetMut.isPending}>KH kỳ này</Button>
          </Popconfirm>
        ) : null
      ),
    },
  ]

  return (
    <>
      <Space style={{ marginBottom: 12 }} wrap>
        <DatePicker picker="month" format="MM/YYYY" value={dayjs(`${ky}-01`)} onChange={v => v && setKy(v.format('YYYY-MM'))} />
        <Tag color="blue">Dự kiến: {fmt(Number(data?.tong_du_kien || 0))}</Tag>
        <Tag color="green">Đã hạch toán: {fmt(Number(data?.tong_da_hach_toan || 0))}</Tag>
        {canDepreciate && (
          <Popconfirm title={`Chạy khấu hao toàn kỳ ${ky}?`} onConfirm={() => runAllMut.mutate()}>
            <Button icon={<PlayCircleOutlined />} loading={runAllMut.isPending}>Chạy toàn kỳ</Button>
          </Popconfirm>
        )}
      </Space>
      <Table rowKey="id" loading={isLoading} dataSource={data?.items || []} columns={columns} pagination={{ pageSize: 20 }} size="small" scroll={{ x: 1100 }} />
    </>
  )
}

export default function FixedAssetPage() {
  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 16 }} align="middle">
        <Col><Title level={4} style={{ margin: 0 }}>Tài sản cố định (TSCĐ)</Title></Col>
      </Row>
      <Card>
        <Tabs
          items={[
            { key: 'danh-muc', label: 'Danh mục TSCĐ', children: <DanhMucTab /> },
            { key: 'khau-hao', label: 'Báo cáo khấu hao', children: <BaoCaoKhauHaoTab /> },
          ]}
        />
      </Card>
    </div>
  )
}
