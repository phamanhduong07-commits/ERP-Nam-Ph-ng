import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Table, Card, Button, Typography, Space, Tag, DatePicker, Row, Col, Input
} from 'antd'
import {
  PlusOutlined, SearchOutlined, FileTextOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { journalApi } from '../../api/accounting'
import { fmtVND } from '../../utils/exportUtils'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

export default function JournalEntryListPage() {
  const navigate = useNavigate()
  const [params, setParams] = useState({
    tu_ngay: dayjs().startOf('month').format('YYYY-MM-DD'),
    den_ngay: dayjs().endOf('month').format('YYYY-MM-DD'),
    page: 1,
    page_size: 20
  })

  const { data, isLoading } = useQuery({
    queryKey: ['journal-entries', params],
    queryFn: () => journalApi.list(params)
  })

  const columns = [
    {
      title: 'Số chứng từ',
      dataIndex: 'so_but_toan',
      key: 'so_but_toan',
      render: (v: string) => <Text strong>{v}</Text>
    },
    {
      title: 'Ngày',
      dataIndex: 'ngay_but_toan',
      key: 'ngay_but_toan',
      render: (v: string) => dayjs(v).format('DD/MM/YYYY')
    },
    {
      title: 'Diễn giải',
      dataIndex: 'dien_giai',
      key: 'dien_giai',
      ellipsis: true
    },
    {
      title: 'Tổng Nợ',
      dataIndex: 'tong_no',
      key: 'tong_no',
      align: 'right' as const,
      render: (v: number) => fmtVND(v)
    },
    {
      title: 'Tổng Có',
      dataIndex: 'tong_co',
      key: 'tong_co',
      align: 'right' as const,
      render: (v: number) => fmtVND(v)
    },
    {
      title: 'Loại',
      dataIndex: 'loai_but_toan',
      key: 'loai_but_toan',
      render: (v: string) => {
        const config: any = {
          tong_hop: { label: 'Tổng hợp', color: 'blue' },
          luong_nhan_cong: { label: 'Lương nhân công', color: 'green' },
          khau_hao_ts: { label: 'Khấu hao TS', color: 'orange' },
          phan_bo_chi_phi: { label: 'Phân bổ chi phí', color: 'cyan' },
          khac: { label: 'Khác', color: 'default' }
        }
        const item = config[v] || { label: v.toUpperCase(), color: 'default' }
        return <Tag color={item.color}>{item.label}</Tag>
      }
    }
  ]

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Space>
            <FileTextOutlined style={{ fontSize: 28, color: '#1b168e' }} />
            <Title level={3} style={{ margin: 0 }}>Bút toán tổng hợp</Title>
          </Space>
        </Col>
        <Col>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => navigate('/accounting/journal-entries/new')}
          >
            Tạo bút toán mới
          </Button>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <RangePicker 
            defaultValue={[dayjs().startOf('month'), dayjs().endOf('month')]}
            format="DD/MM/YYYY"
            onChange={(dates) => {
              if (dates) {
                setParams({
                  ...params,
                  tu_ngay: dates[0]!.format('YYYY-MM-DD'),
                  den_ngay: dates[1]!.format('YYYY-MM-DD')
                })
              }
            }}
          />
          <Input 
            placeholder="Tìm số chứng từ..." 
            prefix={<SearchOutlined />} 
            style={{ width: 200 }}
          />
        </Space>
      </Card>

      <Table
        dataSource={data?.items || []}
        columns={columns}
        loading={isLoading}
        rowKey="id"
        pagination={{
          total: data?.total || 0,
          current: params.page,
          pageSize: params.page_size,
          onChange: (page) => setParams({ ...params, page })
        }}
        size="small"
      />
    </div>
  )
}
