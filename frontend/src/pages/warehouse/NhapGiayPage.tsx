import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Form, Image, Input, InputNumber,
  Modal, Popconfirm, Row, Select, Space, Table, Tag, Tooltip, Typography, Upload, message, Divider,
} from 'antd'
import {
  FileExcelOutlined, FileImageOutlined, PrinterOutlined, PlusOutlined, DeleteOutlined,
  CheckCircleOutlined, DollarOutlined, ThunderboltOutlined, UploadOutlined, RollbackOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { warehouseApi, CreateGoodsReceiptPayload, CompleteGoodsReceiptPayload, GoodsReceipt } from '../../api/warehouse'
import { warehousesApi } from '../../api/warehouses'
import { paperMaterialsFullApi } from '../../api/paperMaterials'
import { purchaseApi } from '../../api/purchase'
import { suppliersApi } from '../../api/suppliers'
import { exportToExcel, printDocument, buildHtmlTable } from '../../utils/exportUtils'
import { usePhapNhanForPrint } from '../../hooks/usePhapNhan'

const { Title, Text } = Typography

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

export default function NhapGiayPage() {
  const companyInfo = usePhapNhanForPrint()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [filterKho, setFilterKho] = useState<number | undefined>()
  const [filterNCC, setFilterNCC] = useState<number | undefined>()
  const [filterXuong, setFilterXuong] = useState<number | undefined>()
  const [tuNgay, setTuNgay] = useState<string | undefined>()
  const [denNgay, setDenNgay] = useState<string | undefined>()
  const [selectedPO, setSelectedPO] = useState<number | undefined>()
  const [formPxId, setFormPxId] = useState<number | null>(null)
  const [openChonNL, setOpenChonNL] = useState(false)
  const [chonNLSelected, setChonNLSelected] = useState<number[]>([])
  const [chonNLNhom, setChonNLNhom] = useState<number | undefined>()
  const [chonNLSearch, setChonNLSearch] = useState('')
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [invoicePreviewUrl, setInvoicePreviewUrl] = useState<string | null>(null)
  const [editingDraftId, setEditingDraftId] = useState<number | null>(null)

  // Reactive watches — hooks must be at top level
  const watchedItems: any[] = Form.useWatch('items', form) ?? []
  const hdTongKgWatch = Form.useWatch('hd_tong_kg', form)
  const watchedSupplierId: number | undefined = Form.useWatch('supplier_id', form)
  const calcTongKg = watchedItems.reduce((s: number, it: any) => s + (Number(it?.so_luong) || 0), 0)
  const kgLech = (hdTongKgWatch != null && hdTongKgWatch !== '') ? calcTongKg - Number(hdTongKgWatch) : null
  const isKhop = kgLech !== null && Math.abs(kgLech) < 1

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: () => warehousesApi.list().then(r => r.data),
  })

  const { data: phanXuongs = [] } = useQuery({
    queryKey: ['phan-xuong-list'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
    staleTime: 300_000,
  })

  const { data: paperPage } = useQuery({
    queryKey: ['paper-materials-all'],
    queryFn: () => paperMaterialsFullApi.list({ page_size: 2000 }).then(r => r.data),
    staleTime: 300_000,
  })
  const paperMats = paperPage?.items ?? []
  const paperMatsForNCC = watchedSupplierId
    ? paperMats.filter(m => m.su_dung && m.ma_nsx_id === watchedSupplierId)
    : paperMats.filter(m => m.su_dung)

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.all().then(r => r.data),
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
    queryKey: ['goods-receipts-giay', filterKho, filterNCC, tuNgay, denNgay],
    queryFn: () => warehouseApi.listGoodsReceipts({
      warehouse_id: filterKho, supplier_id: filterNCC, tu_ngay: tuNgay, den_ngay: denNgay,
      loai_hang: 'giay',
    }).then(r => r.data),
  })

  const materialGroups = Array.from(
    new Map(paperMats.filter(m => m.ma_nhom_id && m.ten_nhom).map(m => [m.ma_nhom_id, { id: m.ma_nhom_id, ten_nhom: m.ten_nhom }])).values()
  )

  const handleChonNhieuNL = () => {
    const filtered = paperMatsForNCC.filter(m => {
      if (chonNLNhom && m.ma_nhom_id !== chonNLNhom) return false
      if (chonNLSearch) {
        const s = chonNLSearch.toLowerCase()
        if (!m.ten?.toLowerCase().includes(s) && !m.ma_chinh?.toLowerCase().includes(s)) return false
      }
      return true
    })
    return filtered
  }

  const applyChonNL = () => {
    const selected = paperMats.filter(m => chonNLSelected.includes(m.id))
    const currentItems = form.getFieldValue('items') || []
    const newRows = selected.map(m => ({
      mat_id: m.id,
      ten_hang: m.ten,
      dvt: 'Kg',
      don_gia: m.gia_mua ? Number(m.gia_mua) : 0,
      kho_mm: m.kho ? Number(m.kho) : null,
      so_cuon: null,
      ky_hieu_cuon: null,
      ket_qua_kiem_tra: 'DAT',
    }))
    form.setFieldValue('items', [...currentItems, ...newRows])
    setOpenChonNL(false)
    setChonNLSelected([])
    setChonNLSearch('')
    setChonNLNhom(undefined)
  }

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
    // Load detail để lấy invoice_image (list không trả về base64)
    const detail = await warehouseApi.getGoodsReceipt(r.id).then(res => res.data)
    setEditingDraftId(r.id)
    if (detail.invoice_image) setInvoicePreviewUrl(detail.invoice_image)
    form.setFieldsValue({
      so_xe: detail.so_xe,
      ngay_nhap: detail.ngay_nhap ? require('dayjs')(detail.ngay_nhap) : undefined,
      supplier_id: detail.supplier_id,
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
      qc.invalidateQueries({ queryKey: ['goods-receipts-giay'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      qc.invalidateQueries({ queryKey: ['purchase-orders-da-duyet'] })
      message.success('Đã tạo phiếu nhập giấy cuộn')
      handleClose()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo phiếu'),
  })

  const completeMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CompleteGoodsReceiptPayload }) =>
      warehouseApi.completeGoodsReceipt(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goods-receipts-giay'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      message.success('Đã hoàn thiện phiếu — tồn kho đã cập nhật')
      handleClose()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi hoàn thiện phiếu'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => warehouseApi.deleteGoodsReceipt(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goods-receipts-giay'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      message.success('Đã xoá phiếu nhập')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi xoá'),
  })

  const approveMut = useMutation({
    mutationFn: (id: number) => warehouseApi.approveGoodsReceipt(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goods-receipts-giay'] })
      message.success('Đã duyệt — giá mua giấy đã cập nhật')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi duyệt phiếu'),
  })

  const syncGiaBanMut = useMutation({
    mutationFn: (id: number) => warehouseApi.syncGiaBan(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['paper-materials-all'] })
      const updated = res.data.updated
      Modal.success({
        title: `Đã cập nhật giá bán ×1.05 cho ${updated.length} vật tư`,
        content: (
          <Table size="small" pagination={false} dataSource={updated} rowKey="ma_chinh"
            columns={[
              { title: 'Mã', dataIndex: 'ma_chinh', width: 100 },
              { title: 'Tên', dataIndex: 'ten' },
              { title: 'Giá mua', dataIndex: 'gia_mua', width: 110, align: 'right' as const,
                render: (v: number) => v.toLocaleString('vi-VN') + 'đ' },
              { title: 'Giá bán mới', dataIndex: 'gia_ban', width: 120, align: 'right' as const,
                render: (v: number) => <Text strong style={{ color: '#52c41a' }}>{v.toLocaleString('vi-VN')}đ</Text> },
            ]}
          />
        ),
        width: 600,
      })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi cập nhật giá bán'),
  })

  useEffect(() => {
    if (!poDetail) return
    form.setFieldsValue({
      supplier_id: poDetail.supplier_id,
      items: (poDetail.items || [])
        .filter((it: any) => it.paper_material_id)
        .map((it: any) => ({
          mat_id: it.paper_material_id,
          ten_hang: it.ten_hang,
          so_luong: it.so_luong,
          dvt: it.dvt || 'Kg',
          don_gia: it.don_gia,
          po_item_id: it.id,
          ket_qua_kiem_tra: 'DAT',
        })),
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poDetail])

  const handleMatSelect = (itemName: number, matId: number) => {
    const mat = paperMats.find(m => m.id === matId)
    if (!mat) return
    const items = form.getFieldValue('items') || []
    const updated = [...items]
    updated[itemName] = {
      ...updated[itemName],
      mat_id: matId,
      ten_hang: mat.ten,
      dvt: mat.dvt || 'Kg',
      don_gia: mat.gia_mua || 0,
      kho_mm: mat.kho ? Number(mat.kho) : null,
    }
    form.setFieldValue('items', updated)
  }

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields()
      const items = (v.items || []).map((it: any) => ({
        po_item_id: it.po_item_id || null,
        paper_material_id: it.mat_id || null,
        other_material_id: null,
        ten_hang: it.ten_hang || '',
        so_luong: it.so_luong,
        dvt: it.dvt || 'Kg',
        don_gia: it.don_gia || 0,
        ket_qua_kiem_tra: it.ket_qua_kiem_tra || 'DAT',
        kho_mm: it.kho_mm || null,
        so_cuon: it.so_cuon || null,
        ky_hieu_cuon: it.ky_hieu_cuon || null,
        ghi_chu: it.ghi_chu || null,
      }))
      if (!items.length) { message.warning('Thêm ít nhất 1 mã giấy'); return }
      let invoice_image: string | null = null
      if (invoiceFile) invoice_image = await fileToBase64(invoiceFile)

      if (editingDraftId) {
        // Hoàn thiện phiếu nháp từ quick capture
        completeMut.mutate({
          id: editingDraftId,
          data: {
            warehouse_id: v.warehouse_id || null,
            ghi_chu: v.ghi_chu || null,
            hd_tong_kg: v.hd_tong_kg || null,
            items,
          },
        })
      } else {
        createMut.mutate({
          ngay_nhap: v.ngay_nhap.format('YYYY-MM-DD'),
          po_id: v.po_id || null,
          supplier_id: v.supplier_id,
          warehouse_id: v.warehouse_id,
          loai_nhap: 'MUA_HANG',
          ghi_chu: v.ghi_chu || null,
          so_xe: v.so_xe || null,
          invoice_image,
          hd_tong_kg: v.hd_tong_kg || null,
          items,
        })
      }
    } catch { /* validation inline */ }
  }

  const handlePrintReceipt = (r: GoodsReceipt) => {
    const cols = [
      { header: 'Mã giấy' }, { header: 'Tên hàng' },
      { header: 'Khổ (cm)', align: 'center' as const },
      { header: 'Số cuộn', align: 'right' as const },
      { header: 'Số lượng (kg)', align: 'right' as const },
      { header: 'Đơn giá (đ)', align: 'right' as const },
      { header: 'Thành tiền (đ)', align: 'right' as const },
    ]
    const rowData = (r.items || []).map((it: any) => [
      it.ma_hang || '',
      it.ten_hang,
      it.kho_mm ? `${it.kho_mm}` : '—',
      it.so_cuon ? `${it.so_cuon}` : '—',
      Number(it.so_luong).toLocaleString('vi-VN', { maximumFractionDigits: 3 }),
      Number(it.don_gia) > 0 ? Number(it.don_gia).toLocaleString('vi-VN') : '—',
      (Number(it.thanh_tien) || 0).toLocaleString('vi-VN'),
    ])
    const tong = (r.items || []).reduce((s: number, it: any) => s + (Number(it.thanh_tien) || 0), 0)
    printDocument({
      title: `Phiếu nhập giấy cuộn ${r.so_phieu}`,
      subtitle: 'PHIẾU NHẬP KHO — GIẤY CUỘN',
      companyInfo,
      documentNumber: r.so_phieu,
      documentDate: r.ngay_nhap ?? '',
      fields: [
        { label: 'Số xe', value: r.so_xe ?? '—' },
        { label: 'Kho nhập', value: r.ten_kho ?? '—' },
        { label: 'Nhà cung cấp', value: r.ten_ncc ?? '—' },
      ],
      bodyHtml: buildHtmlTable(cols, rowData, { totalRow: ['', 'TỔNG CỘNG', '', '', '', '', tong.toLocaleString('vi-VN') + ' đ'] }),
    })
  }

  const handleExportExcel = () => {
    exportToExcel(`NhapGiayCuon_${dayjs().format('YYYYMMDD')}`, [{
      name: 'Nhập giấy cuộn',
      headers: ['Số phiếu', 'Ngày nhập', 'Số xe', 'Kho', 'Nhà CC', 'Tổng KG', 'Tổng tiền', 'Trạng thái'],
      rows: receiptList.map((r: GoodsReceipt) => [
        r.so_phieu, r.ngay_nhap, r.so_xe ?? '',
        r.ten_kho ?? '', r.ten_ncc ?? '',
        (r.items || []).reduce((s: number, it: any) => s + Number(it.so_luong || 0), 0),
        r.tong_gia_tri, r.trang_thai === 'da_duyet' ? 'Đã duyệt' : 'Nhập',
      ]),
      colWidths: [18, 12, 12, 18, 22, 12, 16, 12],
    }])
  }

  const columns = [
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 160,
      render: (v: string) => <Text strong style={{ color: '#1677ff' }}>{v}</Text> },
    { title: 'Ngày nhập', dataIndex: 'ngay_nhap', width: 110 },
    { title: 'Số xe', dataIndex: 'so_xe', width: 110, render: (v: string | null) => v || '—' },
    { title: 'Kho nhập', dataIndex: 'ten_kho', width: 160 },
    { title: 'Nhà CC', dataIndex: 'ten_ncc', width: 150 },
    { title: 'Tổng KG', width: 110, align: 'right' as const,
      render: (_: unknown, r: GoodsReceipt) => {
        const kg = (r.items || []).reduce((s: number, it: any) => s + Number(it.so_luong || 0), 0)
        return <Text>{kg.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} kg</Text>
      } },
    { title: 'Tổng tiền', dataIndex: 'tong_gia_tri', width: 140, align: 'right' as const,
      render: (v: number) => <Text strong>{v.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}đ</Text> },
    { title: 'TT', dataIndex: 'trang_thai', width: 105,
      render: (v: string) => {
        if (v === 'nhap_nhanh') return <Tag color="orange">Chờ nhập</Tag>
        if (v === 'da_duyet') return <Tag color="green">Đã duyệt</Tag>
        return <Tag color="blue">Đã nhập</Tag>
      } },
    {
      title: '', width: 165,
      render: (_: unknown, r: GoodsReceipt) => (
        <Space size={4}>
          {r.trang_thai === 'nhap_nhanh' ? (
            <Button size="small" type="primary" onClick={() => handleOpenDraft(r)}>
              Hoàn thiện
            </Button>
          ) : (
            <Button size="small" icon={<PrinterOutlined />} onClick={() => handlePrintReceipt(r)} />
          )}
          <Popconfirm title="Duyệt phiếu? Giá mua giấy sẽ được cập nhật." onConfirm={() => approveMut.mutate(r.id)}
            disabled={r.trang_thai !== 'nhap'}>
            <Button size="small" icon={<CheckCircleOutlined />} style={{ color: '#52c41a', borderColor: '#52c41a' }}
              disabled={r.trang_thai !== 'nhap'} />
          </Popconfirm>
          {r.trang_thai === 'da_duyet' && (
            <Tooltip title="Cập nhật giá bán = giá mua × 1.05">
              <Popconfirm title="Cập nhật giá bán ×1.05?" onConfirm={() => syncGiaBanMut.mutate(r.id)}>
                <Button size="small" icon={<DollarOutlined />}
                  style={{ color: '#fa8c16', borderColor: '#fa8c16' }}
                  loading={syncGiaBanMut.isPending} />
              </Popconfirm>
            </Tooltip>
          )}
          <Popconfirm title="Xoá phiếu?" onConfirm={() => deleteMut.mutate(r.id)} okButtonProps={{ danger: true }}
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
          <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>Phiếu xuất NCC:</Text>
          <Image src={r.invoice_image} height={48} style={{ cursor: 'pointer', borderRadius: 4, border: '1px solid #d9d9d9' }} />
        </div>
      )}
      <Table dataSource={r.items} rowKey={(_, i) => `${r.id}-${i}`} size="small" pagination={false}
        columns={[
          { title: 'Tên hàng', dataIndex: 'ten_hang' },
          { title: 'Khổ (cm)', dataIndex: 'kho_mm', width: 80, align: 'center' as const,
            render: (v: number | null) => v ? `${v}` : '—' },
          { title: 'Số cuộn', dataIndex: 'so_cuon', width: 80, align: 'right' as const,
            render: (v: number | null) => v ?? '—' },
          { title: 'Ký hiệu', dataIndex: 'ky_hieu_cuon', width: 80,
            render: (v: string | null) => v || '—' },
          { title: 'Số lượng (kg)', dataIndex: 'so_luong', width: 120, align: 'right' as const,
            render: (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 3 }) },
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
            <RollbackOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <Title level={4} style={{ margin: 0 }}>Nhập kho Giấy cuộn</Title>
          </Space>
        </Col>
        <Col>
          <Space>
            <Button icon={<FileExcelOutlined />} style={{ color: '#217346', borderColor: '#217346' }} onClick={handleExportExcel}>
              Xuất Excel
            </Button>
            <Button type="primary" icon={<PlusOutlined />}
              onClick={() => { form.resetFields(); setSelectedPO(undefined); setFormPxId(null); setInvoiceFile(null); setInvoicePreviewUrl(null); setOpen(true) }}>
              Tạo phiếu nhập
            </Button>
          </Space>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[8, 8]}>
          <Col xs={12} sm={5}>
            <Select placeholder="Tất cả xưởng" style={{ width: '100%' }} allowClear value={filterXuong}
              onChange={v => { setFilterXuong(v); setFilterKho(undefined) }}
              options={phanXuongs.filter((p: any) => p.trang_thai).map((p: any) => ({ value: p.id, label: p.ten_xuong }))} />
          </Col>
          <Col xs={12} sm={5}>
            <Select placeholder="Tất cả kho" style={{ width: '100%' }} allowClear value={filterKho} onChange={setFilterKho}
              options={warehouses
                .filter(w => w.trang_thai && (!filterXuong || w.phan_xuong_id === filterXuong))
                .map(w => ({ value: w.id, label: w.ten_kho }))} />
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
          expandable={{ expandedRowRender }} pagination={{ pageSize: 20, showSizeChanger: true }} scroll={{ x: 1050 }} />
      </Card>

      {/* ===== MODAL TẠO PHIẾU NHẬP GIẤY CUỘN ===== */}
      <Modal
        open={open}
        onCancel={handleClose}
        width="98vw"
        style={{ top: 8, padding: 0 }}
        styles={{ body: { padding: '12px 16px', height: 'calc(100vh - 120px)', overflow: 'hidden' } }}
        title={editingDraftId ? '✏️ Hoàn thiện phiếu nhập giấy cuộn' : 'Tạo phiếu nhập giấy cuộn'}
        footer={
          <Space>
            <Button onClick={handleClose}>Huỷ</Button>
            <Button type="primary" loading={createMut.isPending || completeMut.isPending} onClick={handleSubmit}>
              {editingDraftId ? 'Hoàn thiện & cập nhật tồn kho' : 'Lưu phiếu nhập'}
            </Button>
          </Space>
        }
        destroyOnClose
      >
        <Row style={{ height: '100%' }} gutter={12}>

          {/* LEFT: ẢNH PHIẾU XUẤT KHO NCC */}
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
                  <span style={{ fontSize: 12 }}>để đối soát số lượng khi nhập</span>
                </div>
              )}
            </div>
          </Col>

          {/* RIGHT: FORM */}
          <Col span={15} style={{ height: '100%', overflowY: 'auto' }}>
            <Form form={form} layout="vertical" initialValues={{ ngay_nhap: dayjs() }}>

              <Row gutter={10}>
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
                <Col span={12}>
                  <Form.Item name="po_id" label="Liên kết đơn mua (tuỳ chọn)">
                    <Select placeholder="Chọn PO để auto-fill..." allowClear showSearch
                      filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
                      options={poList.map(p => ({ value: p.id, label: `${p.so_po} — ${p.ten_ncc}` }))}
                      onChange={v => v ? setSelectedPO(v) : setSelectedPO(undefined)}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={10}>
                <Col span={14}>
                  <Form.Item name="supplier_id" label="Nhà cung cấp (NCC)" rules={[{ required: true, message: 'Chọn NCC' }]}>
                    <Select placeholder="Chọn nhà cung cấp..." showSearch
                      filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
                      options={suppliers.map((s: any) => ({ value: s.id, label: s.ten_viet_tat || s.ten_don_vi || s.ma_ncc }))} />
                  </Form.Item>
                </Col>
                <Col span={10}>
                  <Form.Item name="ghi_chu" label="Ghi chú">
                    <Input placeholder="Ghi chú phiếu..." />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={10}>
                <Col span={8}>
                  <Form.Item label="Xưởng (lọc kho)">
                    <Select placeholder="Chọn xưởng..." allowClear
                      value={formPxId ?? undefined}
                      onChange={v => { setFormPxId(v ?? null); form.setFieldValue('warehouse_id', undefined) }}
                      options={phanXuongs.filter((p: any) => p.trang_thai).map((p: any) => ({ value: p.id, label: p.ten_xuong }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={16}>
                  <Form.Item name="warehouse_id" label="Kho nhập" rules={[{ required: true, message: 'Chọn kho' }]}>
                    <Select placeholder="Chọn kho"
                      options={warehouses
                        .filter(w => w.trang_thai && (!formPxId || w.phan_xuong_id === formPxId))
                        .map(w => ({ value: w.id, label: `${w.ten_kho}${w.loai_kho ? ` (${w.loai_kho})` : ''}` }))} />
                  </Form.Item>
                </Col>
              </Row>

              {/* Kiểm soát phiếu xuất NCC */}
              <Card size="small"
                style={{ background: isKhop ? '#f6ffed' : '#fff7e6', marginBottom: 12, border: `1px solid ${isKhop ? '#b7eb8f' : '#ffd591'}` }}
                title={<span style={{ color: isKhop ? '#52c41a' : '#fa8c16', fontSize: 13 }}>
                  {isKhop ? '✅ Khớp phiếu xuất NCC' : '⚠️ Đối soát phiếu xuất NCC'}
                </span>}
              >
                <Row gutter={16} align="middle">
                  <Col span={12}>
                    <Form.Item name="hd_tong_kg" label="Tổng KG trên phiếu xuất NCC" style={{ marginBottom: 0 }}>
                      <InputNumber style={{ width: '100%' }} placeholder="Nhập tổng KG từ phiếu NCC" min={0}
                        formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                    </Form.Item>
                    {kgLech !== null && (
                      <div style={{ color: Math.abs(kgLech) < 1 ? '#52c41a' : '#ff4d4f', fontSize: 12, marginTop: 4 }}>
                        Tính được: <strong>{calcTongKg.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} kg</strong>
                        {Math.abs(kgLech) >= 1 && <span> | Lệch: <strong>{kgLech > 0 ? '+' : ''}{kgLech.toFixed(1)} kg</strong></span>}
                      </div>
                    )}
                  </Col>
                  <Col span={12} style={{ fontSize: 13, color: '#555' }}>
                    <strong>{watchedItems.length}</strong> mã giấy |{' '}
                    <strong>{calcTongKg.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} kg</strong> tổng nhập
                    {(hdTongKgWatch == null || hdTongKgWatch === '') && (
                      <div style={{ fontSize: 12, color: '#bbb', marginTop: 2 }}>Nhập KG từ phiếu NCC để kiểm tra lệch</div>
                    )}
                  </Col>
                </Row>
              </Card>

              <Divider orientation="left" style={{ fontSize: 13 }}>
                <Space>
                  Danh sách giấy cuộn nhập
                  {watchedSupplierId && (
                    <Button size="small" icon={<ThunderboltOutlined />}
                      style={{ color: '#1677ff', borderColor: '#1677ff' }}
                      onClick={() => { setChonNLSelected([]); setChonNLSearch(''); setChonNLNhom(undefined); setOpenChonNL(true) }}>
                      Chọn nhanh
                    </Button>
                  )}
                </Space>
              </Divider>

              <Form.List name="items">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name }) => (
                      <Card key={key} size="small" style={{ marginBottom: 8, background: '#fafafa' }}>
                        <Row gutter={[8, 4]}>
                          <Col span={22}>
                            <Form.Item name={[name, 'mat_id']} label="Mã giấy" style={{ marginBottom: 4 }}>
                              <Select size="small" showSearch placeholder="Chọn mã giấy..."
                                filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
                                options={paperMatsForNCC.map(m => ({ value: m.id, label: `${m.ma_chinh ? m.ma_chinh + ' — ' : ''}${m.ten}` }))}
                                onChange={id => handleMatSelect(name, id)} />
                            </Form.Item>
                          </Col>
                          <Col span={2} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 20 }}>
                            <DeleteOutlined style={{ color: '#ff4d4f', fontSize: 15, cursor: 'pointer' }} onClick={() => remove(name)} />
                          </Col>
                          <Col span={12}>
                            <Form.Item name={[name, 'ten_hang']} label="Tên hàng" style={{ marginBottom: 4 }}>
                              <Input size="small" placeholder="Tên hàng..." />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item name={[name, 'dvt']} label="ĐVT" style={{ marginBottom: 4 }}>
                              <Select size="small" options={['Kg', 'Tấn'].map(v => ({ value: v, label: v }))} />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item name={[name, 'ket_qua_kiem_tra']} label="Kết quả KT" style={{ marginBottom: 4 }}>
                              <Select size="small" options={[
                                { value: 'DAT', label: 'Đạt' },
                                { value: 'KHONG_DAT', label: 'Không đạt' },
                                { value: 'CHO_KIEM_TRA', label: 'Chờ KT' },
                              ]} />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item name={[name, 'kho_mm']} label="Khổ (cm)" style={{ marginBottom: 4 }}>
                              <InputNumber size="small" min={0} style={{ width: '100%' }} placeholder="cm" />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item name={[name, 'so_cuon']} label="Số cuộn" style={{ marginBottom: 4 }}>
                              <InputNumber size="small" min={1} precision={0} style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item name={[name, 'ky_hieu_cuon']} label="Ký hiệu cuộn" style={{ marginBottom: 4 }}>
                              <Input size="small" placeholder="VD: 98" />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item name={[name, 'so_luong']} label="Số lượng (kg)" rules={[{ required: true, message: 'Nhập KG' }]} style={{ marginBottom: 4 }}>
                              <InputNumber size="small" min={0.001} style={{ width: '100%' }} />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item name={[name, 'don_gia']} label="Đơn giá (đ/kg)" style={{ marginBottom: 4 }}>
                              <InputNumber size="small" min={0} style={{ width: '100%' }}
                                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item name={[name, 'ghi_chu']} label="Ghi chú" style={{ marginBottom: 4 }}>
                              <Input size="small" placeholder="..." />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Card>
                    ))}
                    <Button type="dashed" block icon={<PlusOutlined />}
                      onClick={() => add({ dvt: 'Kg', don_gia: 0, ket_qua_kiem_tra: 'DAT' })}>
                      Thêm mã giấy
                    </Button>
                  </>
                )}
              </Form.List>
            </Form>
          </Col>
        </Row>
      </Modal>

      {/* Modal chọn nhanh */}
      <Modal open={openChonNL} title="Chọn nhanh mã giấy" width={780}
        onCancel={() => { setOpenChonNL(false); setChonNLSelected([]) }}
        onOk={applyChonNL}
        okText={`Thêm ${chonNLSelected.length} mã vào phiếu`}
        okButtonProps={{ disabled: chonNLSelected.length === 0 }}>
        <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
          <Col span={10}>
            <Select placeholder="Lọc theo nhóm hàng..." allowClear style={{ width: '100%' }}
              value={chonNLNhom} onChange={setChonNLNhom}
              options={materialGroups.map(g => ({ value: g.id, label: g.ten_nhom }))} />
          </Col>
          <Col span={14}>
            <Input.Search placeholder="Tìm mã / tên giấy..." value={chonNLSearch}
              onChange={e => setChonNLSearch(e.target.value)} allowClear />
          </Col>
        </Row>
        <Table size="small" pagination={{ pageSize: 10, showSizeChanger: false }}
          dataSource={handleChonNhieuNL()} rowKey="id"
          rowSelection={{ type: 'checkbox', selectedRowKeys: chonNLSelected, onChange: keys => setChonNLSelected(keys as number[]) }}
          columns={[
            { title: 'Mã NL', dataIndex: 'ma_chinh', width: 100 },
            { title: 'Tên', dataIndex: 'ten', ellipsis: true },
            { title: 'Khổ', dataIndex: 'kho', width: 70, align: 'right' as const,
              render: (v: number | null) => v ? `${v}` : '—' },
            { title: 'ĐL (g/m²)', dataIndex: 'dinh_luong', width: 90, align: 'right' as const,
              render: (v: number | null) => v ?? '—' },
            { title: 'Ký hiệu', dataIndex: 'ma_ky_hieu', width: 80, render: (v: string | null) => v || '—' },
            { title: 'Giá mua (đ/kg)', dataIndex: 'gia_mua', width: 120, align: 'right' as const,
              render: (v: number | null) => v ? v.toLocaleString('vi-VN') : '—' },
          ]}
        />
      </Modal>
    </div>
  )
}
