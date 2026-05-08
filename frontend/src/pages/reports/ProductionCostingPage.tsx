import React, { useState, useEffect } from 'react'
import { 
  Card, Table, Form, DatePicker, Select, Button, 
  Typography, Space, Row, Col, Statistic, Tag, 
  Tooltip, Progress, Divider, Empty
} from 'antd'
import { reportsApi } from '../../api/reports'
import { usePhanXuong } from '../../hooks/useMasterData'
import { 
  PrinterOutlined, 
  SearchOutlined, 
  ArrowUpOutlined, 
  ArrowDownOutlined,
  DashboardOutlined,
  AuditOutlined,
  WalletOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'

const { Title, Text } = Typography

const ProductionCostingPage: React.FC = () => {
  const { phanXuongList } = usePhanXuong()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any[]>([])
  const [form] = Form.useForm()

  const fetchReport = async (values: any) => {
    setLoading(true)
    try {
      const params = {
        phan_xuong_id: values.phan_xuong_id,
        tu_ngay: values.range[0].format('YYYY-MM-DD'),
        den_ngay: values.range[1].format('YYYY-MM-DD')
      }
      const res = await reportsApi.getProductionCosting(params)
      setData(res)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // Auto-fetch on load
  useEffect(() => {
    fetchReport({
      range: [dayjs().startOf('month'), dayjs()],
      phan_xuong_id: undefined
    })
  }, [])

  const columns = [
    { 
      title: 'Số Lệnh SX', 
      dataIndex: 'so_lenh', 
      key: 'so_lenh', 
      width: 140, 
      fixed: 'left' as const,
      render: (text: string) => <Text strong style={{ color: '#1b168e' }}>{text}</Text>
    },
    { 
      title: 'Tên Sản Phẩm', 
      dataIndex: 'ten_hang', 
      key: 'ten_hang', 
      width: 250, 
      ellipsis: true,
      render: (text: string) => <Text>{text}</Text>
    },
    { 
      title: 'Sản lượng', 
      dataIndex: 'so_luong', 
      key: 'so_luong', 
      align: 'right' as const, 
      width: 120,
      render: (val: number, record: any) => (
        <Space direction="vertical" size={0} align="end">
          <Text strong>{val.toLocaleString()}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{record.dvt}</Text>
        </Space>
      )
    },
    {
      title: 'Cơ cấu Chi phí',
      key: 'cost_structure',
      width: 300,
      render: (_: any, record: any) => {
        const total = record.tong_chi_phi || 1
        const pMat = (record.cp_nvl / total) * 100
        const pNC = (record.cp_nhan_cong / total) * 100
        const pSXC = (record.cp_chung / total) * 100
        return (
          <Tooltip title={
            <div>
              NVL: {record.cp_nvl.toLocaleString()} ({pMat.toFixed(1)}%)<br/>
              Lương: {record.cp_nhan_cong.toLocaleString()} ({pNC.toFixed(1)}%)<br/>
              Chung: {record.cp_chung.toLocaleString()} ({pSXC.toFixed(1)}%)
            </div>
          }>
            <Progress 
              percent={100} 
              success={{ percent: pMat }} 
              strokeColor="#52c41a" // For the rest
              showInfo={false}
              size="small"
              className="custom-cost-progress"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 4 }}>
              <Text type="secondary">NVL: {pMat.toFixed(0)}%</Text>
              <Text type="secondary">NC: {pNC.toFixed(0)}%</Text>
              <Text type="secondary">SXC: {pSXC.toFixed(0)}%</Text>
            </div>
          </Tooltip>
        )
      }
    },
    { 
      title: 'Giá thành / ĐV', 
      dataIndex: 'gia_thanh_don_vi', 
      key: 'gia_thanh_don_vi', 
      align: 'right' as const,
      width: 150,
      render: (val: number) => (
        <Text strong style={{ fontSize: 15, color: '#1b168e' }}>
          {Math.round(val).toLocaleString()}
        </Text>
      )
    },
    { 
      title: 'Định mức', 
      dataIndex: 'standard_cost', 
      key: 'standard_cost', 
      align: 'right' as const,
      width: 130,
      render: (val: number) => val > 0 ? <Text type="secondary">{val.toLocaleString()}</Text> : '-'
    },
    {
      title: 'Biến động',
      key: 'variance',
      align: 'center' as const,
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: any) => {
        if (!record.standard_cost) return <Tag color="default">N/A</Tag>
        const diff = record.standard_cost - record.gia_thanh_don_vi
        const percent = (diff / record.standard_cost) * 100
        const isSaving = diff >= 0
        return (
          <Tag 
            color={isSaving ? 'success' : 'error'} 
            style={{ borderRadius: 12, padding: '0 8px', border: 'none' }}
            icon={isSaving ? <ArrowDownOutlined /> : <ArrowUpOutlined />}
          >
            {Math.abs(percent).toFixed(1)}%
          </Tag>
        )
      }
    }
  ]

  const totalCost = data.reduce((sum, item) => sum + item.tong_chi_phi, 0)
  const totalQty = data.reduce((sum, item) => sum + item.so_luong, 0)
  const avgCost = totalQty > 0 ? totalCost / totalQty : 0

  return (
    <div className="costing-report-container" style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <Space direction="vertical" size={4}>
          <Title level={2} style={{ margin: 0, color: '#1b168e' }}>Báo cáo Giá thành Sản xuất</Title>
          <Text type="secondary">Phân tích chi phí thực tế và so sánh hiệu quả định mức sản xuất</Text>
        </Space>
        <Space>
          <Button icon={<PrinterOutlined />} size="large">Xuất PDF</Button>
          <Button type="primary" size="large" onClick={() => form.submit()}>Làm mới dữ liệu</Button>
        </Space>
      </div>
      
      {/* Search Header - Glassmorphism style */}
      <Card 
        style={{ 
          marginBottom: 32, 
          borderRadius: 16, 
          boxShadow: '0 8px 32px rgba(27, 22, 142, 0.05)',
          border: '1px solid rgba(27, 22, 142, 0.1)'
        }}
        bodyStyle={{ padding: '20px 24px' }}
      >
        <Form 
          form={form}
          layout="vertical" 
          onFinish={fetchReport} 
          initialValues={{ range: [dayjs().startOf('month'), dayjs()] }}
        >
          <Row gutter={24} align="bottom">
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="phan_xuong_id" label={<Text strong>Phân xưởng sản xuất</Text>}>
                <Select placeholder="Tất cả phân xưởng" size="large" allowClear style={{ borderRadius: 8 }}>
                  {phanXuongList.map((px: any) => (
                    <Select.Option key={px.id} value={px.id}>{px.ten_xuong}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="range" label={<Text strong>Khoảng thời gian báo cáo</Text>} rules={[{ required: true }]}>
                <DatePicker.RangePicker size="large" style={{ width: '100%', borderRadius: 8 }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={24} md={8}>
              <Form.Item>
                <Button 
                  type="primary" 
                  icon={<SearchOutlined />} 
                  htmlType="submit" 
                  loading={loading}
                  size="large"
                  block
                  style={{ borderRadius: 8, height: 40 }}
                >
                  Truy vấn dữ liệu
                </Button>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      {data.length > 0 ? (
        <>
          <Row gutter={24} style={{ marginBottom: 32 }}>
            <Col xs={24} md={8}>
              <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #1b168e 0%, #3a32cc 100%)', borderRadius: 16 }}>
                <Statistic 
                  title={<Text style={{ color: 'rgba(255,255,255,0.8)' }}>Tổng giá trị sản xuất</Text>}
                  value={totalCost} 
                  precision={0}
                  prefix={<WalletOutlined style={{ color: '#fff', marginRight: 8 }} />}
                  suffix={<Text style={{ color: '#fff', fontSize: 16 }}>VND</Text>}
                  valueStyle={{ color: '#fff', fontSize: 28, fontWeight: 'bold' }} 
                />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card className="stat-card" style={{ background: '#fff', borderRadius: 16, border: '1px solid #e8e8e8' }}>
                <Statistic 
                  title="Tổng sản lượng nhập kho"
                  value={totalQty} 
                  precision={0}
                  prefix={<DashboardOutlined style={{ color: '#1890ff', marginRight: 8 }} />}
                  suffix={<Text type="secondary" style={{ fontSize: 16 }}>đv</Text>}
                  valueStyle={{ color: '#262626', fontSize: 28, fontWeight: 'bold' }} 
                />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card className="stat-card" style={{ background: '#fff', borderRadius: 16, border: '1px solid #e8e8e8' }}>
                <Statistic 
                  title="Giá thành trung bình"
                  value={avgCost} 
                  precision={0}
                  prefix={<AuditOutlined style={{ color: '#52c41a', marginRight: 8 }} />}
                  suffix={<Text type="secondary" style={{ fontSize: 16 }}>VND/đv</Text>}
                  valueStyle={{ color: '#262626', fontSize: 28, fontWeight: 'bold' }} 
                />
              </Card>
            </Col>
          </Row>

          <Card 
            title={<Title level={4} style={{ margin: 0 }}>Chi tiết chi phí theo Lệnh sản xuất</Title>}
            extra={<Text type="secondary">Tìm thấy {data.length} lệnh sản xuất</Text>}
            style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.03)', border: 'none' }}
            bodyStyle={{ padding: 0 }}
          >
            <Table 
              columns={columns} 
              dataSource={data} 
              pagination={{ pageSize: 20, showSizeChanger: true }} 
              loading={loading}
              rowKey="so_lenh"
              scroll={{ x: 1200 }}
              className="costing-table"
              summary={(pageData) => {
                let tMat = 0, tNC = 0, tSXC = 0
                pageData.forEach(r => {
                  tMat += r.cp_nvl; tNC += r.cp_nhan_cong; tSXC += r.cp_chung;
                })
                return (
                  <Table.Summary fixed>
                    <Table.Summary.Row style={{ background: '#fafafa' }}>
                      <Table.Summary.Cell index={0} colSpan={3}><Text strong>TỔNG CỘNG TRANG NÀY</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={3}>
                        <div style={{ textAlign: 'right' }}>
                          <Text strong>{(tMat+tNC+tSXC).toLocaleString()}</Text>
                          <div style={{ fontSize: 10, color: '#8c8c8c' }}>
                            NVL: {tMat.toLocaleString()}
                          </div>
                        </div>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={4} colSpan={3} />
                    </Table.Summary.Row>
                  </Table.Summary>
                )
              }}
            />
          </Card>
        </>
      ) : (
        !loading && <Card style={{ borderRadius: 16, textAlign: 'center', padding: '60px 0' }}><Empty description="Chưa có dữ liệu trong khoảng thời gian này" /></Card>
      )}

      <style>{`
        .costing-report-container .ant-statistic-title {
          font-size: 14px;
          margin-bottom: 8px;
        }
        .stat-card {
          transition: all 0.3s;
          height: 100%;
        }
        .stat-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.1) !important;
        }
        .costing-table .ant-table-thead > tr > th {
          background: #f0f2f5;
          font-weight: 700;
        }
        .bg-highlight-blue {
          background: #e6f7ff;
        }
      `}</style>
    </div>
  )
}

export default ProductionCostingPage
