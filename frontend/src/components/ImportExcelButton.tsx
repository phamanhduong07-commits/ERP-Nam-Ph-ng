import { useState } from 'react'
import { Button, Modal, Space, Table, Tag, Upload, message, Typography } from 'antd'
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { UploadProps } from 'antd'
import { importExportApi, type ImportPreviewRow, type ImportResult } from '../api/importExport'

const { Text } = Typography

type Props = {
  endpoint: string
  templateFilename: string
  buttonText?: string
  onImported?: () => void
}

export default function ImportExcelButton({
  endpoint,
  templateFilename,
  buttonText = 'Import Excel',
  onImported,
}: Props) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [committing, setCommitting] = useState(false)

  const reset = () => {
    setFile(null)
    setResult(null)
  }

  const handleDownloadTemplate = async () => {
    try {
      await importExportApi.downloadTemplate(endpoint, templateFilename)
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Không tải được file mẫu')
    }
  }

  const preview = async (selectedFile = file) => {
    if (!selectedFile) {
      message.warning('Chọn file Excel trước khi xem trước')
      return
    }
    setLoading(true)
    try {
      const res = await importExportApi.importExcel(endpoint, selectedFile, false)
      setResult(res.data)
      message.success('Đã kiểm tra file import')
    } catch (e: any) {
      setResult(null)
      message.error(e?.response?.data?.detail || 'File import chưa hợp lệ')
    } finally {
      setLoading(false)
    }
  }

  const commit = async () => {
    if (!file) return
    setCommitting(true)
    try {
      const res = await importExportApi.importExcel(endpoint, file, true)
      setResult(res.data)
      message.success(`Đã import: thêm ${res.data.created}, cập nhật ${res.data.updated}`)
      onImported?.()
      setOpen(false)
      reset()
    } catch (e: any) {
      message.error(e?.response?.data?.detail || 'Import thất bại')
    } finally {
      setCommitting(false)
    }
  }

  const uploadProps: UploadProps = {
    accept: '.xlsx,.xls',
    maxCount: 1,
    beforeUpload: (selectedFile) => {
      setFile(selectedFile)
      setResult(null)
      preview(selectedFile)
      return false
    },
    onRemove: () => {
      reset()
    },
  }

  const columns: ColumnsType<ImportPreviewRow> = [
    { title: 'Dòng', dataIndex: 'row', width: 70 },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 110,
      render: (status: ImportPreviewRow['status']) => {
        const color = status === 'error' ? 'red' : status === 'update' ? 'blue' : status === 'skip' ? 'default' : 'green'
        const text = status === 'create' ? 'Thêm mới' : status === 'update' ? 'Cập nhật' : status === 'skip' ? 'Bỏ qua' : 'Lỗi'
        return <Tag color={color}>{text}</Tag>
      },
    },
    {
      title: 'Lỗi',
      dataIndex: 'errors',
      render: (errors: string[]) => errors?.length ? <Text type="danger">{errors.join('; ')}</Text> : '—',
    },
  ]

  return (
    <>
      <Button icon={<UploadOutlined />} onClick={() => setOpen(true)}>
        {buttonText}
      </Button>

      <Modal
        title={buttonText}
        open={open}
        onCancel={() => { setOpen(false); reset() }}
        onOk={commit}
        okText="Xác nhận import"
        cancelText="Đóng"
        confirmLoading={committing}
        okButtonProps={{ disabled: !result || result.errors > 0 || !file }}
        width={820}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Space>
            <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
              Tải file mẫu
            </Button>
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />} loading={loading}>
                Chọn file Excel
              </Button>
            </Upload>
          </Space>

          {result && (
            <Space size="large" wrap>
              <Text>Tổng: <b>{result.total}</b></Text>
              <Text type="success">Thêm: <b>{result.created}</b></Text>
              <Text type="secondary">Cập nhật: <b>{result.updated}</b></Text>
              <Text type={result.errors ? 'danger' : undefined}>Lỗi: <b>{result.errors}</b></Text>
              <Text>Bỏ qua: <b>{result.skipped}</b></Text>
            </Space>
          )}

          {result && (
            <Table
              rowKey="row"
              size="small"
              columns={columns}
              dataSource={result.rows}
              pagination={{ pageSize: 8 }}
            />
          )}
        </Space>
      </Modal>
    </>
  )
}
