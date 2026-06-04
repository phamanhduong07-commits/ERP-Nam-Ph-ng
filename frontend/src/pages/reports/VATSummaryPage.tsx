import React, { useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Row,
  Select,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import { PrinterOutlined, SearchOutlined } from '@ant-design/icons'
import { reportsApi, VATAuditItem, VATAuditResponse } from '../../api/reports'
import { usePhapNhan } from '../../hooks/useMasterData'
import EmptyState from '../../components/EmptyState'

const { Title, Text } = Typography

interface VATData {
  doanh_thu_chiu_thue: number
  thue_gtgt_dau_ra: number
  gia_tri_hang_mua: number
  thue_gtgt_dau_vao: number
  thue_gtgt_phai_nop: number
}

const VATSummaryPage: React.FC = () => {
  const { phapNhanList } = usePhapNhan()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<VATData | null>(null)
  const [audit, setAudit] = useState<VATAuditResponse | null>(null)

  const onFinish = async (values: { thang: { month: () => number; year: () => number }; phap_nhan_id: number }) => {
    setLoading(true)
    try {
      const params = {
        thang: values.thang.month() + 1,
        nam: values.thang.year(),
        phap_nhan_id: values.phap_nhan_id,
      }
      const [summaryRes, auditRes] = await Promise.all([
        reportsApi.getVATSummary(params),
        reportsApi.getVATAudit({ ...params, limit: 100 }),
      ])
      setData(summaryRes)
      setAudit(auditRes)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const summaryColumns = [
    { title: 'Chi tieu', dataIndex: 'label', key: 'label' },
    {
      title: 'Gia tri (VND)',
      dataIndex: 'value',
      key: 'value',
      align: 'right' as const,
      render: (val: number) => <Text strong>{val?.toLocaleString()}</Text>,
    },
  ]

  const vatRows = data ? [
    { label: '1. Doanh thu ban ra (chua thue)', value: data.doanh_thu_chiu_thue },
    { label: '2. Thue GTGT dau ra', value: data.thue_gtgt_dau_ra },
    { label: '3. Gia tri hang hoa, dich vu mua vao', value: data.gia_tri_hang_mua },
    { label: '4. Thue GTGT dau vao duoc khau tru', value: data.thue_gtgt_dau_vao },
    { label: 'So thue phai nop / con duoc khau tru', value: data.thue_gtgt_phai_nop },
  ] : []

  const auditColumns = [
    {
      title: 'Muc do',
      dataIndex: 'severity',
      width: 90,
      render: (value: string) => <Tag color={value === 'error' ? 'red' : 'orange'}>{value === 'error' ? 'Loi' : 'Canh bao'}</Tag>,
    },
    {
      title: 'Loai',
      dataIndex: 'direction',
      width: 90,
      render: (value: string) => <Tag color={value === 'output' ? 'blue' : 'green'}>{value === 'output' ? 'Dau ra' : 'Dau vao'}</Tag>,
    },
    {
      title: 'Ngay',
      dataIndex: 'ngay',
      width: 110,
      render: (value: string | null) => value ? new Date(value).toLocaleDateString('vi-VN') : '-',
    },
    {
      title: 'Hoa don',
      width: 140,
      render: (_: unknown, record: VATAuditItem) => record.record_code || `#${record.record_id}`,
    },
    {
      title: 'Can xu ly',
      dataIndex: 'message',
      ellipsis: true,
    },
    {
      title: 'Lech',
      dataIndex: 'difference',
      width: 120,
      align: 'right' as const,
      render: (value: number | null) => value == null ? '-' : value.toLocaleString(),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>Bao cao tong hop thue GTGT</Title>

      <Card style={{ marginBottom: 24 }}>
        <Form layout="inline" onFinish={onFinish}>
          <Form.Item name="thang" label="Ky tinh thue" rules={[{ required: true }]}>
            <DatePicker picker="month" />
          </Form.Item>
          <Form.Item name="phap_nhan_id" label="Phap nhan" rules={[{ required: true }]}>
            <Select placeholder="Chon phap nhan" style={{ width: 250 }}>
              {phapNhanList.map((pn) => <Select.Option key={pn.id} value={pn.id}>{pn.ten_phap_nhan}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<SearchOutlined />} htmlType="submit" loading={loading}>Xem bao cao</Button>
          </Form.Item>
          <Form.Item>
            <Button icon={<PrinterOutlined />}>In mau ke khai</Button>
          </Form.Item>
        </Form>
      </Card>

      {data && (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={8}>
              <Card>
                <Statistic title="Thue dau ra" value={data.thue_gtgt_dau_ra} precision={0} valueStyle={{ color: '#cf1322' }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic title="Thue dau vao" value={data.thue_gtgt_dau_vao} precision={0} valueStyle={{ color: '#3f8600' }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title={data.thue_gtgt_phai_nop >= 0 ? 'Thue phai nop' : 'Con duoc khau tru'}
                  value={Math.abs(data.thue_gtgt_phai_nop)}
                  precision={0}
                  valueStyle={{ color: data.thue_gtgt_phai_nop >= 0 ? '#cf1322' : '#3f8600' }}
                />
              </Card>
            </Col>
          </Row>

          <Card title="Chi tiet ke khai">
            <Table
              columns={summaryColumns}
              dataSource={vatRows}
              pagination={false}
              bordered
            />
          </Card>

          <Card title="Kiem soat du lieu ke khai" style={{ marginTop: 24 }}>
            {audit?.total ? (
              <Alert
                showIcon
                type={(audit.by_severity?.error || 0) > 0 ? 'error' : 'warning'}
                message={`Co ${audit.total} van de can xu ly truoc khi nop to khai.`}
                style={{ marginBottom: 12 }}
              />
            ) : (
              <Alert
                showIcon
                type="success"
                message="Chua phat hien loi du lieu VAT trong ky dang chon."
                style={{ marginBottom: 12 }}
              />
            )}
            <Row gutter={16} style={{ marginBottom: 12 }}>
              <Col xs={12} md={6}>
                <Statistic title="HD ban ra" value={audit?.summary.sales_invoice_count || 0} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="HD mua vao" value={audit?.summary.purchase_invoice_count || 0} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="Loi" value={audit?.by_severity?.error || 0} valueStyle={{ color: '#cf1322' }} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="Canh bao" value={audit?.by_severity?.warning || 0} valueStyle={{ color: '#d48806' }} />
              </Col>
            </Row>
            <Table
              columns={auditColumns}
              dataSource={audit?.items || []}
              rowKey={(record) => `${record.direction}-${record.table}-${record.record_id}-${record.category}`}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              size="small"
              locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
              scroll={{ x: 780 }}
            />
          </Card>
        </>
      )}
    </div>
  )
}

export default VATSummaryPage
