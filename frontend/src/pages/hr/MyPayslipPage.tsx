/**
 * Phiếu lương cá nhân (Mobile + Web) — Sprint D.5
 * Điều 13.5-13.6 + Điều 16 Quy chế Lương Nam Phương
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Row, Col, Typography, Space, Button, Tag, Alert, Modal, Form, Input,
  InputNumber, Select, message, Empty, Spin, Statistic, Divider, List, Result,
} from 'antd'
import {
  DollarOutlined, AlertOutlined, CheckCircleOutlined, WarningOutlined,
  FileTextOutlined, CalendarOutlined, ArrowLeftOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { hrApi } from '../../api/hr'

const { Title, Text } = Typography
const { TextArea } = Input

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n || 0)) + 'đ'

const STATUS_COLOR: Record<string, string> = {
  du_thao: 'orange',
  da_chot: 'blue',
  da_thanh_toan: 'green',
}
const STATUS_LABEL: Record<string, string> = {
  du_thao: 'Dự thảo',
  da_chot: 'Đã chốt — chờ chi trả',
  da_thanh_toan: 'Đã thanh toán',
}

export default function MyPayslipPage() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const [picked, setPicked] = useState<{ nam: number; thang: number } | null>(null)
  const [complaintOpen, setComplaintOpen] = useState(false)
  const [form] = Form.useForm()

  // List các tháng đã chốt
  const { data: months = [], isLoading: monthsLoading } = useQuery({
    queryKey: ['my-payslip-months'],
    queryFn: () => hrApi.listMyAvailableMonths().then(r => r.data),
  })

  // Auto-pick tháng gần nhất
  if (!picked && months.length > 0) {
    setPicked({ nam: months[0].nam, thang: months[0].thang })
  }

  // Phiếu lương chi tiết
  const { data: payslip, isLoading, error } = useQuery({
    queryKey: ['my-payslip', picked?.nam, picked?.thang],
    queryFn: () => hrApi.getMyPayslip(picked!.nam, picked!.thang).then(r => r.data),
    enabled: !!picked,
  })

  // List khiếu nại của mình
  const { data: myComplaints = [] } = useQuery({
    queryKey: ['my-complaints', picked?.nam, picked?.thang],
    queryFn: () => hrApi.listComplaints({ nam: picked!.nam, thang: picked!.thang }).then(r => r.data),
    enabled: !!picked,
  })

  const createComplaintMut = useMutation({
    mutationFn: (data: any) => hrApi.createComplaint({
      ...data,
      payroll_run_id: payslip?.id,
      thang: picked!.thang,
      nam: picked!.nam,
    }),
    onSuccess: () => {
      message.success('Đã gửi khiếu nại — HR sẽ xử lý trong vòng vài ngày tới')
      setComplaintOpen(false)
      form.resetFields()
      qc.invalidateQueries({ queryKey: ['my-complaints'] })
      qc.invalidateQueries({ queryKey: ['my-payslip'] })
    },
    onError: (e: any) => {
      message.error(e?.response?.data?.detail || 'Gửi khiếu nại không thành công')
    },
  })

  if (monthsLoading) return <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>

  if (!months.length) {
    return (
      <div style={{ background: '#f5f5f5', minHeight: '100vh', padding: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => nav(-1)} style={{ marginBottom: 12 }}>Quay lại</Button>
        <Result
          status="info"
          title="Chưa có phiếu lương"
          subTitle="Hệ thống chưa chốt bảng lương tháng nào cho bạn. Liên hệ HR nếu cần hỗ trợ."
        />
      </div>
    )
  }

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', padding: 12 }}>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => nav(-1)}>Quay lại</Button>
        <Select
          value={picked ? `${picked.nam}-${picked.thang}` : undefined}
          onChange={(v) => {
            const [nam, thang] = v.split('-').map(Number)
            setPicked({ nam, thang })
          }}
          style={{ minWidth: 200 }}
          options={months.map(m => ({
            value: `${m.nam}-${m.thang}`,
            label: `Tháng ${String(m.thang).padStart(2, '0')}/${m.nam} • ${fmt(m.thuc_linh)}`,
          }))}
        />
      </Space>

      {isLoading ? (
        <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>
      ) : error ? (
        <Alert type="error" message="Không tải được phiếu lương" description={(error as any)?.message} />
      ) : payslip ? (
        <>
          {/* Hero card: Thực nhận */}
          <Card
            style={{
              marginBottom: 12,
              background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
              color: '#fff',
            }}
            styles={{ body: { color: '#fff' } }}
          >
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
                <DollarOutlined /> Thực lĩnh tháng {payslip.thang}/{payslip.nam}
              </Text>
              <Title level={1} style={{ color: '#fff', margin: 0, fontSize: 36 }}>
                {fmt(payslip.thuc_linh)}
              </Title>
              <Space>
                <Tag color={STATUS_COLOR[payslip.trang_thai] || 'default'} style={{ marginTop: 4 }}>
                  {STATUS_LABEL[payslip.trang_thai] || payslip.trang_thai}
                </Tag>
                {payslip.bo_phan && (
                  <Tag style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none' }}>
                    {payslip.bo_phan}
                  </Tag>
                )}
              </Space>
            </Space>
          </Card>

          {/* Bảng chi tiết 8 dòng theo Điều 13 */}
          <Card title="📋 Chi tiết các thành phần lương" style={{ marginBottom: 12 }}>
            {/* Dòng 1: Lương sản phẩm */}
            <Row justify="space-between" style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
              <Text>1. Lương sản phẩm (Điều 10)</Text>
              <Text strong style={{ color: '#1677ff' }}>{fmt(payslip.luong_san_pham)}</Text>
            </Row>

            {/* Dòng 2: Bù tối thiểu vùng */}
            {payslip.bu_toi_thieu_vung > 0 && (
              <Row justify="space-between" style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                <Text>2. Bù tối thiểu vùng (Điều 4.8)</Text>
                <Text strong style={{ color: '#52c41a' }}>+{fmt(payslip.bu_toi_thieu_vung)}</Text>
              </Row>
            )}

            {/* Dòng 3: Cộng thêm chi tiết */}
            {payslip.cong_them_chi_tiet.length > 0 && (
              <>
                <Row style={{ padding: '8px 0 4px' }}>
                  <Text strong>3. Cộng thêm (Điều 12)</Text>
                </Row>
                {payslip.cong_them_chi_tiet.map((it: any, idx: number) => (
                  <Row key={idx} justify="space-between" style={{ padding: '4px 0 4px 16px', fontSize: 13 }}>
                    <Text type="secondary">• {it.ten_hien_thi}</Text>
                    <Text style={{ color: '#52c41a' }}>+{fmt(it.so_tien)}</Text>
                  </Row>
                ))}
                <Row justify="space-between" style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <Text type="secondary">Tổng cộng thêm</Text>
                  <Text strong style={{ color: '#52c41a' }}>+{fmt(payslip.tong_cong_them)}</Text>
                </Row>
              </>
            )}

            {/* Tổng thu nhập */}
            <Row
              justify="space-between"
              style={{ padding: '12px 8px', borderBottom: '2px solid #fa8c16', background: '#fff7e6', marginBottom: 8 }}
            >
              <Text strong style={{ fontSize: 15, color: '#d46b08' }}>📈 TỔNG THU NHẬP (Điều 13.5)</Text>
              <Text strong style={{ fontSize: 16, color: '#d46b08' }}>{fmt(payslip.tong_thu_nhap)}</Text>
            </Row>

            {/* Dòng 4: Bảo hiểm */}
            {payslip.bao_hiem_chi_tiet.length > 0 && (
              <>
                <Row style={{ padding: '8px 0 4px' }}>
                  <Text strong>4. Bảo hiểm</Text>
                </Row>
                {payslip.bao_hiem_chi_tiet.map((it: any, idx: number) => (
                  <Row key={idx} justify="space-between" style={{ padding: '4px 0 4px 16px', fontSize: 13 }}>
                    <Text type="secondary">• {it.ten_hien_thi}</Text>
                    <Text style={{ color: '#ff4d4f' }}>−{fmt(it.so_tien)}</Text>
                  </Row>
                ))}
              </>
            )}

            {/* Dòng 5: Tạm ứng */}
            {payslip.tam_ung > 0 && (
              <Row justify="space-between" style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                <Text>5. Tạm ứng đã trừ</Text>
                <Text style={{ color: '#ff4d4f' }}>−{fmt(payslip.tam_ung)}</Text>
              </Row>
            )}

            {/* Dòng 6: Khấu trừ khác */}
            {payslip.khau_tru_khac_chi_tiet.length > 0 && (
              <>
                <Row style={{ padding: '8px 0 4px' }}>
                  <Text strong>6. Khấu trừ khác</Text>
                </Row>
                {payslip.khau_tru_khac_chi_tiet.map((it: any, idx: number) => (
                  <Row key={idx} justify="space-between" style={{ padding: '4px 0 4px 16px', fontSize: 13 }}>
                    <Text type="secondary">• {it.ten_hien_thi}</Text>
                    <Text style={{ color: '#ff4d4f' }}>−{fmt(it.so_tien)}</Text>
                  </Row>
                ))}
              </>
            )}

            {/* Tổng khấu trừ */}
            {payslip.tong_khau_tru > 0 && (
              <Row justify="space-between" style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                <Text type="secondary">Tổng khấu trừ</Text>
                <Text strong style={{ color: '#ff4d4f' }}>−{fmt(payslip.tong_khau_tru)}</Text>
              </Row>
            )}

            {/* Thực nhận lớn */}
            <Row
              justify="space-between"
              align="middle"
              style={{ padding: '16px 8px', background: '#f6ffed', marginTop: 8, borderRadius: 6 }}
            >
              <Text strong style={{ fontSize: 16, color: '#389e0d' }}>💰 THỰC NHẬN (Điều 13.6)</Text>
              <Text strong style={{ fontSize: 20, color: '#389e0d' }}>{fmt(payslip.thuc_linh)}</Text>
            </Row>
          </Card>

          {/* Engine snapshot — để NV hiểu công thức */}
          {(payslip.cong_quy_doi || payslip.he_so_ca_nhan) && (
            <Card title="🧮 Cơ sở tính lương sản phẩm (Quy chế Điều 7-10)" style={{ marginBottom: 12 }}>
              <Row gutter={[8, 8]}>
                <Col xs={12} sm={8}>
                  <Statistic title="Công quy đổi" value={Number(payslip.cong_quy_doi)} precision={2} />
                </Col>
                <Col xs={12} sm={8}>
                  <Statistic title="Hệ số cá nhân" value={Number(payslip.he_so_ca_nhan)} precision={2} />
                </Col>
                <Col xs={12} sm={8}>
                  <Statistic title="Trọng số cá nhân" value={Number(payslip.trong_so_ca_nhan)} precision={2} />
                </Col>
              </Row>
              {payslip.ghi_chu_calc && (
                <Alert
                  type="info"
                  showIcon
                  style={{ marginTop: 8 }}
                  message="Nhật ký tính"
                  description={<pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: 0 }}>{payslip.ghi_chu_calc}</pre>}
                />
              )}
            </Card>
          )}

          {/* Khiếu nại block (Điều 16) */}
          <Card
            title={
              <Space>
                <AlertOutlined style={{ color: '#fa8c16' }} />
                <span>Khiếu nại lương (Điều 16)</span>
              </Space>
            }
            extra={
              payslip.co_the_khieu_nai ? (
                <Tag color="green">Còn {dayjs(payslip.han_chot_khieu_nai).diff(dayjs(), 'day')} ngày</Tag>
              ) : (
                <Tag color="default">Đã hết hạn</Tag>
              )
            }
            style={{ marginBottom: 12 }}
          >
            <Alert
              type={payslip.co_the_khieu_nai ? 'info' : 'warning'}
              showIcon
              icon={<CalendarOutlined />}
              message={
                payslip.co_the_khieu_nai
                  ? `Bạn có thể phản hồi nếu phát hiện sai sót đến hết ngày ${dayjs(payslip.han_chot_khieu_nai).format('DD/MM/YYYY')}`
                  : 'Đã quá hạn 15 ngày làm việc — không thể tạo khiếu nại mới'
              }
              description={
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Theo Điều 16 Quy chế Lương: thời hạn phản hồi là 15 ngày làm việc kể từ ngày nhận phiếu lương.
                </Text>
              }
              style={{ marginBottom: 12 }}
            />

            {payslip.co_the_khieu_nai && (
              <Button
                type="primary"
                danger
                icon={<WarningOutlined />}
                block
                onClick={() => setComplaintOpen(true)}
              >
                Gửi khiếu nại về tháng này
              </Button>
            )}

            {/* Khiếu nại đã gửi */}
            {myComplaints.length > 0 && (
              <>
                <Divider style={{ margin: '12px 0' }}>Khiếu nại đã gửi ({myComplaints.length})</Divider>
                <List
                  size="small"
                  dataSource={myComplaints}
                  renderItem={(c: any) => (
                    <List.Item style={{ padding: '8px 0' }}>
                      <Space direction="vertical" style={{ width: '100%' }} size={4}>
                        <Space>
                          <Tag color={
                            c.trang_thai === 'co_sai_sot' ? 'green' :
                            c.trang_thai === 'khong_sai_sot' ? 'red' :
                            c.trang_thai === 'dang_xu_ly' ? 'blue' :
                            c.trang_thai === 'het_han' ? 'default' : 'orange'
                          }>
                            {c.trang_thai === 'moi' ? 'Đã gửi' :
                             c.trang_thai === 'dang_xu_ly' ? 'Đang xử lý' :
                             c.trang_thai === 'co_sai_sot' ? 'Có sai sót — đã điều chỉnh' :
                             c.trang_thai === 'khong_sai_sot' ? 'Không có sai sót' :
                             'Hết hạn'}
                          </Tag>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {dayjs(c.created_at).format('DD/MM/YYYY HH:mm')}
                          </Text>
                        </Space>
                        <Text style={{ fontSize: 13 }}>{c.ly_do}</Text>
                        {c.ket_qua && (
                          <Alert
                            type={c.trang_thai === 'co_sai_sot' ? 'success' : 'warning'}
                            showIcon
                            message={`HR phản hồi: ${c.ket_qua}`}
                            style={{ fontSize: 12 }}
                          />
                        )}
                      </Space>
                    </List.Item>
                  )}
                />
              </>
            )}
          </Card>
        </>
      ) : (
        <Empty />
      )}

      <Modal
        title={<Space><WarningOutlined style={{ color: '#fa8c16' }} /> Gửi khiếu nại lương (Điều 16)</Space>}
        open={complaintOpen}
        onCancel={() => setComplaintOpen(false)}
        onOk={() => form.submit()}
        okText="Gửi khiếu nại"
        cancelText="Hủy"
        confirmLoading={createComplaintMut.isPending}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          message="Theo Điều 16 Quy chế: HR sẽ phối hợp với QC + kế toán kiểm tra, kết quả trả về trong vài ngày làm việc."
          style={{ marginBottom: 12 }}
        />
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => createComplaintMut.mutate(v)}
          requiredMark={false}
        >
          <Form.Item
            name="ly_do"
            label="Mô tả sai sót / lý do khiếu nại"
            rules={[
              { required: true, message: 'Vui lòng mô tả chi tiết' },
              { min: 10, message: 'Mô tả ít nhất 10 ký tự' },
              { max: 2000, message: 'Tối đa 2000 ký tự' },
            ]}
          >
            <TextArea
              rows={4}
              placeholder="VD: Tháng này tôi làm 26 ngày công nhưng bảng lương chỉ ghi 22 ngày. Đề nghị HR kiểm tra lại dữ liệu chấm công..."
            />
          </Form.Item>
          <Form.Item
            name="so_tien_khieu_nai"
            label="Số tiền sai lệch ước tính (nếu có)"
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              step={100000}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              addonAfter="đ"
            />
          </Form.Item>
          <Form.Item name="bang_chung" label="Bằng chứng / link tài liệu (tuỳ chọn)">
            <TextArea rows={2} placeholder="VD: Ảnh chấm công ngày 5/6, biên bản tổ trưởng..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
