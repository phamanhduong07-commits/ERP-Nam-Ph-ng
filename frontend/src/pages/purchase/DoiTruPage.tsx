import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Button, Card, DatePicker, Input, InputNumber, message, Select, Space,
  Table, Typography, Tag,
} from 'antd'
import { CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import client from '../../api/client'
import dayjs from 'dayjs'

const { Text } = Typography
const API = ''

type Payment = {
  id: number; so_phieu: string; ngay_phieu: string | null
  so_tien: number; da_doi_tru: number; con_lai_doi_tru: number
}
type Invoice = {
  id: number; so_hoa_don: string; ngay_lap: string | null
  tong_thanh_toan: number; da_thanh_toan: number; con_lai: number; trang_thai: string
}
type SupplierOpt = { id: number; ten_viet_tat: string; ten_don_vi: string | null; ma_ncc: string }
type PhapNhanOpt = { id: number; ten_viet_tat: string; ten_phap_nhan: string }

const fmt = (v: number) => v.toLocaleString('vi-VN')
const fmtDate = (v: string | null) => (v ? dayjs(v).format('DD/MM/YYYY') : '—')

function buildPairs(
  selectedPayIds: number[], selectedInvIds: number[],
  payAmounts: Record<number, number>, invAmounts: Record<number, number>,
) {
  const pays = selectedPayIds.map(id => ({ id, remaining: payAmounts[id] ?? 0 })).filter(p => p.remaining > 0)
  const invs = selectedInvIds.map(id => ({ id, remaining: invAmounts[id] ?? 0 })).filter(i => i.remaining > 0)
  const pairs: { purchase_invoice_id: number; cash_payment_id: number; so_tien_doi_tru: number }[] = []
  let pi = 0, ii = 0
  while (pi < pays.length && ii < invs.length) {
    const amount = Math.min(pays[pi].remaining, invs[ii].remaining)
    if (amount > 0.01)
      pairs.push({ cash_payment_id: pays[pi].id, purchase_invoice_id: invs[ii].id, so_tien_doi_tru: Math.round(amount * 100) / 100 })
    pays[pi].remaining -= amount; invs[ii].remaining -= amount
    if (pays[pi].remaining < 0.01) pi++
    if (invs[ii].remaining < 0.01) ii++
  }
  return pairs
}

export default function DoiTruPage() {
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const [phapNhanId, setPhapNhanId] = useState<number | null>(null)
  const [ngayDoiTru, setNgayDoiTru] = useState(dayjs())
  const [ghiChu, setGhiChu] = useState('')
  const [suppliers, setSuppliers] = useState<SupplierOpt[]>([])
  const [phapNhanList, setPhapNhanList] = useState<PhapNhanOpt[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)
  const [paySearch, setPaySearch] = useState('')
  const [invSearch, setInvSearch] = useState('')
  const [selectedPayIds, setSelectedPayIds] = useState<number[]>([])
  const [selectedInvIds, setSelectedInvIds] = useState<number[]>([])
  const [payAmounts, setPayAmounts] = useState<Record<number, number>>({})
  const [invAmounts, setInvAmounts] = useState<Record<number, number>>({})

  useEffect(() => {
    client.get(`${API}/suppliers?limit=500`).then(r => setSuppliers(r.data.items ?? r.data)).catch(() => {})
    client.get(`${API}/phap-nhan`).then(r => setPhapNhanList(r.data)).catch(() => {})
  }, [])

  const fetchData = useCallback(async () => {
    if (!supplierId) { message.warning('Chọn nhà cung cấp'); return }
    setLoading(true)
    try {
      const params: Record<string, unknown> = {}
      if (phapNhanId) params.phap_nhan_id = phapNhanId
      const { data } = await client.get(`${API}/doi-tru/pending/${supplierId}`, { params })
      const pays: Payment[] = data.payments ?? []
      const invs: Invoice[] = data.invoices ?? []
      setPayments(pays); setInvoices(invs)
      const pa: Record<number, number> = {}; const ia: Record<number, number> = {}
      pays.forEach(p => { pa[p.id] = p.con_lai_doi_tru })
      invs.forEach(i => { ia[i.id] = i.con_lai })
      setPayAmounts(pa); setInvAmounts(ia)
      setSelectedPayIds([]); setSelectedInvIds([])
      setFetched(true)
    } catch (e: any) {
      message.error(e.response?.data?.detail ?? 'Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [supplierId, phapNhanId])

  const soDoiTru = useMemo(
    () => selectedPayIds.reduce((s, id) => s + (payAmounts[id] ?? 0), 0),
    [selectedPayIds, payAmounts],
  )

  const createMut = useMutation({
    mutationFn: (body: object) => client.post(`${API}/doi-tru/`, body),
    onSuccess: res => {
      message.success(`Đã đối trừ ${res.data.ma_doi_tru} — ${fmt(res.data.tong_tien_doi_tru)} đ`)
      fetchData()
    },
    onError: (e: any) => message.error(e.response?.data?.detail ?? 'Lỗi xác nhận'),
  })

  function handleConfirm() {
    if (!supplierId) { message.warning('Chọn nhà cung cấp'); return }
    if (!selectedPayIds.length || !selectedInvIds.length) {
      message.warning('Chọn ít nhất 1 chứng từ thanh toán và 1 chứng từ công nợ'); return
    }
    const pairs = buildPairs(selectedPayIds, selectedInvIds, payAmounts, invAmounts)
    if (!pairs.length) { message.warning('Không tạo được cặp đối trừ'); return }
    createMut.mutate({
      supplier_id: supplierId,
      ngay_doi_tru: ngayDoiTru.format('YYYY-MM-DD'),
      ghi_chu: ghiChu,
      phap_nhan_id: phapNhanId,
      items: pairs,
    })
  }

  const filteredPays = payments.filter(p => !paySearch || p.so_phieu.toLowerCase().includes(paySearch.toLowerCase()))
  const filteredInvs = invoices.filter(i => !invSearch || i.so_hoa_don.toLowerCase().includes(invSearch.toLowerCase()))

  const payColumns = [
    { title: 'Ngày phiếu', dataIndex: 'ngay_phieu', width: 120, render: fmtDate },
    { title: 'Số chứng từ', dataIndex: 'so_phieu', width: 150 },
    { title: 'Diễn giải', key: 'dien_giai', width: 160, render: () => <Text type="secondary">—</Text> },
    { title: 'Số tiền', dataIndex: 'so_tien', width: 130, align: 'right' as const, render: fmt },
    {
      title: 'Số chưa đối trừ', dataIndex: 'con_lai_doi_tru', width: 140, align: 'right' as const,
      render: (v: number) => <Text type={v > 0 ? 'warning' : 'secondary'}>{fmt(v)}</Text>,
    },
    {
      title: 'Số tiền đối trừ', key: 'doi_tru_amount', width: 160, align: 'right' as const,
      render: (_: unknown, rec: Payment) => (
        <InputNumber<number>
          size="small" style={{ width: 140 }} value={payAmounts[rec.id] ?? rec.con_lai_doi_tru}
          min={0} max={rec.con_lai_doi_tru}
          formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={v => { const c = v ? v.replace(/,/g, '') : ''; return c ? parseFloat(c) : 0 }}
          onChange={v => setPayAmounts(prev => ({ ...prev, [rec.id]: v ?? 0 }))}
        />
      ),
    },
  ]

  const invColumns = [
    { title: 'Ngày hóa đơn', dataIndex: 'ngay_lap', width: 120, render: fmtDate },
    { title: 'Số hóa đơn', dataIndex: 'so_hoa_don', width: 150 },
    {
      title: 'Trạng thái', dataIndex: 'trang_thai', width: 130,
      render: (v: string) => {
        const map: Record<string, [string, string]> = {
          nhap: ['Chưa thanh toán', 'red'],
          da_tt_mot_phan: ['TT một phần', 'orange'],
          da_tt_du: ['Đã TT đủ', 'green'],
        }
        const [label, color] = map[v] ?? [v, 'default']
        return <Tag color={color}>{label}</Tag>
      },
    },
    { title: 'Số tiền', dataIndex: 'tong_thanh_toan', width: 130, align: 'right' as const, render: fmt },
    {
      title: 'Số còn nợ', dataIndex: 'con_lai', width: 130, align: 'right' as const,
      render: (v: number) => <Text type="danger">{fmt(v)}</Text>,
    },
    {
      title: 'Số tiền đối trừ', key: 'doi_tru_amount', width: 160, align: 'right' as const,
      render: (_: unknown, rec: Invoice) => (
        <InputNumber<number>
          size="small" style={{ width: 140 }} value={invAmounts[rec.id] ?? rec.con_lai}
          min={0} max={rec.con_lai}
          formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={v => { const c = v ? v.replace(/,/g, '') : ''; return c ? parseFloat(c) : 0 }}
          onChange={v => setInvAmounts(prev => ({ ...prev, [rec.id]: v ?? 0 }))}
        />
      ),
    },
  ]

  const paySummary = () => {
    const totSoTien = filteredPays.reduce((s, p) => s + p.so_tien, 0)
    const totConLai = filteredPays.reduce((s, p) => s + p.con_lai_doi_tru, 0)
    const totDoiTru = selectedPayIds.reduce((s, id) => s + (payAmounts[id] ?? 0), 0)
    return (
      <Table.Summary.Row style={{ background: '#f0f5ff' }}>
        <Table.Summary.Cell index={0} colSpan={3} />
        <Table.Summary.Cell index={3}><Text strong>Tổng</Text></Table.Summary.Cell>
        <Table.Summary.Cell index={4} align="right"><Text strong>{fmt(totSoTien)}</Text></Table.Summary.Cell>
        <Table.Summary.Cell index={5} align="right"><Text strong>{fmt(totConLai)}</Text></Table.Summary.Cell>
        <Table.Summary.Cell index={6} align="right"><Text strong type="success">{fmt(totDoiTru)}</Text></Table.Summary.Cell>
      </Table.Summary.Row>
    )
  }

  const invSummary = () => {
    const totSoTien = filteredInvs.reduce((s, i) => s + i.tong_thanh_toan, 0)
    const totConLai = filteredInvs.reduce((s, i) => s + i.con_lai, 0)
    const totDoiTru = selectedInvIds.reduce((s, id) => s + (invAmounts[id] ?? 0), 0)
    return (
      <Table.Summary.Row style={{ background: '#f0f5ff' }}>
        <Table.Summary.Cell index={0} colSpan={2} />
        <Table.Summary.Cell index={2}><Text strong>Tổng</Text></Table.Summary.Cell>
        <Table.Summary.Cell index={3} align="right"><Text strong>{fmt(totSoTien)}</Text></Table.Summary.Cell>
        <Table.Summary.Cell index={4} align="right"><Text strong type="danger">{fmt(totConLai)}</Text></Table.Summary.Cell>
        <Table.Summary.Cell index={5} align="right"><Text strong type="success">{fmt(totDoiTru)}</Text></Table.Summary.Cell>
      </Table.Summary.Row>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      {/* ── Header filter bar ── */}
      <Card
        styles={{ body: { padding: '12px 16px' } }}
        style={{ marginBottom: 12, background: '#e8f5f5', borderColor: '#b2dfdb' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Text strong style={{ whiteSpace: 'nowrap' }}>Pháp nhân</Text>
            <Select
              placeholder="Tất cả" allowClear style={{ width: 150 }}
              options={phapNhanList.map(p => ({ value: p.id, label: p.ten_viet_tat || p.ten_phap_nhan }))}
              onChange={v => { setPhapNhanId(v ?? null); setFetched(false); setPayments([]); setInvoices([]) }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Text strong style={{ whiteSpace: 'nowrap' }}>
              Nhà cung cấp <Text type="danger">*</Text>
            </Text>
            <Select
              showSearch optionFilterProp="label" placeholder="Chọn NCC"
              style={{ width: 280 }} allowClear
              options={suppliers.map(s => ({ value: s.id, label: s.ten_viet_tat || s.ten_don_vi || s.ma_ncc }))}
              onChange={v => { setSupplierId(v ?? null); setFetched(false); setPayments([]); setInvoices([]) }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Text strong style={{ whiteSpace: 'nowrap' }}>TK phải trả</Text>
            <Select defaultValue="3311" style={{ width: 90 }}
              options={[{ value: '3311', label: '3311' }, { value: '3312', label: '3312' }]} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Text strong style={{ whiteSpace: 'nowrap' }}>Ngày đối trừ</Text>
            <DatePicker value={ngayDoiTru} format="DD/MM/YYYY"
              onChange={v => v && setNgayDoiTru(v)} style={{ width: 130 }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Text strong>Loại tiền</Text>
            <Select defaultValue="VND" style={{ width: 80 }} options={[{ value: 'VND', label: 'VND' }]} />
          </div>

          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}
            style={{ background: '#00695c', color: '#fff', border: 'none' }}>
            Lấy dữ liệu
          </Button>

          <div style={{ marginLeft: 'auto', textAlign: 'right', minWidth: 90 }}>
            <div style={{ fontSize: 11, color: '#888' }}>Số đối trừ</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: soDoiTru > 0 ? '#00695c' : '#bbb', lineHeight: 1.1 }}>
              {soDoiTru > 0 ? fmt(soDoiTru) : '0'}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Chứng từ thanh toán ── */}
      <Card
        title={<Text strong>Chứng từ thanh toán</Text>}
        size="small" style={{ marginBottom: 8 }}
        styles={{ header: { background: '#f5f5f5' } }}
        extra={
          <Input size="small" placeholder="Nhập số chứng từ" style={{ width: 200 }}
            value={paySearch} onChange={e => setPaySearch(e.target.value)} allowClear />
        }
      >
        <Table<Payment>
          dataSource={filteredPays} columns={payColumns} rowKey="id" size="small"
          loading={loading} pagination={false} scroll={{ x: 900, y: 220 }}
          rowSelection={{ type: 'checkbox', selectedRowKeys: selectedPayIds, onChange: keys => setSelectedPayIds(keys as number[]) }}
          summary={paySummary}
          locale={{ emptyText: fetched ? 'Không có chứng từ thanh toán chưa đối trừ' : 'Chọn NCC và nhấn "Lấy dữ liệu"' }}
        />
      </Card>

      {/* ── Chứng từ công nợ ── */}
      <Card
        title={<Text strong>Chứng từ công nợ</Text>}
        size="small" style={{ marginBottom: 12 }}
        styles={{ header: { background: '#f5f5f5' } }}
        extra={
          <Input size="small" placeholder="Nhập số chứng từ, số hóa đơn" style={{ width: 240 }}
            value={invSearch} onChange={e => setInvSearch(e.target.value)} allowClear />
        }
      >
        <Table<Invoice>
          dataSource={filteredInvs} columns={invColumns} rowKey="id" size="small"
          loading={loading} pagination={false} scroll={{ x: 1000, y: 220 }}
          rowSelection={{ type: 'checkbox', selectedRowKeys: selectedInvIds, onChange: keys => setSelectedInvIds(keys as number[]) }}
          summary={invSummary}
          locale={{ emptyText: fetched ? 'Không có hóa đơn còn công nợ' : 'Chọn NCC và nhấn "Lấy dữ liệu"' }}
        />
      </Card>

      {/* ── Footer ── */}
      <Card size="small" styles={{ body: { padding: '10px 16px' } }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text strong style={{ whiteSpace: 'nowrap' }}>Ghi chú:</Text>
          <Input placeholder="Ghi chú đối trừ..." value={ghiChu}
            onChange={e => setGhiChu(e.target.value)} style={{ flex: 1 }} />
          <Space>
            {(selectedPayIds.length > 0 || selectedInvIds.length > 0) && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {selectedPayIds.length} phiếu chi — {selectedInvIds.length} hóa đơn
              </Text>
            )}
            <Button
              type="primary" icon={<CheckCircleOutlined />} onClick={handleConfirm}
              loading={createMut.isPending} disabled={!selectedPayIds.length || !selectedInvIds.length}
              style={{ background: '#00695c', borderColor: '#00695c' }}
            >
              Xác nhận đối trừ
            </Button>
          </Space>
        </div>
      </Card>
    </div>
  )
}
