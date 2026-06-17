import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHotkey } from '../../hooks/useHotkey'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Button, Card, Col, DatePicker, Dropdown, Form, Input,
  Modal, Row, Select, Space, Table, Tag, Typography, Upload, message,
} from 'antd'
import {
  PlusOutlined, FileExcelOutlined, DownOutlined,
  UploadOutlined, SwapOutlined, CheckCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { MenuProps } from 'antd'
import type { UploadFile } from 'antd/es/upload'
import dayjs from 'dayjs'
import { exportToExcel, fmtVND } from '../../utils/exportUtils'
import {
  receiptApi, TRANG_THAI_PHIEU_THU, HINH_THUC_TT, CashReceipt,
  BatchReceiptResponse,
} from '../../api/accounting'
import { usePhapNhan, usePhanXuong } from '../../hooks/useMasterData'
import EmptyState from '../../components/EmptyState'
import PageLayout from '../../components/PageLayout'

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

  // Excel import state
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<UploadFile | null>(null)
  const [importNgay, setImportNgay] = useState<string>(dayjs().format('YYYY-MM-DD'))
  const [importPhapNhan, setImportPhapNhan] = useState<number | undefined>()
  const [importPhanXuong, setImportPhanXuong] = useState<number | undefined>()
  const [importResult, setImportResult] = useState<BatchReceiptResponse | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['receipts', tuNgay, denNgay, filterTrangThai, filterPhapNhan, filterPhanXuong, page],
    queryFn: () =>
      receiptApi.list({ tu_ngay: tuNgay, den_ngay: denNgay, trang_thai: filterTrangThai, phap_nhan_id: filterPhapNhan, phan_xuong_id: filterPhanXuong, page, page_size: 20 }),
  })

  const receipts: CashReceipt[] = data?.items ?? data ?? []
  const total: number = data?.total ?? receipts.length
  const tongSoTien = receipts.reduce((s: number, r: CashReceipt) => s + (r.so_tien ?? 0), 0)

  const importMut = useMutation({
    mutationFn: ({ file, ngay, phapNhan, phanXuong }: { file: File; ngay: string; phapNhan?: number; phanXuong?: number }) =>
      receiptApi.importExcel(file, { ngay_phieu: ngay, phap_nhan_id: phapNhan, phan_xuong_id: phanXuong }),
    onSuccess: (result) => {
      setImportResult(result)
      qc.invalidateQueries({ queryKey: ['receipts'] })
      if (result.that_bai === 0) {
        message.success(`Import thành công ${result.thanh_cong} phiếu thu`)
      } else {
        message.warning(`Import ${result.thanh_cong} thành công, ${result.that_bai} lỗi`)
      }
    },
    onError: () => message.error('Import thất bại'),
  })

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

  const handleDownloadTemplate = async () => {
    try {
      const blob = await receiptApi.downloadTemplate()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'mau_import_phieu_thu.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      message.error('Không tải được mẫu Excel')
    }
  }

  const handleImportSubmit = () => {
    if (!importFile?.originFileObj) {
      message.error('Chọn file Excel trước')
      return
    }
    setImportResult(null)
    importMut.mutate({ file: importFile.originFileObj, ngay: importNgay, phapNhan: importPhapNhan, phanXuong: importPhanXuong })
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
        columns={columns}
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

      {/* Modal nhập từ Excel */}
      <Modal
        title="Nhập phiếu thu từ Excel"
        open={importOpen}
        onCancel={() => { setImportOpen(false); setImportResult(null) }}
        footer={null}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <Alert
            type="info"
            showIcon
            message="Cột Excel theo mẫu chuẩn"
            description={
              <div>
                <div style={{ marginBottom: 6 }}>
                  Bắt buộc: <b>Doi tuong</b> (mã KH), <b>So tien</b>.
                  Tùy chọn: Ngay hach toan, Dien giai, So tai khoan NH, Ly do thu, Loai chung tu (TM/CK).
                </div>
                <Button size="small" icon={<FileExcelOutlined />} onClick={handleDownloadTemplate}>
                  Tải mẫu Excel
                </Button>
              </div>
            }
          />
        </div>

        <Form layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Ngày phiếu">
                <DatePicker
                  style={{ width: '100%' }}
                  format="DD/MM/YYYY"
                  defaultValue={dayjs()}
                  onChange={v => setImportNgay(v?.format('YYYY-MM-DD') ?? dayjs().format('YYYY-MM-DD'))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Pháp nhân">
                <Select
                  allowClear
                  placeholder="Chọn pháp nhân"
                  onChange={v => setImportPhapNhan(v)}
                  options={phapNhanList.map(p => ({ value: p.id, label: p.ten_phap_nhan }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Xưởng" rules={[{ required: true, message: 'Chọn xưởng' }]}>
            <Select
              allowClear
              placeholder="Chọn xưởng"
              onChange={v => setImportPhanXuong(v)}
              options={phanXuongList.map(x => ({ value: x.id, label: x.ten_xuong }))}
            />
          </Form.Item>

          <Form.Item label="File Excel (.xlsx)">
            <Upload
              accept=".xlsx,.xls"
              maxCount={1}
              beforeUpload={() => false}
              onChange={({ fileList }) => setImportFile(fileList[0] ?? null)}
            >
              <Button icon={<UploadOutlined />}>Chọn file</Button>
            </Upload>
          </Form.Item>

          <div style={{ textAlign: 'right', marginBottom: importResult ? 16 : 0 }}>
            <Space>
              <Button onClick={() => { setImportOpen(false); setImportResult(null) }}>Đóng</Button>
              <Button
                type="primary"
                loading={importMut.isPending}
                disabled={!importFile}
                onClick={handleImportSubmit}
              >
                Import
              </Button>
            </Space>
          </div>
        </Form>

        {importResult && (
          <div style={{ marginTop: 16 }}>
            <Alert
              type={importResult.that_bai === 0 ? 'success' : 'warning'}
              message={`Kết quả: ${importResult.thanh_cong}/${importResult.tong_so} thành công`}
              showIcon
            />
            {importResult.items.length > 0 && (
              <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 8 }}>
                {importResult.items.map(item => (
                  <div key={item.index} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '3px 0' }}>
                    {item.success
                      ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                    }
                    <Text style={{ fontSize: 12 }}>
                      {item.success
                        ? `${item.so_phieu} — ${fmtVND(item.so_tien)}`
                        : item.error
                      }
                    </Text>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </PageLayout>
  )
}
