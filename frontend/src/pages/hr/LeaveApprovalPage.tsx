import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, Tag, Button, Card, Space, Typography, Row, Col, Modal, Form, Input, Select,
  Statistic, Badge, message, Tooltip,
} from 'antd'
import {
  CheckCircleOutlined, CloseCircleOutlined, UserOutlined, ReloadOutlined,
  InboxOutlined, ClockCircleOutlined,
} from '@ant-design/icons'
import client from '../../api/client'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { TextArea } = Input

const LOAI_DON_LABEL: Record<string, string> = {
  nghi_phep: '🏖️ Nghỉ phép',
  tang_ca: '⏰ Tăng ca',
  di_muon_ve_som: '🕐 Đi muộn/Về sớm',
  cong_tac: '✈️ Công tác',
  ung_luong: '💰 Ứng lương',
}

const STATUS_LABEL: Record<string, { color: string; text: string }> = {
  cho_duyet: { color: 'orange', text: 'CHỜ DUYỆT' },
  phong_ban_duyet: { color: 'processing', text: 'TRƯỞNG PHÒNG DUYỆT' },
  bgd_duyet: { color: 'success', text: 'BGĐ DUYỆT (HOÀN TẤT)' },
  tu_choi: { color: 'error', text: 'TỪ CHỐI' },
  huy: { color: 'default', text: 'ĐÃ HỦY' },
}

interface LeaveRequest {
  id: number
  loai_don: string
  employee: { ho_ten: string; ma_nv: string }
  ngay_bat_dau: string
  ngay_ket_thuc: string
  tong_ngay: number
  so_tien?: number
  so_gio_ot?: number
  dia_diem?: string
  ly_do?: string
  trang_thai: string
  y_kien_duyet?: string
  created_at: string
  da_xu_ly?: boolean
}

