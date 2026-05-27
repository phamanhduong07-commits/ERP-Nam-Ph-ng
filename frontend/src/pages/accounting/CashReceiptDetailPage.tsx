import { useNavigate, useParams } from 'react-router-dom'
import type { ApiError } from '../../api/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Descriptions, Modal, Space, Spin, Tag, Typography, message,
} from 'antd'
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, PrinterOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import namPhuongLogo from '../../assets/nam-phuong-logo-cropped.png'
import { fmtVND, numberToVietnameseWords, smartPrintPdf } from '../../utils/exportUtils'
import { receiptApi, CashReceipt, TRANG_THAI_PHIEU_THU, HINH_THUC_TT } from '../../api/accounting'
import { usePhapNhanForPrint } from '../../hooks/usePhapNhan'
import { systemApi } from '../../api/system'

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

  const { data: template } = useQuery({
    queryKey: ['print-template', 'CASH_RECEIPT', receipt?.phap_nhan_id],
    queryFn: () => systemApi.getTemplate('CASH_RECEIPT', receipt?.phap_nhan_id ?? undefined, true),
    staleTime: 5 * 60 * 1000,
    enabled: !!receipt,
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
    onError: (e: Error & { response?: { data?: { detail?: string } } }) => message.error((e as ApiError)?.response?.data?.detail ?? 'Lỗi duyệt'),
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
    onError: (e: Error & { response?: { data?: { detail?: string } } }) => message.error((e as ApiError)?.response?.data?.detail ?? 'Lỗi hủy'),
  })

  const companyInfo = usePhapNhanForPrint(receipt?.phap_nhan_id)

  if (isLoading) return <Spin style={{ margin: 40 }} />
  if (!receipt) return <div style={{ padding: 24 }}>Không tìm thấy phiếu thu</div>
  const status = TRANG_THAI_PHIEU_THU[receipt.trang_thai]
  const canApprove = receipt.trang_thai === 'cho_duyet'
  const canCancel = receipt.trang_thai !== 'huy'

  const handlePrint = () => {
    const customerName = receipt.ten_don_vi ?? `KH #${receipt.customer_id}`
    const payMethodLabel = HINH_THUC_TT[receipt.hinh_thuc_tt] ?? receipt.hinh_thuc_tt
    
    const printData = {
      document_number: receipt.so_phieu || '-',
      document_date: dayjs(receipt.ngay_phieu).format('DD/MM/YYYY'),
      nguoi_nop: customerName,
      khach_hang: customerName,
      ly_do_thu: receipt.dien_giai ?? '—',
      so_tien: `${fmtVND(receipt.so_tien)} đ`,
      so_tien_bang_chu: numberToVietnameseWords(receipt.so_tien),
      // Phụ trợ
      hinh_thuc_tt: payMethodLabel,
      so_tai_khoan: receipt.so_tai_khoan ?? '-',
      so_tham_chieu: receipt.so_tham_chieu ?? '-',
      sales_invoice_id: receipt.sales_invoice_id ?? '-',
      subtitle: 'PHIẾU THU',
    }

    smartPrintPdf('CASH_RECEIPT', printData, receipt.phap_nhan_id ?? undefined)
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
