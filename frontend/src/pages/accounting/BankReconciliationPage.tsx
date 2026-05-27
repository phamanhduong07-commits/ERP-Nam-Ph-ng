import { useState } from 'react'
import type { ApiError } from '../../api/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, DatePicker, Modal, Select, Space, Table, Tag, Typography, message,
} from 'antd'
import { CheckCircleOutlined, DisconnectOutlined, StopOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import ImportExcelButton from '../../components/ImportExcelButton'
import {
  bankAccountsApi,
  bankTransactionsApi,
  type BankReconcileCandidate,
  type BankTransaction,
} from '../../api/banking'
import { phapNhanApi, type PhapNhan } from '../../api/phap_nhan'
import EmptyState from "../../components/EmptyState"

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  chua_doi_soat: { text: 'Chưa đối soát', color: 'orange' },
  da_doi_soat: { text: 'Đã đối soát', color: 'green' },
  bo_qua: { text: 'Bỏ qua', color: 'default' },
}

export default function BankReconciliationPage() {
  const qc = useQueryClient()
  const today = dayjs()
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([today.startOf('month'), today])
  const [phapNhanId, setPhapNhanId] = useState<number | undefined>()
  const [bankAccountId, setBankAccountId] = useState<number | undefined>()
  const [status, setStatus] = useState<string | undefined>('chua_doi_soat')
  const [selectedTx, setSelectedTx] = useState<BankTransaction | null>(null)

  const { data: phapNhanList = [] } = useQuery<PhapNhan[]>({
    queryKey: ['phap-nhan-active'],
    queryFn: () => phapNhanApi.list({ active_only: true }).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => bankAccountsApi.list({ trang_thai: true }).then(r => r.data),
  })
  const filteredAccounts = accounts.filter(a => !a.phap_nhan_id || !phapNhanId || a.phap_nhan_id === phapNhanId)

  const txQuery = useQuery({
    queryKey: ['bank-transactions', range[0].format('YYYY-MM-DD'), range[1].format('YYYY-MM-DD'), phapNhanId, bankAccountId, status],
    queryFn: () => bankTransactionsApi.list({
      tu_ngay: range[0].format('YYYY-MM-DD'),
      den_ngay: range[1].format('YYYY-MM-DD'),
      phap_nhan_id: phapNhanId,
      bank_account_id: bankAccountId,
      trang_thai: status,
      page_size: 100,
    }),
  })

  const { data: candidates = [], isLoading: loadingCandidates } = useQuery<BankReconcileCandidate[]>({
    queryKey: ['bank-transaction-candidates', selectedTx?.id],
    queryFn: () => bankTransactionsApi.candidates(selectedTx!.id),
    enabled: !!selectedTx && selectedTx.trang_thai !== 'da_doi_soat',
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['bank-transactions'] })
    qc.invalidateQueries({ queryKey: ['bank-transaction-candidates'] })
  }

  const reconcileMut = useMutation({
    mutationFn: ({ candidate }: { candidate: BankReconcileCandidate }) =>
      bankTransactionsApi.reconcile(selectedTx!.id, {
        chung_tu_loai: candidate.chung_tu_loai,
        chung_tu_id: candidate.chung_tu_id,
      }),
    onSuccess: () => {
      message.success('Đã đối soát giao dịch')
      setSelectedTx(null)
      invalidate()
    },
    onError: (e: Error & { response?: { data?: { detail?: string } } }) => message.error((e as ApiError)?.response?.data?.detail || 'Không đối soát được'),
  })

  const unreconcileMut = useMutation({
    mutationFn: (id: number) => bankTransactionsApi.unreconcile(id),
    onSuccess: () => {
      message.success('Đã hủy đối soát')
      invalidate()
    },
    onError: (e: Error & { response?: { data?: { detail?: string } } }) => message.error((e as ApiError)?.response?.data?.detail || 'Không hủy được đối soát'),
  })

  const ignoreMut = useMutation({
    mutationFn: (id: number) => bankTransactionsApi.ignore(id),
    onSuccess: () => {
      message.success('Đã bỏ qua giao dịch')
      invalidate()
    },
    onError: (e: Error & { response?: { data?: { detail?: string } } }) => message.error((e as ApiError)?.response?.data?.detail || 'Không bỏ qua được'),
  })

  const columns: ColumnsType<BankTransaction> = [
    {
      title: 'Ngày',
      dataIndex: 'ngay_giao_dich',
      width: 105,
      render: v => dayjs(v).format('DD/MM/YYYY'),
    },
    { title: 'Số TK', dataIndex: 'so_tai_khoan', width: 150 },
    { title: 'Tham chiếu', dataIndex: 'so_tham_chieu', width: 140 },
    { title: 'Mô tả', dataIndex: 'mo_ta', ellipsis: true },
    {
      title: 'Thu',
      dataIndex: 'thu',
      width: 130,
      align: 'right',
      render: v => Number(v) > 0 ? <Text type="success">{Number(v).toLocaleString('vi-VN')}</Text> : '',
    },
    {
      title: 'Chi',
      dataIndex: 'chi',
      width: 130,
      align: 'right',
      render: v => Number(v) > 0 ? <Text type="danger">{Number(v).toLocaleString('vi-VN')}</Text> : '',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 125,
      render: v => <Tag color={STATUS_LABEL[v]?.color}>{STATUS_LABEL[v]?.text ?? v}</Tag>,
    },
    {
      title: 'Chứng từ',
      width: 130,
      render: (_, r) => r.matched_chung_tu_id ? `${r.matched_chung_tu_loai} #${r.matched_chung_tu_id}` : '',
    },
    {
      title: '',
      width: 210,
      render: (_, r) => (
        <Space>
          {r.trang_thai !== 'da_doi_soat' && (
            <Button size="small" icon={<SearchOutlined />} onClick={() => setSelectedTx(r)}>
              Khớp
            </Button>
          )}
          {r.trang_thai === 'da_doi_soat' && (
            <Button size="small" icon={<DisconnectOutlined />} onClick={() => unreconcileMut.mutate(r.id)}>
              Hủy khớp
            </Button>
          )}
          {r.trang_thai === 'chua_doi_soat' && (
            <Button size="small" icon={<StopOutlined />} onClick={() => ignoreMut.mutate(r.id)}>
              Bỏ qua
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const candidateColumns: ColumnsType<BankReconcileCandidate> = [
    { title: 'Loại', dataIndex: 'chung_tu_loai', width: 95, render: v => v === 'phieu_thu' ? 'Phiếu thu' : 'Phiếu chi' },
    { title: 'Số CT', dataIndex: 'so_chung_tu', width: 130 },
    { title: 'Ngày', dataIndex: 'ngay', width: 105, render: v => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Đối tượng', dataIndex: 'doi_tuong', ellipsis: true },
    { title: 'Diễn giải', dataIndex: 'dien_giai', ellipsis: true },
    { title: 'Số tiền', dataIndex: 'so_tien', align: 'right', width: 130, render: v => Number(v).toLocaleString('vi-VN') },
    {
      title: '',
      width: 90,
      render: (_, r) => (
        <Button
          size="small"
          type="primary"
          icon={<CheckCircleOutlined />}
          loading={reconcileMut.isPending}
          onClick={() => reconcileMut.mutate({ candidate: r })}
        >
          Khớp
        </Button>
      ),
    },
  ]

  return (
    <Card
      title={<Title level={4} style={{ margin: 0 }}>Đối soát ngân hàng</Title>}
      extra={
        <ImportExcelButton
          endpoint="/api/accounting/bank-transactions"
          templateFilename="mau_import_sao_ke_ngan_hang.xlsx"
          buttonText="Import sao kê"
          onImported={invalidate}
        />
      }
    >
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          allowClear
          style={{ width: 260 }}
          placeholder="Tất cả pháp nhân"
          value={phapNhanId}
          onChange={v => { setPhapNhanId(v); setBankAccountId(undefined) }}
          options={phapNhanList.map(p => ({ value: p.id, label: `[${p.ma_phap_nhan}] ${p.ten_phap_nhan}` }))}
        />
        <Select
          allowClear
          style={{ width: 280 }}
          placeholder="Tất cả tài khoản ngân hàng"
          value={bankAccountId}
          onChange={setBankAccountId}
          options={filteredAccounts.map(a => ({ value: a.id, label: `${a.ten_ngan_hang} - ${a.so_tai_khoan}` }))}
        />
        <Select
          allowClear
          style={{ width: 170 }}
          placeholder="Trạng thái"
          value={status}
          onChange={setStatus}
          options={Object.entries(STATUS_LABEL).map(([value, meta]) => ({ value, label: meta.text }))}
        />
        <RangePicker value={range} onChange={v => v && setRange([v[0]!, v[1]!])} format="DD/MM/YYYY" />
        <Button type="primary" icon={<SearchOutlined />} onClick={() => txQuery.refetch()}>
          Xem
        </Button>
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={txQuery.data?.items ?? []}
        loading={txQuery.isLoading}
        size="small"
        pagination={{ pageSize: 20, total: txQuery.data?.total }}
        scroll={{ x: 1100 }}
      />

      <Modal
        title={selectedTx ? `Gợi ý khớp giao dịch #${selectedTx.id}` : 'Gợi ý khớp'}
        open={!!selectedTx}
        onCancel={() => setSelectedTx(null)}
        footer={null}
        width={980}
      >
        <Table
          rowKey={r => `${r.chung_tu_loai}-${r.chung_tu_id}`}
          columns={candidateColumns}
          dataSource={candidates}
          loading={loadingCandidates}
          size="small"
          pagination={false}
          locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
        />
      </Modal>
    </Card>
  )
}
