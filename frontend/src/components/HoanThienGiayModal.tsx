import { useState, useEffect } from 'react'
import type { ApiError } from '../api/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Checkbox, Col, DatePicker, Divider, Form, Image, Input,
  InputNumber, Modal, Row, Select, Space, Tag, Tooltip, Upload, message,
} from 'antd'
import {
  DeleteOutlined, FileImageOutlined, FormOutlined, PlusOutlined,
  ScanOutlined, StarOutlined, ThunderboltOutlined, UploadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { warehouseApi, OcrExtracted } from '../api/warehouse'
import type { PhanXuong, WarehouseInfo } from '../api/warehouse'
import { mediaApi } from '../api/media'
import { paperMaterialsFullApi } from '../api/paperMaterials'
import type { PaperMaterial } from '../api/paperMaterials'
import { suppliersApi } from '../api/suppliers'
import type { Supplier } from '../api/suppliers'
import { warehousesApi } from '../api/warehouses'
import type { Warehouse } from '../api/warehouses'
import { ocrExamplesApi } from '../api/ocrExamples'

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

interface Props {
  grId: number | null
  onClose: () => void
  onSuccess: () => void
}

export default function HoanThienGiayModal({ grId, onClose, onSuccess }: Props) {
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [formPxId, setFormPxId] = useState<number | null>(null)
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [invoicePreviewUrl, setInvoicePreviewUrl] = useState<string | null>(null)
  const [grMediaUrl, setGrMediaUrl] = useState<string | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState<OcrExtracted | null>(null)
  const [savingExample, setSavingExample] = useState(false)
  const [openChonNL, setOpenChonNL] = useState(false)
  const [chonNLSelected, setChonNLSelected] = useState<number[]>([])
  const [chonNLSearch, setChonNLSearch] = useState('')

  interface FormItem {
    mat_id?: number | null
    ten_hang?: string
    dvt?: string
    don_gia?: number
    kho_mm?: number | null
    so_cuon?: number | null
    ky_hieu_cuon?: string | null
    so_luong?: number
    ket_qua_kiem_tra?: string
    ghi_chu?: string | null
    da_doi_chieu?: boolean
  }

  const watchedItems: FormItem[] = Form.useWatch('items', form) ?? []
  const hdTongKgWatch = Form.useWatch('hd_tong_kg', form)
  const watchedSupplierId: number | undefined = Form.useWatch('supplier_id', form)
  const calcTongKg = watchedItems.reduce((s: number, it: FormItem) => s + (Number(it?.so_luong) || 0), 0)
  const kgLech = (hdTongKgWatch != null && hdTongKgWatch !== '') ? calcTongKg - Number(hdTongKgWatch) : null
  const isKhop = kgLech !== null && Math.abs(kgLech) < 1
  const checkedCount = watchedItems.filter((it: FormItem) => it?.da_doi_chieu).length
  const allChecked = watchedItems.length > 0 && checkedCount === watchedItems.length

  const { data: warehouses = [] } = useQuery<Warehouse[]>({
    queryKey: ['warehouses-all'],
    queryFn: () => warehousesApi.list().then(r => r.data),
    staleTime: 300_000,
  })
  const { data: phanXuongs = [] } = useQuery<PhanXuong[]>({
    queryKey: ['phan-xuong-list'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
    staleTime: 300_000,
  })
  const { data: paperPage } = useQuery({
    queryKey: ['paper-materials-all'],
    queryFn: () => paperMaterialsFullApi.list({ page_size: 2000 }).then(r => r.data),
    staleTime: 300_000,
  })
  const paperMats: PaperMaterial[] = paperPage?.items ?? []
  const paperMatsForNCC = watchedSupplierId
    ? paperMats.filter((m: PaperMaterial) => m.su_dung && m.ma_nsx_id === watchedSupplierId)
    : paperMats.filter((m: PaperMaterial) => m.su_dung)

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.all().then(r => r.data),
    staleTime: 300_000,
  })

  // Load GR detail khi grId thay đổi
  useEffect(() => {
    if (!grId) return
    form.resetFields()
    setInvoiceFile(null)
    setInvoicePreviewUrl(null)
    setGrMediaUrl(null)
    setOcrResult(null)
    setFormPxId(null)

    warehouseApi.getGoodsReceipt(grId).then(res => {
      const gr = res.data
      if (gr.invoice_image) {
        setInvoicePreviewUrl(gr.invoice_image)
      } else {
        mediaApi.list('goods_receipts', grId).then(r => {
          if (r.data.length > 0) setGrMediaUrl(r.data[0].url)
        })
      }
      if (gr.ocr_extracted_data) {
        try { setOcrResult(JSON.parse(gr.ocr_extracted_data)) } catch { /* ignore */ }
      }
      form.setFieldsValue({
        so_xe: gr.so_xe,
        ngay_nhap: gr.ngay_nhap ? dayjs(gr.ngay_nhap) : dayjs(),
        supplier_id: gr.supplier_id,
        warehouse_id: gr.warehouse_id,
        hd_tong_kg: gr.hd_tong_kg,
        ghi_chu: gr.ghi_chu,
        items: [],
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grId])

  const completeMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: import('../api/warehouse').CompleteGoodsReceiptPayload }) =>
      warehouseApi.completeGoodsReceipt(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goods-receipts'] })
      qc.invalidateQueries({ queryKey: ['goods-receipts-giay'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      message.success('Hoàn thiện thành công — tồn kho đã cập nhật')
      onSuccess()
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error((e as ApiError)?.response?.data?.detail || 'Lỗi hoàn thiện phiếu'),
  })

  const handleOcr = async () => {
    if (!grId) return
    setOcrLoading(true)
    try {
      const res = await warehouseApi.extractImageOcr(grId)
      const ext = res.data.extracted ?? {}
      const hasData = ext.ten_ncc || ext.so_xe || ext.tong_kg || (ext.hang_hoa?.length ?? 0) > 0
      if (hasData) {
        setOcrResult(ext)
        message.success('Đọc ảnh thành công')
      } else if (res.data.raw_text?.trim()) {
        message.warning('Đọc được chữ nhưng không phân tích được thông tin — thử ảnh rõ, thẳng góc hơn')
      } else {
        message.warning(res.data.warning || 'Không đọc được thông tin từ ảnh')
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      message.error((err as ApiError)?.response?.data?.detail || 'Lỗi đọc ảnh AI')
    } finally {
      setOcrLoading(false)
    }
  }

  const handleFillFromOcr = () => {
    if (!ocrResult) return
    if (ocrResult.so_xe) form.setFieldValue('so_xe', ocrResult.so_xe)
    if (ocrResult.tong_kg) form.setFieldValue('hd_tong_kg', ocrResult.tong_kg)
    if (ocrResult.hang_hoa?.length) {
      form.setFieldValue('items', ocrResult.hang_hoa.map(h => ({
        mat_id: null, ten_hang: h.ten || '', dvt: 'Kg', don_gia: 0,
        kho_mm: h.kho_mm ?? null, so_cuon: h.so_cuon ?? null,
        ky_hieu_cuon: h.ky_hieu ?? null, so_luong: h.trong_luong_kg ?? null,
        ket_qua_kiem_tra: 'DAT',
      })))
    }
    message.success('Đã điền thông tin từ OCR vào form')
  }

  const handleSaveAsExample = async () => {
    if (!ocrResult || !grId) return
    const mediaUrl = grMediaUrl
    if (!mediaUrl) { message.warning('Không tìm thấy ảnh để lưu'); return }
    setSavingExample(true)
    try {
      // Lấy blob ảnh từ URL và tạo File
      const blob = await fetch(mediaUrl).then(r => r.blob())
      const fileName = mediaUrl.split('/').pop() || 'phieu.jpg'
      const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' })
      const fd = new FormData()
      fd.append('ten_ncc', ocrResult.ten_ncc || 'Chưa xác định')
      fd.append('extracted_json', JSON.stringify(ocrResult))
      fd.append('ghi_chu', `Lưu từ GR #${grId}`)
      fd.append('file', file)
      await ocrExamplesApi.create(fd)
      message.success('Đã lưu làm ảnh mẫu — AI sẽ dùng ảnh này cho lần đọc tiếp theo')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      message.error((err as ApiError)?.response?.data?.detail || 'Lưu thất bại')
    } finally {
      setSavingExample(false)
    }
  }

  const handleMatSelect = (itemIdx: number, matId: number) => {
    const mat = paperMats.find((m) => m.id === matId)
    if (!mat) return
    const items = form.getFieldValue('items') || []
    const updated = [...items]
    updated[itemIdx] = { ...updated[itemIdx], mat_id: matId, ten_hang: mat.ten, dvt: mat.dvt || 'Kg', don_gia: mat.gia_mua || 0, kho_mm: mat.kho ? Number(mat.kho) : null }
    form.setFieldValue('items', updated)
  }

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields()
      const items = (v.items as FormItem[] || []).map((it: FormItem) => ({
        po_item_id: null,
        paper_material_id: it.mat_id || null,
        other_material_id: null,
        ten_hang: it.ten_hang || '',
        so_luong: it.so_luong ?? 0,
        dvt: it.dvt || 'Kg',
        don_gia: it.don_gia || 0,
        ket_qua_kiem_tra: it.ket_qua_kiem_tra || 'DAT',
        kho_mm: it.kho_mm || null,
        so_cuon: it.so_cuon || null,
        ky_hieu_cuon: it.ky_hieu_cuon || null,
        dai_mm: null,
        so_lop: null,
        dinh_luong_thuc_te: null,
        do_am: null,
        ghi_chu: it.ghi_chu || null,
      }))
      if (!items.length) { message.warning('Thêm ít nhất 1 dòng hàng'); return }
      completeMut.mutate({
        id: grId!,
        data: { warehouse_id: v.warehouse_id || null, ghi_chu: v.ghi_chu || null, hd_tong_kg: v.hd_tong_kg || null, items },
      })
    } catch { /* validation inline */ }
  }

  const applyChonNL = () => {
    const selected = paperMats.filter((m) => chonNLSelected.includes(m.id))
    const currentItems = form.getFieldValue('items') || []
    form.setFieldValue('items', [
      ...currentItems,
      ...selected.map((m) => ({ mat_id: m.id, ten_hang: m.ten, dvt: 'Kg', don_gia: m.gia_mua ? Number(m.gia_mua) : 0, kho_mm: m.kho ? Number(m.kho) : null, so_cuon: null, ky_hieu_cuon: null, ket_qua_kiem_tra: 'DAT' })),
    ])
    setOpenChonNL(false)
    setChonNLSelected([])
    setChonNLSearch('')
  }

  return (
    <>
      <Modal
        open={!!grId}
        onCancel={onClose}
        width="98vw"
        style={{ top: 8 }}
        styles={{ body: { padding: '12px 16px', height: 'calc(100vh - 120px)', overflow: 'hidden' } }}
        title="✏️ Hoàn thiện phiếu nhập giấy cuộn"
        destroyOnClose
        footer={
          <Space>
            <Button onClick={onClose}>Huỷ</Button>
            {!allChecked && watchedItems.length > 0 && (
              <span style={{ fontSize: 12, color: '#fa8c16' }}>
                Đã đối chiếu {checkedCount}/{watchedItems.length} dòng — tick hết để hoàn thiện
              </span>
            )}
            <Tooltip title={!allChecked && watchedItems.length > 0 ? 'Phải đối chiếu tất cả dòng hàng trước' : ''}>
              <Button
                type="primary"
                loading={completeMut.isPending}
                onClick={handleSubmit}
                disabled={!allChecked && watchedItems.length > 0}
              >
                Hoàn thiện & cập nhật tồn kho
              </Button>
            </Tooltip>
          </Space>
        }
      >
        <Row style={{ height: '100%' }} gutter={12}>
          {/* LEFT: ẢNH + OCR */}
          <Col span={9} style={{ height: '100%', display: 'flex', flexDirection: 'column', borderRight: '1px solid #f0f0f0', paddingRight: 12 }}>
            <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Upload accept="image/*" showUploadList={false}
                beforeUpload={file => { setInvoiceFile(file); setInvoicePreviewUrl(URL.createObjectURL(file)); setGrMediaUrl(null); return false }}>
                <Button icon={<UploadOutlined />} size="small">Chọn ảnh</Button>
              </Upload>
              {(invoicePreviewUrl || grMediaUrl) && (
                <>
                  <Button size="small" danger onClick={() => { setInvoiceFile(null); setInvoicePreviewUrl(null); setGrMediaUrl(null) }}>Xoá</Button>
                  <Button size="small" htmlType="button" icon={<ScanOutlined />} loading={ocrLoading}
                    style={{ color: '#722ed1', borderColor: '#722ed1' }} onClick={handleOcr}>
                    Đọc ảnh (AI)
                  </Button>
                </>
              )}
            </div>
            <div style={{ flex: 1, overflow: 'auto', background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {(invoicePreviewUrl || grMediaUrl) ? (
                <Image src={invoicePreviewUrl || grMediaUrl!} style={{ maxWidth: '100%' }} preview={{ mask: 'Xem lớn' }} />
              ) : (
                <div style={{ color: '#bbb', textAlign: 'center' }}>
                  <FileImageOutlined style={{ fontSize: 48, marginBottom: 8, display: 'block' }} />
                  Ảnh phiếu xuất NCC
                </div>
              )}
            </div>
            {ocrResult && (
              <div style={{ marginTop: 8, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4, padding: '8px 10px', fontSize: 12 }}>
                <div style={{ fontWeight: 600, color: '#52c41a', marginBottom: 4 }}>✅ OCR đã đọc xong</div>
                {ocrResult.ten_ncc && <div>NCC: <strong>{ocrResult.ten_ncc}</strong></div>}
                {ocrResult.so_xe && <div>Số xe: <strong>{ocrResult.so_xe}</strong></div>}
                {ocrResult.tong_kg && <div>Tổng KG: <strong>{ocrResult.tong_kg} kg</strong></div>}
                {(ocrResult.hang_hoa?.length ?? 0) > 0 && <div>{ocrResult.hang_hoa.length} dòng hàng</div>}
                <Space style={{ marginTop: 6 }}>
                  <Button size="small" type="primary" icon={<FormOutlined />} onClick={handleFillFromOcr}>
                    Điền vào form
                  </Button>
                  <Button size="small" icon={<StarOutlined />} loading={savingExample} onClick={handleSaveAsExample} style={{ color: '#722ed1', borderColor: '#722ed1' }}>
                    Lưu làm ví dụ
                  </Button>
                </Space>
              </div>
            )}
          </Col>

          {/* RIGHT: FORM */}
          <Col span={15} style={{ height: '100%', overflowY: 'auto' }}>
            <Form form={form} layout="vertical">
              <Row gutter={10}>
                <Col span={6}>
                  <Form.Item name="so_xe" label="Số xe"><Input placeholder="51C-12345" /></Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item name="ngay_nhap" label="Ngày nhập" rules={[{ required: true }]}>
                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="supplier_id" label="Nhà cung cấp">
                    <Select showSearch placeholder="NCC..."
                      filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
                      options={suppliers.map((s) => ({ value: s.id, label: s.ten_viet_tat || s.ten_don_vi }))} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={10}>
                <Col span={8}>
                  <Form.Item label="Xưởng (lọc kho)">
                    <Select placeholder="Chọn xưởng..." allowClear value={formPxId ?? undefined}
                      onChange={v => { setFormPxId(v ?? null); form.setFieldValue('warehouse_id', undefined) }}
                      options={phanXuongs.filter((p) => p.trang_thai).map((p) => ({ value: p.id, label: p.ten_xuong }))} />
                  </Form.Item>
                </Col>
                <Col span={16}>
                  <Form.Item name="warehouse_id" label="Kho nhập" rules={[{ required: true, message: 'Chọn kho' }]}>
                    <Select placeholder="Chọn kho"
                      options={warehouses
                        .filter((w) => w.trang_thai && (!formPxId || w.phan_xuong_id === formPxId))
                        .map((w) => ({ value: w.id, label: `${w.ten_kho}${w.loai_kho ? ` (${w.loai_kho})` : ''}` }))} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={10}>
                <Col span={12}>
                  <Form.Item name="hd_tong_kg" label="Tổng KG phiếu NCC">
                    <InputNumber style={{ width: '100%' }} min={0} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                  </Form.Item>
                  {kgLech !== null && (
                    <div style={{ color: isKhop ? '#52c41a' : '#ff4d4f', fontSize: 12, marginTop: -16, marginBottom: 8 }}>
                      Tính được: <strong>{calcTongKg.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} kg</strong>
                      {!isKhop && <span> | Lệch: <strong>{kgLech > 0 ? '+' : ''}{kgLech.toFixed(1)} kg</strong></span>}
                      {isKhop && ' ✅'}
                    </div>
                  )}
                </Col>
                <Col span={12}>
                  <Form.Item name="ghi_chu" label="Ghi chú"><Input /></Form.Item>
                </Col>
              </Row>

              <Divider orientation="left" style={{ fontSize: 13 }}>
                <Space>
                  Danh sách hàng
                  {watchedItems.length > 0 && (
                    <Tag color={allChecked ? 'success' : 'warning'}>
                      {allChecked ? '✅ Đã đối chiếu hết' : `Đã tra ${checkedCount}/${watchedItems.length}`}
                    </Tag>
                  )}
                  {watchedSupplierId && (
                    <Button size="small" icon={<ThunderboltOutlined />}
                      style={{ color: '#1677ff', borderColor: '#1677ff' }}
                      onClick={() => { setChonNLSelected([]); setChonNLSearch(''); setOpenChonNL(true) }}>
                      Chọn nhanh
                    </Button>
                  )}
                </Space>
              </Divider>

              <Form.List name="items">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name }) => {
                      const isDone = watchedItems[name]?.da_doi_chieu
                      return (
                        <Card key={key} size="small" style={{
                          marginBottom: 8,
                          background: isDone ? '#f6ffed' : '#fafafa',
                          border: isDone ? '1px solid #b7eb8f' : '1px solid #f0f0f0',
                          transition: 'all 0.2s',
                        }}>
                          <Row gutter={[8, 4]}>
                            <Col span={18}>
                              <Form.Item name={[name, 'mat_id']} label="Mã giấy" style={{ marginBottom: 4 }}>
                                <Select size="small" showSearch placeholder="Chọn mã giấy..."
                                  filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
                                  options={paperMatsForNCC.map((m) => ({ value: m.id, label: `${m.ma_chinh ? m.ma_chinh + ' — ' : ''}${m.ten}` }))}
                                  onChange={id => handleMatSelect(name, id)} />
                              </Form.Item>
                            </Col>
                            <Col span={4} style={{ display: 'flex', alignItems: 'center', paddingTop: 4 }}>
                              <Form.Item name={[name, 'da_doi_chieu']} valuePropName="checked" style={{ marginBottom: 0 }}>
                                <Checkbox style={{ color: isDone ? '#52c41a' : '#fa8c16', fontWeight: isDone ? 600 : 400, fontSize: 12 }}>
                                  {isDone ? '✓ Đã tra' : 'Chưa tra'}
                                </Checkbox>
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
                              <Form.Item name={[name, 'ket_qua_kiem_tra']} label="KQ KT" style={{ marginBottom: 4 }}>
                                <Select size="small" options={[{ value: 'DAT', label: 'Đạt' }, { value: 'KHONG_DAT', label: 'Không đạt' }, { value: 'CHO_KIEM_TRA', label: 'Chờ KT' }]} />
                              </Form.Item>
                            </Col>
                            <Col span={6}>
                              <Form.Item name={[name, 'kho_mm']} label="Khổ (cm)" style={{ marginBottom: 4 }}>
                                <InputNumber size="small" min={0} style={{ width: '100%' }} />
                              </Form.Item>
                            </Col>
                            <Col span={6}>
                              <Form.Item name={[name, 'so_cuon']} label="Số cuộn" style={{ marginBottom: 4 }}>
                                <InputNumber size="small" min={1} precision={0} style={{ width: '100%' }} />
                              </Form.Item>
                            </Col>
                            <Col span={6}>
                              <Form.Item name={[name, 'ky_hieu_cuon']} label="Ký hiệu" style={{ marginBottom: 4 }}>
                                <Input size="small" />
                              </Form.Item>
                            </Col>
                            <Col span={6}>
                              <Form.Item name={[name, 'so_luong']} label="KG" rules={[{ required: true, message: 'Nhập KG' }]} style={{ marginBottom: 4 }}>
                                <InputNumber size="small" min={0.001} style={{ width: '100%' }} />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item name={[name, 'don_gia']} label="Đơn giá (đ/kg)" style={{ marginBottom: 4 }}>
                                <InputNumber size="small" min={0} style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item name={[name, 'ghi_chu']} label="Ghi chú" style={{ marginBottom: 4 }}>
                                <Input size="small" />
                              </Form.Item>
                            </Col>
                          </Row>
                        </Card>
                      )
                    })}
                    <Button type="dashed" block icon={<PlusOutlined />}
                      onClick={() => add({ dvt: 'Kg', don_gia: 0, ket_qua_kiem_tra: 'DAT' })}>
                      Thêm dòng hàng
                    </Button>
                  </>
                )}
              </Form.List>
            </Form>
          </Col>
        </Row>
      </Modal>

      {/* Chọn nhanh nhiều mã giấy */}
      <Modal open={openChonNL} title="Chọn nhanh mã giấy" width={700}
        onCancel={() => { setOpenChonNL(false); setChonNLSelected([]) }}
        onOk={applyChonNL} okText={`Thêm ${chonNLSelected.length} mã`}
        okButtonProps={{ disabled: chonNLSelected.length === 0 }}>
        <Input.Search placeholder="Tìm mã / tên..." value={chonNLSearch}
          onChange={e => setChonNLSearch(e.target.value)} allowClear style={{ marginBottom: 12 }} />
        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          {paperMatsForNCC
            .filter((m) => !chonNLSearch || m.ten?.toLowerCase().includes(chonNLSearch.toLowerCase()) || m.ma_chinh?.toLowerCase().includes(chonNLSearch.toLowerCase()))
            .map((m) => (
              <div key={m.id} style={{ padding: '6px 8px', cursor: 'pointer', borderRadius: 4, marginBottom: 2, background: chonNLSelected.includes(m.id) ? '#e6f4ff' : 'transparent' }}
                onClick={() => setChonNLSelected(prev => prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id])}>
                <Checkbox checked={chonNLSelected.includes(m.id)} style={{ marginRight: 8 }} />
                <strong>{m.ma_chinh}</strong> — {m.ten}
                {m.kho && <span style={{ color: '#888', marginLeft: 8 }}>Khổ: {m.kho}</span>}
                {m.gia_mua && <span style={{ color: '#1677ff', marginLeft: 8 }}>{Number(m.gia_mua).toLocaleString('vi-VN')}đ/kg</span>}
              </div>
            ))}
        </div>
      </Modal>
    </>
  )
}
