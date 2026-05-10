import { useState, useRef, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Button, Space, Typography, Input, InputNumber, Modal, Form,
  message, Tag, Row, Col, Spin, Empty, Divider
} from 'antd'
import {
  PlayCircleFilled, CheckCircleFilled, PauseCircleFilled,
  ArrowLeftOutlined, ScanOutlined, WarningFilled,
  DesktopOutlined, HistoryOutlined as HistoryIcon, LogoutOutlined, CameraOutlined
} from '@ant-design/icons'
import { useSearchParams, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { useAuthStore } from '../../store/auth'
import { cd2Api, Machine, ProductionLog, WorkerSession } from '../../api/cd2'
import { useCD2Workshop } from '../../hooks/useCD2Workshop'
import QrScannerModal from '../../components/QrScannerModal'

const { Title, Text } = Typography

export default function MobileTrackingPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const machineIdFromUrl = searchParams.get('machine_id')

  const workerSession = useMemo<WorkerSession | null>(() => {
    try {
      const raw = localStorage.getItem('cd2_worker_session')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  }, [])

  const { phanXuongId, phanXuongList } = useCD2Workshop()

  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null)
  const [soLsx, setSoLsx] = useState('')
  const [currentOrder, setCurrentOrder] = useState<any>(null)
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false)
  const [isStopModalOpen, setIsStopModalOpen] = useState(false)
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false)
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [form] = Form.useForm()

  const lsxInputRef = useRef<any>(null)

  const { data: machines = [], isLoading: loadingMachines } = useQuery({
    queryKey: ['machines', phanXuongId],
    queryFn: () => cd2Api.listMachines(phanXuongId ? { phan_xuong_id: phanXuongId } : undefined).then(r => r.data),
  })

  const { user } = useAuthStore()

  // Lấy nhật ký tổng hợp (Tất cả máy) để công nhân xem tình hình chung
  const { data: factoryLogs = [] } = useQuery({
    queryKey: ['factory-logs'],
    queryFn: () => cd2Api.getMachineLogs(0).then(r => r.data),
    refetchInterval: 60000
  })

  useEffect(() => {
    if (machines.length === 0) return

    // 1. Worker session (machine login) — highest priority
    if (workerSession?.machine_id) {
      const target = machines.find(m => m.id === workerSession.machine_id)
      if (target) { setSelectedMachine(target); return }
    }

    // 2. URL param (QR code)
    if (machineIdFromUrl) {
      const target = machines.find(m => m.id === parseInt(machineIdFromUrl))
      if (target) { setSelectedMachine(target); return }
    }

    // 3. Machine assigned to JWT user account
    if (user?.machine_id && !selectedMachine) {
      const target = machines.find(m => m.id === user.machine_id)
      if (target) setSelectedMachine(target)
    }
  }, [machineIdFromUrl, machines, selectedMachine, user?.machine_id, workerSession])

  const handleLookup = async (val: string) => {
    const code = val.trim().toUpperCase()
    if (!code) return
    try {
      const res = await cd2Api.scanLookup(code)
      setCurrentOrder(res.data)
      setTimeout(() => window.scrollTo({ top: 300, behavior: 'smooth' }), 100)
    } catch {
      message.error('Không tìm thấy Lệnh sản xuất!')
    }
  }

  const trackMutation = useMutation({
    mutationFn: (data: any) => cd2Api.trackProduction(data),
    onSuccess: () => {
      message.success('Đã cập nhật trạng thái!')
      invalidate()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Thất bại'),
  })

  const invalidate = () => {
    if (currentOrder?.so_lsx) {
      qc.invalidateQueries({ queryKey: ['order-progress', currentOrder.so_lsx] })
    }
  }

  const handleTrack = (eventType: 'start' | 'stop' | 'resume' | 'complete', extraData = {}) => {
    if (!selectedMachine || !currentOrder) return
    if (eventType === 'complete') {
      setIsCompleteModalOpen(true)
      return
    }
    if (eventType === 'stop') {
      setIsStopModalOpen(true)
      return
    }
    trackMutation.mutate({
      production_order_id: 0,
      machine_id: selectedMachine.id,
      event_type: eventType,
      printer_user_id: workerSession?.printer_user_id ?? undefined,
      ...extraData
    })
  }

  const handleConfirmStop = (reason: string) => {
    trackMutation.mutate({
      production_order_id: 0,
      machine_id: selectedMachine!.id,
      event_type: 'stop',
      ghi_chu: reason
    })
    setIsStopModalOpen(false)
  }

  const onFinishComplete = (values: any) => {
    trackMutation.mutate({
      production_order_id: 0, 
      machine_id: selectedMachine!.id,
      event_type: 'complete',
      ...values
    })
    setIsCompleteModalOpen(false)
    form.resetFields()
  }

  const { data: progress = [], isLoading: loadingProgress } = useQuery({
    queryKey: ['order-progress', currentOrder?.so_lsx],
    queryFn: () => cd2Api.getOrderProgress(0).then(r => r.data),
    enabled: !!currentOrder?.so_lsx,
  })

  if (!selectedMachine) {
    return (
      <div style={{ padding: '24px 16px', background: '#f0f2f5', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <DesktopOutlined style={{ fontSize: 40, color: '#1a337e', marginBottom: 12 }} />
          <Title level={3} style={{ margin: 0, color: '#1a337e' }}>Chọn máy làm việc</Title>
          <Text type="secondary">Vui lòng chọn máy bạn đang vận hành</Text>
        </div>

        {loadingMachines ? <div style={{textAlign:'center'}}><Spin /></div> : (
          <Row gutter={[16, 16]}>
            {machines.map(m => (
              <Col xs={12} key={m.id}>
                <Card 
                  hoverable 
                  style={{ borderRadius: 16, textAlign: 'center', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} 
                  onClick={() => setSelectedMachine(m)}
                  styles={{ body: { padding: '24px 12px' } }}
                >
                  <Title level={5} style={{ margin: 0, fontSize: 16 }}>{m.ten_may}</Title>
                  <Tag color="blue" style={{ marginTop: 10, borderRadius: 4 }}>{m.loai_may.toUpperCase()}</Tag>
                </Card>
              </Col>
            ))}
            {machines.length === 0 && <Col span={24}><Empty description="Chưa có máy nào" /></Col>}
          </Row>
        )}

        <Divider style={{ margin: '32px 0 16px' }}><Text type="secondary">Nhật ký xưởng hôm nay</Text></Divider>
        <Card style={{ borderRadius: 20, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: 40 }}>
           <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {factoryLogs.map((log: any, idx: number) => (
                <div key={log.id} style={{ padding: '10px 0', borderBottom: idx < factoryLogs.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <Text strong>{log.ten_may}</Text>
                    <Text type="secondary">{dayjs(log.created_at).format('HH:mm')}</Text>
                  </div>
                  <div style={{ fontSize: 13 }}>
                    <Tag color={log.event_type === 'complete' ? 'success' : 'processing'} style={{ fontSize: 11 }}>{log.event_type.toUpperCase()}</Tag>
                    <Text>{log.so_phieu}</Text>
                  </div>
                </div>
              ))}
              {factoryLogs.length === 0 && <Empty description="Chưa có hoạt động" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
           </div>
        </Card>
      </div>
    )
  }

  function handleWorkerLogout() {
    localStorage.removeItem('cd2_worker_session')
    navigate('/cd2/machine-login')
  }

  return (
    <div style={{ background: '#f0f2f5', minHeight: '100vh', padding: '16px 16px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        {workerSession ? (
          <Button
            icon={<LogoutOutlined />}
            shape="circle"
            onClick={handleWorkerLogout}
            style={{ marginRight: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
          />
        ) : (
          <Button
            icon={<ArrowLeftOutlined />}
            shape="circle"
            onClick={() => setSelectedMachine(null)}
            style={{ marginRight: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
          />
        )}
        <div style={{ flex: 1 }}>
          <Text strong style={{ fontSize: 18, color: '#1a337e', display: 'block' }}>{selectedMachine.ten_may}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{selectedMachine.loai_may.toUpperCase()}</Text>
        </div>
        {workerSession && (
          <Tag color="blue" style={{ marginLeft: 8 }}>{workerSession.worker_name}</Tag>
        )}
      </div>

      <div style={{ maxWidth: 500, margin: '0 auto' }}>
        <Card style={{ borderRadius: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: 'none', marginBottom: 20 }}>
          <Space align="center" style={{ marginBottom: 12 }}>
            <ScanOutlined style={{ fontSize: 18, color: '#1677ff' }} />
            <Text strong>Ghi nhận Lệnh sản xuất</Text>
          </Space>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              ref={lsxInputRef}
              placeholder="Nhập hoặc quét số LSX..."
              size="large"
              value={soLsx}
              onChange={e => setSoLsx(e.target.value.toUpperCase())}
              onPressEnter={() => handleLookup(soLsx)}
            />
            <Button
              size="large"
              icon={<CameraOutlined />}
              onClick={() => setIsScannerOpen(true)}
              style={{ background: '#1677ff', color: '#fff', border: 'none' }}
              title="Quét QR bằng camera"
            />
            <Button
              size="large"
              type="primary"
              onClick={() => handleLookup(soLsx)}
              style={{ background: '#1a337e', border: 'none' }}
            >
              TÌM
            </Button>
          </Space.Compact>
        </Card>

        {currentOrder && (
          <>
            <Card style={{ borderRadius: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: 'none', marginBottom: 20, background: '#fff' }}>
              <Tag color="success" style={{ marginBottom: 12 }}>ĐANG CHỌN</Tag>
              <Title level={4} style={{ margin: '0 0 8px' }}>{currentOrder.ten_hang}</Title>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div><Text type="secondary">LSX:</Text> <Text strong>{currentOrder.so_lsx}</Text></div>
                <div><Text type="secondary">Khổ:</Text> <Text strong>{currentOrder.kho_tt}x{currentOrder.dai_tt}</Text></div>
              </div>
            </Card>

            <div style={{ marginBottom: 24 }}>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Button 
                    type="primary" 
                    size="large" 
                    block 
                    icon={<PlayCircleFilled />} 
                    onClick={() => handleTrack('start')}
                    style={{ 
                      height: 80, borderRadius: 20, background: '#52c41a', border: 'none',
                      fontSize: 18, fontWeight: 700, boxShadow: '0 6px 16px rgba(82,196,26,0.3)'
                    }}
                  >
                    BẮT ĐẦU
                  </Button>
                </Col>
                <Col span={12}>
                  <Button 
                    size="large" 
                    block 
                    icon={<PauseCircleFilled />} 
                    onClick={() => handleTrack('stop')}
                    style={{ 
                      height: 80, borderRadius: 20, border: 'none', background: '#faad14', color: '#fff',
                      fontSize: 18, fontWeight: 700, boxShadow: '0 6px 16px rgba(250,173,20,0.3)'
                    }}
                  >
                    TẠM DỪNG
                  </Button>
                </Col>
                <Col span={24}>
                  <Button
                    type="primary"
                    size="large"
                    block
                    icon={<CheckCircleFilled />}
                    onClick={() => handleTrack('complete')}
                    style={{
                      height: 100, borderRadius: 24, background: '#1a337e', border: 'none',
                      fontSize: 22, fontWeight: 700, boxShadow: '0 8px 24px rgba(26,51,126,0.4)'
                    }}
                  >
                    HOÀN THÀNH
                  </Button>
                </Col>
                <Col span={24}>
                  <Button
                    size="large"
                    block
                    icon={<WarningFilled />}
                    onClick={() => setIsErrorModalOpen(true)}
                    style={{
                      height: 64, borderRadius: 16, border: '2px solid #f5222d',
                      background: '#fff1f0', color: '#f5222d',
                      fontSize: 18, fontWeight: 700
                    }}
                  >
                    MÁY BỊ LỖI
                  </Button>
                </Col>
              </Row>
            </div>

            <Card 
              title={<Space><HistoryIcon /> <Text>Nhật ký gần đây</Text></Space>}
              style={{ borderRadius: 20, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
            >
              {loadingProgress ? <Spin size="small" /> : (
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {progress.slice(0, 5).map((log, idx) => (
                    <div key={log.id} style={{ padding: '8px 0', borderBottom: idx < 4 ? '1px solid #f0f0f0' : 'none' }}>
                      <div style={{ display: 'flex' }}>
                        <Text strong style={{ color: log.event_type === 'complete' ? '#52c41a' : log.event_type === 'error' ? '#f5222d' : '#1677ff' }}>
                          {log.event_type.toUpperCase()}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11, marginLeft: 'auto' }}>
                          {dayjs(log.created_at).format('HH:mm')}
                        </Text>
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>{log.worker}</Text>
                    </div>
                  ))}
                  {progress.length === 0 && <Empty description="Chưa có lịch sử" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
                </div>
              )}
            </Card>
          </>
        )}
      </div>

      <Modal
        title={<Title level={4} style={{margin:0}}>Báo cáo kết quả</Title>}
        open={isCompleteModalOpen}
        onCancel={() => setIsCompleteModalOpen(false)}
        footer={null}
        destroyOnClose
        centered
        styles={{ content: { borderRadius: 24 } }}
      >
        <Form form={form} layout="vertical" onFinish={onFinishComplete}>
          <div style={{ background: '#f6ffed', padding: 16, borderRadius: 16, marginBottom: 20 }}>
            <Form.Item name="quantity_ok" label={<Text strong>Số lượng ĐẠT (OK)</Text>} rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} size="large" autoFocus placeholder="0" />
            </Form.Item>
          </div>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="quantity_loi" label="Số lượng LỖI">
                <InputNumber style={{ width: '100%' }} size="large" placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="quantity_setup" label="Số phôi SETUP">
                <InputNumber style={{ width: '100%' }} size="large" placeholder="0" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="ghi_chu" label="Ghi chú thêm">
            <Input.TextArea placeholder="Lý do lỗi..." rows={2} style={{ borderRadius: 12 }} />
          </Form.Item>
          <Button 
            type="primary" size="large" block htmlType="submit" loading={trackMutation.isPending}
            style={{ height: 60, borderRadius: 16, background: '#1a337e', fontSize: 18, fontWeight: 700 }}
          >
            GỬI BÁO CÁO
          </Button>
        </Form>
      </Modal>

      {/* Modal Chọn lý do dừng */}
      <Modal
        title={<Title level={4} style={{margin:0}}>Lý do dừng máy?</Title>}
        open={isStopModalOpen}
        onCancel={() => setIsStopModalOpen(false)}
        footer={null}
        centered
        styles={{ content: { borderRadius: 24 } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '10px 0' }}>
          {[
            { label: 'Thay dao / Thay khuôn', color: '#1677ff' },
            { label: 'Sửa chữa / Bảo trì', color: '#f5222d' },
            { label: 'Chờ phôi / Chờ vật tư', color: '#faad14' },
            { label: 'Nghỉ giữa ca / Ăn cơm', color: '#8c8c8c' },
            { label: 'Vệ sinh máy', color: '#52c41a' },
            { label: 'Lý do khác...', color: '#1a337e' },
          ].map(item => (
            <Button
              key={item.label}
              size="large"
              block
              style={{
                height: 54, borderRadius: 12, textAlign: 'left', paddingLeft: 20,
                fontSize: 16, fontWeight: 500, borderColor: item.color, color: item.color
              }}
              onClick={() => handleConfirmStop(item.label)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </Modal>

      {/* Modal Báo lỗi máy */}
      <Modal
        title={<Space><WarningFilled style={{ color: '#f5222d' }} /><Title level={4} style={{ margin: 0, color: '#f5222d' }}>Báo lỗi máy</Title></Space>}
        open={isErrorModalOpen}
        onCancel={() => setIsErrorModalOpen(false)}
        footer={null}
        centered
        styles={{ content: { borderRadius: 24 } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '10px 0' }}>
          {[
            { label: 'Máy bị kẹt / Không chạy được', color: '#f5222d' },
            { label: 'Chất lượng in bị lỗi (mờ, lệch)', color: '#fa541c' },
            { label: 'Dao bị vỡ / Khuôn hỏng', color: '#fa8c16' },
            { label: 'Điện / Khí nén bị sự cố', color: '#d4380d' },
            { label: 'Lỗi khác...', color: '#8c0000' },
          ].map(item => (
            <Button
              key={item.label}
              size="large"
              block
              style={{
                height: 54, borderRadius: 12, textAlign: 'left', paddingLeft: 20,
                fontSize: 16, fontWeight: 500, borderColor: item.color, color: item.color,
                background: '#fff1f0'
              }}
              onClick={() => {
                trackMutation.mutate({
                  production_order_id: 0,
                  machine_id: selectedMachine!.id,
                  event_type: 'error',
                  ghi_chu: item.label,
                })
                setIsErrorModalOpen(false)
              }}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </Modal>

      <QrScannerModal
        open={isScannerOpen}
        onScan={(text) => {
          setIsScannerOpen(false)
          setSoLsx(text)
          handleLookup(text)
        }}
        onClose={() => setIsScannerOpen(false)}
      />
    </div>
  )
}
