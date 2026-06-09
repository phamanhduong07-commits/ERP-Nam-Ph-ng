import { useState } from 'react'
import {
  Table, Button, Space, Tag, Drawer, Form, Input, InputNumber, DatePicker,
  Select, message, Popconfirm, Card, Badge,
} from 'antd'
import { PlusOutlined, CheckOutlined, WarningOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import axios from 'axios'
import EmptyState from "../../components/EmptyState"
import PageLayout from '../../components/PageLayout'

interface Machine {
  id: number
  ma_may: string
  ten_may: string
  trang_thai: string
}

interface Schedule {
  id: number
  machine_id: number
  loai_bao_tri: string
  chu_ky_ngay: number
  ngay_bao_tri_gan_nhat: string | null
  ngay_bao_tri_tiep_theo: string | null
  trang_thai: string
  ghi_chu: string | null
}

const API = '/api/maintenance'

const trangThaiTag = (s: string) => {
  if (s === 'qua_han') return <Tag color="red" icon={<WarningOutlined />}>Quá hạn</Tag>
  if (s === 'sap_den_han') return <Tag color="orange">Sắp đến hạn</Tag>
  return <Tag color="green">Đúng hạn</Tag>
}

export default function MaintenanceSchedulePage() {
  const qc = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [form] = Form.useForm()

  const { data: machines = [] } = useQuery<Machine[]>({
    queryKey: ['maintenance-machines'],
    queryFn: () => axios.get(`${API}/machines`).then(r => r.data),
  })

  const { data: schedules = [], isLoading } = useQuery<Schedule[]>({
    queryKey: ['maintenance-schedules'],
    queryFn: () => axios.get(`${API}/schedules`).then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (v: Record<string, unknown>) => axios.post(`${API}/schedules`, v),
    onSuccess: () => {
      message.success('Đã tạo lịch bảo trì')
      qc.invalidateQueries({ queryKey: ['maintenance-schedules'] })
      setDrawerOpen(false)
      form.resetFields()
    },
  })

  const completeMut = useMutation({
    mutationFn: (id: number) => axios.post(`${API}/schedules/${id}/complete`),
    onSuccess: () => {
      message.success('Đã hoàn thành bảo trì — ngày tiếp theo đã cập nhật')
      qc.invalidateQueries({ queryKey: ['maintenance-schedules'] })
    },
  })

  const overdueCount = schedules.filter(s => s.trang_thai === 'qua_han').length
  const soonCount = schedules.filter(s => s.trang_thai === 'sap_den_han').length

  const columns = [
    {
      title: 'Máy',
      key: 'machine',
      render: (_: unknown, r: Schedule) => {
        const m = machines.find(x => x.id === r.machine_id)
        return m ? `${m.ma_may} — ${m.ten_may}` : r.machine_id
      },
    },
    { title: 'Loại bảo trì', dataIndex: 'loai_bao_tri' },
    { title: 'Chu kỳ (ngày)', dataIndex: 'chu_ky_ngay', align: 'center' as const },
    {
      title: 'Lần gần nhất',
      dataIndex: 'ngay_bao_tri_gan_nhat',
      render: (v: string | null) => v || '—',
    },
    {
      title: 'Lần tiếp theo',
      dataIndex: 'ngay_bao_tri_tiep_theo',
      render: (v: string | null) => v || '—',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      render: trangThaiTag,
    },
    {
      title: '',
      key: 'actions',
      render: (_: unknown, r: Schedule) => (
        <Popconfirm
          title="Xác nhận đã thực hiện bảo trì hôm nay?"
          onConfirm={() => completeMut.mutate(r.id)}
        >
          <Button size="small" icon={<CheckOutlined />} type="primary" ghost>
            Hoàn thành
          </Button>
        </Popconfirm>
      ),
    },
  ]

  const onSubmit = (values: Record<string, unknown>) => {
    const payload = {
      ...values,
      ngay_bao_tri_gan_nhat: values.ngay_bao_tri_gan_nhat
        ? dayjs(values.ngay_bao_tri_gan_nhat as dayjs.Dayjs).format('YYYY-MM-DD')
        : undefined,
    }
    createMut.mutate(payload)
  }

  return (
    <PageLayout
      title="Lịch bảo trì máy"
      actions={
        <Space>
          {overdueCount > 0 && (
            <Badge count={overdueCount} color="red">
              <Tag color="red">Quá hạn</Tag>
            </Badge>
          )}
          {soonCount > 0 && (
            <Badge count={soonCount} color="orange">
              <Tag color="orange">Sắp đến hạn</Tag>
            </Badge>
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
            Thêm lịch
          </Button>
        </Space>
      }
    >
      <Card>
        <Table
                    locale={{ emptyText: <EmptyState size="small" /> }}
                    rowKey="id"
          loading={isLoading}
          dataSource={schedules}
          columns={columns}
          pagination={{ pageSize: 20 }}
          rowClassName={(r: Schedule) =>
            r.trang_thai === 'qua_han' ? 'ant-table-row-danger' : ''
          }
        />
      </Card>

      <Drawer
        title="Thêm lịch bảo trì"
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
          <Form.Item name="machine_id" label="Máy" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={machines.map(m => ({ value: m.id, label: `${m.ma_may} — ${m.ten_may}` }))}
            />
          </Form.Item>
          <Form.Item name="loai_bao_tri" label="Loại bảo trì" rules={[{ required: true }]}>
            <Input placeholder="VD: Bảo trì định kỳ, Thay dầu..." />
          </Form.Item>
          <Form.Item name="chu_ky_ngay" label="Chu kỳ (ngày)" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="ngay_bao_tri_gan_nhat" label="Ngày bảo trì gần nhất">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="ghi_chu" label="Ghi chú">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Drawer>
    </PageLayout>
  )
}
