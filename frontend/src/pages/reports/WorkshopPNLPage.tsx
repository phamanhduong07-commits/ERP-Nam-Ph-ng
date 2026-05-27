import React, { useState } from 'react'
import { Card, Table, Form, DatePicker, Select, Button, Typography, Space, Row, Col, Statistic, Tooltip } from 'antd'
import { reportsApi } from '../../api/reports'
import { usePhanXuong } from '../../hooks/useMasterData'
import { downloadBlob } from '../../utils/exportUtils'
import { PrinterOutlined, SearchOutlined, InfoCircleOutlined, DownloadOutlined } from '@ant-design/icons'
import EmptyState from "../../components/EmptyState"

const { Title, Text } = Typography

const WorkshopPNLPage: React.FC = () => {
  const { phanXuongList } = usePhanXuong()
  const [loading, setLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  interface WorkshopPNLData {
    tong_doanh_thu: number; doanh_thu_ngoai: number; doanh_thu_noi_bo: number
    tong_gia_von: number; gia_von_ngoai: number; gia_von_noi_bo: number
    loi_nhuan_gop: number; bien_dong_dinh_muc: number
    cp_ban_hang: number; cp_quan_ly: number; loi_nhuan_thuan: number
    cp_nhan_cong: number; cp_khau_hao: number; cp_phan_bo: number
  }
  const [data, setData] = useState<WorkshopPNLData | null>(null)
  const [form] = Form.useForm()

  const onFinish = async (values: { phan_xuong_id?: number; range: [{ format: (f: string) => string }, { format: (f: string) => string }] }) => {
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

  const handleExport = async () => {
    try {
      const values = await form.validateFields(['range'])
      setExportLoading(true)
      const params = {
        phan_xuong_id: form.getFieldValue('phan_xuong_id'),
        tu_ngay: values.range[0].format('YYYY-MM-DD'),
        den_ngay: values.range[1].format('YYYY-MM-DD'),
      }
      const blob = await reportsApi.exportWorkshopPNL(params)
      const filename = `lai-lo-phan-xuong_${params.tu_ngay}_${params.den_ngay}.xlsx`
      downloadBlob(blob, filename)
    } catch (error) {
      console.error(error)
    } finally {
      setExportLoading(false)
    }
  }

  type PnlRow = { label: string; value: number | null; is_total?: boolean; indent?: boolean; tooltip?: string }

  const columns = [
    { title: 'Chỉ tiêu', dataIndex: 'label', key: 'label', render: (text: string, record: PnlRow) => (
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
      render: (val: number | null, record: PnlRow) => (
        <Text strong={record.is_total} type={(val ?? 0) < 0 ? 'danger' : undefined}>
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
        <Form form={form} layout="inline" onFinish={onFinish}>
          <Form.Item name="phan_xuong_id" label="Phân xưởng">
            <Select placeholder="Tất cả phân xưởng" style={{ width: 200 }} allowClear>
              {phanXuongList.map((px) => <Select.Option key={px.id} value={px.id}>{px.ten_xuong}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="range" label="Thời gian" rules={[{ required: true }]}>
            <DatePicker.RangePicker />
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<SearchOutlined />} htmlType="submit" loading={loading}>Xem báo cáo</Button>
          </Form.Item>
          <Form.Item>
            <Button icon={<DownloadOutlined />} loading={exportLoading} onClick={handleExport}>Xuất Excel</Button>
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
