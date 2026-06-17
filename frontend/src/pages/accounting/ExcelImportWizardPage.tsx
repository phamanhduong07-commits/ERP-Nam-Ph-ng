import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Steps,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { RcFile, UploadProps } from 'antd/es/upload'
import {
  CloudUploadOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  InboxOutlined,
} from '@ant-design/icons'
import axios from 'axios'
import type { AxiosResponse } from 'axios'
import dayjs from 'dayjs'
import { useNavigate, useSearchParams } from 'react-router-dom'

import PageLayout from '../../components/PageLayout'
import { usePhapNhan, usePhanXuong } from '../../hooks/useMasterData'
import { fmtVND } from '../../utils/exportUtils'

const { Dragger } = Upload
const { Text, Title, Paragraph } = Typography

// ─── Types ──────────────────────────────────────────────────────────────────

type ImportType = 'receipt' | 'payment'

interface ImportResultItem {
  index: number
  customer_id?: number
  supplier_id?: number
  so_phieu: string | null
  so_tien: number
  success: boolean
  error: string | null
}

interface ImportResponse {
  tong_so: number
  thanh_cong: number
  that_bai: number
  items: ImportResultItem[]
}

interface ImportParams {
  ngay_phieu?: string
  phap_nhan_id?: number
  phan_xuong_id?: number
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 20 * 1024 * 1024 // 20MB
const MAX_ROWS = 500
const DATE_FORMAT = 'YYYY-MM-DD'

/** Map import type → display label + API resource segment. */
const TYPE_META: Record<ImportType, { label: string; resource: 'receipts' | 'payments'; listPath: string }> = {
  receipt: { label: 'Phiếu thu', resource: 'receipts', listPath: '/accounting/receipts' },
  payment: { label: 'Phiếu chi', resource: 'payments', listPath: '/accounting/payments' },
}

/** Normalize the URL ?type= param to a valid ImportType, defaulting to payment. */
function parseImportType(raw: string | null): ImportType {
  return raw === 'receipt' ? 'receipt' : 'payment'
}

/** Read the JWT the project stores under localStorage 'token'. */
function getToken(): string {
  return typeof window !== 'undefined' ? localStorage.getItem('token') ?? '' : ''
}

/** Build a multipart FormData carrying the Excel file under the `file` field. */
function buildFormData(file: File): FormData {
  const fd = new FormData()
  fd.append('file', file)
  return fd
}

// ─── API ────────────────────────────────────────────────────────────────────

const importApi = {
  preview: (type: ImportType, file: File, params: ImportParams): Promise<AxiosResponse<ImportResponse>> =>
    axios.post<ImportResponse>(
      `/api/accounting/${TYPE_META[type].resource}/import-excel`,
      buildFormData(file),
      { params: { ...params, dry_run: true }, headers: { Authorization: `Bearer ${getToken()}` } },
    ),
  commit: (type: ImportType, file: File, params: ImportParams): Promise<AxiosResponse<ImportResponse>> =>
    axios.post<ImportResponse>(
      `/api/accounting/${TYPE_META[type].resource}/import-excel`,
      buildFormData(file),
      { params: { ...params, dry_run: false }, headers: { Authorization: `Bearer ${getToken()}` } },
    ),
  downloadTemplate: (type: ImportType): Promise<AxiosResponse<Blob>> =>
    axios.get<Blob>(
      `/api/accounting/${TYPE_META[type].resource}/import-template`,
      { responseType: 'blob', headers: { Authorization: `Bearer ${getToken()}` } },
    ),
}

// ─── Error helper ─────────────────────────────────────────────────────────────

/** Extract a human-readable message from an axios/unknown error. */
function errText(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail
    if (typeof detail === 'string' && detail.trim()) return detail
    if (err.message) return err.message
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}

/** Trigger a browser download for a Blob template response. */
function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExcelImportWizardPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const importType = parseImportType(searchParams.get('type'))
  const meta = TYPE_META[importType]

  const { phapNhanList, isLoading: phapNhanLoading } = usePhapNhan()
  const { phanXuongList, isLoading: phanXuongLoading } = usePhanXuong()

  const [current, setCurrent] = useState<number>(0)

  // Step 1 form state
  const [file, setFile] = useState<RcFile | null>(null)
  const [ngayPhieu, setNgayPhieu] = useState<dayjs.Dayjs>(dayjs())
  const [phapNhanId, setPhapNhanId] = useState<number | undefined>(undefined)
  const [phanXuongId, setPhanXuongId] = useState<number | undefined>(undefined)

