import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Button, Card, Checkbox, Col, DatePicker, InputNumber,
  Radio, Row, Select, Space, Table, Typography, message,
} from 'antd'
import { ArrowLeftOutlined, SendOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import axios from 'axios'
import { fmtVND } from '../../utils/exportUtils'
import { usePhapNhan, usePhanXuong } from '../../hooks/useMasterData'
import PageLayout from '../../components/PageLayout'
import EmptyState from '../../components/EmptyState'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Title, Text } = Typography

interface InsuranceObligationItem {
  loai_bh: string
  ten_khoan: string
  tk_no: string
  so_phai_nop: number
  so_nop_lan_nay: number
}

interface InsurancePaymentItem {
  loai_bh: string
  ten_khoan: string
  tk_no: string
  tk_co: string
  so_tien: number
  dien_giai?: string
}

interface InsurancePaymentCreate {
  ngay_phieu: string
  thang: number
  nam: number
  hinh_thuc_tt: 'tien_mat' | 'chuyen_khoan'
  so_tai_khoan?: string
  phap_nhan_id?: number
  phan_xuong_id?: number
  items: InsurancePaymentItem[]
}

interface InsuranceBatchResponse {
  tong_so: number
  thanh_cong: number
  that_bai: number
  tong_tien: number
  phieu_chi_ids: number[]
}

