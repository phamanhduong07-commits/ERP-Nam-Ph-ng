import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Button, Card, Space, Table, Typography, Row, Col, DatePicker, Statistic, Tag, message, Tabs
} from 'antd'
import {
  CalculatorOutlined,
  DownloadOutlined,
  DashboardOutlined,
  DollarOutlined
} from '@ant-design/icons'
import client from '../../api/client'
import dayjs from 'dayjs'

const { Title, Text } = Typography

export default function PayrollPage() {
  const [currentMonth, setCurrentMonth] = useState(dayjs())
  const [activeTab, setActiveTab] = useState('summary')

  const { data: productionResults = [], isLoading: loadingProd } = useQuery({
    queryKey: ['hr-payroll-prod', currentMonth],
    queryFn: () => client.get('/hr/payroll/calculate-production', {
      params: {
        from_date: currentMonth.startOf('month').format('YYYY-MM-DD'),
        to_date: currentMonth.endOf('month').format('YYYY-MM-DD')
      }
    }).then(r => r.data),
  })

  const { data: payrollSummary = [], isLoading: loadingSummary, refetch: refetchSummary } = useQuery({
    queryKey: ['hr-payroll-summary', currentMonth],
    queryFn: () => client.get('/hr/payroll/summary', {
      params: {
        thang: currentMonth.month() + 1,
        nam: currentMonth.year()
      }
    }).then(r => r.data),
  })

  const generateMutation = useMutation({
    mutationFn: () => client.post('/hr/payroll/generate', null, {
      params: { thang: currentMonth.month() + 1, nam: currentMonth.year() }
    }),
    onSuccess: () => {
      message.success('Da khoi tao bang luong thang thanh cong')
      refetchSummary()
    }
  })

  const prodColumns = [
    { title: 'Ma NV', dataIndex: 'ma_nv', width: 90, fixed: 'left' as const },
    { title: 'Ho va ten', dataIndex: 'ho_ten', width: 180, fixed: 'left' as const },
    { title: 'He so', dataIndex: 'he_so', width: 80, align: 'center' as const },
    { title: 'Cong quy doi', dataIndex: 'cong_quy_doi', width: 110, align: 'center' as const },
    { title: 'Tong m2', dataIndex: 'tong_m2', width: 110, align: 'right' as const, render: (v: number) => v?.toLocaleString() },
    {
      title: 'Khau / xuong',
      dataIndex: 'details',
      width: 300,
      render: (details: any[] = []) => (
        <Space size={[4, 4]} wrap>
          {details.slice(0, 4).map((d: any, idx: number) => (
            <Tag key={`${d.phan_xuong_id}-${d.cong_doan}-${idx}`}>
              {d.ten_xuong || `PX${d.phan_xuong_id || '-'}`} - {d.ten_cong_doan}: {d.tong_m2?.toLocaleString()} m2
            </Tag>
          ))}
          {details.length > 4 ? <Tag>+{details.length - 4}</Tag> : null}
        </Space>
      )
    },
    { title: 'Luong SP', dataIndex: 'luong_sp', width: 150, align: 'right' as const, render: (v: number) => <Text strong style={{ color: '#cf1322' }}>{v?.toLocaleString()}d</Text> },
  ]

  const summaryColumns = [
    { title: 'Ma NV', dataIndex: 'ma_nv', width: 90, fixed: 'left' as const },
    { title: 'Ho ten', dataIndex: 'ho_ten', width: 180, fixed: 'left' as const },
    { title: 'Luong CB', dataIndex: 'luong_co_ban', align: 'right' as const, render: (v: number) => v.toLocaleString() },
    { title: 'Luong SP', dataIndex: 'luong_san_pham', align: 'right' as const, render: (v: number) => v.toLocaleString() },
    { title: 'Luong Chuyen', dataIndex: 'luong_chuyen', align: 'right' as const, render: (v: number) => v.toLocaleString() },
    { title: 'Phu cap + OT', dataIndex: 'phu_cap', align: 'right' as const, render: (v: number) => v.toLocaleString() },
    { title: 'Bao hiem (10.5%)', dataIndex: 'bao_hiem', align: 'right' as const, render: (v: number) => <Text type="danger">-{v.toLocaleString()}</Text> },
    { title: 'Thuc linh', dataIndex: 'thuc_linh', align: 'right' as const, render: (v: number) => <Text strong style={{ color: '#52c41a', fontSize: 16 }}>{v.toLocaleString()}d</Text> },
    { title: 'Trang thai', dataIndex: 'trang_thai', render: (v: string) => <Tag color={v === 'da_chot' ? 'green' : 'orange'}>{v}</Tag> },
  ]

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Quan ly Bang luong Nhan su</Title>
          <Text type="secondary">Tong hop luong co ban, san pham theo m2, luong chuyen, phu cap va tang ca.</Text>
        </Col>
        <Col>
          <Space>
            <DatePicker
              picker="month"
              value={currentMonth}
              onChange={v => v && setCurrentMonth(v)}
              format="MM/YYYY"
            />
            <Button
              type="primary"
              icon={<CalculatorOutlined />}
              onClick={() => generateMutation.mutate()}
              loading={generateMutation.isPending}
            >
              Tinh toan luong thang
            </Button>
            <Button icon={<DownloadOutlined />}>Xuat Excel</Button>
          </Space>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Tong quy luong thuc linh" value={(payrollSummary || []).reduce((s: number, r: any) => s + (r.thuc_linh || 0), 0)} suffix="d" valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Tong luong SP" value={(payrollSummary || []).reduce((s: number, r: any) => s + (r.luong_san_pham || 0), 0)} suffix="d" />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Tong luong Chuyen" value={(payrollSummary || []).reduce((s: number, r: any) => s + (r.luong_chuyen || 0), 0)} suffix="d" />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Tien Bao Hiem" value={(payrollSummary || []).reduce((s: number, r: any) => s + (r.bao_hiem || 0), 0)} suffix="d" valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
      </Row>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ padding: '0 16px' }}
          items={[
            {
              key: 'summary',
              label: <span><DollarOutlined /> Bang luong tong hop</span>,
              children: (
                <Table
                  dataSource={payrollSummary || []}
                  columns={summaryColumns}
                  rowKey="id"
                  loading={loadingSummary}
                  size="small"
                  pagination={{ pageSize: 20 }}
                  scroll={{ x: 1300 }}
                />
              )
            },
            {
              key: 'production',
              label: <span><DashboardOutlined /> Chi tiet luong san pham</span>,
              children: (
                <Table
                  dataSource={productionResults || []}
                  columns={prodColumns}
                  rowKey="employee_id"
                  loading={loadingProd}
                  size="small"
                  pagination={{ pageSize: 20 }}
                  scroll={{ x: 1200 }}
                />
              )
            }
          ]}
        />
      </Card>

      <div style={{ marginTop: 16 }}>
        <Card size="small" title="Ghi chu quy trinh">
          <Text type="secondary">
            * Luong san pham = tong m2 scan hop le x don gia x % luong san pham, sau do phan bo theo he so va cong.
            <br />
            * Hoang Gia/Nam Thuan chia 5 khau; Cu Chi tinh tong m2 ca xuong; Hoc Mon tinh luong cong binh thuong.
            <br />
            * Tang ca duoc tinh vao cot Phu cap + OT theo cong thuc tam thoi: luong co ban / 26 / 8 x 150% x so gio OT.
          </Text>
        </Card>
      </div>
    </div>
  )
}
