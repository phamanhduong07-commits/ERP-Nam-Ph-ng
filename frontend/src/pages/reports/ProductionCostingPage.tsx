import React, { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalculatorOutlined,
  CheckCircleOutlined,
  FileSearchOutlined,
  FundOutlined,
  PlusOutlined,
  ReloadOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import {
  productionCostApi,
  type ProductionCostAllocation,
  type ProductionCostInput,
  type ProductionCostPeriod,
  type ProductionCostPeriodListResponse,
} from '../../api/accounting'
import { usePhanXuong, usePhapNhan } from '../../hooks/useMasterData'
import { fmtVND } from '../../utils/exportUtils'

const { RangePicker } = DatePicker
const { Title, Text } = Typography

type PeriodFilters = {
  phap_nhan_id?: number
  phan_xuong_id?: number
  trang_thai?: string
}

type CreatePeriodForm = {
  ma_ky?: string
  ten_ky?: string
  range: [Dayjs, Dayjs]
  phap_nhan_id?: number
  phan_xuong_id?: number
  ghi_chu?: string
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  nhap: { label: 'Nhập', color: 'default' },
  dang_tinh: { label: 'Đang tính', color: 'processing' },
  da_chot: { label: 'Đã chốt', color: 'green' },
  huy: { label: 'Hủy', color: 'red' },
}

const SOURCE_META: Record<string, { label: string; color: string }> = {
  nvl: { label: 'NVL', color: 'blue' },
  san_luong: { label: 'Sản lượng', color: 'green' },
  nhan_cong: { label: 'Nhân công', color: 'orange' },
  sxc: { label: 'SXC', color: 'purple' },
  khau_hao: { label: 'Khấu hao', color: 'cyan' },
}

const numberText = (value: number | null | undefined, suffix = '') => {
  if (value == null) return '-'
  return `${new Intl.NumberFormat('vi-VN').format(Number(value))}${suffix}`
}

const moneyText = (value: number | null | undefined) => `${fmtVND(value)} đ`

const ProductionCostingPage: React.FC = () => {
  const queryClient = useQueryClient()
  const { phanXuongList, isLoading: loadingPhanXuong } = usePhanXuong()
  const { phapNhanList, isLoading: loadingPhapNhan } = usePhapNhan()
  const [filterForm] = Form.useForm<PeriodFilters>()
  const [createForm] = Form.useForm<CreatePeriodForm>()
  const [filters, setFilters] = useState<PeriodFilters>({})
  const [createOpen, setCreateOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | undefined>()

  const phapNhanOptions = useMemo(
    () => phapNhanList.map(item => ({ value: item.id, label: item.ten_viet_tat || item.ten_phap_nhan })),
    [phapNhanList],
  )
  const phanXuongOptions = useMemo(
    () => phanXuongList.map(item => ({ value: item.id, label: item.ten_xuong })),
    [phanXuongList],
  )

  const phapNhanName = (id: number | null | undefined) =>
    id ? phapNhanList.find(item => item.id === id)?.ten_viet_tat || phapNhanList.find(item => item.id === id)?.ten_phap_nhan || `#${id}` : 'Tất cả'
  const phanXuongName = (id: number | null | undefined) =>
    id ? phanXuongList.find(item => item.id === id)?.ten_xuong || `#${id}` : 'Tất cả'

  const periodsQuery = useQuery<ProductionCostPeriodListResponse>({
    queryKey: ['production-cost-periods', filters],
    queryFn: () => productionCostApi.list(filters),
  })

  const periods = periodsQuery.data?.items ?? []
  const currentPeriodId = selectedPeriodId ?? periods[0]?.id

  const detailQuery = useQuery({
    queryKey: ['production-cost-period', currentPeriodId],
    queryFn: () => productionCostApi.get(currentPeriodId as number),
    enabled: !!currentPeriodId,
  })

  const currentPeriod = detailQuery.data ?? periods.find(item => item.id === currentPeriodId)
  const isClosed = currentPeriod?.trang_thai === 'da_chot'

  const previewQuery = useQuery({
    queryKey: ['production-cost-preview', currentPeriodId],
    queryFn: () => productionCostApi.preview(currentPeriodId as number),
    enabled: false,
  })

  const refreshPeriod = async (id?: number) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['production-cost-periods'] }),
      id ? queryClient.invalidateQueries({ queryKey: ['production-cost-period', id] }) : Promise.resolve(),
      id ? queryClient.invalidateQueries({ queryKey: ['production-cost-preview', id] }) : Promise.resolve(),
    ])
  }

  const createMutation = useMutation({
    mutationFn: (values: CreatePeriodForm) =>
      productionCostApi.create({
        ma_ky: values.ma_ky?.trim() || undefined,
        ten_ky: values.ten_ky?.trim() || undefined,
        tu_ngay: values.range[0].format('YYYY-MM-DD'),
        den_ngay: values.range[1].format('YYYY-MM-DD'),
        phap_nhan_id: values.phap_nhan_id ?? null,
        phan_xuong_id: values.phan_xuong_id ?? null,
        tieu_thuc_pb: 'san_luong',
        ghi_chu: values.ghi_chu?.trim() || null,
      }),
    onSuccess: async period => {
      message.success('Đã tạo kỳ giá thành')
      setCreateOpen(false)
      createForm.resetFields()
      setSelectedPeriodId(period.id)
      await refreshPeriod(period.id)
    },
    onError: (err: Error) => message.error(`Lỗi tạo kỳ: ${err.message}`),
  })

  const collectMutation = useMutation({
    mutationFn: (id: number) => productionCostApi.collectInputs(id),
    onSuccess: async data => {
      message.success(`Đã thu thập ${data.created_inputs} dòng dữ liệu`)
      setSelectedPeriodId(data.period.id)
      await refreshPeriod(data.period.id)
    },
    onError: (err: Error) => message.error(`Lỗi lấy dữ liệu: ${err.message}`),
  })

  const calculateMutation = useMutation({
    mutationFn: (id: number) => productionCostApi.calculate(id),
    onSuccess: async period => {
      message.success('Đã tính giá thành')
      setSelectedPeriodId(period.id)
      await refreshPeriod(period.id)
    },
    onError: (err: Error) => message.error(`Lỗi tính giá thành: ${err.message}`),
  })

  const closeMutation = useMutation({
    mutationFn: (id: number) => productionCostApi.close(id),
    onSuccess: async period => {
      message.success('Đã chốt kỳ giá thành')
      setSelectedPeriodId(period.id)
      await refreshPeriod(period.id)
    },
    onError: (err: Error) => message.error(`Lỗi chốt kỳ: ${err.message}`),
  })

  const periodColumns: ColumnsType<ProductionCostPeriod> = [
    {
      title: 'Kỳ',
      dataIndex: 'ma_ky',
      width: 180,
      fixed: 'left',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.ma_ky}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.ten_ky}</Text>
        </Space>
      ),
    },
    {
      title: 'Thời gian',
      width: 170,
      render: (_, record) => `${dayjs(record.tu_ngay).format('DD/MM/YYYY')} - ${dayjs(record.den_ngay).format('DD/MM/YYYY')}`,
    },
    { title: 'Pháp nhân', dataIndex: 'phap_nhan_id', width: 140, render: phapNhanName },
    { title: 'Phân xưởng', dataIndex: 'phan_xuong_id', width: 150, render: phanXuongName },
    { title: 'Chi phí', dataIndex: 'tong_chi_phi', width: 140, align: 'right', render: moneyText },
    { title: 'Sản lượng', dataIndex: 'tong_san_luong', width: 120, align: 'right', render: (v: number) => numberText(v) },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 110,
      render: (value: string) => {
        const meta = STATUS_META[value] ?? { label: value, color: 'default' }
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
  ]

  const inputColumns: ColumnsType<ProductionCostInput> = [
    {
      title: 'Nguồn',
      dataIndex: 'source_type',
      width: 115,
      render: (value: string) => {
        const meta = SOURCE_META[value] ?? { label: value, color: 'default' }
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    { title: 'Lệnh SX', dataIndex: 'production_order_id', width: 95, render: (v: number | null) => v ? `#${v}` : '-' },
    { title: 'Bảng nguồn', dataIndex: 'source_table', width: 145, render: (v: string | null) => v || '-' },
    { title: 'Số tiền', dataIndex: 'so_tien', width: 130, align: 'right', render: moneyText },
    { title: 'Số lượng', dataIndex: 'so_luong', width: 110, align: 'right', render: (v: number | null) => v ? numberText(v) : '-' },
    { title: 'Diễn giải', dataIndex: 'dien_giai', ellipsis: true, render: (v: string | null) => v || '-' },
  ]

  const allocationColumns: ColumnsType<ProductionCostAllocation> = [
    {
      title: 'Lệnh SX',
      key: 'lenh_sx',
      width: 160,
      render: (_: unknown, record: ProductionCostAllocation) => record.so_lenh
        ? <Space direction="vertical" size={0}><Text strong style={{ fontSize: 12 }}>{record.so_lenh}</Text><Text type="secondary" style={{ fontSize: 11 }}>{record.ten_hang || ''}</Text></Space>
        : record.production_order_id ? `#${record.production_order_id}` : '-',
    },
    { title: 'Sản lượng', dataIndex: 'san_luong', width: 115, align: 'right', render: (v: number) => numberText(v) },
    { title: 'Tỷ lệ', dataIndex: 'ty_le', width: 90, align: 'right', render: (v: number) => `${(Number(v || 0) * 100).toFixed(2)}%` },
    { title: 'NVL', dataIndex: 'chi_phi_nvl', width: 130, align: 'right', render: moneyText },
    { title: 'Nhân công', dataIndex: 'chi_phi_nhan_cong', width: 130, align: 'right', render: moneyText },
    { title: 'SXC', dataIndex: 'chi_phi_sxc', width: 130, align: 'right', render: moneyText },
    { title: 'Tổng CP', dataIndex: 'tong_chi_phi', width: 140, align: 'right', render: (v: number) => <Text strong>{moneyText(v)}</Text> },
    { title: 'Giá thành/ĐV', dataIndex: 'gia_thanh_don_vi', width: 140, align: 'right', render: (v: number) => <Text strong>{moneyText(v)}</Text> },
  ]

  const runPreview = async () => {
    if (!currentPeriodId) return
    setPreviewOpen(true)
    await previewQuery.refetch()
  }

  const confirmClose = () => {
    if (!currentPeriod) return
    Modal.confirm({
      title: 'Chốt kỳ giá thành?',
      content: `Kỳ ${currentPeriod.ma_ky} sẽ khóa dữ liệu tính giá thành và ghi audit.`,
      okText: 'Chốt kỳ',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: () => closeMutation.mutateAsync(currentPeriod.id),
    })
  }

  const actionDisabled = !currentPeriod || isClosed

  return (
    <div style={{ padding: 24 }}>
      <Space align="start" style={{ justifyContent: 'space-between', width: '100%', marginBottom: 12 }} wrap>
        <div>
          <Title level={3} style={{ margin: 0 }}>Giá thành sản xuất</Title>
          <Text type="secondary">Quản lý kỳ tính giá thành theo pháp nhân, phân xưởng và dữ liệu sản xuất thực tế.</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          Tạo kỳ
        </Button>
      </Space>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Quy trình tính giá thành"
        description={
          <Space wrap>
            <Text>① Duyệt BOM từng lệnh SX</Text>
            <Text type="secondary">→</Text>
            <Text>② Xuất vật tư có phân bổ thực tế</Text>
            <Text type="secondary">→</Text>
            <Text>③ Tạo kỳ và lấy dữ liệu SX</Text>
            <Text type="secondary">→</Text>
            <Text>④ Tính và chốt giá thành</Text>
            <Link to="/production/cost-analysis">
              <Button type="link" size="small" icon={<FundOutlined />}>Xem phân tích chi phí BOM vs TT</Button>
            </Link>
          </Space>
        }
      />

      <Card size="small" style={{ marginBottom: 12 }}>
        <Form
          form={filterForm}
          layout="inline"
          onFinish={values => {
            setSelectedPeriodId(undefined)
            setFilters(values)
          }}
        >
          <Form.Item name="phap_nhan_id">
            <Select
              allowClear
              showSearch
              loading={loadingPhapNhan}
              placeholder="Pháp nhân"
              optionFilterProp="label"
              options={phapNhanOptions}
              style={{ width: 190 }}
            />
          </Form.Item>
          <Form.Item name="phan_xuong_id">
            <Select
              allowClear
              showSearch
              loading={loadingPhanXuong}
              placeholder="Phân xưởng"
              optionFilterProp="label"
              options={phanXuongOptions}
              style={{ width: 190 }}
            />
          </Form.Item>
          <Form.Item name="trang_thai">
            <Select
              allowClear
              placeholder="Trạng thái"
              options={Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))}
              style={{ width: 150 }}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button htmlType="submit" icon={<FileSearchOutlined />}>Lọc</Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  filterForm.resetFields()
                  setSelectedPeriodId(undefined)
                  setFilters({})
                }}
              >
                Đặt lại
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Table<ProductionCostPeriod>
          rowKey="id"
          size="small"
          loading={periodsQuery.isLoading}
          columns={periodColumns}
          dataSource={periods}
          scroll={{ x: 1100 }}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          rowSelection={{
            type: 'radio',
            selectedRowKeys: currentPeriodId ? [currentPeriodId] : [],
            onChange: keys => setSelectedPeriodId(Number(keys[0])),
          }}
          onRow={record => ({ onClick: () => setSelectedPeriodId(record.id) })}
        />
      </Card>

      <Card
        size="small"
        title={currentPeriod ? `${currentPeriod.ma_ky} — ${currentPeriod.ten_ky}` : 'Chi tiết kỳ giá thành'}
        extra={
          <Space wrap>
            <Button
              icon={<SyncOutlined />}
              disabled={actionDisabled}
              loading={collectMutation.isPending}
              onClick={() => currentPeriodId && collectMutation.mutate(currentPeriodId)}
            >
              Lấy dữ liệu SX
            </Button>
            <Button
              icon={<FileSearchOutlined />}
              disabled={!currentPeriod}
              loading={previewQuery.isFetching}
              onClick={runPreview}
            >
              Xem trước
            </Button>
            <Button
              type="primary"
              icon={<CalculatorOutlined />}
              disabled={actionDisabled}
              loading={calculateMutation.isPending}
              onClick={() => currentPeriodId && calculateMutation.mutate(currentPeriodId)}
            >
              Tính giá thành
            </Button>
            <Button
              danger
              icon={<CheckCircleOutlined />}
              disabled={actionDisabled}
              loading={closeMutation.isPending}
              onClick={confirmClose}
            >
              Chốt kỳ
            </Button>
          </Space>
        }
      >
        {!currentPeriod ? (
          <Alert
            type="info"
            showIcon
            message="Chưa có kỳ nào được chọn"
            description="Tạo kỳ tính giá thành hoặc điều chỉnh bộ lọc để xem dữ liệu."
          />
        ) : (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <div style={{ border: '1px solid #f0f0f0', padding: 12, borderRadius: 6 }}>
                <Statistic title="Tổng chi phí" value={currentPeriod.tong_chi_phi} formatter={v => moneyText(Number(v))} />
              </div>
              <div style={{ border: '1px solid #f0f0f0', padding: 12, borderRadius: 6 }}>
                <Statistic title="NVL" value={currentPeriod.tong_nvl} formatter={v => moneyText(Number(v))} />
              </div>
              <div style={{ border: '1px solid #f0f0f0', padding: 12, borderRadius: 6 }}>
                <Statistic title="Nhân công" value={currentPeriod.tong_nhan_cong} formatter={v => moneyText(Number(v))} />
              </div>
              <div style={{ border: '1px solid #f0f0f0', padding: 12, borderRadius: 6 }}>
                <Statistic title="SXC" value={currentPeriod.tong_sxc} formatter={v => moneyText(Number(v))} />
              </div>
              <div style={{ border: '1px solid #f0f0f0', padding: 12, borderRadius: 6 }}>
                <Statistic title="Sản lượng" value={currentPeriod.tong_san_luong} formatter={v => numberText(Number(v))} />
              </div>
            </div>

            <Space wrap>
              <Text type="secondary">Pháp nhân:</Text><Text strong>{phapNhanName(currentPeriod.phap_nhan_id)}</Text>
              <Text type="secondary">Phân xưởng:</Text><Text strong>{phanXuongName(currentPeriod.phan_xuong_id)}</Text>
              <Text type="secondary">Tiêu thức:</Text><Tag color="blue">Sản lượng</Tag>
              <Text type="secondary">Trạng thái:</Text>
              <Tag color={(STATUS_META[currentPeriod.trang_thai] ?? STATUS_META.nhap).color}>
                {(STATUS_META[currentPeriod.trang_thai] ?? STATUS_META.nhap).label}
              </Tag>
            </Space>

            <Tabs
              items={[
                {
                  key: 'inputs',
                  label: `Dữ liệu đầu vào (${currentPeriod.inputs?.length ?? 0})`,
                  children: (
                    <Table<ProductionCostInput>
                      rowKey="id"
                      size="small"
                      loading={detailQuery.isFetching}
                      columns={inputColumns}
                      dataSource={currentPeriod.inputs ?? []}
                      pagination={{ pageSize: 10, showSizeChanger: false }}
                      scroll={{ x: 900 }}
                    />
                  ),
                },
                {
                  key: 'allocations',
                  label: `Phân bổ (${currentPeriod.allocations?.length ?? 0})`,
                  children: (
                    <Table<ProductionCostAllocation>
                      rowKey={record => `${record.production_order_id}-${record.product_id}-${record.san_luong}`}
                      size="small"
                      loading={detailQuery.isFetching}
                      columns={allocationColumns}
                      dataSource={currentPeriod.allocations ?? []}
                      pagination={{ pageSize: 10, showSizeChanger: false }}
                      scroll={{ x: 1050 }}
                    />
                  ),
                },
              ]}
            />
          </Space>
        )}
      </Card>

      <Modal
        title="Tạo kỳ tính giá thành"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        okText="Tạo kỳ"
        confirmLoading={createMutation.isPending}
        destroyOnClose
      >
        <Form<CreatePeriodForm>
          form={createForm}
          layout="vertical"
          initialValues={{ range: [dayjs().startOf('month'), dayjs().endOf('month')] }}
          onFinish={values => createMutation.mutate(values)}
        >
          <Form.Item name="range" label="Khoảng ngày" rules={[{ required: true, message: 'Chọn khoảng ngày' }]}>
            <RangePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="ma_ky" label="Mã kỳ">
            <Input placeholder="Tự động nếu để trống" />
          </Form.Item>
          <Form.Item name="ten_ky" label="Tên kỳ">
            <Input placeholder="Tự động nếu để trống" />
          </Form.Item>
          <Form.Item name="phap_nhan_id" label="Pháp nhân">
            <Select allowClear showSearch optionFilterProp="label" options={phapNhanOptions} loading={loadingPhapNhan} />
          </Form.Item>
          <Form.Item name="phan_xuong_id" label="Phân xưởng">
            <Select allowClear showSearch optionFilterProp="label" options={phanXuongOptions} loading={loadingPhanXuong} />
          </Form.Item>
          <Form.Item name="ghi_chu" label="Ghi chú">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="Xem trước phân bổ chi phí"
        width={920}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {previewQuery.data?.warnings?.map(item => (
            <Alert key={item} type="warning" showIcon message={item} />
          ))}
          <Space wrap>
            <Statistic title="Chưa phân bổ" value={previewQuery.data?.unallocated_cost ?? 0} formatter={v => moneyText(Number(v))} />
            <Statistic title="Dòng phân bổ" value={previewQuery.data?.allocations.length ?? 0} />
          </Space>
          <Table<ProductionCostAllocation>
            rowKey={record => `${record.production_order_id}-${record.product_id}-${record.san_luong}`}
            size="small"
            loading={previewQuery.isFetching}
            columns={allocationColumns}
            dataSource={previewQuery.data?.allocations ?? []}
            pagination={false}
            scroll={{ x: 1050 }}
          />
        </Space>
      </Drawer>
    </div>
  )
}

export default ProductionCostingPage
