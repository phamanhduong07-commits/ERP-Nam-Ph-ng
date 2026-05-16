import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Descriptions, Modal, Space, Spin, Tag, Typography, message,
} from 'antd'
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, PrinterOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { fmtVND, numberToVietnameseWords, printDocument, smartPrintPdf } from '../../utils/exportUtils'
import { paymentApi, CashPayment } from '../../api/accounting'
import { usePhapNhanForPrint } from '../../hooks/usePhapNhan'
import { systemApi } from '../../api/system'

const { Title } = Typography

const HINH_THUC_TT_LABEL: Record<string, string> = {
  tien_mat: 'Tiền mặt',
  TM: 'Tiền mặt',
  chuyen_khoan: 'Chuyển khoản',
  CK: 'Chuyển khoản',
  bu_tru_cong_no: 'Bù trừ công nợ',
  khac: 'Khác',
}

const PAYMENT_STATUS: Record<string, { label: string; color: string }> = {
  cho_chot: { label: 'Chờ chốt', color: 'default' },
  da_chot: { label: 'Đã chốt', color: 'orange' },
  da_duyet: { label: 'Đã duyệt', color: 'green' },
  huy: { label: 'Đã hủy', color: 'default' },
}

const DEFAULT_CASH_PAYMENT_TEMPLATE = `
<style>
  @page { size: A5 portrait; margin: 10mm; }
  body { font-family: Arial, sans-serif; color: #111; }
  .cp-header { display: grid; grid-template-columns: 80px 1fr 150px; gap: 10px; align-items: start; }
  .cp-logo img { width: 68px; max-height: 56px; object-fit: contain; }
  .cp-company { font-size: 11px; line-height: 1.45; }
  .cp-meta { font-size: 11px; line-height: 1.55; }
  .cp-title { text-align: center; margin: 14px 0 12px; }
  .cp-title h1 { margin: 0; font-size: 22px; letter-spacing: 0; }
  .cp-title div { margin-top: 4px; font-size: 11px; }
  .cp-row { display: grid; grid-template-columns: 118px 1fr; gap: 8px; margin: 7px 0; font-size: 12px; }
  .cp-label { font-weight: 700; }
  .cp-money { font-size: 15px; font-weight: 700; }
  .cp-sign { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 26px; text-align: center; font-size: 11px; }
  .cp-sign strong { display: block; margin-bottom: 4px; }
</style>
<div class="cp-header">
  <div class="cp-logo">{{logo_img}}</div>
  <div class="cp-company">
    <strong>{{company_name}}</strong><br/>
    {{company_details}}
  </div>
  <div class="cp-meta">
    <strong>Số:</strong> {{document_number}}<br/>
    <strong>Ngày:</strong> {{document_date}}<br/>
    <strong>Trạng thái:</strong> {{status}}
  </div>
</div>
<div class="cp-title">
  <h1>PHIẾU CHI</h1>
  <div>Thanh toán công nợ nhà cung cấp</div>
</div>
<div class="cp-row"><div class="cp-label">Người nhận:</div><div>{{nguoi_nhan}}</div></div>
<div class="cp-row"><div class="cp-label">Nhà cung cấp:</div><div>{{nha_cung_cap}}</div></div>
<div class="cp-row"><div class="cp-label">Lý do chi:</div><div>{{ly_do_chi}}</div></div>
<div class="cp-row"><div class="cp-label">Hóa đơn mua:</div><div>{{so_hoa_don}}</div></div>
<div class="cp-row"><div class="cp-label">Hình thức TT:</div><div>{{hinh_thuc_tt}}</div></div>
<div class="cp-row"><div class="cp-label">Số tài khoản:</div><div>{{so_tai_khoan}}</div></div>
<div class="cp-row"><div class="cp-label">Số tham chiếu:</div><div>{{so_tham_chieu}}</div></div>
<div class="cp-row"><div class="cp-label">Số tiền:</div><div class="cp-money">{{so_tien}}</div></div>
<div class="cp-row"><div class="cp-label">Bằng chữ:</div><div><em>{{so_tien_bang_chu}}</em></div></div>
<div class="cp-sign">
  <div><strong>Giám đốc</strong><span>(Ký, họ tên)</span></div>
  <div><strong>Kế toán trưởng</strong><span>(Ký, họ tên)</span></div>
  <div><strong>Thủ quỹ</strong><span>(Ký, họ tên)</span></div>
  <div><strong>Người nhận</strong><span>(Ký, họ tên)</span></div>
</div>
`

