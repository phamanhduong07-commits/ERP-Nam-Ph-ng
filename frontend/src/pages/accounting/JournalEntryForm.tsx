import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Form, Input, InputNumber,
  Row, Select, Space, Typography, message, Table, Divider, Dropdown, MenuProps
} from 'antd'
import { 
  ArrowLeftOutlined, 
  SaveOutlined, 
  PlusOutlined, 
  DeleteOutlined,
  ThunderboltOutlined,
  InfoCircleOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { journalApi, arApi } from '../../api/accounting'
import { phapNhanApi } from '../../api/phap_nhan'
import { warehouseApi } from '../../api/warehouse'

const { Title, Text } = Typography

export default function JournalEntryForm() {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [totalNo, setTotalNo] = useState(0)
  const [totalCo, setTotalCo] = useState(0)

  // Lấy danh mục tài khoản
  const { data: accounts = [] } = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: () => arApi.getTrialBalance({
      tu_ngay: dayjs().format('YYYY-MM-DD'),
      den_ngay: dayjs().format('YYYY-MM-DD')
    })
  })

  const { data: listPhapNhan = [] } = useQuery({
    queryKey: ['phap-nhan-list'],
    queryFn: () => phapNhanApi.list().then(r => r.data)
  })

  const { data: listPhanXuong = [] } = useQuery({
    queryKey: ['phan-xuong-list'],
    queryFn: () => warehouseApi.listTheoPhanXuong().then(r => r.data)
  })

  const createMut = useMutation({
    mutationFn: (data: any) => journalApi.create(data),
    onSuccess: () => {
      message.success('Tạo bút toán thành công')
      navigate('/accounting/journal-entries')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi tạo bút toán')
  })

  const handleValuesChange = (_: any, allValues: any) => {
    const lines = allValues.lines || []
    const sumNo = lines.reduce((sum: number, l: any) => sum + (l.so_tien_no || 0), 0)
    const sumCo = lines.reduce((sum: number, l: any) => sum + (l.so_tien_co || 0), 0)
    setTotalNo(sumNo)
    setTotalCo(sumCo)
  }

  const applyTemplate = (type: string) => {
    let lines: any[] = []
    let loai = 'khac'
    let dien_giai = ''

    if (type === 'luong') {
      loai = 'luong_nhan_cong'
      dien_giai = 'Hạch toán lương nhân công tháng ' + dayjs().format('MM/YYYY')
      lines = [
        { so_tk: '154', dien_giai: 'Chi phí lương trực tiếp', so_tien_no: 0, so_tien_co: 0 },
        { so_tk: '334', dien_giai: 'Phải trả người lao động', so_tien_no: 0, so_tien_co: 0 }
      ]
    } else if (type === 'khau_hao') {
      loai = 'khau_hao_ts'
      dien_giai = 'Khấu hao TSCĐ tháng ' + dayjs().format('MM/YYYY')
      lines = [
        { so_tk: '154', dien_giai: 'Chi phí khấu hao máy móc', so_tien_no: 0, so_tien_co: 0 },
        { so_tk: '214', dien_giai: 'Hao mòn TSCĐ', so_tien_no: 0, so_tien_co: 0 }
      ]
    } else if (type === 'dien_nuoc') {
      loai = 'phan_bo_chi_phi'
      dien_giai = 'Chi phí điện nước xưởng tháng ' + dayjs().format('MM/YYYY')
      lines = [
        { so_tk: '154', dien_giai: 'Chi phí điện nước SX', so_tien_no: 0, so_tien_co: 0 },
        { so_tk: '111', dien_giai: 'Thanh toán tiền mặt', so_tien_no: 0, so_tien_co: 0 }
      ]
    }

    form.setFieldsValue({ loai_but_toan: loai, dien_giai, lines })
    handleValuesChange(null, form.getFieldsValue())
  }

  const templateMenu: MenuProps['items'] = [
    { key: 'luong', label: 'Mẫu Lương nhân công (154/334)', onClick: () => applyTemplate('luong') },
    { key: 'khau_hao', label: 'Mẫu Khấu hao TSCĐ (154/214)', onClick: () => applyTemplate('khau_hao') },
    { key: 'dien_nuoc', label: 'Mẫu Chi phí điện nước (154/111)', onClick: () => applyTemplate('dien_nuoc') },
  ]

  const onFinish = (values: any) => {
    if (Math.abs(totalNo - totalCo) > 0.01) {
      return message.error(`Bút toán không cân! Chênh lệch: ${(totalNo - totalCo).toLocaleString()}`)
    }
    if (totalNo === 0) return message.error('Tổng tiền phải lớn hơn 0')

    createMut.mutate({
      ...values,
      ngay_but_toan: values.ngay_but_toan.format('YYYY-MM-DD'),
      tong_no: totalNo,
      tong_co: totalCo
    })
  }

  return (
    <div style={{ padding: '24px 40px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Space size={16}>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/accounting/journal-entries')}
            style={{ borderRadius: 8 }}
          />
          <Title level={3} style={{ margin: 0 }}>Bút toán Tổng hợp</Title>
        </Space>
        
        <Space>
          <Dropdown menu={{ items: templateMenu }}>
            <Button icon={<ThunderboltOutlined />} style={{ borderRadius: 8 }}>Mẫu hạch toán nhanh</Button>
          </Dropdown>
          <Button 
            type="primary" 
            icon={<SaveOutlined />} 
            onClick={() => form.submit()} 
            loading={createMut.isPending}
            style={{ borderRadius: 8, height: 40, padding: '0 24px' }}
          >
            Lưu bút toán
          </Button>
        </Space>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={{ 
          ngay_but_toan: dayjs(),
          loai_but_toan: 'khac',
          lines: [{ so_tk: '', so_tien_no: 0, so_tien_co: 0 }] 
        }}
        onFinish={onFinish}
        onValuesChange={handleValuesChange}
      >
        <Row gutter={24}>
          <Col span={16}>
            <Card title="Thông tin chung" bordered={false} style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.03)', marginBottom: 24 }}>
              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item name="ngay_but_toan" label="Ngày chứng từ" rules={[{ required: true }]}>
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%', borderRadius: 6 }} />
                  </Form.Item>
                </Col>
                <Col span={10}>
                  <Form.Item name="dien_giai" label="Diễn giải chung" rules={[{ required: true }]}>
                    <Input placeholder="Ví dụ: Hạch toán lương tháng 5/2024" style={{ borderRadius: 6 }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="loai_but_toan" label="Loại bút toán" rules={[{ required: true }]}>
                    <Select style={{ borderRadius: 6 }}>
                      <Select.Option value="khac">Bút toán khác</Select.Option>
                      <Select.Option value="luong_nhan_cong">Lương nhân công</Select.Option>
                      <Select.Option value="khau_hao_ts">Khấu hao tài sản</Select.Option>
                      <Select.Option value="phan_bo_chi_phi">Phân bổ chi phí</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="phap_nhan_id" label="Pháp nhân mặc định">
                    <Select
                      allowClear
                      placeholder="Chọn pháp nhân"
                      options={listPhapNhan.map(p => ({ value: p.id, label: p.ten_viet_tat || p.ten_phap_nhan }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="phan_xuong_id" label="Phân xưởng mặc định">
                    <Select
                      allowClear
                      placeholder="Chọn phân xưởng"
                      options={listPhanXuong.map(px => ({ value: px.id, label: px.ten_xuong }))}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card title="Chi tiết định khoản" bordered={false} style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }} bodyStyle={{ padding: 0 }}>
              <Form.List name="lines">
                {(fields, { add, remove }) => (
                  <>
                    <Table
                      dataSource={fields}
                      pagination={false}
                      size="middle"
                      rowKey="key"
                      columns={[
                        {
                          title: 'Tài khoản',
                          key: 'so_tk',
                          width: 200,
                          render: (_, field) => (
                            <Form.Item {...field} name={[field.name, 'so_tk']} rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                              <Select
                                showSearch
                                placeholder="Chọn TK"
                                options={accounts.map((a: any) => ({ value: a.so_tk, label: `${a.so_tk} - ${a.ten_tk}` }))}
                                filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                                bordered={false}
                                className="cell-select"
                              />
                            </Form.Item>
                          )
                        },
                        {
                          title: 'Số tiền Nợ',
                          key: 'so_tien_no',
                          width: 140,
                          render: (_, field) => (
                            <Form.Item {...field} name={[field.name, 'so_tien_no']} style={{ marginBottom: 0 }}>
                              <InputNumber
                                style={{ width: '100%' }}
                                bordered={false}
                                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                parser={v => v ? v.replace(/\$\s?|(,*)/g, '') : 0}
                              />
                            </Form.Item>
                          )
                        },
                        {
                          title: 'Số tiền Có',
                          key: 'so_tien_co',
                          width: 140,
                          render: (_, field) => (
                            <Form.Item {...field} name={[field.name, 'so_tien_co']} style={{ marginBottom: 0 }}>
                              <InputNumber
                                style={{ width: '100%' }}
                                bordered={false}
                                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                parser={v => v ? v.replace(/\$\s?|(,*)/g, '') : 0}
                              />
                            </Form.Item>
                          )
                        },
                        {
                          title: 'Xưởng / Pháp nhân',
                          key: 'tags',
                          width: 160,
                          render: (_, field) => (
                            <Space direction="vertical" size={2} style={{ width: '100%' }}>
                              <Form.Item {...field} name={[field.name, 'phan_xuong_id']} style={{ marginBottom: 0 }}>
                                <Select placeholder="Xưởng" allowClear bordered={false} className="cell-select-small" options={listPhanXuong.map(px => ({ value: px.id, label: px.ten_xuong }))} />
                              </Form.Item>
                              <Form.Item {...field} name={[field.name, 'phap_nhan_id']} style={{ marginBottom: 0 }}>
                                <Select placeholder="Pháp nhân" allowClear bordered={false} className="cell-select-small" options={listPhapNhan.map(p => ({ value: p.id, label: p.ten_viet_tat || p.ten_phap_nhan }))} />
                              </Form.Item>
                            </Space>
                          )
                        },
                        {
                          title: '',
                          key: 'action',
                          width: 40,
                          render: (_, field) => (
                            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                          )
                        }
                      ]}
                    />
                    <div style={{ padding: 16 }}>
                      <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>Thêm dòng định khoản</Button>
                    </div>
                  </>
                )}
              </Form.List>
            </Card>
          </Col>

          <Col span={8}>
            <Card title="Tổng kết bút toán" bordered={false} style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.03)', position: 'sticky', top: 24 }}>
              <div style={{ marginBottom: 24 }}>
                <Row justify="space-between" style={{ marginBottom: 12 }}>
                  <Text type="secondary">Tổng Nợ:</Text>
                  <Text strong style={{ fontSize: 18 }}>{totalNo.toLocaleString()}</Text>
                </Row>
                <Row justify="space-between" style={{ marginBottom: 12 }}>
                  <Text type="secondary">Tổng Có:</Text>
                  <Text strong style={{ fontSize: 18 }}>{totalCo.toLocaleString()}</Text>
                </Row>
                <Divider style={{ margin: '12px 0' }} />
                <Row justify="space-between">
                  <Text strong>Chênh lệch:</Text>
                  <Text strong color={Math.abs(totalNo - totalCo) > 0.01 ? '#f5222d' : '#52c41a'} style={{ fontSize: 20 }}>
                    {(totalNo - totalCo).toLocaleString()}
                  </Text>
                </Row>
              </div>

              {Math.abs(totalNo - totalCo) > 0.01 && (
                <div style={{ padding: '12px 16px', background: '#fff1f0', borderRadius: 8, marginBottom: 24, border: '1px solid #ffa39e' }}>
                  <Space align="start">
                    <InfoCircleOutlined style={{ color: '#f5222d', marginTop: 3 }} />
                    <Text type="danger" style={{ fontSize: 13 }}>
                      Bút toán hiện đang không cân. Vui lòng kiểm tra lại các dòng định khoản trước khi lưu.
                    </Text>
                  </Space>
                </div>
              )}

              <Text type="secondary" style={{ fontSize: 12 }}>
                * Báo cáo Giá thành và P&L sẽ tự động cập nhật sau khi bạn lưu các bút toán Chi phí (loại Lương, Khấu hao, Phân bổ).
              </Text>
            </Card>
          </Col>
        </Row>
      </Form>

      <style>{`
        .cell-select .ant-select-selector {
          padding: 0 !important;
        }
        .cell-select-small {
          font-size: 12px;
        }
        .cell-select-small .ant-select-selector {
          padding: 0 !important;
          height: 24px !important;
        }
      `}</style>
    </div>
  )
}
