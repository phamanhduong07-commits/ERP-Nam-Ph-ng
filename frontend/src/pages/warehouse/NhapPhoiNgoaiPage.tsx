import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Form, Image, Input, InputNumber,
  Modal, Popconfirm, Row, Select, Space, Table, Tag, Typography, Upload, message, Divider,
} from 'antd'
import {
  FileExcelOutlined, FileImageOutlined, PrinterOutlined, PlusOutlined, DeleteOutlined,
  CheckCircleOutlined, UploadOutlined, AppstoreOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { warehouseApi, CreateGoodsReceiptPayload, CompleteGoodsReceiptPayload, GoodsReceipt } from '../../api/warehouse'
import { warehousesApi } from '../../api/warehouses'
import { purchaseApi } from '../../api/purchase'
import { suppliersApi } from '../../api/suppliers'
import { phapNhanApi } from '../../api/phap_nhan'
import { exportToExcel, printDocument, buildHtmlTable } from '../../utils/exportUtils'
import { usePhapNhanForPrint } from '../../hooks/usePhapNhan'

const { Title, Text } = Typography

const SO_LOP_OPTIONS = [
  { value: 3, label: '3 lớp' },
  { value: 5, label: '5 lớp' },
  { value: 7, label: '7 lớp' },
]

const KET_QUA_OPTIONS = [
  { value: 'DAT', label: 'Đạt' },
  { value: 'KHONG_DAT', label: 'Không đạt' },
  { value: 'CHO_KIEM_TRA', label: 'Chờ KT' },
]

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

export default function NhapPhoiNgoaiPage() {
  const companyInfo = usePhapNhanForPrint()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [filterXuong, setFilterXuong] = useState<number | undefined>()
  const [filterNCC, setFilterNCC] = useState<number | undefined>()
  const [tuNgay, setTuNgay] = useState<string | undefined>()
  const [denNgay, setDenNgay] = useState<string | undefined>()
  const [selectedPO, setSelectedPO] = useState<number | undefined>()
  const [formPxId, setFormPxId] = useState<number | null>(null)
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [invoicePreviewUrl, setInvoicePreviewUrl] = useState<string | null>(null)
  const [editingDraftId, setEditingDraftId] = useState<number | null>(null)

  const watchedItems: any[] = Form.useWatch('items', form) ?? []
  const hdTongKgWatch = Form.useWatch('hd_tong_kg', form)
  const calcTongTam = watchedItems.reduce((s: number, it: any) => s + (Number(it?.so_luong) || 0), 0)
  const kgLech = (hdTongKgWatch != null && hdTongKgWatch !== '') ? calcTongTam - Number(hdTongKgWatch) : null
  const isKhop = kgLech !== null && Math.abs(kgLech) < 1

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: () => warehousesApi.list().then(r => r.data),
  })
  const phoiWarehouses = warehouses.filter((w: any) => w.trang_thai && w.loai_kho === 'PHOI')

  const { data: phanXuongs = [] } = useQuery({
    queryKey: ['phan-xuong-list'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
    staleTime: 300_000,
  })

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.all().then(r => r.data),
    staleTime: 300_000,
  })

  const { data: phapNhans = [] } = useQuery({
    queryKey: ['phap-nhan-list'],
    queryFn: () => phapNhanApi.list({ active_only: true }).then(r => r.data),
    staleTime: 300_000,
  })

  const { data: poList = [] } = useQuery({
    queryKey: ['purchase-orders-giay-cuon'],
    queryFn: () => purchaseApi.list({ loai_po: 'giay_cuon', trang_thai: 'da_duyet' }).then(r => r.data),
    staleTime: 60_000,
  })

  const { data: poDetail } = useQuery({
    queryKey: ['purchase-order-detail', selectedPO],
    queryFn: () => selectedPO ? purchaseApi.get(selectedPO).then(r => r.data) : null,
    enabled: !!selectedPO,
  })

  const { data: receiptList = [], isLoading } = useQuery({
    queryKey: ['goods-receipts-phoi', filterXuong, filterNCC, tuNgay, denNgay],
    queryFn: () => warehouseApi.listGoodsReceipts({
      supplier_id: filterNCC, tu_ngay: tuNgay, den_ngay: denNgay,
      loai_hang: 'phoi',
    }).then(r => r.data),
  })

  const handleClose = () => {
    setOpen(false)
    setInvoiceFile(null)
    setInvoicePreviewUrl(null)
    setEditingDraftId(null)
    form.resetFields()
    setSelectedPO(undefined)
    setFormPxId(null)
  }

  const handleOpenDraft = async (r: GoodsReceipt) => {
    const detail = await warehouseApi.getGoodsReceipt(r.id).then(res => res.data)
    setEditingDraftId(r.id)
    if (detail.invoice_image) setInvoicePreviewUrl(detail.invoice_image)
    form.setFieldsValue({
      so_xe: detail.so_xe,
      ngay_nhap: detail.ngay_nhap ? require('dayjs')(detail.ngay_nhap) : undefined,
      supplier_id: detail.supplier_id,
      phap_nhan_id: detail.phap_nhan_id,
      warehouse_id: detail.warehouse_id,
      hd_tong_kg: detail.hd_tong_kg,
      ghi_chu: detail.ghi_chu,
      items: [],
    })
    setOpen(true)
  }

  const createMut = useMutation({
    mutationFn: (data: CreateGoodsReceiptPayload) => warehouseApi.createGoodsReceipt(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goods-receipts-phoi'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      message.success('Đã tạo phiếu nhập phôi')
      handleClose()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo phiếu'),
  })

  const completeMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CompleteGoodsReceiptPayload }) =>
      warehouseApi.completeGoodsReceipt(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goods-receipts-phoi'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      message.success('Đã hoàn thiện phiếu — tồn kho phôi đã cập nhật')
      handleClose()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi hoàn thiện phiếu'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => warehouseApi.deleteGoodsReceipt(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goods-receipts-phoi'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      message.success('Đã xoá phiếu')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi xoá'),
  })

  const approveMut = useMutation({
    mutationFn: (id: number) => warehouseApi.approveGoodsReceipt(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goods-receipts-phoi'] })
      message.success('Đã duyệt phiếu nhập phôi')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi duyệt'),
  })

  useEffect(() => {
    if (!poDetail) return
    form.setFieldsValue({
      supplier_id: poDetail.supplier_id,
      items: (poDetail.items || []).map((it: any) => ({
        ten_hang: it.ten_hang,
        so_luong: it.so_luong,
        dvt: it.dvt || 'Tấm',
        don_gia: it.don_gia,
        po_item_id: it.id,
        so_lop: it.phoi_spec?.so_lop || null,
        kho_mm: it.phoi_spec?.kho_tt || null,   // kho_tt = chiều rộng tấm phôi thực tế
        dai_mm: it.phoi_spec?.dai_tt || null,   // dai_tt = chiều dài tấm phôi thực tế
        ket_qua_kiem_tra: 'DAT',
      })),
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poDetail])

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields()
      const items = (v.items || []).map((it: any) => ({
        po_item_id: it.po_item_id || null,
        paper_material_id: null,
        other_material_id: null,
        ten_hang: it.ten_hang || '',
        so_luong: it.so_luong,
        dvt: it.dvt || 'Tấm',
        don_gia: it.don_gia || 0,
        ket_qua_kiem_tra: it.ket_qua_kiem_tra || 'DAT',
        kho_mm: it.kho_mm || null,
        dai_mm: it.dai_mm || null,
        so_cuon: it.so_tam || null,   // so_cuon dùng để lưu số tấm
        so_lop: it.so_lop || null,
        ghi_chu: it.ghi_chu || null,
      }))
      if (!items.length) { message.warning('Thêm ít nhất 1 dòng phôi'); return }
      let invoice_image: string | null = null
      if (invoiceFile) invoice_image = await fileToBase64(invoiceFile)

      if (editingDraftId) {
        completeMut.mutate({
          id: editingDraftId,
          data: { warehouse_id: v.warehouse_id || null, ghi_chu: v.ghi_chu || null, hd_tong_kg: v.hd_tong_kg || null, items },
        })
      } else {
        createMut.mutate({
          ngay_nhap: v.ngay_nhap.format('YYYY-MM-DD'),
          po_id: v.po_id || null,
          supplier_id: v.supplier_id,
          warehouse_id: v.warehouse_id,
          loai_nhap: 'PHOI_NGOAI',
          phap_nhan_id: v.phap_nhan_id || null,
          ghi_chu: v.ghi_chu || null,
          so_xe: v.so_xe || null,
          invoice_image,
          hd_tong_kg: v.hd_tong_kg || null,
          items,
        } as any)
      }
    } catch { /* validation inline */ }
  }

  const handlePrintReceipt = (r: GoodsReceipt) => {
    const cols = [
      { header: 'Tên phôi' },
      { header: 'Lớp', align: 'center' as const },
      { header: 'Rộng (mm)', align: 'right' as const },
      { header: 'Dài (mm)', align: 'right' as const },
      { header: 'Số tấm', align: 'right' as const },
      { header: 'Đơn giá', align: 'right' as const },
      { header: 'Thành tiền (đ)', align: 'right' as const },
    ]
    const rowData = (r.items || []).map((it: any) => [
      it.ten_hang,
      it.so_lop ? `${it.so_lop}L` : '—',
      it.kho_mm ? `${it.kho_mm}` : '—',
      it.dai_mm ? `${it.dai_mm}` : '—',
      it.so_cuon ? `${it.so_cuon}` : Number(it.so_luong).toLocaleString('vi-VN'),
      Number(it.don_gia) > 0 ? Number(it.don_gia).toLocaleString('vi-VN') : '—',
      (Number(it.thanh_tien) || 0).toLocaleString('vi-VN'),
    ])
    const tong = (r.items || []).reduce((s: number, it: any) => s + (Number(it.thanh_tien) || 0), 0)
    printDocument({
      title: `Phiếu nhập phôi ${r.so_phieu}`,
      subtitle: 'PHIẾU NHẬP KHO PHÔI SÓNG',
      companyInfo,
      documentNumber: r.so_phieu,
      documentDate: r.ngay_nhap ?? '',
      fields: [
        { label: 'Số xe', value: r.so_xe ?? '—' },
        { label: 'Kho phôi', value: r.ten_kho ?? '—' },
        { label: 'Nhà cung cấp', value: r.ten_ncc ?? '—' },
      ],
      bodyHtml: buildHtmlTable(cols, rowData, { totalRow: ['TỔNG CỘNG', '', '', '', '', '', tong.toLocaleString('vi-VN') + ' đ'] }),
    })
  }

  const handleExportExcel = () => {
    exportToExcel(`NhapPhoiNgoai_${dayjs().format('YYYYMMDD')}`, [{
      name: 'Nhập phôi ngoài',
      headers: ['Số phiếu', 'Ngày nhập', 'Số xe', 'Kho phôi', 'Nhà CC', 'Tổng tiền', 'Trạng thái'],
      rows: receiptList.map((r: GoodsReceipt) => [
        r.so_phieu, r.ngay_nhap, r.so_xe ?? '', r.ten_kho ?? '', r.ten_ncc ?? '',
        r.tong_gia_tri,
        r.trang_thai === 'da_duyet' ? 'Đã duyệt' : r.trang_thai === 'nhap_nhanh' ? 'Chờ nhập' : 'Đã nhập',
      ]),
      colWidths: [18, 12, 12, 20, 22, 16, 12],
    }])
  }

  const columns = [
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 160,
      render: (v: string) => <Text strong style={{ color: '#1677ff' }}>{v}</Text> },
    { title: 'Ngày nhập', dataIndex: 'ngay_nhap', width: 110 },
    { title: 'Số xe', dataIndex: 'so_xe', width: 100, render: (v: string | null) => v || '—' },
    { title: 'Kho phôi', dataIndex: 'ten_kho', width: 160 },
    { title: 'Nhà CC', dataIndex: 'ten_ncc', width: 150 },
    { title: 'Tổng tiền', dataIndex: 'tong_gia_tri', width: 140, align: 'right' as const,
      render: (v: number) => <Text strong>{v.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}đ</Text> },
    { title: 'TT', dataIndex: 'trang_thai', width: 105,
      render: (v: string) => {
        if (v === 'nhap_nhanh') return <Tag color="orange">Chờ nhập</Tag>
        if (v === 'da_duyet') return <Tag color="green">Đã duyệt</Tag>
        return <Tag color="blue">Đã nhập</Tag>
      } },
    {
      title: '', width: 155,
      render: (_: unknown, r: GoodsReceipt) => (
        <Space size={4}>
          {r.trang_thai === 'nhap_nhanh' ? (
            <Button size="small" type="primary" onClick={() => handleOpenDraft(r)}>Hoàn thiện</Button>
          ) : (
            <Button size="small" icon={<PrinterOutlined />} onClick={() => handlePrintReceipt(r)} />
          )}
          <Popconfirm title="Duyệt phiếu nhập phôi?" onConfirm={() => approveMut.mutate(r.id)}
            disabled={r.trang_thai !== 'nhap'}>
            <Button size="small" icon={<CheckCircleOutlined />} style={{ color: '#52c41a', borderColor: '#52c41a' }}
              disabled={r.trang_thai !== 'nhap'} />
          </Popconfirm>
          <Popconfirm title="Xoá phiếu nhập phôi?" onConfirm={() => deleteMut.mutate(r.id)} okButtonProps={{ danger: true }}
            disabled={r.trang_thai === 'da_duyet'}>
            <Button danger size="small" icon={<DeleteOutlined />} disabled={r.trang_thai === 'da_duyet'} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const expandedRowRender = (r: GoodsReceipt) => (
    <div>
      {r.invoice_image && (
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>Phiếu xuất kho NCC:</Text>
          <Image src={r.invoice_image} height={48} style={{ cursor: 'pointer', borderRadius: 4, border: '1px solid #d9d9d9' }} />
        </div>
      )}
      <Table dataSource={r.items} rowKey={(_, i) => `${r.id}-${i}`} size="small" pagination={false}
        columns={[
          { title: 'Tên phôi', dataIndex: 'ten_hang' },
          { title: 'Lớp', dataIndex: 'so_lop', width: 60, align: 'center' as const,
            render: (v: number | null) => v ? `${v}L` : '—' },
          { title: 'Rộng (mm)', dataIndex: 'kho_mm', width: 90, align: 'right' as const,
            render: (v: number | null) => v ? v.toLocaleString('vi-VN') : '—' },
          { title: 'Dài (mm)', dataIndex: 'dai_mm', width: 90, align: 'right' as const,
            render: (v: number | null) => v ? v.toLocaleString('vi-VN') : '—' },
          { title: 'Số tấm', dataIndex: 'so_cuon', width: 80, align: 'right' as const,
            render: (v: number | null) => v ?? '—' },
          { title: 'Số lượng', dataIndex: 'so_luong', width: 90, align: 'right' as const,
            render: (v: number, it: any) => `${Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} ${it.dvt}` },
          { title: 'Đơn giá', dataIndex: 'don_gia', width: 120, align: 'right' as const,
            render: (v: number) => v > 0 ? v.toLocaleString('vi-VN') + 'đ' : '—' },
          { title: 'Thành tiền', dataIndex: 'thanh_tien', width: 130, align: 'right' as const,
            render: (v: number) => <Text strong>{(v || 0).toLocaleString('vi-VN')}đ</Text> },
          { title: 'KQ KT', dataIndex: 'ket_qua_kiem_tra', width: 100,
            render: (v: string) => (
              <Tag color={v === 'DAT' ? 'green' : v === 'KHONG_DAT' ? 'red' : 'orange'}>
                {v === 'DAT' ? 'Đạt' : v === 'KHONG_DAT' ? 'Không đạt' : 'Chờ KT'}
              </Tag>
            ) },
          { title: 'Ghi chú', dataIndex: 'ghi_chu', render: (v: string | null) => v || '—' },
        ]}
      />
    </div>
  )

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <AppstoreOutlined style={{ fontSize: 20, color: '#389e0d' }} />
            <Title level={4} style={{ margin: 0 }}>Nhập kho Phôi sóng (mua ngoài)</Title>
          </Space>
        </Col>
        <Col>
          <Space>
            <Button icon={<FileExcelOutlined />} style={{ color: '#217346', borderColor: '#217346' }} onClick={handleExportExcel}>
              Xuất Excel
            </Button>
            <Button type="primary" icon={<PlusOutlined />}
              onClick={() => { form.resetFields(); setSelectedPO(undefined); setFormPxId(null); setInvoiceFile(null); setInvoicePreviewUrl(null); setEditingDraftId(null); setOpen(true) }}>
              Tạo phiếu nhập phôi
            </Button>
          </Space>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[8, 8]}>
          <Col xs={12} sm={5}>
            <Select placeholder="Tất cả xưởng" style={{ width: '100%' }} allowClear value={filterXuong} onChange={setFilterXuong}
              options={phanXuongs.filter((p: any) => p.trang_thai).map((p: any) => ({ value: p.id, label: p.ten_xuong }))} />
          </Col>
          <Col xs={12} sm={5}>
            <Select placeholder="Tất cả NCC" style={{ width: '100%' }} allowClear value={filterNCC} onChange={setFilterNCC} showSearch
              filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
              options={suppliers.map((s: any) => ({ value: s.id, label: s.ten_viet_tat || s.ten_don_vi }))} />
          </Col>
          <Col xs={12} sm={4}>
            <DatePicker placeholder="Từ ngày" style={{ width: '100%' }} format="DD/MM/YYYY"
              onChange={d => setTuNgay(d ? d.format('YYYY-MM-DD') : undefined)} />
          </Col>
          <Col xs={12} sm={4}>
            <DatePicker placeholder="Đến ngày" style={{ width: '100%' }} format="DD/MM/YYYY"
              onChange={d => setDenNgay(d ? d.format('YYYY-MM-DD') : undefined)} />
          </Col>
        </Row>
      </Card>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table dataSource={receiptList} columns={columns} rowKey="id" loading={isLoading} size="small"
          expandable={{ expandedRowRender }} pagination={{ pageSize: 20, showSizeChanger: true }} scroll={{ x: 1000 }} />
      </Card>

      {/* ===== MODAL TẠO / HOÀN THIỆN PHIẾU NHẬP PHÔI ===== */}
      <Modal
        open={open}
        onCancel={handleClose}
        width="98vw"
        style={{ top: 8, padding: 0 }}
        styles={{ body: { padding: '12px 16px', height: 'calc(100vh - 120px)', overflow: 'hidden' } }}
        title={editingDraftId ? '✏️ Hoàn thiện phiếu nhập phôi sóng' : 'Tạo phiếu nhập phôi sóng (mua ngoài)'}
        footer={
          <Space>
            <Button onClick={handleClose}>Huỷ</Button>
            <Button type="primary" loading={createMut.isPending || completeMut.isPending} onClick={handleSubmit}>
              {editingDraftId ? 'Hoàn thiện & cập nhật tồn kho' : 'Lưu phiếu nhập phôi'}
            </Button>
          </Space>
        }
        destroyOnClose
      >
        <Row style={{ height: '100%' }} gutter={12}>

          {/* LEFT: ẢNH PHIẾU NCC */}
          <Col span={9} style={{ height: '100%', display: 'flex', flexDirection: 'column', borderRight: '1px solid #f0f0f0', paddingRight: 12 }}>
            <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Upload accept="image/*" showUploadList={false}
                beforeUpload={file => { setInvoiceFile(file); setInvoicePreviewUrl(URL.createObjectURL(file)); return false }}>
                <Button icon={<UploadOutlined />} size="small">Chọn ảnh phiếu xuất NCC</Button>
              </Upload>
              {invoicePreviewUrl && (
                <Button size="small" danger onClick={() => { setInvoiceFile(null); setInvoicePreviewUrl(null) }}>Xoá</Button>
              )}
            </div>
            <div style={{ flex: 1, overflow: 'auto', background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {invoicePreviewUrl ? (
                <Image src={invoicePreviewUrl} style={{ maxWidth: '100%', cursor: 'zoom-in' }} preview={{ mask: 'Xem lớn' }} />
              ) : (
                <div style={{ color: '#bbb', textAlign: 'center' }}>
                  <FileImageOutlined style={{ fontSize: 48, marginBottom: 8, display: 'block' }} />
                  Chụp / chọn ảnh phiếu xuất kho NCC<br />
                  <span style={{ fontSize: 12 }}>để đối soát số lượng phôi khi nhập</span>
                </div>
              )}
            </div>
          </Col>

          {/* RIGHT: FORM */}
          <Col span={15} style={{ height: '100%', overflowY: 'auto' }}>
            <Form form={form} layout="vertical" initialValues={{ ngay_nhap: dayjs() }}>

              {/* Hàng 1: Pháp nhân + Số xe + Ngày */}
              <Row gutter={10}>
                <Col span={8}>
                  <Form.Item name="phap_nhan_id" label="Pháp nhân" rules={[{ required: true, message: 'Chọn pháp nhân' }]}>
                    <Select placeholder="Nam Phương / Visunpack / ..."
                      options={phapNhans.map((p: any) => ({ value: p.id, label: p.ten_viet_tat || p.ten_phap_nhan }))} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="so_xe" label="Số xe">
                    <Input placeholder="VD: 51C-12345" />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="ngay_nhap" label="Ngày nhập" rules={[{ required: true }]}>
                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item name="po_id" label="Đặt hàng phôi (PO)">
                    <Select placeholder="Chọn PO phôi..." allowClear showSearch
                      filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
                      options={poList.map(p => ({ value: p.id, label: `${p.so_po} — ${p.ten_ncc || ''}${p.ten_phan_xuong ? ' | ' + p.ten_phan_xuong : ''}` }))}
                      onChange={v => v ? setSelectedPO(v) : setSelectedPO(undefined)}
                    />
                  </Form.Item>
                </Col>
              </Row>

              {/* Hàng 2: NCC + Xưởng + Kho phôi */}
              <Row gutter={10}>
                <Col span={12}>
                  <Form.Item name="supplier_id" label="Nhà cung cấp" rules={[{ required: true, message: 'Chọn NCC' }]}>
                    <Select placeholder="Chọn NCC..." showSearch
                      filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
                      options={suppliers.map((s: any) => ({ value: s.id, label: s.ten_viet_tat || s.ten_don_vi || s.ma_ncc }))} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Xưởng (lọc kho)">
                    <Select placeholder="Chọn xưởng..." allowClear
                      value={formPxId ?? undefined}
                      onChange={v => { setFormPxId(v ?? null); form.setFieldValue('warehouse_id', undefined) }}
                      options={phanXuongs.filter((p: any) => p.trang_thai).map((p: any) => ({ value: p.id, label: p.ten_xuong }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="warehouse_id" label="Kho phôi nhận" rules={[{ required: true, message: 'Chọn kho phôi' }]}>
                    <Select placeholder="Chọn kho phôi"
                      options={phoiWarehouses
                        .filter((w: any) => !formPxId || w.phan_xuong_id === formPxId)
                        .map((w: any) => ({ value: w.id, label: w.ten_kho }))} />
                  </Form.Item>
                </Col>
              </Row>

              {/* Hàng 3: Ghi chú + Đối soát */}
              <Row gutter={10}>
                <Col span={24}>
                  <Form.Item name="ghi_chu" label="Ghi chú">
                    <Input placeholder="Ghi chú phiếu..." />
                  </Form.Item>
                </Col>
              </Row>

              {/* Đối soát phiếu NCC */}
              <Card size="small"
                style={{ background: isKhop ? '#f6ffed' : '#fff7e6', marginBottom: 12, border: `1px solid ${isKhop ? '#b7eb8f' : '#ffd591'}` }}
                title={<span style={{ color: isKhop ? '#52c41a' : '#fa8c16', fontSize: 13 }}>
                  {isKhop ? '✅ Khớp phiếu xuất NCC' : '⚠️ Đối soát phiếu xuất NCC'}
                </span>}
              >
                <Row gutter={16} align="middle">
                  <Col span={12}>
                    <Form.Item name="hd_tong_kg" label="Tổng số tấm (hoặc kg) trên phiếu NCC" style={{ marginBottom: 0 }}>
                      <InputNumber style={{ width: '100%' }} placeholder="Nhập từ phiếu NCC" min={0}
                        formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                    </Form.Item>
                    {kgLech !== null && (
                      <div style={{ color: Math.abs(kgLech) < 1 ? '#52c41a' : '#ff4d4f', fontSize: 12, marginTop: 4 }}>
                        Tính được: <strong>{calcTongTam.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</strong>
                        {Math.abs(kgLech) >= 1 && <span> | Lệch: <strong>{kgLech > 0 ? '+' : ''}{kgLech.toFixed(1)}</strong></span>}
                      </div>
                    )}
                  </Col>
                  <Col span={12} style={{ fontSize: 13, color: '#555' }}>
                    <strong>{watchedItems.length}</strong> dòng phôi |{' '}
                    <strong>{calcTongTam.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</strong> tổng số lượng
                    {(hdTongKgWatch == null || hdTongKgWatch === '') && (
                      <div style={{ fontSize: 12, color: '#bbb', marginTop: 2 }}>Nhập tổng từ phiếu NCC để đối soát</div>
                    )}
                  </Col>
                </Row>
              </Card>

              <Divider orientation="left" style={{ fontSize: 13 }}>Danh sách phôi sóng nhập</Divider>

              <Form.List name="items">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name }) => (
                      <Card key={key} size="small" style={{ marginBottom: 8, background: '#f6ffed' }}>
                        <Row gutter={[8, 4]}>
                          <Col span={22}>
                            <Form.Item name={[name, 'ten_hang']} label="Tên / mô tả phôi" style={{ marginBottom: 4 }}
                              rules={[{ required: true, message: 'Nhập tên phôi' }]}>
                              <Input size="small" placeholder="VD: Phôi BC 5L — 1200×2400mm" />
                            </Form.Item>
                          </Col>
                          <Col span={2} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 20 }}>
                            <DeleteOutlined style={{ color: '#ff4d4f', fontSize: 15, cursor: 'pointer' }} onClick={() => remove(name)} />
                          </Col>
                          <Col span={4}>
                            <Form.Item name={[name, 'so_lop']} label="Số lớp" style={{ marginBottom: 4 }}>
                              <Select size="small" options={SO_LOP_OPTIONS} placeholder="3/5/7" />
                            </Form.Item>
                          </Col>
                          <Col span={5}>
                            <Form.Item name={[name, 'kho_mm']} label="Chiều rộng (mm)" style={{ marginBottom: 4 }}>
                              <InputNumber size="small" min={0} style={{ width: '100%' }} placeholder="mm" />
                            </Form.Item>
                          </Col>
                          <Col span={5}>
                            <Form.Item name={[name, 'dai_mm']} label="Chiều dài (mm)" style={{ marginBottom: 4 }}>
                              <InputNumber size="small" min={0} style={{ width: '100%' }} placeholder="mm" />
                            </Form.Item>
                          </Col>
                          <Col span={4}>
                            <Form.Item name={[name, 'so_tam']} label="Số tấm" style={{ marginBottom: 4 }}>
                              <InputNumber size="small" min={1} precision={0} style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item name={[name, 'ket_qua_kiem_tra']} label="KQ kiểm tra" style={{ marginBottom: 4 }}>
                              <Select size="small" options={KET_QUA_OPTIONS} />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item name={[name, 'so_luong']} label="Số lượng" rules={[{ required: true, message: 'Nhập SL' }]} style={{ marginBottom: 4 }}>
                              <InputNumber size="small" min={0.001} style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                          <Col span={4}>
                            <Form.Item name={[name, 'dvt']} label="ĐVT" style={{ marginBottom: 4 }}>
                              <Select size="small" options={['Tấm', 'Kg', 'Tờ'].map(v => ({ value: v, label: v }))} />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item name={[name, 'don_gia']} label="Đơn giá" style={{ marginBottom: 4 }}>
                              <InputNumber size="small" min={0} style={{ width: '100%' }}
                                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item name={[name, 'ghi_chu']} label="Ghi chú" style={{ marginBottom: 4 }}>
                              <Input size="small" placeholder="..." />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Card>
                    ))}
                    <Button type="dashed" block icon={<PlusOutlined />}
                      onClick={() => add({ dvt: 'Tấm', don_gia: 0, ket_qua_kiem_tra: 'DAT', so_lop: 5 })}>
                      Thêm dòng phôi
                    </Button>
                  </>
                )}
              </Form.List>
            </Form>
          </Col>
        </Row>
      </Modal>
    </div>
  )
}