  // Step 2/3 async + result state
  const [previewing, setPreviewing] = useState<boolean>(false)
  const [committing, setCommitting] = useState<boolean>(false)
  const [previewResult, setPreviewResult] = useState<ImportResponse | null>(null)
  const [commitResult, setCommitResult] = useState<ImportResponse | null>(null)
  const [downloadingTemplate, setDownloadingTemplate] = useState<boolean>(false)

  /** Assemble the optional query params shared by preview and commit calls. */
  function currentParams(): ImportParams {
    const params: ImportParams = {}
    if (ngayPhieu) params.ngay_phieu = ngayPhieu.format(DATE_FORMAT)
    if (phapNhanId != null) params.phap_nhan_id = phapNhanId
    if (phanXuongId != null) params.phan_xuong_id = phanXuongId
    return params
  }

  // ── Step 1: file selection ──────────────────────────────────────────────────

  const draggerProps: UploadProps = {
    accept: '.xlsx,.xls',
    maxCount: 1,
    multiple: false,
    fileList: file ? [{ uid: file.uid, name: file.name, status: 'done' }] : [],
    beforeUpload: (candidate) => {
      if (candidate.size > MAX_FILE_BYTES) {
        message.error('Tệp vượt quá 20MB. Vui lòng chọn tệp nhỏ hơn.')
        return Upload.LIST_IGNORE
      }
      setFile(candidate)
      // Reset any downstream results when a new file is chosen.
      setPreviewResult(null)
      setCommitResult(null)
      return false // manual upload — never auto-POST
    },
    onRemove: () => {
      setFile(null)
      setPreviewResult(null)
      setCommitResult(null)
      return true
    },
  }

  async function handleDownloadTemplate(): Promise<void> {
    setDownloadingTemplate(true)
    try {
      const res = await importApi.downloadTemplate(importType)
      saveBlob(res.data, `mau_import_${meta.resource}.xlsx`)
      message.success('Đã tải tệp mẫu.')
    } catch (err) {
      message.error(errText(err, 'Không tải được tệp mẫu.'))
    } finally {
      setDownloadingTemplate(false)
    }
  }

  // ── Step 1 → Step 2: dry-run preview ─────────────────────────────────────────

  async function handleNext(): Promise<void> {
    if (!file) {
      message.warning('Vui lòng chọn tệp Excel trước.')
      return
    }
    setPreviewing(true)
    try {
      const res = await importApi.preview(importType, file, currentParams())
      setPreviewResult(res.data)
      setCurrent(1)
    } catch (err) {
      message.error(errText(err, 'Không kiểm tra được dữ liệu. Vui lòng thử lại.'))
    } finally {
      setPreviewing(false)
    }
  }

  // ── Step 2 → Step 3: real import ─────────────────────────────────────────────

  async function handleImport(): Promise<void> {
    if (!file) {
      message.warning('Tệp không còn khả dụng. Vui lòng chọn lại.')
      setCurrent(0)
      return
    }
    setCommitting(true)
    try {
      const res = await importApi.commit(importType, file, currentParams())
      setCommitResult(res.data)
      setCurrent(2)
      if (res.data.that_bai === 0) {
        message.success(`Đã nhập ${res.data.thanh_cong} chứng từ.`)
      } else {
        message.warning(`Nhập xong: ${res.data.thanh_cong} thành công, ${res.data.that_bai} lỗi.`)
      }
    } catch (err) {
      message.error(errText(err, 'Không nhập khẩu được. Vui lòng thử lại.'))
    } finally {
      setCommitting(false)
    }
  }

  // ── Reset back to step 1 for another import ──────────────────────────────────

  function handleReset(): void {
    setFile(null)
    setPreviewResult(null)
    setCommitResult(null)
    setNgayPhieu(dayjs())
    setPhapNhanId(undefined)
    setPhanXuongId(undefined)
    setCurrent(0)
  }

  // ── Derived counts ───────────────────────────────────────────────────────────

  const validCount = useMemo(
    () => (previewResult ? previewResult.items.filter((it) => it.success).length : 0),
    [previewResult],
  )
  const errorCount = useMemo(
    () => (previewResult ? previewResult.items.filter((it) => !it.success).length : 0),
    [previewResult],
  )

  // ── Table columns (Step 2: preview) ──────────────────────────────────────────

