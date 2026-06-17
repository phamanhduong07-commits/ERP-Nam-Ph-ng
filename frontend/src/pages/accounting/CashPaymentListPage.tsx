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
import { usePhapNhan, usePhanXuong } from '../../hooks/useMasterData'
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
  const { phanXuongList } = usePhanXuong()
  const [tuNgay, setTuNgay] = useState<string | undefined>()
  const [denNgay, setDenNgay] = useState<string | undefined>()
  const [filterTrangThai, setFilterTrangThai] = useState<string | undefined>()
  const [filterPhapNhan, setFilterPhapNhan] = useState<number | undefined>()
  const [filterPhanXuong, setFilterPhanXuong] = useState<number | undefined>()
  const [page, setPage] = useState(1)
  const [importModal, setImportModal] = useState(false)
  const [importFile, setImportFile] = useState<RcFile | null>(null)
  const [importNgay, setImportNgay] = useState<string | undefined>()
  const [importPhapNhan, setImportPhapNhan] = useState<number | undefined>()
  const [importPhanXuong, setImportPhanXuong] = useState<number | undefined>()
  const [importResults, setImportResults] = useState<BatchReceiptResultItem[] | null>(null)

  const importMut = useMutation({
    mutationFn: () => {
      const f = importFile
      if (!f) throw new Error('Chưa chọn file')
      return paymentApi.importExcel(f, { ngay_phieu: importNgay, phap_nhan_id: importPhapNhan, phan_xuong_id: importPhanXuong })
    },
    onSuccess: r => setImportResults(r.data?.items ?? []),
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error(e?.response?.data?.detail ?? 'Lỗi import'),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['payments', tuNgay, denNgay, filterTrangThai, filterPhapNhan, filterPhanXuong, page],
    queryFn: () =>
      paymentApi.list({
        tu_ngay: tuNgay,
        den_ngay: denNgay,
        trang_thai: filterTrangThai,
        phap_nhan_id: filterPhapNhan,
        phan_xuong_id: filterPhanXuong,
        page,
        page_size: 20,
      }),
  })

  const payments: CashPayment[] = data?.items ?? data ?? []
  const total: number = data?.total ?? payments.length
  const tongSoTien = payments.reduce((s: number, r: CashPayment) => s + (r.so_tien ?? 0), 0)

  const handleExcel = () => {
    const rows = payments.map((r: CashPayment, i: number) => ({
      'STT': i + 1,
      'Ngày hạch toán': r.ngay_phieu,
      'Ngày chứng từ': r.ngay_phieu,
      'Số chứng từ': r.so_phieu,
      'Diễn giải': r.dien_giai ?? '',
      'Số tiền': r.so_tien,
      'Đối tượng': r.ten_don_vi ?? `NCC#${r.supplier_id}`,
      'Số tài khoản NH': r.so_tai_khoan ?? '',
      'Lý do chi': r.dien_giai ?? '',
      'Loại chứng từ': HINH_THUC_TT_LABEL[r.hinh_thuc_tt] ?? r.hinh_thuc_tt,
    }))
    exportToExcel(`phieu-chi-${dayjs().format('YYYYMMDD')}`, [{
      name: 'Phieu chi',
      headers: Object.keys(rows[0] ?? {}),
      rows: rows.map((r: Record<string, string | number>) => Object.values(r)),
    }])
  }

  const handleDownloadTemplate = async () => {
    try {
      const blob = await paymentApi.downloadTemplate()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'mau_import_phieu_chi.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      message.error('Không tải được mẫu Excel')
    }
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
      onClick: () => navigate('/accounting/tax-payments/new'),
    },
    {
      key: 'insurance',
      icon: <CarOutlined />,
      label: 'Nộp bảo hiểm',
      onClick: () => navigate('/accounting/insurance-payments/new'),
    },
    {
      key: 'salary',
      icon: <TeamOutlined />,
      label: 'Trả lương',
      onClick: () => navigate('/accounting/salary-payments/new'),
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
      onClick: () => navigate('/accounting/excel-import?type=payment'),
    },
  ]

  const columns: ColumnsType<CashPayment> = [
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
      render: (v, r) => <a onClick={() => navigate(`/accounting/payments/${r.id}`)}>{v}</a>,
    },
    {
      title: 'Đối tượng',
      dataIndex: 'ten_don_vi',
      ellipsis: true,
      render: (v, r) => v ?? `NCC#${r.supplier_id}`,
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
      render: v => HINH_THUC_TT_LABEL[v] ?? v,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      width: 110,
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
          <Col>
            <Select
              style={{ width: 160 }}
              allowClear
              placeholder="Xưởng"
              onChange={v => { setFilterPhanXuong(v); setPage(1) }}
              options={phanXuongList.map(x => ({ value: x.id, label: x.ten_xuong }))}
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
            showIcon
            message="Cột Excel theo mẫu chuẩn"
            description={
              <div>
                <div style={{ marginBottom: 6 }}>
                  Bắt buộc: <b>Doi tuong</b> (mã NCC), <b>So tien</b>.
                  Tùy chọn: Ngay hach toan, Dien giai, So tai khoan NH, Ly do chi, Loai chung tu (TM/CK).
                </div>
                <Button size="small" icon={<FileExcelOutlined />} onClick={handleDownloadTemplate}>
                  Tải mẫu Excel
                </Button>
              </div>
            }
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
            <Form.Item label="Xưởng" rules={[{ required: true, message: 'Chọn xưởng' }]}>
              <Select
                allowClear placeholder="Chọn xưởng"
                onChange={(v: number) => setImportPhanXuong(v)}
                options={phanXuongList.map(x => ({ value: x.id, label: x.ten_xuong }))}
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
