import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  HistoryOutlined,
  LockOutlined,
  SyncOutlined,
  UnlockOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { phapNhanApi } from '../../api/phap_nhan'
import {
  journalApi,
  periodClosingApi,
  type AccountingPeriodLock,
  type ClosingReadinessCheck,
} from '../../api/accounting'
import { fmtVND } from '../../utils/exportUtils'

const { Title, Text } = Typography

interface JournalEntryRow {
  id: number
  so_but_toan?: string
  ngay_but_toan?: string
  dien_giai?: string
  tong_no?: number
  tong_co?: number
}

export default function PeriodClosingPage() {
  const [month, setMonth] = useState<dayjs.Dayjs>(dayjs().subtract(1, 'month'))
  const [phapNhanId, setPhapNhanId] = useState<number | undefined>()
  const [unlockTarget, setUnlockTarget] = useState<AccountingPeriodLock | null>(null)
  const [unlockReason, setUnlockReason] = useState('')

  const selectedPeriod = useMemo(() => ({
    thang: month.month() + 1,
    nam: month.year(),
  }), [month])

  const { data: listPhapNhan = [] } = useQuery({
    queryKey: ['phap-nhan-list'],
    queryFn: () => phapNhanApi.list().then(r => r.data),
  })

  const {
    data: historyData,
    isLoading: historyLoading,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ['closing-history', phapNhanId],
    queryFn: () => journalApi.list({
      loai_but_toan: 'ket_chuyen',
      phap_nhan_id: phapNhanId,
      page_size: 50,
    }),
    enabled: !!phapNhanId,
  })

  const {
    data: periodLocks = [],
    isLoading: locksLoading,
    refetch: refetchLocks,
  } = useQuery({
    queryKey: ['accounting-period-locks', phapNhanId, selectedPeriod.nam],
    queryFn: () => periodClosingApi.listLocks({
      phap_nhan_id: phapNhanId,
      nam: selectedPeriod.nam,
    }),
    enabled: !!phapNhanId,
  })

  const selectedLock = periodLocks.find(lock =>
    lock.thang === selectedPeriod.thang &&
    lock.nam === selectedPeriod.nam &&
    lock.trang_thai === 'locked',
  )

  const {
    data: readiness,
    isLoading: readinessLoading,
    refetch: refetchReadiness,
  } = useQuery({
    queryKey: ['accounting-closing-readiness', phapNhanId, selectedPeriod.thang, selectedPeriod.nam],
    queryFn: () => periodClosingApi.readiness({
      thang: selectedPeriod.thang,
      nam: selectedPeriod.nam,
      phap_nhan_id: phapNhanId as number,
      limit: 50,
    }),
    enabled: !!phapNhanId,
  })

  const closingMutation = useMutation({
    mutationFn: periodClosingApi.performClosing,
    onSuccess: (result) => {
      Modal.success({
        title: 'Đã kết chuyển và khóa sổ',
        content: `Bút toán ${result.so_but_toan}. Lãi/lỗ trong kỳ: ${fmtVND(result.lai_lo)}.`,
      })
      refetchHistory()
      refetchLocks()
      refetchReadiness()
    },
    onError: (err: Error & { response?: { data?: { detail?: string } } }) => {
      message.error(err.response?.data?.detail || err.message)
    },
  })

  const unlockMutation = useMutation({
    mutationFn: periodClosingApi.unlock,
    onSuccess: () => {
      message.success('Đã mở khóa kỳ kế toán')
      setUnlockTarget(null)
      setUnlockReason('')
      refetchLocks()
      refetchReadiness()
    },
    onError: (err: Error & { response?: { data?: { detail?: string } } }) => {
      message.error(err.response?.data?.detail || err.message)
    },
  })

  const handleClosing = () => {
    if (!phapNhanId) {
      message.warning('Vui lòng chọn pháp nhân')
      return
    }
    if (readiness && !readiness.can_close) {
      message.error('Kỳ này còn lỗi chặn khóa sổ, vui lòng xử lý checklist trước')
      return
    }
    Modal.confirm({
      title: `Kết chuyển và khóa sổ ${month.format('MM/YYYY')}?`,
      icon: <ExclamationCircleOutlined />,
      content: 'Hệ thống sẽ tạo bút toán kết chuyển doanh thu/chi phí và khóa kỳ này. Muốn sửa số liệu sau đó phải mở khóa có lý do.',
      okText: 'Chạy kết chuyển',
      cancelText: 'Hủy',
      onOk: () => closingMutation.mutate({
        thang: selectedPeriod.thang,
        nam: selectedPeriod.nam,
        phap_nhan_id: phapNhanId,
      }),
    })
  }

  const confirmUnlock = () => {
    if (!unlockTarget || !phapNhanId) return
    if (unlockReason.trim().length < 3) {
      message.warning('Vui lòng nhập lý do mở khóa')
      return
    }
    unlockMutation.mutate({
      thang: unlockTarget.thang,
      nam: unlockTarget.nam,
      phap_nhan_id: phapNhanId,
      ly_do_mo_khoa: unlockReason.trim(),
    })
  }

  const historyRows: JournalEntryRow[] = Array.isArray(historyData?.items) ? historyData.items : []
  const readinessErrors = readiness?.total_errors || 0
  const readinessWarnings = readiness?.total_warnings || 0

  const lockColumns: ColumnsType<AccountingPeriodLock> = [
    {
      title: 'Kỳ',
      render: (_, row) => `${String(row.thang).padStart(2, '0')}/${row.nam}`,
      width: 90,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      render: (value: string) => (
        <Tag color={value === 'locked' ? 'red' : 'green'} icon={value === 'locked' ? <LockOutlined /> : <UnlockOutlined />}>
          {value === 'locked' ? 'Đã khóa' : 'Đã mở'}
        </Tag>
      ),
      width: 130,
    },
    {
      title: 'Khóa lúc',
      dataIndex: 'locked_at',
      render: (value?: string | null) => value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '-',
      width: 160,
    },
    {
      title: 'Lý do',
      render: (_, row) => row.trang_thai === 'locked' ? row.ly_do_khoa || '-' : row.ly_do_mo_khoa || '-',
    },
    {
      title: '',
      render: (_, row) => row.trang_thai === 'locked' ? (
        <Button size="small" icon={<UnlockOutlined />} onClick={() => setUnlockTarget(row)}>
          Mở khóa
        </Button>
      ) : null,
      width: 110,
    },
  ]

  const readinessColumns: ColumnsType<ClosingReadinessCheck> = [
    {
      title: 'Hạng mục',
      dataIndex: 'label',
      width: 190,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 120,
      render: (value: string) => {
        const color = value === 'fail' ? 'red' : value === 'warn' ? 'gold' : 'green'
        const label = value === 'fail' ? 'Lỗi' : value === 'warn' ? 'Cảnh báo' : 'Đạt'
        return <Tag color={color}>{label}</Tag>
      },
    },
    {
      title: 'Lỗi',
      dataIndex: 'errors',
      align: 'right',
      width: 70,
    },
    {
      title: 'Cảnh báo',
      dataIndex: 'warnings',
      align: 'right',
      width: 90,
    },
    {
      title: 'Kết quả',
      dataIndex: 'message',
    },
  ]

  const historyColumns: ColumnsType<JournalEntryRow> = [
    {
      title: 'Ngày',
      dataIndex: 'ngay_but_toan',
      render: (value?: string) => value ? dayjs(value).format('DD/MM/YYYY') : '-',
      width: 110,
    },
    {
      title: 'Số bút toán',
      dataIndex: 'so_but_toan',
      width: 150,
    },
    {
      title: 'Diễn giải',
      dataIndex: 'dien_giai',
    },
    {
      title: 'Tổng Nợ',
      dataIndex: 'tong_no',
      render: (value?: number) => fmtVND(value || 0),
      align: 'right',
      width: 140,
    },
    {
      title: 'Tổng Có',
      dataIndex: 'tong_co',
      render: (value?: number) => fmtVND(value || 0),
      align: 'right',
      width: 140,
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Space size="middle">
            <LockOutlined style={{ fontSize: 32, color: '#cf1322' }} />
            <div>
              <Title level={2} style={{ margin: 0 }}>Kết chuyển và khóa sổ</Title>
              <Text type="secondary">Chốt lãi/lỗ theo pháp nhân, khóa kỳ và lưu audit mở khóa.</Text>
            </div>
          </Space>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title="Thực hiện">
            <Form layout="vertical">
              <Form.Item label="Pháp nhân" required>
                <Select
                  placeholder="Chọn pháp nhân"
                  value={phapNhanId}
                  onChange={setPhapNhanId}
                  options={listPhapNhan.map((p) => ({
                    value: p.id,
                    label: p.ten_viet_tat || p.ten_phap_nhan || `Pháp nhân #${p.id}`,
                  }))}
                />
              </Form.Item>
              <Form.Item label="Kỳ kế toán" required>
                <DatePicker
                  picker="month"
                  value={month}
                  onChange={(value) => value && setMonth(value)}
                  format="MM/YYYY"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Form>

            {selectedLock ? (
              <Alert
                type="warning"
                showIcon
                message="Kỳ này đã khóa sổ"
                description="Cần mở khóa có lý do trước khi sửa chứng từ hoặc chạy lại kết chuyển."
                style={{ marginBottom: 16 }}
              />
            ) : readinessErrors > 0 ? (
              <Alert
                type="error"
                showIcon
                message="Chưa đủ điều kiện khóa sổ"
                description={`Còn ${readinessErrors} lỗi cần xử lý trong checklist.`}
                style={{ marginBottom: 16 }}
              />
            ) : readinessWarnings > 0 ? (
              <Alert
                type="warning"
                showIcon
                message="Có cảnh báo trước khi khóa sổ"
                description={`Có ${readinessWarnings} cảnh báo nên xem lại trước khi chốt.`}
                style={{ marginBottom: 16 }}
              />
            ) : (
              <Alert
                type="success"
                showIcon
                message="Sẵn sàng khóa sổ"
                description="Checklist trước khi khóa sổ không có lỗi chặn."
                style={{ marginBottom: 16 }}
              />
            )}

            <Button
              type="primary"
              danger
              block
              size="large"
              icon={<SyncOutlined />}
              disabled={!phapNhanId || !!selectedLock || readinessLoading || !!readinessErrors}
              loading={closingMutation.isPending}
              onClick={handleClosing}
            >
              Chạy kết chuyển và khóa sổ
            </Button>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic title="Kỳ đang xem" value={month.format('MM/YYYY')} prefix={<HistoryOutlined />} />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic title="Trạng thái kỳ" value={selectedLock ? 'Đã khóa' : 'Đang mở'} prefix={selectedLock ? <LockOutlined /> : <UnlockOutlined />} />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic title="Lỗi checklist" value={readinessErrors} valueStyle={{ color: readinessErrors ? '#cf1322' : '#3f8600' }} prefix={<CheckCircleOutlined />} />
              </Card>
            </Col>
          </Row>

          <Card title="Checklist trước khi khóa sổ" style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              <Col xs={24} sm={8}>
                <Statistic title="Kết luận" value={readiness?.can_close ? 'Đạt' : 'Chưa đạt'} />
              </Col>
              <Col xs={24} sm={8}>
                <Statistic title="Lỗi chặn" value={readinessErrors} valueStyle={{ color: readinessErrors ? '#cf1322' : '#3f8600' }} />
              </Col>
              <Col xs={24} sm={8}>
                <Statistic title="Cảnh báo" value={readinessWarnings} valueStyle={{ color: readinessWarnings ? '#d48806' : undefined }} />
              </Col>
            </Row>
            <Table
              size="small"
              dataSource={readiness?.checks || []}
              columns={readinessColumns}
              rowKey="key"
              loading={readinessLoading}
              pagination={false}
            />
          </Card>

          <Card title="Khóa sổ theo kỳ" style={{ marginBottom: 16 }}>
            <Table
              size="small"
              dataSource={periodLocks}
              columns={lockColumns}
              rowKey="id"
              loading={locksLoading}
              pagination={{ pageSize: 8 }}
            />
          </Card>

          <Card title="Lịch sử bút toán kết chuyển">
            <Table
              size="small"
              dataSource={historyRows}
              columns={historyColumns}
              rowKey="id"
              loading={historyLoading}
              pagination={{ pageSize: 8 }}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title={unlockTarget ? `Mở khóa kỳ ${String(unlockTarget.thang).padStart(2, '0')}/${unlockTarget.nam}` : 'Mở khóa kỳ'}
        open={!!unlockTarget}
        okText="Mở khóa"
        cancelText="Hủy"
        confirmLoading={unlockMutation.isPending}
        onOk={confirmUnlock}
        onCancel={() => {
          setUnlockTarget(null)
          setUnlockReason('')
        }}
      >
        <Input.TextArea
          rows={4}
          value={unlockReason}
          onChange={(event) => setUnlockReason(event.target.value)}
          placeholder="Nhập lý do mở khóa"
        />
      </Modal>
    </div>
  )
}
