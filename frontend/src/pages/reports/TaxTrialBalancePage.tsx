import React, { useState } from 'react'
import { Card, Table, Form, DatePicker, Select, Button, Typography, Space } from 'antd'
import { reportsApi } from '../../api/reports'
import { usePhapNhan } from '../../hooks/useMasterData'
import { SearchOutlined, DownloadOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

const TaxTrialBalancePage: React.FC = () => {
  const { phapNhanList } = usePhapNhan()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any[]>([])

  const onFinish = async (values: any) => {
    setLoading(true)
    try {
      const params = {
        tu_ngay: values.range[0].format('YYYY-MM-DD'),
        den_ngay: values.range[1].format('YYYY-MM-DD'),
        phap_nhan_id: values.phap_nhan_id
      }
      const res = await reportsApi.getTaxTrialBalance(params)
      setData(res)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { title: 'Số TK', dataIndex: 'so_tk', key: 'so_tk', width: 100 },
    { title: 'Tên tài khoản', dataIndex: 'ten_tk', key: 'ten_tk' },
    { 
      title: 'Dư đầu kỳ', 
      dataIndex: 'so_du_dau', 
      key: 'so_du_dau', 
      align: 'right' as const,
      render: (val: number) => <Text style={{ color: val < 0 ? 'red' : 'inherit' }}>{val.toLocaleString()}</Text>
    },
    { 
      title: 'Phát sinh Nợ', 
      dataIndex: 'phat_sinh_no', 
      key: 'phat_sinh_no', 
      align: 'right' as const,
      render: (val: number) => val.toLocaleString()
    },
    { 
      title: 'Phát sinh Có', 
      dataIndex: 'phat_sinh_co', 
      key: 'phat_sinh_co', 
      align: 'right' as const,
      render: (val: number) => val.toLocaleString()
    },
    { 
      title: 'Dư cuối kỳ', 
      dataIndex: 'so_du_cuoi', 
      key: 'so_du_cuoi', 
      align: 'right' as const,
      render: (val: number) => <Text strong style={{ color: val < 0 ? 'red' : 'inherit' }}>{val.toLocaleString()}</Text>
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size={2} style={{ marginBottom: 16 }}>
        <Title level={3}>Bảng Cân đối Số phát sinh (Báo cáo Thuế/BCTC)</Title>
        <Text type="secondary">
          Hệ thống tự động loại bỏ các tài khoản nội bộ (5112, 6322, 1368, 3368) để phục vụ mục đích kê khai thuế.
        </Text>
      </Space>
      
      <Card style={{ marginBottom: 24 }}>
        <Form layout="inline" onFinish={onFinish}>
          <Form.Item name="range" label="Thời gian" rules={[{ required: true }]}>
            <DatePicker.RangePicker />
          </Form.Item>
          <Form.Item name="phap_nhan_id" label="Pháp nhân" rules={[{ required: true }]}>
            <Select placeholder="Chọn pháp nhân" style={{ width: 250 }}>
              {phapNhanList.map((pn: any) => <Select.Option key={pn.id} value={pn.id}>{pn.ten_phap_nhan}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<SearchOutlined />} htmlType="submit" loading={loading}>Xem bảng CĐPS</Button>
          </Form.Item>
          <Form.Item>
            <Button icon={<DownloadOutlined />}>Xuất Excel</Button>
          </Form.Item>
        </Form>
      </Card>

      <Card>
        <Table 
          columns={columns} 
          dataSource={data} 
          pagination={false} 
          bordered 
          size="middle"
          rowKey="so_tk"
        />
      </Card>
    </div>
  )
}

export default TaxTrialBalancePage
