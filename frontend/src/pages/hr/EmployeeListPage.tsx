import React, { useState } from 'react'
import type { ApiError } from '../../api/types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Button, Card, Drawer, Form, Input, List, Select, Space, Table, Tabs, Typography, message, Row, Col, Tag, Avatar, InputNumber
} from 'antd'
import { PlusOutlined, EditOutlined, UserOutlined, SearchOutlined, DownloadOutlined, UploadOutlined, HistoryOutlined, FileProtectOutlined, WarningOutlined, MobileOutlined, LockOutlined, UnlockOutlined, KeyOutlined } from '@ant-design/icons'
import { hrApi, Employee } from '../../api/hr'
import { phapNhanApi } from '../../api/phap_nhan'
import { theoDoiApi } from '../../api/theoDoi'
import { downloadTemplate } from '../../utils/excelUtils'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import EmptyState from "../../components/EmptyState"

const { Title, Text } = Typography

export default function EmployeeListPage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importData, setImportData] = useState<Record<string, unknown>[]>([])
  const [history, setHistory] = useState<Record<string, unknown>[]>([])
  const [expiringContracts, setExpiringContracts] = useState<Record<string, unknown>[]>([])
  const [form] = Form.useForm()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    phap_nhan_id: undefined as number | undefined,
    phan_xuong_id: undefined as number | undefined,
  })

  // Queries
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['hr-employees', search, filters],
    queryFn: () => hrApi.listEmployees({ search, ...filters }).then(r => r.data),
  })

  const { data: phapNhanList = [] } = useQuery({
    queryKey: ['phap-nhan-list'],
    queryFn: () => phapNhanApi.list({ active_only: true }).then(r => r.data),
  })

  const { data: phanXuongList = [] } = useQuery({
    queryKey: ['phan-xuong-list'],
    queryFn: () => theoDoiApi.listPhanXuong().then((r: { data: { id: number; ten_xuong?: string }[] }) => r.data),
  })

  const { data: depts = [] } = useQuery({
    queryKey: ['hr-depts'],
    queryFn: () => hrApi.listDepartments().then(r => r.data),
  })

  const { data: positions = [] } = useQuery({
    queryKey: ['hr-positions'],
    queryFn: () => hrApi.listPositions().then(r => r.data),
  })

  const { data: expiring = [] } = useQuery({
    queryKey: ['hr-expiring-contracts'],
    queryFn: () => hrApi.listExpiringContracts().then(r => r.data),
  })

  // Mutations
  const saveMut = useMutation({
    mutationFn: (data: Partial<Employee>) => 
      editing ? hrApi.updateEmployee(editing.id, data) : hrApi.createEmployee(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-employees'] })
      message.success(editing ? 'Đã cập nhật nhân viên' : 'Đã thêm nhân viên')
      setOpen(false)
      setEditing(null)
      form.resetFields()
    },
    onError: (e: unknown) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi lưu dữ liệu'),
  })

  const issueAccMut = useMutation({
    mutationFn: (id: number) => hrApi.issueAccount(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-employees'] })
      message.success('Đã cấp tài khoản Mobile thành công (Mật khẩu: 123456)')
    }
  })

  const toggleAccMut = useMutation({
    mutationFn: (id: number) => hrApi.toggleAccountStatus(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-employees'] })
      message.success('Đã cập nhật trạng thái tài khoản')
    }
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setOpen(true)
  }

  const openEdit = (emp: Employee) => {
    setEditing(emp)
    form.setFieldsValue({
      ...emp,
      ngay_sinh: emp.ngay_sinh ? emp.ngay_sinh : undefined,
      ngay_vao_lam: emp.ngay_vao_lam ? emp.ngay_vao_lam : undefined,
    })
    setOpen(true)
  }

  const columns = [
    {
      title: 'Mã NV',
      dataIndex: 'ma_nv',
      width: 100,
      render: (v: string) => <Text strong style={{ color: '#1890ff' }}>{v}</Text>
    },
    {
      title: 'Họ và tên',
      dataIndex: 'ho_ten',
      render: (v: string, r: Employee) => (
        <Space>
          <Avatar icon={<UserOutlined />} src={undefined} size="small" />
          <div>
            <div style={{ fontWeight: 500 }}>{v}</div>
            <div style={{ fontSize: '12px', color: '#8c8c8c' }}>{r.ten_chuc_vu || 'Chưa xếp chức vụ'}</div>
          </div>
        </Space>
      )
    },
    {
      title: 'Bộ phận',
      dataIndex: 'ten_bo_phan',
      width: 140,
    },
    {
      title: 'Hệ số',
      dataIndex: 'he_so_ca_nhan',
      width: 80,
      align: 'center' as const,
      render: (v: number) => <Tag color="blue">{v}</Tag>
    },
    {
      title: 'Xưởng / Nhà máy',
      dataIndex: 'ten_phan_xuong',
      width: 150,
    },
    {
      title: 'Pháp nhân',
      dataIndex: 'ten_phap_nhan',
      width: 180,
      ellipsis: true,
    },
    {
      title: 'Số điện thoại',
      dataIndex: 'so_dien_thoai',
      width: 120,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 120,
      render: (v: string) => {
        const color = v === 'dang_lam' ? 'green' : v === 'tam_nghi' ? 'orange' : 'red'
        const label = v === 'dang_lam' ? 'Đang làm' : v === 'tam_nghi' ? 'Tạm nghỉ' : 'Đã nghỉ'
        return <Tag color={color}>{label}</Tag>
      }
    },
    {
      title: 'Tài khoản Mobile',
      width: 160,
      render: (_: unknown, r: Employee) => (
        r.has_account ? (
          <Space>
            <Tag color={r.user_status ? 'cyan' : 'default'} icon={r.user_status ? <UnlockOutlined /> : <LockOutlined />}>
              {r.username}
            </Tag>
            <Button 
              size="small" 
              type={r.user_status ? 'default' : 'primary'} 
              danger={r.user_status}
              icon={r.user_status ? <LockOutlined /> : <UnlockOutlined />} 
              onClick={() => toggleAccMut.mutate(r.id)}
            />
          </Space>
        ) : (
          <Button 
            size="small" 
            type="dashed" 
            icon={<MobileOutlined />} 
            onClick={() => issueAccMut.mutate(r.id)}
          >
            Cấp tài khoản
          </Button>
        )
      )
    },
    {
      title: '',
      width: 60,
      render: (_: unknown, r: Employee) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
      )
    }
  ]

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      {expiring.length > 0 && (
        <Alert
          message={`Có ${expiring.length} nhân viên sắp hết hạn hợp đồng lao động!`}
          description={expiring.map(c => `${c.ho_ten as string} (${dayjs(c.ngay_het_han as string).format('DD/MM/YYYY')})`).join(', ')}
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 16 }}
          action={<Button size="small" type="primary" ghost>Xử lý ngay</Button>}
        />
      )}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Danh sách nhân viên</Title>
          <Text type="secondary">Quản lý hồ sơ nhân sự của 3 pháp nhân và 4 xưởng</Text>
        </Col>
        <Col>
          <Space>
            <Input
              placeholder="Tìm tên, mã NV..."
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
              onPressEnter={(e: React.KeyboardEvent<HTMLInputElement>) => setSearch((e.target as HTMLInputElement).value)}
              onBlur={(e: React.FocusEvent<HTMLInputElement>) => setSearch(e.target.value)}
            />
            <Select
              placeholder="Chọn pháp nhân"
              style={{ width: 180 }}
              allowClear
              options={(phapNhanList || []).map((p) => ({ value: p.id, label: p.ten_viet_tat || p.ten_phap_nhan }))}
              onChange={v => setFilters(f => ({ ...f, phap_nhan_id: v }))}
            />
            <Select
              placeholder="Chọn xưởng"
              style={{ width: 150 }}
              allowClear
              options={(phanXuongList || []).map((p) => ({ value: p.id, label: p.ten_xuong }))}
              onChange={v => setFilters(f => ({ ...f, phan_xuong_id: v }))}
            />
            <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
              Import Excel
            </Button>
            <Button icon={<DownloadOutlined />} onClick={() => downloadTemplate('employee')}>
              Tải file mẫu
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Thêm nhân viên
            </Button>
          </Space>
        </Col>
      </Row>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
                    locale={{ emptyText: <EmptyState size="small" preset="customer" /> }}
                    dataSource={employees}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size="small"
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1000 }}
        />
      </Card>

      <Drawer
        title={editing ? 'Chỉnh sửa hồ sơ' : 'Thêm nhân viên mới'}
        width={720}
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => setOpen(false)}>Huỷ</Button>
            <Button type="primary" loading={saveMut.isPending} onClick={() => form.submit()}>
              Lưu hồ sơ
            </Button>
          </Space>
        }
      >
        <Tabs items={[
          {
            key: 'info',
            label: <span><UserOutlined /> Thông tin chung</span>,
            children: (
              <Form
                form={form}
                layout="vertical"
                onFinish={v => saveMut.mutate(v)}
                initialValues={{ trang_thai: 'dang_lam' }}
              >
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item name="ma_nv" label="Mã nhân viên" rules={[{ required: true, message: 'Nhập mã NV' }]}>
                      <Input placeholder="VD: NV001" disabled={!!editing} />
                    </Form.Item>
                  </Col>
                  <Col span={16}>
                    <Form.Item name="ho_ten" label="Họ và tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
                      <Input placeholder="Nguyễn Văn A" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item name="ngay_sinh" label="Ngày sinh">
                      <Input type="date" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="gioi_tinh" label="Giới tính">
                      <Select options={[{ value: 'Nam', label: 'Nam' }, { value: 'Nữ', label: 'Nữ' }]} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="so_dien_thoai" label="Số điện thoại">
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>

                <Title level={5} style={{ marginTop: 16 }}>Thông tin tổ chức</Title>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="phap_nhan_id" label="Pháp nhân (Công ty ký HĐ)">
                      <Select options={phapNhanList.map(p => ({ value: p.id, label: p.ten_phap_nhan }))} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="phan_xuong_id" label="Xưởng / Nhà máy">
                      <Select options={phanXuongList.map((p) => ({ value: p.id, label: p.ten_xuong }))} />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="bo_phan_id" label="Phòng ban / Bộ phận">
                      <Select options={(depts || []).map((d) => ({ value: d.id, label: d.ten_bo_phan }))} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="chuc_vu_id" label="Chức vụ">
                      <Select options={(positions || []).map((p) => ({ value: p.id, label: p.ten_chuc_vu }))} />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item name="ngay_vao_lam" label="Ngày vào làm">
                      <Input type="date" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="he_so_ca_nhan" label="Hệ số cá nhân (Điều 11)" rules={[{ required: true }]}>
                      <InputNumber step={0.1} min={1.0} max={3.0} style={{ width: '100%' }} placeholder="VD: 1.7" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="trang_thai" label="Trạng thái">
                      <Select options={[
                        { value: 'dang_lam', label: 'Đang làm' },
                        { value: 'tam_nghi', label: 'Tạm nghỉ' },
                        { value: 'da_nghi', label: 'Đã nghỉ' },
                      ]} />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item name="ma_van_tay" label="Mã vân tay">
                      <Input placeholder="ID trên máy chấm công" />
                    </Form.Item>
                  </Col>
                  <Col span={16}>
                    <Form.Item name="user_id" label="Liên kết tài khoản hệ thống">
                        <Select placeholder="Chọn tài khoản..." allowClear>
                          {/* Data would come from UserList query */}
                        </Select>
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            )
          },
          {
            key: 'history',
            label: <span><HistoryOutlined /> Lịch sử thay đổi</span>,
            disabled: !editing,
            children: (
              <List
                dataSource={history}
                renderItem={(item: Record<string, unknown>) => (
                  <List.Item>
                    <List.Item.Meta
                      title={<Text strong>{item.loai === 'he_so' ? 'Thay đổi Hệ số cá nhân' : String(item.loai ?? '')}</Text>}
                      description={
                        <div>
                          <Tag color="orange">{String(item.gia_tri_cu ?? '')}</Tag> {'->'} <Tag color="green">{String(item.gia_tri_moi ?? '')}</Tag>
                          <br />
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {dayjs(item.created_at as string).format('DD/MM/YYYY HH:mm')} - Lý do: {String(item.ly_do ?? '')}
                          </Text>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            )
          },
          {
            key: 'docs',
            label: <span><FileProtectOutlined /> Hồ sơ số hóa</span>,
            disabled: !editing,
            children: <div style={{ textAlign: 'center', padding: 40 }}><Text type="secondary">Tính năng lưu trữ hồ sơ quét đang được triển khai...</Text></div>
          }
        ]} />
      </Drawer>

      <Drawer
        title="Xem trước dữ liệu Import Nhân viên"
        width={900}
        open={importOpen}
        onClose={() => {
          setImportOpen(false)
          setImportData([])
        }}
        extra={
          <Space>
            <Button onClick={() => setImportOpen(false)}>Huỷ</Button>
            <Button 
              type="primary" 
              disabled={importData.length === 0 || importData.some(r => r._error)} 
              onClick={async () => {
                message.loading('Đang xử lý import...')
                // Gửi importData lên API bulk create
                const validData = importData.map(r => {
                  const { _error, _status, ...clean } = r;
                  return clean;
                });
                // Giả lập gửi lên API
                try {
                  await hrApi.bulkCreateEmployees(validData)
                  if (validData.some((row) => (row as Record<string, unknown>).luong_co_ban || (row as Record<string, unknown>).phu_cap_chuyen_can || (row as Record<string, unknown>).phu_cap_trach_nhiem || (row as Record<string, unknown>).phu_cap_nha_o_com || (row as Record<string, unknown>).phu_cap_dien_thoai || (row as Record<string, unknown>).phu_cap_khac)) {
                    await hrApi.importContractAllowances(validData)
                  }
                  message.success(`Đã import thành công ${validData.length} nhân viên`)
                  setImportOpen(false)
                  setImportData([])
                  qc.invalidateQueries({ queryKey: ['hr-employees'] })
                } catch (e: unknown) {
                  message.error((e as ApiError)?.response?.data?.detail || 'Import nhan vien that bai')
                }
              }}
            >
              Xác nhận Lưu vào Hệ thống
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">Bước 1: Tải file lên. Bước 2: Kiểm tra bảng xem trước. Bước 3: Nhấn Xác nhận nếu không có lỗi đỏ.</Text>
          <div style={{ marginTop: 10 }}>
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
                  const wsname = wb.SheetNames[0]
                  const ws = wb.Sheets[wsname]
                  const data = XLSX.utils.sheet_to_json(ws)
                  
                  // Validation logic
                  const validated = data.map((row: unknown) => {
                    const r = row as Record<string, unknown>
                    let error = ''
                    if (!r.ma_nv) error = 'Thiếu mã nhân viên'
                    if (!r.ho_ten) error = 'Thiếu họ tên'
                    if (r.he_so_ca_nhan && (Number(r.he_so_ca_nhan) < 1 || Number(r.he_so_ca_nhan) > 3)) error = 'Hệ số phải từ 1.0 - 3.0'
                    
                    return {
                      ...r,
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
        </div>

        <Table 
          size="small"
          dataSource={importData}
          pagination={false}
          columns={[
            { title: 'Trạng thái', dataIndex: '_status', width: 100, render: (v: string, r: Record<string, unknown>) => (
              <Tag color={v === 'success' ? 'green' : 'red'}>{v === 'success' ? 'Hợp lệ' : r._error as string}</Tag>
            )},
            { title: 'Mã NV', dataIndex: 'ma_nv' },
            { title: 'Họ tên', dataIndex: 'ho_ten' },
            { title: 'Hệ số', dataIndex: 'he_so_ca_nhan', align: 'center' },
            { title: 'Xưởng', dataIndex: 'phan_xuong' },
            { title: 'Chức vụ', dataIndex: 'chuc_vu' },
            { title: 'Lương CB', dataIndex: 'luong_co_ban', align: 'right' as const, render: (v: number) => v?.toLocaleString?.() },
            { title: 'PC chuyên cần', dataIndex: 'phu_cap_chuyen_can', align: 'right' as const, render: (v: number) => v?.toLocaleString?.() },
            { title: 'PC trách nhiệm', dataIndex: 'phu_cap_trach_nhiem', align: 'right' as const, render: (v: number) => v?.toLocaleString?.() },
          ]}
        />
      </Drawer>
    </div>
  )
}
