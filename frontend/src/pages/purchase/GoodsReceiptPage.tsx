import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Descriptions, Drawer, Form, Input, InputNumber,
  Popconfirm, Row, Select, Space, Table, Tag, Tooltip, Typography, message, Divider,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, CheckCircleOutlined, EyeOutlined,
  FileTextOutlined, InboxOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { warehouseApi, GoodsReceipt, GoodsReceiptItem, CreateGoodsReceiptPayload } from '../../api/warehouse'
import { purchaseApi, PurchaseOrder } from '../../api/purchase'
import { suppliersApi } from '../../api/suppliers'
import { warehousesApi } from '../../api/warehouses'
import { exportToExcel, fmtVND, ExcelSheet } from '../../utils/exportUtils'

const { Title, Text } = Typography

const TRANG_THAI_GR: Record<string, string> = {
  nhap_nhanh: 'Nhập nhanh',
  nhap: 'Chờ duyệt',
  da_duyet: 'Đã duyệt',
}

const TRANG_THAI_COLOR: Record<string, string> = {
  nhap_nhanh: 'orange',
  nhap: 'blue',
  da_duyet: 'green',
}

const KET_QUA_OPTIONS = [
  { value: 'DAT', label: 'Đạt' },
  { value: 'KHONG_DAT', label: 'Không đạt' },
]