  const previewColumns: ColumnsType<ImportResultItem> = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center',
      render: (_value, _record, idx) => idx + 1,
    },
    {
      title: 'Dòng',
      dataIndex: 'index',
      key: 'index',
      width: 70,
      align: 'center',
    },
    {
      title: 'Đối tượng',
      key: 'doi_tuong',
      width: 120,
      render: (_value, record) => {
        if (record.customer_id != null) return `KH #${record.customer_id}`
        if (record.supplier_id != null) return `NCC #${record.supplier_id}`
        return <Text type="secondary">—</Text>
      },
    },
    {
      title: 'Số tiền',
      dataIndex: 'so_tien',
      key: 'so_tien',
      width: 140,
      align: 'right',
      render: (value: number) => fmtVND(value),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'success',
      key: 'success',
      width: 120,
      align: 'center',
      render: (success: boolean) =>
        success ? <Tag color="green">Hợp lệ</Tag> : <Tag color="red">Lỗi</Tag>,
    },
    {
      title: 'Chi tiết lỗi',
      dataIndex: 'error',
      key: 'error',
      render: (error: string | null) =>
        error ? <Text type="danger">{error}</Text> : <Text type="secondary">—</Text>,
    },
  ]

  // ── Table columns (Step 3: result) ───────────────────────────────────────────

  const resultColumns: ColumnsType<ImportResultItem> = [
    {
      title: 'Dòng',
      dataIndex: 'index',
      key: 'index',
      width: 70,
      align: 'center',
    },
    {
      title: 'Số chứng từ',
      dataIndex: 'so_phieu',
      key: 'so_phieu',
      render: (value: string | null, record) =>
        value ?? (record.success ? <Text type="secondary">—</Text> : <Text type="secondary">(không tạo)</Text>),
    },
    {
      title: 'Số tiền',
      dataIndex: 'so_tien',
      key: 'so_tien',
      width: 140,
      align: 'right',
      render: (value: number) => fmtVND(value),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'success',
      key: 'success',
      width: 160,
      align: 'center',
      render: (success: boolean, record) =>
        success ? (
          <Tag color="green">Thành công</Tag>
        ) : (
          <Tag color="red">{record.error ?? 'Lỗi'}</Tag>
        ),
    },
  ]

  /** Red background for error rows in the preview table. */
  function rowClassName(record: ImportResultItem): string {
    return record.success ? '' : 'excel-import-error-row'
  }

  // ── Render: Step 1 ────────────────────────────────────────────────────────────

  function renderStep1() {
    return (
      <Row gutter={24}>
        <Col xs={24} lg={15}>
          <Card title="Chọn tệp nguồn" bordered>
            <Space direction="vertical" size={18} style={{ width: '100%' }}>
              <div>
                <Text strong>Loại chứng từ</Text>
                <div style={{ marginTop: 4 }}>
                  <Tag color={importType === 'receipt' ? 'blue' : 'red'} style={{ fontSize: 14, padding: '4px 12px' }}>
                    {meta.label}
                  </Tag>
                </div>
              </div>

              <div>
                <Text strong>Chọn tệp Excel</Text>
                <div style={{ marginTop: 8 }}>
                  <Dragger {...draggerProps}>
                    <p className="ant-upload-drag-icon">
                      <InboxOutlined />
                    </p>
                    <p className="ant-upload-text">Kéo thả hoặc bấm để chọn tệp .xlsx / .xls</p>
                    <p className="ant-upload-hint">Tối đa 1 tệp, dung lượng dưới 20MB.</p>
                  </Dragger>
                </div>
              </div>

              <Row gutter={16}>
                <Col xs={24} sm={8}>
                  <Text strong>Ngày phiếu</Text>
                  <DatePicker
                    value={ngayPhieu}
                    onChange={(d) => setNgayPhieu(d ?? dayjs())}
                    format="DD/MM/YYYY"
                    allowClear={false}
                    style={{ width: '100%', marginTop: 6 }}
                  />
                </Col>
                <Col xs={24} sm={8}>
                  <Text strong>Pháp nhân</Text>
                  <Select
                    value={phapNhanId}
                    onChange={(v) => setPhapNhanId(v)}
                    loading={phapNhanLoading}
                    allowClear
                    placeholder="Chọn pháp nhân"
                    style={{ width: '100%', marginTop: 6 }}
                    options={phapNhanList.map((pn) => ({ value: pn.id, label: pn.ten_phap_nhan }))}
                  />
                </Col>
                <Col xs={24} sm={8}>
                  <Text strong>Xưởng</Text>
                  <Select
                    value={phanXuongId}
                    onChange={(v) => setPhanXuongId(v)}
                    loading={phanXuongLoading}
                    allowClear
                    placeholder="Chọn xưởng"
                    style={{ width: '100%', marginTop: 6 }}
                    options={phanXuongList.map((px) => ({ value: px.id, label: px.ten_xuong }))}
                  />
                </Col>
              </Row>

              <Alert type="info" showIcon message={`Mỗi lần import tối đa ${MAX_ROWS} dòng`} />

              <div style={{ textAlign: 'right' }}>
                <Button type="primary" disabled={!file} loading={previewing} onClick={handleNext}>
                  Tiếp theo →
                </Button>
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={9}>
          <Card title="Gợi ý" bordered>
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                Tải tệp mẫu để nhập dữ liệu đúng định dạng, sau đó tải tệp lên ở bên trái.
              </Paragraph>
              <Button
                icon={<DownloadOutlined />}
                loading={downloadingTemplate}
                onClick={handleDownloadTemplate}
                block
              >
                Tải tệp mẫu
              </Button>
              <Alert
                type="info"
                showIcon
                message="Lưu ý"
                description={`Hệ thống xử lý tối đa ${MAX_ROWS} dòng mỗi lần nhập. Tệp lớn hơn cần chia nhỏ.`}
              />
            </Space>
          </Card>
        </Col>
      </Row>
    )
  }

  // ── Render: Step 2 ────────────────────────────────────────────────────────────

  function renderStep2() {
    const items = previewResult?.items ?? []
    const allError = items.length > 0 && validCount === 0

    return (
      <Card title="Kiểm tra dữ liệu" bordered>
        {previewing ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin tip="Đang kiểm tra dữ liệu..." size="large" />
          </div>
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div>
              <Text strong style={{ color: '#389e0d' }}>{validCount} hàng hợp lệ</Text>
              <Text strong style={{ margin: '0 6px' }}>/</Text>
              <Text strong style={{ color: '#cf1322' }}>{errorCount} hàng lỗi</Text>
            </div>

            {allError && (
              <Alert
                type="error"
                showIcon
                message="Không có dòng nào hợp lệ — kiểm tra lại file"
              />
            )}

            <Table<ImportResultItem>
              rowKey="index"
              size="small"
              columns={previewColumns}
              dataSource={items}
              rowClassName={rowClassName}
              pagination={{ pageSize: 20, showSizeChanger: false }}
              scroll={{ x: 720 }}
            />

            <Row justify="space-between">
              <Button onClick={() => setCurrent(0)}>← Quay lại</Button>
              <Button
                type="primary"
                icon={<CloudUploadOutlined />}
                disabled={validCount === 0}
                loading={committing}
                onClick={handleImport}
              >
                Nhập khẩu ({validCount} hàng)
              </Button>
            </Row>
          </Space>
        )}
      </Card>
    )
  }

  // ── Render: Step 3 ────────────────────────────────────────────────────────────

  function renderStep3() {
    const result = commitResult

    return (
      <Card title="Kết quả" bordered>
        {committing ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin tip="Đang nhập khẩu..." size="large" />
          </div>
        ) : !result ? (
          <Alert type="warning" showIcon message="Chưa có kết quả nhập khẩu." />
        ) : (
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <Row gutter={16}>
              <Col xs={8}>
                <Statistic title="Tổng" value={result.tong_so} />
              </Col>
              <Col xs={8}>
                <Statistic title="Thành công" value={result.thanh_cong} valueStyle={{ color: '#3f8600' }} />
              </Col>
              <Col xs={8}>
                <Statistic title="Lỗi" value={result.that_bai} valueStyle={{ color: '#cf1322' }} />
              </Col>
            </Row>

            <Table<ImportResultItem>
              rowKey="index"
              size="small"
              columns={resultColumns}
              dataSource={result.items}
              rowClassName={rowClassName}
              pagination={{ pageSize: 20, showSizeChanger: false }}
              scroll={{ x: 600 }}
            />

            <Row justify="space-between">
              <Button icon={<FileExcelOutlined />} onClick={handleReset}>
                Nhập thêm
              </Button>
              <Button type="primary" onClick={() => navigate(meta.listPath)}>
                Xem danh sách
              </Button>
            </Row>
          </Space>
        )}
      </Card>
    )
  }

  // ── Layout ─────────────────────────────────────────────────────────────────

  return (
    <PageLayout title={`Nhập từ Excel — ${meta.label}`}>
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <Card bordered>
          <Title level={5} style={{ marginTop: 0 }}>
            Trình nhập liệu 3 bước
          </Title>
          <Steps
            current={current}
            items={[
              { title: 'Chọn tệp nguồn' },
              { title: 'Kiểm tra dữ liệu' },
              { title: 'Kết quả' },
            ]}
          />
        </Card>

        {current === 0 && renderStep1()}
        {current === 1 && renderStep2()}
        {current === 2 && renderStep3()}
      </Space>

      <style>{`
        .excel-import-error-row > td {
          background-color: #fff1f0 !important;
        }
      `}</style>
    </PageLayout>
  )
}
