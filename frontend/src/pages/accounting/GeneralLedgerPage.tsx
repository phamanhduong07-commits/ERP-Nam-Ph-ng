import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  Card, Table, Typography, Space, Button, DatePicker, Row, Col, Select, Tag
} from 'antd'
import { 
  ArrowLeftOutlined, FilePdfOutlined, SearchOutlined, 
  BookOutlined 
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { arApi } from '../../api/accounting'
import { phapNhanApi } from '../../api/phap_nhan'
import { warehouseApi } from '../../api/warehouse'
import { fmtVND, printToPdf, buildHtmlTable } from '../../utils/exportUtils'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

export default function GeneralLedgerPage() {
  const [searchParams] = useSearchParams()
  const [soTk, setSoTk] = useState<string>(searchParams.get('so_tk') || '111')
  const [dates, setDates] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('month'),
    dayjs()
  ])
  const [phapNhanId, setPhapNhanId] = useState<number | undefined>()
  const [phanXuongId, setPhanXuongId] = useState<number | undefined>()

  // Lay danh sach tai khoan de chon
  const { data: accounts = [] } = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: () => arApi.getTrialBalance({
      tu_ngay: dayjs().format('YYYY-MM-DD'),
      den_ngay: dayjs().format('YYYY-MM-DD')
    })
  })

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

  const { data: ledger, isLoading, refetch } = useQuery({
    queryKey: ['general-ledger', soTk, dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD'), phapNhanId, phanXuongId],
    queryFn: () => arApi.getGeneralLedger({
      so_tk: soTk,
      tu_ngay: dates[0].format('YYYY-MM-DD'),
      den_ngay: dates[1].format('YYYY-MM-DD'),
      phap_nhan_id: phapNhanId,
      phan_xuong_id: phanXuongId,
    }),
    enabled: !!soTk
  })

  const columns = [
    { title: 'Ngày CT', dataIndex: 'ngay', key: 'ngay', width: 100, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Số chứng từ', dataIndex: 'so_phieu', key: 'so_phieu', width: 120, render: (v: string) => <Text code>{v}</Text> },
    { title: 'Diễn giải', dataIndex: 'dien_giai', key: 'dien_giai', ellipsis: true },
    { title: 'TK đối ứng', dataIndex: 'tk_doi_ung', key: 'tk_doi_ung', width: 100, align: 'center' as const },
    { title: 'Phát sinh Nợ', dataIndex: 'phat_sinh_no', align: 'right' as const, render: (v: number) => v > 0 ? fmtVND(v) : '' },
    { title: 'Phát sinh Có', dataIndex: 'phat_sinh_co', align: 'right' as const, render: (v: number) => v > 0 ? fmtVND(v) : '' },
    { title: 'Số dư', dataIndex: 'so_du', align: 'right' as const, render: (v: number) => <Text strong>{fmtVND(v)}</Text> },
  ]

  const handleExportPdf = () => {
    if (!ledger) return
    const cols = [
      { header: 'Ngày' }, { header: 'Số CT' }, { header: 'Diễn giải' }, 
      { header: 'TK ĐƯ' }, { header: 'Nợ', align: 'right' as const }, 
      { header: 'Có', align: 'right' as const }, { header: 'Số dư', align: 'right' as const }
    ]
    const rows = ledger.rows.map((r: any) => [
      dayjs(r.ngay).format('DD/MM'), r.so_phieu, r.dien_giai, 
      r.tk_doi_ung, fmtVND(r.phat_sinh_no), fmtVND(r.phat_sinh_co), fmtVND(r.so_du)
    ])

    printToPdf(
      `SỔ CÁI TÀI KHOẢN ${soTk} - ${ledger.ten_tk}`,
      `<h4>Từ ngày ${dates[0].format('DD/MM/YYYY')} đến ${dates[1].format('DD/MM/YYYY')}</h4>
       <p>Số dư đầu kỳ: <b>${fmtVND(ledger.so_du_dau)}</b></p>
       ${buildHtmlTable(cols, rows)}
       <p style="text-align:right">Số dư cuối kỳ: <b>${fmtVND(ledger.so_du_cuoi)}</b></p>`,
      true
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <BookOutlined style={{ fontSize: 24, color: '#1677ff' }} />
            <Title level={3} style={{ margin: 0 }}>Sổ cái chi tiết tài khoản</Title>
            {ledger && <Tag color="blue" style={{ fontSize: 14 }}>{soTk} - {ledger.ten_tk}</Tag>}
          </Space>
        </Col>
        <Col>
          <Space>
            <Select
              showSearch
              style={{ width: 300 }}
              placeholder="Chọn tài khoản..."
              value={soTk}
              onChange={setSoTk}
              options={(Array.isArray(accounts) ? accounts : []).map((a: any) => ({ value: a.so_tk, label: `${a.so_tk} - ${a.ten_tk}` }))}
              filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
            />
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
              Truy vấn
            </Button>
            <Button icon={<FilePdfOutlined />} onClick={handleExportPdf}>Xuất PDF</Button>
          </Space>
        </Col>
      </Row>

      {ledger && (
        <Card styles={{ body: { padding: 0 } }}>
          <Table
            size="small"
            loading={isLoading}
            dataSource={ledger.rows}
            columns={columns}
            pagination={{ pageSize: 50 }}
            rowKey="id"
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={4}><b>SỐ DƯ ĐẦU KỲ</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={1} colSpan={2}></Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right"><b>{fmtVND(ledger.so_du_dau)}</b></Table.Summary.Cell>
                </Table.Summary.Row>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={4}><b>SỐ DƯ CUỐI KỲ</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={1} colSpan={2}></Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right"><b>{fmtVND(ledger.so_du_cuoi)}</b></Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        </Card>
      )}
    </div>
  )
}
