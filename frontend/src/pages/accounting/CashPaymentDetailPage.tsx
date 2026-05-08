import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Descriptions, Modal, Space, Spin, Tag, Typography, message,
} from 'antd'
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, PrinterOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import namPhuongLogo from '../../assets/nam-phuong-logo-cropped.png'
import { fmtVND, printDocument } from '../../utils/exportUtils'
import { paymentApi, CashPayment, TRANG_THAI_PHIEU_CHI, HINH_THUC_TT } from '../../api/accounting'
import { usePhapNhanForPrint } from '../../hooks/usePhapNhan'

const { Title } = Typography

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

  const approveMut = useMutation({
    mutationFn: () => paymentApi.approve(paymentId),
    onSuccess: () => {
      message.success('Đã duyệt phiếu chi')
      qc.invalidateQueries({ queryKey: ['payment', paymentId] })
      qc.invalidateQueries({ queryKey: ['payments'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi duyệt'),
  })

  const cancelMut = useMutation({
    mutationFn: () => paymentApi.cancel(paymentId),
    onSuccess: () => {
      message.success('Đã hủy phiếu chi')
      qc.invalidateQueries({ queryKey: ['payment', paymentId] })
      qc.invalidateQueries({ queryKey: ['payments'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi hủy'),
  })

  if (isLoading) return <Spin style={{ margin: 40 }} />
  if (!payment) return <div style={{ padding: 24 }}>Không tìm thấy phiếu chi</div>

  const companyInfo = usePhapNhanForPrint()
  const status = TRANG_THAI_PHIEU_CHI[payment.trang_thai]
  const canApprove = ['cho_chot', 'da_chot'].includes(payment.trang_thai)
  const canCancel = payment.trang_thai !== 'huy'

  const handlePrint = () => {
    printDocument({
      title: `Phiếu chi ${payment.so_phieu}`,
      subtitle: 'PHIẾU CHI',
      logoUrl: namPhuongLogo,
      companyInfo,
      documentNumber: payment.so_phieu || '—',
      documentDate: dayjs(payment.ngay_phieu).format('DD/MM/YYYY'),
      status: status?.label ?? payment.trang_thai,
      fields: [
        { label: 'Hình thức TT', value: HINH_THUC_TT[payment.hinh_thuc_tt] ?? payment.hinh_thuc_tt },
        { label: 'Số tiền', value: fmtVND(payment.so_tien) },
        { label: 'Số tài khoản', value: payment.so_tai_khoan ?? '—' },
        { label: 'Số tham chiếu', value: payment.so_tham_chieu ?? '—' },
        { label: 'TK Nợ', value: payment.tk_no ?? '—' },
        { label: 'TK Có', value: payment.tk_co ?? '—' },
      ],
      bodyHtml: `<div style="margin-bottom: 14px;"><strong>Diễn giải:</strong><div style="margin-top: 6px; font-size: 12px;">${payment.dien_giai ? payment.dien_giai.replace(/\n/g, '<br/>') : '—'}</div></div>
        ${payment.purchase_invoice_id ? `<div style="font-size: 12px; color: #1b168e;">Hóa đơn mua liên kết: ${payment.purchase_invoice_id}</div>` : ''}`,
      footerHtml: `
        <div><strong>Ngày tạo:</strong> ${dayjs(payment.created_at).format('DD/MM/YYYY HH:mm')}</div>
        ${payment.ngay_duyet ? `<div><strong>Ngày duyệt:</strong> ${dayjs(payment.ngay_duyet).format('DD/MM/YYYY HH:mm')}</div>` : ''}
      `,
    })
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
              type="primary" icon={<CheckOutlined />}
              loading={approveMut.isPending}
              onClick={() => Modal.confirm({
                title: 'Duyệt phiếu chi?',
                onOk: () => approveMut.mutate(),
              })}
            >
              Duyệt
            </Button>
          )}
          {canCancel && (
            <Button
              danger icon={<CloseOutlined />}
              loading={cancelMut.isPending}
              onClick={() => Modal.confirm({
                title: 'Hủy phiếu chi?',
                content: 'Số tiền đã ghi nhận trên hóa đơn mua sẽ bị hoàn lại.',
                okType: 'danger',
                onOk: () => cancelMut.mutate(),
              })}
            >
              Hủy
            </Button>
          )}
          <Button
            icon={<PrinterOutlined />}
            onClick={handlePrint}
          >
            In/PDF phiếu chi
          </Button>
        </Space>
      </div>

      <Card size="small">
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="Số phiếu">{payment.so_phieu}</Descriptions.Item>
          <Descriptions.Item label="Ngày phiếu">
            {dayjs(payment.ngay_phieu).format('DD/MM/YYYY')}
          </Descriptions.Item>
          <Descriptions.Item label="Hình thức TT">
            {HINH_THUC_TT[payment.hinh_thuc_tt] ?? payment.hinh_thuc_tt}
          </Descriptions.Item>
          <Descriptions.Item label="Số tiền">
            <strong style={{ color: '#f5222d', fontSize: 16 }}>{fmtVND(payment.so_tien)}</strong>
          </Descriptions.Item>
          <Descriptions.Item label="Số tài khoản">{payment.so_tai_khoan ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Số tham chiếu">{payment.so_tham_chieu ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="TK Nợ">{payment.tk_no}</Descriptions.Item>
          <Descriptions.Item label="TK Có">{payment.tk_co}</Descriptions.Item>
          <Descriptions.Item label="Diễn giải" span={2}>{payment.dien_giai ?? '—'}</Descriptions.Item>
          {payment.purchase_invoice_id && (
            <Descriptions.Item label="HĐ mua liên kết" span={2}>
              <a onClick={() => navigate(`/accounting/purchase-invoices/${payment.purchase_invoice_id}`)}>
                Xem hóa đơn #{payment.purchase_invoice_id}
              </a>
            </Descriptions.Item>
          )}
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
