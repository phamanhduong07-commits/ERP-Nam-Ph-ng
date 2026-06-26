import { useState, useMemo, useEffect } from 'react'
import type { ApiError } from '../../api/types'
import { usePermission } from '../../hooks/usePermission'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Descriptions, Drawer, Form, Input, InputNumber,
  Popconfirm, Row, Select, Space, Table, Tag, Typography, message,
} from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { warehouseApi, CreateProductionOutputPayload, ProductionOutput } from '../../api/warehouse'
import { warehousesApi } from '../../api/warehouses'
import { productionOrdersApi, type ProductionOrderListItem } from '../../api/productionOrders'
import { PrinterOutlined, FileExcelOutlined } from '@ant-design/icons'
import { smartExportExcel, smartPrintPdf, buildHtmlTable, resolveSinglePhapNhanId } from '../../utils/exportUtils'
import EmptyState from "../../components/EmptyState"
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Title, Text } = Typography

const FILTER_KEY = 'WAREHOUSE_PRODUCTION_OUTPUT_FILTERS'

export default function ProductionOutputPage() {
  const qc = useQueryClient()
  const { hasPermission } = usePermission()
  const canImport = hasPermission('inventory.import')
  const [open, setOpen] = useState(false)
  const [viewRecord, setViewRecord] = useState<ProductionOutput | null>(null)
  const [form] = Form.useForm()
  const [filterKho, setFilterKho] = useState<number | undefined>()
  const [filterPhapNhan, setFilterPhapNhan] = useState<number | undefined>()
  const [filterXuong, setFilterXuong] = useState<number | undefined>()
  const [tuNgay, setTuNgay] = useState<string | undefined>()
  const [denNgay, setDenNgay] = useState<string | undefined>()
  const [formPxId, setFormPxId] = useState<number | null>(null)

  useEffect(() => {
    const saved = sessionStorage.getItem(FILTER_KEY)
    if (!saved) return
    try {
      const f = JSON.parse(saved)
      if (typeof f.filterPhapNhan === 'number') setFilterPhapNhan(f.filterPhapNhan)
      if (typeof f.filterXuong === 'number') setFilterXuong(f.filterXuong)
      if (typeof f.filterKho === 'number') setFilterKho(f.filterKho)
      if (typeof f.tuNgay === 'string') setTuNgay(f.tuNgay)
      if (typeof f.denNgay === 'string') setDenNgay(f.denNgay)
    } catch { /* ignore corrupt filter cache */ }
  }, [])

  useEffect(() => {
    sessionStorage.setItem(FILTER_KEY, JSON.stringify({ filterPhapNhan, filterXuong, filterKho, tuNgay, denNgay }))
  }, [filterPhapNhan, filterXuong, filterKho, tuNgay, denNgay])

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: () => warehousesApi.list().then(r => r.data),
  })

  const { data: lsxPaged } = useQuery({
    queryKey: ['production-orders-list'],
    queryFn: () => productionOrdersApi.list({ page_size: 500 }).then(r => r.data),
    staleTime: 60_000,
  })
  const lsxList = lsxPaged?.items ?? []

  const { data: outputList = [], isLoading } = useQuery({
    queryKey: ['production-outputs', filterPhapNhan, filterXuong, filterKho, tuNgay, denNgay],
    queryFn: () => warehouseApi.listProductionOutputs({
      warehouse_id: filterKho, phap_nhan_id: filterPhapNhan, phan_xuong_id: filterXuong, tu_ngay: tuNgay, den_ngay: denNgay,
    }).then(r => r.data),
  })

  const phapNhanOptions = useMemo(() => Array.from(new Map(
    warehouses.filter(w => w.phap_nhan_id).map(w => [w.phap_nhan_id, { value: w.phap_nhan_id!, label: w.ten_phap_nhan || `PN #${w.phap_nhan_id}` }])
  ).values()), [warehouses])

  const xuongOptions = useMemo(() => Array.from(new Map(
    warehouses
      .filter(w => w.phan_xuong_id && (!filterPhapNhan || w.phap_nhan_id === filterPhapNhan))
      .map(w => [w.phan_xuong_id, { value: w.phan_xuong_id!, label: w.ten_xuong || `Xuong #${w.phan_xuong_id}` }])
  ).values()), [warehouses, filterPhapNhan])

  const warehouseOptions = useMemo(() => warehouses
    .filter(w => w.trang_thai)
    .filter(w => !filterPhapNhan || w.phap_nhan_id === filterPhapNhan)
    .filter(w => !filterXuong || w.phan_xuong_id === filterXuong)
    .map(w => ({ value: w.id, label: w.ten_kho })), [warehouses, filterPhapNhan, filterXuong])

  const createMut = useMutation({
    mutationFn: (data: CreateProductionOutputPayload) => warehouseApi.createProductionOutput(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production-outputs'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      message.success('Đã nhập thành phẩm vào kho')
      setOpen(false)
      form.resetFields()
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi tạo phiếu'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => warehouseApi.deleteProductionOutput(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production-outputs'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      message.success('Đã xoá phiếu nhập TP')
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi xoá'),
  })

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields()
      createMut.mutate({
        ngay_nhap: v.ngay_nhap.format('YYYY-MM-DD'),
        production_order_id: v.production_order_id,
        warehouse_id: v.warehouse_id,
        ten_hang: v.ten_hang || '',
        so_luong_nhap: v.so_luong_nhap,
        so_luong_loi: v.so_luong_loi || 0,
        dvt: v.dvt || 'Thùng',
        don_gia_xuat_xuong: v.don_gia_xuat_xuong || 0,
        ghi_chu: v.ghi_chu || null,
      })
    } catch { /* validation shown inline */ }
  }
  const handlePrintReceipt = (r: ProductionOutput) => {
    if (!r.phap_nhan_id) {
      message.error('Phiếu nhập thành phẩm chưa có pháp nhân nên không thể in')
      return
    }
    const cols = [
      { header: 'Tên hàng', key: 'ten_hang' },
      { header: 'Lệnh SX', key: 'so_lenh', align: 'center' as const },
      { header: 'Số lượng', key: 'so_luong_nhap', align: 'right' as const },
      { header: 'ĐVT', key: 'dvt', align: 'center' as const },
      { header: 'Ghi chú', key: 'ghi_chu' },
    ]
    
    const rowData = [[
      r.ten_hang,
      r.so_lenh || '—',
      r.so_luong_nhap.toLocaleString('vi-VN', { maximumFractionDigits: 3 }),
      r.dvt || 'Thùng',
      r.ghi_chu || '—',
    ]]

    const table = buildHtmlTable(cols, rowData)

    const printData = {
      subtitle: 'PHIẾU NHẬP KHO THÀNH PHẨM',
      document_number: r.so_phieu,
      document_date: r.ngay_nhap ?? '',
      warehouse_name: r.ten_kho ?? '—',
      body_html: table,
    }

    smartPrintPdf('GOODS_RECEIPT', printData, r.phap_nhan_id)
  }

  const handleExportExcel = () => {
    const resolvedPhapNhanId = resolveSinglePhapNhanId(outputList)
    if (!outputList.length) {
      message.warning('Không có dữ liệu để xuất Excel')
      return
    }
    if (!resolvedPhapNhanId) {
      message.error('Chỉ xuất Excel phiếu nhập thành phẩm khi danh sách thuộc một pháp nhân. Vui lòng lọc dữ liệu trước.')
      return
    }
    const defaultConfig = [
      { key: 'so_phieu', label: 'Số phiếu', width: 18 },
      { key: 'ngay_nhap', label: 'Ngày nhập', width: 12 },
      { key: 'so_lenh', label: 'LSX', width: 18 },
      { key: 'ten_kho', label: 'Kho TP', width: 18 },
      { key: 'ten_hang', label: 'Tên hàng', width: 30 },
      { key: 'so_luong_nhap', label: 'SL nhập', width: 12 },
      { key: 'so_luong_loi', label: 'SL lỗi', width: 12 },
      { key: 'dvt', label: 'ĐVT', width: 10 },
    ]

    smartExportExcel('GOODS_RECEIPT', outputList, defaultConfig, `NhapThanhPham_${dayjs().format('YYYYMMDD')}`, resolvedPhapNhanId)
  }

  const columns = [
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 160,
      render: (v: string) => <Text strong style={{ color: '#52c41a' }}>{v}</Text> },
    { title: 'Ngày nhập', dataIndex: 'ngay_nhap', width: 110 },
    { title: 'LSX', dataIndex: 'so_lenh', width: 150 },
    { title: 'Kho TP', dataIndex: 'ten_kho', width: 150 },
    { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
    { title: 'SL nhập', dataIndex: 'so_luong_nhap', width: 100, align: 'right' as const,
      render: (v: number) => <Text strong>{v.toLocaleString('vi-VN', { maximumFractionDigits: 3 })}</Text> },
    { title: 'SL lỗi', dataIndex: 'so_luong_loi', width: 90, align: 'right' as const,
      render: (v: number) => v > 0 ? <Text type="danger">{v.toLocaleString('vi-VN', { maximumFractionDigits: 3 })}</Text> : '0' },
    { title: 'ĐVT', dataIndex: 'dvt', width: 70 },
    { title: 'Đơn giá XX', dataIndex: 'don_gia_xuat_xuong', width: 120, align: 'right' as const,
      render: (v: number) => v > 0 ? v.toLocaleString('vi-VN') + 'đ' : '—' },
    { title: 'Người lập', dataIndex: 'created_by_name', width: 120, render: (v: string | null) => v || '—' },
    {
      title: '', width: 115,
      render: (_: unknown, r: ProductionOutput) => (
        <Space size={4}>
          <Button size="small" onClick={() => setViewRecord(r)}>Xem</Button>
          <Button size="small" icon={<PrinterOutlined />} onClick={() => handlePrintReceipt(r)} />
          <Popconfirm title="Xoá phiếu nhập TP?" onConfirm={() => deleteMut.mutate(r.id)} okButtonProps={{ danger: true }} disabled={!canImport}>
            <Button danger size="small" icon={<DeleteOutlined />} disabled={!canImport} />
          </Popconfirm>
        </Space>
      ),
    },
  ]
  const { displayColumns, settingsButton } = useColumnPrefs('warehouse-production-output', columns, { nonHideable: ['so_phieu'] })

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Nhập thành phẩm từ sản xuất</Title>
        </Col>
        <Col>
          <Space>
            <Button icon={<FileExcelOutlined />} style={{ color: '#217346', borderColor: '#217346' }} onClick={handleExportExcel}>
              Xuất Excel
            </Button>
            <Button type="primary" icon={<PlusOutlined />} disabled={!canImport} onClick={() => { form.resetFields(); setFormPxId(null); setOpen(true) }}>
              Tạo phiếu nhập TP
            </Button>
            {settingsButton}
          </Space>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[8, 8]}>
          <Col xs={12} sm={6}>
            <Select placeholder="Phap nhan" style={{ width: '100%' }} allowClear value={filterPhapNhan}
              onChange={v => { setFilterPhapNhan(v); setFilterXuong(undefined); setFilterKho(undefined) }}
              options={phapNhanOptions} />
          </Col>
          <Col xs={12} sm={6}>
            <Select placeholder="Xuong" style={{ width: '100%' }} allowClear value={filterXuong}
              onChange={v => { setFilterXuong(v); setFilterKho(undefined) }}
              options={xuongOptions} />
          </Col>
          <Col xs={12} sm={6}>
            <Select placeholder="Tất cả kho" style={{ width: '100%' }} allowClear value={filterKho} onChange={setFilterKho}
              options={warehouseOptions} />
          </Col>
          <Col xs={12} sm={6}>
            <DatePicker placeholder="Từ ngày" style={{ width: '100%' }} format="DD/MM/YYYY"
              value={tuNgay ? dayjs(tuNgay) : null}
              onChange={d => setTuNgay(d ? d.format('YYYY-MM-DD') : undefined)} />
          </Col>
          <Col xs={12} sm={6}>
            <DatePicker placeholder="Đến ngày" style={{ width: '100%' }} format="DD/MM/YYYY"
              value={denNgay ? dayjs(denNgay) : null}
              onChange={d => setDenNgay(d ? d.format('YYYY-MM-DD') : undefined)} />
          </Col>
        </Row>
      </Card>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table dataSource={outputList} columns={displayColumns} rowKey="id" loading={isLoading} size="small"
          pagination={{ pageSize: 20, showSizeChanger: true }} scroll={{ x: 950 }}
          expandable={{
            expandedRowRender: (r: ProductionOutput) => (
              <div style={{ padding: '4px 0' }}>
                {r.created_by_name && (
                  <div style={{ marginBottom: 6, fontSize: 12, color: '#666' }}>
                    Người lập: <strong>{r.created_by_name}</strong>
                  </div>
                )}
                {r.trang_thai_loi && (
                  <div style={{ marginBottom: 6, fontSize: 12 }}>
                    Trạng thái lỗi: <Tag color="orange">{r.trang_thai_loi}</Tag>
                    {r.so_luong_loi > 0 && <span style={{ color: '#fa8c16', marginLeft: 4 }}>{r.so_luong_loi} {r.dvt}</span>}
                  </div>
                )}
                {r.ghi_chu && (
                  <div style={{ fontSize: 12, color: '#666' }}>Ghi chú: {r.ghi_chu}</div>
                )}
              </div>
            ),
            rowExpandable: (r: ProductionOutput) => !!(r.created_by_name || r.trang_thai_loi || r.ghi_chu),
          }}
        />
      </Card>

      <Drawer open={open} onClose={() => setOpen(false)} title="Nhập thành phẩm từ sản xuất" width={600}
        footer={
          <Space>
            <Button onClick={() => setOpen(false)}>Huỷ</Button>
            <Button type="primary" loading={createMut.isPending} onClick={handleSubmit}>Lưu phiếu</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ dvt: 'Thùng', ngay_nhap: dayjs(), so_luong_loi: 0, don_gia_xuat_xuong: 0 }}>
          <Form.Item name="production_order_id" label="Lệnh sản xuất" rules={[{ required: true, message: 'Chọn LSX' }]}>
            <Select placeholder="Chọn LSX..." showSearch
              filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
              options={(lsxList as ProductionOrderListItem[]).map((o: ProductionOrderListItem) => ({
                value: o.id,
                label: `${o.so_lenh}${o.ten_khach_hang ? ' — ' + o.ten_khach_hang : ''}`,
              }))}
              onChange={(orderId) => {
                const order = (lsxList as ProductionOrderListItem[]).find(o => o.id === orderId)
                const pxId = order?.phan_xuong_id ?? null
                setFormPxId(pxId)
                const tpWh = warehouses.find(w => w.loai_kho === 'THANH_PHAM' && w.trang_thai && w.phan_xuong_id === pxId)
                form.setFieldValue('warehouse_id', tpWh?.id ?? undefined)
                if (order?.ten_hang) form.setFieldValue('ten_hang', order.ten_hang)
                if (order?.gia_ban_muc_tieu) form.setFieldValue('don_gia_xuat_xuong', order.gia_ban_muc_tieu)
              }}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="ngay_nhap" label="Ngày nhập" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="warehouse_id" label="Kho TP / BTP" rules={[{ required: true, message: 'Chọn kho' }]}>
                <Select placeholder="Chọn kho TP hoặc BTP"
                  options={warehouses
                    .filter(w => w.trang_thai && (w.loai_kho === 'THANH_PHAM' || w.loai_kho === 'BTP') && (!formPxId || w.phan_xuong_id === formPxId))
                    .map(w => ({ value: w.id, label: `${w.ten_kho}${w.loai_kho === 'BTP' ? ' (BTP)' : ''}` }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="ten_hang" label="Tên hàng" rules={[{ required: true, message: 'Nhập tên hàng' }]}>
            <Input placeholder="Ví dụ: Thùng carton 3 lớp B ..." />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="so_luong_nhap" label="SL nhập (OK)" rules={[{ required: true, message: 'Nhập SL' }]}>
                <InputNumber min={0.001} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="so_luong_loi" label="SL lỗi">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="dvt" label="ĐVT">
                <Select options={['Thùng', 'Cái', 'Tờ', 'Kg'].map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="don_gia_xuat_xuong" label="Đơn giá xuất xưởng">
                <InputNumber min={0} style={{ width: '100%' }}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ghi_chu" label="Ghi chú">
                <Input placeholder="..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Drawer>

      <Drawer
        open={!!viewRecord}
        onClose={() => setViewRecord(null)}
        title={viewRecord ? <Text strong style={{ color: '#52c41a' }}>{viewRecord.so_phieu}</Text> : ''}
        width={480}
      >
        {viewRecord && (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Ngày nhập">{viewRecord.ngay_nhap}</Descriptions.Item>
            <Descriptions.Item label="Lệnh SX">{viewRecord.so_lenh}</Descriptions.Item>
            <Descriptions.Item label="Sản phẩm">{viewRecord.ten_hang || '—'}</Descriptions.Item>
            <Descriptions.Item label="Kho nhập">{viewRecord.ten_kho}</Descriptions.Item>
            <Descriptions.Item label="SL nhập"><Text strong>{viewRecord.so_luong_nhap.toLocaleString('vi-VN')} {viewRecord.dvt}</Text></Descriptions.Item>
            <Descriptions.Item label="SL lỗi">
              {viewRecord.so_luong_loi > 0
                ? <Text type="danger">{viewRecord.so_luong_loi.toLocaleString('vi-VN')} {viewRecord.dvt}</Text>
                : '0'}
            </Descriptions.Item>
            <Descriptions.Item label="Đơn giá XX">
              {viewRecord.don_gia_xuat_xuong > 0 ? viewRecord.don_gia_xuat_xuong.toLocaleString('vi-VN') + 'đ' : '—'}
            </Descriptions.Item>
            {viewRecord.trang_thai_loi && (
              <Descriptions.Item label="Trạng thái lỗi">
                <Tag color="orange">{viewRecord.trang_thai_loi}</Tag>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Người lập">{viewRecord.created_by_name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Ghi chú">{viewRecord.ghi_chu || '—'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  )
}
