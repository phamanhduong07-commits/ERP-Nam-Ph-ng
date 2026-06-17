import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, DatePicker, Button, Space, Typography, Statistic, Row, Col, Tag, Select,
} from 'antd'
import { FileExcelOutlined, SearchOutlined, PrinterOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { bankLedgerApi, type LedgerEntry } from '../../api/banking'
import { exportToExcel } from '../../utils/exportUtils'
import ImportExcelButton from '../../components/ImportExcelButton'
import EmptyState from "../../components/EmptyState"
import { useColumnPrefs } from '../../hooks/useColumnPrefs'
import { usePhapNhan, usePhanXuong } from '../../hooks/useMasterData'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

export default function CashBookPage() {
  const qc = useQueryClient()
  const today = dayjs()
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    today.startOf('month'),
    today,
  ])
  const [filterPhapNhan, setFilterPhapNhan] = useState<number | undefined>()
  const [filterPhanXuong, setFilterPhanXuong] = useState<number | undefined>()
  const { phapNhanList } = usePhapNhan()
  const { phanXuongList } = usePhanXuong()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['cash-book', range[0].format('YYYY-MM-DD'), range[1].format('YYYY-MM-DD'), filterPhapNhan, filterPhanXuong],
    queryFn: () =>
      bankLedgerApi
        .getCashBook(range[0].format('YYYY-MM-DD'), range[1].format('YYYY-MM-DD'), filterPhapNhan, filterPhanXuong)
        .then(r => r.data),
    enabled: true,
  })

  const columns: ColumnsType<LedgerEntry> = [
    {
      title: 'Ngày',
      dataIndex: 'ngay',
      width: 100,
      render: v => dayjs(v).format('DD/MM/YYYY'),
    },
    { title: 'Số chứng từ', dataIndex: 'so_chung_tu', width: 160 },
    {
      title: 'Loại',
      dataIndex: 'loai',
      width: 80,
      render: v => (
        <Tag color={v === 'thu' ? 'green' : 'red'}>{v === 'thu' ? 'Thu' : 'Chi'}</Tag>
      ),
    },
    { title: 'Đối tượng', dataIndex: 'doi_tuong', ellipsis: true },
    { title: 'Diễn giải', dataIndex: 'dien_giai', ellipsis: true },
    {
      title: 'Thu (đ)',
      dataIndex: 'thu',
      align: 'right',
      width: 140,
      render: v =>
        Number(v) > 0 ? (
          <Text type="success" strong>{Number(v).toLocaleString('vi-VN')}</Text>
        ) : '',
    },
    {
      title: 'Chi (đ)',
      dataIndex: 'chi',
      align: 'right',
      width: 140,
      render: v =>
        Number(v) > 0 ? (
          <Text type="danger" strong>{Number(v).toLocaleString('vi-VN')}</Text>
        ) : '',
    },
    {
      title: 'Pháp nhân',
      dataIndex: 'ten_phap_nhan',
      width: 130,
      ellipsis: true,
      render: v => v ?? '—',
    },
    {
      title: 'Phân xưởng',
      dataIndex: 'ten_phan_xuong',
      width: 120,
      ellipsis: true,
      render: v => v ?? '—',
    },
    {
      title: 'Số dư (đ)',
      dataIndex: 'so_du',
      align: 'right',
      width: 150,
      render: v => (
        <Text strong style={{ color: Number(v) >= 0 ? '#1677ff' : 'red' }}>
          {Number(v).toLocaleString('vi-VN')}
        </Text>
      ),
    },
  ]

  const { displayColumns, settingsButton } = useColumnPrefs('cash-book', columns)

  const handleExportExcel = () => {
    if (!data) return
    const tu = range[0].format('DDMMYYYY')
    const den = range[1].format('DDMMYYYY')
    exportToExcel(`SoQuy_${tu}_${den}`, [{
      name: 'Sổ quỹ',
      headers: ['Ngày', 'Số chứng từ', 'Loại', 'Đối tượng', 'Diễn giải', 'Pháp nhân', 'Phân xưởng', 'Thu (đ)', 'Chi (đ)', 'Số dư (đ)'],
      rows: (data.entries ?? []).map((r: LedgerEntry) => [
        dayjs(r.ngay).format('DD/MM/YYYY'),
        r.so_chung_tu,
        r.loai === 'thu' ? 'Thu' : 'Chi',
        r.doi_tuong,
        r.dien_giai,
        (r as any).ten_phap_nhan ?? '',
        (r as any).ten_phan_xuong ?? '',
        Number(r.thu) > 0 ? Number(r.thu) : '',
        Number(r.chi) > 0 ? Number(r.chi) : '',
        Number(r.so_du),
      ]),
      colWidths: [12, 18, 8, 22, 30, 16, 14, 16, 16, 18],
    }])
  }

  return (
    <Card
      title={<Title level={4} style={{ margin: 0 }}>Sổ quỹ tiền mặt</Title>}
      extra={
        <Space>
          <ImportExcelButton
            endpoint="/api/accounting/opening-balances/cash"
            templateFilename="mau_import_so_du_quy_tien_mat.xlsx"
            buttonText="Import số dư"
            onImported={() => qc.invalidateQueries({ queryKey: ['cash-book'] })}
          />
          <Button icon={<FileExcelOutlined />} style={{ color: '#217346', borderColor: '#217346' }} onClick={handleExportExcel} disabled={!data}>
            Xuất Excel
          </Button>
          <Button icon={<PrinterOutlined />} onClick={() => window.print()}>In</Button>
          {settingsButton}
        </Space>
      }
    >
      <Space wrap style={{ marginBottom: 16 }}>
        <RangePicker
          value={range}
          onChange={v => v && setRange([v[0]!, v[1]!])}
          format="DD/MM/YYYY"
        />
        <Select
          style={{ width: 180 }}
          allowClear
          placeholder="Pháp nhân"
          value={filterPhapNhan}
          onChange={v => setFilterPhapNhan(v)}
          options={phapNhanList.map(p => ({ value: p.id, label: p.ten_phap_nhan }))}
        />
        <Select
          style={{ width: 160 }}
          allowClear
          placeholder="Phân xưởng"
          value={filterPhanXuong}
          onChange={v => setFilterPhanXuong(v)}
          options={phanXuongList.map(x => ({ value: x.id, label: x.ten_xuong }))}
        />
        <Button type="primary" icon={<SearchOutlined />} onClick={() => refetch()}>
          Xem sổ
        </Button>
      </Space>

      {data && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Statistic
                title="Số dư đầu kỳ"
                value={Number(data.so_du_dau)}
                suffix="đ"
                valueStyle={{ color: '#1677ff' }}
                formatter={v => Number(v).toLocaleString('vi-VN')}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Tổng thu"
                value={Number(data.tong_thu)}
                suffix="đ"
                valueStyle={{ color: '#52c41a' }}
                formatter={v => Number(v).toLocaleString('vi-VN')}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Tổng chi"
                value={Number(data.tong_chi)}
                suffix="đ"
                valueStyle={{ color: '#ff4d4f' }}
                formatter={v => Number(v).toLocaleString('vi-VN')}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Số dư cuối kỳ"
                value={Number(data.so_du_cuoi)}
                suffix="đ"
                valueStyle={{ color: Number(data.so_du_cuoi) >= 0 ? '#1677ff' : '#ff4d4f', fontWeight: 700 }}
                formatter={v => Number(v).toLocaleString('vi-VN')}
              />
            </Col>
          </Row>

          <Table
                        locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
                        rowKey="so_chung_tu"
            columns={displayColumns}
            dataSource={data.entries}
            loading={isLoading}
            pagination={false}
            size="small"
            scroll={{ x: 900 }}
            summary={() => (
              <Table.Summary.Row style={{ background: '#f5f5f5', fontWeight: 700 }}>
                <Table.Summary.Cell index={0} colSpan={4}>Cộng phát sinh</Table.Summary.Cell>
                <Table.Summary.Cell index={1} />
                <Table.Summary.Cell index={2} align="right">
                  <Text type="success">{Number(data.tong_thu).toLocaleString('vi-VN')}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right">
                  <Text type="danger">{Number(data.tong_chi).toLocaleString('vi-VN')}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right">
                  <Text strong style={{ color: '#1677ff' }}>
                    {Number(data.so_du_cuoi).toLocaleString('vi-VN')}
                  </Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            )}
          />
        </>
      )}
    </Card>
  )
}
