import { useState } from 'react'
import {
  Table, Button, Space, Tag, Drawer, Form, Input, InputNumber, DatePicker,
  Select, message, Typography, Row, Col, Card, Descriptions, Statistic,
} from 'antd'
import { PlusOutlined, ToolOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import axios from 'axios'
import EmptyState from "../../components/EmptyState"

const { Title } = Typography

interface Machine {
  id: number
  ma_may: string
  ten_may: string
}

interface MaintenanceLog {
  id: number
  machine_id: number
  schedule_id: number | null
  loai: string
  ngay_bat_dau: string
  ngay_ket_thuc: string | null
  downtime_phut: number
  mo_ta_su_co: string | null
  bien_phap_xu_ly: string | null
  chi_phi_vat_tu: number
  chi_phi_nhan_cong: number
  tong_chi_phi: number
  created_by: number | null
}

const API = '/api/maintenance'
const fmt = (n: number) => Number(n).toLocaleString('vi-VN')

export default function MaintenanceLogPage() {
  const qc = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [detail, setDetail] = useState<MaintenanceLog | null>(null)
  const [form] = Form.useForm()

  const { data: machines = [] } = useQuery<Machine[]>({
    queryKey: ['maintenance-machines'],
    queryFn: () => axios.get(`${API}/machines`).then(r => r.data),
  })

  const { data: logs = [], isLoading } = useQuery<MaintenanceLog[]>({
    queryKey: ['maintenance-logs'],
    queryFn: () => axios.get(`${API}/logs`).then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (v: Record<string, unknown>) => axios.post(`${API}/logs`, v),
    onSuccess: () => {
      message.success('Đã ghi nhật ký bảo trì')
      qc.invalidateQueries({ queryKey: ['maintenance-logs'] })
      setDrawerOpen(false)
      form.resetFields()
    },
  })

  const totalCost = logs.reduce((s, l) => s + Number(l.tong_chi_phi), 0)
  const suCoCount = logs.filter(l => l.loai === 'su_co').length

  const machineName = (id: number) => {
    const m = machines.find(x => x.id === id)
    return m ? `${m.ma_may} — ${m.ten_may}` : String(id)
  }

  const columns = [
    {
      title: 'Máy',
      key: 'machine',
      render: (_: unknown, r: MaintenanceLog) => machineName(r.machine_id),
    },
    {
      title: 'Loại',
      dataIndex: 'loai',
      render: (v: string) =>
        v === 'su_co' ? <Tag color="red">Sự cố</Tag> : <Tag color="blue">Định kỳ</Tag>,
    },
    { title: 'Ngày bắt đầu', dataIndex: 'ngay_bat_dau' },
    { title: 'Downtime (phút)', dataIndex: 'downtime_phut', align: 'center' as const },
    {
      title: 'Chi phí vật tư',
      dataIndex: 'chi_phi_vat_tu',
      align: 'right' as const,
      render: (v: number) => fmt(v),
    },
    {
      title: 'Chi phí nhân công',
      dataIndex: 'chi_phi_nhan_cong',
      align: 'right' as const,
      render: (v: number) => fmt(v),
    },
    {
      title: 'Tổng chi phí',
      dataIndex: 'tong_chi_phi',
      align: 'right' as const,
      render: (v: number) => <b>{fmt(v)}</b>,
    },
    {
      title: '',
      key: 'action',
      render: (_: unknown, r: MaintenanceLog) => (
        <Button size="small" onClick={() => setDetail(r)}>Chi tiết</Button>
      ),
    },
  ]

  const onSubmit = (values: Record<string, unknown>) => {
    const payload = {
      ...values,
      ngay_bat_dau: dayjs(values.ngay_bat_dau as dayjs.Dayjs).format('YYYY-MM-DD'),
      ngay_ket_thuc: values.ngay_ket_thuc
        ? dayjs(values.ngay_ket_thuc as dayjs.Dayjs).format('YYYY-MM-DD')
        : undefined,
    }
    createMut.mutate(payload)
  }

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Nhật ký bảo trì</Title>
        </Col>
        <Col flex={1} />
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
            Ghi nhật ký
          </Button>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Tổng chi phí bảo trì" value={totalCost} suffix="đ"
              formatter={v => fmt(Number(v))} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Số sự cố" value={suCoCount} prefix={<ToolOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Tổng nhật ký" value={logs.length} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
                    locale={{ emptyText: <EmptyState size="small" /> }}
                    rowKey="id"
          loading={isLoading}
          dataSource={logs}
          columns={columns}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      {/* Create drawer */}
      <Drawer
        title="Ghi nhật ký bảo trì"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={520}
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
          <Form.Item name="machine_id" label="Máy" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={machines.map(m => ({ value: m.id, label: `${m.ma_may} — ${m.ten_may}` }))}
            />
          </Form.Item>
          <Form.Item name="loai" label="Loại" rules={[{ required: true }]}>
            <Select options={[
              { value: 'dinh_ky', label: 'Định kỳ' },
              { value: 'su_co', label: 'Sự cố' },
            ]} />
          </Form.Item>
          <Form.Item name="ngay_bat_dau" label="Ngày bắt đầu" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="ngay_ket_thuc" label="Ngày kết thúc">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="downtime_phut" label="Downtime (phút)" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="chi_phi_vat_tu" label="Chi phí vật tư (đ)" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="chi_phi_nhan_cong" label="Chi phí nhân công (đ)" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="mo_ta_su_co" label="Mô tả sự cố">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="bien_phap_xu_ly" label="Biện pháp xử lý">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Detail drawer */}
      <Drawer
        title="Chi tiết nhật ký"
        open={!!detail}
        onClose={() => setDetail(null)}
        width={480}
      >
        {detail && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Máy">{machineName(detail.machine_id)}</Descriptions.Item>
            <Descriptions.Item label="Loại">
              {detail.loai === 'su_co' ? 'Sự cố' : 'Định kỳ'}
            </Descriptions.Item>
            <Descriptions.Item label="Ngày bắt đầu">{detail.ngay_bat_dau}</Descriptions.Item>
            <Descriptions.Item label="Ngày kết thúc">{detail.ngay_ket_thuc || '—'}</Descriptions.Item>
            <Descriptions.Item label="Downtime">{detail.downtime_phut} phút</Descriptions.Item>
            <Descriptions.Item label="Mô tả sự cố">{detail.mo_ta_su_co || '—'}</Descriptions.Item>
            <Descriptions.Item label="Biện pháp xử lý">{detail.bien_phap_xu_ly || '—'}</Descriptions.Item>
            <Descriptions.Item label="Chi phí vật tư">{fmt(detail.chi_phi_vat_tu)} đ</Descriptions.Item>
            <Descriptions.Item label="Chi phí nhân công">{fmt(detail.chi_phi_nhan_cong)} đ</Descriptions.Item>
            <Descriptions.Item label="Tổng chi phí"><b>{fmt(detail.tong_chi_phi)} đ</b></Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  )
}