interface RowState {
  selected: boolean
  so_nop: number
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8001/api'
const authClient = axios.create({ baseURL: API_BASE })
authClient.interceptors.request.use(cfg => {
  const token = localStorage.getItem('access_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

const insuranceApi = {
  getObligations: (thang: number, nam: number): Promise<InsuranceObligationItem[]> =>
    authClient
      .get<InsuranceObligationItem[]>('/accounting/insurance-obligations', {
        params: { thang, nam },
      })
      .then(r => r.data),
  createPayments: (body: InsurancePaymentCreate): Promise<InsuranceBatchResponse> =>
    authClient
      .post<InsuranceBatchResponse>('/accounting/insurance-payments', body)
      .then(r => r.data),
}

export default function InsurancePaymentPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { phapNhanList } = usePhapNhan()
  const { phanXuongList } = usePhanXuong()

  const [thangNam, setThangNam] = useState<Dayjs>(dayjs())
  const [ngayNop, setNgayNop] = useState<Dayjs>(dayjs())
  const [hinhThucTt, setHinhThucTt] = useState<'chuyen_khoan' | 'tien_mat'>('chuyen_khoan')
  const [phapNhanId, setPhapNhanId] = useState<number | null>(null)
  const [phanXuongId, setPhanXuongId] = useState<number | null>(null)
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({})
  const [result, setResult] = useState<InsuranceBatchResponse | null>(null)
  const [hasFetched, setHasFetched] = useState<boolean>(false)

  const thang = thangNam.month() + 1
  const nam = thangNam.year()

  const {
    data: obligations = [],
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['insurance-obligations', thang, nam],
    queryFn: () => insuranceApi.getObligations(thang, nam),
    enabled: false,
  })

  useEffect(() => {
    setRowStates(prev => {
      const next: Record<string, RowState> = {}
      for (const item of obligations) {
        const existing = prev[item.loai_bh]
        next[item.loai_bh] = existing ?? {
          selected: false,
          so_nop: item.so_nop_lan_nay > 0 ? item.so_nop_lan_nay : item.so_phai_nop,
        }
      }
      return next
    })
  }, [obligations])

  const getRow = (item: InsuranceObligationItem): RowState =>
    rowStates[item.loai_bh] ?? { selected: false, so_nop: item.so_phai_nop }

  const setRow = (loaiBh: string, patch: Partial<RowState>): void => {
    setRowStates(prev => {
      const current = prev[loaiBh] ?? { selected: false, so_nop: 0 }
      return { ...prev, [loaiBh]: { ...current, ...patch } }
    })
  }

  const handleFetch = (): void => {
    setResult(null)
    setHasFetched(true)
    void refetch()
  }

  const tongNop = useMemo(
    () =>
      obligations.reduce((sum, item) => {
        const row = getRow(item)
        return row.selected ? sum + (row.so_nop || 0) : sum
      }, 0),
    [obligations, rowStates],
  )

  const tongPhaiNop = useMemo(
    () => obligations.reduce((sum, item) => sum + item.so_phai_nop, 0),
    [obligations],
  )

  const selectedCount = useMemo(
    () => obligations.filter(item => getRow(item).selected).length,
    [obligations, rowStates],
  )

  const mutation = useMutation({
    mutationFn: (body: InsurancePaymentCreate) => insuranceApi.createPayments(body),
    onSuccess: res => {
      setResult(res)
      message.success(`Tạo thành công ${res.thanh_cong} phiếu chi`)
      queryClient.invalidateQueries({ queryKey: ['insurance-obligations'] })
    },
    onError: () => {
      message.error('Tạo phiếu chi thất bại')
    },
  })

  const handleSubmit = (): void => {
    const tkCo = hinhThucTt === 'tien_mat' ? '111' : '112'
    const items: InsurancePaymentItem[] = obligations
      .filter(item => {
        const row = getRow(item)
        return row.selected && row.so_nop > 0
      })
      .map(item => {
        const row = getRow(item)
        return {
          loai_bh: item.loai_bh,
          ten_khoan: item.ten_khoan,
          tk_no: item.tk_no,
          tk_co: tkCo,
          so_tien: row.so_nop,
          dien_giai: `Nộp ${item.ten_khoan} tháng ${thang}/${nam}`,
        }
      })

    if (items.length === 0) return

    const body: InsurancePaymentCreate = {
      ngay_phieu: ngayNop.format('YYYY-MM-DD'),
      thang,
      nam,
      hinh_thuc_tt: hinhThucTt,
      so_tai_khoan: undefined,
      phap_nhan_id: phapNhanId ?? undefined,
      phan_xuong_id: phanXuongId ?? undefined,
      items,
    }
    mutation.mutate(body)
  }

  const submitDisabled = selectedCount === 0 || tongNop === 0 || mutation.isPending
  const showEmptyWarning = hasFetched && !isFetching && obligations.length === 0

  const columns: ColumnsType<InsuranceObligationItem> = [
    {
      title: '',
      key: 'select',
      width: 40,
      align: 'center',
      render: (_, item) => (
        <Checkbox
          checked={getRow(item).selected}
          onChange={e => setRow(item.loai_bh, { selected: e.target.checked })}
        />
      ),
    },
    {
      title: 'Khoản phải nộp',
      dataIndex: 'ten_khoan',
      key: 'ten_khoan',
      ellipsis: true,
    },
    {
      title: 'Số phải nộp',
      dataIndex: 'so_phai_nop',
      key: 'so_phai_nop',
      width: 160,
      align: 'right',
      render: (value: number) => fmtVND(value),
    },
    {
      title: 'Số nộp lần này',
      key: 'so_nop',
      width: 160,
      align: 'right',
      render: (_, item) => {
        const row = getRow(item)
        return (
          <InputNumber<number>
            value={row.so_nop}
            min={0}
            max={item.so_phai_nop}
            disabled={!row.selected}
            controls={false}
            style={{ width: '100%', textAlign: 'right' }}
            formatter={v => (v == null ? '' : fmtVND(Number(v)))}
            parser={v => Number((v ?? '').replace(/[^\d]/g, '')) || 0}
            onChange={v => setRow(item.loai_bh, { so_nop: v ?? 0 })}
          />
        )
      },
    },
  ]
  const { displayColumns, settingsButton } = useColumnPrefs('accounting-insurance-payment', columns)

  return (
    <PageLayout
      title="Nộp bảo hiểm"
      actions={
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          Quay lại
        </Button>
      }
    >
      {result && (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          message={`Tạo thành công ${result.thanh_cong} phiếu chi`}
          description={
            <a onClick={() => navigate('/accounting/payments')}>
              Xem danh sách phiếu chi →
            </a>
          }
          closable
          onClose={() => setResult(null)}
        />
      )}

      {showEmptyWarning && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`Không có dữ liệu bảo hiểm tháng ${thang}/${nam}. Kiểm tra bảng lương đã được duyệt chưa.`}
        />
      )}

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={4}>
            <Text strong>Kỳ (tháng)</Text>
            <DatePicker
              picker="month"
              value={thangNam}
              onChange={d => setThangNam(d ?? dayjs())}
              format="MM/YYYY"
              allowClear={false}
              style={{ width: '100%', marginTop: 4 }}
            />
          </Col>
          <Col xs={24} md={4}>
            <Text strong>Ngày nộp</Text>
            <DatePicker
              value={ngayNop}
              onChange={d => setNgayNop(d ?? dayjs())}
              format="DD/MM/YYYY"
              allowClear={false}
              style={{ width: '100%', marginTop: 4 }}
            />
          </Col>
          <Col xs={24} md={5}>
            <Text strong>Phương thức</Text>
            <div style={{ marginTop: 4 }}>
              <Radio.Group
                value={hinhThucTt}
                onChange={e => setHinhThucTt(e.target.value)}
              >
                <Radio value="chuyen_khoan">Tiền gửi</Radio>
                <Radio value="tien_mat">Tiền mặt</Radio>
              </Radio.Group>
            </div>
          </Col>
          <Col xs={24} md={4}>
            <Text strong>Pháp nhân</Text>
            <Select
              value={phapNhanId}
              onChange={v => setPhapNhanId(v ?? null)}
              allowClear
              placeholder="Chọn pháp nhân"
              style={{ width: '100%', marginTop: 4 }}
              options={phapNhanList.map(p => ({ value: p.id, label: p.ten_phap_nhan }))}
            />
          </Col>
          <Col xs={24} md={4}>
            <Text strong>Xưởng</Text>
            <Select
              value={phanXuongId}
              onChange={v => setPhanXuongId(v ?? null)}
              allowClear
              placeholder="Chọn xưởng"
              style={{ width: '100%', marginTop: 4 }}
              options={phanXuongList.map(x => ({ value: x.id, label: x.ten_xuong }))}
            />
          </Col>
          <Col xs={24} md={3} style={{ textAlign: 'right' }}>
            <div style={{ marginTop: 22 }}>
              <Button
                type="default"
                icon={<ReloadOutlined />}
                loading={isFetching}
                onClick={handleFetch}
              >
                Lấy dữ liệu
              </Button>
            </div>
          </Col>
        </Row>
      </Card>

      <Card
        title="Chi tiết khoản bảo hiểm"
        extra={
          <Space>
            <Text type="secondary">
              Số nộp lần này:{' '}
              <Text strong style={{ color: '#E65100' }}>
                {fmtVND(tongNop)}
              </Text>
            </Text>
            {settingsButton}
          </Space>
        }
      >
        <Table<InsuranceObligationItem>
          rowKey="loai_bh"
          loading={isFetching}
          dataSource={obligations}
          columns={displayColumns}
          pagination={false}
          size="middle"
          rowClassName={item => (getRow(item).selected ? 'ant-table-row-selected' : '')}
          locale={{
            emptyText: (
              <EmptyState
                size="small"
                preset="document"
                title={
                  hasFetched
                    ? 'Không có khoản bảo hiểm phải nộp'
                    : 'Chọn kỳ rồi bấm "Lấy dữ liệu"'
                }
              />
            ),
          }}
          summary={() => {
            if (obligations.length === 0) return null
            return (
              <Table.Summary fixed="bottom">
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={2} align="right">
                    <Text strong>Cộng:</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right">
                    <Text strong>{fmtVND(tongPhaiNop)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">
                    <Text strong style={{ color: '#E65100' }}>{fmtVND(tongNop)}</Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )
          }}
        />

        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Space>
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={mutation.isPending}
              disabled={submitDisabled}
              onClick={handleSubmit}
            >
              Nộp bảo hiểm ({selectedCount})
            </Button>
          </Space>
        </div>
      </Card>
    </PageLayout>
  )
}
