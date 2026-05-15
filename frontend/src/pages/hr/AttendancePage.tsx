import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Form, Input, Select, Space, Table, Typography, message, Row, Col, Tabs, Tag, DatePicker, Modal
} from 'antd'
import { 
  FileSearchOutlined, 
  UploadOutlined, 
  CheckCircleOutlined, 
  ExclamationCircleOutlined,
  CalendarOutlined,
  DownloadOutlined
} from '@ant-design/icons'
import { hrApi, Employee } from '../../api/hr'
import { downloadTemplate } from '../../utils/excelUtils'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

export default function AttendancePage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState('1')
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().startOf('month'), dayjs()])
  
  // Modals State
  const [leaveModal, setLeaveModal] = useState(false)
  const [importModal, setImportModal] = useState(false)
  const [importData, setImportData] = useState<any[]>([])
  const [form] = Form.useForm()
  const [importForm] = Form.useForm()

  // Queries
  const { data: attendance = [], isLoading: loadingAtt } = useQuery({
    queryKey: ['hr-attendance', dateRange],
    queryFn: () => hrApi.listAttendance({ 
      from_date: dateRange[0].format('YYYY-MM-DD'), 
      to_date: dateRange[1].format('YYYY-MM-DD') 
    }).then(r => r.data),
    enabled: activeTab === '1'
  })

  const { data: requests = [], isLoading: loadingReq } = useQuery({
    queryKey: ['hr-leave-requests'],
    queryFn: () => hrApi.listLeaveRequests().then(r => r.data),
    enabled: activeTab === '2'
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['hr-employees-simple'],
    queryFn: () => hrApi.listEmployees().then(r => r.data),
  })

  // Mutations
  const approveMut = useMutation({
    mutationFn: ({ id, y_kien }: { id: number, y_kien?: string }) => hrApi.approveLeaveRequest(id, y_kien),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-leave-requests'] })
      message.success('Đã duyệt đơn')
    }
  })

  const createLeaveMut = useMutation({
    mutationFn: (data: any) => hrApi.createLeaveRequest(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-leave-requests'] })
      message.success('Đã gửi đơn trình duyệt')
      setLeaveModal(false)
      form.resetFields()
    }
  })

  const attColumns = [
    { title: 'Ngày', dataIndex: 'ngay', width: 120, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Nhân viên', dataIndex: 'employee_id', render: (v: number) => employees.find(e => e.id === v)?.ho_ten },
    { title: 'Giờ vào', dataIndex: 'gio_vao', render: (v: string) => v ? dayjs(v).format('HH:mm') : '-' },
    { title: 'Giờ ra', dataIndex: 'gio_ra', render: (v: string) => v ? dayjs(v).format('HH:mm') : '-' },
    { title: 'Công', dataIndex: 'so_cong', width: 80, align: 'center' as const, render: (v: number) => <Text strong>{v}</Text> },
    { title: 'Tăng ca', dataIndex: 'so_gio_ot', width: 80, align: 'center' as const },
    { 
      title: 'Trạng thái', 
      dataIndex: 'trang_thai',
      render: (v: string) => {
        const colors: any = { hop_le: 'green', thieu_ca: 'orange', nghi_phep: 'blue', nghi_khong_phep: 'red' }
        return <Tag color={colors[v] || 'default'}>{v.toUpperCase()}</Tag>
      }
    }
  ]

  const reqColumns = [
    { title: 'Ngày tạo', dataIndex: 'id', render: (_: any, r: any) => dayjs(r.created_at).format('DD/MM HH:mm') },
    { title: 'Nhân viên', dataIndex: 'ho_ten', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Loại đơn', dataIndex: 'loai_don', render: (v: string) => <Tag color="purple">{v === 'nghi_phep' ? 'Nghỉ phép' : v}</Tag> },
    { title: 'Thời gian', render: (_: any, r: any) => `${dayjs(r.ngay_bat_dau).format('DD/MM')} - ${dayjs(r.ngay_ket_thuc).format('DD/MM')}` },
    { title: 'Tổng ngày', dataIndex: 'tong_ngay', align: 'center' as const, render: (v: number) => <Text strong>{v}</Text> },
    { title: 'Lý do', dataIndex: 'ly_do', ellipsis: true },
    { 
      title: 'Trạng thái', 
      dataIndex: 'trang_thai',
      render: (v: string) => {
        const labels: any = { cho_duyet: 'Chờ duyệt', phong_ban_duyet: 'P.Ban duyệt', bgd_duyet: 'BGD duyệt', tu_choi: 'Từ chối' }
        const colors: any = { cho_duyet: 'orange', phong_ban_duyet: 'blue', bgd_duyet: 'green', tu_choi: 'red' }
        return <Tag color={colors[v]}>{labels[v]}</Tag>
      }
    },
    {
      title: 'Thao tác',
      render: (_: any, r: any) => (
        r.trang_thai !== 'bgd_duyet' && r.trang_thai !== 'tu_choi' && (
          <Button size="small" type="primary" ghost onClick={() => approveMut.mutate({ id: r.id })}>Duyệt</Button>
        )
      )
    }
  ]

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Chấm công & Đơn từ</Title>
          <Text type="secondary">Quản lý hiện diện, tăng ca và phê duyệt nghỉ phép</Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<DownloadOutlined />} onClick={() => downloadTemplate('attendance')}>Tải file mẫu</Button>
            <Button icon={<UploadOutlined />} onClick={() => setImportModal(true)}>Import dữ liệu vân tay</Button>
            <Button type="primary" icon={<CalendarOutlined />} onClick={() => setLeaveModal(true)}>
              Tạo đơn xin nghỉ
            </Button>
          </Space>
        </Col>
      </Row>

      <Card size="small">
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <Tabs.TabPane tab={<span><FileSearchOutlined /> Bảng chấm công hàng ngày</span>} key="1">
            <Space style={{ marginBottom: 16 }}>
              <RangePicker 
                value={dateRange} 
                onChange={v => v && setDateRange([v[0]!, v[1]!])} 
                format="DD/MM/YYYY"
              />
              <Button type="primary">Lọc dữ liệu</Button>
            </Space>
            <Table 
              dataSource={attendance} 
              columns={attColumns} 
              rowKey="id" 
              loading={loadingAtt} 
              size="small" 
              pagination={{ pageSize: 20 }}
            />
          </Tabs.TabPane>
          
          <Tabs.TabPane tab={<span><CheckCircleOutlined /> Phê duyệt Đơn từ</span>} key="2">
            <Table 
              dataSource={requests} 
              columns={reqColumns} 
              rowKey="id" 
              loading={loadingReq} 
              size="small"
            />
          </Tabs.TabPane>
        </Tabs>
      </Card>

      <Modal
        title="Tạo đơn xin nghỉ / Công tác"
        open={leaveModal}
        onCancel={() => setLeaveModal(false)}
        onOk={() => form.submit()}
        confirmLoading={createLeaveMut.isPending}
      >
        <Form 
          form={form} 
          layout="vertical" 
          onFinish={v => {
            const data = {
              ...v,
              ngay_bat_dau: v.range[0].toISOString(),
              ngay_ket_thuc: v.range[1].toISOString(),
              tong_ngay: v.tong_ngay,
            }
            delete data.range
            createLeaveMut.mutate(data)
          }}
        >
          <Form.Item name="employee_id" label="Nhân viên" rules={[{ required: true }]}>
            <Select 
              showSearch
              options={employees.map(e => ({ value: e.id, label: `${e.ma_nv} - ${e.ho_ten}` }))}
              filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
          <Form.Item name="loai_don" label="Loại đơn" rules={[{ required: true }]} initialValue="nghi_phep">
            <Select options={[
              { value: 'nghi_phep', label: 'Nghỉ phép' },
              { value: 'cong_tac', label: 'Đi công tác' },
              { value: 'tang_ca', label: 'Tăng ca' },
            ]} />
          </Form.Item>
          <Form.Item name="range" label="Thời gian" rules={[{ required: true }]}>
            <RangePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="tong_ngay" label="Số ngày quy đổi" rules={[{ required: true }]}>
            <Input type="number" step="0.5" placeholder="VD: 1, 0.5, 3..." />
          </Form.Item>
          <Form.Item name="ly_do" label="Lý do">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Import dữ liệu từ máy chấm công"
        open={importModal}
        width={800}
        onCancel={() => {
          setImportModal(false)
          setImportData([])
        }}
        footer={[
          <Button key="back" onClick={() => setImportModal(false)}>Huỷ</Button>,
          <Button 
            key="submit" 
            type="primary" 
            disabled={importData.length === 0 || importData.some(r => r._error)}
            onClick={async () => {
              message.loading('Đang lưu dữ liệu chấm công...')
              try {
                const rows = importData.map(({ _error, _status, ...row }) => row)
                await hrApi.importAttendance(rows)
                message.success(`Đã import thành công ${importData.length} dòng chấm công`)
                setImportModal(false)
                setImportData([])
                qc.invalidateQueries({ queryKey: ['hr-attendance'] })
              } catch (e: any) {
                message.error(e?.response?.data?.detail?.message || e?.response?.data?.detail || 'Import cham cong that bai')
              }
            }}
          >
            Xác nhận Lưu
          </Button>
        ]}
      >
        <div style={{ padding: '10px 0' }}>
          <Text type="secondary">Tải file .xlsx hoặc .csv từ máy vân tay. Hệ thống sẽ tự động khớp mã vân tay với mã nhân viên.</Text>
          <div style={{ marginTop: 16, marginBottom: 16 }}>
            <Input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = (evt) => {
                  const bstr = evt.target?.result
                  const wb = XLSX.read(bstr, { type: 'binary' })
                  const ws = wb.Sheets[wb.SheetNames[0]]
                  const data = XLSX.utils.sheet_to_json(ws)
                  
                  const validated = data.map((row: any) => {
                    let error = ''
                    if (!row.ma_nv) error = 'Thiếu mã NV'
                    if (!row.ngay) error = 'Thiếu ngày'
                    
                    return {
                      ...row,
                      _error: error,
                      _status: error ? 'error' : 'success'
                    }
                  })
                  setImportData(validated)
                }
                reader.readAsBinaryString(file)
              }} 
            />
          </div>

          <Table 
            size="small"
            dataSource={importData}
            pagination={{ pageSize: 10 }}
            columns={[
              { title: 'Trạng thái', dataIndex: '_status', width: 120, render: (v, r) => (
                <Tag color={v === 'success' ? 'green' : 'red'}>{v === 'success' ? 'Hợp lệ' : r._error}</Tag>
              )},
              { title: 'Mã NV', dataIndex: 'ma_nv' },
              { title: 'Ngày', dataIndex: 'ngay' },
              { title: 'Giờ vào', dataIndex: 'gio_vao' },
              { title: 'Giờ ra', dataIndex: 'gio_ra' },
              { title: 'Tổng giờ', dataIndex: 'tong_gio_thuc' },
            ]}
          />
        </div>
      </Modal>
    </div>
  )
}
