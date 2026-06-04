import { useState } from 'react'
import type { ApiError } from '../../api/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Drawer, Form, Input, InputNumber,
  Popconfirm, Row, Select, Space, Table, Tag, Tooltip, Typography, message, Divider,
} from 'antd'
import { FileExcelOutlined, PrinterOutlined, PlusOutlined, DeleteOutlined, ExportOutlined, MinusCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { warehouseApi, CreateMaterialIssuePayload, MaterialIssue, MaterialIssueItem } from '../../api/warehouse'
import { warehousesApi } from '../../api/warehouses'
import { paperMaterialsFullApi } from '../../api/paperMaterials'
import { otherMaterialsApi } from '../../api/otherMaterials'
import { productionOrdersApi } from '../../api/productionOrders'
import { exportToExcel, printDocument, buildHtmlTable, smartExportExcel, smartPrintPdf, resolveSinglePhapNhanId, downloadBlob } from '../../utils/exportUtils'
import { usePhapNhanForPrint } from '../../hooks/usePhapNhan'
import EmptyState from "../../components/EmptyState"

const { Title, Text } = Typography

export default function IssuesPage() {
  const companyInfo = usePhapNhanForPrint()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [filterKho, setFilterKho] = useState<number | undefined>()
  const [filterPhapNhan, setFilterPhapNhan] = useState<number | undefined>()
  const [filterXuong, setFilterXuong] = useState<number | undefined>()
  const [tuNgay, setTuNgay] = useState<string | undefined>()
  const [denNgay, setDenNgay] = useState<string | undefined>()
  const [formPxId, setFormPxId] = useState<number | null>(null)

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: () => warehousesApi.list().then(r => r.data),
  })

  const { data: paperPage } = useQuery({
    queryKey: ['paper-materials-all'],
    queryFn: () => paperMaterialsFullApi.list({ page_size: 1000 }).then(r => r.data),
    staleTime: 300_000,
  })
  const paperMats = paperPage?.items ?? []

  const { data: otherPage } = useQuery({
    queryKey: ['other-materials-all'],
    queryFn: () => otherMaterialsApi.list({ page_size: 1000 }).then(r => r.data),
    staleTime: 300_000,
  })
  const otherMats = otherPage?.items ?? []

  const { data: lsxPaged } = useQuery({
    queryKey: ['production-orders-list'],
    queryFn: () => productionOrdersApi.list({ page_size: 500 }).then(r => r.data),
    staleTime: 60_000,
  })
  const lsxList = lsxPaged?.items ?? []

  const { data: issueList = [], isLoading } = useQuery({
    queryKey: ['material-issues', filterPhapNhan, filterXuong, filterKho, tuNgay, denNgay],
    queryFn: () => warehouseApi.listMaterialIssues({
      warehouse_id: filterKho, phap_nhan_id: filterPhapNhan, phan_xuong_id: filterXuong, tu_ngay: tuNgay, den_ngay: denNgay,
    }).then(r => r.data),
  })

  const phapNhanOptions = Array.from(new Map(
    warehouses.filter(w => w.phap_nhan_id).map(w => [w.phap_nhan_id, { value: w.phap_nhan_id!, label: w.ten_phap_nhan || `PN #${w.phap_nhan_id}` }])
  ).values())
  const xuongOptions = Array.from(new Map(
    warehouses
      .filter(w => w.phan_xuong_id && (!filterPhapNhan || w.phap_nhan_id === filterPhapNhan))
      .map(w => [w.phan_xuong_id, { value: w.phan_xuong_id!, label: w.ten_xuong || `Xuong #${w.phan_xuong_id}` }])
  ).values())
  const warehouseOptions = warehouses
    .filter(w => w.trang_thai)
    .filter(w => !filterPhapNhan || w.phap_nhan_id === filterPhapNhan)
    .filter(w => !filterXuong || w.phan_xuong_id === filterXuong)
    .map(w => ({ value: w.id, label: w.ten_kho }))

  const createMut = useMutation({
    mutationFn: (data: CreateMaterialIssuePayload) => warehouseApi.createMaterialIssue(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['material-issues'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      message.success('Đã tạo phiếu xuất NVL')
      setOpen(false)
      form.resetFields()
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi tạo phiếu'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => warehouseApi.deleteMaterialIssue(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['material-issues'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      message.success('Đã xoá phiếu xuất')
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi xoá'),
  })

  const handleMatSelect = (itemName: number, loai: string, matId: number) => {
    const mat = loai === 'giay' ? paperMats.find(m => m.id === matId) : otherMats.find(m => m.id === matId)
    if (!mat) return
    const items = form.getFieldValue('items') || []
    const updated = [...items]
    updated[itemName] = { ...updated[itemName], mat_id: matId, ten_hang: mat.ten, dvt: mat.dvt }
    form.setFieldValue('items', updated)
  }

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields()
      const items = (v.items as Array<Record<string, unknown>> || []).map((it) => ({
        paper_material_id: it.loai_vat_tu === 'giay' ? (it.mat_id || null) : null,
        other_material_id: it.loai_vat_tu === 'khac' ? (it.mat_id || null) : null,
        ten_hang: it.ten_hang || '',
        so_luong_ke_hoach: it.so_luong_ke_hoach || 0,
        so_luong_thuc_xuat: it.so_luong_thuc_xuat,
        dvt: it.dvt || 'Kg',
        don_gia: it.don_gia || 0,
        ghi_chu: it.ghi_chu || null,
      }))
      if (!items.length) { message.warning('Thêm ít nhất 1 dòng hàng'); return }
      createMut.mutate({
        ngay_xuat: v.ngay_xuat.format('YYYY-MM-DD'),
        production_order_id: v.production_order_id,
        warehouse_id: v.warehouse_id,
        ghi_chu: v.ghi_chu || null,
        items: items as CreateMaterialIssuePayload['items'],
      })
    } catch { /* validation shown inline */ }
  }

  const handlePrintIssue = (r: MaterialIssue) => {
    if (!r.phap_nhan_id) {
      message.error('Phiếu xuất NVL chưa có pháp nhân nên không thể in')
      return
    }
    const cols = [
      { header: 'Tên hàng', key: 'ten_hang' },
      { header: 'ĐVT', key: 'dvt', align: 'center' as const },
      { header: 'SL kế hoạch', key: 'so_luong_ke_hoach', align: 'right' as const },
      { header: 'SL thực xuất', key: 'so_luong_thuc_xuat', align: 'right' as const },
    ]
    const rowData = r.items.map((it: MaterialIssueItem) => ({
      ten_hang: it.ten_hang,
      dvt: it.dvt,
      so_luong_ke_hoach: it.so_luong_ke_hoach > 0 ? Number(it.so_luong_ke_hoach).toLocaleString('vi-VN', { maximumFractionDigits: 3 }) : '—',
      so_luong_thuc_xuat: Number(it.so_luong_thuc_xuat).toLocaleString('vi-VN', { maximumFractionDigits: 3 }),
    }))
    const table = buildHtmlTable(cols.map(c => ({ header: c.header, align: c.align })), rowData.map(row => cols.map(c => (row as Record<string, unknown>)[c.key])) as (string | number | null | undefined)[][])
    
    const printData = {
      subtitle: 'PHIẾU XUẤT NGUYÊN VẬT LIỆU',
      document_number: r.so_phieu,
      document_date: r.ngay_xuat ?? '',
      warehouse_name: r.ten_kho ?? '—',
      so_lenh: r.so_lenh ?? '—',
      ghi_chu: r.ghi_chu ?? '—',
      body_html: table,
    }

    smartPrintPdf('MATERIAL_ISSUE', printData, r.phap_nhan_id)
  }

  const handleExportIssueExcel = async (id: number, soPhieu: string) => {
    try {
      const blob = await warehouseApi.exportMaterialIssueExcel(id)
      downloadBlob(blob, `XNVL_${soPhieu || id}.xlsx`)
    } catch {
      message.error('Không thể xuất Excel. Kiểm tra lại cấu hình mẫu Excel MATERIAL_ISSUE.')
    }
  }

  const handleExportExcel = () => {
    const resolvedPhapNhanId = resolveSinglePhapNhanId(issueList)
    if (!issueList.length) {
      message.warning('Không có dữ liệu để xuất Excel')
      return
    }
    if (!resolvedPhapNhanId) {
      message.error('Chỉ xuất Excel phiếu xuất NVL khi danh sách thuộc một pháp nhân. Vui lòng lọc dữ liệu trước.')
      return
    }
    const defaultConfig = [
      { key: 'so_phieu', label: 'Số phiếu', width: 18 },
      { key: 'ngay_xuat', label: 'Ngày xuất', width: 12 },
      { key: 'ten_kho', label: 'Kho', width: 18 },
      { key: 'so_lenh', label: 'Lệnh SX', width: 16 },
      { key: 'trang_thai_lbl', label: 'Trạng thái', width: 12 },
    ]

    const exportData = issueList.map((r: MaterialIssue) => ({
      ...r,
      so_lenh: r.so_lenh ?? '',
      trang_thai_lbl: r.trang_thai === 'da_xuat' ? 'Đã xuất' : r.trang_thai === 'huy' ? 'Huỷ' : 'Nhập',
    }))

    smartExportExcel('MATERIAL_ISSUE', exportData, defaultConfig, `XuatNVL_${dayjs().format('YYYYMMDD')}`, resolvedPhapNhanId)
  }

  const columns = [
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 160,
      render: (v: string) => <Text strong style={{ color: '#fa8c16' }}>{v}</Text> },
    { title: 'Ngày xuất', dataIndex: 'ngay_xuat', width: 110 },
    { title: 'Kho xuất', dataIndex: 'ten_kho', width: 150 },
    { title: 'LSX', dataIndex: 'so_lenh', width: 150,
      render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: 'TT', dataIndex: 'trang_thai', width: 100,
      render: (v: string) => (
        <Tag color={v === 'da_xuat' ? 'green' : v === 'huy' ? 'red' : 'default'}>
          {v === 'da_xuat' ? 'Đã xuất' : v === 'huy' ? 'Huỷ' : 'Nhập'}
        </Tag>
      ) },
    {
      title: '', width: 80,
      render: (_: unknown, r: MaterialIssue) => (
        <Space size={4}>
          <Button size="small" icon={<PrinterOutlined />} onClick={() => handlePrintIssue(r)} />
          <Tooltip title="Xuất Excel phiếu">
            <Button size="small" icon={<FileExcelOutlined />} style={{ color: '#217346', borderColor: '#217346' }}
              onClick={() => handleExportIssueExcel(r.id, r.so_phieu)} />
          </Tooltip>
          <Popconfirm title="Xoá phiếu xuất này?" onConfirm={() => deleteMut.mutate(r.id)} okButtonProps={{ danger: true }}
            disabled={r.trang_thai === 'da_xuat'}>
            <Button danger size="small" icon={<DeleteOutlined />} disabled={r.trang_thai === 'da_xuat'} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const expandedRowRender = (r: MaterialIssue) => (
    <Table dataSource={r.items} rowKey={(_, i) => `${r.id}-${i}`} size="small" pagination={false}
      columns={[
        { title: 'Tên hàng', dataIndex: 'ten_hang' },
        { title: 'ĐVT', dataIndex: 'dvt', width: 60 },
        { title: 'SL kế hoạch', dataIndex: 'so_luong_ke_hoach', width: 110, align: 'right' as const,
          render: (v: number) => v > 0 ? v.toLocaleString('vi-VN', { maximumFractionDigits: 3 }) : '—' },
        { title: 'SL thực xuất', dataIndex: 'so_luong_thuc_xuat', width: 120, align: 'right' as const,
          render: (v: number) => <Text strong>{v.toLocaleString('vi-VN', { maximumFractionDigits: 3 })}</Text> },
        { title: 'Ghi chú', dataIndex: 'ghi_chu', render: (v: string | null) => v || '—' },
      ]}
    />
  )

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space><ExportOutlined style={{ fontSize: 20, color: '#fa8c16' }} />
            <Title level={4} style={{ margin: 0 }}>Xuất NVL cho sản xuất</Title>
          </Space>
        </Col>
        <Col>
          <Space>
            <Button icon={<FileExcelOutlined />} style={{ color: '#217346', borderColor: '#217346' }} onClick={handleExportExcel}>
              Xuất Excel
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setFormPxId(null); setOpen(true) }}>
              Tạo phiếu xuất
            </Button>
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
              onChange={d => setTuNgay(d ? d.format('YYYY-MM-DD') : undefined)} />
          </Col>
          <Col xs={12} sm={6}>
            <DatePicker placeholder="Đến ngày" style={{ width: '100%' }} format="DD/MM/YYYY"
              onChange={d => setDenNgay(d ? d.format('YYYY-MM-DD') : undefined)} />
          </Col>
        </Row>
      </Card>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table dataSource={issueList} columns={columns} rowKey="id" loading={isLoading} size="small"
          expandable={{ expandedRowRender }} pagination={{ pageSize: 20, showSizeChanger: true }} scroll={{ x: 750 }} />
      </Card>

      <Drawer open={open} onClose={() => setOpen(false)} title="Tạo phiếu xuất NVL" width={820}
        footer={
          <Space>
            <Button onClick={() => setOpen(false)}>Huỷ</Button>
            <Button type="primary" loading={createMut.isPending} onClick={handleSubmit}>Lưu phiếu xuất</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ ngay_xuat: dayjs() }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="production_order_id" label="Lệnh sản xuất" rules={[{ required: true, message: 'Chọn LSX' }]}>
                <Select placeholder="Chọn LSX..." showSearch
                  filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
                  options={lsxList.map((o) => ({
                    value: o.id,
                    label: `${o.so_lenh}${o.ten_khach_hang ? ' — ' + o.ten_khach_hang : ''}`,
                  }))}
                  onChange={(orderId) => {
                    const order = lsxList.find((o) => o.id === orderId)
                    const pxId = order?.phan_xuong_id ?? null
                    setFormPxId(pxId)
                    const gcWh = warehouses.find(w => w.loai_kho === 'GIAY_CUON' && w.trang_thai && w.phan_xuong_id === pxId)
                    const nlWh = warehouses.find(w => w.loai_kho === 'NVL_PHU' && w.trang_thai && w.phan_xuong_id === pxId)
                    const autoWh = gcWh ?? nlWh
                    if (autoWh) form.setFieldValue('warehouse_id', autoWh.id)
                    else form.setFieldValue('warehouse_id', undefined)
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ngay_xuat" label="Ngày xuất" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="warehouse_id" label="Kho xuất" rules={[{ required: true, message: 'Chọn kho' }]}>
                <Select placeholder="Chọn kho"
                  options={warehouses
                    .filter(w => w.trang_thai &&
                      ['GIAY_CUON', 'NVL_PHU', 'nguyen_lieu', 'khac'].includes(w.loai_kho ?? '') &&
                      (!formPxId || w.phan_xuong_id === formPxId))
                    .map(w => ({ value: w.id, label: w.ten_kho }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ghi_chu" label="Ghi chú">
                <Input placeholder="Ghi chú phiếu..." />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ fontSize: 13 }}>Danh sách NVL xuất</Divider>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name }) => (
                  <Card key={key} size="small" style={{ marginBottom: 8, background: '#fafafa' }}>
                    <Row gutter={[8, 4]}>
                      <Col span={5}>
                        <Form.Item name={[name, 'loai_vat_tu']} label="Loại" style={{ marginBottom: 4 }}>
                          <Select size="small"
                            onChange={() => {
                              const items = form.getFieldValue('items') || []
                              const updated = [...items]
                              updated[name] = { ...updated[name], mat_id: undefined, ten_hang: '', dvt: 'Kg' }
                              form.setFieldValue('items', updated)
                            }}
                            options={[
                              { value: 'giay', label: 'NL Giấy' },
                              { value: 'khac', label: 'NL Khác' },
                              { value: 'tu_do', label: 'Tự do' },
                            ]}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={14}>
                        <Form.Item noStyle dependencies={[['items', name, 'loai_vat_tu']]}>
                          {({ getFieldValue }) => {
                            const loai = getFieldValue(['items', name, 'loai_vat_tu'])
                            if (loai === 'giay') return (
                              <Form.Item name={[name, 'mat_id']} label="Nguyên liệu giấy" style={{ marginBottom: 4 }}>
                                <Select size="small" showSearch placeholder="Chọn NL giấy..."
                                  filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
                                  options={paperMats.filter(m => m.su_dung).map(m => ({ value: m.id, label: `${m.ten} (${m.dvt})` }))}
                                  onChange={id => handleMatSelect(name, 'giay', id)} />
                              </Form.Item>
                            )
                            if (loai === 'khac') return (
                              <Form.Item name={[name, 'mat_id']} label="Nguyên liệu khác" style={{ marginBottom: 4 }}>
                                <Select size="small" showSearch placeholder="Chọn NL khác..."
                                  filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
                                  options={otherMats.filter(m => m.trang_thai).map(m => ({ value: m.id, label: `${m.ten} (${m.dvt})` }))}
                                  onChange={id => handleMatSelect(name, 'khac', id)} />
                              </Form.Item>
                            )
                            return (
                              <Form.Item name={[name, 'ten_hang']} label="Tên hàng" style={{ marginBottom: 4 }}>
                                <Input size="small" placeholder="Tên hàng..." />
                              </Form.Item>
                            )
                          }}
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item name={[name, 'dvt']} label="ĐVT" style={{ marginBottom: 4 }}>
                          <Select size="small" options={['Kg', 'Tấn', 'Tờ', 'Cuộn', 'Lít', 'Cái'].map(v => ({ value: v, label: v }))} />
                        </Form.Item>
                      </Col>
                      <Col span={1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 20 }}>
                        <MinusCircleOutlined style={{ color: '#ff4d4f', fontSize: 16, cursor: 'pointer' }} onClick={() => remove(name)} />
                      </Col>
                      <Col span={8}>
                        <Form.Item name={[name, 'so_luong_ke_hoach']} label="SL kế hoạch" style={{ marginBottom: 4 }}>
                          <InputNumber size="small" min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name={[name, 'so_luong_thuc_xuat']} label="SL thực xuất" rules={[{ required: true, message: 'Nhập SL' }]} style={{ marginBottom: 4 }}>
                          <InputNumber size="small" min={0.001} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name={[name, 'ghi_chu']} label="Ghi chú" style={{ marginBottom: 4 }}>
                          <Input size="small" placeholder="..." />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                ))}
                <Button type="dashed" block icon={<PlusOutlined />}
                  onClick={() => add({ loai_vat_tu: 'giay', dvt: 'Kg', so_luong_ke_hoach: 0 })}>
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
