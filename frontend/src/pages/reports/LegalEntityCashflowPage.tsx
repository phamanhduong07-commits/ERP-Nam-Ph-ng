import React, { useState } from 'react'
import { Card, Table, Form, DatePicker, Select, Button, Typography, Statistic, Row, Col } from 'antd'
import { reportsApi } from '../../api/reports'
import { usePhapNhan } from '../../hooks/useMasterData'
import { SearchOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

const LegalEntityCashflowPage: React.FC = () => {
  const { phapNhanList } = usePhapNhan()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)

  const onFinish = async (values: any) => {
    setLoading(true)
    try {
      const params = {
        phap_nhan_id: values.phap_nhan_id,
        tu_ngay: values.range[0].format('YYYY-MM-DD'),
        den_ngay: values.range[1].format('YYYY-MM-DD')
      }
      const res = await reportsApi.getLegalEntityCashflow(params)
      setData(res)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { title: 'Chỉ tiêu', dataIndex: 'label', key: 'label' },
    { 
      title: 'Số tiền (VND)', 
      dataIndex: 'value', 
      key: 'value', 
      align: 'right' as const,
      render: (val: number) => <Text strong>{val?.toLocaleString()}</Text>
    },
  ]

  const cashflowRows = data ? [
    { label: '1. Thu tiền từ Khách hàng', value: data.total_receipts },
    { label: '2. Chi trả Nhà cung cấp', value: data.total_payments },
    { label: 'LƯU CHUYỂN TIỀN THUẦN', value: data.net_cashflow },
  ] : []

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>Báo cáo Dòng tiền Pháp nhân</Title>
      
      <Card style={{ marginBottom: 24 }}>
        <Form layout="inline" onFinish={onFinish}>
          <Form.Item name="phap_nhan_id" label="Pháp nhân" rules={[{ required: true }]}>
            <Select placeholder="Chọn pháp nhân" style={{ width: 250 }}>
              {phapNhanList.map((pn: any) => <Select.Option key={pn.id} value={pn.id}>{pn.ten_phap_nhan}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="range" label="Thời gian" rules={[{ required: true }]}>
            <DatePicker.RangePicker />
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<SearchOutlined />} htmlType="submit" loading={loading}>Xem dòng tiền</Button>
          </Form.Item>
        </Form>
      </Card>

      {data && (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={12}>
              <Card>
                <Statistic title="Tổng Thu" value={data.total_receipts} precision={0} valueStyle={{ color: '#3f8600' }} />
              </Card>
            </Col>
            <Col span={12}>
              <Card>
                <Statistic title="Tổng Chi" value={data.total_payments} precision={0} valueStyle={{ color: '#cf1322' }} />
              </Card>
            </Col>
          </Row>

          <Card title="Chi tiết Dòng tiền">
            <Table 
              columns={columns} 
              dataSource={cashflowRows} 
              pagination={false} 
              bordered 
            />
          </Card>
        </>
      )}
    </div>
  )
}

export default LegalEntityCashflowPage
