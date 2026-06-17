import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Button, Card, Checkbox, Col, DatePicker, Input, InputNumber,
  Row, Select, Space, Table, Tag, Typography, message,
} from 'antd'
import {
  ArrowLeftOutlined, ReloadOutlined, SendOutlined,
  CheckCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { fmtVND } from '../../utils/exportUtils'
import { receiptApi, HINH_THUC_TT, BatchReceiptItem, BatchReceiptResponse } from '../../api/accounting'
import { billingApi, SalesInvoiceListItem } from '../../api/billing'
import { customersApi, Customer } from '../../api/customers'
import { usePhapNhan, usePhanXuong } from '../../hooks/useMasterData'
import PageLayout from '../../components/PageLayout'
import EmptyState from '../../components/EmptyState'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Text } = Typography

const HTTT_OPTIONS = [
  { value: 'chuyen_khoan', label: 'Chuyển khoản' },
  { value: 'tien_mat', label: 'Tiền mặt' },
  { value: 'bu_tru_cong_no', label: 'Bù trừ công nợ' },
]

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

interface RowState {
  selected: boolean
  so_tien: number
  dien_giai: string
}

export default function CashReceiptByInvoicePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { phapNhanList } = usePhapNhan()
  const { phanXuongList } = usePhanXuong()

  const [customerId, setCustomerId] = useState<number | undefined>()
  const [ngayPhieu, setNgayPhieu] = useState<string>(dayjs().format('YYYY-MM-DD'))
  const [phapNhanId, setPhapNhanId] = useState<number | undefined>()
  const [phanXuongId, setPhanXuongId] = useState<number | undefined>()
  const [hinhThucTT, setHinhThucTT] = useState<string>('chuyen_khoan')
  const [fetchedFor, setFetchedFor] = useState<number | undefined>()
  const [rowStates, setRowStates] = useState<Record<number, RowState>>({})
  const [result, setResult] = useState<BatchReceiptResponse | null>(null)

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers-all'],
    queryFn: () => customersApi.all().then(r => r.data),
  })

  const { data: invoiceData, isLoading } = useQuery({
    queryKey: ['invoices-by-invoice-page', fetchedFor],
    queryFn: () =>
      billingApi.listInvoices({
        customer_id: fetchedFor,
        trang_thai: 'da_phat_hanh,da_tt_mot_phan,qua_han',
        page_size: 200,
      }),
    enabled: !!fetchedFor,
  })

  const invoices: SalesInvoiceListItem[] = useMemo(() => {
    if (!fetchedFor) return []
    return (invoiceData?.items ?? []).filter(
      (i: SalesInvoiceListItem) => i.con_lai > 0
    )
  }, [invoiceData, fetchedFor])

  useEffect(() => {
    if (invoices.length === 0) return
    setRowStates(prev => {
      const next = { ...prev }
      invoices.forEach(inv => {
        if (!next[inv.id]) {
          next[inv.id] = {
            selected: false,
            so_tien: inv.con_lai,
            dien_giai: `Thu tiền HĐ ${inv.so_hoa_don ?? `#${inv.id}`}`,
          }
        }
      })
      return next
    })
  }, [invoices])

  const getRow = (inv: SalesInvoiceListItem): RowState =>
    rowStates[inv.id] ?? {
      selected: false,
      so_tien: inv.con_lai,
      dien_giai: `Thu tiền HĐ ${inv.so_hoa_don ?? `#${inv.id}`}`,
    }

  const setRow = (id: number, patch: Partial<RowState>) =>
    setRowStates(prev => ({
      ...prev,
      [id]: { ...(prev[id] ?? { selected: false, so_tien: 0, dien_giai: '' }), ...patch },
    }))

  const selectedInvoices = invoices.filter(i => getRow(i).selected)
  const tongThu = selectedInvoices.reduce((s, i) => s + (getRow(i).so_tien ?? 0), 0)
  const tongPhai = invoices.reduce((s, i) => s + i.tong_cong, 0)
  const tongChuaThu = invoices.reduce((s, i) => s + i.con_lai, 0)

  const handleSelectAll = (checked: boolean) => {
    setRowStates(prev => {
      const next = { ...prev }
      invoices.forEach(i => {
        next[i.id] = { ...getRow(i), selected: checked }
      })
      return next
    })
  }

  const handleLayDuLieu = () => {
    if (!customerId) { message.warning('Chọn khách hàng trước'); return }
    setRowStates({})
    setResult(null)
    setFetchedFor(customerId)
  }

  const batchMut = useMutation({
    mutationFn: () => {
      const items: BatchReceiptItem[] = selectedInvoices.map(inv => ({
        customer_id: inv.customer_id,
        sales_invoice_id: inv.id,
        so_tien: getRow(inv).so_tien,
        hinh_thuc_tt: hinhThucTT,
        dien_giai: getRow(inv).dien_giai,
      }))
      return receiptApi.batch({
        ngay_phieu: ngayPhieu,
        phap_nhan_id: phapNhanId ?? null,
        phan_xuong_id: phanXuongId ?? null,
        items,
      })
    },
    onSuccess: res => {
      setResult(res)
      qc.invalidateQueries({ queryKey: ['receipts'] })
      qc.invalidateQueries({ queryKey: ['invoices-by-invoice-page'] })
      if (res.that_bai === 0) {
        message.success(`Tạo thành công ${res.thanh_cong} phiếu thu`)
      } else {
        message.warning(`${res.thanh_cong} thành công, ${res.that_bai} lỗi`)
      }
    },
    onError: () => message.error('Có lỗi xảy ra'),
  })

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
      align: 'center' as const,
      render: (_: unknown, inv: SalesInvoiceListItem) => (
        <Checkbox
          checked={getRow(inv).selected}
          onChange={e => setRow(inv.id, { selected: e.target.checked })}
        />
      ),
    },
    {
      title: 'Ngày HĐ',
      dataIndex: 'ngay_hoa_don',
      width: 95,
      render: (v: string) => v ? dayjs(v).format('DD/MM/YY') : '—',
    },
    {
      title: 'Số hóa đơn',
      dataIndex: 'so_hoa_don',
      width: 130,
      render: (v: string, r: SalesInvoiceListItem) => (
        <a onClick={() => navigate(`/billing/invoices/${r.id}`)}>{v ?? `HĐ#${r.id}`}</a>
      ),
    },
    {
      title: 'Diễn giải',
      width: 200,
      render: (_: unknown, inv: SalesInvoiceListItem) => (
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
      title: 'Hạn TT',
      dataIndex: 'han_tt',
      width: 90,
      render: (v: string) => {
        if (!v) return <Text type="secondary">—</Text>
        const d = dayjs(v)
        const overdue = d.isBefore(dayjs(), 'day')
        return <span style={{ color: overdue ? '#f5222d' : undefined }}>{d.format('DD/MM/YY')}</span>
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 90,
      render: (v: string) => <Tag color={TRANG_THAI_COLOR[v]}>{TRANG_THAI_LABEL[v] ?? v}</Tag>,
    },
    {
      title: 'Số phải thu',
      dataIndex: 'tong_cong',
      align: 'right' as const,
      width: 125,
      render: (v: number) => fmtVND(v),
    },
    {
      title: 'Số chưa thu',
      dataIndex: 'con_lai',
      align: 'right' as const,
      width: 125,
      render: (v: number) => <Text style={{ color: '#fa8c16' }}>{fmtVND(v)}</Text>,
    },
    {
      title: 'Số thu',
      width: 145,
      align: 'right' as const,
      render: (_: unknown, inv: SalesInvoiceListItem) => (
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
      title: 'TK Phải thu',
      width: 90,
      align: 'center' as const,
      render: () => <Text type="secondary">131</Text>,
    },
    {
      title: 'Điều khoản TT',
      width: 125,
      render: () => <Text type="secondary">{HINH_THUC_TT[hinhThucTT] ?? hinhThucTT}</Text>,
    },
    {
      title: 'Tỷ lệ CK%',
      width: 75,
      align: 'center' as const,
      render: () => <Text type="secondary">0%</Text>,
    },
  ]
  const { displayColumns, settingsButton } = useColumnPrefs('accounting-cash-receipt-by-invoice', columns, { nonHideable: ['so_hoa_don'] })

  const emptyDescription = !fetchedFor
    ? 'Chọn khách hàng và bấm Lấy dữ liệu'
    : 'Không có hóa đơn còn nợ'

  return (
    <PageLayout
      title="Thu tiền theo hóa đơn"
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
            Tạo {selectedInvoices.length > 0 ? `${selectedInvoices.length} ` : ''}phiếu thu
          </Button>
          {settingsButton}
        </Space>
      }
    >
      {/* Filter form */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[12, 8]} align="bottom" wrap>
          <Col flex="220px">
            <div style={{ marginBottom: 4 }}><Text type="secondary" style={{ fontSize: 12 }}>Khách hàng *</Text></div>
            <Select
              style={{ width: '100%' }}
              showSearch
              placeholder="Chọn khách hàng"
              filterOption={(input, opt) =>
                (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={customers.map(c => ({
                value: c.id,
                label: `${c.ma_kh ? `[${c.ma_kh}] ` : ''}${c.ten_don_vi ?? ''}`,
              }))}
              onChange={v => {
                setCustomerId(v)
                if (v !== fetchedFor) {
                  setFetchedFor(undefined)
                  setRowStates({})
                  setResult(null)
                }
              }}
            />
          </Col>
          <Col>
            <div style={{ marginBottom: 4 }}><Text type="secondary" style={{ fontSize: 12 }}>Ngày thu tiền</Text></div>
            <DatePicker
              format="DD/MM/YYYY"
              value={dayjs(ngayPhieu)}
              onChange={v => setNgayPhieu(v?.format('YYYY-MM-DD') ?? dayjs().format('YYYY-MM-DD'))}
            />
          </Col>
          <Col flex="180px">
            <div style={{ marginBottom: 4 }}><Text type="secondary" style={{ fontSize: 12 }}>Pháp nhân</Text></div>
            <Select
              style={{ width: '100%' }}
              allowClear
              placeholder="Pháp nhân"
              onChange={v => setPhapNhanId(v)}
              options={phapNhanList.map(p => ({ value: p.id, label: p.ten_phap_nhan }))}
            />
          </Col>
          <Col flex="155px">
            <div style={{ marginBottom: 4 }}><Text type="secondary" style={{ fontSize: 12 }}>Xưởng</Text></div>
            <Select
              style={{ width: '100%' }}
              allowClear
              placeholder="Xưởng"
              onChange={v => setPhanXuongId(v)}
              options={phanXuongList.map(x => ({ value: x.id, label: x.ten_xuong }))}
            />
          </Col>
          <Col flex="160px">
            <div style={{ marginBottom: 4 }}><Text type="secondary" style={{ fontSize: 12 }}>Hình thức TT</Text></div>
            <Select
              style={{ width: '100%' }}
              value={hinhThucTT}
              onChange={setHinhThucTT}
              options={HTTT_OPTIONS}
            />
          </Col>
          <Col>
            <Button
              type="primary"
              ghost
              icon={<ReloadOutlined />}
              onClick={handleLayDuLieu}
              disabled={!customerId}
              loading={isLoading}
            >
              Lấy dữ liệu
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Summary bar when rows selected */}
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

      {/* Invoice table */}
      <Table
        locale={{ emptyText: <EmptyState size="small" preset="document" description={emptyDescription} /> }}
        columns={displayColumns}
        dataSource={invoices}
        rowKey="id"
        loading={isLoading}
        size="small"
        scroll={{ x: 1250 }}
        rowClassName={(inv: SalesInvoiceListItem) => getRow(inv).selected ? 'ant-table-row-selected' : ''}
        pagination={false}
        summary={() =>
          invoices.length > 0 ? (
            <Table.Summary fixed="bottom">
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={6} align="right">
                  <Text strong>Cộng:</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <Text strong>{fmtVND(tongPhai)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right">
                  <Text strong style={{ color: '#fa8c16' }}>{fmtVND(tongChuaThu)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right">
                  <Text strong style={{ color: '#52c41a' }}>{fmtVND(tongThu)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} colSpan={3} />
              </Table.Summary.Row>
            </Table.Summary>
          ) : undefined
        }
      />

      {/* Result */}
      {result && (
        <Card size="small" style={{ marginTop: 16 }}>
          <Alert
            type={result.that_bai === 0 ? 'success' : 'warning'}
            message={`Kết quả: ${result.thanh_cong}/${result.tong_so} phiếu tạo thành công`}
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
                  {item.success ? `${item.so_phieu} — ${fmtVND(item.so_tien)}` : item.error}
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
