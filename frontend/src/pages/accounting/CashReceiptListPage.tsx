import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHotkey } from '../../hooks/useHotkey'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Dropdown,
  Row, Select, Space, Table, Tag, Typography, message,
} from 'antd'
import {
  PlusOutlined, FileExcelOutlined, DownOutlined,
  UploadOutlined, SwapOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { MenuProps } from 'antd'
import dayjs from 'dayjs'
import { exportToExcel, fmtVND } from '../../utils/exportUtils'
import {
  receiptApi, TRANG_THAI_PHIEU_THU, HINH_THUC_TT, CashReceipt,
} from '../../api/accounting'
import { usePhapNhan, usePhanXuong } from '../../hooks/useMasterData'
import EmptyState from '../../components/EmptyState'
import PageLayout from '../../components/PageLayout'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'

const { Text } = Typography
const { RangePicker } = DatePicker

export default function CashReceiptListPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { phapNhanList } = usePhapNhan()
  const { phanXuongList } = usePhanXuong()
  const [tuNgay, setTuNgay] = useState<string | undefined>()
  const [denNgay, setDenNgay] = useState<string | undefined>()
  const [filterTrangThai, setFilterTrangThai] = useState<string | undefined>()
  const [filterPhapNhan, setFilterPhapNhan] = useState<number | undefined>()
  const [filterPhanXuong, setFilterPhanXuong] = useState<number | undefined>()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['receipts', tuNgay, denNgay, filterTrangThai, filterPhapNhan, filterPhanXuong, page],
    queryFn: () =>
      receiptApi.list({ tu_ngay: tuNgay, den_ngay: denNgay, trang_thai: filterTrangThai, phap_nhan_id: filterPhapNhan, phan_xuong_id: filterPhanXuong, page, page_size: 20 }),
  })

  const receipts: CashReceipt[] = data?.items ?? data ?? []
  const total: number = data?.total ?? receipts.length
  const tongSoTien = receipts.reduce((s: number, r: CashReceipt) => s + (r.so_tien ?? 0), 0)

  const handleExcel = () => {
    const rows = receipts.map((r: CashReceipt, i: number) => ({
      'STT': i + 1,
      'Ngày hạch toán': r.ngay_phieu,
      'Ngày chứng từ': r.ngay_phieu,
      'Số chứng từ': r.so_phieu,
      'Diễn giải': r.dien_giai ?? '',
      'Số tiền': r.so_tien,
      'Đối tượng': r.ten_don_vi ?? `KH#${r.customer_id}`,
      'Số tài khoản NH': r.so_tai_khoan ?? '',
      'Lý do thu': r.dien_giai ?? '',
      'Loại chứng từ': HINH_THUC_TT[r.hinh_thuc_tt] ?? r.hinh_thuc_tt,
    }))
    exportToExcel(`phieu-thu-${dayjs().format('YYYYMMDD')}`, [{
      name: 'Phieu thu',
      headers: Object.keys(rows[0] ?? {}),
      rows: rows.map((r: Record<string, string | number>) => Object.values(r)),
    }])
  }

  useHotkey('ctrl+n', () => navigate('/accounting/receipts/new'), 'Tạo phiếu thu mới')

  const createMenuItems: MenuProps['items'] = [
    {
      key: 'basic',
      label: 'Thu tiền',
      onClick: () => navigate('/accounting/receipts/new'),
    },
    {
      key: 'by_invoice',
      label: 'Thu tiền theo hóa đơn',
      onClick: () => navigate('/accounting/receipts/by-invoice'),
    },
    {
      key: 'batch',
      label: 'Thu tiền theo hóa đơn nhiều khách hàng',
      onClick: () => navigate('/accounting/receipts/batch'),
    },
    { type: 'divider' },
    {
      key: 'internal',
      icon: <SwapOutlined />,
      label: 'Chuyển tiền nội bộ',
      onClick: () => navigate('/accounting/internal-transfers/new'),
    },
    {
      key: 'import',
      icon: <UploadOutlined />,
      label: 'Nhập từ Excel',
      onClick: () => navigate('/accounting/excel-import?type=receipt'),
    },
  ]

  const columns: ColumnsType<CashReceipt> = [
    {
      title: 'STT',
      width: 52,
      align: 'center' as const,
      render: (_v, _r, index) => (page - 1) * 20 + index + 1,
    },
    {
      title: 'Ngày hạch toán',
      dataIndex: 'ngay_phieu',
      width: 130,
      render: v => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Số chứng từ',
      dataIndex: 'so_phieu',
      width: 155,
      render: (v, r) => <a onClick={() => navigate(`/accounting/receipts/${r.id}`)}>{v}</a>,
    },
    {
      title: 'Đối tượng',
      dataIndex: 'ten_don_vi',
      ellipsis: true,
      render: (v, r) => v ?? `KH#${r.customer_id}`,
    },
    {
      title: 'Diễn giải',
      dataIndex: 'dien_giai',
      ellipsis: true,
      render: v => v ?? '—',
    },
    {
      title: 'Số tiền',
      dataIndex: 'so_tien',
      align: 'right' as const,
      width: 140,
      render: v => fmtVND(v),
    },
    {
      title: 'Pháp nhân',
      dataIndex: 'ten_phap_nhan',
      width: 130,
      ellipsis: true,
      render: v => v ?? '—',
    },
    {
      title: 'Xưởng',
      dataIndex: 'ten_phan_xuong',
      width: 120,
      ellipsis: true,
      render: v => v ?? '—',
    },
    {
      title: 'Số TK NH',
      dataIndex: 'so_tai_khoan',
      width: 130,
      render: v => v ?? '—',
    },
    {
      title: 'Loại chứng từ',
      dataIndex: 'hinh_thuc_tt',
      width: 120,
      render: v => HINH_THUC_TT[v] ?? v,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 110,
      render: v => {
        const s = TRANG_THAI_PHIEU_THU[v]
        return <Tag color={s?.color}>{s?.label ?? v}</Tag>
      },
    },
  ]
  const { displayColumns, settingsButton } = useColumnPrefs('accounting-cash-receipt', columns, { nonHideable: ['so_phieu'] })

  return (
    <PageLayout
      title="Phiếu thu"
      actions={
        <Space>
          <Button icon={<FileExcelOutlined />} onClick={handleExcel}>Excel</Button>
          <Dropdown menu={{ items: createMenuItems }} trigger={['click']}>
            <Button type="primary" icon={<PlusOutlined />}>
              Thu tiền <DownOutlined />
            </Button>
          </Dropdown>
          {settingsButton}
        </Space>
      }
    >
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[12, 8]} align="middle">
          <Col>
            <RangePicker
              format="DD/MM/YYYY"
              placeholder={['Từ ngày', 'Đến ngày']}
              onChange={v => {
                setTuNgay(v?.[0]?.format('YYYY-MM-DD'))
                setDenNgay(v?.[1]?.format('YYYY-MM-DD'))
                setPage(1)
              }}
            />
          </Col>
          <Col>
            <Select
              style={{ width: 160 }} allowClear placeholder="Trạng thái"
              onChange={v => { setFilterTrangThai(v); setPage(1) }}
              options={Object.entries(TRANG_THAI_PHIEU_THU).map(([k, v]) => ({ value: k, label: v.label }))}
            />
          </Col>
          <Col>
            <Select
              style={{ width: 180 }} allowClear placeholder="Pháp nhân"
              onChange={v => { setFilterPhapNhan(v); setPage(1) }}
              options={phapNhanList.map(p => ({ value: p.id, label: p.ten_phap_nhan }))}
            />
          </Col>
          <Col>
            <Select
              style={{ width: 160 }} allowClear placeholder="Xưởng"
              onChange={v => { setFilterPhanXuong(v); setPage(1) }}
              options={phanXuongList.map(x => ({ value: x.id, label: x.ten_xuong }))}
            />
          </Col>
        </Row>
      </Card>

      <Row style={{ marginBottom: 12 }}>
        <Col>
          <Text type="secondary">Tổng thu: </Text>
          <Text strong style={{ color: '#52c41a' }}>{fmtVND(tongSoTien)}</Text>
        </Col>
      </Row>

      <Table
        locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
        columns={displayColumns}
        dataSource={receipts}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={{
          current: page,
          total,
          pageSize: 20,
          showTotal: t => `${t} phiếu thu`,
          onChange: p => setPage(p),
        }}
      />

    </PageLayout>
  )
}
