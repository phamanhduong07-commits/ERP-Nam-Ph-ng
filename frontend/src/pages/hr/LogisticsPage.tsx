import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Table, Typography, Row, Col, Tag, Space, DatePicker, Modal, Form, InputNumber, Select, message, Tabs } from 'antd'
import { CarOutlined, ThunderboltOutlined, PlusOutlined, DownloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import client from '../../api/client'
import { exportToExcel } from '../../utils/excelUtils'
import EmptyState from "../../components/EmptyState"
import QuickAddSelect from '../../components/QuickAddSelect'
import { QUICK_ADD_CONFIGS } from '../../config/quickAddConfigs'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

interface Vehicle { id: number; bien_so: string; dinh_muc_dau?: number }
interface Employee { id: number; ho_ten: string; ma_nv: string }
interface FuelLog { id: number; ngay_do: string; so_km_dau: number; so_km_cuoi: number; so_km_chay: number; so_lit_dau: number; don_gia: number; thanh_tien: number; vehicle?: Vehicle; employee?: Employee }
interface TripAllocation { employee_id: number; name: string; role: string; tien_chuyen?: number; he_so: number }
interface TripSalary { id: number; ngay_xuat: string; so_phieu: string; khach_hang: string; tai_xe: string; xe: string; tong_m2: number; don_gia_m2: number; tien_chuyen: number; allocations?: TripAllocation[]; trang_thai: string }

function Statistic({ title, value, suffix, prefix, valueStyle }: { title: string; value: number; suffix?: string; prefix?: React.ReactNode; valueStyle?: React.CSSProperties }) {
  return (
    <div>
      <Text type="secondary">{title}</Text>
      <div style={{ fontSize: 20, fontWeight: 700, ...valueStyle }}>
        {prefix} {typeof value === 'number' ? value.toLocaleString() : value} <span style={{ fontSize: 14, fontWeight: 400 }}>{suffix}</span>
      </div>
    </div>
  )
}

export default function LogisticsPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState('fuel')
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().startOf('month'), dayjs()])
  const [fuelModal, setFuelModal] = useState(false)
  const [form] = Form.useForm()

  const { data: vehicles = [] } = useQuery({ queryKey: ['hr-vehicles'], queryFn: () => client.get('/hr/vehicles').then(r => r.data) })
  const { data: fuelLogs = [], isLoading } = useQuery({
    queryKey: ['hr-fuel-logs', dateRange],
    queryFn: () => client.get('/hr/fuel-logs', { params: { from_date: dateRange[0].format('YYYY-MM-DD'), to_date: dateRange[1].format('YYYY-MM-DD') } }).then(r => r.data),
  })
  const { data: tripSalaries = [] } = useQuery({
    queryKey: ['hr-trip-salaries', dateRange],
    queryFn: () => client.get('/hr/trip-salaries', { params: { from_date: dateRange[0].format('YYYY-MM-DD'), to_date: dateRange[1].format('YYYY-MM-DD') } }).then(r => r.data),
  })
  const { data: employees = [] } = useQuery({ queryKey: ['hr-employees-drivers'], queryFn: () => client.get('/hr/employees').then(r => r.data) })

  const fuelColumns = [
    { title: 'Ngay', dataIndex: 'ngay_do', render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Bien so', dataIndex: 'bien_so', render: (_: unknown, r: FuelLog) => <Tag color="blue">{r.vehicle?.bien_so}</Tag> },
    { title: 'Tai xe', dataIndex: 'ho_ten', render: (_: unknown, r: FuelLog) => r.employee?.ho_ten },
    { title: 'KM dau', dataIndex: 'so_km_dau', align: 'right' as const },
    { title: 'KM cuoi', dataIndex: 'so_km_cuoi', align: 'right' as const },
    { title: 'Tong KM', dataIndex: 'so_km_chay', align: 'right' as const, render: (v: number) => <Text strong>{v}</Text> },
    { title: 'So lit', dataIndex: 'so_lit_dau', align: 'right' as const },
    { title: 'Don gia', dataIndex: 'don_gia', align: 'right' as const, render: (v: number) => v.toLocaleString() },
    { title: 'Thanh tien', dataIndex: 'thanh_tien', align: 'right' as const, render: (v: number) => <Text strong style={{ color: '#cf1322' }}>{v.toLocaleString()}</Text> },
    {
      title: 'Hieu qua',
      render: (_: unknown, r: FuelLog) => {
        const ratio = (r.so_lit_dau / (r.so_km_chay || 1)) * 100
        const color = ratio > (r.vehicle?.dinh_muc_dau || 20) ? 'red' : 'green'
        return <Tag color={color}>{ratio.toFixed(2)} L/100km</Tag>
      }
    }
  ]

  const tripColumns = [
    { title: 'Ngay xuat', dataIndex: 'ngay_xuat', render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: 'So phieu', dataIndex: 'so_phieu', render: (v: string) => <Tag color="orange">{v}</Tag> },
    { title: 'Khach hang', dataIndex: 'khach_hang' },
    { title: 'Tai xe', dataIndex: 'tai_xe' },
    { title: 'Xe', dataIndex: 'xe' },
    { title: 'Tong m2', dataIndex: 'tong_m2', align: 'right' as const, render: (v: number) => v.toFixed(2) },
    { title: 'Don gia m2', dataIndex: 'don_gia_m2', align: 'right' as const, render: (v: number) => v.toLocaleString() },
    { title: 'Quy chuyen', dataIndex: 'tien_chuyen', align: 'right' as const, render: (v: number) => <Text strong style={{ color: '#1677ff' }}>{v.toLocaleString()}</Text> },
    {
      title: 'Phan bo',
      dataIndex: 'allocations',
      width: 320,
      render: (items: TripAllocation[] = []) => (
        <Space size={[4, 4]} wrap>
          {items.map((it: TripAllocation, idx: number) => (
            <Tag key={`${it.employee_id}-${idx}`} color={it.role === 'tai_xe' ? 'blue' : 'purple'}>
              {it.name}: {it.tien_chuyen?.toLocaleString()} ({it.he_so})
            </Tag>
          ))}
        </Space>
      )
    },
    { title: 'Trang thai', dataIndex: 'trang_thai', render: (v: string) => <Tag>{v}</Tag> },
  ]

  const { displayColumns: displayFuelColumns, settingsButton } = useColumnPrefs('hr-logistics', fuelColumns)

  const totalFuel = (fuelLogs as FuelLog[] || []).reduce((s: number, r: FuelLog) => s + (r.thanh_tien || 0), 0)
  const totalTrip = (tripSalaries as TripSalary[] || []).reduce((s: number, r: TripSalary) => s + (r.tien_chuyen || 0), 0)
  const totalM2 = (tripSalaries as TripSalary[] || []).reduce((s: number, r: TripSalary) => s + (r.tong_m2 || 0), 0)

  const handleExport = () => {
    const rows = activeTab === 'fuel'
      ? (fuelLogs as FuelLog[]).map((r: FuelLog) => ({ Ngay: dayjs(r.ngay_do).format('DD/MM/YYYY'), Bien_so: r.vehicle?.bien_so, Tai_xe: r.employee?.ho_ten, KM_dau: r.so_km_dau, KM_cuoi: r.so_km_cuoi, KM_chay: r.so_km_chay, So_lit: r.so_lit_dau, Don_gia: r.don_gia, Thanh_tien: r.thanh_tien }))
      : (tripSalaries as TripSalary[]).map((r: TripSalary) => ({ Ngay_xuat: dayjs(r.ngay_xuat).format('DD/MM/YYYY'), So_phieu: r.so_phieu, Khach_hang: r.khach_hang, Tai_xe: r.tai_xe, Xe: r.xe, Tong_m2: r.tong_m2, Don_gia_m2: r.don_gia_m2, Quy_chuyen: r.tien_chuyen }))
    exportToExcel(rows, `${activeTab === 'fuel' ? 'Bao_Cao_Xang_Dau' : 'Bao_Cao_Luong_Chuyen'}_${dateRange[0].format('DDMMYY')}_${dateRange[1].format('DDMMYY')}`)
  }

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Quan ly Doi xe & Logistics</Title>
          <Text type="secondary">Theo doi dau xe, tien chuyen theo m2 va phan bo theo he so tai xe/lo xe.</Text>
        </Col>
        <Col>
          <Space>
            <RangePicker value={dateRange} onChange={v => v && setDateRange([v[0]!, v[1]!])} format="DD/MM/YYYY" />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setFuelModal(true)}>Nhap do dau</Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>Xuat Excel</Button>
            {settingsButton}
          </Space>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="Tong tien dau" value={totalFuel} suffix="VND" prefix={<ThunderboltOutlined />} valueStyle={{ color: '#cf1322' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Tong quy chuyen" value={totalTrip} suffix="VND" valueStyle={{ color: '#1677ff' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Tong m2 giao hang" value={totalM2} suffix="m2" /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Ty le chi phi/m2" value={totalM2 > 0 ? Math.round(totalTrip / totalM2) : 0} suffix="d/m2" /></Card></Col>
      </Row>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ padding: '0 16px' }}
          items={[
            { key: 'fuel', label: <span><ThunderboltOutlined /> Nhat ky do dau</span>, children: <Table dataSource={fuelLogs || []} columns={displayFuelColumns} rowKey="id" loading={isLoading} size="small" bordered pagination={{ pageSize: 20 }} scroll={{ x: 1100 }} /> },
            { key: 'trip', label: <span><CarOutlined /> Luong chuyen</span>, children: <Table dataSource={tripSalaries || []} columns={tripColumns} rowKey="id" size="small" bordered pagination={{ pageSize: 20 }} scroll={{ x: 1300 }} /> },
          ]}
        />
      </Card>

      <Modal title="Nhap phieu do dau" open={fuelModal} onCancel={() => setFuelModal(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={async (v) => {
          await client.post('/hr/fuel-logs', { ...v, ngay_do: dayjs().format('YYYY-MM-DD') })
          message.success('Da luu phieu do dau')
          setFuelModal(false)
          form.resetFields()
          qc.invalidateQueries({ queryKey: ['hr-fuel-logs'] })
        }}>
          <Form.Item name="xe_id" label="Chon xe" rules={[{ required: true }]}>
            <Select options={(vehicles as Vehicle[] || []).map((v: Vehicle) => ({ value: v.id, label: v.bien_so }))} />
          </Form.Item>
          <Form.Item name="employee_id" label="Tai xe" rules={[{ required: true }]}>
            <QuickAddSelect
              config={QUICK_ADD_CONFIGS.employee}
              showSearch optionFilterProp="label"
              options={(employees as Employee[] || []).map((e: Employee) => ({ value: e.id, label: `${e.ma_nv} - ${e.ho_ten}` }))}
              onCreated={() => qc.invalidateQueries({ queryKey: ['hr-employees-drivers'] })}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="so_km_dau" label="KM dau" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="so_km_cuoi" label="KM cuoi" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="so_lit_dau" label="So lit" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="don_gia" label="Don gia dau" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}
