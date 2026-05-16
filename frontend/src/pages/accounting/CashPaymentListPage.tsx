import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Card, Col, DatePicker, Row, Select, Space, Table, Tag, Typography,
} from 'antd'
import { FileExcelOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { exportToExcel, fmtVND } from '../../utils/exportUtils'
import { paymentApi } from '../../api/accounting'
import { usePhapNhan } from '../../hooks/useMasterData'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const HINH_THUC_TT_LABEL: Record<string, string> = {
  tien_mat: 'Tiền mặt',
  TM: 'Tiền mặt',
  chuyen_khoan: 'Chuyển khoản',
  CK: 'Chuyển khoản',
  bu_tru_cong_no: 'Bù trừ công nợ',
  khac: 'Khác',
}

const PAYMENT_STATUS: Record<string, { label: string; color: string }> = {
  cho_chot: { label: 'Chờ chốt', color: 'default' },
  da_chot: { label: 'Đã chốt', color: 'orange' },
  da_duyet: { label: 'Đã duyệt', color: 'green' },
  huy: { label: 'Đã hủy', color: 'default' },
}

export default function CashPaymentListPage() {
  const navigate = useNavigate()
  const { phapNhanList } = usePhapNhan()
  const [tuNgay, setTuNgay] = useState<string | undefined>()
  const [denNgay, setDenNgay] = useState<string | undefined>()
  const [filterTrangThai, setFilterTrangThai] = useState<string | undefined>()
  const [filterPhapNhan, setFilterPhapNhan] = useState<number | undefined>()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['payments', tuNgay, denNgay, filterTrangThai, filterPhapNhan, page],
    queryFn: () =>
      paymentApi.list({
        tu_ngay: tuNgay,
        den_ngay: denNgay,
        trang_thai: filterTrangThai,
        phap_nhan_id: filterPhapNhan,
        page,
        page_size: 20,
      }),
  })

  const payments = data?.items ?? data ?? []
  const total: number = data?.total ?? payments.length
  const tongSoTien = payments.reduce((s: number, r: any) => s + (r.so_tien ?? 0), 0)

  const handleExcel = () => {
    const rows = payments.map((r: any) => ({
      'Số phiếu': r.so_phieu,
      'Ngày phiếu': r.ngay_phieu,
      'Nhà cung cấp': r.ten_don_vi ?? r.supplier_id,
      'Hóa đơn mua': r.so_hoa_don ?? r.purchase_invoice_id ?? '',
      'Hình thức TT': HINH_THUC_TT_LABEL[r.hinh_thuc_tt] ?? r.hinh_thuc_tt,
      'Số tiền': r.so_tien,
      'Trạng thái': PAYMENT_STATUS[r.trang_thai]?.label ?? r.trang_thai,
    }))
    exportToExcel(`phieu-chi-${dayjs().format('YYYYMMDD')}`, [{
      name: 'Phieu chi',
      headers: Object.keys(rows[0] ?? {}),
      rows: rows.map((r: Record<string, string | number>) => Object.values(r)),
    }])
  }

  const columns: ColumnsType<any> = [
    {
      title: 'Số phiếu',
      dataIndex: 'so_phieu',
      width: 160,
      render: (v, r) => <a onClick={() => navigate(`/accounting/payments/${r.id}`)}>{v}</a>,
    },
    {
      title: 'Ngày phiếu',
      dataIndex: 'ngay_phieu',
      width: 110,
      render: v => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Nhà cung cấp',
      dataIndex: 'ten_don_vi',
      ellipsis: true,
      render: (v, r) => v ?? `NCC #${r.supplier_id}`,
    },
    {
      title: 'HĐ mua',
      dataIndex: 'so_hoa_don',
      width: 150,
      render: (v, r) =>
        r.purchase_invoice_id ? (
          <a onClick={() => navigate(`/accounting/purchase-invoices/${r.purchase_invoice_id}`)}>
            {v ?? `HĐ #${r.purchase_invoice_id}`}
          </a>
        ) : '-',
    },
    {
      title: 'Hình thức TT',
      dataIndex: 'hinh_thuc_tt',
      width: 130,
      render: v => HINH_THUC_TT_LABEL[v] ?? v,
    },
    {
      title: 'Số tiền',
      dataIndex: 'so_tien',
      align: 'right',
      width: 150,
      render: v => fmtVND(v),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 130,
      render: v => {
        const s = PAYMENT_STATUS[v]
        return <Tag color={s?.color}>{s?.label ?? v}</Tag>
      },
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Phiếu chi nhà cung cấp</Title>
        <Space>
          <Button icon={<FileExcelOutlined />} onClick={handleExcel}>Excel</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/accounting/payments/new')}>
            Tạo phiếu chi
          </Button>
        </Space>
      </div>

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
              style={{ width: 160 }}
              allowClear
              placeholder="Trạng thái"
              onChange={v => { setFilterTrangThai(v); setPage(1) }}
              options={Object.entries(PAYMENT_STATUS).map(([k, v]) => ({ value: k, label: v.label }))}
            />
          </Col>
          <Col>
            <Select
              style={{ width: 180 }}
              allowClear
              placeholder="Pháp nhân"
              onChange={v => { setFilterPhapNhan(v); setPage(1) }}
              options={phapNhanList.map((p: any) => ({ value: p.id, label: p.ten_phap_nhan }))}
            />
          </Col>
        </Row>
      </Card>

      <Row style={{ marginBottom: 12 }}>
        <Col>
          <Text type="secondary">Tổng chi: </Text>
          <Text strong style={{ color: '#f5222d' }}>{fmtVND(tongSoTien)}</Text>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={payments}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={{
          current: page,
          total,
          pageSize: 20,
          showTotal: t => `${t} phiếu chi`,
          onChange: p => setPage(p),
        }}
      />
    </div>
  )
}
