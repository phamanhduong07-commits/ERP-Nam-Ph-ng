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
        title: 'Da ket chuyen va khoa so',
        content: `But toan ${result.so_but_toan}. Lai/lo trong ky: ${fmtVND(result.lai_lo)}.`,
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
      message.success('Da mo khoa ky ke toan')
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
      message.warning('Vui long chon phap nhan')
      return
    }
    if (readiness && !readiness.can_close) {
      message.error('Ky nay con loi chan khoa so, vui long xu ly checklist truoc')
      return
    }
    Modal.confirm({
      title: `Ket chuyen va khoa so ${month.format('MM/YYYY')}?`,
      icon: <ExclamationCircleOutlined />,
      content: 'He thong se tao but toan ket chuyen doanh thu/chi phi va khoa ky nay. Muon sua so lieu sau do phai mo khoa co ly do.',
      okText: 'Chay ket chuyen',
      cancelText: 'Huy',
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
      message.warning('Vui long nhap ly do mo khoa')
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
      title: 'Ky',
      render: (_, row) => `${String(row.thang).padStart(2, '0')}/${row.nam}`,
      width: 90,
    },
    {
      title: 'Trang thai',
      dataIndex: 'trang_thai',
      render: (value: string) => (
        <Tag color={value === 'locked' ? 'red' : 'green'} icon={value === 'locked' ? <LockOutlined /> : <UnlockOutlined />}>
          {value === 'locked' ? 'Da khoa' : 'Da mo'}
        </Tag>
      ),
      width: 130,
    },
    {
      title: 'Khoa luc',
      dataIndex: 'locked_at',
      render: (value?: string | null) => value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '-',
      width: 160,
    },
    {
      title: 'Ly do',
      render: (_, row) => row.trang_thai === 'locked' ? row.ly_do_khoa || '-' : row.ly_do_mo_khoa || '-',
    },
    {
      title: '',
      render: (_, row) => row.trang_thai === 'locked' ? (
        <Button size="small" icon={<UnlockOutlined />} onClick={() => setUnlockTarget(row)}>
          Mo khoa
        </Button>
      ) : null,
      width: 110,
    },
  ]

  const readinessColumns: ColumnsType<ClosingReadinessCheck> = [
    {
      title: 'Hang muc',
      dataIndex: 'label',
      width: 190,
    },
    {
      title: 'Trang thai',
      dataIndex: 'status',
      width: 120,
      render: (value: string) => {
        const color = value === 'fail' ? 'red' : value === 'warn' ? 'gold' : 'green'
        const label = value === 'fail' ? 'Loi' : value === 'warn' ? 'Canh bao' : 'Dat'
        return <Tag color={color}>{label}</Tag>
      },
    },
    {
      title: 'Loi',
      dataIndex: 'errors',
      align: 'right',
      width: 70,
    },
    {
      title: 'Canh bao',
      dataIndex: 'warnings',
      align: 'right',
      width: 90,
    },
    {
      title: 'Ket qua',
      dataIndex: 'message',
    },
  ]

  const historyColumns: ColumnsType<JournalEntryRow> = [
    {
      title: 'Ngay',
      dataIndex: 'ngay_but_toan',
      render: (value?: string) => value ? dayjs(value).format('DD/MM/YYYY') : '-',
      width: 110,
    },
    {
      title: 'So but toan',
      dataIndex: 'so_but_toan',
      width: 150,
    },
    {
      title: 'Dien giai',
      dataIndex: 'dien_giai',
    },
    {
      title: 'Tong No',
      dataIndex: 'tong_no',
      render: (value?: number) => fmtVND(value || 0),
      align: 'right',
      width: 140,
    },
    {
      title: 'Tong Co',
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
              <Title level={2} style={{ margin: 0 }}>Ket chuyen va khoa so</Title>
              <Text type="secondary">Chot lai/lo theo phap nhan, khoa ky va luu audit mo khoa.</Text>
            </div>
          </Space>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title="Thuc hien">
            <Form layout="vertical">
              <Form.Item label="Phap nhan" required>
                <Select
                  placeholder="Chon phap nhan"
                  value={phapNhanId}
                  onChange={setPhapNhanId}
                  options={listPhapNhan.map((p) => ({
                    value: p.id,
                    label: p.ten_viet_tat || p.ten_phap_nhan || `Phap nhan #${p.id}`,
                  }))}
                />
              </Form.Item>
              <Form.Item label="Ky ke toan" required>
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
                message="Ky nay da khoa so"
                description="Can mo khoa co ly do truoc khi sua chung tu hoac chay lai ket chuyen."
                style={{ marginBottom: 16 }}
              />
            ) : readinessErrors > 0 ? (
              <Alert
                type="error"
                showIcon
                message="Chua du dieu kien khoa so"
                description={`Con ${readinessErrors} loi can xu ly trong checklist.`}
                style={{ marginBottom: 16 }}
              />
            ) : readinessWarnings > 0 ? (
              <Alert
                type="warning"
                showIcon
                message="Co canh bao truoc khi khoa so"
                description={`Co ${readinessWarnings} canh bao nen xem lai truoc khi chot.`}
                style={{ marginBottom: 16 }}
              />
            ) : (
              <Alert
                type="success"
                showIcon
                message="San sang khoa so"
                description="Checklist truoc khi khoa so khong co loi chan."
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
              Chay ket chuyen va khoa so
            </Button>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic title="Ky dang xem" value={month.format('MM/YYYY')} prefix={<HistoryOutlined />} />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic title="Trang thai ky" value={selectedLock ? 'Da khoa' : 'Dang mo'} prefix={selectedLock ? <LockOutlined /> : <UnlockOutlined />} />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic title="Loi checklist" value={readinessErrors} valueStyle={{ color: readinessErrors ? '#cf1322' : '#3f8600' }} prefix={<CheckCircleOutlined />} />
              </Card>
            </Col>
          </Row>

          <Card title="Checklist truoc khi khoa so" style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              <Col xs={24} sm={8}>
                <Statistic title="Ket luan" value={readiness?.can_close ? 'Dat' : 'Chua dat'} />
              </Col>
              <Col xs={24} sm={8}>
                <Statistic title="Loi chan" value={readinessErrors} valueStyle={{ color: readinessErrors ? '#cf1322' : '#3f8600' }} />
              </Col>
              <Col xs={24} sm={8}>
                <Statistic title="Canh bao" value={readinessWarnings} valueStyle={{ color: readinessWarnings ? '#d48806' : undefined }} />
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

          <Card title="Khoa so theo ky" style={{ marginBottom: 16 }}>
            <Table
              size="small"
              dataSource={periodLocks}
              columns={lockColumns}
              rowKey="id"
              loading={locksLoading}
              pagination={{ pageSize: 8 }}
            />
          </Card>

          <Card title="Lich su but toan ket chuyen">
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
        title={unlockTarget ? `Mo khoa ky ${String(unlockTarget.thang).padStart(2, '0')}/${unlockTarget.nam}` : 'Mo khoa ky'}
        open={!!unlockTarget}
        okText="Mo khoa"
        cancelText="Huy"
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
          placeholder="Nhap ly do mo khoa"
        />
      </Modal>
    </div>
  )
}
