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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalculatorOutlined,
  CheckCircleOutlined,
  FileSearchOutlined,
  PlusOutlined,
  ReloadOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import {
  productionCostApi,
  type ProductionCostAllocation,
  type ProductionCostInput,
  type ProductionCostPeriod,
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
  nhap: { label: 'Nhap', color: 'default' },
  dang_tinh: { label: 'Dang tinh', color: 'processing' },
  da_chot: { label: 'Da chot', color: 'green' },
  huy: { label: 'Huy', color: 'red' },
}

const SOURCE_META: Record<string, { label: string; color: string }> = {
  nvl: { label: 'NVL', color: 'blue' },
  san_luong: { label: 'San luong', color: 'green' },
  nhan_cong: { label: 'Nhan cong', color: 'orange' },
  sxc: { label: 'SXC', color: 'purple' },
  khau_hao: { label: 'Khau hao', color: 'cyan' },
}

const numberText = (value: number | null | undefined, suffix = '') => {
  if (value == null) return '-'
  return `${new Intl.NumberFormat('vi-VN').format(Number(value))}${suffix}`
}

const moneyText = (value: number | null | undefined) => `${fmtVND(value)} d`

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
    id ? phapNhanList.find(item => item.id === id)?.ten_viet_tat || phapNhanList.find(item => item.id === id)?.ten_phap_nhan || `#${id}` : 'Tat ca'
  const phanXuongName = (id: number | null | undefined) =>
    id ? phanXuongList.find(item => item.id === id)?.ten_xuong || `#${id}` : 'Tat ca'

  const periodsQuery = useQuery({
    queryKey: ['production-cost-periods', filters],
    queryFn: () => productionCostApi.list(filters),
  })

  const periods = periodsQuery.data ?? []
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
      message.success('Da tao ky gia thanh')
      setCreateOpen(false)
      createForm.resetFields()
      setSelectedPeriodId(period.id)
      await refreshPeriod(period.id)
    },
  })

  const collectMutation = useMutation({
    mutationFn: (id: number) => productionCostApi.collectInputs(id),
    onSuccess: async data => {
      message.success(`Da thu thap ${data.created_inputs} dong du lieu`)
      setSelectedPeriodId(data.period.id)
      await refreshPeriod(data.period.id)
    },
  })

  const calculateMutation = useMutation({
    mutationFn: (id: number) => productionCostApi.calculate(id),
    onSuccess: async period => {
      message.success('Da tinh gia thanh')
      setSelectedPeriodId(period.id)
      await refreshPeriod(period.id)
    },
  })

  const closeMutation = useMutation({
    mutationFn: (id: number) => productionCostApi.close(id),
    onSuccess: async period => {
      message.success('Da chot ky gia thanh')
      setSelectedPeriodId(period.id)
      await refreshPeriod(period.id)
    },
  })

  const periodColumns: ColumnsType<ProductionCostPeriod> = [
    {
      title: 'Ky',
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
      title: 'Thoi gian',
      width: 170,
      render: (_, record) => `${dayjs(record.tu_ngay).format('DD/MM/YYYY')} - ${dayjs(record.den_ngay).format('DD/MM/YYYY')}`,
    },
    { title: 'Phap nhan', dataIndex: 'phap_nhan_id', width: 140, render: phapNhanName },
    { title: 'Phan xuong', dataIndex: 'phan_xuong_id', width: 150, render: phanXuongName },
    { title: 'Chi phi', dataIndex: 'tong_chi_phi', width: 140, align: 'right', render: moneyText },
    { title: 'San luong', dataIndex: 'tong_san_luong', width: 120, align: 'right', render: (v: number) => numberText(v) },
    {
      title: 'Trang thai',
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
      title: 'Nguon',
      dataIndex: 'source_type',
      width: 115,
      render: (value: string) => {
        const meta = SOURCE_META[value] ?? { label: value, color: 'default' }
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    { title: 'Lenh SX', dataIndex: 'production_order_id', width: 95, render: (v: number | null) => v ? `#${v}` : '-' },
    { title: 'Bang nguon', dataIndex: 'source_table', width: 145, render: (v: string | null) => v || '-' },
    { title: 'So tien', dataIndex: 'so_tien', width: 130, align: 'right', render: moneyText },
    { title: 'So luong', dataIndex: 'so_luong', width: 110, align: 'right', render: (v: number | null) => v ? numberText(v) : '-' },
    { title: 'Dien giai', dataIndex: 'dien_giai', ellipsis: true, render: (v: string | null) => v || '-' },
  ]

  const allocationColumns: ColumnsType<ProductionCostAllocation> = [
    { title: 'Lenh SX', dataIndex: 'production_order_id', width: 95, render: (v: number | null) => v ? `#${v}` : '-' },
    { title: 'San luong', dataIndex: 'san_luong', width: 115, align: 'right', render: (v: number) => numberText(v) },
    { title: 'Ty le', dataIndex: 'ty_le', width: 90, align: 'right', render: (v: number) => `${(Number(v || 0) * 100).toFixed(2)}%` },
    { title: 'NVL', dataIndex: 'chi_phi_nvl', width: 130, align: 'right', render: moneyText },
    { title: 'Nhan cong', dataIndex: 'chi_phi_nhan_cong', width: 130, align: 'right', render: moneyText },
    { title: 'SXC', dataIndex: 'chi_phi_sxc', width: 130, align: 'right', render: moneyText },
    { title: 'Tong CP', dataIndex: 'tong_chi_phi', width: 140, align: 'right', render: (v: number) => <Text strong>{moneyText(v)}</Text> },
    { title: 'Gia thanh/DV', dataIndex: 'gia_thanh_don_vi', width: 140, align: 'right', render: (v: number) => <Text strong>{moneyText(v)}</Text> },
  ]

  const runPreview = async () => {
    if (!currentPeriodId) return
    setPreviewOpen(true)
    await previewQuery.refetch()
  }

  const confirmClose = () => {
    if (!currentPeriod) return
    Modal.confirm({
      title: 'Chot ky gia thanh?',
      content: `Ky ${currentPeriod.ma_ky} se khoa du lieu tinh gia thanh va ghi audit.`,
      okText: 'Chot ky',
      cancelText: 'Huy',
      okButtonProps: { danger: true },
      onOk: () => closeMutation.mutateAsync(currentPeriod.id),
    })
  }

  const actionDisabled = !currentPeriod || isClosed

  return (
    <div style={{ padding: 24 }}>
      <Space align="start" style={{ justifyContent: 'space-between', width: '100%', marginBottom: 16 }} wrap>
        <div>
          <Title level={3} style={{ margin: 0 }}>Gia thanh san xuat</Title>
          <Text type="secondary">Quan ly ky tinh gia thanh theo phap nhan, phan xuong va du lieu san xuat thuc te.</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          Tao ky
        </Button>
      </Space>

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
              placeholder="Phap nhan"
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
              placeholder="Phan xuong"
              optionFilterProp="label"
              options={phanXuongOptions}
              style={{ width: 190 }}
            />
          </Form.Item>
          <Form.Item name="trang_thai">
            <Select
              allowClear
              placeholder="Trang thai"
              options={Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))}
              style={{ width: 150 }}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button htmlType="submit" icon={<FileSearchOutlined />}>Loc</Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  filterForm.resetFields()
                  setSelectedPeriodId(undefined)
                  setFilters({})
                }}
              >
                Dat lai
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
        title={currentPeriod ? `${currentPeriod.ma_ky} - ${currentPeriod.ten_ky}` : 'Chi tiet ky gia thanh'}
        extra={
          <Space wrap>
            <Button
              icon={<SyncOutlined />}
              disabled={actionDisabled}
              loading={collectMutation.isPending}
              onClick={() => currentPeriodId && collectMutation.mutate(currentPeriodId)}
            >
              Lay du lieu SX
            </Button>
            <Button
              icon={<FileSearchOutlined />}
              disabled={!currentPeriod}
              loading={previewQuery.isFetching}
              onClick={runPreview}
            >
              Preview
            </Button>
            <Button
              type="primary"
              icon={<CalculatorOutlined />}
              disabled={actionDisabled}
              loading={calculateMutation.isPending}
              onClick={() => currentPeriodId && calculateMutation.mutate(currentPeriodId)}
            >
              Tinh gia thanh
            </Button>
            <Button
              danger
              icon={<CheckCircleOutlined />}
              disabled={actionDisabled}
              loading={closeMutation.isPending}
              onClick={confirmClose}
            >
              Chot ky
            </Button>
          </Space>
        }
      >
        {!currentPeriod ? (
          <Alert type="info" showIcon message="Chua co ky nao" description="Tao ky tinh gia thanh hoac dieu chinh bo loc de xem du lieu." />
        ) : (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <div style={{ border: '1px solid #f0f0f0', padding: 12, borderRadius: 6 }}>
                <Statistic title="Tong chi phi" value={currentPeriod.tong_chi_phi} formatter={v => moneyText(Number(v))} />
              </div>
              <div style={{ border: '1px solid #f0f0f0', padding: 12, borderRadius: 6 }}>
                <Statistic title="NVL" value={currentPeriod.tong_nvl} formatter={v => moneyText(Number(v))} />
              </div>
              <div style={{ border: '1px solid #f0f0f0', padding: 12, borderRadius: 6 }}>
                <Statistic title="Nhan cong" value={currentPeriod.tong_nhan_cong} formatter={v => moneyText(Number(v))} />
              </div>
              <div style={{ border: '1px solid #f0f0f0', padding: 12, borderRadius: 6 }}>
                <Statistic title="SXC" value={currentPeriod.tong_sxc} formatter={v => moneyText(Number(v))} />
              </div>
              <div style={{ border: '1px solid #f0f0f0', padding: 12, borderRadius: 6 }}>
                <Statistic title="San luong" value={currentPeriod.tong_san_luong} formatter={v => numberText(Number(v))} />
              </div>
            </div>

            <Space wrap>
              <Text type="secondary">Phap nhan:</Text><Text strong>{phapNhanName(currentPeriod.phap_nhan_id)}</Text>
              <Text type="secondary">Phan xuong:</Text><Text strong>{phanXuongName(currentPeriod.phan_xuong_id)}</Text>
              <Text type="secondary">Tieu thuc:</Text><Tag color="blue">San luong</Tag>
              <Text type="secondary">Trang thai:</Text>
              <Tag color={(STATUS_META[currentPeriod.trang_thai] ?? STATUS_META.nhap).color}>
                {(STATUS_META[currentPeriod.trang_thai] ?? STATUS_META.nhap).label}
              </Tag>
            </Space>

            <Tabs
              items={[
                {
                  key: 'inputs',
                  label: `Du lieu dau vao (${currentPeriod.inputs?.length ?? 0})`,
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
                  label: `Phan bo (${currentPeriod.allocations?.length ?? 0})`,
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
        title="Tao ky tinh gia thanh"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        okText="Tao ky"
        confirmLoading={createMutation.isPending}
        destroyOnClose
      >
        <Form<CreatePeriodForm>
          form={createForm}
          layout="vertical"
          initialValues={{ range: [dayjs().startOf('month'), dayjs().endOf('month')] }}
          onFinish={values => createMutation.mutate(values)}
        >
          <Form.Item name="range" label="Khoang ngay" rules={[{ required: true, message: 'Chon khoang ngay' }]}>
            <RangePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="ma_ky" label="Ma ky">
            <Input placeholder="Tu dong neu de trong" />
          </Form.Item>
          <Form.Item name="ten_ky" label="Ten ky">
            <Input placeholder="Tu dong neu de trong" />
          </Form.Item>
          <Form.Item name="phap_nhan_id" label="Phap nhan">
            <Select allowClear showSearch optionFilterProp="label" options={phapNhanOptions} loading={loadingPhapNhan} />
          </Form.Item>
          <Form.Item name="phan_xuong_id" label="Phan xuong">
            <Select allowClear showSearch optionFilterProp="label" options={phanXuongOptions} loading={loadingPhanXuong} />
          </Form.Item>
          <Form.Item name="ghi_chu" label="Ghi chu">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="Preview phan bo chi phi"
        width={920}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {previewQuery.data?.warnings?.map(item => (
            <Alert key={item} type="warning" showIcon message={item} />
          ))}
          <Space wrap>
            <Statistic title="Chua phan bo" value={previewQuery.data?.unallocated_cost ?? 0} formatter={v => moneyText(Number(v))} />
            <Statistic title="Dong phan bo" value={previewQuery.data?.allocations.length ?? 0} />
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
