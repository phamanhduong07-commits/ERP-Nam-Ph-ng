import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Card, Col, Row, Typography, Space, Button, Avatar, List, Tag, Tabs, Modal, Form, DatePicker, Input, message, Select
} from 'antd'
import { 
  UserOutlined, 
  DollarOutlined, 
  CalendarOutlined, 
  FileTextOutlined,
  PlusOutlined,
  ArrowLeftOutlined,
  LogoutOutlined
} from '@ant-design/icons'
import client from '../../api/client'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import MobileCheckIn from '../../components/hr/MobileCheckIn'

const { Title, Text } = Typography
const { TextArea } = Input

const LOAI_DON_LABEL: Record<string, string> = {
  nghi_phep: '🏖️ Nghỉ phép',
  tang_ca: '⏰ Tăng ca',
  di_muon_ve_som: '🕐 Đi muộn / Về sớm',
  cong_tac: '✈️ Công tác',
  ung_luong: '💰 Ứng lương',
}

const STATUS_COLOR: Record<string, string> = {
  cho_duyet: 'orange',
  phong_ban_duyet: 'blue',
  bgd_duyet: 'green',
  tu_choi: 'red',
  huy: 'default',
}

export default function EmployeeMobilePortal() {
  const { user, logout } = useAuthStore()
  const nav = useNavigate()
  const [activeTab, setActiveTab] = useState('home')
  const [leaveModal, setLeaveModal] = useState(false)
  const [form] = Form.useForm()

  const { data: profile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => client.get(`/hr/me/profile`).then(r => r.data),
  })

  const { data: payrolls = [] } = useQuery({
    queryKey: ['my-payroll'],
    queryFn: () => client.get(`/hr/me/payroll`).then(r => r.data),
  })

  const { data: leaves = [], refetch: refetchLeaves } = useQuery({
    queryKey: ['my-leave'],
    queryFn: () => client.get(`/hr/me/leave-requests`).then(r => r.data),
  })

  const { data: myBenefits = [] } = useQuery({
    queryKey: ['my-benefits'],
    queryFn: () => client.get(`/hr/me/benefits`).then(r => r.data),
  })

  const { data: eligibleBenefits = [] } = useQuery({
    queryKey: ['my-eligible-benefits'],
    queryFn: () => client.get(`/hr/me/eligible-benefits`).then(r => r.data),
  })

  const createLeaveMutation = useMutation({
    mutationFn: (values: any) => {
      // Ứng lương chỉ có 1 ngày — duplicate cho ngay_ket_thuc
      const startIso = values.ngay_bat_dau?.toISOString?.() || values.ngay_bat_dau
      const endIso = values.ngay_ket_thuc?.toISOString?.() || values.ngay_ket_thuc || startIso
      return client.post(`/hr/leave-requests`, {
        // Sprint C: employee_id auto từ current_user, KHÔNG gửi từ client
        loai_don: values.loai_don,
        ngay_bat_dau: startIso,
        ngay_ket_thuc: endIso,
        ly_do: values.ly_do,
        so_tien: values.so_tien ? Number(values.so_tien) : undefined,
        so_gio_ot: values.so_gio_ot ? Number(values.so_gio_ot) : undefined,
        dia_diem: values.dia_diem,
      })
    },
    onSuccess: () => {
      message.success('Đã gửi đơn — chờ trưởng phòng duyệt')
      setLeaveModal(false)
      form.resetFields()
      refetchLeaves()
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail
      message.error(typeof detail === 'string' ? detail : 'Lỗi gửi đơn')
    },
  })

  // Hủy đơn (chỉ khi đang cho_duyet)
  const cancelMutation = useMutation({
    mutationFn: (id: number) => client.post(`/hr/leave-requests/${id}/cancel`),
    onSuccess: () => {
      message.success('Đã hủy đơn')
      refetchLeaves()
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || 'Lỗi hủy đơn')
    },
  })

  const watchedLoai = Form.useWatch('loai_don', form)

  const renderHome = () => (
    <div style={{ padding: 16 }}>
      <Card style={{ marginBottom: 16, borderRadius: 12, background: 'linear-gradient(135deg, #1b168e 0%, #3a33d1 100%)', border: 'none' }}>
        <Space size="large">
          <Avatar size={64} icon={<UserOutlined />} style={{ backgroundColor: '#ff8200' }} />
          <div style={{ color: 'white' }}>
            <Title level={4} style={{ color: 'white', margin: 0 }}>{profile?.ho_ten}</Title>
            <Text style={{ color: 'rgba(255,255,255,0.8)' }}>{profile?.ma_nv} - {profile?.chuc_vu}</Text>
          </div>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card
            hoverable
            style={{ textAlign: 'center', borderRadius: 12 }}
            onClick={() => nav('/portal/payslip')}
          >
            <DollarOutlined style={{ fontSize: 32, color: '#ff8200', marginBottom: 8 }} />
            <br /><Text strong>Phiếu lương</Text>
            <br /><Text type="secondary" style={{ fontSize: 11 }}>Lương sản phẩm + Khiếu nại</Text>
          </Card>
        </Col>
        <Col span={12}>
          <Card 
            hoverable 
            style={{ textAlign: 'center', borderRadius: 12 }}
            onClick={() => setActiveTab('leave')}
          >
            <FileTextOutlined style={{ fontSize: 32, color: '#1677ff', marginBottom: 8 }} />
            <br /><Text strong>Đơn từ</Text>
          </Card>
        </Col>
        <Col span={12}>
          <Card
            hoverable
            style={{ textAlign: 'center', borderRadius: 12 }}
            onClick={() => setActiveTab('checkin')}
          >
            <CalendarOutlined style={{ fontSize: 32, color: '#52c41a', marginBottom: 8 }} />
            <br /><Text strong>Chấm công</Text>
          </Card>
        </Col>
        <Col span={12}>
          <Card
            hoverable
            style={{ textAlign: 'center', borderRadius: 12 }}
            onClick={() => setActiveTab('benefits')}
          >
            <span style={{ fontSize: 32, marginBottom: 8, display: 'block' }}>🎁</span>
            <Text strong>Phúc lợi</Text>
          </Card>
        </Col>
        <Col span={24}>
          <Card
            hoverable
            style={{ textAlign: 'center', borderRadius: 12 }}
            onClick={() => logout()}
          >
            <LogoutOutlined style={{ fontSize: 24, color: '#ff4d4f', marginRight: 8 }} />
            <Text strong>Đăng xuất</Text>
          </Card>
        </Col>
      </Row>
    </div>
  )

  const renderPayroll = () => (
    <div style={{ padding: 16 }}>
      <Button icon={<ArrowLeftOutlined />} onClick={() => setActiveTab('home')} style={{ marginBottom: 16 }}>Quay lại</Button>
      <Title level={4}>Lịch sử nhận lương</Title>
      <List
        dataSource={payrolls || []}
        renderItem={(item: any) => (
          <Card size="small" style={{ marginBottom: 12, borderRadius: 8 }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Text type="secondary">Tháng {item.thang}/{item.nam}</Text>
                <br />
                <Text strong style={{ fontSize: 18, color: '#52c41a' }}>
                  {Number(item.thuc_linh ?? 0).toLocaleString('vi-VN')}đ
                </Text>
              </Col>
              <Col>
                {item.trang_thai === 'da_chi' ? (
                  <Tag color="green">ĐÃ CHI TRẢ</Tag>
                ) : item.trang_thai === 'da_duyet' ? (
                  <Tag color="blue">ĐÃ DUYỆT</Tag>
                ) : item.trang_thai === 'da_tinh' ? (
                  <Tag color="orange">CHỜ DUYỆT</Tag>
                ) : (
                  <Tag color="default">{item.trang_thai?.toUpperCase() || 'NHÁP'}</Tag>
                )}
              </Col>
            </Row>
          </Card>
        )}
      />
    </div>
  )

  const renderLeave = () => (
    <div style={{ padding: 16 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Button icon={<ArrowLeftOutlined />} onClick={() => setActiveTab('home')}>Quay lại</Button>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setLeaveModal(true)}>Tạo đơn</Button>
        </Col>
      </Row>
      <Title level={4}>Đơn từ của tôi</Title>
      <List
        dataSource={leaves || []}
        locale={{ emptyText: 'Chưa có đơn nào' }}
        renderItem={(item: any) => (
          <Card size="small" style={{ marginBottom: 12, borderRadius: 8 }}>
            <Row justify="space-between" align="top">
              <Col flex="auto">
                <Text strong>{LOAI_DON_LABEL[item.loai_don] || item.loai_don}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {item.loai_don === 'ung_luong'
                    ? dayjs(item?.ngay_bat_dau).format('DD/MM/YYYY')
                    : `${dayjs(item?.ngay_bat_dau).format('DD/MM')} - ${dayjs(item?.ngay_ket_thuc).format('DD/MM')}`}
                </Text>
                {item.so_tien != null && (
                  <div style={{ fontSize: 13, color: '#1677ff', marginTop: 2 }}>
                    💰 {Number(item.so_tien).toLocaleString('vi-VN')} VNĐ
                  </div>
                )}
                {item.so_gio_ot != null && (
                  <div style={{ fontSize: 13, color: '#fa8c16', marginTop: 2 }}>
                    ⏰ {item.so_gio_ot} giờ OT
                  </div>
                )}
                {item.dia_diem && (
                  <div style={{ fontSize: 12, color: '#595959', marginTop: 2 }}>
                    📍 {item.dia_diem}
                  </div>
                )}
                {item.ly_do && (
                  <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4, fontStyle: 'italic' }}>
                    "{item.ly_do}"
                  </div>
                )}
                {item.trang_thai === 'cho_duyet' && (
                  <Button
                    size="small" danger style={{ marginTop: 6 }}
                    onClick={() => {
                      Modal.confirm({
                        title: 'Hủy đơn này?',
                        onOk: () => cancelMutation.mutate(item.id),
                      })
                    }}
                  >
                    Hủy đơn
                  </Button>
                )}
              </Col>
              <Col flex="100px" style={{ textAlign: 'right' }}>
                <Tag color={STATUS_COLOR[item.trang_thai] || 'default'} style={{ fontSize: 10 }}>
                  {item?.trang_thai?.toUpperCase()}
                </Tag>
              </Col>
            </Row>
          </Card>
        )}
      />
    </div>
  )

  const renderBenefits = () => {
    const benefitsList = myBenefits as any[]
    const totalReceived = benefitsList
      .filter(b => b.trang_thai === 'da_chi')
      .reduce((s, b) => s + Number(b.muc_tien || 0), 0)
    const pending = benefitsList.filter(b => b.trang_thai !== 'da_chi' && b.trang_thai !== 'huy').length

    return (
      <div style={{ padding: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => setActiveTab('home')} style={{ marginBottom: 16 }}>
          Quay lại
        </Button>
        <Title level={4}>🎁 Phúc lợi của tôi</Title>

        {/* Section: Bạn có quyền nhận (eligible benefits) */}
        {eligibleBenefits.length > 0 && (
          <Card
            size="small"
            style={{ marginBottom: 16, borderRadius: 12, background: '#f9f0ff', borderColor: '#d3adf7' }}
            title={<Text strong>✨ Bạn có quyền nhận</Text>}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {(eligibleBenefits as any[]).map((p) => {
                const loaiLabels: Record<string, { text: string; icon: string }> = {
                  sinh_nhat: { text: 'Sinh nhật', icon: '🎂' },
                  hieu: { text: 'Hiếu', icon: '🕯️' },
                  hi: { text: 'Hỉ', icon: '💒' },
                  sinh_con: { text: 'Sinh con', icon: '👶' },
                  tet_am: { text: 'Tết Âm', icon: '🧧' },
                  le_30_4: { text: 'Lễ 30/4', icon: '🎉' },
                  le_2_9: { text: 'Quốc Khánh', icon: '🇻🇳' },
                  le_8_3: { text: '8/3', icon: '🌹' },
                  le_20_10: { text: '20/10', icon: '🌸' },
                  trung_thu: { text: 'Trung thu', icon: '🥮' },
                  khac: { text: 'Khác', icon: '🎁' },
                }
                const cfg = loaiLabels[p.loai] || { text: p.loai, icon: '🎁' }
                return (
                  <div
                    key={p.id}
                    style={{
                      background: '#fff', padding: '8px 10px', borderRadius: 8,
                      border: '1px solid #efdbff',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600 }}>
                      {cfg.icon} {cfg.text}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#722ed1', marginTop: 2 }}>
                      {Number(p.muc_tien).toLocaleString('vi-VN')}đ
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize: 10, color: '#8c8c8c', marginTop: 8, textAlign: 'center' }}>
              💡 Chính sách công ty đang áp dụng cho bạn — liên hệ HR khi có sự kiện
            </div>
          </Card>
        )}

        {/* Stats card */}
        <Row gutter={12} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <Card size="small" style={{ borderRadius: 12, textAlign: 'center', background: '#f6ffed' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>Đã nhận</Text>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#52c41a', marginTop: 4 }}>
                {totalReceived.toLocaleString('vi-VN')}đ
              </div>
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small" style={{ borderRadius: 12, textAlign: 'center', background: '#fff7e6' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>Đang chờ</Text>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#fa8c16', marginTop: 4 }}>
                {pending}
              </div>
            </Card>
          </Col>
        </Row>

        {benefitsList.length === 0 ? (
          <Card size="small" style={{ textAlign: 'center', padding: 24 }}>
            <span style={{ fontSize: 48 }}>🎁</span>
            <div style={{ marginTop: 12, color: '#8c8c8c' }}>Chưa có phúc lợi nào</div>
          </Card>
        ) : (
          <List
            dataSource={benefitsList}
            renderItem={(item: any) => {
              const loaiLabels: Record<string, { text: string; icon: string }> = {
                sinh_nhat: { text: 'Sinh nhật', icon: '🎂' },
                hieu: { text: 'Hiếu', icon: '🕯️' },
                hi: { text: 'Hỉ', icon: '💒' },
                sinh_con: { text: 'Sinh con', icon: '👶' },
                tet_am: { text: 'Tết Âm', icon: '🧧' },
                le_30_4: { text: 'Lễ 30/4', icon: '🎉' },
                le_2_9: { text: 'Quốc Khánh', icon: '🇻🇳' },
                le_8_3: { text: '8/3', icon: '🌹' },
                le_20_10: { text: '20/10', icon: '🌸' },
                trung_thu: { text: 'Trung thu', icon: '🥮' },
                khac: { text: 'Khác', icon: '🎁' },
              }
              const cfg = loaiLabels[item.loai] || { text: item.loai, icon: '🎁' }
              const statusColors: Record<string, string> = {
                de_xuat: 'orange', da_duyet: 'blue', da_chi: 'green', huy: 'default',
              }
              const statusLabels: Record<string, string> = {
                de_xuat: 'Đang xét',
                da_duyet: 'Đã duyệt',
                da_chi: '✓ Đã chi',
                huy: 'Đã hủy',
              }
              return (
                <Card size="small" style={{ marginBottom: 10, borderRadius: 10 }}>
                  <Row justify="space-between" align="top">
                    <Col flex="auto">
                      <Text strong style={{ fontSize: 15 }}>{cfg.icon} {cfg.text}</Text>
                      <div style={{ fontSize: 12, color: '#595959', marginTop: 2 }}>
                        📅 {dayjs(item.ngay_su_kien).format('DD/MM/YYYY')}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#1677ff', marginTop: 6 }}>
                        {Number(item.muc_tien).toLocaleString('vi-VN')}đ
                      </div>
                      {item.ghi_chu && (
                        <div style={{ fontSize: 11, color: '#8c8c8c', fontStyle: 'italic', marginTop: 4 }}>
                          "{item.ghi_chu}"
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: '#bfbfbf', marginTop: 4 }}>
                        Kỳ lương: {item.thang_ap_dung}/{item.nam_ap_dung}
                      </div>
                    </Col>
                    <Col>
                      <Tag color={statusColors[item.trang_thai] || 'default'}>
                        {statusLabels[item.trang_thai] || item.trang_thai}
                      </Tag>
                    </Col>
                  </Row>
                </Card>
              )
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh' }}>
      {activeTab === 'home' && renderHome()}
      {activeTab === 'payroll' && renderPayroll()}
      {activeTab === 'leave' && renderLeave()}
      {activeTab === 'benefits' && renderBenefits()}
      {activeTab === 'checkin' && (
        <div>
          <div style={{ padding: '8px 12px 0' }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => setActiveTab('home')}>Quay lại</Button>
          </div>
          <MobileCheckIn />
        </div>
      )}

      <Modal
        title="Tạo đơn mới"
        open={leaveModal}
        onCancel={() => setLeaveModal(false)}
        onOk={() => form.submit()}
        okText="Gửi đơn"
        cancelText="Hủy"
        confirmLoading={createLeaveMutation.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => createLeaveMutation.mutate(v)} requiredMark={false}>
          <Form.Item name="loai_don" label="Loại đơn" rules={[{ required: true, message: 'Chọn loại đơn' }]}>
            <Select placeholder="Chọn loại đơn cần tạo">
              <Select.Option value="nghi_phep">🏖️ Nghỉ phép</Select.Option>
              {/* Tăng ca: chỉ tổ trưởng/tổ phó/cấp trên hơn mới đề xuất */}
              {profile?.can_request_overtime && (
                <Select.Option value="tang_ca">⏰ Tăng ca (Tổ trưởng/Tổ phó)</Select.Option>
              )}
              <Select.Option value="di_muon_ve_som">🕐 Đi muộn / Về sớm</Select.Option>
              <Select.Option value="cong_tac">✈️ Công tác</Select.Option>
              <Select.Option value="ung_luong">💰 Ứng lương</Select.Option>
            </Select>
          </Form.Item>
          {!profile?.can_request_overtime && (
            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: -10, marginBottom: 10 }}>
              💡 Đề xuất tăng ca: liên hệ tổ trưởng/tổ phó để nộp đơn
            </div>
          )}

          {/* Date range — không cần cho ứng lương */}
          {watchedLoai !== 'ung_luong' && (
            <>
              <Form.Item name="ngay_bat_dau" label="Từ ngày/giờ" rules={[{ required: true, message: 'Chọn ngày bắt đầu' }]}>
                <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="ngay_ket_thuc" label="Đến ngày/giờ" rules={[{ required: true, message: 'Chọn ngày kết thúc' }]}>
                <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </>
          )}

          {/* Conditional fields theo loại đơn */}
          {watchedLoai === 'tang_ca' && (
            <Form.Item
              name="so_gio_ot"
              label="Số giờ tăng ca"
              rules={[{ required: true, message: 'Nhập số giờ OT' }]}
            >
              <Input type="number" min={0.5} max={24} step={0.5} suffix="giờ" />
            </Form.Item>
          )}

          {watchedLoai === 'cong_tac' && (
            <>
              <Form.Item name="dia_diem" label="Địa điểm công tác" rules={[{ required: true, message: 'Nhập địa điểm' }]}>
                <Input placeholder="VD: Tây Ninh, Bình Dương..." />
              </Form.Item>
              <Form.Item name="so_tien" label="Tạm ứng (VNĐ)">
                <Input type="number" min={0} step={100000} placeholder="VD: 500000" />
              </Form.Item>
            </>
          )}

          {watchedLoai === 'ung_luong' && (
            <>
              <Form.Item name="ngay_bat_dau" label="Ngày cần ứng" rules={[{ required: true }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="ngay_ket_thuc" hidden>
                <DatePicker />
              </Form.Item>
              <Form.Item
                name="so_tien"
                label="Số tiền ứng (VNĐ)"
                rules={[{ required: true, message: 'Nhập số tiền cần ứng' }]}
                extra="Sẽ tự trừ vào kỳ lương gần nhất"
              >
                <Input type="number" min={100000} step={100000} placeholder="VD: 2000000" />
              </Form.Item>
            </>
          )}

          <Form.Item
            name="ly_do"
            label="Lý do"
            rules={[{ required: watchedLoai !== 'ung_luong', message: 'Nhập lý do' }]}
          >
            <TextArea rows={3} placeholder="Mô tả ngắn gọn..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
