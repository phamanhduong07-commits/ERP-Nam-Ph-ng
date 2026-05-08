import React, { useState, useEffect } from 'react'
import { Card, Table, Button, Form, DatePicker, Select, InputNumber, Tabs, message, Space, Tag, Typography, Checkbox, Input, Row, Col, Modal } from 'antd'
import { workshopManagementApi, WorkshopPayroll, FixedAsset } from '../../api/accounting'
import { usePhapNhan, usePhanXuong } from '../../hooks/useMasterData'
import dayjs from 'dayjs'
import { PlusOutlined, FileExcelOutlined, UploadOutlined } from '@ant-design/icons'
import ImportExcelButton from '../../components/ImportExcelButton'

const { TabPane } = Tabs
const { Text } = Typography

const WorkshopManagement: React.FC = () => {
  const { phapNhanList } = usePhapNhan()
  const { phanXuongList } = usePhanXuong()
  const [loading, setLoading] = useState(false)

  // Data state
  const [payrolls, setPayrolls] = useState<WorkshopPayroll[]>([])
  const [assets, setAssets] = useState<FixedAsset[]>([])

  const [payrollForm] = Form.useForm()
  const [allocForm] = Form.useForm()
  const [depForm] = Form.useForm()
  const [assetForm] = Form.useForm()
  
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false)

  const fetchData = async () => {
    try {
      const [pRes, aRes] = await Promise.all([
        workshopManagementApi.listPayroll(),
        workshopManagementApi.listAssets()
      ])
      setPayrolls(pRes)
      setAssets(aRes)
    } catch (error) {
      console.error("Fetch error:", error)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleCreatePayroll = async (values: any) => {
    setLoading(true)
    try {
      const data = {
        ...values,
        thang: values.thang.format('YYYY-MM-01'),
        bo_qua_hach_toan: !!values.bo_qua_hach_toan
      }
      await workshopManagementApi.createPayroll(data)
      message.success('Đã tạo bảng lương xưởng thành công')
      payrollForm.resetFields()
      fetchData()
    } catch (error) {
      message.error('Lỗi khi tạo bảng lương')
    } finally {
      setLoading(false)
    }
  }

  const handleApprovePayroll = async (id: number) => {
    try {
      await workshopManagementApi.approvePayroll(id)
      message.success('Đã duyệt bảng lương')
      fetchData()
    } catch (error) {
      message.error('Lỗi khi duyệt bảng lương')
    }
  }

  const handleCreateAsset = async (values: any) => {
    setLoading(true)
    try {
      const data = {
        ...values,
        ngay_mua: values.ngay_mua.format('YYYY-MM-DD'),
        bo_qua_hach_toan: !!values.bo_qua_hach_toan
      }
      await workshopManagementApi.createAsset(data)
      message.success('Đã đăng ký tài sản thành công')
      setIsAssetModalOpen(false)
      assetForm.resetFields()
      fetchData()
    } catch (error) {
      message.error('Lỗi khi đăng ký tài sản')
    } finally {
      setLoading(false)
    }
  }

  const handleAllocate = async (values: any) => {
    setLoading(true)
    try {
      const data = {
        ...values,
        tu_ngay: values.range[0].format('YYYY-MM-DD'),
        den_ngay: values.range[1].format('YYYY-MM-DD'),
        allocations: values.allocations.map((a: any) => ({
          phan_xuong_id: a.phan_xuong_id,
          ty_le: a.ty_le / 100
        }))
      }
      delete data.range
      await workshopManagementApi.allocateOverhead(data)
      message.success('Đã thực hiện phân bổ chi phí thành công')
    } catch (error) {
      message.error('Lỗi khi phân bổ chi phí')
    } finally {
      setLoading(false)
    }
  }

  const handleRunDepreciation = async (values: any) => {
    setLoading(true)
    try {
      const params = {
        thang: values.period.month() + 1,
        nam: values.period.year(),
        phap_nhan_id: values.phap_nhan_id
      }
      await workshopManagementApi.runDepreciation(params)
      message.success('Đã chạy khấu hao tài sản thành công')
    } catch (error) {
      const msg = (error as any).response?.data?.detail || 'Lỗi khi chạy khấu hao'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <Card title="Quản trị Chi phí & Phân xưởng" extra={<Tag color="blue">Kế toán Quản trị</Tag>}>
        <Tabs defaultActiveKey="1">
          {/* TAB 1: BẢNG LƯƠNG XƯỞNG */}
          <TabPane tab="Lương Phân xưởng" key="1">
            <Form form={payrollForm} layout="vertical" onFinish={handleCreatePayroll} style={{ marginBottom: 32 }}>
              <Row gutter={16}>
                <Col span={4}>
                  <Form.Item name="thang" label="Tháng lương" rules={[{ required: true }]}>
                    <DatePicker picker="month" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={5}>
                  <Form.Item name="phan_xuong_id" label="Phân xưởng" rules={[{ required: true }]}>
                    <Select placeholder="Chọn xưởng">
                      {phanXuongList.map((px: any) => <Select.Option key={px.id} value={px.id}>{px.ten_xuong}</Select.Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={5}>
                  <Form.Item name="phap_nhan_id" label="Pháp nhân" rules={[{ required: true }]}>
                    <Select placeholder="Chọn pháp nhân">
                      {phapNhanList.map((pn: any) => <Select.Option key={pn.id} value={pn.id}>{pn.ten_phap_nhan}</Select.Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={5}>
                  <Form.Item name="tong_luong" label="Tổng quỹ lương" rules={[{ required: true }]}>
                    <InputNumber style={{ width: '100%' }} formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                  </Form.Item>
                </Col>
                <Col span={5}>
                  <Form.Item name="bo_qua_hach_toan" label=" " valuePropName="checked">
                    <Checkbox>Bỏ qua hạch toán</Checkbox>
                  </Form.Item>
                </Col>
              </Row>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <ImportExcelButton 
                  buttonText="Import bảng lương"
                  endpoint="/accounting/workshop-payroll"
                  templateFilename="Mau_Import_Luong_Xuong.xlsx"
                  onImported={fetchData}
                />
                <Button type="primary" onClick={() => payrollForm.submit()} loading={loading}>
                  Tạo bảng lương mới
                </Button>
            </div>
            </Form>

            <Table 
              size="small"
              dataSource={payrolls}
              rowKey="id"
              columns={[
                { title: 'Số phiếu', dataIndex: 'so_phieu' },
                { title: 'Tháng', dataIndex: 'thang', render: (val) => dayjs(val).format('MM/YYYY') },
                { title: 'Xưởng', dataIndex: 'phan_xuong_id', render: (id) => phanXuongList.find((px: any) => px.id === id)?.ten_xuong },
                { title: 'Số tiền', dataIndex: 'tong_luong', align: 'right', render: (val) => val.toLocaleString() },
                { title: 'Trạng thái', dataIndex: 'trang_thai', render: (val) => <Tag color={val === 'da_duyet' ? 'green' : 'orange'}>{val}</Tag> },
                { title: 'Hạch toán', dataIndex: 'bo_qua_hach_toan', render: (val) => val ? <Tag>Bỏ qua</Tag> : <Tag color="blue">Tự động</Tag> },
                { title: 'Thao tác', render: (_, record: any) => (
                  record.trang_thai !== 'da_duyet' && <Button type="link" onClick={() => handleApprovePayroll(record.id)}>Duyệt</Button>
                )}
              ]}
            />
          </TabPane>

          {/* TAB 2: TÀI SẢN & KHẤU HAO */}
          <TabPane tab="Khấu hao & Tài sản" key="2">
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <ImportExcelButton 
                  buttonText="Import tài sản"
                  endpoint="/accounting/fixed-assets"
                  templateFilename="Mau_Import_Tai_San.xlsx"
                  onImported={fetchData}
                />
               <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsAssetModalOpen(true)}>Đăng ký tài sản</Button>
            </div>
            <Row gutter={24}>
              <Col span={6}>
                <Card title="Chạy khấu hao định kỳ" size="small">
                  <Form form={depForm} layout="vertical" onFinish={handleRunDepreciation}>
                    <Form.Item name="period" label="Tháng/Năm" rules={[{ required: true }]}>
                      <DatePicker picker="month" style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="phap_nhan_id" label="Pháp nhân" rules={[{ required: true }]}>
                      <Select placeholder="Chọn pháp nhân">
                        {phapNhanList.map((pn: any) => <Select.Option key={pn.id} value={pn.id}>{pn.ten_phap_nhan}</Select.Option>)}
                      </Select>
                    </Form.Item>
                    <Button type="primary" danger htmlType="submit" loading={loading} block>Thực hiện khấu hao</Button>
                  </Form>
                </Card>
              </Col>

              <Col span={18}>
                <Table 
                  size="small"
                  dataSource={assets}
                  rowKey="id"
                  columns={[
                    { title: 'Mã TS', dataIndex: 'ma_ts' },
                    { title: 'Tên tài sản', dataIndex: 'ten_ts' },
                    { title: 'Nguyên giá', dataIndex: 'nguyen_gia', align: 'right', render: (val) => val?.toLocaleString() },
                    { title: 'Thời gian (tháng)', dataIndex: 'thoi_gian_khau_hao' },
                    { title: 'Đã KH', dataIndex: 'da_khau_hao_thang' },
                    { title: 'Xưởng', dataIndex: 'phan_xuong_id', render: (id) => phanXuongList.find((px: any) => px.id === id)?.ten_xuong },
                    { title: 'Hạch toán', dataIndex: 'bo_qua_hach_toan', render: (val) => val ? <Tag>Bỏ qua</Tag> : <Tag color="blue">Tự động</Tag> },
                  ]}
                />
              </Col>
            </Row>

            <Modal 
              title="Đăng ký Tài sản cố định" 
              open={isAssetModalOpen} 
              onCancel={() => setIsAssetModalOpen(false)}
              onOk={() => assetForm.submit()}
              confirmLoading={loading}
              width={700}
            >
              <Form form={assetForm} layout="vertical" onFinish={handleCreateAsset}>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item name="ma_ts" label="Mã tài sản" rules={[{ required: true }]}>
                      <Input placeholder="Mã TS" />
                    </Form.Item>
                  </Col>
                  <Col span={16}>
                    <Form.Item name="ten_ts" label="Tên tài sản" rules={[{ required: true }]}>
                      <Input placeholder="Tên tài sản máy móc" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item name="nguyen_gia" label="Nguyên giá (VND)" rules={[{ required: true }]}>
                      <InputNumber style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="thoi_gian_khau_hao" label="Thời gian KH (tháng)" rules={[{ required: true }]}>
                      <InputNumber style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="ngay_mua" label="Ngày mua" rules={[{ required: true }]}>
                      <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="phan_xuong_id" label="Gán cho phân xưởng" rules={[{ required: true }]}>
                      <Select placeholder="Chọn xưởng">
                        {phanXuongList.map((px: any) => <Select.Option key={px.id} value={px.id}>{px.ten_xuong}</Select.Option>)}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="phap_nhan_id" label="Pháp nhân chủ quản" rules={[{ required: true }]}>
                      <Select placeholder="Chọn pháp nhân">
                        {phapNhanList.map((pn: any) => <Select.Option key={pn.id} value={pn.id}>{pn.ten_phap_nhan}</Select.Option>)}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="bo_qua_hach_toan" valuePropName="checked">
                  <Checkbox>Bỏ qua hạch toán tự động (Dùng khi đã hạch toán tay tài sản)</Checkbox>
                </Form.Item>
              </Form>
            </Modal>
          </TabPane>

          {/* TAB 3: PHÂN BỔ CHI PHÍ */}
          <TabPane tab="Phân bổ Chi phí chung" key="3">
            <Form form={allocForm} layout="vertical" onFinish={handleAllocate} initialValues={{ allocations: [{}] }}>
              <Space>
                <Form.Item name="range" label="Khoảng thời gian chi phí" rules={[{ required: true }]}>
                  <DatePicker.RangePicker />
                </Form.Item>
                <Form.Item name="so_tk" label="Tài khoản chi phí" rules={[{ required: true }]}>
                  <Select style={{ width: 150 }}>
                    <Select.Option value="642">642 - CP Quản lý</Select.Option>
                    <Select.Option value="627">627 - CP Sản xuất chung</Select.Option>
                    <Select.Option value="641">641 - CP Bán hàng</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item name="phap_nhan_id" label="Pháp nhân" rules={[{ required: true }]} style={{ width: 200 }}>
                  <Select placeholder="Chọn pháp nhân">
                    {phapNhanList.map((pn: any) => <Select.Option key={pn.id} value={pn.id}>{pn.ten_phap_nhan}</Select.Option>)}
                  </Select>
                </Form.Item>
              </Space>

              <h3>Tỷ lệ phân bổ (%)</h3>
              <Form.List name="allocations">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Space key={key} align="baseline">
                        <Form.Item {...restField} name={[name, 'phan_xuong_id']} rules={[{ required: true, message: 'Thiếu xưởng' }]}>
                          <Select placeholder="Chọn xưởng" style={{ width: 200 }}>
                            {phanXuongList.map((px: any) => <Select.Option key={px.id} value={px.id}>{px.ten_xuong}</Select.Option>)}
                          </Select>
                        </Form.Item>
                        <Form.Item {...restField} name={[name, 'ty_le']} rules={[{ required: true, message: 'Thiếu tỷ lệ' }]}>
                          <InputNumber placeholder="%" min={0} max={100} style={{ width: 100 }} />
                        </Form.Item>
                        <Button type="link" onClick={() => remove(name)} danger>Xóa</Button>
                      </Space>
                    ))}
                    <Form.Item>
                      <Button type="dashed" onClick={() => add()} block>Thêm xưởng phân bổ</Button>
                    </Form.Item>
                  </>
                )}
              </Form.List>

              <Button type="primary" htmlType="submit" loading={loading}>Thực hiện phân bổ</Button>
            </Form>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  )
}

export default WorkshopManagement
