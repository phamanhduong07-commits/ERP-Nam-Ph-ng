import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Card, Table, Typography, Space, Button, DatePicker, Row, Col, Statistic, Tooltip, Select
} from 'antd'
import { 
  FileSearchOutlined, FilePdfOutlined, FileExcelOutlined, 
  SearchOutlined, AccountBookOutlined 
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { arApi } from '../../api/accounting'
import { phapNhanApi } from '../../api/phap_nhan'
import { warehouseApi } from '../../api/warehouse'
import { fmtVND, printToPdf, buildHtmlTable, exportToExcel } from '../../utils/exportUtils'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

export default function TrialBalancePage() {
  const [dates, setDates] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('year'),
    dayjs().endOf('month')
  ])
  const [phapNhanId, setPhapNhanId] = useState<number | undefined>()
  const [phanXuongId, setPhanXuongId] = useState<number | undefined>()

  // Lay danh muc phap nhan
  const { data: listPhapNhan = [] } = useQuery({
    queryKey: ['phap-nhan-list'],
    queryFn: () => phapNhanApi.list().then(r => r.data)
  })

  // Lay danh muc phan xuong
  const { data: listPhanXuong = [] } = useQuery({
    queryKey: ['phan-xuong-list'],
    queryFn: () => warehouseApi.listTheoPhanXuong().then(r => r.data)
  })

  const { data: balance = [], isLoading, refetch } = useQuery({
    queryKey: ['trial-balance', dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD'), phapNhanId, phanXuongId],
    queryFn: () => arApi.getTrialBalance({
      tu_ngay: dates[0].format('YYYY-MM-DD'),
      den_ngay: dates[1].format('YYYY-MM-DD'),
      phap_nhan_id: phapNhanId,
      phan_xuong_id: phanXuongId,
    })
  })

  const safeBalance = Array.isArray(balance) ? balance : []
  const totalNo = safeBalance.reduce((s: number, r: any) => s + Number(r.phat_sinh_no), 0)
  const totalCo = safeBalance.reduce((s: number, r: any) => s + Number(r.phat_sinh_co), 0)

  const columns = [
    { title: 'Số TK', dataIndex: 'so_tk', key: 'so_tk', width: 100, fixed: 'left' as const },
    { title: 'Tên tài khoản', dataIndex: 'ten_tk', key: 'ten_tk', width: 250, ellipsis: true },
    { 
      title: 'Số dư đầu kỳ', 
      dataIndex: 'so_du_dau', 
      align: 'right' as const, 
      render: (v: number) => <Text type={v < 0 ? 'danger' : undefined}>{fmtVND(v)}</Text> 
    },
    { title: 'Phát sinh Nợ', dataIndex: 'phat_sinh_no', align: 'right' as const, render: (v: number) => fmtVND(v) },
    { title: 'Phát sinh Có', dataIndex: 'phat_sinh_co', align: 'right' as const, render: (v: number) => fmtVND(v) },
    { 
      title: 'Số dư cuối kỳ', 
      dataIndex: 'so_du_cuoi', 
      align: 'right' as const, 
      render: (v: number) => <Text strong type={v < 0 ? 'danger' : undefined}>{fmtVND(v)}</Text> 
    },
    {
      title: 'Chi tiết',
      width: 80,
      align: 'center' as const,
      render: (_: any, r: any) => (
        <Tooltip title="Xem sổ cái">
          <Button size="small" icon={<FileSearchOutlined />} />
        </Tooltip>
      )
    }
  ]

  const handleExportPdf = () => {
    const cols = [
      { header: 'Số TK' }, { header: 'Tên tài khoản' }, 
      { header: 'Dư đầu kỳ', align: 'right' as const }, 
      { header: 'PS Nợ', align: 'right' as const }, 
      { header: 'PS Có', align: 'right' as const }, 
      { header: 'Dư cuối kỳ', align: 'right' as const }
    ]
    const rows = safeBalance.map((r: any) => [
      r.so_tk, r.ten_tk, fmtVND(r.so_du_dau), 
      fmtVND(r.phat_sinh_no), fmtVND(r.phat_sinh_co), fmtVND(r.so_du_cuoi)
    ])
    
    printToPdf(
      'BẢNG CÂN ĐỐI SỐ PHÁT SINH',
      `<h3>Từ ngày ${dates[0].format('DD/MM/YYYY')} đến ${dates[1].format('DD/MM/YYYY')}</h3>
       ${buildHtmlTable(cols, rows)}
       <div style="margin-top:20px; text-align:right">
         <b>Tổng phát sinh Nợ: ${fmtVND(totalNo)}</b><br/>
         <b>Tổng phát sinh Có: ${fmtVND(totalCo)}</b>
       </div>`,
      true
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <AccountBookOutlined style={{ fontSize: 24, color: '#1677ff' }} />
            <Title level={3} style={{ margin: 0 }}>Bảng cân đối số phát sinh</Title>
          </Space>
        </Col>
        <Col>
          <Space>
            <Select
              style={{ width: 180 }}
              placeholder="Tất cả Pháp nhân"
              allowClear
              value={phapNhanId}
              onChange={setPhapNhanId}
              options={listPhapNhan.map(p => ({ value: p.id, label: p.ten_viet_tat || p.ten_phap_nhan }))}
            />
            <Select
              style={{ width: 180 }}
              placeholder="Tất cả Xưởng"
              allowClear
              value={phanXuongId}
              onChange={setPhanXuongId}
              options={listPhanXuong.map(px => ({ value: px.id, label: px.ten_xuong }))}
            />
            <RangePicker 
              value={dates} 
              onChange={(v) => v && setDates(v as [dayjs.Dayjs, dayjs.Dayjs])} 
              format="DD/MM/YYYY" 
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={() => refetch()} loading={isLoading}>
              Xem báo cáo
            </Button>
            <Button icon={<FilePdfOutlined />} onClick={handleExportPdf}>Xuất PDF</Button>
            <Button icon={<FileExcelOutlined />}>Xuất Excel</Button>
          </Space>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card size="small">
            <Statistic title="Tổng phát sinh Nợ" value={totalNo} suffix="đ" valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small">
            <Statistic title="Tổng phát sinh Có" value={totalCo} suffix="đ" valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      <Card styles={{ body: { padding: 0 } }}>
        <Table
          size="small"
          dataSource={safeBalance}
          columns={columns}
          loading={isLoading}
          pagination={false}
          rowKey="so_tk"
          scroll={{ x: 1000 }}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={2}><b>TỔNG CỘNG</b></Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right"><b>-</b></Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right"><b>{fmtVND(totalNo)}</b></Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right"><b>{fmtVND(totalCo)}</b></Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right"><b>-</b></Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>
    </div>
  )
}