export default function CashPaymentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const paymentId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: payment, isLoading } = useQuery<CashPayment>({
    queryKey: ['payment', paymentId],
    queryFn: () => paymentApi.get(paymentId),
    enabled: !!paymentId,
  })

  const { data: template } = useQuery({
    queryKey: ['print-template', 'CASH_PAYMENT', payment?.phap_nhan_id],
    queryFn: () => systemApi.getTemplate('CASH_PAYMENT', payment?.phap_nhan_id ?? undefined, true),
    staleTime: 5 * 60 * 1000,
    enabled: !!payment,
    retry: false,
  })

  const approveMut = useMutation({
    mutationFn: () => paymentApi.approve(paymentId),
    onSuccess: () => {
      message.success('Đã duyệt phiếu chi')
      qc.invalidateQueries({ queryKey: ['payment', paymentId] })
      qc.invalidateQueries({ queryKey: ['payments'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi duyệt phiếu chi'),
  })

  const cancelMut = useMutation({
    mutationFn: () => paymentApi.cancel(paymentId),
    onSuccess: () => {
      message.success('Đã hủy phiếu chi')
      qc.invalidateQueries({ queryKey: ['payment', paymentId] })
      qc.invalidateQueries({ queryKey: ['payments'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi hủy phiếu chi'),
  })

  const companyInfo = usePhapNhanForPrint(payment?.phap_nhan_id)

  if (isLoading) return <Spin style={{ margin: 40 }} />
  if (!payment) return <div style={{ padding: 24 }}>Không tìm thấy phiếu chi</div>

  const status = PAYMENT_STATUS[payment.trang_thai]
  const canApprove = ['cho_chot', 'da_chot'].includes(payment.trang_thai)
  const canCancel = payment.trang_thai !== 'huy'
  const supplierName = payment.ten_don_vi ?? `NCC #${payment.supplier_id}`
  const invoiceLabel = payment.so_hoa_don ?? (payment.purchase_invoice_id ? `HĐ mua #${payment.purchase_invoice_id}` : 'Không gắn hóa đơn')
  const payMethodLabel = HINH_THUC_TT_LABEL[payment.hinh_thuc_tt] ?? payment.hinh_thuc_tt
  const paymentReason = payment.dien_giai || `Thanh toán ${invoiceLabel} cho ${supplierName}`

  const handlePrint = () => {
    const printData = {
      document_number: payment.so_phieu || '-',
      document_date: dayjs(payment.ngay_phieu).format('DD/MM/YYYY'),
      nguoi_nhan: supplierName,
      nha_cung_cap: supplierName,
      so_tien: `${fmtVND(payment.so_tien)} đ`,
      so_tien_bang_chu: numberToVietnameseWords(payment.so_tien),
      // Các biến bổ sung nếu template có dùng
      hinh_thuc_tt: payMethodLabel,
      so_tai_khoan: payment.so_tai_khoan ?? '-',
      so_tham_chieu: payment.so_tham_chieu ?? '-',
      so_hoa_don: invoiceLabel,
      ly_do_chi: paymentReason,
      subtitle: 'PHIẾU CHI',
    }

    smartPrintPdf('CASH_PAYMENT', printData, payment.phap_nhan_id ?? undefined)
  }

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/accounting/payments')} />
          <Title level={4} style={{ margin: 0 }}>{payment.so_phieu}</Title>
          <Tag color={status?.color}>{status?.label ?? payment.trang_thai}</Tag>
        </Space>
        <Space>
          {canApprove && (
            <Button
              type="primary"
              icon={<CheckOutlined />}
              loading={approveMut.isPending}
              onClick={() => Modal.confirm({
                title: 'Duyệt phiếu chi?',
                okText: 'Duyệt',
                cancelText: 'Đóng',
                onOk: () => approveMut.mutate(),
              })}
            >
              Duyệt
            </Button>
          )}
          {canCancel && (
            <Button
              danger
              icon={<CloseOutlined />}
              loading={cancelMut.isPending}
              onClick={() => Modal.confirm({
                title: 'Hủy phiếu chi?',
                content: 'Số tiền đã ghi nhận trên hóa đơn mua sẽ được hoàn lại.',
                okText: 'Hủy phiếu',
                cancelText: 'Đóng',
                okType: 'danger',
                onOk: () => cancelMut.mutate(),
              })}
            >
              Hủy
            </Button>
          )}
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>
            In phiếu chi
          </Button>
        </Space>
      </div>

      <Card size="small">
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="Số phiếu">{payment.so_phieu}</Descriptions.Item>
          <Descriptions.Item label="Ngày phiếu">
            {dayjs(payment.ngay_phieu).format('DD/MM/YYYY')}
          </Descriptions.Item>
          <Descriptions.Item label="Nhà cung cấp" span={2}>{supplierName}</Descriptions.Item>
          <Descriptions.Item label="Hóa đơn mua" span={2}>
            {payment.purchase_invoice_id ? (
              <a onClick={() => navigate(`/accounting/purchase-invoices/${payment.purchase_invoice_id}`)}>
                {invoiceLabel}
              </a>
            ) : invoiceLabel}
          </Descriptions.Item>
          <Descriptions.Item label="Hình thức TT">{payMethodLabel}</Descriptions.Item>
          <Descriptions.Item label="Số tiền">
            <strong style={{ color: '#f5222d', fontSize: 16 }}>{fmtVND(payment.so_tien)}</strong>
          </Descriptions.Item>
          <Descriptions.Item label="Bằng chữ" span={2}>
            {numberToVietnameseWords(payment.so_tien)}
          </Descriptions.Item>
          <Descriptions.Item label="Số tài khoản">{payment.so_tai_khoan ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Số tham chiếu">{payment.so_tham_chieu ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="TK Nợ">{payment.tk_no}</Descriptions.Item>
          <Descriptions.Item label="TK Có">{payment.tk_co}</Descriptions.Item>
          <Descriptions.Item label="Lý do chi" span={2}>{paymentReason}</Descriptions.Item>
          {payment.ngay_duyet && (
            <Descriptions.Item label="Ngày duyệt">
              {dayjs(payment.ngay_duyet).format('DD/MM/YYYY HH:mm')}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Ngày tạo">
            {dayjs(payment.created_at).format('DD/MM/YYYY HH:mm')}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  )
}
