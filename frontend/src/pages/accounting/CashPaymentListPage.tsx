import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHotkey } from '../../hooks/useHotkey'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Alert, Button, Card, Col, DatePicker, Dropdown, Form, Modal,
  Row, Select, Space, Table, Tag, Typography, Upload, message,
} from 'antd'
import type { MenuProps } from 'antd'
import {
  BankOutlined, CarOutlined, CheckCircleOutlined, CloseCircleOutlined,
  DownOutlined, FileExcelOutlined, PlusOutlined, SafetyCertificateOutlined,
  SwapOutlined, TeamOutlined, UploadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { RcFile } from 'antd/es/upload'
import dayjs from 'dayjs'
import { exportToExcel, fmtVND } from '../../utils/exportUtils'
import { paymentApi, CashPayment, BatchReceiptResultItem } from '../../api/accounting'
import { usePhapNhan } from '../../hooks/useMasterData'
import EmptyState from "../../components/EmptyState"
import PageLayout from '../../components/PageLayout'

const { Text } = Typography
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
  const [importModal, setImportModal] = useState(false)
  const [importFile, setImportFile] = useState<RcFile | null>(null)
  const [importNgay, setImportNgay] = useState<string | undefined>()
  const [importPhapNhan, setImportPhapNhan] = useState<number | undefined>()
  const [importResults, setImportResults] = useState<BatchReceiptResultItem[] | null>(null)

  const importMut = useMutation({
    mutationFn: () => {
      const f = importFile
      if (!f) throw new Error('Chưa chọn file')
      return paymentApi.importExcel(f, { ngay_phieu: importNgay, phap_nhan_id: importPhapNhan })
    },
    onSuccess: r => setImportResults(r.data?.items ?? []),
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e?.response?.data?.detail ?? 'Lỗi import'),
  })

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

  const payments: CashPayment[] = data?.items ?? data ?? []
  const total: number = data?.total ?? payments.length
  const tongSoTien = payments.reduce((s: number, r: CashPayment) => s + (r.so_tien ?? 0), 0)

  const handleExcel = () => {
    const rows = payments.map((r: CashPayment) => ({
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

  useHotkey('ctrl+n', () => navigate('/accounting/payments/new'), 'Tạo phiếu chi mới')

  const menuItems: MenuProps['items'] = [
    {
      key: 'basic',
      icon: <PlusOutlined />,
      label: 'Chi tiền',
      onClick: () => navigate('/accounting/payments/new'),
    },
    {
      key: 'by_invoice',
      icon: <BankOutlined />,
      label: 'Trả tiền theo hóa đơn',
      onClick: () => navigate('/accounting/payments/new?mode=by_invoice'),
    },
    {
      key: 'tax',
      icon: <SafetyCertificateOutlined />,
      label: 'Nộp thuế',
      onClick: () => navigate('/accounting/payments/new?type=tax'),
    },
    {
      key: 'insurance',
      icon: <CarOutlined />,
      label: 'Nộp bảo hiểm',
      onClick: () => navigate('/accounting/payments/new?type=insurance'),
    },
    {
      key: 'salary',
      icon: <TeamOutlined />,
      label: 'Trả lương',
      onClick: () => navigate('/accounting/payments/new?type=salary'),
    },
    { type: 'divider' },
    {
      key: 'transfer',
      icon: <SwapOutlined />,
      label: 'Chuyển tiền nội bộ',
      onClick: () => navigate('/accounting/internal-transfers/new'),
    },
    {
      key: 'excel',
      icon: <UploadOutlined />,
      label: 'Nhập từ Excel',
      onClick: () => setImportModal(true),
    },
  ]

  const columns: ColumnsType<CashPayment> = [
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
    <>
    <PageLayout
      title="Phiếu chi nhà cung cấp"
      actions={
        <Space>
          <Button icon={<FileExcelOutlined />} onClick={handleExcel}>Excel</Button>
          <Dropdown menu={{ items: menuItems }} trigger={['click']}>
            <Button type="primary" icon={<PlusOutlined />}>
              Tạo phiếu chi <DownOutlined />
            </Button>
          </Dropdown>
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
              options={phapNhanList.map((p) => ({ value: p.id, label: p.ten_phap_nhan }))}
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
                locale={{ emptyText: <EmptyState size="small" preset="document" /> }}
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
    </PageLayout>

    <Modal
      title="Nhập phiếu chi từ Excel"
      open={importModal}
      onCancel={() => { setImportModal(false); setImportFile(null); setImportResults(null) }}
      footer={importResults ? (
        <Button onClick={() => { setImportModal(false); setImportFile(null); setImportResults(null) }}>Đóng</Button>
      ) : [
        <Button key="cancel" onClick={() => setImportModal(false)}>Hủy</Button>,
        <Button key="ok" type="primary" loading={importMut.isPending} disabled={!importFile} onClick={() => importMut.mutate()}>
          Import
        </Button>,
      ]}
      width={560}
    >
      {!importResults ? (
        <>
          <Alert
            type="info"
            style={{ marginBottom: 16 }}
            message="Cột bắt buộc: ma_ncc (hoặc supplier_id), so_tien. Tùy chọn: hinh_thuc_tt, dien_giai, so_tham_chieu"
          />
          <Form layout="vertical">
            <Form.Item label="Ngày phiếu (mặc định hôm nay)">
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} onChange={d => setImportNgay(d?.format('YYYY-MM-DD'))} />
            </Form.Item>
            <Form.Item label="Pháp nhân">
              <Select
                allowClear placeholder="Chọn pháp nhân"
                onChange={(v: number) => setImportPhapNhan(v)}
                options={phapNhanList.map(p => ({ value: p.id, label: p.ten_phap_nhan }))}
              />
            </Form.Item>
            <Form.Item label="File Excel (.xlsx)">
              <Upload
                accept=".xlsx"
                maxCount={1}
                beforeUpload={f => { setImportFile(f); return false }}
                onRemove={() => setImportFile(null)}
              >
                <Button icon={<UploadOutlined />}>Chọn file</Button>
              </Upload>
            </Form.Item>
          </Form>
        </>
      ) : (
        <div>
          <div style={{ marginBottom: 12 }}>
            <Text strong>Kết quả: </Text>
            <Text style={{ color: '#52c41a' }}>{importResults.filter(r => r.success).length} thành công</Text>
            {' / '}
            <Text style={{ color: '#f5222d' }}>{importResults.filter(r => !r.success).length} lỗi</Text>
          </div>
          {importResults.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {r.success
                ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
                : <CloseCircleOutlined style={{ color: '#f5222d' }} />}
              <Text style={{ fontSize: 13 }}>
                {r.success ? `${r.so_phieu} — ${fmtVND(r.so_tien)}` : r.error}
              </Text>
            </div>
          ))}
        </div>
      )}
    </Modal>
    </>
  )
}
