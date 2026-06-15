import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Row, Select, Space, Table, Tag, Typography, message, Statistic,
} from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import client from '../../api/client'
import PageLayout from '../../components/PageLayout'

const { Text } = Typography
const { RangePicker } = DatePicker

interface BankTx {
  id: number
  ngay_giao_dich: string
  mo_ta: string
  so_tham_chieu: string
  thu: number
  chi: number
  so_du: number
  trang_thai: string
  matched_chung_tu_loai: string | null
  matched_chung_tu_id: number | null
}

interface Candidate {
  id: number
  loai: string
  so_phieu: string
  ngay: string
  doi_tuong: string
  so_tien: number
}

interface BankAccount {
  id: number
  ten_ngan_hang: string
  so_tai_khoan: string
}

const TRANG_THAI: Record<string, { label: string; color: string }> = {
  chua_doi_soat: { label: 'Chưa đối soát', color: 'orange' },
  da_doi_soat:   { label: 'Đã đối soát',   color: 'green'  },
  bo_qua:        { label: 'Bỏ qua',         color: 'default'},
}

export default function BankReconciliationPage() {
  const qc = useQueryClient()
  const [tuNgay, setTuNgay] = useState<string | undefined>()
  const [denNgay, setDenNgay] = useState<string | undefined>()
  const [filterTrangThai, setFilterTrangThai] = useState<string>('chua_doi_soat')
  const [bankAccountId, setBankAccountId] = useState<number | undefined>()
  const [selectedTx, setSelectedTx] = useState<BankTx | null>(null)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['bank-transactions', tuNgay, denNgay, filterTrangThai, bankAccountId],
    queryFn: () => client.get('/accounting/bank-transactions', {
      params: { tu_ngay: tuNgay, den_ngay: denNgay, trang_thai: filterTrangThai || undefined, bank_account_id: bankAccountId, page_size: 100 },
    }).then(r => r.data),
  })

  const { data: bankAccounts } = useQuery({
    queryKey: ['bank-accounts-select'],
    queryFn: () => client.get('/bank-accounts').then(r => r.data),
  })

  const { data: candidates, isLoading: candLoading } = useQuery({
    queryKey: ['bank-tx-candidates', selectedTx?.id],
    queryFn: () =>
      selectedTx
        ? client.get(`/accounting/bank-transactions/${selectedTx.id}/candidates`).then(r => r.data)
        : Promise.resolve([]),
    enabled: !!selectedTx,
  })

  const matchMutation = useMutation({
    mutationFn: ({ txId, cand }: { txId: number; cand: Candidate }) =>
      client.post(`/accounting/bank-transactions/${txId}/reconcile`, {
        chung_tu_loai: cand.loai,
        chung_tu_id: cand.id,
      }).then(r => r.data),
    onSuccess: () => {
      message.success('Đã khớp thành công')
      qc.invalidateQueries({ queryKey: ['bank-transactions'] })
      setSelectedTx(null)
      setSelectedCandidate(null)
    },
    onError: () => message.error('Khớp thất bại'),
  })

  const unmatchMutation = useMutation({
    mutationFn: (txId: number) =>
      client.post(`/accounting/bank-transactions/${txId}/unreconcile`).then(r => r.data),
    onSuccess: () => {
      message.success('Đã bỏ khớp')
      qc.invalidateQueries({ queryKey: ['bank-transactions'] })
      setSelectedTx(null)
    },
    onError: () => message.error('Bỏ khớp thất bại'),
  })

  const txItems: BankTx[] = txData?.items ?? []
  const tongChuaKhop = txItems.filter(r => r.trang_thai === 'chua_doi_soat').length
  const tongDaKhop = txItems.filter(r => r.trang_thai === 'da_doi_soat').length

  const txColumns: ColumnsType<BankTx> = [
    {
      title: 'Ngày',
      dataIndex: 'ngay_giao_dich',
      width: 90,
      render: v => dayjs(v).format('DD/MM/YY'),
    },
    {
      title: 'Mô tả',
      dataIndex: 'mo_ta',
      ellipsis: true,
    },
    {
      title: 'Thu',
      dataIndex: 'thu',
      width: 110,
      align: 'right',
      render: v => v ? <Text type="success">{Number(v).toLocaleString('vi-VN')}</Text> : null,
    },
    {
      title: 'Chi',
      dataIndex: 'chi',
      width: 110,
      align: 'right',
      render: v => v ? <Text type="danger">{Number(v).toLocaleString('vi-VN')}</Text> : null,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 120,
      render: v => {
        const s = TRANG_THAI[v]
        return <Tag color={s?.color}>{s?.label ?? v}</Tag>
      },
    },
  ]

  const candColumns: ColumnsType<Candidate> = [
    { title: 'Số phiếu', dataIndex: 'so_phieu', width: 140 },
    { title: 'Ngày', dataIndex: 'ngay', width: 90, render: v => dayjs(v).format('DD/MM/YY') },
    { title: 'Đối tượng', dataIndex: 'doi_tuong', ellipsis: true },
    {
      title: 'Số tiền',
      dataIndex: 'so_tien',
      width: 120,
      align: 'right',
      render: v => Number(v).toLocaleString('vi-VN'),
    },
  ]

  const candKey = (r: Candidate) => `${r.loai}-${r.id}`
  const selectedCandKey = selectedCandidate ? candKey(selectedCandidate) : null

  return (
    <PageLayout title="Đối chiếu ngân hàng">
      {/* Filters */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[12, 8]} align="middle">
          <Col>
            <RangePicker
              format="DD/MM/YYYY"
              placeholder={['Từ ngày', 'Đến ngày']}
              onChange={v => {
                setTuNgay(v?.[0]?.format('YYYY-MM-DD'))
                setDenNgay(v?.[1]?.format('YYYY-MM-DD'))
              }}
            />
          </Col>
          <Col>
            <Select
              style={{ width: 220 }}
              allowClear
              placeholder="Tài khoản ngân hàng"
              onChange={v => setBankAccountId(v)}
              options={(bankAccounts ?? []).map((a: BankAccount) => ({
                value: a.id,
                label: `${a.ten_ngan_hang} – ${a.so_tai_khoan}`,
              }))}
            />
          </Col>
          <Col>
            <Select
              style={{ width: 150 }}
              value={filterTrangThai}
              onChange={v => setFilterTrangThai(v)}
              options={[
                { value: 'chua_doi_soat', label: 'Chưa đối soát' },
                { value: 'da_doi_soat',   label: 'Đã đối soát'   },
                { value: '',              label: 'Tất cả'         },
              ]}
            />
          </Col>
        </Row>
      </Card>

      {/* Summary */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={32}>
          <Col><Statistic title="Tổng giao dịch" value={txItems.length} /></Col>
          <Col>
            <Statistic
              title="Chưa khớp"
              value={tongChuaKhop}
              valueStyle={{ color: tongChuaKhop > 0 ? '#cf1322' : '#3f8600' }}
            />
          </Col>
          <Col>
            <Statistic
              title="Đã khớp"
              value={tongDaKhop}
              valueStyle={{ color: '#3f8600' }}
            />
          </Col>
        </Row>
      </Card>

      <Row gutter={12}>
        {/* Left: Bank transactions */}
        <Col span={14}>
          <Card
            size="small"
            title="Sao kê ngân hàng"
            loading={txLoading}
          >
            <Table<BankTx>
              columns={txColumns}
              dataSource={txItems}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 15, showTotal: t => `${t} giao dịch` }}
              rowSelection={{
                type: 'radio',
                selectedRowKeys: selectedTx ? [selectedTx.id] : [],
                onChange: (_, rows) => {
                  setSelectedTx(rows[0] ?? null)
                  setSelectedCandidate(null)
                },
              }}
              onRow={record => ({
                onClick: () => {
                  setSelectedTx(record.id === selectedTx?.id ? null : record)
                  setSelectedCandidate(null)
                },
                style: { cursor: 'pointer', background: record.id === selectedTx?.id ? '#e6f4ff' : undefined },
              })}
            />
          </Card>
        </Col>

        {/* Right: Candidates / Actions */}
        <Col span={10}>
          <Card
            size="small"
            title={
              selectedTx
                ? `Chứng từ khớp: ${selectedTx.mo_ta ?? selectedTx.so_tham_chieu ?? '#' + selectedTx.id}`
                : 'Chọn giao dịch bên trái'
            }
            extra={
              selectedTx && (
                <Space>
                  {selectedTx.trang_thai === 'da_doi_soat' && (
                    <Button
                      danger
                      size="small"
                      icon={<CloseCircleOutlined />}
                      loading={unmatchMutation.isPending}
                      onClick={() => unmatchMutation.mutate(selectedTx.id)}
                    >
                      Bỏ khớp
                    </Button>
                  )}
                  {selectedTx.trang_thai === 'chua_doi_soat' && selectedCandidate && (
                    <Button
                      type="primary"
                      size="small"
                      icon={<CheckCircleOutlined />}
                      loading={matchMutation.isPending}
                      onClick={() => matchMutation.mutate({ txId: selectedTx.id, cand: selectedCandidate })}
                    >
                      Khớp
                    </Button>
                  )}
                </Space>
              )
            }
          >
            {!selectedTx && (
              <div style={{ textAlign: 'center', padding: '48px 0', color: '#bbb' }}>
                Chọn một giao dịch để xem chứng từ khớp
              </div>
            )}

            {selectedTx?.trang_thai === 'da_doi_soat' && (
              <div style={{ padding: '24px 0', textAlign: 'center' }}>
                <Tag color="green" style={{ fontSize: 14, padding: '4px 16px' }}>
                  <CheckCircleOutlined /> Đã khớp với {selectedTx.matched_chung_tu_loai} #{selectedTx.matched_chung_tu_id}
                </Tag>
              </div>
            )}

            {selectedTx?.trang_thai === 'chua_doi_soat' && (
              <Table<Candidate>
                columns={candColumns}
                dataSource={candidates ?? []}
                rowKey={candKey}
                size="small"
                loading={candLoading}
                pagination={false}
                rowSelection={{
                  type: 'radio',
                  selectedRowKeys: selectedCandKey ? [selectedCandKey] : [],
                  onChange: (_, rows) => setSelectedCandidate(rows[0] ?? null),
                }}
                onRow={record => ({
                  onClick: () =>
                    setSelectedCandidate(candKey(record) === selectedCandKey ? null : record),
                  style: {
                    cursor: 'pointer',
                    background: candKey(record) === selectedCandKey ? '#f6ffed' : undefined,
                  },
                })}
                locale={{
                  emptyText: 'Không tìm thấy chứng từ khớp',
                }}
              />
            )}
          </Card>
        </Col>
      </Row>
    </PageLayout>
  )
}
