import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Drawer, Form, Input, Select, Space, Table, Typography, message, Row, Col, Tag, InputNumber
} from 'antd'
import { PlusOutlined, EditOutlined, SettingOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons'
import { hrApi } from '../../api/hr'
import { theoDoiApi } from '../../api/theoDoi'
import { downloadTemplate } from '../../utils/excelUtils'
import * as XLSX from 'xlsx'

const { Title, Text } = Typography

const STAGE_OPTIONS = [
  { value: 'MAY_SONG_CD1', label: 'May song (CD1)' },
  { value: 'XA', label: 'Xa' },
  { value: 'IN', label: 'In' },
  { value: 'CAN_MANG', label: 'Can mang' },
  { value: 'THANH_PHAM', label: 'Thanh pham' },
  { value: 'ALL', label: 'Tong san luong xuong' },
]

export default function PayrollConfigPage() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<any | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importData, setImportData] = useState<any[]>([])
  const [form] = Form.useForm()

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['hr-payroll-configs'],
    queryFn: () => hrApi.listPayrollConfigs().then(r => r.data),
  })

  const { data: phanXuongList = [] } = useQuery({
    queryKey: ['phan-xuong-list'],
    queryFn: () => theoDoiApi.listPhanXuong().then(r => r.data),
  })

  const saveMut = useMutation({
    mutationFn: (data: any) => data.id ? hrApi.updatePayrollConfig(data.id, data) : hrApi.createPayrollConfig(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-payroll-configs'] })
      message.success('Da luu cau hinh')
      setEditing(null)
      form.resetFields()
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Loi luu du lieu'),
  })

  const handleAddDefault = () => {
    const defaults = [
      { ma_hang: 'MAY_SONG_CD1', ten_hang: 'May song (CD1)', cong_doan: 'MAY_SONG_CD1', phan_tram_luong_sp: 100, don_gia: 60, loai: 'san_pham' },
      { ma_hang: 'XA', ten_hang: 'Xa', cong_doan: 'XA', phan_tram_luong_sp: 100, don_gia: 68, loai: 'san_pham' },
      { ma_hang: 'IN', ten_hang: 'In', cong_doan: 'IN', phan_tram_luong_sp: 100, don_gia: 122, loai: 'san_pham' },
      { ma_hang: 'CAN_MANG', ten_hang: 'Can mang', cong_doan: 'CAN_MANG', phan_tram_luong_sp: 100, don_gia: 100, loai: 'san_pham' },
      { ma_hang: 'THANH_PHAM', ten_hang: 'Thanh pham', cong_doan: 'THANH_PHAM', phan_tram_luong_sp: 100, don_gia: 204, loai: 'san_pham' },
      { ma_hang: 'ALL', ten_hang: 'Tong san luong xuong', cong_doan: 'ALL', phan_tram_luong_sp: 100, don_gia: 100, loai: 'san_pham' },
    ]

    defaults.forEach(d => {
      if (!configs.find((c: any) => c.ma_hang === d.ma_hang)) {
        saveMut.mutate(d)
      }
    })
  }

  const columns = [
    {
      title: 'Ma hang/C.Doan',
      dataIndex: 'ma_hang',
      width: 150,
      render: (v: string) => <Tag color="blue">{v}</Tag>
    },
    {
      title: 'Ten hang / loai san xuat',
      dataIndex: 'ten_hang',
    },
    {
      title: 'Xuong',
      dataIndex: 'phan_xuong_id',
      width: 140,
      render: (v: number) => phanXuongList.find((px: any) => px.id === v)?.ten_xuong || 'Dung chung'
    },
    {
      title: 'Khau',
      dataIndex: 'cong_doan',
      width: 150,
      render: (v: string) => STAGE_OPTIONS.find(s => s.value === v)?.label || v || '-'
    },
    {
      title: '% Luong SP',
      dataIndex: 'phan_tram_luong_sp',
      width: 120,
      align: 'center' as const,
      render: (v: number) => <Text>{v}%</Text>
    },
    {
      title: 'Don gia',
      dataIndex: 'don_gia',
      width: 150,
      align: 'right' as const,
      render: (v: number | null) => <Text strong style={{ color: '#cf1322' }}>{v?.toLocaleString() ?? '—'}</Text>
    },
    {
      title: 'Trang thai',
      dataIndex: 'trang_thai',
      width: 120,
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'Hoat dong' : 'Tam dung'}</Tag>
    },
    {
      title: '',
      width: 50,
      render: (_: any, r: any) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => {
          setEditing(r)
          form.setFieldsValue(r)
        }} />
      )
    }
  ]

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Bang don gia san pham</Title>
          <Text type="secondary">Thiet lap don gia m2 theo xuong va khau tinh luong.</Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<DownloadOutlined />} onClick={() => downloadTemplate('payroll_config')}>
              Tai file mau
            </Button>
            <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
              Import Excel
            </Button>
            <Button icon={<PlusOutlined />} onClick={handleAddDefault}>
              Khoi tao khau mac dinh
            </Button>
            <Button type="primary" icon={<SettingOutlined />} onClick={() => setEditing({} as any)}>
              Them don gia moi
            </Button>
          </Space>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={16}>
          <Card size="small" styles={{ body: { padding: 0 } }}>
            <Table
              dataSource={configs}
              columns={columns}
              rowKey="id"
              loading={isLoading}
              size="small"
              pagination={false}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card title={editing ? (editing.id ? 'Chinh sua don gia' : 'Them don gia') : 'Ghi chu'} size="small">
            {editing ? (
              <Form
                form={form}
                layout="vertical"
                onFinish={v => saveMut.mutate({ ...editing, ...v })}
                initialValues={{ trang_thai: true, phan_tram_luong_sp: 100 }}
                onValuesChange={(changed, values) => {
                  if ((changed.phan_xuong_id !== undefined || changed.cong_doan !== undefined) && values.cong_doan && !editing?.id) {
                    form.setFieldsValue({
                      ma_hang: values.phan_xuong_id ? `PX${values.phan_xuong_id}_${values.cong_doan}` : values.cong_doan,
                    })
                  }
                }}
              >
                <Form.Item name="ma_hang" label="Ma hang / cong doan" rules={[{ required: true }]}>
                  <Input placeholder="VD: PX1_IN, IN, ALL..." />
                </Form.Item>
                <Form.Item name="ten_hang" label="Ten hang / loai san xuat" rules={[{ required: true }]}>
                  <Input placeholder="VD: May in 4 mau..." />
                </Form.Item>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item name="phan_xuong_id" label="Xuong / nha may">
                      <Select
                        allowClear
                        placeholder="Dung chung"
                        options={phanXuongList.map((px: any) => ({ value: px.id, label: px.ten_xuong }))}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="cong_doan" label="Khau tinh luong">
                      <Select allowClear placeholder="Chon khau" options={STAGE_OPTIONS} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item name="phan_tram_luong_sp" label="% Luong SP" rules={[{ required: true }]}>
                      <InputNumber style={{ width: '100%' }} suffix="%" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="don_gia" label="Don gia" rules={[{ required: true }]}>
                      <InputNumber style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="loai" label="Loai" initialValue="san_pham">
                  <Select options={[
                    { value: 'san_pham', label: 'Luong san pham' },
                    { value: 'phu_cap', label: 'Phu cap co dinh' },
                  ]} />
                </Form.Item>
                <Form.Item name="ghi_chu" label="Ghi chu">
                  <Input.TextArea rows={2} />
                </Form.Item>
                <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                  <Button onClick={() => setEditing(null)}>Huy</Button>
                  <Button type="primary" onClick={() => form.submit()} loading={saveMut.isPending}>
                    Luu cau hinh
                  </Button>
                </Space>
              </Form>
            ) : (
              <div style={{ padding: '8px 0' }}>
                <Text type="secondary">
                  Luong san pham = tong m2 hop le tu scan x don gia x % luong san pham.
                  <br /><br />
                  Hoang Gia, Nam Thuan chia 5 khau. Cu Chi dung khau ALL cho tong san luong xuong. Hoc Mon khong tinh luong san pham m2.
                </Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Drawer
        title="Xem truoc bang don gia san pham"
        width={800}
        open={importOpen}
        onClose={() => {
          setImportOpen(false)
          setImportData([])
        }}
        extra={
          <Space>
            <Button onClick={() => setImportOpen(false)}>Huy</Button>
            <Button
              type="primary"
              disabled={importData.length === 0 || importData.some(r => r._error)}
              onClick={async () => {
                message.loading('Dang luu bang don gia...')
                try {
                  const rows = importData.map(({ _error, _status, ...row }) => row)
                  await hrApi.bulkCreatePayrollConfigs(rows)
                  message.success(`Da cap nhat ${importData.length} ma hang thanh cong`)
                  setImportOpen(false)
                  setImportData([])
                  qc.invalidateQueries({ queryKey: ['hr-payroll-configs'] })
                } catch (e: any) {
                  message.error(e?.response?.data?.detail?.message || e?.response?.data?.detail || 'Import don gia that bai')
                }
              }}
            >
              Xac nhan luu
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">Keo tha file Excel chua bang don gia vao day de kiem tra.</Text>
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
                  const ws = wb.Sheets[wb.SheetNames[0]]
                  const data = XLSX.utils.sheet_to_json(ws)

                  const validated = data.map((row: any) => {
                    let error = ''
                    if (!row.ma_hang) error = 'Thieu ma hang'
                    if (!row.don_gia) error = 'Thieu don gia'

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
        </div>

        <Table
          size="small"
          dataSource={importData}
          pagination={false}
          columns={[
            { title: 'Trang thai', dataIndex: '_status', width: 120, render: (v, r) => (
              <Tag color={v === 'success' ? 'green' : 'red'}>{v === 'success' ? 'Hop le' : r._error}</Tag>
            )},
            { title: 'Ma hang', dataIndex: 'ma_hang' },
            { title: 'Ten hang', dataIndex: 'ten_hang' },
            { title: 'Xuong ID', dataIndex: 'phan_xuong_id' },
            { title: 'Khau', dataIndex: 'cong_doan' },
            { title: 'Don gia', dataIndex: 'don_gia', align: 'right' as const, render: (v) => v?.toLocaleString() },
            { title: '% Luong', dataIndex: 'phan_tram_luong_sp', align: 'center' as const },
          ]}
        />
      </Drawer>
    </div>
  )
}
