import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Card, DatePicker, Select, Space, Table, Tag, Typography,
} from 'antd'
import { FileExcelOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { customerRefundApi, CustomerRefundVoucher, TRANG_THAI_HOAN_TIEN } from '../../api/accounting'
import { exportToExcel, fmtVND } from '../../utils/exportUtils'

const { Title } = Typography
const { RangePicker } = DatePicker

const HINH_THUC_LABELS: Record<string, string> = {
  bu_tru:    'Bù trừ CN',
  hoan_tien: 'Hoàn tiền',
}

export default function CustomerRefundListPage() {
  const navigate = useNavigate()
  const [trangThai, setTrangThai] = useState<string | undefined>()
  const [tuNgay, setTuNgay] = useState<string | undefined>()
  const [denNgay, setDenNgay] = useState<string | undefined>()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['customer-refunds', trangThai, tuNgay, denNgay, page],
    queryFn: () => customerRefundApi.list({
      trang_thai: trangThai || undefined,
      tu_ngay: tuNgay || undefined,
      den_ngay: denNgay || undefined,
      page,
      page_size: 20,
    }),
  })

  const columns: ColumnsType<CustomerRefundVoucher> = [
    {
      title: 'Số phiếu',
      dataIndex: 'so_phieu',
      width: 140,
      render: (v, r) => <a onClick={() => navigate(`/accounting/customer-refunds/${r.id}`)}>{v}</a>,
    },
    {
      title: 'Ngày',
      dataIndex: 'ngay',
      width: 100,
      render: v => dayjs(v).format('DD/MM/YYYY'),
    },
    { title: 'Khách hàng', dataIndex: 'ten_khach_hang', ellipsis: true },
    {
      title: 'Phiếu trả hàng',
      dataIndex: 'so_phieu_tra',
      width: 130,
      render: (v, r) => v
        ? <a onClick={() => navigate(`/sales/returns/${r.sales_return_id}`)}>{v}</a>
        : '—',
    },
    {
      title: 'Số tiền',
      dataIndex: 'so_tien',
      width: 140,
      align: 'right',
      render: v => fmtVND(v),
    },
    {
      title: 'Hình thức',
      dataIndex: 'hinh_thuc',
      width: 110,
      render: v => v ? HINH_THUC_LABELS[v] ?? v : <Tag>Chưa chọn</Tag>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 110,
      render: v => {
        const t = TRANG_THAI_HOAN_TIEN[v] ?? { label: v, color: 'default' }
        return <Tag color={t.color}>{t.label}</Tag>
      },
    },
  ]

  const rows = data?.items ?? []

  const handleExportExcel = () => {
    exportToExcel(`HoanTienKhachHang_${dayjs().format('YYYYMMDD')}`, [{
      name: 'Phiếu hoàn tiền',
      headers: ['Số phiếu', 'Ngày', 'Khách hàng', 'Phiếu trả hàng', 'Số tiền (đ)', 'Hình thức', 'Trạng thái'],
      rows: rows.map((r: CustomerRefundVoucher) => [
        r.so_phieu,
        dayjs(r.ngay).format('DD/MM/YYYY'),
        r.ten_khach_hang,
        r.so_phieu_tra || '',
        r.so_tien,
        r.hinh_thuc ? (HINH_THUC_LABELS[r.hinh_thuc] ?? r.hinh_thuc) : '',
        TRANG_THAI_HOAN_TIEN[r.trang_thai]?.label ?? r.trang_thai,
      ]),
      colWidths: [18, 12, 25, 16, 18, 14, 14],
    }])
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Phiếu hoàn tiền khách hàng</Title>
        <Button icon={<FileExcelOutlined />} style={{ color: '#217346', borderColor: '#217346' }} onClick={handleExportExcel}>
          Xuất Excel
        </Button>
      </div>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <RangePicker
            format="DD/MM/YYYY"
            onChange={v => {
              setTuNgay(v?.[0]?.format('YYYY-MM-DD'))
              setDenNgay(v?.[1]?.format('YYYY-MM-DD'))
              setPage(1)
            }}
          />
          <Select
            style={{ width: 150 }}
            placeholder="Trạng thái"
            allowClear
            value={trangThai}
            onChange={v => { setTrangThai(v); setPage(1) }}
            options={Object.entries(TRANG_THAI_HOAN_TIEN).map(([k, v]) => ({ value: k, label: v.label }))}
          />
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={rows}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={{
          current: page,
          total: data?.total ?? 0,
          pageSize: 20,
          showTotal: t => `${t} phiếu`,
          onChange: p => setPage(p),
        }}
        onRow={r => ({ onClick: () => navigate(`/accounting/customer-refunds/${r.id}`) })}
        rowClassName={r => r.trang_thai === 'nhap' ? '' : ''}
      />
    </div>
  )
}
