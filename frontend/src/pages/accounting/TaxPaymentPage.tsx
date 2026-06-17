import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Button, Card, Checkbox, Col, DatePicker, InputNumber,
  Radio, Row, Select, Space, Table, Typography, message,
} from 'antd'
import { ArrowLeftOutlined, SendOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import axios from 'axios'
import { fmtVND } from '../../utils/exportUtils'
import { usePhapNhan, usePhanXuong } from '../../hooks/useMasterData'
import PageLayout from '../../components/PageLayout'
import EmptyState from '../../components/EmptyState'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Title, Text } = Typography

interface TaxObligationItem {
  loai_thue: string
  ten_khoan: string
  tk_no: string
  so_phai_nop: number
}

interface TaxPaymentItem {
  loai_thue: string
  ten_khoan: string
  tk_no: string
  tk_co: string
  so_tien: number
  dien_giai?: string
}

interface TaxPaymentCreate {
  ngay_phieu: string
  hinh_thuc_tt: string
  so_tai_khoan?: string
  phap_nhan_id?: number | null
  phan_xuong_id?: number | null
  items: TaxPaymentItem[]
}

interface TaxPaymentBatchResponse {
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

const taxApi = {
  getObligations: (params?: Record<string, unknown>): Promise<TaxObligationItem[]> =>
    authClient.get('/accounting/tax-obligations', { params }).then(r => r.data),
  createPayments: (body: TaxPaymentCreate): Promise<TaxPaymentBatchResponse> =>
    authClient
      .post<TaxPaymentBatchResponse>('/accounting/tax-payments', body)
      .then(r => r.data),
}

export default function TaxPaymentPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { phapNhanList } = usePhapNhan()
  const { phanXuongList } = usePhanXuong()

  const [ngayNop, setNgayNop] = useState(dayjs())
  const [hinhThucTt, setHinhThucTt] = useState<'chuyen_khoan' | 'tien_mat'>('chuyen_khoan')
  const [phapNhanId, setPhapNhanId] = useState<number | null>(null)
  const [phanXuongId, setPhanXuongId] = useState<number | null>(null)
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({})
  const [result, setResult] = useState<TaxPaymentBatchResponse | null>(null)

  const { data: obligations = [], isLoading } = useQuery({
    queryKey: ['tax-obligations', phapNhanId],
    queryFn: () =>
      taxApi.getObligations(phapNhanId != null ? { phap_nhan_id: phapNhanId } : undefined),
  })

  useEffect(() => {
    setRowStates(prev => {
      const next: Record<string, RowState> = {}
      for (const item of obligations) {
        const existing = prev[item.loai_thue]
        next[item.loai_thue] = existing ?? { selected: false, so_nop: item.so_phai_nop }
      }
      return next
    })
  }, [obligations])

  const getRow = (item: TaxObligationItem): RowState =>
    rowStates[item.loai_thue] ?? { selected: false, so_nop: item.so_phai_nop }

  const setRow = (loaiThue: string, patch: Partial<RowState>) => {
    setRowStates(prev => {
      const current = prev[loaiThue] ?? { selected: false, so_nop: 0 }
      return { ...prev, [loaiThue]: { ...current, ...patch } }
    })
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
    mutationFn: (body: TaxPaymentCreate) => taxApi.createPayments(body),
    onSuccess: res => {
      setResult(res)
      message.success(`Tạo thành công ${res.thanh_cong} phiếu chi`)
      queryClient.invalidateQueries({ queryKey: ['tax-obligations'] })
    },
    onError: () => {
      message.error('Tạo phiếu chi thất bại')
    },
  })

  const handleSubmit = () => {
    const tkCo = hinhThucTt === 'tien_mat' ? '111' : '112'
    const items: TaxPaymentItem[] = obligations
      .filter(item => {
        const row = getRow(item)
        return row.selected && row.so_nop > 0
      })
      .map(item => {
        const row = getRow(item)
        return {
          loai_thue: item.loai_thue,
          ten_khoan: item.ten_khoan,
          tk_no: item.tk_no,
          tk_co: tkCo,
          so_tien: row.so_nop,
          dien_giai: `Nộp ${item.ten_khoan}`,
        }
      })

    if (items.length === 0) return

    const body: TaxPaymentCreate = {
      ngay_phieu: ngayNop.format('YYYY-MM-DD'),
      hinh_thuc_tt: hinhThucTt,
      so_tai_khoan: undefined,
      phap_nhan_id: phapNhanId,
      phan_xuong_id: phanXuongId,
      items,
    }
    mutation.mutate(body)
  }

  const submitDisabled = selectedCount === 0 || tongNop === 0 || mutation.isPending

  const columns: ColumnsType<TaxObligationItem> = [
    {
      title: '',
      key: 'select',
      width: 40,
      align: 'center',
      render: (_, item) => (
        <Checkbox
          checked={getRow(item).selected}
          onChange={e => setRow(item.loai_thue, { selected: e.target.checked })}
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
            onChange={v => setRow(item.loai_thue, { so_nop: v ?? 0 })}
          />
        )
      },
    },
  ]
  const { displayColumns, settingsButton } = useColumnPrefs('accounting-tax-payment', columns)

  return (
    <PageLayout
      title="Nộp thuế"
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

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={5}>
            <Text strong>Ngày nộp thuế</Text>
            <DatePicker
              value={ngayNop}
              onChange={d => setNgayNop(d ?? dayjs())}
              format="DD/MM/YYYY"
              allowClear={false}
              style={{ width: '100%', marginTop: 4 }}
            />
          </Col>
          <Col xs={24} md={6}>
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
          <Col xs={24} md={5}>
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
          <Col xs={24} md={4} style={{ textAlign: 'right' }}>
            <Text type="secondary" style={{ display: 'block' }}>
              Số nộp lần này
            </Text>
            <Title level={3} style={{ margin: 0, color: '#E65100' }}>
              {fmtVND(tongNop)}
            </Title>
          </Col>
        </Row>
      </Card>

      <Card title="Chi tiết khoản thuế" extra={settingsButton}>
        <Table<TaxObligationItem>
          rowKey="loai_thue"
          loading={isLoading}
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
                title="Không có khoản thuế phải nộp"
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
              Nộp thuế ({selectedCount})
            </Button>
          </Space>
        </div>
      </Card>
    </PageLayout>
  )
}
