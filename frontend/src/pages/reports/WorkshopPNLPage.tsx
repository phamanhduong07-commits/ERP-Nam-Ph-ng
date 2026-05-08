import React, { useState } from 'react'
import { Card, Table, Form, DatePicker, Select, Button, Typography, Space, Row, Col, Statistic, Tooltip } from 'antd'
import { reportsApi } from '../../api/reports'
import { usePhanXuong } from '../../hooks/useMasterData'
import { PrinterOutlined, SearchOutlined, InfoCircleOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

const WorkshopPNLPage: React.FC = () => {
  const { phanXuongList } = usePhanXuong()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)

  const onFinish = async (values: any) => {
    setLoading(true)
    try {
      const params = {
        phan_xuong_id: values.phan_xuong_id,
        tu_ngay: values.range[0].format('YYYY-MM-DD'),
        den_ngay: values.range[1].format('YYYY-MM-DD')
      }
      const res = await reportsApi.getWorkshopPNL(params)
      setData(res)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { title: 'Chỉ tiêu', dataIndex: 'label', key: 'label', render: (text: string, record: any) => (
      <Space>
        <Text strong={record.is_total} style={{ paddingLeft: record.indent ? 20 : 0 }}>{text}</Text>
        {record.tooltip && <Tooltip title={record.tooltip}><InfoCircleOutlined style={{ fontSize: 12, color: '#888' }} /></Tooltip>}
      </Space>
    )},
    { 
      title: 'Số tiền (VND)', 
      dataIndex: 'value', 
      key: 'value', 
      align: 'right' as const,
      render: (val: number, record: any) => (
        <Text strong={record.is_total} type={val < 0 ? 'danger' : undefined}>
          {Math.round(val || 0).toLocaleString()}
        </Text>
      )
    },
  ]

  const pnlRows = data ? [
    { label: 'A. DOANH THU', value: data.tong_doanh_thu, is_total: true },
    { label: '1. Doanh thu bán hàng ngoài', value: data.doanh_thu_ngoai, indent: true },
    { label: '2. Doanh thu nội bộ (Giá định mức)', value: data.doanh_thu_noi_bo, indent: true, tooltip: 'Doanh thu ghi nhận khi chuyển kho nội bộ dựa trên giá định mức' },
    
    { label: 'B. GIÁ VỐN HÀNG BÁN', value: data.tong_gia_von, is_total: true },
    { label: '1. Giá vốn bán ngoài', value: data.gia_von_ngoai, indent: true },
    { label: '2. Giá vốn nội bộ (Giá thực tế)', value: data.gia_von_noi_bo, indent: true, tooltip: 'Giá thực tế tích lũy từ NVL, nhân công, máy móc' },
    
    { label: 'C. LỢI NHUẬN GỘP (A - B)', value: data.loi_nhuan_gop, is_total: true },
    { label: 'Trong đó: Biến động định mức', value: data.bien_dong_dinh_muc, indent: true, tooltip: 'Chênh lệch giữa Giá Định Mức và Giá Thực Tế. Dương = Tiết kiệm chi phí' },
    
    { label: 'D. CHI PHÍ QUẢN LÝ & BÁN HÀNG', value: data.cp_ban_hang + data.cp_quan_ly, is_total: true },
    { label: '1. Chi phí bán hàng', value: data.cp_ban_hang, indent: true },
    { label: '2. Chi phí quản lý doanh nghiệp', value: data.cp_quan_ly, indent: true },
    
    { label: 'E. LỢI NHUẬN THUẦN (C - D)', value: data.loi_nhuan_thuan, is_total: true },
    
    { label: 'THÔNG TIN BỔ SUNG (Đã tính vào giá vốn)', value: null, is_total: true },
    { label: '- Chi phí nhân công xưởng', value: data.cp_nhan_cong, indent: true },
    { label: '- Chi phí khấu hao tài sản', value: data.cp_khau_hao, indent: true },
    { label: '- Chi phí chung phân bổ', value: data.cp_phan_bo, indent: true },
  ] : []

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>Báo cáo Lãi/Lỗ Quản trị Phân xưởng</Title>
      
      <Card style={{ marginBottom: 24 }}>
        <Form layout="inline" onFinish={onFinish}>
          <Form.Item name="phan_xuong_id" label="Phân xưởng" rules={[{ required: true }]}>
            <Select placeholder="Chọn xưởng" style={{ width: 200 }}>
              {phanXuongList.map((px: any) => <Select.Option key={px.id} value={px.id}>{px.ten_xuong}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="range" label="Thời gian" rules={[{ required: true }]}>
            <DatePicker.RangePicker />
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<SearchOutlined />} htmlType="submit" loading={loading}>Xem báo cáo</Button>
          </Form.Item>
          <Form.Item>
            <Button icon={<PrinterOutlined />}>In báo cáo</Button>
          </Form.Item>
        </Form>
      </Card>

      {data && (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic title="Hiệu suất Định mức" value={data.bien_dong_dinh_muc} suffix="VND" valueStyle={{ color: data.bien_dong_dinh_muc >= 0 ? '#3f8600' : '#cf1322' }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="Lợi nhuận Gộp" value={data.loi_nhuan_gop} suffix="VND" />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="Chi phí Vận hành (SG&A)" value={data.cp_ban_hang + data.cp_quan_ly} suffix="VND" valueStyle={{ color: '#cf1322' }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="Lợi nhuận Thuần" value={data.loi_nhuan_thuan} suffix="VND" valueStyle={{ fontWeight: 'bold' }} />
              </Card>
            </Col>
          </Row>

          <Card title="Chi tiết Kết quả Kinh doanh Quản trị">
            <Table 
              columns={columns} 
              dataSource={pnlRows} 
              pagination={false} 
              bordered 
              size="middle"
              rowKey="label"
            />
          </Card>
        </>
      )}
    </div>
  )
}

export default WorkshopPNLPage
