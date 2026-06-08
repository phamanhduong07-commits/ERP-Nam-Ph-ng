import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Form, Image, Input, InputNumber,
  Modal, Popconfirm, Row, Select, Space, Table, Tag, Typography, Upload, message, Divider,
} from 'antd'
import {
  FileExcelOutlined, FileImageOutlined, PrinterOutlined, PlusOutlined, DeleteOutlined,
  CheckCircleOutlined, UploadOutlined, AppstoreOutlined, ScanOutlined, FormOutlined, StarOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { warehouseApi, CreateGoodsReceiptPayload, CompleteGoodsReceiptPayload, GoodsReceipt } from '../../api/warehouse'
import { warehousesApi } from '../../api/warehouses'
import { purchaseApi } from '../../api/purchase'
import { suppliersApi } from '../../api/suppliers'
import { phapNhanApi } from '../../api/phap_nhan'
import { exportToExcel, smartExportExcel, smartPrintPdf, buildHtmlTable, resolveSinglePhapNhanId } from '../../utils/exportUtils'
import { usePhapNhanForPrint } from '../../hooks/usePhapNhan'
import { usePermission } from '../../hooks/usePermission'
import { getErrorMessage } from '../../utils/errorUtils'
import EmptyState from "../../components/EmptyState"
import { mediaApi } from '../../api/media'
import { ocrExamplesApi } from '../../api/ocrExamples'

const { Title, Text } = Typography

/** Thông số kỹ thuật của một dòng phôi trong PO item (phoi_spec). */
interface PhoiSpecItem {
  so_tam?: number
  kho_mm?: number
  dai_mm?: number
  so_lop?: number
  /** Khổ thực tế (chiều rộng tấm) — nguồn cho kho_mm khi map từ PO. */
  kho_tt?: number
  /** Dài thực tế (chiều dài tấm) — nguồn cho dai_mm khi map từ PO. */
  dai_tt?: number
}

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
  const { hasPermission, canApprove } = usePermission()
  const canImport = hasPermission('inventory.import')
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
  const [ocrResult, setOcrResult] = useState<Record<number, any>>({})
  const [ocrLoading, setOcrLoading] = useState(false)
  const [savingExample, setSavingExample] = useState(false)

  const watchedItems = (Form.useWatch('items', form) ?? []) as Record<string, unknown>[]
  const hdTongKgWatch = Form.useWatch('hd_tong_kg', form)
  const calcTongTam = watchedItems.reduce((s: number, it: Record<string, unknown>) => s + (Number(it?.so_luong) || 0), 0)
  const kgLech = (hdTongKgWatch != null && hdTongKgWatch !== '') ? calcTongTam - Number(hdTongKgWatch) : null
  const isKhop = kgLech !== null && Math.abs(kgLech) < 1
  const dominantDvt = (() => {
    const dvts = watchedItems.map((it: Record<string, unknown>) => (it?.dvt as string) || 'Tấm').filter(Boolean)
    if (!dvts.length) return 'Tấm'
    const counts: Record<string, number> = {}
    dvts.forEach(d => { counts[d] = (counts[d] || 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
  })()

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: () => warehousesApi.list().then(r => r.data),
  })
  const phoiWarehouses = warehouses.filter(w => w.trang_thai && w.loai_kho === 'PHOI')

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
    queryKey: ['purchase-orders-da-duyet'],
    queryFn: () => purchaseApi.list({ trang_thai: 'da_duyet' }).then(r => r.data),
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
      so_xe: detail.so_xe, ngay_nhap: detail.ngay_nhap ? dayjs(detail.ngay_nhap) : undefined,
      supplier_id: detail.supplier_id, phap_nhan_id: detail.phap_nhan_id,
      warehouse_id: detail.warehouse_id, hd_tong_kg: detail.hd_tong_kg, ghi_chu: detail.ghi_chu, items: [],
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
    onError: (e: unknown) => message.error(getErrorMessage(e, 'Lỗi tạo phiếu')),
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
    onError: (e: unknown) => message.error(getErrorMessage(e, 'Lỗi hoàn thiện phiếu')),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => warehouseApi.deleteGoodsReceipt(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goods-receipts-phoi'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      message.success('Đã xoá phiếu')
    },
    onError: (e: unknown) => message.error(getErrorMessage(e, 'Lỗi xoá')),
  })

  const approveMut = useMutation({
    mutationFn: (id: number) => warehouseApi.approveGoodsReceipt(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goods-receipts-phoi'] })
      message.success('Đã duyệt phiếu nhập phôi')
    },
    onError: (e: unknown) => message.error(getErrorMessage(e, 'Lỗi duyệt')),
  })

  useEffect(() => {
    if (!poDetail) return
    form.setFieldsValue({
      supplier_id: poDetail.supplier_id,
      items: (poDetail.items || []).map((it) => ({
        ten_hang: it.ten_hang,
        so_luong: it.so_luong,
        dvt: it.dvt || 'Tấm',
        don_gia: it.don_gia,
        po_item_id: it.id,
        so_lop: (it.phoi_spec as PhoiSpecItem | null)?.so_lop || null,
        kho_mm: (it.phoi_spec as PhoiSpecItem | null)?.kho_tt || null,   // kho_tt = chiều rộng tấm phôi thực tế
        dai_mm: (it.phoi_spec as PhoiSpecItem | null)?.dai_tt || null,   // dai_tt = chiều dài tấm phôi thực tế
        ket_qua_kiem_tra: 'DAT',
      })),
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poDetail])

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields()
      const items = (v.items || []).map((it: Record<string, unknown>) => ({
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
        completeMut.mutate({ id: editingDraftId, data: { warehouse_id: v.warehouse_id || null, ghi_chu: v.ghi_chu || null, hd_tong_kg: v.hd_tong_kg || null, items } })
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
        } as CreateGoodsReceiptPayload)
      }
    } catch { /* validation inline */ }
  }

  const handlePrintReceipt = (r: GoodsReceipt) => {
    const cols = [
      { header: 'Tên phôi', key: 'ten_hang' },
      { header: 'Lớp', key: 'so_lop', align: 'center' as const },
      { header: 'Rộng (mm)', key: 'kho_mm', align: 'right' as const },
      { header: 'Dài (mm)', key: 'dai_mm', align: 'right' as const },
      { header: 'Số tấm', key: 'so_tam', align: 'right' as const },
      { header: 'Đơn giá', key: 'don_gia', align: 'right' as const },
      { header: 'Thành tiền (đ)', key: 'thanh_tien', align: 'right' as const },
    ]
    
    const itemRows = (r.items || []).map(it => ({
      ten_hang: it.ten_hang,
      so_lop: it.so_lop ? `${it.so_lop}L` : '—',
      kho_mm: it.kho_mm ? `${it.kho_mm}` : '—',
      dai_mm: it.dai_mm ? `${it.dai_mm}` : '—',
      so_tam: it.so_cuon ? `${it.so_cuon}` : Number(it.so_luong).toLocaleString('vi-VN'),
      don_gia: Number(it.don_gia) > 0 ? Number(it.don_gia).toLocaleString('vi-VN') : '—',
      thanh_tien: (Number(it.thanh_tien) || 0).toLocaleString('vi-VN'),
    }))

    const tong = (r.items || []).reduce((s: number, it) => s + (Number(it.thanh_tien) || 0), 0)
    const table = buildHtmlTable(
      cols.map(c => ({ header: c.header, align: c.align })),
      itemRows.map(row => cols.map(c => (row as Record<string, unknown>)[c.key])) as (string | number | null | undefined)[][],
      { totalRow: ['TỔNG CỘNG', '', '', '', '', '', tong.toLocaleString('vi-VN') + ' đ'] }
    )

    const printData = {
      subtitle: 'PHIẾU NHẬP KHO PHÔI SÓNG (MUA NGOÀI)',
      document_number: r.so_phieu,
      document_date: r.ngay_nhap ?? '',
      so_xe: r.so_xe ?? '—',
      warehouse_name: r.ten_kho ?? '—',
      supplier_name: r.ten_ncc ?? '—',
      body_html: table,
      tong_tien_chu: `Tổng cộng: ${tong.toLocaleString('vi-VN')} đ`,
    }

    smartPrintPdf('GOODS_RECEIPT', printData, r.phap_nhan_id || undefined)
  }

  const handleExportExcel = () => {
    const resolvedPhapNhanId = resolveSinglePhapNhanId(receiptList)
    if (!receiptList.length) {
      message.warning('Không có dữ liệu để xuất Excel')
      return
    }
    if (!resolvedPhapNhanId) {
      message.error('Chỉ xuất Excel nhập phôi ngoài khi danh sách thuộc một pháp nhân. Vui lòng lọc dữ liệu trước.')
      return
    }
    const defaultConfig = [
      { key: 'so_phieu', label: 'Số phiếu', width: 18 },
      { key: 'ngay_nhap', label: 'Ngày nhập', width: 12 },
      { key: 'so_xe', label: 'Số xe', width: 12 },
      { key: 'ten_kho', label: 'Kho phôi', width: 20 },
      { key: 'ten_ncc', label: 'Nhà CC', width: 22 },
      { key: 'tong_gia_tri', label: 'Tổng tiền', width: 16 },
      { key: 'trang_thai_lbl', label: 'Trạng thái', width: 12 },
    ]

    const exportData = receiptList.map((r: GoodsReceipt) => ({
      ...r,
      trang_thai_lbl: r.trang_thai === 'da_duyet' ? 'Đã duyệt' : r.trang_thai === 'nhap_nhanh' ? 'Chờ nhập' : 'Đã nhập',
    }))

    smartExportExcel('GOODS_RECEIPT', exportData, defaultConfig, `NhapPhoiNgoai_${dayjs().format('YYYYMMDD')}`, resolvedPhapNhanId)
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
            disabled={r.trang_thai !== 'nhap' || !canApprove}>
            <Button size="small" icon={<CheckCircleOutlined />} style={{ color: '#52c41a', borderColor: '#52c41a' }}
              disabled={r.trang_thai !== 'nhap' || !canApprove} />
          </Popconfirm>
          <Popconfirm title="Xoá phiếu nhập phôi?" onConfirm={() => deleteMut.mutate(r.id)} okButtonProps={{ danger: true }}
            disabled={r.trang_thai === 'da_duyet' || !canImport}>
            <Button danger size="small" icon={<DeleteOutlined />} disabled={r.trang_thai === 'da_duyet' || !canImport} />
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
            render: (v: number, it: { dvt?: string }) => `${Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} ${it.dvt}` },
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
            <Button type="primary" icon={<PlusOutlined />} disabled={!canImport}
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
              options={phanXuongs.filter(p => p.trang_thai).map(p => ({ value: p.id, label: p.ten_xuong }))} />
          </Col>
          <Col xs={12} sm={5}>
            <Select placeholder="Tất cả NCC" style={{ width: '100%' }} allowClear value={filterNCC} onChange={setFilterNCC} showSearch
              filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
              options={suppliers.map(s => ({ value: s.id, label: s.ten_viet_tat || s.ten_don_vi }))} />
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
          locale={{ emptyText: <EmptyState preset="document" size="small" /> }}
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
            <Button type="primary" loading={createMut.isPending || completeMut.isPending} onClick={handleSubmit} disabled={!canImport}>
              Lưu phiếu nhập phôi
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
              {editingDraftId && (
                <Button size="small" icon={<ScanOutlined />} loading={ocrLoading}
                  style={{ color: '#722ed1', borderColor: '#722ed1' }}
                  onClick={async () => {
                    setOcrLoading(true)
                    try {
                      if (invoiceFile) await mediaApi.upload('goods_receipts', editingDraftId, invoiceFile, 'Phiếu xuất NCC')
                      const res = await warehouseApi.extractImageOcr(editingDraftId).then(r => r.data)
                      const ext = res.extracted ?? {}
                      setOcrResult(prev => ({ ...prev, [editingDraftId]: ext }))
                      if (ext.so_xe) form.setFieldValue('so_xe', ext.so_xe)
                      if (ext.tong_kg) form.setFieldValue('hd_tong_kg', ext.tong_kg)
                      message.success('Đọc ảnh xong')
                    } catch (e: unknown) {
                      message.error(getErrorMessage(e, 'Lỗi đọc ảnh'))
                    } finally { setOcrLoading(false) }
                  }}>
                  Đọc ảnh (AI)
                </Button>
              )}
            </div>
            <div style={{ height: 300, overflow: 'auto', background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
            {editingDraftId && ocrResult[editingDraftId] && (() => {
              const ext = ocrResult[editingDraftId]
              return (
                <div style={{ marginTop: 8, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4, padding: '8px 10px', fontSize: 12 }}>
                  <div style={{ fontWeight: 600, color: '#52c41a', marginBottom: 4 }}>✅ OCR đã đọc xong</div>
                  {ext.ten_ncc && <div>NCC: <strong>{ext.ten_ncc}</strong></div>}
                  {ext.so_xe && <div>Số xe: <strong>{ext.so_xe}</strong></div>}
                  {ext.tong_kg && <div>Tổng: <strong>{ext.tong_kg}</strong></div>}
                  <Space style={{ marginTop: 6 }}>
                    <Button size="small" type="primary" icon={<FormOutlined />} onClick={() => {
                      if (ext.so_xe) form.setFieldValue('so_xe', ext.so_xe)
                      if (ext.tong_kg) form.setFieldValue('hd_tong_kg', ext.tong_kg)
                      if ((ext.hang_hoa?.length ?? 0) > 0) {
                        form.setFieldValue('items', ext.hang_hoa.map((h: any) => ({
                          ten_hang: h.ten || '',
                          so_luong: h.so_luong ?? h.so_cuon ?? h.trong_luong_kg ?? null,
                          dvt: h.dvt || 'Tấm',
                          don_gia: h.don_gia ?? 0,
                          kho_mm: h.kho_mm ?? null,
                          so_lop: null,
                          ket_qua_kiem_tra: 'DAT',
                        })))
                        message.success(`Đã điền ${ext.hang_hoa.length} dòng phôi`)
                      } else {
                        message.success('Đã điền thông tin từ OCR')
                      }
                      if (ext.ten_ncc && suppliers.length) {
                        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
                        const matched = suppliers.find(s =>
                          norm(s.ten_viet_tat || s.ten_don_vi || '').includes(norm(ext.ten_ncc).slice(0, 6)) ||
                          norm(ext.ten_ncc).includes(norm(s.ten_viet_tat || '').slice(0, 6))
                        )
                        if (matched) form.setFieldValue('supplier_id', matched.id)
                      }
                    }}>Điền vào form</Button>
                    <Button size="small" icon={<StarOutlined />} loading={savingExample}
                      style={{ color: '#722ed1', borderColor: '#722ed1' }}
                      onClick={async () => {
                        if (!editingDraftId || !invoicePreviewUrl) { message.warning('Không có ảnh để lưu'); return }
                        setSavingExample(true)
                        try {
                          let blob: Blob
                          if (invoiceFile) {
                            blob = invoiceFile
                          } else if (invoicePreviewUrl.startsWith('data:')) {
                            const [header, data] = invoicePreviewUrl.split(',')
                            const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg'
                            const binary = atob(data)
                            const arr = new Uint8Array(binary.length)
                            for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i)
                            blob = new Blob([arr], { type: mime })
                          } else {
                            blob = await fetch(invoicePreviewUrl).then(r => r.blob())
                          }
                          const file = new File([blob], 'phieu_ncc.jpg', { type: blob.type || 'image/jpeg' })
                          const fd = new FormData()
                          fd.append('ten_ncc', ext.ten_ncc || 'Chưa xác định')
                          fd.append('extracted_json', JSON.stringify(ext))
                          fd.append('ghi_chu', `GR #${editingDraftId}`)
                          fd.append('file', file)
                          await ocrExamplesApi.create(fd)
                          message.success('Đã lưu làm ví dụ')
                        } catch (e: unknown) {
                          message.error(getErrorMessage(e, 'Lỗi lưu ví dụ'))
                        } finally { setSavingExample(false) }
                      }}>Lưu làm ví dụ</Button>
                  </Space>
                </div>
              )
            })()}
          </Col>

          {/* RIGHT: FORM */}
          <Col span={15} style={{ height: '100%', overflowY: 'auto' }}>
            <Form form={form} layout="vertical" initialValues={{ ngay_nhap: dayjs() }}>

              {/* Hàng 1: Pháp nhân + Số xe + Ngày */}
              <Row gutter={10}>
                <Col span={8}>
                  <Form.Item name="phap_nhan_id" label="Pháp nhân" rules={[{ required: true, message: 'Chọn pháp nhân' }]}>
                    <Select placeholder="Nam Phương / Visunpack / ..."
                      options={phapNhans.map(p => ({ value: p.id, label: p.ten_viet_tat || p.ten_phap_nhan }))} />
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
                      options={poList.filter(p => p.loai_po === 'giay_tam').map(p => ({ value: p.id, label: `${p.so_po} — ${p.ten_ncc || ''}${p.ten_phan_xuong ? ' | ' + p.ten_phan_xuong : ''}` }))}
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
                      options={suppliers.map(s => ({ value: s.id, label: s.ten_viet_tat || s.ten_don_vi || s.ma_ncc }))} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Xưởng (lọc kho)">
                    <Select placeholder="Chọn xưởng..." allowClear
                      value={formPxId ?? undefined}
                      onChange={v => { setFormPxId(v ?? null); form.setFieldValue('warehouse_id', undefined) }}
                      options={phanXuongs.filter(p => p.trang_thai).map(p => ({ value: p.id, label: p.ten_xuong }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="warehouse_id" label="Kho phôi nhận" rules={[{ required: true, message: 'Chọn kho phôi' }]}>
                    <Select placeholder="Chọn kho phôi"
                      options={phoiWarehouses
                        .filter(w => !formPxId || w.phan_xuong_id === formPxId)
                        .map(w => ({ value: w.id, label: w.ten_kho }))} />
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
                    <Form.Item name="hd_tong_kg" label={`Tổng ${dominantDvt} trên phiếu NCC`} style={{ marginBottom: 0 }}>
                      <InputNumber style={{ width: '100%' }} placeholder={`Nhập tổng ${dominantDvt} từ phiếu NCC`} min={0}
                        formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                    </Form.Item>
                    {kgLech !== null && (
                      <div style={{ color: Math.abs(kgLech) < 1 ? '#52c41a' : '#ff4d4f', fontSize: 12, marginTop: 4 }}>
                        Tính được: <strong>{calcTongTam.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} {dominantDvt}</strong>
                        {Math.abs(kgLech) >= 1 && <span> | Lệch: <strong>{kgLech > 0 ? '+' : ''}{kgLech.toFixed(1)} {dominantDvt}</strong></span>}
                      </div>
                    )}
                  </Col>
                  <Col span={12} style={{ fontSize: 13, color: '#555' }}>
                    <strong>{watchedItems.length}</strong> dòng phôi |{' '}
                    <strong>{calcTongTam.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} {dominantDvt}</strong> tổng nhập
                    {(hdTongKgWatch == null || hdTongKgWatch === '') && (
                      <div style={{ fontSize: 12, color: '#bbb', marginTop: 2 }}>Nhập tổng {dominantDvt} từ phiếu NCC để đối soát</div>
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
                            <Form.Item name={[name, 'kho_mm']} label="Chiều rộng (mm)" style={{ marginBottom: 4 }}
                              rules={[{ type: 'number', min: 1, message: 'Phải > 0' }]}>
                              <InputNumber size="small" min={1} style={{ width: '100%' }} placeholder="mm" />
                            </Form.Item>
                          </Col>
                          <Col span={5}>
                            <Form.Item name={[name, 'dai_mm']} label="Chiều dài (mm)" style={{ marginBottom: 4 }}
                              rules={[{ type: 'number', min: 1, message: 'Phải > 0' }]}>
                              <InputNumber size="small" min={1} style={{ width: '100%' }} placeholder="mm" />
                            </Form.Item>
                          </Col>
                          <Col span={4}>
                            <Form.Item name={[name, 'so_tam']} label="Số tấm" style={{ marginBottom: 4 }}
                              rules={[{ type: 'number', min: 1, message: 'Phải > 0' }]}>
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
