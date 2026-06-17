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
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Title, Text } = Typography

interface SalaryObligationItem {
  payroll_run_id: number
  employee_id: number
  ma_nv: string
  ho_ten: string
  don_vi: string | null
  so_tai_khoan: string | null
  ten_ngan_hang: string | null
  so_phai_tra: number
  so_tra: number
}

interface SalaryPaymentItem {
  payroll_run_id: number
  employee_id: number
  ho_ten: string
  so_tien: number
  tk_no: string
  tk_co: string
  dien_giai?: string
}

interface SalaryPaymentCreate {
  ngay_phieu: string
  thang: number
  nam: number
  hinh_thuc_tt: 'tien_mat' | 'chuyen_khoan'
  so_tai_khoan?: string
  phap_nhan_id?: number
  phan_xuong_id?: number
  items: SalaryPaymentItem[]
}

interface SalaryBatchResponse {
  tong_so: number
  thanh_cong: number
  that_bai: number
  tong_tien: number
  phieu_chi_ids: number[]
}

interface RowState {
  selected: boolean
  so_tra: number
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8001/api'
const authClient = axios.create({ baseURL: API_BASE })
authClient.interceptors.request.use(cfg => {
  const token = localStorage.getItem('access_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

const salaryApi = {
  getObligations: (thang: number, nam: number): Promise<SalaryObligationItem[]> =>
    authClient
      .get<SalaryObligationItem[]>('/accounting/salary-obligations', {
        params: { thang, nam },
      })
      .then(r => r.data),
  createPayments: (body: SalaryPaymentCreate): Promise<SalaryBatchResponse> =>
    authClient
      .post<SalaryBatchResponse>('/accounting/salary-payments', body)
      .then(r => r.data),
}

export default function SalaryPaymentPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { phapNhanList } = usePhapNhan()
  const { phanXuongList } = usePhanXuong()

  const [thangNam, setThangNam] = useState<Dayjs>(dayjs())
  const [ngayPhieu, setNgayPhieu] = useState<Dayjs>(dayjs())
  const [hinhThucTt, setHinhThucTt] = useState<'chuyen_khoan' | 'tien_mat'>('chuyen_khoan')
  const [phapNhanId, setPhapNhanId] = useState<number | null>(null)
  const [phanXuongId, setPhanXuongId] = useState<number | null>(null)
  const [rowStates, setRowStates] = useState<Record<number, RowState>>({})
  const [result, setResult] = useState<SalaryBatchResponse | null>(null)
  const [hasFetched, setHasFetched] = useState<boolean>(false)

  const thang = thangNam.month() + 1
  const nam = thangNam.year()

  const {
    data: obligations = [],
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['salary-obligations', thang, nam],
    queryFn: () => salaryApi.getObligations(thang, nam),
    enabled: false,
  })

  useEffect(() => {
    setRowStates(prev => {
      const next: Record<number, RowState> = {}
      for (const item of obligations) {
        const existing = prev[item.payroll_run_id]
        next[item.payroll_run_id] = existing ?? {
          selected: false,
          so_tra: item.so_phai_tra,
        }
      }
      return next
    })
  }, [obligations])

  const getRow = (item: SalaryObligationItem): RowState =>
    rowStates[item.payroll_run_id] ?? { selected: false, so_tra: item.so_phai_tra }

  const setRow = (payrollRunId: number, patch: Partial<RowState>): void => {
    setRowStates(prev => {
      const current = prev[payrollRunId] ?? { selected: false, so_tra: 0 }
      return { ...prev, [payrollRunId]: { ...current, ...patch } }
    })
  }

  const handleFetch = (): void => {
    setResult(null)
    setHasFetched(true)
    void refetch()
  }

  const tongTra = useMemo(
    () =>
      obligations.reduce((sum, item) => {
        const row = getRow(item)
        return row.selected ? sum + (row.so_tra || 0) : sum
      }, 0),
    [obligations, rowStates],
  )

  const tongPhaiTra = useMemo(
    () => obligations.reduce((sum, item) => sum + item.so_phai_tra, 0),
    [obligations],
  )

  const selectedCount = useMemo(
    () => obligations.filter(item => getRow(item).selected).length,
    [obligations, rowStates],
  )

  const mutation = useMutation({
    mutationFn: (body: SalaryPaymentCreate) => salaryApi.createPayments(body),
    onSuccess: res => {
      setResult(res)
      message.success(`Tạo thành công ${res.thanh_cong} phiếu chi`)
      queryClient.invalidateQueries({ queryKey: ['salary-obligations'] })
    },
    onError: () => {
      message.error('Tạo phiếu chi thất bại')
    },
  })

  const handleSubmit = (): void => {
    const tkCo = hinhThucTt === 'tien_mat' ? '111' : '112'
    const items: SalaryPaymentItem[] = obligations
      .filter(item => {
        const row = getRow(item)
        return row.selected && row.so_tra > 0
      })
      .map(item => {
        const row = getRow(item)
        return {
          payroll_run_id: item.payroll_run_id,
          employee_id: item.employee_id,
          ho_ten: item.ho_ten,
          so_tien: row.so_tra,
          tk_no: '334',
          tk_co: tkCo,
          dien_giai: `Tra luong ${item.ho_ten} thang ${thang}/${nam}`,
        }
      })

    if (items.length === 0) return

    const body: SalaryPaymentCreate = {
      ngay_phieu: ngayPhieu.format('YYYY-MM-DD'),
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

  const submitDisabled = selectedCount === 0 || tongTra === 0 || mutation.isPending
  const showEmptyWarning = hasFetched && !isFetching && obligations.length === 0

  const columns: ColumnsType<SalaryObligationItem> = [
    {
      title: '',
      key: 'select',
      width: 40,
      align: 'center',
      render: (_, item) => (
        <Checkbox
          checked={getRow(item).selected}
          onChange={e => setRow(item.payroll_run_id, { selected: e.target.checked })}
        />
      ),
    },
    {
      title: 'Mã nhân viên',
      dataIndex: 'ma_nv',
      key: 'ma_nv',
      width: 130,
    },
    {
      title: 'Tên nhân viên',
      dataIndex: 'ho_ten',
      key: 'ho_ten',
      ellipsis: true,
    },
    {
      title: 'Đơn vị',
      key: 'don_vi',
      width: 160,
      ellipsis: true,
      render: (_, item) => item.don_vi ?? '—',
    },
    {
      title: 'Số tài khoản',
      key: 'so_tai_khoan',
      width: 160,
      render: (_, item) => item.so_tai_khoan ?? '—',
    },
    {
      title: 'Tên ngân hàng',
      key: 'ten_ngan_hang',
      width: 180,
      ellipsis: true,
      render: (_, item) => item.ten_ngan_hang ?? '—',
    },
    {
      title: 'Số còn phải trả',
      dataIndex: 'so_phai_tra',
      key: 'so_phai_tra',
      width: 160,
      align: 'right',
      render: (value: number) => fmtVND(value),
    },
    {
      title: 'Số trả',
      key: 'so_tra',
      width: 160,
      align: 'right',
      render: (_, item) => {
        const row = getRow(item)
        return (
          <InputNumber<number>
            value={row.so_tra}
            min={0}
            max={item.so_phai_tra}
            disabled={!row.selected}
            controls={false}
            style={{ width: '100%', textAlign: 'right' }}
            formatter={v => (v == null ? '' : fmtVND(Number(v)))}
            parser={v => Number((v ?? '').replace(/[^\d]/g, '')) || 0}
            onChange={v => setRow(item.payroll_run_id, { so_tra: v ?? 0 })}
          />
        )
      },
    },
    {
      title: 'Chức năng',
      key: 'action',
      width: 110,
      align: 'center',
      render: (_, item) => (
        <Button
          size="small"
          disabled={!getRow(item).selected}
          onClick={() => setRow(item.payroll_run_id, { selected: false })}
        >
          Bỏ qua
        </Button>
      ),
    },
  ]
  const { displayColumns, settingsButton } = useColumnPrefs('accounting-salary-payment', columns, { nonHideable: ['ma_nv'] })

  return (
    <PageLayout
      title="Trả lương"
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
          message={`Không có lương chưa trả tháng ${thang}/${nam}. Kiểm tra bảng lương đã được chốt chưa.`}
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
            <Text strong>Ngày phiếu</Text>
            <DatePicker
              value={ngayPhieu}
              onChange={d => setNgayPhieu(d ?? dayjs())}
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
        title="Chi tiết lương phải trả"
        extra={
          <Space>
            <Text type="secondary">
              Số trả:{' '}
              <Text strong style={{ color: '#E65100' }}>
                {fmtVND(tongTra)}
              </Text>
            </Text>
            {settingsButton}
          </Space>
        }
      >
        <Table<SalaryObligationItem>
          rowKey="payroll_run_id"
          loading={isFetching}
          dataSource={obligations}
          columns={displayColumns}
          pagination={false}
          size="middle"
          scroll={{ x: 'max-content' }}
          rowClassName={item => (getRow(item).selected ? 'ant-table-row-selected' : '')}
          locale={{
            emptyText: hasFetched
              ? 'Không có lương phải trả'
              : 'Chọn kỳ rồi bấm "Lấy dữ liệu"',
          }}
          summary={() => {
            if (obligations.length === 0) return null
            return (
              <Table.Summary fixed="bottom">
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={6} align="right">
                    <Text strong>Cộng:</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={6} align="right">
                    <Text strong>{fmtVND(tongPhaiTra)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={7} align="right">
                    <Text strong style={{ color: '#E65100' }}>{fmtVND(tongTra)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={8} />
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
              Trả lương ({selectedCount})
            </Button>
          </Space>
        </div>
      </Card>
    </PageLayout>
  )
}
