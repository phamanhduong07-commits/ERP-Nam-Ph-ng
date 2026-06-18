import { useState } from 'react'
import { Upload, Button, List, Typography, Space, Popconfirm, message } from 'antd'
import { PaperClipOutlined, DeleteOutlined, DownloadOutlined, InboxOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UploadProps } from 'antd'
import client from '../../api/client'

const { Text } = Typography
const { Dragger } = Upload

const MAX_SIZE_MB = 5
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const ALLOWED_EXT  = '.jpg,.jpeg,.png,.webp,.pdf'

interface MediaItem {
  id: number
  url: string
  filename: string
  size_bytes: number
  created_at: string
  uploaded_by: string
  note?: string
}

interface AttachmentSectionProps {
  module: 'phieu_thu' | 'phieu_chi'
  recordId?: number
  readonly?: boolean
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function AttachmentSection({ module, recordId, readonly = false }: AttachmentSectionProps) {
  const qc = useQueryClient()
  const [uploading, setUploading] = useState(false)

  const qKey = ['media', module, recordId]

  const { data: files = [] } = useQuery<MediaItem[]>({
    queryKey: qKey,
    queryFn: () =>
      client.get(`/api/media/${module}/${recordId}`).then(r => r.data),
    enabled: !!recordId,
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => client.delete(`/api/media/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qKey })
      message.success('Đã xóa tệp')
    },
    onError: () => message.error('Xóa thất bại'),
  })

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    accept: ALLOWED_EXT,
    showUploadList: false,
    disabled: !recordId || readonly,
    beforeUpload(file) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        message.error(`Định dạng không hỗ trợ: ${file.name}`)
        return Upload.LIST_IGNORE
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        message.error(`Tệp quá lớn (tối đa ${MAX_SIZE_MB}MB): ${file.name}`)
        return Upload.LIST_IGNORE
      }
      return true
    },
    async customRequest({ file, onSuccess, onError }) {
      setUploading(true)
      const fd = new FormData()
      fd.append('module', module)
      fd.append('record_id', String(recordId))
      fd.append('file', file as File)
      try {
        const res = await client.post('/api/media/upload', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        qc.invalidateQueries({ queryKey: qKey })
        message.success(`Đã tải lên: ${(file as File).name}`)
        onSuccess?.(res.data)
      } catch (e: any) {
        const msg = e?.response?.data?.detail || 'Tải lên thất bại'
        message.error(msg)
        onError?.(e)
      } finally {
        setUploading(false)
      }
    },
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <PaperClipOutlined style={{ color: '#666' }} />
        <Text strong style={{ fontSize: 14 }}>Đính kèm</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>Dung lượng tối đa {MAX_SIZE_MB}MB</Text>
      </div>

      {!readonly && recordId && (
        <Dragger {...uploadProps} style={{ marginBottom: files.length ? 8 : 0, opacity: uploading ? 0.7 : 1 }}>
          <p className="ant-upload-drag-icon" style={{ marginBottom: 4 }}>
            <InboxOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          </p>
          <p className="ant-upload-text" style={{ fontSize: 13 }}>
            Kéo/thả tệp vào đây hoặc bấm vào đây
          </p>
        </Dragger>
      )}

      {!recordId && !readonly && (
        <div style={{
          border: '1px dashed #d9d9d9',
          borderRadius: 6,
          padding: '16px',
          textAlign: 'center',
          color: '#999',
          fontSize: 13,
          background: '#fafafa',
        }}>
          Lưu phiếu trước để đính kèm tệp
        </div>
      )}

      {files.length > 0 && (
        <List
          size="small"
          dataSource={files}
          renderItem={(item) => (
            <List.Item
              style={{ padding: '6px 0' }}
              actions={[
                <Button
                  key="dl"
                  type="link"
                  size="small"
                  icon={<DownloadOutlined />}
                  href={item.url}
                  target="_blank"
                  download={item.filename}
                />,
                ...(!readonly ? [
                  <Popconfirm
                    key="del"
                    title="Xóa tệp này?"
                    onConfirm={() => deleteMut.mutate(item.id)}
                    okText="Xóa"
                    cancelText="Hủy"
                  >
                    <Button
                      type="link"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                    />
                  </Popconfirm>
                ] : []),
              ]}
            >
              <Space>
                <PaperClipOutlined style={{ color: '#1677ff' }} />
                <Text style={{ fontSize: 13 }}>{item.filename}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>({fmtSize(item.size_bytes)})</Text>
              </Space>
            </List.Item>
          )}
        />
      )}
    </div>
  )
}
