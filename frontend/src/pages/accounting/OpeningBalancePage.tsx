import { useState } from 'react'
import {
  Card, Tabs, Button, Upload, Table, Typography, Space, Alert, Row, Col, Tag, message
} from 'antd'
import {
  DownloadOutlined, UploadOutlined, CheckCircleOutlined, EyeOutlined
} from '@ant-design/icons'
import type { UploadFile } from 'antd/es/upload'
import { openingBalanceApi } from '../../api/accounting'

const { Title, Text } = Typography

interface ImportRow {
  row: number
  status: 'ok' | 'error' | 'skip'
  message: string
  ten_doi_tuong?: string
  so_du_dau_ky?: number
}

interface ImportResult {
  commit: boolean
  total: number
  created: number
  updated: number
  skipped: number
  errors: number
  rows: ImportRow[]
}

function ImportTab({
  label,
  downloadFn,
  importFn,
  templateFileName,
}: {
  label: string
  downloadFn: () => Promise<any>
  importFn: (file: File, commit: boolean) => Promise<ImportResult>
  templateFileName: string
}) {
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    try {
      const res = await downloadFn()
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = templateFileName
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      message.error('Không thể tải file mẫu')
    }
  }

  const handlePreview = async () => {
    const file = fileList[0]?.originFileObj
    if (!file) { message.warning('Chưa chọn file'); return }
    setLoading(true)
    try {
      const result = await importFn(file, false)
      setPreview(result)
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Lỗi khi đọc file')
    } finally {
      setLoading(false)
    }
  }

  const handleCommit = async () => {
    const file = fileList[0]?.originFileObj
    if (!file) { message.warning('Chưa chọn file'); return }
    setLoading(true)
    try {
      const result = await importFn(file, true)
      message.success(`Import thành công: ${result.created} dòng tạo mới, ${result.updated} cập nhật`)
      setPreview(result)
      setFileList([])
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Lỗi khi import')
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { title: 'Dòng', dataIndex: 'row', width: 60, align: 'center' as const },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => {
        if (v === 'ok') return <Tag color="green">OK</Tag>
        if (v === 'error') return <Tag color="red">Lỗi</Tag>
        return <Tag>Bỏ qua</Tag>
      }
    },
    { title: 'Đối tượng', dataIndex: 'ten_doi_tuong', ellipsis: true },
    {
      title: 'Số dư đầu kỳ',
      dataIndex: 'so_du_dau_ky',
      align: 'right' as const,
      render: (v: number) => v != null ? v.toLocaleString() : '—'
    },
    { title: 'Ghi chú / Lỗi', dataIndex: 'message', ellipsis: true },
  ]

  const hasErrors = preview && preview.errors > 0

  return (
    <div style={{ paddingTop: 16 }}>
      <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Button icon={<DownloadOutlined />} onClick={handleDownload}>
            Tải file mẫu Excel
          </Button>
        </Col>
        <Col>
          <Upload
            accept=".xlsx,.xls"
            fileList={fileList}
            beforeUpload={file => { setFileList([{ uid: '-1', name: file.name, originFileObj: file } as UploadFile]); return false }}
            onRemove={() => { setFileList([]); setPreview(null) }}
            maxCount={1}
          >
            <Button icon={<UploadOutlined />}>Chọn file</Button>
          </Upload>
        </Col>
        {fileList.length > 0 && (
          <>
            <Col>
              <Button icon={<EyeOutlined />} loading={loading} onClick={handlePreview}>
                Kiểm tra trước
              </Button>
            </Col>
            <Col>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={loading}
                disabled={hasErrors === true}
                onClick={handleCommit}
              >
                Xác nhận Import
              </Button>
            </Col>
          </>
        )}
      </Row>

      {preview && (
        <>
          <Alert
            type={hasErrors ? 'warning' : 'success'}
            message={
              <Space>
                <Text>Tổng: {preview.total} dòng</Text>
                <Text style={{ color: '#52c41a' }}>✓ Tạo mới: {preview.created}</Text>
                {preview.updated > 0 && <Text style={{ color: '#1677ff' }}>↑ Cập nhật: {preview.updated}</Text>}
                {preview.skipped > 0 && <Text type="secondary">- Bỏ qua: {preview.skipped}</Text>}
                {preview.errors > 0 && <Text type="danger">✗ Lỗi: {preview.errors}</Text>}
              </Space>
            }
            style={{ marginBottom: 12 }}
          />
          <Table
            dataSource={preview.rows}
            columns={columns}
            rowKey="row"
            size="small"
            pagination={{ pageSize: 50, showSizeChanger: false }}
            rowClassName={r => r.status === 'error' ? 'row-error' : ''}
          />
          <style>{`.row-error td { background: #fff1f0 !important; }`}</style>
        </>
      )}

      {!preview && (
        <Alert
          type="info"
          message={`Hướng dẫn import ${label}`}
          description={
            <ol style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
              <li>Tải file mẫu Excel theo nút bên trên</li>
              <li>Điền đầy đủ thông tin vào file mẫu (không thay đổi cấu trúc cột)</li>
              <li>Chọn file đã điền, nhấn "Kiểm tra trước" để xem kết quả thử</li>
              <li>Nếu không có lỗi, nhấn "Xác nhận Import" để ghi vào hệ thống</li>
            </ol>
          }
        />
      )}
    </div>
  )
}

export default function OpeningBalancePage() {
  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 4 }}>Nhập số dư đầu kỳ</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Import số dư công nợ phải thu, phải trả và quỹ tiền mặt khi chuyển đổi từ hệ thống cũ
      </Text>

      <Card>
        <Tabs
          items={[
            {
              key: 'ar',
              label: 'Phải thu (AR)',
              children: (
                <ImportTab
                  label="công nợ phải thu"
                  downloadFn={openingBalanceApi.downloadTemplateAR}
                  importFn={openingBalanceApi.importAR}
                  templateFileName="mau_import_cong_no_phai_thu_dau_ky.xlsx"
                />
              ),
            },
            {
              key: 'ap',
              label: 'Phải trả (AP)',
              children: (
                <ImportTab
                  label="công nợ phải trả"
                  downloadFn={openingBalanceApi.downloadTemplateAP}
                  importFn={openingBalanceApi.importAP}
                  templateFileName="mau_import_cong_no_phai_tra_dau_ky.xlsx"
                />
              ),
            },
            {
              key: 'cash',
              label: 'Quỹ / Ngân hàng',
              children: (
                <ImportTab
                  label="số dư quỹ tiền mặt"
                  downloadFn={openingBalanceApi.downloadTemplateCash}
                  importFn={openingBalanceApi.importCash}
                  templateFileName="mau_import_so_du_quy_tien_mat.xlsx"
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
