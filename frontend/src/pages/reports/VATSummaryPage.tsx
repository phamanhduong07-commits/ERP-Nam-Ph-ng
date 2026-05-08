import React, { useState } from 'react'
import { Card, Table, Form, DatePicker, Select, Button, Typography, Statistic, Row, Col, Space } from 'antd'
import { reportsApi } from '../../api/reports'
import { usePhapNhan } from '../../hooks/useMasterData'
import { SearchOutlined, PrinterOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

const VATSummaryPage: React.FC = () => {
  const { phapNhanList } = usePhapNhan()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)

  const onFinish = async (values: any) => {
    setLoading(true)
    try {
      const params = {
        thang: values.thang.month() + 1,
        nam: values.thang.year(),
        phap_nhan_id: values.phap_nhan_id
      }
      const res = await reportsApi.getVATSummary(params)
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
      title: 'Giá trị (VND)', 
      dataIndex: 'value', 
      key: 'value', 
      align: 'right' as const,
      render: (val: number) => <Text strong>{val?.toLocaleString()}</Text>
    },
  ]

  const vatRows = data ? [
    { label: '1. Doanh thu bán ra (chưa thuế)', value: data.doanh_thu_chiu_thue },
    { label: '2. Thuế GTGT đầu ra', value: data.thue_gtgt_dau_ra },
    { label: '3. Giá trị hàng hóa, dịch vụ mua vào', value: data.gia_tri_hang_mua },
    { label: '4. Thuế GTGT đầu vào được khấu trừ', value: data.thue_gtgt_dau_vao },
    { label: 'SỐ THUẾ PHẢI NỘP / (HOÀN LẠI)', value: data.thue_gtgt_phai_nop },
  ] : []

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>Báo cáo Tổng hợp Thuế GTGT (Mẫu 01/GTGT)</Title>
      
      <Card style={{ marginBottom: 24 }}>
        <Form layout="inline" onFinish={onFinish}>
          <Form.Item name="thang" label="Kỳ tính thuế" rules={[{ required: true }]}>
            <DatePicker picker="month" />
          </Form.Item>
          <Form.Item name="phap_nhan_id" label="Pháp nhân" rules={[{ required: true }]}>
            <Select placeholder="Chọn pháp nhân" style={{ width: 250 }}>
              {phapNhanList.map((pn: any) => <Select.Option key={pn.id} value={pn.id}>{pn.ten_phap_nhan}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<SearchOutlined />} htmlType="submit" loading={loading}>Xem báo cáo</Button>
          </Form.Item>
          <Form.Item>
            <Button icon={<PrinterOutlined />}>In mẫu kê khai</Button>
          </Form.Item>
        </Form>
      </Card>

      {data && (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={8}>
              <Card>
                <Statistic title="Thuế Đầu Ra" value={data.thue_gtgt_dau_ra} precision={0} valueStyle={{ color: '#cf1322' }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic title="Thuế Đầu Vào" value={data.thue_gtgt_dau_vao} precision={0} valueStyle={{ color: '#3f8600' }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic 
                  title={data.thue_gtgt_phai_nop >= 0 ? "Thuế Phải Nộp" : "Thuế Còn Được Khấu Trừ"} 
                  value={Math.abs(data.thue_gtgt_phai_nop)} 
                  precision={0} 
                  valueStyle={{ color: data.thue_gtgt_phai_nop >= 0 ? '#cf1322' : '#3f8600' }} 
                />
              </Card>
            </Col>
          </Row>

          <Card title="Chi tiết Kê khai">
            <Table 
              columns={columns} 
              dataSource={vatRows} 
              pagination={false} 
              bordered 
            />
          </Card>
        </>
      )}
    </div>
  )
}

export default VATSummaryPage
