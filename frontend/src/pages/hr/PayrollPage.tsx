import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Space, Table, Typography, Row, Col, DatePicker, Statistic, Tag, message, Tabs, Modal, Form, Input
} from 'antd'
import {
  CalculatorOutlined,
  DownloadOutlined,
  DashboardOutlined,
  DollarOutlined,
  CalendarOutlined,
  PlusOutlined,
  DeleteOutlined
} from '@ant-design/icons'
import client from '../../api/client'
import { hrApi } from '../../api/hr'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'

const { Title, Text } = Typography

const money = (value: number) => Number(value || 0).toLocaleString()

const moneyColumn = (title: string, dataIndex: string, width = 130) => ({
  title,
  dataIndex,
  width,
  align: 'right' as const,
  render: (v: number) => money(v),
})

export default function PayrollPage() {
  const qc = useQueryClient()
  const [currentMonth, setCurrentMonth] = useState(dayjs())
  const [activeTab, setActiveTab] = useState('summary')
  const [holidayOpen, setHolidayOpen] = useState(false)
  const [holidayForm] = Form.useForm()

  const monthParams = {
    thang: currentMonth.month() + 1,
    nam: currentMonth.year()
  }

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
    queryFn: () => client.get('/hr/payroll/summary', { params: monthParams }).then(r => r.data),
  })

  const { data: holidays = [] } = useQuery({
    queryKey: ['hr-payroll-holidays', currentMonth],
    queryFn: () => hrApi.listPayrollHolidays({
      from_date: currentMonth.startOf('month').format('YYYY-MM-DD'),
      to_date: currentMonth.endOf('month').format('YYYY-MM-DD')
    }).then(r => r.data),
  })

  const generateMutation = useMutation({
    mutationFn: () => client.post('/hr/payroll/generate', null, { params: monthParams }),
    onSuccess: () => {
      message.success('Da khoi tao bang luong thang thanh cong')
      refetchSummary()
    }
  })

  const holidayMutation = useMutation({
    mutationFn: (values: any) => hrApi.createPayrollHoliday({
      ...values,
      ngay: values.ngay.format('YYYY-MM-DD')
    }),
    onSuccess: () => {
      message.success('Da luu ngay le')
      holidayForm.resetFields()
      qc.invalidateQueries({ queryKey: ['hr-payroll-holidays'] })
    }
  })

  const deleteHolidayMutation = useMutation({
    mutationFn: (id: number) => hrApi.deletePayrollHoliday(id),
    onSuccess: () => {
      message.success('Da xoa ngay le')
      qc.invalidateQueries({ queryKey: ['hr-payroll-holidays'] })
    }
  })

  const exportPayroll = () => {
    const rows = (payrollSummary || []).map((r: any, idx: number) => ({
      STT: idx + 1,
      'Ten nhan vien': r.ho_ten,
      'Chuc vu': r.chuc_vu || '',
      'Luong co ban + Phu cap': r.luong_co_ban_phu_cap,
      'Luong co ban thoa thuan': r.luong_co_ban,
      'Ngay cong nguyen luong': r.ngay_cong_nguyen_luong,
      'Luong co ban thuc te theo ngay cong': r.luong_theo_ngay_cong,
      'OT ngay thuong': r.ot_gio_ngay_thuong,
      'OT chu nhat': r.ot_gio_chu_nhat,
      'OT chu nhat tang ca': r.ot_gio_chu_nhat_tang_ca,
      'OT ngay le': r.ot_gio_ngay_le,
      'Tien OT ngay thuong 1.5': r.ot_tien_ngay_thuong,
      'Tien OT chu nhat 2.0': r.ot_tien_chu_nhat,
      'Tien OT chu nhat tang ca 2.5': r.ot_tien_chu_nhat_tang_ca,
      'Tien OT ngay le 3.0': r.ot_tien_ngay_le,
      'Phu cap chuyen can': r.phu_cap_chuyen_can,
      'Phu cap trach nhiem': r.phu_cap_trach_nhiem,
      'Phu cap nha o/com': r.phu_cap_nha_o_com,
      'Phu cap dien thoai': r.phu_cap_dien_thoai,
      'Ho tro khac': r.phu_cap_khac,
      'Tien chuyen/HQCV/Thanh tich': r.tien_chuyen_hqcv_thanh_tich,
      'Luong SL': r.luong_sl,
      'Luong gio': r.luong_gio,
      'Chenh lech SL - gio': r.chenh_lech_luong,
      'Loai luong de xuat': r.loai_luong_de_xuat === 'san_luong' ? 'San luong' : 'Gio',
      'Tong thu nhap': r.tong_thu_nhap,
      'Bao hiem': r.bao_hiem,
      'Thuc linh': r.thuc_linh,
    }))
    const ws = XLSX.utils.aoa_to_sheet([[
      'STT', 'Ten nhan vien', 'Chuc vu', 'Luong co ban + Phu cap', 'Luong co ban thoa thuan',
      'Ngay cong nguyen luong', 'Luong co ban thuc te theo ngay cong',
      'So gio tang ca', '', '', '',
      'Tien luong tang ca', '', '', '',
      'Phu cap', '', '', '', '',
      'Tien chuyen/HQCV/Thanh tich', 'Luong SL', 'Luong gio', 'Chenh lech', 'Loai luong',
      'Tong thu nhap', 'Bao hiem', 'Thuc linh'
    ]])
    XLSX.utils.sheet_add_json(ws, rows, { origin: 'A2' })
    ws['!merges'] = [
      { s: { r: 0, c: 7 }, e: { r: 0, c: 10 } },
      { s: { r: 0, c: 11 }, e: { r: 0, c: 14 } },
      { s: { r: 0, c: 15 }, e: { r: 0, c: 19 } },
      { s: { r: 0, c: 21 }, e: { r: 0, c: 24 } },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Bang luong')
    XLSX.writeFile(wb, `Bang_luong_${currentMonth.format('MM_YYYY')}.xlsx`)
  }

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
    moneyColumn('Luong SP', 'luong_sp', 150),
  ]

  const summaryColumns = [
    { title: 'STT', width: 60, fixed: 'left' as const, render: (_: any, __: any, index: number) => index + 1 },
    { title: 'Ten nhan vien', dataIndex: 'ho_ten', width: 180, fixed: 'left' as const },
    { title: 'Chuc vu', dataIndex: 'chuc_vu', width: 150 },
    moneyColumn('Luong co ban + Phu cap', 'luong_co_ban_phu_cap', 160),
    moneyColumn('Luong co ban thoa thuan', 'luong_co_ban', 160),
    { title: 'Ngay cong nguyen luong', dataIndex: 'ngay_cong_nguyen_luong', width: 150, align: 'center' as const },
    moneyColumn('Luong CB thuc te theo ngay cong', 'luong_theo_ngay_cong', 190),
    {
      title: 'So gio tang ca',
      children: [
        { title: 'Ngay thuong', dataIndex: 'ot_gio_ngay_thuong', width: 110, align: 'center' as const },
        { title: 'Chu nhat', dataIndex: 'ot_gio_chu_nhat', width: 110, align: 'center' as const },
        { title: 'CN tang ca', dataIndex: 'ot_gio_chu_nhat_tang_ca', width: 110, align: 'center' as const },
        { title: 'Ngay le', dataIndex: 'ot_gio_ngay_le', width: 110, align: 'center' as const },
      ]
    },
    {
      title: 'Tien luong tang ca',
      children: [
        moneyColumn('Ngay thuong (1.5)', 'ot_tien_ngay_thuong'),
        moneyColumn('Chu nhat (2.0)', 'ot_tien_chu_nhat'),
        moneyColumn('CN tang ca (2.5)', 'ot_tien_chu_nhat_tang_ca'),
        moneyColumn('Ngay le (3.0)', 'ot_tien_ngay_le'),
      ]
    },
    {
      title: 'Phu cap',
      children: [
        moneyColumn('Chuyen can', 'phu_cap_chuyen_can'),
        moneyColumn('Trach nhiem', 'phu_cap_trach_nhiem'),
        moneyColumn('Nha o/Com', 'phu_cap_nha_o_com'),
        moneyColumn('Dien thoai', 'phu_cap_dien_thoai'),
        moneyColumn('Ho tro khac', 'phu_cap_khac'),
      ]
    },
    moneyColumn('Tien chuyen/HQCV/Thanh tich', 'tien_chuyen_hqcv_thanh_tich', 180),
    {
      title: 'So sanh luong',
      children: [
        moneyColumn('Luong SL', 'luong_sl', 140),
        moneyColumn('Luong gio', 'luong_gio', 140),
        {
          title: 'Chenh lech',
          dataIndex: 'chenh_lech_luong',
          width: 130,
          align: 'right' as const,
          render: (v: number) => <Text type={Number(v || 0) >= 0 ? 'success' : 'danger'}>{money(v)}</Text>,
        },
        {
          title: 'De xuat',
          dataIndex: 'loai_luong_de_xuat',
          width: 110,
          render: (v: string) => <Tag color={v === 'san_luong' ? 'blue' : 'green'}>{v === 'san_luong' ? 'SL' : 'Gio'}</Tag>,
        },
      ]
    },
    moneyColumn('Tong thu nhap', 'tong_thu_nhap', 150),
    { title: 'Bao hiem', dataIndex: 'bao_hiem', width: 130, align: 'right' as const, render: (v: number) => <Text type="danger">-{money(v)}</Text> },
    { title: 'Thuc linh', dataIndex: 'thuc_linh', width: 150, align: 'right' as const, render: (v: number) => <Text strong style={{ color: '#52c41a' }}>{money(v)}d</Text> },
    { title: 'Trang thai', dataIndex: 'trang_thai', width: 120, render: (v: string) => <Tag color={v === 'da_chot' ? 'green' : 'orange'}>{v}</Tag> },
  ]

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Quan ly Bang luong Nhan su</Title>
          <Text type="secondary">Tong hop luong co ban, cong, tang ca, phu cap va tien chuyen.</Text>
        </Col>
        <Col>
          <Space>
            <DatePicker picker="month" value={currentMonth} onChange={v => v && setCurrentMonth(v)} format="MM/YYYY" />
            <Button icon={<CalendarOutlined />} onClick={() => setHolidayOpen(true)}>Ngay le</Button>
            <Button type="primary" icon={<CalculatorOutlined />} onClick={() => generateMutation.mutate()} loading={generateMutation.isPending}>
              Tinh toan luong thang
            </Button>
            <Button icon={<DownloadOutlined />} onClick={exportPayroll}>Xuat Excel</Button>
          </Space>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="Tong thu nhap" value={(payrollSummary || []).reduce((s: number, r: any) => s + Number(r.tong_thu_nhap || 0), 0)} suffix="d" /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Tong thuc linh" value={(payrollSummary || []).reduce((s: number, r: any) => s + Number(r.thuc_linh || 0), 0)} suffix="d" valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Tong tien tang ca" value={(payrollSummary || []).reduce((s: number, r: any) => s + Number(r.ot_tien_ngay_thuong || 0) + Number(r.ot_tien_chu_nhat || 0) + Number(r.ot_tien_chu_nhat_tang_ca || 0) + Number(r.ot_tien_ngay_le || 0), 0)} suffix="d" /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Ngay le trong thang" value={holidays.length} /></Card></Col>
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
                  scroll={{ x: 3500 }}
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

      <Modal
        title="Cau hinh ngay le tinh tang ca"
        open={holidayOpen}
        onCancel={() => setHolidayOpen(false)}
        footer={null}
      >
        <Form form={holidayForm} layout="vertical" onFinish={v => holidayMutation.mutate(v)}>
          <Row gutter={12}>
            <Col span={10}>
              <Form.Item name="ngay" label="Ngay le" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={14}>
              <Form.Item name="ten_ngay_le" label="Ten ngay le" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => holidayForm.submit()} loading={holidayMutation.isPending}>
            Them/Cập nhật ngay le
          </Button>
        </Form>
        <Table
          style={{ marginTop: 16 }}
          size="small"
          dataSource={holidays}
          rowKey="id"
          pagination={false}
          columns={[
            { title: 'Ngay', dataIndex: 'ngay', render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
            { title: 'Ten ngay le', dataIndex: 'ten_ngay_le' },
            { title: '', width: 48, render: (_: any, r: any) => <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteHolidayMutation.mutate(r.id)} /> },
          ]}
        />
      </Modal>
    </div>
  )
}
