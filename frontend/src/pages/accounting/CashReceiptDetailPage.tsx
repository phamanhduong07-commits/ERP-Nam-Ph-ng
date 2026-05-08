import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Descriptions, Modal, Space, Spin, Tag, Typography, message,
} from 'antd'
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, PrinterOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import namPhuongLogo from '../../assets/nam-phuong-logo-cropped.png'
import { fmtVND, printDocument } from '../../utils/exportUtils'
import { receiptApi, CashReceipt, TRANG_THAI_PHIEU_THU, HINH_THUC_TT } from '../../api/accounting'
import { usePhapNhanForPrint } from '../../hooks/usePhapNhan'

const { Title } = Typography

export default function CashReceiptDetailPage() {
  const { id } = useParams<{ id: string }>()
  const receiptId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: receipt, isLoading } = useQuery<CashReceipt>({
    queryKey: ['receipt', receiptId],
    queryFn: () => receiptApi.get(receiptId),
    enabled: !!receiptId,
  })

  const approveMut = useMutation({
    mutationFn: () => receiptApi.approve(receiptId),
    onSuccess: () => {
      message.success('Đã duyệt phiếu thu')
      qc.invalidateQueries({ queryKey: ['receipt', receiptId] })
      qc.invalidateQueries({ queryKey: ['receipts'] })
      qc.invalidateQueries({ queryKey: ['ar-ledger-entries'] })
      qc.invalidateQueries({ queryKey: ['ar-ledger'] })
      qc.invalidateQueries({ queryKey: ['ar-aging'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi duyệt'),
  })

  const cancelMut = useMutation({
    mutationFn: () => receiptApi.cancel(receiptId),
    onSuccess: () => {
      message.success('Đã hủy phiếu thu')
      qc.invalidateQueries({ queryKey: ['receipt', receiptId] })
      qc.invalidateQueries({ queryKey: ['receipts'] })
      qc.invalidateQueries({ queryKey: ['ar-ledger-entries'] })
      qc.invalidateQueries({ queryKey: ['ar-ledger'] })
      qc.invalidateQueries({ queryKey: ['ar-aging'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? 'Lỗi hủy'),
  })

  if (isLoading) return <Spin style={{ margin: 40 }} />
  if (!receipt) return <div style={{ padding: 24 }}>Không tìm thấy phiếu thu</div>

  const companyInfo = usePhapNhanForPrint()
  const status = TRANG_THAI_PHIEU_THU[receipt.trang_thai]
  const canApprove = receipt.trang_thai === 'cho_duyet'
  const canCancel = receipt.trang_thai !== 'huy'

  const handlePrint = () => {
    printDocument({
      companyInfo,
      title: `Phiếu thu ${receipt.so_phieu}`,
      subtitle: 'PHIẾU THU',
      logoUrl: namPhuongLogo,
      documentNumber: receipt.so_phieu || '—',
      documentDate: dayjs(receipt.ngay_phieu).format('DD/MM/YYYY'),
      status: status?.label ?? receipt.trang_thai,
      fields: [
        { label: 'Hình thức TT', value: HINH_THUC_TT[receipt.hinh_thuc_tt] ?? receipt.hinh_thuc_tt },
        { label: 'Số tiền', value: fmtVND(receipt.so_tien) },
        { label: 'Số tài khoản', value: receipt.so_tai_khoan ?? '—' },
        { label: 'Số tham chiếu', value: receipt.so_tham_chieu ?? '—' },
        { label: 'TK Nợ', value: receipt.tk_no ?? '—' },
        { label: 'TK Có', value: receipt.tk_co ?? '—' },
      ],
      bodyHtml: `<div style="margin-bottom: 14px;"><strong>Diễn giải:</strong><div style="margin-top: 6px; font-size: 12px;">${receipt.dien_giai ? receipt.dien_giai.replace(/\n/g, '<br/>') : '—'}</div></div>
        ${receipt.sales_invoice_id ? `<div style="font-size: 12px; color: #1b168e;">Hóa đơn liên kết: ${receipt.sales_invoice_id}</div>` : ''}`,
      footerHtml: `
        <div><strong>Ngày tạo:</strong> ${dayjs(receipt.created_at).format('DD/MM/YYYY HH:mm')}</div>
        ${receipt.ngay_duyet ? `<div><strong>Ngày duyệt:</strong> ${dayjs(receipt.ngay_duyet).format('DD/MM/YYYY HH:mm')}</div>` : ''}
      `,
    })
  }

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/accounting/receipts')} />
          <Title level={4} style={{ margin: 0 }}>{receipt.so_phieu}</Title>
          <Tag color={status?.color}>{status?.label ?? receipt.trang_thai}</Tag>
        </Space>
        <Space>
          {canApprove && (
            <Button
              type="primary" icon={<CheckOutlined />}
              loading={approveMut.isPending}
              onClick={() => Modal.confirm({
                title: 'Duyệt phiếu thu?',
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
                title: 'Hủy phiếu thu?',
                content: 'Số tiền đã ghi nhận trên hóa đơn sẽ bị hoàn lại.',
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
            In/PDF phiếu thu
          </Button>
        </Space>
      </div>

      <Card size="small">
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="Số phiếu">{receipt.so_phieu}</Descriptions.Item>
          <Descriptions.Item label="Ngày phiếu">
            {dayjs(receipt.ngay_phieu).format('DD/MM/YYYY')}
          </Descriptions.Item>
          <Descriptions.Item label="Hình thức TT">
            {HINH_THUC_TT[receipt.hinh_thuc_tt] ?? receipt.hinh_thuc_tt}
          </Descriptions.Item>
          <Descriptions.Item label="Số tiền">
            <strong style={{ color: '#52c41a', fontSize: 16 }}>{fmtVND(receipt.so_tien)}</strong>
          </Descriptions.Item>
          <Descriptions.Item label="Số tài khoản">{receipt.so_tai_khoan ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Số tham chiếu">{receipt.so_tham_chieu ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="TK Nợ">{receipt.tk_no}</Descriptions.Item>
          <Descriptions.Item label="TK Có">{receipt.tk_co}</Descriptions.Item>
          <Descriptions.Item label="Diễn giải" span={2}>{receipt.dien_giai ?? '—'}</Descriptions.Item>
          {receipt.sales_invoice_id && (
            <Descriptions.Item label="Hóa đơn liên kết" span={2}>
              <a onClick={() => navigate(`/billing/invoices/${receipt.sales_invoice_id}`)}>
                Xem hóa đơn #{receipt.sales_invoice_id}
              </a>
            </Descriptions.Item>
          )}
          {receipt.ngay_duyet && (
            <Descriptions.Item label="Ngày duyệt">
              {dayjs(receipt.ngay_duyet).format('DD/MM/YYYY HH:mm')}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Ngày tạo">
            {dayjs(receipt.created_at).format('DD/MM/YYYY HH:mm')}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  )
}
