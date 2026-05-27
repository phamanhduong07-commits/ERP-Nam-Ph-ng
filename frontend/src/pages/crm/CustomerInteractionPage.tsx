import { useState } from 'react'
import {
  Table, Button, Space, Tag, Drawer, Form, Input, DatePicker,
  Select, message, Popconfirm, Typography, Row, Col, Card,
  Alert, Statistic, Descriptions,
} from 'antd'
import {
  PlusOutlined, PhoneOutlined, TeamOutlined, MailOutlined,
  WarningOutlined, DeleteOutlined,
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import axios from 'axios'
import EmptyState from "../../components/EmptyState"

const { Title } = Typography

interface Interaction {
  id: number
  customer_id: number
  loai: string
  ngay: string
  noi_dung: string | null
  ket_qua: string | null
  ngay_nhac_nho: string | null
  nguoi_phu_trach_id: number | null
  created_by: number | null
}

interface CreditAlert {
  customer_id: number
  ten_viet_tat: string
  ten_don_vi: string | null
  credit_limit: number
  du_no_hien_tai: number
  vuot_han_muc: number
}

const API = '/api/crm'
const fmt = (n: number) => Number(n).toLocaleString('vi-VN')

const LOAI_OPTIONS = [
  { value: 'goi_dien', label: 'Gọi điện', icon: <PhoneOutlined /> },
  { value: 'gap_mat', label: 'Gặp mặt', icon: <TeamOutlined /> },
  { value: 'email', label: 'Email', icon: <MailOutlined /> },
  { value: 'bao_gia', label: 'Báo giá' },
  { value: 'khieu_nai', label: 'Khiếu nại' },
  { value: 'khac', label: 'Khác' },
]

const KET_QUA_OPTIONS = [
  { value: 'tich_cuc', label: 'Tích cực', color: 'green' },
  { value: 'trung_tinh', label: 'Trung tính', color: 'blue' },
  { value: 'tieu_cuc', label: 'Tiêu cực', color: 'red' },
]

const loaiLabel = (v: string) => LOAI_OPTIONS.find(o => o.value === v)?.label ?? v
const ketQuaTag = (v: string | null) => {
  if (!v) return '—'
  const o = KET_QUA_OPTIONS.find(x => x.value === v)
  return <Tag color={o?.color}>{o?.label ?? v}</Tag>
}

export default function CustomerInteractionPage() {
  const qc = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [detail, setDetail] = useState<Interaction | null>(null)
  const [form] = Form.useForm()

  const { data: interactions = [], isLoading } = useQuery<Interaction[]>({
    queryKey: ['crm-interactions'],
    queryFn: () => axios.get(`${API}/interactions`).then(r => r.data),
  })

  const { data: alerts = [] } = useQuery<CreditAlert[]>({
    queryKey: ['crm-credit-alerts'],
    queryFn: () => axios.get(`${API}/credit-alerts`).then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (v: Record<string, unknown>) => axios.post(`${API}/interactions`, v),
    onSuccess: () => {
      message.success('Đã ghi tương tác')
      qc.invalidateQueries({ queryKey: ['crm-interactions'] })
      setDrawerOpen(false)
      form.resetFields()
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => axios.delete(`${API}/interactions/${id}`),
    onSuccess: () => {
      message.success('Đã xóa')
      qc.invalidateQueries({ queryKey: ['crm-interactions'] })
    },
  })

  const columns = [
    { title: 'Ngày', dataIndex: 'ngay', width: 110 },
    {
      title: 'Loại',
      dataIndex: 'loai',
      render: (v: string) => loaiLabel(v),
    },
    { title: 'Nội dung', dataIndex: 'noi_dung', ellipsis: true },
    {
      title: 'Kết quả',
      dataIndex: 'ket_qua',
      render: ketQuaTag,
    },
    {
      title: 'Nhắc nhở',
      dataIndex: 'ngay_nhac_nho',
      render: (v: string | null) => {
        if (!v) return '—'
        const isPast = dayjs(v).isBefore(dayjs(), 'day')
        return <Tag color={isPast ? 'red' : 'orange'}>{v}</Tag>
      },
    },
    {
      title: '',
      key: 'actions',
      render: (_: unknown, r: Interaction) => (
        <Space>
          <Button size="small" onClick={() => setDetail(r)}>Chi tiết</Button>
          <Popconfirm title="Xóa tương tác này?" onConfirm={() => deleteMut.mutate(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const onSubmit = (values: Record<string, unknown>) => {
    const payload = {
      ...values,
      ngay: dayjs(values.ngay as dayjs.Dayjs).format('YYYY-MM-DD'),
      ngay_nhac_nho: values.ngay_nhac_nho
        ? dayjs(values.ngay_nhac_nho as dayjs.Dayjs).format('YYYY-MM-DD')
        : undefined,
    }
    createMut.mutate(payload)
  }

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 16 }} align="middle">
        <Col>
          <Title level={4} style={{ margin: 0 }}>CRM — Tương tác khách hàng</Title>
        </Col>
        <Col flex={1} />
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
            Ghi tương tác
          </Button>
        </Col>
      </Row>

      {alerts.length > 0 && (
        <Alert
          type="warning"
          icon={<WarningOutlined />}
          showIcon
          style={{ marginBottom: 16 }}
          message={`${alerts.length} khách hàng vượt hạn mức tín dụng`}
          description={
            <Row gutter={16}>
              {alerts.slice(0, 3).map(a => (
                <Col key={a.customer_id}>
                  <Statistic
                    title={a.ten_viet_tat}
                    value={a.vuot_han_muc}
                    suffix="đ vượt"
                    formatter={v => fmt(Number(v))}
                    valueStyle={{ color: '#cf1322', fontSize: 14 }}
                  />
                </Col>
              ))}
            </Row>
          }
        />
      )}

      <Card>
        <Table
                    locale={{ emptyText: <EmptyState size="small" /> }}
                    rowKey="id"
          loading={isLoading}
          dataSource={interactions}
          columns={columns}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      {/* Create drawer */}
      <Drawer
        title="Ghi tương tác khách hàng"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={480}
        footer={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>Hủy</Button>
            <Button type="primary" loading={createMut.isPending} onClick={() => form.submit()}>
              Lưu
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item name="customer_id" label="Mã khách hàng (ID)" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="Nhập ID khách hàng"
              options={[]}
              notFoundContent="Nhập ID số"
            />
          </Form.Item>
          <Form.Item name="loai" label="Loại tương tác" rules={[{ required: true }]}>
            <Select options={LOAI_OPTIONS} />
          </Form.Item>
          <Form.Item name="ngay" label="Ngày" rules={[{ required: true }]} initialValue={dayjs()}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="ket_qua" label="Kết quả">
            <Select allowClear options={KET_QUA_OPTIONS.map(o => ({ value: o.value, label: o.label }))} />
          </Form.Item>
          <Form.Item name="noi_dung" label="Nội dung">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="ngay_nhac_nho" label="Ngày nhắc nhở">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Detail drawer */}
      <Drawer
        title="Chi tiết tương tác"
        open={!!detail}
        onClose={() => setDetail(null)}
        width={440}
      >
        {detail && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Loại">{loaiLabel(detail.loai)}</Descriptions.Item>
            <Descriptions.Item label="Ngày">{detail.ngay}</Descriptions.Item>
            <Descriptions.Item label="Kết quả">{ketQuaTag(detail.ket_qua)}</Descriptions.Item>
            <Descriptions.Item label="Nội dung">{detail.noi_dung || '—'}</Descriptions.Item>
            <Descriptions.Item label="Ngày nhắc nhở">{detail.ngay_nhac_nho || '—'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  )
}
