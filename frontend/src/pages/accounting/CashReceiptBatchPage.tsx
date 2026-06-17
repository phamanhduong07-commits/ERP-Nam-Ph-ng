import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Button, Card, Checkbox, Col, DatePicker, Input, InputNumber, Row,
  Select, Space, Table, Tag, Typography, message,
} from 'antd'
import { ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined, SendOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { fmtVND } from '../../utils/exportUtils'
import { receiptApi, HINH_THUC_TT, BatchReceiptItem, BatchReceiptResponse } from '../../api/accounting'
import { billingApi, SalesInvoiceListItem } from '../../api/billing'
import { usePhapNhan, usePhanXuong } from '../../hooks/useMasterData'
import PageLayout from '../../components/PageLayout'
import EmptyState from '../../components/EmptyState'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Text, Title } = Typography

interface RowState {
  selected: boolean
  so_tien: number
  hinh_thuc_tt: string
  dien_giai: string
}

export default function CashReceiptBatchPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { phapNhanList } = usePhapNhan()
  const { phanXuongList } = usePhanXuong()

  const [ngayPhieu, setNgayPhieu] = useState<string>(dayjs().format('YYYY-MM-DD'))
  const [phapNhanId, setPhapNhanId] = useState<number | undefined>()
  const [phanXuongId, setPhanXuongId] = useState<number | undefined>()
  const [soTaiKhoan, setSoTaiKhoan] = useState<string>('')
  const [defaultHttt, setDefaultHttt] = useState<string>('chuyen_khoan')
  const [rowStates, setRowStates] = useState<Record<number, RowState>>({})
  const [result, setResult] = useState<BatchReceiptResponse | null>(null)

  const { data: invoiceData, isLoading } = useQuery({
    queryKey: ['invoices-unpaid-all', phapNhanId],
    queryFn: () =>
      billingApi.listInvoices({
        trang_thai: 'da_phat_hanh,da_tt_mot_phan,qua_han',
        phap_nhan_id: phapNhanId,
        page_size: 200,
      }),
  })

  const invoices: SalesInvoiceListItem[] = useMemo(() => {
    const items = invoiceData?.items ?? []
    return items.filter((i: SalesInvoiceListItem) =>
      ['da_phat_hanh', 'da_tt_mot_phan', 'qua_han'].includes(i.trang_thai) && i.con_lai > 0
    )
  }, [invoiceData])

  const getRow = (inv: SalesInvoiceListItem): RowState =>
    rowStates[inv.id] ?? {
      selected: false,
      so_tien: inv.con_lai,
      hinh_thuc_tt: defaultHttt,
      dien_giai: `Thu tiền HĐ ${inv.so_hoa_don ?? `#${inv.id}`}`,
    }

  const setRow = (id: number, patch: Partial<RowState>) =>
    setRowStates(prev => ({ ...prev, [id]: { ...getRow({ id } as SalesInvoiceListItem), ...patch } }))

  const selectedInvoices = invoices.filter(i => getRow(i).selected)
  const tongThu = selectedInvoices.reduce((s, i) => s + (getRow(i).so_tien ?? 0), 0)

  const handleSelectAll = (checked: boolean) => {
    const patch: Record<number, RowState> = {}
    invoices.forEach(i => {
      patch[i.id] = { ...getRow(i), selected: checked }
    })
    setRowStates(prev => ({ ...prev, ...patch }))
  }

  const applyDefaultHttt = (httt: string) => {
    setDefaultHttt(httt)
    setRowStates(prev => {
      const next = { ...prev }
      invoices.forEach(i => {
        next[i.id] = { ...getRow(i), hinh_thuc_tt: httt }
      })
      return next
    })
  }

  const batchMut = useMutation({
    mutationFn: () => {
      const items: BatchReceiptItem[] = selectedInvoices.map(inv => {
        const row = getRow(inv)
        return {
          customer_id: inv.customer_id,
          sales_invoice_id: inv.id,
          so_tien: row.so_tien,
          hinh_thuc_tt: row.hinh_thuc_tt,
          dien_giai: row.dien_giai,
        }
      })
      return receiptApi.batch({
        ngay_phieu: ngayPhieu,
        phap_nhan_id: phapNhanId ?? null,
        phan_xuong_id: phanXuongId ?? null,
        so_tai_khoan: soTaiKhoan || undefined,
        items,
      })
    },
    onSuccess: res => {
      setResult(res)
      qc.invalidateQueries({ queryKey: ['receipts'] })
      qc.invalidateQueries({ queryKey: ['invoices-unpaid-all'] })
      if (res.that_bai === 0) {
        message.success(`Tạo thành công ${res.thanh_cong} phiếu thu`)
      } else {
        message.warning(`${res.thanh_cong} thành công, ${res.that_bai} lỗi`)
      }
    },
    onError: () => message.error('Có lỗi xảy ra'),
  })

  const TRANG_THAI_COLOR: Record<string, string> = {
    da_phat_hanh: 'blue',
    da_tt_mot_phan: 'orange',
    qua_han: 'red',
  }
  const TRANG_THAI_LABEL: Record<string, string> = {
    da_phat_hanh: 'Chưa TT',
    da_tt_mot_phan: 'TT 1 phần',
    qua_han: 'Quá hạn',
  }

  const columns: ColumnsType<SalesInvoiceListItem> = [
    {
      title: (
        <Checkbox
          checked={invoices.length > 0 && invoices.every(i => getRow(i).selected)}
          indeterminate={invoices.some(i => getRow(i).selected) && !invoices.every(i => getRow(i).selected)}
          onChange={e => handleSelectAll(e.target.checked)}
        />
      ),
      width: 40,
      render: (_, inv) => (
        <Checkbox
          checked={getRow(inv).selected}
          onChange={e => setRow(inv.id, { selected: e.target.checked })}
        />
      ),
    },
    {
      title: 'Hóa đơn',
      dataIndex: 'so_hoa_don',
      width: 140,
      render: (v, r) => (
        <a onClick={() => navigate(`/billing/invoices/${r.id}`)}>{v ?? `HĐ#${r.id}`}</a>
      ),
    },
    {
      title: 'Ngày HĐ',
      dataIndex: 'ngay_hoa_don',
      width: 100,
      render: v => dayjs(v).format('DD/MM/YY'),
    },
    {
      title: 'Khách hàng',
      dataIndex: 'ten_don_vi',
      ellipsis: true,
    },
    {
      title: 'Tổng HĐ',
      dataIndex: 'tong_cong',
      align: 'right',
      width: 130,
      render: v => fmtVND(v),
    },
    {
      title: 'Còn lại',
      dataIndex: 'con_lai',
      align: 'right',
      width: 130,
      render: v => <Text style={{ color: '#fa8c16' }}>{fmtVND(v)}</Text>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 100,
      render: v => <Tag color={TRANG_THAI_COLOR[v]}>{TRANG_THAI_LABEL[v] ?? v}</Tag>,
    },
    {
      title: 'Số tiền thu',
      width: 145,
      align: 'right' as const,
      render: (_, inv) => (
        <InputNumber
          size="small"
          style={{ width: '100%' }}
          min={0}
          max={inv.con_lai}
          value={getRow(inv).so_tien}
          disabled={!getRow(inv).selected}
          formatter={v => v ? Number(v).toLocaleString('vi-VN') : ''}
          parser={v => Number((v ?? '').replace(/\D/g, ''))}
          onChange={val => setRow(inv.id, { so_tien: val ?? 0 })}
          variant={getRow(inv).selected ? 'outlined' : 'borderless'}
        />
      ),
    },
    {
      title: 'Hình thức',
      width: 115,
      render: (_, inv) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          value={getRow(inv).hinh_thuc_tt}
          disabled={!getRow(inv).selected}
          options={[
            { value: 'chuyen_khoan', label: 'CK' },
            { value: 'tien_mat', label: 'TM' },
            { value: 'bu_tru_cong_no', label: 'Bù trừ' },
          ]}
          onChange={val => setRow(inv.id, { hinh_thuc_tt: val })}
        />
      ),
    },
    {
      title: 'Diễn giải',
      width: 180,
      render: (_, inv) => (
        <Input
          size="small"
          value={getRow(inv).dien_giai}
          onChange={e => setRow(inv.id, { dien_giai: e.target.value })}
          disabled={!getRow(inv).selected}
          variant={getRow(inv).selected ? 'outlined' : 'borderless'}
        />
      ),
    },
    {
      title: 'TK Phải thu',
      width: 85,
      align: 'center' as const,
      render: () => <Text type="secondary">131</Text>,
    },
  ]
  const { displayColumns, settingsButton } = useColumnPrefs('accounting-cash-receipt-batch', columns)

  return (
    <PageLayout
      title="Thu tiền theo hóa đơn nhiều khách hàng"
      actions={
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/accounting/receipts')}>
            Quay lại
          </Button>
          <Button
            type="primary"
            icon={<SendOutlined />}
            disabled={selectedInvoices.length === 0}
            loading={batchMut.isPending}
            onClick={() => batchMut.mutate()}
          >
            Tạo {selectedInvoices.length} phiếu thu
          </Button>
          {settingsButton}
        </Space>
      }
    >
      {/* Cài đặt chung */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[16, 8]} align="middle">
          <Col>
            <Text type="secondary" style={{ marginRight: 8 }}>Ngày phiếu:</Text>
            <DatePicker
              format="DD/MM/YYYY"
              value={dayjs(ngayPhieu)}
              onChange={v => setNgayPhieu(v?.format('YYYY-MM-DD') ?? dayjs().format('YYYY-MM-DD'))}
            />
          </Col>
          <Col>
            <Text type="secondary" style={{ marginRight: 8 }}>Pháp nhân:</Text>
            <Select
              style={{ width: 180 }}
              allowClear
              placeholder="Tất cả pháp nhân"
              onChange={v => setPhapNhanId(v)}
              options={phapNhanList.map(p => ({ value: p.id, label: p.ten_phap_nhan }))}
            />
          </Col>
          <Col>
            <Text type="secondary" style={{ marginRight: 8 }}>Xưởng:</Text>
            <Select
              style={{ width: 150 }}
              allowClear
              placeholder="Tất cả xưởng"
              onChange={v => setPhanXuongId(v)}
              options={phanXuongList.map(x => ({ value: x.id, label: x.ten_xuong }))}
            />
          </Col>
          <Col>
            <Text type="secondary" style={{ marginRight: 8 }}>Hình thức mặc định:</Text>
            <Select
              style={{ width: 140 }}
              value={defaultHttt}
              onChange={applyDefaultHttt}
              options={Object.entries(HINH_THUC_TT).slice(0, 3).map(([k, v]) => ({ value: k, label: v }))}
            />
          </Col>
        </Row>
      </Card>

      {/* Tổng kết chọn */}
      {selectedInvoices.length > 0 && (
        <Card size="small" style={{ marginBottom: 12, background: '#f6ffed', borderColor: '#b7eb8f' }}>
          <Row gutter={32}>
            <Col>
              <Text type="secondary">Đã chọn: </Text>
              <Text strong>{selectedInvoices.length} hóa đơn</Text>
            </Col>
            <Col>
              <Text type="secondary">Tổng thu: </Text>
              <Text strong style={{ color: '#52c41a', fontSize: 15 }}>{fmtVND(tongThu)}</Text>
            </Col>
          </Row>
        </Card>
      )}

      <Table
        locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
        columns={displayColumns}
        dataSource={invoices}
        rowKey="id"
        loading={isLoading}
        size="small"
        scroll={{ x: 1200 }}
        rowClassName={inv => getRow(inv).selected ? 'ant-table-row-selected' : ''}
        pagination={{ pageSize: 50, showTotal: t => `${t} hóa đơn còn nợ` }}
        summary={() =>
          invoices.length > 0 ? (
            <Table.Summary fixed="bottom">
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={5} align="right">
                  <Text strong>Cộng:</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <Text strong>{fmtVND(invoices.reduce((s, i) => s + i.tong_cong, 0))}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right">
                  <Text strong style={{ color: '#fa8c16' }}>{fmtVND(invoices.reduce((s, i) => s + i.con_lai, 0))}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3} />
                <Table.Summary.Cell index={4} align="right">
                  <Text strong style={{ color: '#52c41a' }}>{fmtVND(tongThu)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} colSpan={3} />
              </Table.Summary.Row>
            </Table.Summary>
          ) : undefined
        }
      />

      {/* Kết quả */}
      {result && (
        <Card size="small" style={{ marginTop: 16 }}>
          <Title level={5}>Kết quả tạo phiếu thu</Title>
          <Alert
            type={result.that_bai === 0 ? 'success' : 'warning'}
            message={`${result.thanh_cong}/${result.tong_so} phiếu tạo thành công`}
            showIcon
            style={{ marginBottom: 8 }}
          />
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {result.items.map(item => (
              <div key={item.index} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '2px 0' }}>
                {item.success
                  ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                }
                <Text style={{ fontSize: 12 }}>
                  {item.success
                    ? `${item.so_phieu} — ${fmtVND(item.so_tien)}`
                    : item.error
                  }
                </Text>
              </div>
            ))}
          </div>
          {result.that_bai === 0 && (
            <div style={{ marginTop: 12 }}>
              <Button type="link" onClick={() => navigate('/accounting/receipts')}>
                Xem danh sách phiếu thu →
              </Button>
            </div>
          )}
        </Card>
      )}
    </PageLayout>
  )
}
