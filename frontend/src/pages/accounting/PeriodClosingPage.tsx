import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Card, Typography, Space, Button, Row, Col, Select, DatePicker, Table, Tag, Modal, message, Alert, Statistic
} from 'antd'
import { 
  LockOutlined, UnlockOutlined, HistoryOutlined, 
  CheckCircleOutlined, ExclamationCircleOutlined,
  SyncOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import client from '../../api/client'
import { phapNhanApi } from '../../api/phap_nhan'
import { fmtVND } from '../../utils/exportUtils'

const { Title, Text } = Typography

export default function PeriodClosingPage() {
  const [month, setMonth] = useState<dayjs.Dayjs>(dayjs().subtract(1, 'month'))
  const [phapNhanId, setPhapNhanId] = useState<number | undefined>()

  // Lay danh muc phap nhan
  const { data: listPhapNhan = [] } = useQuery({
    queryKey: ['phap-nhan-list'],
    queryFn: () => phapNhanApi.list().then(r => r.data)
  })

  // Lay lich su ket chuyen (lay tu JournalEntry voi loai 'KET_CHUYEN')
  const { data: history = [], isLoading: historyLoading, refetch } = useQuery({
    queryKey: ['closing-history', phapNhanId],
    queryFn: () => client.get('/accounting/journal-entries', { 
      params: { loai_chung_tu: 'KET_CHUYEN', phap_nhan_id: phapNhanId } 
    }).then(r => r.data),
    enabled: !!phapNhanId
  })

  const closingMutation = useMutation({
    mutationFn: (data: { thang: number; nam: number; phap_nhan_id: number }) => 
      client.post('/accounting/reports/perform-closing', null, { params: data }),
    onSuccess: (res: any) => {
      Modal.success({
        title: 'Kết chuyển thành công',
        content: `Đã tạo bút toán kết chuyển. Lợi nhuận trong kỳ: ${fmtVND(res.data.profit)}`,
      })
      refetch()
    },
    onError: (err: any) => {
      message.error('Lỗi khi kết chuyển: ' + (err.response?.data?.detail || err.message))
    }
  })

  const handleClosing = () => {
    if (!phapNhanId) {
      message.warning('Vui lòng chọn Pháp nhân')
      return
    }
    Modal.confirm({
      title: `Xác nhận kết chuyển tháng ${month.format('MM/YYYY')}?`,
      icon: <ExclamationCircleOutlined />,
      content: 'Hệ thống sẽ tự động tính toán số dư các tài khoản doanh thu, chi phí và tạo bút toán kết chuyển lãi lỗ. Các bút toán kết chuyển cũ của tháng này (nếu có) sẽ bị xóa.',
      onOk: () => {
        closingMutation.mutate({
          thang: month.month() + 1,
          nam: month.year(),
          phap_nhan_id: phapNhanId
        })
      }
    })
  }

  const columns = [
    { title: 'Ngày kết chuyển', dataIndex: 'ngay_but_toan', render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Số chứng từ', dataIndex: 'so_phieu' },
    { title: 'Diễn giải', dataIndex: 'ghi_chu' },
    { 
      title: 'Trạng thái', 
      dataIndex: 'trang_thai',
      render: (v: string) => <Tag color="green">Đã chốt số liệu</Tag>
    },
    {
      title: 'Thao tác',
      render: (_: any, r: any) => (
        <Button type="link" icon={<HistoryOutlined />}>Xem chi tiết</Button>
      )
    }
  ]

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Space size="middle">
            <LockOutlined style={{ fontSize: 32, color: '#ff4d4f' }} />
            <div>
              <Title level={2} style={{ margin: 0 }}>Kết chuyển & Khóa sổ cuối kỳ</Title>
              <Text type="secondary">Tự động hóa bút toán lãi lỗ và bảo vệ dữ liệu kế toán</Text>
            </div>
          </Space>
        </Col>
      </Row>

      <Row gutter={24}>
        <Col span={8}>
          <Card title="Thực hiện kết chuyển">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Text strong>Chọn Pháp nhân:</Text>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  placeholder="Chọn Pháp nhân"
                  value={phapNhanId}
                  onChange={setPhapNhanId}
                  options={listPhapNhan.map(p => ({ value: p.id, label: p.ten_viet_tat || p.ten_phap_nhan }))}
                />
              </div>
              <div>
                <Text strong>Chọn Kỳ kế toán (Tháng):</Text>
                <DatePicker 
                  picker="month" 
                  style={{ width: '100%', marginTop: 8 }}
                  value={month}
                  onChange={(v) => v && setMonth(v)}
                  format="MM/YYYY"
                />
              </div>
              
              <Alert 
                message="Lưu ý quan trọng"
                description="Trước khi kết chuyển, hãy đảm bảo tất cả các chứng từ trong tháng đã được phê duyệt (Approved)."
                type="info"
                showIcon
              />

              <Button 
                type="primary" 
                danger 
                size="large" 
                block 
                icon={<SyncOutlined />} 
                onClick={handleClosing}
                loading={closingMutation.isPending}
              >
                CHẠY KẾT CHUYỂN LÃI LỖ
              </Button>
            </Space>
          </Card>
        </Col>

        <Col span={16}>
          <Card title="Lịch sử kết chuyển">
            <Table 
              size="small"
              dataSource={history}
              columns={columns}
              rowKey="id"
              loading={historyLoading}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