export default function GoodsReceiptPage() {
  const qc = useQueryClient()

  // Filters
  const [filterNCC, setFilterNCC] = useState<number | undefined>()
  const [filterTrangThai, setFilterTrangThai] = useState<string | undefined>()
  const [tuNgay, setTuNgay] = useState<string | undefined>()
  const [denNgay, setDenNgay] = useState<string | undefined>()

  // Form state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedPOId, setSelectedPOId] = useState<number | undefined>()
  const [detailDrawer, setDetailDrawer] = useState<GoodsReceipt | null>(null)
  const [form] = Form.useForm()

  // Master data
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.all().then(r => r.data),
    staleTime: 300_000,
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: () => warehousesApi.list().then(r => r.data),
    staleTime: 300_000,
  })

  // PO list (approved only, not yet complete)
  const { data: poList = [] } = useQuery({
    queryKey: ['po-for-gr'],
    queryFn: () => purchaseApi.list({ trang_thai: 'da_duyet' }).then(r => r.data),
    staleTime: 60_000,
  })

  const allPOs = useQuery({
    queryKey: ['po-for-gr-all'],
    queryFn: () => purchaseApi.list().then(r => r.data),
    staleTime: 60_000,
  })

  // GR list
  const { data: grList = [], isLoading } = useQuery({
    queryKey: ['goods-receipts', filterNCC, tuNgay, denNgay, filterTrangThai],
    queryFn: () => warehouseApi.listGoodsReceipts({
      supplier_id: filterNCC,
      tu_ngay: tuNgay,
      den_ngay: denNgay,
    }).then(r => r.data),
  })

  const filtered = filterTrangThai
    ? grList.filter(g => g.trang_thai === filterTrangThai)
    : grList

  // PO detail (for form pre-fill)
  const { data: selectedPO } = useQuery({
    queryKey: ['po-detail-for-gr', selectedPOId],
    queryFn: () => selectedPOId ? purchaseApi.get(selectedPOId).then(r => r.data) : null,
    enabled: !!selectedPOId,
  })

  const approveMut = useMutation({
    mutationFn: (id: number) => warehouseApi.approveGoodsReceipt(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goods-receipts'] })
      message.success('Đã duyệt phiếu nhập kho — tồn kho đã được cập nhật')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi duyệt phiếu'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => warehouseApi.deleteGoodsReceipt(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goods-receipts'] })
      message.success('Đã xoá phiếu nhập kho')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi xoá phiếu'),
  })

  const createMut = useMutation({
    mutationFn: (data: CreateGoodsReceiptPayload) => warehouseApi.createGoodsReceipt(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goods-receipts'] })
      qc.invalidateQueries({ queryKey: ['po-for-gr'] })
      message.success('Đã tạo phiếu nhập kho — chờ duyệt để cập nhật tồn kho')
      setDrawerOpen(false)
      setSelectedPOId(undefined)
      form.resetFields()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo phiếu nhập kho'),
  })

  function openCreate() {
    form.resetFields()
    setSelectedPOId(undefined)
    setDrawerOpen(true)
  }

  function onPOSelect(poId: number) {
    setSelectedPOId(poId)
    const po = (allPOs.data ?? []).find(p => p.id === poId)
    if (!po) return
    form.setFieldsValue({
      supplier_id: po.supplier_id,
      ngay_nhap: dayjs(),
    })
    const items = po.items.map(item => ({
      po_item_id: item.id,
      paper_material_id: item.paper_material_id,
      other_material_id: item.other_material_id,
      ten_hang: item.ten_hang,
      dvt: item.dvt,
      don_gia: item.don_gia,
      so_luong: Math.max(0, item.so_luong - (item.so_luong_da_nhan ?? 0)),
      ket_qua_kiem_tra: 'DAT',
      ghi_chu: null,
    }))
    form.setFieldsValue({ items })
  }

  function onFinish(values: any) {
    const payload: CreateGoodsReceiptPayload = {
      ngay_nhap: values.ngay_nhap.format('YYYY-MM-DD'),
      po_id: selectedPOId ?? null,
      supplier_id: values.supplier_id,
      warehouse_id: values.warehouse_id,
      loai_nhap: 'MUA_HANG',
      ghi_chu: values.ghi_chu ?? null,
      items: (values.items ?? []).map((it: any) => ({
        po_item_id: it.po_item_id ?? null,
        paper_material_id: it.paper_material_id ?? null,
        other_material_id: it.other_material_id ?? null,
        ten_hang: it.ten_hang ?? '',
        so_luong: Number(it.so_luong) || 0,
        dvt: it.dvt ?? 'Kg',
        don_gia: Number(it.don_gia) || 0,
        ket_qua_kiem_tra: it.ket_qua_kiem_tra ?? 'DAT',
        ghi_chu: it.ghi_chu ?? null,
      })),
    }
    createMut.mutate(payload)
  }

  const columns = [
    {
      title: 'Số phiếu',
      dataIndex: 'so_phieu',
      width: 160,
      render: (v: string, r: GoodsReceipt) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => setDetailDrawer(r)}>
          {v}
        </Button>
      ),
    },
    {
      title: 'Ngày nhập',
      dataIndex: 'ngay_nhap',
      width: 110,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Nhà cung cấp',
      dataIndex: 'ten_ncc',
      ellipsis: true,
    },
    {
      title: 'Từ PO',
      dataIndex: 'po_id',
      width: 160,
      render: (v: number | null, r: GoodsReceipt) => {
        const po = (allPOs.data ?? []).find(p => p.id === v)
        return po ? <Tag color="blue">{po.so_po}</Tag> : <Text type="secondary">—</Text>
      },
    },
    {
      title: 'Kho nhập',
      dataIndex: 'ten_kho',
      width: 140,
      ellipsis: true,
    },
    {
      title: 'Tổng giá trị',
      dataIndex: 'tong_gia_tri',
      width: 130,
      align: 'right' as const,
      render: (v: number) => fmtVND(v),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 120,
      render: (v: string) => (
        <Tag color={TRANG_THAI_COLOR[v] ?? 'default'}>
          {TRANG_THAI_GR[v] ?? v}
        </Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 110,
      render: (_: any, r: GoodsReceipt) => (
        <Space size={4}>
          <Tooltip title="Xem chi tiết">
            <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailDrawer(r)} />
          </Tooltip>
          {(r.trang_thai === 'nhap' || r.trang_thai === 'nhap_nhanh') && (
            <Tooltip title="Duyệt — cập nhật tồn kho">
              <Popconfirm
                title="Duyệt phiếu nhập kho?"
                description="Tồn kho sẽ được cập nhật ngay và không thể hoàn tác."
                onConfirm={() => approveMut.mutate(r.id)}
              >
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={approveMut.isPending}
                />
              </Popconfirm>
            </Tooltip>
          )}
          {r.trang_thai !== 'da_duyet' && (
            <Tooltip title="Xoá">
              <Popconfirm title="Xoá phiếu này?" onConfirm={() => deleteMut.mutate(r.id)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  const itemColumns = [
    { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
    { title: 'ĐVT', dataIndex: 'dvt', width: 70 },
    {
      title: 'Số lượng',
      dataIndex: 'so_luong',
      width: 100,
      align: 'right' as const,
      render: (v: number) => v.toLocaleString('vi-VN'),
    },
    {
      title: 'Đơn giá',
      dataIndex: 'don_gia',
      width: 120,
      align: 'right' as const,
      render: (v: number) => fmtVND(v),
    },
    {
      title: 'Thành tiền',
      dataIndex: 'thanh_tien',
      width: 130,
      align: 'right' as const,
      render: (v: number) => fmtVND(v),
    },
    {
      title: 'Kiểm tra',
      dataIndex: 'ket_qua_kiem_tra',
      width: 100,
      render: (v: string) => (
        <Tag color={v === 'DAT' ? 'green' : 'red'}>{v === 'DAT' ? 'Đạt' : 'Không đạt'}</Tag>
      ),
    },
    { title: 'Ghi chú', dataIndex: 'ghi_chu', ellipsis: true },
  ]

  return (
    <div style={{ padding: 16 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            <InboxOutlined style={{ marginRight: 8 }} />
            Phiếu Nhập Kho Mua Hàng (GR)
          </Title>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<FileTextOutlined />}
              onClick={() => {
                const sheet: ExcelSheet = {
                  name: 'Phiếu nhập kho',
                  headers: ['Số phiếu', 'Ngày nhập', 'Nhà cung cấp', 'Kho', 'Tổng giá trị', 'Trạng thái'],
                  rows: filtered.map(g => [
                    g.so_phieu,
                    g.ngay_nhap,
                    g.ten_ncc,
                    g.ten_kho,
                    g.tong_gia_tri,
                    TRANG_THAI_GR[g.trang_thai] ?? g.trang_thai,
                  ]),
                }
                exportToExcel('phieu_nhap_kho', [sheet])
              }}
            >
              Xuất Excel
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Tạo phiếu nhập kho
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Filter bar */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={12} align="middle">
          <Col>
            <Select
              placeholder="Nhà cung cấp"
              style={{ width: 220 }}
              allowClear
              showSearch
              optionFilterProp="label"
              options={suppliers.map((s: any) => ({ value: s.id, label: s.ten_viet_tat || s.ten_don_vi }))}
              onChange={setFilterNCC}
            />
          </Col>
          <Col>
            <Select
              placeholder="Trạng thái"
              style={{ width: 150 }}
              allowClear
              options={Object.entries(TRANG_THAI_GR).map(([k, v]) => ({ value: k, label: v }))}
              onChange={setFilterTrangThai}
            />
          </Col>
          <Col>
            <DatePicker
              placeholder="Từ ngày"
              format="DD/MM/YYYY"
              onChange={d => setTuNgay(d ? d.format('YYYY-MM-DD') : undefined)}
            />
          </Col>
          <Col>
            <DatePicker
              placeholder="Đến ngày"
              format="DD/MM/YYYY"
              onChange={d => setDenNgay(d ? d.format('YYYY-MM-DD') : undefined)}
            />
          </Col>
        </Row>
      </Card>

      <Table
        size="small"
        columns={columns}
        dataSource={filtered}
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        summary={pageData => {
          const total = pageData.reduce((s, r) => s + (r.tong_gia_tri || 0), 0)
          return (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={5}>
                <Text strong>Tổng trang</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="right">
                <Text strong>{fmtVND(total)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={6} colSpan={2} />
            </Table.Summary.Row>
          )
        }}
      />

      {/* Detail drawer */}
      <Drawer
        title={detailDrawer ? `Chi tiết: ${detailDrawer.so_phieu}` : ''}
        open={!!detailDrawer}
        onClose={() => setDetailDrawer(null)}
        width={700}
      >
        {detailDrawer && (
          <>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Số phiếu">{detailDrawer.so_phieu}</Descriptions.Item>
              <Descriptions.Item label="Ngày nhập">
                {dayjs(detailDrawer.ngay_nhap).format('DD/MM/YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Nhà cung cấp" span={2}>
                {detailDrawer.ten_ncc}
              </Descriptions.Item>
              <Descriptions.Item label="Kho nhập">{detailDrawer.ten_kho}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={TRANG_THAI_COLOR[detailDrawer.trang_thai]}>
                  {TRANG_THAI_GR[detailDrawer.trang_thai]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Tổng giá trị" span={2}>
                <Text strong>{fmtVND(detailDrawer.tong_gia_tri)}</Text>
              </Descriptions.Item>
              {detailDrawer.ghi_chu && (
                <Descriptions.Item label="Ghi chú" span={2}>
                  {detailDrawer.ghi_chu}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Divider orientation="left" orientationMargin={0}>Chi tiết hàng nhập</Divider>
            <Table
              size="small"
              dataSource={detailDrawer.items}
              columns={itemColumns}
              rowKey="id"
              pagination={false}
            />

            {(detailDrawer.trang_thai === 'nhap' || detailDrawer.trang_thai === 'nhap_nhanh') && (
              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <Popconfirm
                  title="Duyệt phiếu nhập kho?"
                  description="Tồn kho sẽ được cập nhật và không thể hoàn tác."
                  onConfirm={() => {
                    approveMut.mutate(detailDrawer.id)
                    setDetailDrawer(null)
                  }}
                >
                  <Button type="primary" icon={<CheckCircleOutlined />} loading={approveMut.isPending}>
                    Duyệt phiếu — Cập nhật tồn kho
                  </Button>
                </Popconfirm>
              </div>
            )}
          </>
        )}
      </Drawer>

      {/* Create GR drawer */}
      <Drawer
        title="Tạo phiếu nhập kho"
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedPOId(undefined); form.resetFields() }}
        width={800}
        footer={
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setDrawerOpen(false); setSelectedPOId(undefined); form.resetFields() }}>
                Huỷ
              </Button>
              <Button type="primary" onClick={() => form.submit()} loading={createMut.isPending}>
                Lưu phiếu nhập kho
              </Button>
            </Space>
          </div>
        }
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item label="Từ đơn mua hàng (PO)">
                <Select
                  placeholder="Chọn PO để tự động điền hàng"
                  style={{ width: '100%' }}
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={(allPOs.data ?? []).map(p => ({
                    value: p.id,
                    label: `${p.so_po} — ${p.ten_ncc} — ${fmtVND(p.tong_tien)}`,
                  }))}
                  onChange={v => v ? onPOSelect(v) : undefined}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="ngay_nhap" label="Ngày nhập" rules={[{ required: true }]} initialValue={dayjs()}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="supplier_id" label="Nhà cung cấp" rules={[{ required: true }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={suppliers.map((s: any) => ({ value: s.id, label: s.ten_viet_tat || s.ten_don_vi }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="warehouse_id" label="Kho nhập" rules={[{ required: true }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={warehouses.map((w: any) => ({ value: w.id, label: w.ten_kho }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ghi_chu" label="Ghi chú">
                <Input placeholder="Số xe, ghi chú..." />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" orientationMargin={0}>Chi tiết hàng nhập</Divider>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => (
                  <Card
                    key={key}
                    size="small"
                    style={{ marginBottom: 8, background: '#fafafa' }}
                    extra={
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => remove(name)}
                      />
                    }
                  >
                    <Row gutter={8}>
                      <Col span={10}>
                        <Form.Item name={[name, 'ten_hang']} label="Tên hàng" rules={[{ required: true }]}>
                          <Input />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item name={[name, 'dvt']} label="ĐVT">
                          <Input placeholder="Kg" />
                        </Form.Item>
                      </Col>
                      <Col span={5}>
                        <Form.Item name={[name, 'so_luong']} label="Số lượng" rules={[{ required: true }]}>
                          <InputNumber style={{ width: '100%' }} min={0} />
                        </Form.Item>
                      </Col>
                      <Col span={5}>
                        <Form.Item name={[name, 'don_gia']} label="Đơn giá">
                          <InputNumber style={{ width: '100%' }} min={0} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={8}>
                      <Col span={8}>
                        <Form.Item name={[name, 'ket_qua_kiem_tra']} label="Kết quả KT" initialValue="DAT">
                          <Select options={KET_QUA_OPTIONS} />
                        </Form.Item>
                      </Col>
                      <Col span={16}>
                        <Form.Item name={[name, 'ghi_chu']} label="Ghi chú">
                          <Input />
                        </Form.Item>
                      </Col>
                    </Row>
                    {/* Hidden fields for linking */}
                    <Form.Item name={[name, 'po_item_id']} hidden><Input /></Form.Item>
                    <Form.Item name={[name, 'paper_material_id']} hidden><Input /></Form.Item>
                    <Form.Item name={[name, 'other_material_id']} hidden><Input /></Form.Item>
                  </Card>
                ))}
                <Button
                  type="dashed"
                  block
                  icon={<PlusOutlined />}
                  onClick={() => add({ dvt: 'Kg', ket_qua_kiem_tra: 'DAT', so_luong: 0, don_gia: 0 })}
                >
                  Thêm dòng hàng
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Drawer>
    </div>
  )
}