export default function LeaveApprovalPage() {
  const qc = useQueryClient()
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedReq, setSelectedReq] = useState<LeaveRequest | null>(null)
  const [form] = Form.useForm()
  const [filterStatus, setFilterStatus] = useState<string>('cho_duyet')
  const [filterLoai, setFilterLoai] = useState<string>('all')

  const { data: requests = [], isLoading, refetch } = useQuery({
    queryKey: ['hr-leave-requests', filterStatus, filterLoai],
    queryFn: () => client.get(`/hr/leave-requests`, {
      params: {
        ...(filterStatus !== 'all' && { status: filterStatus }),
        ...(filterLoai !== 'all' && { loai_don: filterLoai }),
      },
    }).then(r => r.data as LeaveRequest[]),
  })

  const { data: inboxCount } = useQuery({
    queryKey: ['hr-inbox-count'],
    queryFn: () => client.get('/hr/leave-requests/inbox-count').then(r => r.data),
    refetchInterval: 30_000,
  })

  // Endpoint MỚI: POST /hr/leave-requests/{id}/approve với body {decision, y_kien}
  const approveMutation = useMutation({
    mutationFn: ({ id, decision, y_kien }: { id: number; decision: 'approve' | 'reject'; y_kien?: string }) =>
      client.post(`/hr/leave-requests/${id}/approve`, { decision, y_kien }),
    onSuccess: (res) => {
      const trang_thai = res.data?.trang_thai || res.data?.data?.trang_thai
      message.success(
        trang_thai === 'bgd_duyet' ? 'Đã duyệt cuối — Tự cập nhật vào chấm công' :
        trang_thai === 'phong_ban_duyet' ? 'Đã duyệt cấp 1 — Chuyển BGĐ' :
        trang_thai === 'tu_choi' ? 'Đã từ chối đơn' : 'Đã cập nhật'
      )
      setModalVisible(false)
      form.resetFields()
      qc.invalidateQueries({ queryKey: ['hr-leave-requests'] })
      qc.invalidateQueries({ queryKey: ['hr-inbox-count'] })
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || 'Lỗi duyệt đơn')
    },
  })

  const handleAction = (decision: 'approve' | 'reject') => {
    if (!selectedReq) return
    const y_kien = form.getFieldValue('y_kien')
    if (decision === 'reject' && !y_kien) {
      message.warning('Vui lòng nhập lý do từ chối')
      return
    }
    approveMutation.mutate({ id: selectedReq.id, decision, y_kien })
  }

  const columns = [
    {
      title: 'Ngày tạo', dataIndex: 'created_at', width: 130,
      render: (v: string) => <Text style={{ fontSize: 12 }}>{dayjs(v).format('DD/MM/YYYY HH:mm')}</Text>,
    },
    {
      title: 'Nhân viên', dataIndex: 'employee', width: 200,
      render: (v: any) => (
        <Space>
          <UserOutlined />
          <div>
            <Text strong>{v?.ho_ten}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 11 }}>{v?.ma_nv}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Loại đơn', dataIndex: 'loai_don', width: 160,
      render: (v: string) => <Tag>{LOAI_DON_LABEL[v] || v}</Tag>,
    },
    {
      title: 'Thông tin', width: 280,
      render: (_: any, r: LeaveRequest) => (
        <div style={{ fontSize: 12 }}>
          <div>
            {r.loai_don === 'ung_luong' ? (
              <>Ngày: {dayjs(r.ngay_bat_dau).format('DD/MM/YYYY')}</>
            ) : (
              <>{dayjs(r.ngay_bat_dau).format('DD/MM HH:mm')} → {dayjs(r.ngay_ket_thuc).format('DD/MM HH:mm')}</>
            )}
          </div>
          {r.tong_ngay > 0 && r.loai_don === 'nghi_phep' && (
            <Text type="secondary" style={{ fontSize: 11 }}>({r.tong_ngay} ngày)</Text>
          )}
          {r.so_tien != null && (
            <div style={{ color: '#1677ff', fontWeight: 600 }}>💰 {Number(r.so_tien).toLocaleString('vi-VN')} đ</div>
          )}
          {r.so_gio_ot != null && (
            <div style={{ color: '#fa8c16', fontWeight: 600 }}>⏰ {r.so_gio_ot} giờ OT</div>
          )}
          {r.dia_diem && <div style={{ color: '#595959' }}>📍 {r.dia_diem}</div>}
        </div>
      ),
    },
    {
      title: 'Lý do', dataIndex: 'ly_do', ellipsis: true,
      render: (v: string) => v ? <Tooltip title={v}><Text style={{ fontSize: 12 }}>{v}</Text></Tooltip> : '—',
    },
    {
      title: 'Trạng thái', dataIndex: 'trang_thai', width: 180,
      render: (v: string) => {
        const cfg = STATUS_LABEL[v] || { color: 'default', text: v }
        return <Tag color={cfg.color}>{cfg.text}</Tag>
      },
    },
    {
      title: 'Thao tác', width: 130, fixed: 'right' as const,
      render: (_: any, r: LeaveRequest) => {
        const isFinal = ['bgd_duyet', 'tu_choi', 'huy'].includes(r.trang_thai)
        return (
          <Button
            type="primary" size="small" icon={<CheckCircleOutlined />}
            disabled={isFinal}
            onClick={() => { setSelectedReq(r); setModalVisible(true) }}
          >
            {isFinal ? 'Xem' : 'Duyệt'}
          </Button>
        )
      },
    },
  ]

  return (
    <div style={{ padding: '16px 24px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            <InboxOutlined /> Inbox Đơn từ
          </Title>
          <Text type="secondary">Quy trình 2 bước: Trưởng phòng → Ban Giám Đốc</Text>
        </Col>
        <Col>
          <Space>
            <Badge count={inboxCount?.total ?? 0} showZero>
              <Card size="small" style={{ padding: '4px 12px' }}>
                <Space size={16}>
                  <Statistic
                    title="Chờ duyệt cấp 1"
                    value={inboxCount?.cho_duyet ?? 0}
                    valueStyle={{ fontSize: 16, color: '#fa8c16' }}
                    prefix={<ClockCircleOutlined />}
                  />
                  <Statistic
                    title="Chờ BGĐ duyệt"
                    value={inboxCount?.phong_ban_duyet ?? 0}
                    valueStyle={{ fontSize: 16, color: '#1677ff' }}
                  />
                </Space>
              </Card>
            </Badge>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>Làm mới</Button>
          </Space>
        </Col>
      </Row>

      {/* Filter bar */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space>
          <Text>Trạng thái:</Text>
          <Select
            size="small" value={filterStatus} onChange={setFilterStatus} style={{ width: 200 }}
            options={[
              { value: 'all', label: 'Tất cả' },
              { value: 'cho_duyet', label: '🟠 Chờ duyệt' },
              { value: 'phong_ban_duyet', label: '🔵 Chờ BGĐ' },
              { value: 'bgd_duyet', label: '🟢 Đã duyệt' },
              { value: 'tu_choi', label: '🔴 Từ chối' },
              { value: 'huy', label: '⚫ Đã hủy' },
            ]}
          />
          <Text>Loại đơn:</Text>
          <Select
            size="small" value={filterLoai} onChange={setFilterLoai} style={{ width: 200 }}
            options={[
              { value: 'all', label: 'Tất cả loại' },
              ...Object.entries(LOAI_DON_LABEL).map(([k, v]) => ({ value: k, label: v })),
            ]}
          />
        </Space>
      </Card>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={requests}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: false }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title={selectedReq ? `Đơn: ${LOAI_DON_LABEL[selectedReq.loai_don] || selectedReq.loai_don}` : ''}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); form.resetFields() }}
        width={580}
        footer={
          selectedReq && !['bgd_duyet', 'tu_choi', 'huy'].includes(selectedReq.trang_thai)
            ? [
                <Button key="cancel" onClick={() => setModalVisible(false)}>Đóng</Button>,
                <Button key="reject" danger icon={<CloseCircleOutlined />} loading={approveMutation.isPending} onClick={() => handleAction('reject')}>
                  Từ chối
                </Button>,
                <Button
                  key="approve" type="primary" icon={<CheckCircleOutlined />} loading={approveMutation.isPending}
                  onClick={() => handleAction('approve')}
                >
                  {selectedReq.trang_thai === 'cho_duyet' ? 'Duyệt cấp 1' : 'BGĐ Duyệt (Hoàn tất)'}
                </Button>,
              ]
            : [<Button key="close" onClick={() => setModalVisible(false)}>Đóng</Button>]
        }
      >
        {selectedReq && (
          <Form form={form} layout="vertical">
            <div style={{ marginBottom: 16, padding: 12, background: '#f5f9ff', borderRadius: 8 }}>
              <Text strong style={{ fontSize: 15 }}>{selectedReq.employee?.ho_ten}</Text>
              <Text type="secondary"> ({selectedReq.employee?.ma_nv})</Text>
              <div style={{ marginTop: 8, fontSize: 13 }}>
                {selectedReq.loai_don === 'ung_luong' ? (
                  <div>📅 Ngày cần ứng: <Text strong>{dayjs(selectedReq.ngay_bat_dau).format('DD/MM/YYYY')}</Text></div>
                ) : (
                  <div>📅 Từ {dayjs(selectedReq.ngay_bat_dau).format('DD/MM/YYYY HH:mm')} đến {dayjs(selectedReq.ngay_ket_thuc).format('DD/MM/YYYY HH:mm')}</div>
                )}
                {selectedReq.tong_ngay > 0 && selectedReq.loai_don === 'nghi_phep' && (
                  <div>📊 Tổng: {selectedReq.tong_ngay} ngày</div>
                )}
                {selectedReq.so_tien != null && (
                  <div style={{ color: '#1677ff' }}>💰 Số tiền: <Text strong>{Number(selectedReq.so_tien).toLocaleString('vi-VN')} VNĐ</Text></div>
                )}
                {selectedReq.so_gio_ot != null && (
                  <div style={{ color: '#fa8c16' }}>⏰ Số giờ OT: <Text strong>{selectedReq.so_gio_ot} giờ</Text></div>
                )}
                {selectedReq.dia_diem && (
                  <div>📍 Địa điểm: <Text strong>{selectedReq.dia_diem}</Text></div>
                )}
                {selectedReq.ly_do && (
                  <div style={{ marginTop: 6, fontStyle: 'italic' }}>💬 "{selectedReq.ly_do}"</div>
                )}
              </div>
            </div>

            {selectedReq.y_kien_duyet && (
              <div style={{ marginBottom: 12, padding: 8, background: '#fff7e6', borderRadius: 6, fontSize: 12 }}>
                <Text strong>Ý kiến trước:</Text> {selectedReq.y_kien_duyet}
              </div>
            )}

            {!['bgd_duyet', 'tu_choi', 'huy'].includes(selectedReq.trang_thai) && (
              <Form.Item name="y_kien" label="Ý kiến của bạn">
                <TextArea rows={3} placeholder="Nhập ý kiến (bắt buộc khi Từ chối)..." />
              </Form.Item>
            )}
          </Form>
        )}
      </Modal>
    </div>
  )
}
