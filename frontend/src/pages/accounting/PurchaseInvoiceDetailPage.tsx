import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Card, Col, Descriptions, Row, Space, Spin, Table, Tag, Typography,
} from 'antd'
import { ArrowLeftOutlined, PrinterOutlined, WalletOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { fmtVND, printToPdf } from '../../utils/exportUtils'
import {
import EmptyState from "../../components/EmptyState"
  purchaseInvoiceApi, PurchaseInvoice, CashPaymentShort,
} from '../../api/accounting'

const { Title, Text } = Typography

const HINH_THUC_TT_LABEL: Record<string, string> = {
  tien_mat: 'Tiền mặt',
  TM: 'Tiền mặt',
  chuyen_khoan: 'Chuyển khoản',
  CK: 'Chuyển khoản',
  bu_tru_cong_no: 'Bù trừ công nợ',
  khac: 'Khác',
}

const INVOICE_STATUS: Record<string, { label: string; color: string }> = {
  nhap: { label: 'Nháp', color: 'default' },
  da_tt_mot_phan: { label: 'TT một phần', color: 'orange' },
  da_tt_du: { label: 'Đã thanh toán đủ', color: 'green' },
  qua_han: { label: 'Quá hạn', color: 'red' },
  huy: { label: 'Đã hủy', color: 'default' },
}

const PAYMENT_STATUS: Record<string, { label: string; color: string }> = {
  cho_chot: { label: 'Chờ chốt', color: 'default' },
  da_chot: { label: 'Đã chốt', color: 'orange' },
  da_duyet: { label: 'Đã duyệt', color: 'green' },
  huy: { label: 'Đã hủy', color: 'default' },
}

export default function PurchaseInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const invId = Number(id)
  const navigate = useNavigate()

  const { data: invoice, isLoading } = useQuery<PurchaseInvoice>({
    queryKey: ['purchase-invoice', invId],
    queryFn: () => purchaseInvoiceApi.get(invId),
    enabled: !!invId,
  })

  if (isLoading) return <Spin style={{ margin: 40 }} />
  if (!invoice) return <div style={{ padding: 24 }}>Không tìm thấy hóa đơn mua</div>

  const status = INVOICE_STATUS[invoice.trang_thai]
  const conLai = invoice.con_lai ?? 0
  const canCreatePayment = ['nhap', 'da_tt_mot_phan', 'qua_han'].includes(invoice.trang_thai) && conLai > 0

  const paymentCols: ColumnsType<CashPaymentShort> = [
    {
      title: 'Số phiếu',
      dataIndex: 'so_phieu',
      width: 160,
      render: (value, row) => (
        <a onClick={() => navigate(`/accounting/payments/${row.id}`)}>{value}</a>
      ),
    },
    {
      title: 'Ngày phiếu',
      dataIndex: 'ngay_phieu',
      width: 110,
      render: v => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Hình thức',
      dataIndex: 'hinh_thuc_tt',
      width: 140,
      render: v => HINH_THUC_TT_LABEL[v] ?? v,
    },
    {
      title: 'Số tiền',
      dataIndex: 'so_tien',
      align: 'right',
      width: 150,
      render: v => fmtVND(v),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 130,
      render: v => {
        const s = PAYMENT_STATUS[v]
        return <Tag color={s?.color}>{s?.label ?? v}</Tag>
      },
    },
  ]

  const handlePrint = () => {
    const payRows = (invoice.payments ?? []).map((p: CashPaymentShort) => [
      p.so_phieu,
      dayjs(p.ngay_phieu).format('DD/MM/YYYY'),
      HINH_THUC_TT_LABEL[p.hinh_thuc_tt] ?? p.hinh_thuc_tt,
      `<span style="text-align:right;display:block">${fmtVND(p.so_tien)}</span>`,
    ])

    printToPdf(
      `HoaDonMua_${invoice.so_hoa_don ?? invoice.id}`,
      `<h2 style="text-align:center">HÓA ĐƠN MUA HÀNG</h2>
       <p><strong>Số HĐ:</strong> ${invoice.so_hoa_don ?? '-'} &nbsp;&nbsp;
          <strong>Mẫu số:</strong> ${invoice.mau_so ?? '-'} &nbsp;&nbsp;
          <strong>Ký hiệu:</strong> ${invoice.ky_hieu ?? '-'}</p>
       <p><strong>Ngày lập:</strong> ${dayjs(invoice.ngay_lap).format('DD/MM/YYYY')}
          &nbsp;&nbsp; <strong>Hạn TT:</strong> ${invoice.han_tt ? dayjs(invoice.han_tt).format('DD/MM/YYYY') : '-'}</p>
       <p><strong>Nhà cung cấp:</strong> ${invoice.ten_don_vi ?? '-'}
          &nbsp;&nbsp; <strong>MST:</strong> ${invoice.ma_so_thue ?? '-'}</p>
       <hr/>
       <p><strong>Tiền hàng:</strong> ${fmtVND(invoice.tong_tien_hang)}</p>
       <p><strong>Thuế (${invoice.thue_suat}%):</strong> ${fmtVND(invoice.tien_thue)}</p>
       <p><strong>Tổng thanh toán:</strong> <span style="font-size:1.1em;color:#1677ff">${fmtVND(invoice.tong_thanh_toan)}</span></p>
       <p><strong>Đã thanh toán:</strong> ${fmtVND(invoice.da_thanh_toan)} &nbsp;&nbsp; <strong>Còn lại:</strong> ${fmtVND(conLai)}</p>
       ${payRows.length > 0 ? `
       <h4>Phiếu chi đã tạo</h4>
       <table border="1" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:11px">
         <thead><tr><th>Số phiếu</th><th>Ngày</th><th>Hình thức</th><th>Số tiền</th></tr></thead>
         <tbody>${payRows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
       </table>` : ''}
       <p><strong>Ghi chú:</strong> ${invoice.ghi_chu ?? '-'}</p>`,
      false,
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/accounting/purchase-invoices')} />
          <Title level={4} style={{ margin: 0 }}>
            {invoice.so_hoa_don ?? `Hóa đơn mua #${invoice.id}`}
          </Title>
          <Tag color={status?.color}>{status?.label ?? invoice.trang_thai}</Tag>
        </Space>
        <Space>
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>
            In PDF
          </Button>
          {canCreatePayment && (
            <Button
              type="primary"
              icon={<WalletOutlined />}
              onClick={() => navigate(`/accounting/payments/new?invoice_id=${invoice.id}`)}
            >
              Tạo phiếu chi
            </Button>
          )}
        </Space>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="Số hóa đơn">{invoice.so_hoa_don ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Ngày lập">
            {dayjs(invoice.ngay_lap).format('DD/MM/YYYY')}
          </Descriptions.Item>
          <Descriptions.Item label="Mẫu số">{invoice.mau_so ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Ký hiệu">{invoice.ky_hieu ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Hạn thanh toán">
            {invoice.han_tt ? dayjs(invoice.han_tt).format('DD/MM/YYYY') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Thuế suất">{invoice.thue_suat}%</Descriptions.Item>
          <Descriptions.Item label="Nhà cung cấp" span={2}>{invoice.ten_don_vi ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Mã số thuế">{invoice.ma_so_thue ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Ghi chú">{invoice.ghi_chu ?? '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={24}>
          <Col span={8}>
            <Text type="secondary">Tiền hàng</Text>
            <div><Text strong style={{ fontSize: 16 }}>{fmtVND(invoice.tong_tien_hang)}</Text></div>
          </Col>
          <Col span={8}>
            <Text type="secondary">Tiền thuế ({invoice.thue_suat}%)</Text>
            <div><Text strong style={{ fontSize: 16 }}>{fmtVND(invoice.tien_thue)}</Text></div>
          </Col>
          <Col span={8}>
            <Text type="secondary">Tổng thanh toán</Text>
            <div><Text strong style={{ fontSize: 18, color: '#1677ff' }}>{fmtVND(invoice.tong_thanh_toan)}</Text></div>
          </Col>
          <Col span={8} style={{ marginTop: 12 }}>
            <Text type="secondary">Đã thanh toán</Text>
            <div><Text strong style={{ fontSize: 16, color: '#52c41a' }}>{fmtVND(invoice.da_thanh_toan)}</Text></div>
          </Col>
          <Col span={8} style={{ marginTop: 12 }}>
            <Text type="secondary">Còn lại</Text>
            <div>
              <Text strong style={{ fontSize: 16, color: conLai > 0 ? '#f5222d' : '#52c41a' }}>
                {fmtVND(conLai)}
              </Text>
            </div>
          </Col>
        </Row>
      </Card>

      <Card size="small" title="Phiếu chi đã tạo">
        <Table
          columns={paymentCols}
          dataSource={invoice.payments ?? []}
          rowKey="id"
          size="small"
          pagination={false}
          locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
        />
      </Card>
    </div>
  )
}
