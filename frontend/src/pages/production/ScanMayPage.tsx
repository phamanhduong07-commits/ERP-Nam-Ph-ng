import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import {
  Alert, Button, Card, Col, Divider, Form, Input, InputNumber, message,
  Popconfirm, Row, Space, Spin, Statistic, Table, Tag, Typography,
} from 'antd'
import type { InputRef } from 'antd'
import type { InputNumberRef } from 'rc-input-number'
import {
  BarcodeOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined, SettingOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { cd2Api, MayScan, ScanLog, ScanLookupResult } from '../../api/cd2'
import MayScanSettingsModal from './MayScanSettingsModal'

const { Title, Text } = Typography

interface LookupState {
  loading: boolean
  result: ScanLookupResult | null
  error: string | null
}

export default function ScanMayPage() {
  const qc = useQueryClient()
  const [selectedMachine, setSelectedMachine] = useState<number | null>(null)
  const [soLsx, setSoLsx] = useState('')
  const [lookup, setLookup] = useState<LookupState>({ loading: false, result: null, error: null })
  const [soLuong, setSoLuong] = useState<number | null>(null)
  const [nguoiSx, setNguoiSx] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const lsxRef = useRef<InputRef>(null)
  const slRef = useRef<InputNumberRef>(null)

  const { data: mayScanList = [], isLoading: loadingMachines } = useQuery({
    queryKey: ['may-scan'],
    queryFn: () => cd2Api.listMayScan().then(r => r.data.filter((m: MayScan) => m.active)),
  })

  // Auto-select first machine
  useEffect(() => {
    if (mayScanList.length > 0 && !selectedMachine) {
      setSelectedMachine(mayScanList[0].id)
    }
  }, [mayScanList, selectedMachine])

  const currentMachine = mayScanList.find((m: MayScan) => m.id === selectedMachine)

  const { data: todayLogs = [], refetch: refetchLogs } = useQuery({
    queryKey: ['scan-history', selectedMachine],
    queryFn: () => cd2Api.getScanHistory({ may_scan_id: selectedMachine ?? undefined, days: 1 }).then(r => r.data),
    enabled: !!selectedMachine,
    refetchInterval: 15_000,
  })

  const submitMutation = useMutation({
    mutationFn: (data: Parameters<typeof cd2Api.createScanLog>[0]) => cd2Api.createScanLog(data),
    onSuccess: () => {
      message.success('Đã lưu sản lượng!')
      setSoLsx('')
      setSoLuong(null)
      setLookup({ loading: false, result: null, error: null })
      qc.invalidateQueries({ queryKey: ['scan-history', selectedMachine] })
      setTimeout(() => lsxRef.current?.focus(), 100)
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lưu thất bại, vui lòng thử lại'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => cd2Api.deleteScanLog(id),
    onSuccess: () => {
      message.success('Đã xoá')
      qc.invalidateQueries({ queryKey: ['scan-history', selectedMachine] })
    },
  })

  const handleLookup = async (val?: string) => {
    const code = (val ?? soLsx).trim().toUpperCase()
    if (!code) return
    setSoLsx(code)
    setLookup({ loading: true, result: null, error: null })
    setSoLuong(null)
    try {
      const res = await cd2Api.scanLookup(code)
      setLookup({ loading: false, result: res.data, error: null })
      setTimeout(() => slRef.current?.focus?.(), 100)
    } catch {
      setLookup({ loading: false, result: null, error: 'Không tìm thấy lệnh sản xuất' })
    }
  }

  const handleSubmit = () => {
    if (!selectedMachine) { message.warning('Chọn máy scan'); return }
    if (!soLsx.trim()) { message.warning('Nhập số lệnh SX'); return }
    if (!soLuong || soLuong <= 0) { message.warning('Nhập số lượng TP'); return }

    const dtPerUnit = lookup.result?.dien_tich_don_vi ?? null
    const dienTich = dtPerUnit != null ? parseFloat((dtPerUnit * soLuong).toFixed(4)) : undefined
    const donGia = currentMachine?.don_gia ?? undefined

    submitMutation.mutate({
      may_scan_id: selectedMachine,
      so_lsx: soLsx.trim().toUpperCase(),
      ten_hang: lookup.result?.ten_hang ?? undefined,
      dai: lookup.result?.dai ?? undefined,
      rong: lookup.result?.rong ?? undefined,
      cao: lookup.result?.cao ?? undefined,
      kho_tt: lookup.result?.kho_tt ?? undefined,
      dien_tich: dienTich,
      so_luong_tp: soLuong,
      don_gia: donGia != null ? Number(donGia) : undefined,
      nguoi_sx: nguoiSx.trim() || undefined,
    })
  }

  // Tính preview
  const dtPerUnit = lookup.result?.dien_tich_don_vi ?? null
  const totalDt = dtPerUnit != null && soLuong ? dtPerUnit * soLuong : null
  const donGia = currentMachine?.don_gia ? Number(currentMachine.don_gia) : null
  const tienLuong = totalDt != null && donGia ? totalDt * donGia : null

  // Thống kê hôm nay
  const todayTotal = todayLogs.reduce((s: number, l: ScanLog) => s + l.so_luong_tp, 0)
  const todayDt = todayLogs.reduce((s: number, l: ScanLog) => s + (l.dien_tich ?? 0), 0)
  const todayLuong = todayLogs.reduce((s: number, l: ScanLog) => s + (l.tien_luong ?? 0), 0)

  const cols = [
    {
      title: 'Thời gian',
      dataIndex: 'created_at',
      width: 90,
      render: (v: string) => dayjs(v).format('HH:mm DD/MM'),
    },
    { title: 'Số LSX', dataIndex: 'so_lsx', width: 110 },
    { title: 'Tên hàng', dataIndex: 'ten_hang', ellipsis: true },
    {
      title: 'SL TP',
      dataIndex: 'so_luong_tp',
      width: 70,
      align: 'right' as const,
      render: (v: number) => v.toLocaleString('vi-VN'),
    },
    {
      title: 'DT (m²)',
      dataIndex: 'dien_tich',
      width: 80,
      align: 'right' as const,
      render: (v: number | null) => v != null ? v.toFixed(2) : '—',
    },
    {
      title: 'Tiền lương',
      dataIndex: 'tien_luong',
      width: 100,
      align: 'right' as const,
      render: (v: number | null) =>
        v != null ? v.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + 'đ' : '—',
    },
    {
      title: '',
      width: 40,
      render: (_: unknown, row: ScanLog) => (
        <Popconfirm title="Xoá bản ghi này?" onConfirm={() => deleteMutation.mutate(row.id)} okText="Xoá" cancelText="Không">
          <Button size="small" type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  if (loadingMachines) return <Spin style={{ margin: 40 }} />

  if (mayScanList.length === 0) {
    return (
      <Card style={{ margin: 24 }}>
        <Alert
          type="info"
          message="Chưa có máy scan nào"
          description="Nhấn nút cấu hình để thêm máy scan đầu tiên."
          action={
            <Button icon={<SettingOutlined />} onClick={() => setShowSettings(true)}>
              Cấu hình máy scan
            </Button>
          }
        />
        {showSettings && (
          <MayScanSettingsModal
            open
            onClose={() => setShowSettings(false)}
            onSaved={() => { setShowSettings(false); qc.invalidateQueries({ queryKey: ['may-scan'] }) }}
          />
        )}
      </Card>
    )
  }

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <BarcodeOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <Title level={4} style={{ margin: 0 }}>Scan Sản Lượng</Title>
          </Space>
        </Col>
        <Col>
          <Button icon={<SettingOutlined />} onClick={() => setShowSettings(true)}>
            Cấu hình máy
          </Button>
        </Col>
      </Row>

      {/* Chọn máy */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Text strong>Máy scan:</Text>
          {mayScanList.map((m: MayScan) => (
            <Button
              key={m.id}
              type={selectedMachine === m.id ? 'primary' : 'default'}
              onClick={() => setSelectedMachine(m.id)}
              size="large"
            >
              {m.ten_may}
              {m.don_gia != null && (
                <Tag color="blue" style={{ marginLeft: 6, fontSize: 11 }}>
                  {Number(m.don_gia).toLocaleString('vi-VN')}đ/m²
                </Tag>
              )}
            </Button>
          ))}
        </Space>
      </Card>

      <Row gutter={16}>
        {/* Form nhập */}
        <Col xs={24} lg={10}>
          <Card title="Nhập sản lượng" style={{ marginBottom: 16 }}>
            <Form layout="vertical">
              <Form.Item label="Số lệnh SX (LSX)">
                <Input.Search
                  ref={lsxRef}
                  size="large"
                  placeholder="VD: LSX2024001"
                  value={soLsx}
                  onChange={e => setSoLsx(e.target.value.toUpperCase())}
                  onSearch={handleLookup}
                  onPressEnter={() => handleLookup()}
                  enterButton={<SearchOutlined />}
                  loading={lookup.loading}
                  autoFocus
                />
              </Form.Item>

              {lookup.error && (
                <Alert type="error" message={lookup.error} style={{ marginBottom: 12 }} />
              )}

              {lookup.result && (
                <Card size="small" style={{ marginBottom: 12, background: '#f6ffed', borderColor: '#b7eb8f' }}>
                  <Text strong style={{ display: 'block', fontSize: 14 }}>{lookup.result.ten_hang}</Text>
                  <Space size={16} style={{ marginTop: 6 }} wrap>
                    {lookup.result.dai && <Text style={{ fontSize: 12 }}>D: <strong>{lookup.result.dai}</strong></Text>}
                    {lookup.result.rong && <Text style={{ fontSize: 12 }}>R: <strong>{lookup.result.rong}</strong></Text>}
                    {lookup.result.cao && <Text style={{ fontSize: 12 }}>C: <strong>{lookup.result.cao}</strong></Text>}
                    {lookup.result.kho_tt && (
                      <Text style={{ fontSize: 12 }}>Khổ TT: <strong>{lookup.result.kho_tt}</strong></Text>
                    )}
                    {lookup.result.dien_tich_don_vi && (
                      <Tag color="purple">
                        {lookup.result.dien_tich_don_vi.toFixed(4)} m²/cái
                      </Tag>
                    )}
                  </Space>
                </Card>
              )}

              <Form.Item label="Số lượng thành phẩm">
                <InputNumber
                  ref={slRef}
                  size="large"
                  style={{ width: '100%' }}
                  min={1}
                  placeholder="Nhập số lượng"
                  value={soLuong}
                  onChange={v => setSoLuong(v)}
                  onPressEnter={handleSubmit}
                />
              </Form.Item>

              {totalDt != null && (
                <Card size="small" style={{ marginBottom: 12, background: '#e6f7ff', borderColor: '#91caff' }}>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Statistic
                        title="Diện tích"
                        value={totalDt}
                        suffix="m²"
                        precision={2}
                        valueStyle={{ fontSize: 18 }}
                      />
                    </Col>
                    {tienLuong != null && (
                      <Col span={12}>
                        <Statistic
                          title="Tiền lương"
                          value={tienLuong}
                          suffix="đ"
                          precision={0}
                          valueStyle={{ fontSize: 18, color: '#52c41a' }}
                          formatter={v => Number(v).toLocaleString('vi-VN')}
                        />
                      </Col>
                    )}
                  </Row>
                </Card>
              )}

              <Form.Item label="Người sản xuất (không bắt buộc)">
                <Input
                  placeholder="Tên công nhân"
                  value={nguoiSx}
                  onChange={e => setNguoiSx(e.target.value)}
                />
              </Form.Item>

              <Button
                type="primary"
                size="large"
                block
                onClick={handleSubmit}
                loading={submitMutation.isPending}
                disabled={!selectedMachine || !soLsx.trim() || !soLuong}
              >
                ✅ Lưu sản lượng
              </Button>
            </Form>
          </Card>
        </Col>

        {/* Lịch sử hôm nay */}
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <span>Hôm nay — {currentMachine?.ten_may}</span>
                <Button size="small" icon={<ReloadOutlined />} onClick={() => refetchLogs()} />
              </Space>
            }
            extra={
              <Space size={16}>
                <Statistic
                  title="SL TP"
                  value={todayTotal}
                  valueStyle={{ fontSize: 16 }}
                  formatter={v => Number(v).toLocaleString('vi-VN')}
                />
                <Divider type="vertical" />
                <Statistic
                  title="DT (m²)"
                  value={todayDt}
                  precision={2}
                  valueStyle={{ fontSize: 16 }}
                />
                {todayLuong > 0 && (
                  <>
                    <Divider type="vertical" />
                    <Statistic
                      title="Tiền lương"
                      value={todayLuong}
                      valueStyle={{ fontSize: 16, color: '#52c41a' }}
                      formatter={v => Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + 'đ'}
                    />
                  </>
                )}
              </Space>
            }
          >
            <Table
              dataSource={todayLogs}
              columns={cols}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ y: 420 }}
              locale={{ emptyText: 'Chưa có bản ghi nào hôm nay' }}
            />
          </Card>
        </Col>
      </Row>

      {showSettings && (
        <MayScanSettingsModal
          open
          onClose={() => setShowSettings(false)}
          onSaved={() => { setShowSettings(false); qc.invalidateQueries({ queryKey: ['may-scan'] }) }}
        />
      )}
    </div>
  )
}
