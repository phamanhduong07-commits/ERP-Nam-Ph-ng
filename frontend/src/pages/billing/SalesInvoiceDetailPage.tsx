import { useState } from 'react'
import type { ApiError } from '../../api/types'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Descriptions, Divider, Drawer, Form, Input,
  InputNumber, Modal, Row, Select, Space, Spin, Table, Tag, Typography, App,
} from 'antd'
import {
  ArrowLeftOutlined, CheckOutlined, CloseOutlined, EditOutlined,
  FileTextOutlined, PictureOutlined, PlusOutlined, PrinterOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { buildHtmlTable, fmtVND, smartPrintPdf } from '../../utils/exportUtils'
import {
  billingApi, SalesInvoice, CashReceiptShort,
  TRANG_THAI_INVOICE, HINH_THUC_TT, VAT_OPTIONS,
} from '../../api/billing'
import { deliveriesApi } from '../../api/deliveries'
import type { DeliveryOrder, DeliveryOrderItem } from '../../api/deliveries'
import { receiptApi } from '../../api/accounting'
import { useAuthStore } from '../../store/auth'
import { systemApi } from '../../api/system'
import { usePhapNhanList } from '../../hooks/usePhapNhan'
import { phapNhanApi } from '../../api/phap_nhan'
import EmptyState from "../../components/EmptyState"

const { Title, Text } = Typography

type Dayjs = import('dayjs').Dayjs
type ReceiptFormValues = { ngay_phieu: Dayjs; hinh_thuc_tt: string; so_tai_khoan?: string; so_tham_chieu?: string; dien_giai?: string; so_tien: number }
type EditFormValues = { han_tt?: Dayjs; ty_le_vat?: number; hinh_thuc_tt?: string; ghi_chu?: string; ghi_chu_dieu_chinh?: string }
type AdjustFormValues = { ty_le_vat?: number; ghi_chu_dieu_chinh?: string }
type PrintItem = { ten_hang?: string; dvt?: string; so_luong?: number; don_gia?: number; thanh_tien?: number }
const EDIT_ROLES    = ['SALE_ADMIN', 'KE_TOAN_CONG_NO', 'KE_TOAN', 'KE_TOAN_TRUONG', 'GIAM_DOC', 'ADMIN']
const ADJUST_ROLES  = ['KE_TOAN_CONG_NO', 'KE_TOAN_TRUONG', 'GIAM_DOC', 'ADMIN']
const APPROVE_ROLES = ['KE_TOAN_TRUONG', 'GIAM_DOC', 'ADMIN']

export default function SalesInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const invoiceId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const userRole = user?.role ?? ''

  const canEdit    = EDIT_ROLES.includes(userRole)
  const canAdjust  = ADJUST_ROLES.includes(userRole)
  const canApprove = APPROVE_ROLES.includes(userRole)
  const { message, modal } = App.useApp()

  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [showDeliveryDrawer, setShowDeliveryDrawer] = useState(false)

  const { data: phapNhanList = [] } = usePhapNhanList()

  type AdjustItem = {
    production_order_id: number | null
    so_lenh: string | null
    ten_hang: string
    dvt: string
    so_luong: number
    don_gia: number
    thanh_tien: number
  }
  const [adjustItems, setAdjustItems] = useState<AdjustItem[]>([])
  const newTotal = adjustItems.reduce((s, it) => s + it.thanh_tien, 0)
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
  const [adjustForm] = Form.useForm()

  const { data: invoice, isLoading } = useQuery<SalesInvoice>({
    queryKey: ['billing-invoice', invoiceId],
    queryFn: () => billingApi.getInvoice(invoiceId),
    enabled: !!invoiceId,
  })

  const { data: deliveryOrder, isLoading: loadingDelivery } = useQuery<DeliveryOrder>({
    queryKey: ['delivery-for-invoice', invoice?.delivery_id],
    queryFn: () => deliveriesApi.get(invoice!.delivery_id!).then(r => r.data),
    enabled: !!invoice?.delivery_id,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['billing-invoice', invoiceId] })
    qc.invalidateQueries({ queryKey: ['billing-invoices'] })
  }

  const issueMut = useMutation({
    mutationFn: () => billingApi.issueInvoice(invoiceId),
    onSuccess: () => { message.success('Đã phát hành hóa đơn'); invalidate() },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail ?? 'Lỗi phát hành'),
  })

  const cancelMut = useMutation({
    mutationFn: () => billingApi.cancelInvoice(invoiceId),
    onSuccess: () => { message.success('Đã hủy hóa đơn'); invalidate() },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail ?? 'Lỗi hủy'),
  })

  const receiptMut = useMutation({
    mutationFn: (values: ReceiptFormValues) =>
      receiptApi.create({
        customer_id: invoice!.customer_id,
        sales_invoice_id: invoiceId,
        ngay_phieu: values.ngay_phieu.format('YYYY-MM-DD'),
        hinh_thuc_tt: values.hinh_thuc_tt,
        so_tai_khoan: values.so_tai_khoan,
        so_tham_chieu: values.so_tham_chieu,
        dien_giai: values.dien_giai,
        so_tien: values.so_tien,
      }),
    onSuccess: () => {
      message.success('Ghi nhận thanh toán thành công')
      setShowReceiptModal(false)
      form.resetFields()
      invalidate()
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail ?? 'Lỗi ghi nhận'),
  })

  const populateAdjustItems = () => {
    const items: AdjustItem[] = (deliveryOrder?.items ?? []).map(it => ({
      production_order_id: it.production_order_id,
      so_lenh: it.so_lenh,
      ten_hang: it.ten_hang,
      dvt: it.dvt,
      so_luong: it.so_luong,
      don_gia: it.don_gia,
      thanh_tien: it.thanh_tien,
    }))
    // fallback nếu không có delivery: 1 dòng trống với tổng hiện tại
    if (!items.length) {
      items.push({
        production_order_id: null,
        so_lenh: null,
        ten_hang: 'Hàng hóa',
        dvt: 'Thùng',
        so_luong: 1,
        don_gia: Number(invoice?.tong_tien_hang ?? 0),
        thanh_tien: Number(invoice?.tong_tien_hang ?? 0),
      })
    }
    setAdjustItems(items)
  }

  const openEditModal = () => {
    populateAdjustItems()
    editForm.setFieldsValue({
      han_tt: invoice?.han_tt ? dayjs(invoice.han_tt) : null,
      ty_le_vat: Number(invoice?.ty_le_vat),
      hinh_thuc_tt: invoice?.hinh_thuc_tt,
      ghi_chu: invoice?.ghi_chu,
      ghi_chu_dieu_chinh: '',
    })
    setShowEditModal(true)
  }

  const openAdjustModal = () => {
    populateAdjustItems()
    adjustForm.setFieldsValue({
      ty_le_vat: Number(invoice?.ty_le_vat),
      ghi_chu_dieu_chinh: '',
    })
    setShowAdjustModal(true)
  }

  // Điều chỉnh trước kết chuyển
  const editMut = useMutation({
    mutationFn: (values: EditFormValues) => billingApi.updateInvoice(invoiceId, {
      han_tt: values.han_tt ? values.han_tt.format('YYYY-MM-DD') : undefined,
      ty_le_vat: values.ty_le_vat,
      hinh_thuc_tt: values.hinh_thuc_tt,
      ghi_chu: values.ghi_chu,
      tong_tien_hang: newTotal,
      ghi_chu_dieu_chinh: values.ghi_chu_dieu_chinh,
    }),
    onSuccess: () => {
      message.success('Đã lưu điều chỉnh')
      setShowEditModal(false)
      invalidate()
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail ?? 'Lỗi điều chỉnh'),
  })

  // Yêu cầu điều chỉnh sau kết chuyển
  const adjustMut = useMutation({
    mutationFn: (values: AdjustFormValues) => billingApi.requestAdjustment(invoiceId, {
      tong_tien_hang: newTotal,
      ty_le_vat: values.ty_le_vat ?? 0,
      ghi_chu_dieu_chinh: values.ghi_chu_dieu_chinh ?? '',
    }),
    onSuccess: () => {
      message.success('Đã gửi yêu cầu điều chỉnh')
      setShowAdjustModal(false)
      invalidate()
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail ?? 'Lỗi gửi yêu cầu'),
  })

  // Duyệt / Từ chối adjustment log
  const approveMut = useMutation({
    mutationFn: ({ logId, approved, ghi_chu }: { logId: number; approved: boolean; ghi_chu?: string }) =>
      billingApi.approveAdjustment(logId, { approved, ghi_chu }),
    onSuccess: (_, vars) => {
      message.success(vars.approved ? 'Đã duyệt điều chỉnh' : 'Đã từ chối')
      invalidate()
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail ?? 'Lỗi xử lý'),
  })

  // Upload ảnh phiếu giao
  const photoMut = useMutation({
    mutationFn: (file: File) => billingApi.uploadPhoto(invoiceId, file),
    onSuccess: () => {
      message.success('Đã tải ảnh lên')
      setShowPhotoModal(false)
      setPhotoFile(null)
      invalidate()
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail ?? 'Lỗi tải ảnh'),
  })

  const handlePrintInvoice = async () => {
    if (!invoice) return

    const cols = [
      { header: 'STT', key: 'stt', align: 'center' as const },
      { header: 'Tên hàng hóa', key: 'ten_hang' },
      { header: 'ĐVT', key: 'dvt', align: 'center' as const },
      { header: 'Số lượng', key: 'so_luong', align: 'right' as const },
      { header: 'Đơn giá', key: 'don_gia', align: 'right' as const },
      { header: 'Thành tiền', key: 'thanh_tien', align: 'right' as const },
    ]

    let itemsToPrint: PrintItem[] = []
    if (deliveryOrder?.items && deliveryOrder.items.length > 0) {
      itemsToPrint = deliveryOrder.items
    } else {
      itemsToPrint = [{
        ten_hang: 'Thùng carton (theo hợp đồng / đơn hàng)',
        dvt: 'Thùng',
        so_luong: 1,
        don_gia: invoice.tong_tien_hang,
        thanh_tien: invoice.tong_tien_hang
      }]
    }

    let sumSoLuong = 0
    let sumThanhTien = 0
    let sumDonGia = 0
    
    const rowData = itemsToPrint.map((it, idx) => {
      sumSoLuong += Number(it.so_luong || 0)
      sumThanhTien += Number(it.thanh_tien || 0)
      sumDonGia += Number(it.don_gia || 0)
      return {
        stt: idx + 1,
        ten_hang: it.ten_hang,
        dvt: it.dvt,
        so_luong: it.so_luong ? Number(it.so_luong).toLocaleString('vi-VN') : '—',
        don_gia: it.don_gia ? Number(it.don_gia).toLocaleString('vi-VN') : '—',
        thanh_tien: it.thanh_tien ? Number(it.thanh_tien).toLocaleString('vi-VN') : '—',
      }
    })

    const table = buildHtmlTable(cols.map(c => ({ header: c.header, align: c.align })), rowData.map(r => cols.map(c => (r as Record<string, unknown>)[c.key] as string | number | null | undefined)))

    const printData = {
      subtitle: invoice.mau_so ? `Mẫu số: ${invoice.mau_so}<br/>Ký hiệu: ${invoice.ky_hieu}` : 'HÓA ĐƠN BÁN HÀNG',
      document_number: invoice.so_hoa_don || '-',
      document_date: invoice.ngay_hoa_don ? dayjs(invoice.ngay_hoa_don).format('DD/MM/YYYY') : '—',
      customer_name: invoice.ten_don_vi || '—',
      delivery_address: invoice.dia_chi || '—',
      body_html: table,
      total_thanh_tien: Number(invoice.tong_tien_hang).toLocaleString('vi-VN'),
      total_so_luong: sumSoLuong ? sumSoLuong.toLocaleString('vi-VN') : '—',
      total_don_gia: sumDonGia ? sumDonGia.toLocaleString('vi-VN') : '—',
      warehouse_name: deliveryOrder?.ten_kho || '—',
      driver_name: deliveryOrder?.ten_tai_xe || '—',
    }

    smartPrintPdf('SALES_INVOICE', printData, invoice.phap_nhan_id ?? undefined)
  }

  if (isLoading) return <Spin style={{ margin: 40 }} />
  if (!invoice) return <div style={{ padding: 24 }}>Không tìm thấy hóa đơn</div>

  const status = TRANG_THAI_INVOICE[invoice.trang_thai]
  const isNhap      = invoice.trang_thai === 'nhap'
  const isIssued    = ['da_phat_hanh', 'da_tt_mot_phan', 'qua_han'].includes(invoice.trang_thai)
  const canIssue    = isNhap
  const canCancel   = ['nhap', 'da_phat_hanh'].includes(invoice.trang_thai) && canApprove
  const canReceipt  = isIssued
  const conLai      = invoice.con_lai ?? 0
  const pendingLog  = invoice.adjustment_logs?.find(l => l.trang_thai === 'pending')

  const receiptCols: ColumnsType<CashReceiptShort> = [
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 160 },
    { title: 'Ngày phiếu', dataIndex: 'ngay_phieu', width: 110, render: v => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Hình thức TT', dataIndex: 'hinh_thuc_tt', width: 120, render: v => HINH_THUC_TT[v] ?? v },
    { title: 'Số tiền', dataIndex: 'so_tien', align: 'right', width: 140, render: v => fmtVND(v) },
    {
      title: 'Trạng thái', dataIndex: 'trang_thai', width: 110,
      render: v => {
        const map: Record<string, { label: string; color: string }> = {
          cho_duyet: { label: 'Chờ duyệt', color: 'orange' },
          da_duyet:  { label: 'Đã duyệt',  color: 'green' },
          huy:       { label: 'Đã hủy',    color: 'default' },
        }
        const s = map[v]
        return <Tag color={s?.color}>{s?.label ?? v}</Tag>
      },
    },
  ]

  const logStatusTag = (s: string) => {
    const map: Record<string, { label: string; color: string }> = {
      na:       { label: 'Đã áp dụng', color: 'blue' },
      pending:  { label: 'Chờ duyệt',  color: 'orange' },
      approved: { label: 'Đã duyệt',   color: 'green' },
      rejected: { label: 'Từ chối',    color: 'red' },
    }
    const m = map[s]
    return <Tag color={m?.color}>{m?.label ?? s}</Tag>
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/billing/invoices')} />
          <Title level={4} style={{ margin: 0 }}>
            {invoice.so_hoa_don ?? `Hóa đơn #${invoice.id}`}
          </Title>
          <Tag color={status?.color}>{status?.label ?? invoice.trang_thai}</Tag>
          {invoice.phap_nhan_ten && (
            <Tag color="purple" style={{ fontSize: 12 }}>{invoice.phap_nhan_ten}</Tag>
          )}
        </Space>
        <Space wrap>
          {canReceipt && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setShowReceiptModal(true) }}>
              Ghi nhận TT
            </Button>
          )}
          {/* Điều chỉnh trước kết chuyển */}
          {isNhap && canEdit && (
            <Button icon={<EditOutlined />} onClick={openEditModal}>
              Điều chỉnh
            </Button>
          )}
          {/* Yêu cầu điều chỉnh sau kết chuyển */}
          {isIssued && canAdjust && !pendingLog && (
            <Button icon={<EditOutlined />} onClick={openAdjustModal}>
              Yêu cầu điều chỉnh
            </Button>
          )}
          {canIssue && (
            <Button
              type="primary" icon={<CheckOutlined />}
              loading={issueMut.isPending}
              onClick={() => modal.confirm({
                title: 'Phát hành hóa đơn?',
                content: 'Sau khi phát hành sẽ ghi nhận khoản phải thu. Để sửa cần yêu cầu điều chỉnh.',
                onOk: () => issueMut.mutate(),
              })}
            >
              Phát hành HĐ
            </Button>
          )}
          {canCancel && (
            <Button
              danger icon={<CloseOutlined />}
              loading={cancelMut.isPending}
              onClick={() => modal.confirm({
                title: 'Hủy hóa đơn?',
                content: 'Thao tác này không thể hoàn tác.',
                okType: 'danger',
                onOk: () => cancelMut.mutate(),
              })}
            >
              Hủy HĐ
            </Button>
          )}
          <Button
            icon={<PrinterOutlined />}
            onClick={handlePrintInvoice}
          >
            In HĐ
          </Button>
        </Space>
      </div>

      {/* Biên nhận giao hàng — 2 cột */}
      <Card size="small" style={{ marginBottom: 16 }} title="Biên nhận giao hàng">
        <Row gutter={24}>
          {/* Cột trái: Ảnh ký nhận (sau giao) */}
          <Col xs={24} md={14} style={{ borderRight: '1px solid #f0f0f0', paddingRight: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: '#52c41a' }}>
              <PictureOutlined style={{ marginRight: 6 }} />
              Ảnh ký nhận (sau khi giao)
              {canEdit && (
                <Button
                  size="small"
                  style={{ marginLeft: 12 }}
                  onClick={() => setShowPhotoModal(true)}
                >
                  {invoice.anh_phieu_giao ? 'Cập nhật ảnh' : 'Upload ảnh'}
                </Button>
              )}
            </div>
            {invoice.anh_phieu_giao ? (
              <img
                src={invoice.anh_phieu_giao}
                alt="Ảnh ký nhận"
                style={{ width: '100%', objectFit: 'contain', borderRadius: 4, border: '1px solid #f0f0f0', display: 'block' }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#bfbfbf', border: '1px dashed #d9d9d9', borderRadius: 6 }}>
                <PictureOutlined style={{ fontSize: 32, display: 'block', marginBottom: 8 }} />
                Chưa có ảnh ký nhận
              </div>
            )}
          </Col>

          {/* Cột phải: Phiếu xuất kho (trước giao) */}
          <Col xs={24} md={10} style={{ paddingLeft: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: '#1677ff' }}>
              <FileTextOutlined style={{ marginRight: 6 }} />
              Phiếu xuất kho (trước khi giao)
            </div>
            {loadingDelivery ? (
              <Spin size="small" />
            ) : deliveryOrder ? (
              <Space direction="vertical" style={{ width: '100%' }} size={4}>
                <Descriptions size="small" column={1} bordered={false}>
                  <Descriptions.Item label="Số phiếu">
                    <Text strong>{deliveryOrder.so_phieu}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Ngày xuất">
                    {deliveryOrder.ngay_xuat ? dayjs(deliveryOrder.ngay_xuat).format('DD/MM/YYYY') : '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Kho xuất">
                    {deliveryOrder.ten_kho ?? '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Tài xế">
                    {deliveryOrder.ten_tai_xe ?? '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Biển số">
                    {deliveryOrder.bien_so ?? deliveryOrder.xe_van_chuyen ?? '—'}
                  </Descriptions.Item>
                </Descriptions>
                <Button
                  size="small"
                  icon={<FileTextOutlined />}
                  style={{ marginTop: 8 }}
                  onClick={() => setShowDeliveryDrawer(true)}
                >
                  Xem chi tiết phiếu xuất
                </Button>
              </Space>
            ) : (
              <Text type="secondary">Không có phiếu xuất liên kết</Text>
            )}
          </Col>
        </Row>
      </Card>

      {/* Thông tin hóa đơn */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Số hóa đơn">{invoice.so_hoa_don ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Ngày hóa đơn">{dayjs(invoice.ngay_hoa_don).format('DD/MM/YYYY')}</Descriptions.Item>
          <Descriptions.Item label="Mẫu số">{invoice.mau_so ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Ký hiệu">{invoice.ky_hieu ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Hạn thanh toán">
            {invoice.han_tt ? dayjs(invoice.han_tt).format('DD/MM/YYYY') : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Hình thức TT">
            {HINH_THUC_TT[invoice.hinh_thuc_tt] ?? invoice.hinh_thuc_tt}
          </Descriptions.Item>
          <Descriptions.Item label="Khách hàng">{invoice.ten_don_vi ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Địa chỉ">{invoice.dia_chi ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Mã số thuế">{invoice.ma_so_thue ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Người mua hàng">{invoice.nguoi_mua_hang ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Ghi chú">{invoice.ghi_chu ?? '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Tổng tiền */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={24}>
          <Col span={8}>
            <Text type="secondary">Tiền hàng</Text>
            <div><Text strong style={{ fontSize: 16 }}>{fmtVND(invoice.tong_tien_hang)}</Text></div>
          </Col>
          <Col span={8}>
            <Text type="secondary">VAT ({invoice.ty_le_vat}%)</Text>
            <div><Text strong style={{ fontSize: 16 }}>{fmtVND(invoice.tien_vat)}</Text></div>
          </Col>
          <Col span={8}>
            <Text type="secondary">Tổng cộng</Text>
            <div><Text strong style={{ fontSize: 18, color: '#1677ff' }}>{fmtVND(invoice.tong_cong)}</Text></div>
          </Col>
          <Col span={8} style={{ marginTop: 12 }}>
            <Text type="secondary">Đã thanh toán</Text>
            <div><Text strong style={{ fontSize: 16, color: '#52c41a' }}>{fmtVND(invoice.da_thanh_toan)}</Text></div>
          </Col>
          <Col span={8} style={{ marginTop: 12 }}>
            <Text type="secondary">Còn lại</Text>
            <div>
              <Text strong style={{ fontSize: 16, color: conLai > 0 ? '#fa8c16' : '#52c41a' }}>
                {fmtVND(conLai)}
              </Text>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Phiếu thu */}
      <Card size="small" title="Phiếu thu đã ghi" style={{ marginBottom: 16 }}>
        <Table
          columns={receiptCols}
          dataSource={invoice.receipts ?? []}
          rowKey="id"
          size="small"
          pagination={false}
          locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
        />
      </Card>

      {/* Lịch sử điều chỉnh */}
      {(invoice.adjustment_logs?.length > 0 || pendingLog) && (
        <Card size="small" title="Lịch sử điều chỉnh" style={{ marginBottom: 16 }}>
          {invoice.adjustment_logs?.map(lg => {
            const before = lg.du_lieu_truoc ? JSON.parse(lg.du_lieu_truoc) : null
            const after  = lg.du_lieu_sau  ? JSON.parse(lg.du_lieu_sau)  : null
            return (
              <Card
                key={lg.id}
                size="small"
                style={{ marginBottom: 8, background: lg.trang_thai === 'pending' ? '#fffbe6' : '#fafafa' }}
              >
                <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                  <Space>
                    {logStatusTag(lg.trang_thai)}
                    <Text strong>{lg.adjusted_by_name ?? `User #${lg.adjusted_by_id}`}</Text>
                    <Text type="secondary">{dayjs(lg.adjusted_at).format('DD/MM/YYYY HH:mm')}</Text>
                    <Tag color={lg.loai === 'truoc_ket_chuyen' ? 'blue' : 'orange'}>
                      {lg.loai === 'truoc_ket_chuyen' ? 'Trước KC' : 'Sau KC'}
                    </Tag>
                  </Space>
                  {/* Nút duyệt/từ chối */}
                  {lg.trang_thai === 'pending' && canApprove && (
                    <Space>
                      <Button
                        size="small" type="primary"
                        loading={approveMut.isPending}
                        onClick={() => Modal.confirm({
                          title: 'Duyệt điều chỉnh?',
                          content: after ? `Tổng mới: ${Number(after.tong_cong).toLocaleString('vi-VN')}đ` : '',
                          onOk: () => approveMut.mutate({ logId: lg.id, approved: true }),
                        })}
                      >
                        Duyệt
                      </Button>
                      <Button
                        size="small" danger
                        loading={approveMut.isPending}
                        onClick={() => {
                          Modal.confirm({
                            title: 'Từ chối yêu cầu?',
                            content: <Input.TextArea id="reject-reason" rows={3} placeholder="Lý do từ chối..." />,
                            onOk: () => {
                              const reason = (document.getElementById('reject-reason') as HTMLTextAreaElement)?.value
                              approveMut.mutate({ logId: lg.id, approved: false, ghi_chu: reason })
                            },
                          })
                        }}
                      >
                        Từ chối
                      </Button>
                    </Space>
                  )}
                </Space>
                <div style={{ marginTop: 6 }}>
                  <Text type="secondary">Lý do: </Text><Text>{lg.ghi_chu}</Text>
                </div>
                {before && after && (
                  <Row gutter={16} style={{ marginTop: 8 }}>
                    <Col span={12}>
                      <Card size="small" title="Trước" style={{ background: '#fff1f0' }}>
                        <div>Tiền hàng: {Number(before.tong_tien_hang).toLocaleString('vi-VN')}</div>
                        <div>VAT: {before.ty_le_vat}%</div>
                        <div>Tổng: {Number(before.tong_cong).toLocaleString('vi-VN')}</div>
                      </Card>
                    </Col>
                    <Col span={12}>
                      <Card size="small" title="Sau" style={{ background: '#f6ffed' }}>
                        <div>Tiền hàng: {Number(after.tong_tien_hang).toLocaleString('vi-VN')}</div>
                        <div>VAT: {after.ty_le_vat}%</div>
                        <div>Tổng: {Number(after.tong_cong).toLocaleString('vi-VN')}</div>
                      </Card>
                    </Col>
                  </Row>
                )}
                {lg.approved_by_name && (
                  <div style={{ marginTop: 4 }}>
                    <Text type="secondary">
                      {lg.trang_thai === 'approved' ? 'Duyệt bởi' : 'Từ chối bởi'}: {lg.approved_by_name}
                      {lg.approved_at && ` — ${dayjs(lg.approved_at).format('DD/MM/YYYY HH:mm')}`}
                    </Text>
                  </div>
                )}
              </Card>
            )
          })}
        </Card>
      )}

      {/* Modal ghi nhận thanh toán */}
      <Modal
        title="Ghi nhận thanh toán"
        open={showReceiptModal}
        onCancel={() => setShowReceiptModal(false)}
        onOk={() => form.submit()}
        okText="Ghi nhận"
        confirmLoading={receiptMut.isPending}
        destroyOnClose
      >
        <Form
          form={form} layout="vertical"
          initialValues={{ ngay_phieu: dayjs(), hinh_thuc_tt: 'CK', so_tien: conLai }}
          onFinish={receiptMut.mutate}
        >
          <Form.Item name="ngay_phieu" label="Ngày phiếu" rules={[{ required: true }]}>
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="hinh_thuc_tt" label="Hình thức TT" rules={[{ required: true }]}>
            <Select options={Object.entries(HINH_THUC_TT).map(([k, v]) => ({ value: k, label: v }))} />
          </Form.Item>
          <Form.Item name="so_tien" label="Số tiền" rules={[{ required: true, type: 'number', min: 1 }]}>
            <InputNumber
              style={{ width: '100%' }} min={1} max={conLai}
              formatter={v => v ? Number(v).toLocaleString('vi-VN') : ''}
              parser={v => Number((v ?? '').replace(/\D/g, '')) as number}
            />
          </Form.Item>
          <Form.Item name="so_tham_chieu" label="Số tham chiếu">
            <Input />
          </Form.Item>
          <Form.Item name="dien_giai" label="Diễn giải">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal điều chỉnh TRƯỚC kết chuyển */}
      <Modal
        title="Điều chỉnh hóa đơn (trước kết chuyển)"
        open={showEditModal}
        onCancel={() => setShowEditModal(false)}
        onOk={() => editForm.submit()}
        okText="Lưu"
        confirmLoading={editMut.isPending}
        destroyOnClose
        width={820}
      >
        <Form form={editForm} layout="vertical" onFinish={editMut.mutate}>
          {/* Bảng chỉnh số lượng từng LSX */}
          <Table
            size="small"
            dataSource={adjustItems}
            rowKey={(_, i) => i ?? 0}
            pagination={false}
            style={{ marginBottom: 12 }}
            summary={() => (
              <Table.Summary.Row style={{ background: '#e6f4ff', fontWeight: 700 }}>
                <Table.Summary.Cell index={0} colSpan={3}>Tổng tiền hàng</Table.Summary.Cell>
                <Table.Summary.Cell index={3} />
                <Table.Summary.Cell index={4} />
                <Table.Summary.Cell index={5} align="right">
                  <Text strong style={{ color: '#1677ff', fontSize: 14 }}>{newTotal.toLocaleString('vi-VN')} đ</Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            )}
            columns={[
              { title: 'LSX', dataIndex: 'so_lenh', width: 120, render: (v: string | null) => v ? <Text code style={{ fontSize: 11 }}>{v}</Text> : '—' },
              { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
              { title: 'ĐVT', dataIndex: 'dvt', width: 55 },
              {
                title: 'Số lượng', width: 120, align: 'right' as const,
                render: (_: unknown, _row: AdjustItem, idx: number) => (
                  <InputNumber
                    size="small" style={{ width: '100%' }} min={0} value={adjustItems[idx].so_luong}
                    onChange={v => setAdjustItems(prev => prev.map((it, i) => i === idx
                      ? { ...it, so_luong: v ?? 0, thanh_tien: (v ?? 0) * it.don_gia }
                      : it))}
                  />
                ),
              },
              {
                title: 'Đơn giá', dataIndex: 'don_gia', width: 130, align: 'right' as const,
                render: (v: number) => <Text type="secondary">{v.toLocaleString('vi-VN')}</Text>,
              },
              {
                title: 'Thành tiền', width: 130, align: 'right' as const,
                render: (_: unknown, _row: AdjustItem, idx: number) => (
                  <Text strong style={{ color: '#52c41a' }}>
                    {adjustItems[idx].thanh_tien.toLocaleString('vi-VN')}
                  </Text>
                ),
              },
            ]}
          />
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="ty_le_vat" label="VAT">
                <Select options={VAT_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="han_tt" label="Hạn thanh toán">
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="hinh_thuc_tt" label="Hình thức TT">
                <Select options={Object.entries(HINH_THUC_TT).map(([k, v]) => ({ value: k, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="ghi_chu" label="Ghi chú">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="ghi_chu_dieu_chinh"
                label="Lý do điều chỉnh"
                rules={[{ required: true, message: 'Vui lòng nhập lý do điều chỉnh' }]}
              >
                <Input.TextArea rows={2} placeholder="Mô tả ngắn lý do thay đổi..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Modal yêu cầu điều chỉnh SAU kết chuyển */}
      <Modal
        title="Yêu cầu điều chỉnh (sau kết chuyển)"
        open={showAdjustModal}
        onCancel={() => setShowAdjustModal(false)}
        onOk={() => adjustForm.submit()}
        okText="Gửi yêu cầu"
        confirmLoading={adjustMut.isPending}
        destroyOnClose
        width={820}
      >
        <Form form={adjustForm} layout="vertical" onFinish={adjustMut.mutate}>
          {/* Bảng chỉnh số lượng từng LSX */}
          <Table
            size="small"
            dataSource={adjustItems}
            rowKey={(_, i) => i ?? 0}
            pagination={false}
            style={{ marginBottom: 12 }}
            summary={() => (
              <Table.Summary.Row style={{ background: '#fffbe6', fontWeight: 700 }}>
                <Table.Summary.Cell index={0} colSpan={3}>Tổng tiền hàng mới</Table.Summary.Cell>
                <Table.Summary.Cell index={3} />
                <Table.Summary.Cell index={4} />
                <Table.Summary.Cell index={5} align="right">
                  <Text strong style={{ color: '#fa8c16', fontSize: 14 }}>{newTotal.toLocaleString('vi-VN')} đ</Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            )}
            columns={[
              { title: 'LSX', dataIndex: 'so_lenh', width: 120, render: (v: string | null) => v ? <Text code style={{ fontSize: 11 }}>{v}</Text> : '—' },
              { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
              { title: 'ĐVT', dataIndex: 'dvt', width: 55 },
              {
                title: 'Số lượng', width: 120, align: 'right' as const,
                render: (_: unknown, _row: AdjustItem, idx: number) => (
                  <InputNumber
                    size="small" style={{ width: '100%' }} min={0} value={adjustItems[idx].so_luong}
                    onChange={v => setAdjustItems(prev => prev.map((it, i) => i === idx
                      ? { ...it, so_luong: v ?? 0, thanh_tien: (v ?? 0) * it.don_gia }
                      : it))}
                  />
                ),
              },
              {
                title: 'Đơn giá', dataIndex: 'don_gia', width: 130, align: 'right' as const,
                render: (v: number) => <Text type="secondary">{v.toLocaleString('vi-VN')}</Text>,
              },
              {
                title: 'Thành tiền', width: 130, align: 'right' as const,
                render: (_: unknown, _row: AdjustItem, idx: number) => (
                  <Text strong style={{ color: '#52c41a' }}>
                    {adjustItems[idx].thanh_tien.toLocaleString('vi-VN')}
                  </Text>
                ),
              },
            ]}
          />
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="ty_le_vat" label="VAT" rules={[{ required: true }]}>
                <Select options={VAT_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item
                name="ghi_chu_dieu_chinh"
                label="Lý do điều chỉnh"
                rules={[{ required: true, message: 'Bắt buộc nhập lý do' }]}
              >
                <Input.TextArea rows={2} placeholder="Mô tả chi tiết lý do cần điều chỉnh..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Drawer xem chi tiết phiếu xuất kho */}
      <Drawer
        title={deliveryOrder ? `Phiếu xuất: ${deliveryOrder.so_phieu}` : 'Chi tiết phiếu xuất kho'}
        open={showDeliveryDrawer}
        onClose={() => setShowDeliveryDrawer(false)}
        width={800}
        extra={
          deliveryOrder && (
            <Button
              icon={<PrinterOutlined />}
              type="primary"
              onClick={handlePrintInvoice}
            >
              In hóa đơn
            </Button>
          )
        }
      >
        {deliveryOrder ? (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Số phiếu">
                <Text strong>{deliveryOrder.so_phieu}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Ngày xuất">
                {deliveryOrder.ngay_xuat ? dayjs(deliveryOrder.ngay_xuat).format('DD/MM/YYYY') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Khách hàng" span={2}>
                {deliveryOrder.ten_khach ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Địa chỉ giao" span={2}>
                {deliveryOrder.dia_chi_giao ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Người nhận">
                {deliveryOrder.nguoi_nhan ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Kho xuất">
                {deliveryOrder.ten_kho ?? '—'}
              </Descriptions.Item>
              {deliveryOrder.ten_tai_xe && (
                <Descriptions.Item label="Tài xế">
                  {deliveryOrder.ten_tai_xe}
                </Descriptions.Item>
              )}
              {(deliveryOrder.bien_so || deliveryOrder.xe_van_chuyen) && (
                <Descriptions.Item label="Biển số">
                  {deliveryOrder.bien_so ?? deliveryOrder.xe_van_chuyen}
                </Descriptions.Item>
              )}
              {deliveryOrder.ten_lo_xe && (
                <Descriptions.Item label="Lơ xe">
                  {deliveryOrder.ten_lo_xe}
                </Descriptions.Item>
              )}
              {deliveryOrder.so_seal && (
                <Descriptions.Item label="Số Seal">
                  {deliveryOrder.so_seal}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Divider style={{ margin: '4px 0' }}>Danh sách hàng hóa</Divider>
            <Table
              size="small"
              rowKey="id"
              dataSource={deliveryOrder.items ?? []}
              pagination={false}
              columns={[
                { title: 'Lệnh SX', dataIndex: 'so_lenh', width: 130, render: (v: string) => v ? <Text code>{v}</Text> : '—' },
                { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
                { title: 'ĐVT', dataIndex: 'dvt', width: 60 },
                { title: 'Số lượng', dataIndex: 'so_luong', width: 90, align: 'right' as const, render: (v: number) => <Text strong>{v?.toLocaleString('vi-VN')}</Text> },
                { title: 'Đơn giá', dataIndex: 'don_gia', width: 110, align: 'right' as const, render: (v: number) => v ? fmtVND(v) : '—' },
                { title: 'Thành tiền', dataIndex: 'thanh_tien', width: 120, align: 'right' as const, render: (v: number) => v ? fmtVND(v) : '—' },
              ]}
              summary={() => (
                <Table.Summary.Row style={{ fontWeight: 700, background: '#f6ffed' }}>
                  <Table.Summary.Cell index={0} colSpan={3}><Text strong>Tổng cộng</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">
                    {(deliveryOrder.items ?? []).reduce((s: number, it: DeliveryOrderItem) => s + (it.so_luong ?? 0), 0).toLocaleString('vi-VN')}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} />
                  <Table.Summary.Cell index={5} align="right">
                    <Text type="danger" strong>
                      {fmtVND((deliveryOrder.items ?? []).reduce((s: number, it: DeliveryOrderItem) => s + (it.thanh_tien ?? 0), 0))}
                    </Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />
          </Space>
        ) : (
          <Spin />
        )}
      </Drawer>

      {/* Modal upload ảnh phiếu giao */}
      <Modal
        title="Upload ảnh phiếu giao có chữ ký KH"
        open={showPhotoModal}
        onCancel={() => { setShowPhotoModal(false); setPhotoFile(null) }}
        onOk={() => photoFile && photoMut.mutate(photoFile)}
        okText="Upload"
        okButtonProps={{ disabled: !photoFile }}
        confirmLoading={photoMut.isPending}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ width: '100%' }}
            onChange={e => setPhotoFile(e.target.files?.[0] ?? null)}
          />
          {photoFile && (
            <>
              <Text type="secondary">Đã chọn: {photoFile.name}</Text>
              <img
                src={URL.createObjectURL(photoFile)}
                alt="preview"
                style={{ maxWidth: '100%', maxHeight: 240, objectFit: 'contain', borderRadius: 4 }}
              />
            </>
          )}
        </Space>
      </Modal>
    </div>
  )
}
