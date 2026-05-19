/**
 * PhotoCapture — Component chụp ảnh / upload ảnh gắn với bất kỳ record ERP nào.
 *
 * Props:
 *   module    — tên module: 'purchase_orders', 'warehouse_receipts', 'production', ...
 *   recordId  — ID của phiếu / đơn hàng
 *   label     — nhãn hiển thị (tùy chọn)
 *   maxPhotos — giới hạn số ảnh (mặc định: 20)
 *   readOnly  — chỉ xem, không cho upload/xóa
 *
 * Cách dùng:
 *   <PhotoCapture module="purchase_orders" recordId={orderId} />
 */

import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge, Button, Image, Modal, Popconfirm, Progress,
  Spin, Tag, Tooltip, Typography, Upload, message,
} from 'antd'
import {
  CameraOutlined, DeleteOutlined, EyeOutlined,
  LoadingOutlined, PlusOutlined, UploadOutlined,
} from '@ant-design/icons'
import type { RcFile } from 'antd/es/upload'
import { mediaApi, type MediaItem } from '../api/media'

const { Text } = Typography

interface Props {
  module: string
  recordId: string | number
  label?: string
  maxPhotos?: number
  readOnly?: boolean
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export default function PhotoCapture({
  module,
  recordId,
  label = 'Ảnh đính kèm',
  maxPhotos = 20,
  readOnly = false,
}: Props) {
  const qc = useQueryClient()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewIdx, setPreviewIdx] = useState(0)
  const [noteModal, setNoteModal] = useState<{ file: File; note: string } | null>(null)

  const qKey = ['media', module, String(recordId)]

  const { data: photos = [], isLoading } = useQuery<MediaItem[]>({
    queryKey: qKey,
    queryFn: () => mediaApi.list(module, recordId).then(r => r.data),
    enabled: !!recordId,
  })

  // ─── Upload helper ────────────────────────────────────────────────────────
  async function doUpload(file: File, note = '') {
    if (photos.length >= maxPhotos) {
      message.warning(`Tối đa ${maxPhotos} ảnh cho 1 phiếu`)
      return
    }

    // Validate loại file
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
    if (!allowed.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|heic|heif)$/i)) {
      message.error('Chỉ chấp nhận ảnh JPEG, PNG, WebP hoặc HEIC')
      return
    }

    if (file.size > 15 * 1024 * 1024) {
      message.error('Ảnh quá lớn, tối đa 15MB')
      return
    }

    setUploading(true)
    setUploadProgress(0)

    // Giả lập progress (backend không stream progress)
    const ticker = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 15, 85))
    }, 200)

    try {
      await mediaApi.upload(module, recordId, file, note)
      clearInterval(ticker)
      setUploadProgress(100)
      message.success('Đã tải ảnh lên thành công!')
      await qc.invalidateQueries({ queryKey: qKey })
    } catch (err: any) {
      clearInterval(ticker)
      message.error(err?.response?.data?.detail || 'Lỗi tải ảnh lên')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  // ─── Camera input handler ─────────────────────────────────────────────────
  function handleCameraChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''  // reset để chụp lại được
    doUpload(file)
  }

  // ─── Gallery input handler ────────────────────────────────────────────────
  function handleGalleryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    e.target.value = ''
    // Upload tuần tự
    const doNext = async (idx: number) => {
      if (idx >= files.length) return
      await doUpload(files[idx])
      await doNext(idx + 1)
    }
    doNext(0)
  }

  // ─── Delete ───────────────────────────────────────────────────────────────
  async function handleDelete(id: number) {
    try {
      await mediaApi.delete(id)
      message.success('Đã xóa ảnh')
      qc.invalidateQueries({ queryKey: qKey })
    } catch (err: any) {
      message.error(err?.response?.data?.detail || 'Lỗi xóa ảnh')
    }
  }

  // ─── Preview URLs ─────────────────────────────────────────────────────────
  const previewUrls = photos.map(p => p.url)

  return (
    <div style={{ marginTop: 8 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text strong style={{ fontSize: 13 }}>
          📷 {label}
          {photos.length > 0 && (
            <Tag color="blue" style={{ marginLeft: 8, fontSize: 11 }}>
              {photos.length}/{maxPhotos}
            </Tag>
          )}
        </Text>

        {!readOnly && photos.length < maxPhotos && (
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Camera trực tiếp — ưu tiên camera sau trên điện thoại */}
            <Tooltip title="Chụp ảnh bằng camera">
              <Button
                size="small"
                icon={<CameraOutlined />}
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploading}
                style={{ borderColor: '#1677ff', color: '#1677ff' }}
              >
                Chụp ảnh
              </Button>
            </Tooltip>

            {/* Chọn từ thư viện */}
            <Tooltip title="Chọn ảnh từ thư viện điện thoại">
              <Button
                size="small"
                icon={<UploadOutlined />}
                onClick={() => galleryInputRef.current?.click()}
                disabled={uploading}
              >
                Thư viện
              </Button>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Hidden inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"   /* camera sau trên mobile */
        style={{ display: 'none' }}
        onChange={handleCameraChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleGalleryChange}
      />

      {/* Upload progress */}
      {uploading && (
        <Progress
          percent={uploadProgress}
          size="small"
          status={uploadProgress < 100 ? 'active' : 'success'}
          style={{ marginBottom: 8 }}
        />
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin indicator={<LoadingOutlined />} />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && photos.length === 0 && (
        <div style={{
          border: '1px dashed #d9d9d9',
          borderRadius: 8,
          padding: '20px 0',
          textAlign: 'center',
          color: '#8c8c8c',
          fontSize: 13,
          background: '#fafafa',
        }}>
          <CameraOutlined style={{ fontSize: 28, opacity: 0.4, display: 'block', marginBottom: 6 }} />
          {readOnly ? 'Chưa có ảnh đính kèm' : 'Nhấn "Chụp ảnh" hoặc "Thư viện" để thêm ảnh'}
        </div>
      )}

      {/* Photo grid */}
      {photos.length > 0 && (
        <Image.PreviewGroup
          preview={{
            visible: previewOpen,
            onVisibleChange: v => setPreviewOpen(v),
            current: previewIdx,
          }}
          items={previewUrls}
        >
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
            gap: 8,
          }}>
            {photos.map((photo, idx) => (
              <div
                key={photo.id}
                style={{
                  position: 'relative',
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '1px solid #f0f0f0',
                  background: '#000',
                  aspectRatio: '1',
                  cursor: 'pointer',
                }}
              >
                <Image
                  src={photo.url}
                  alt={photo.filename}
                  width="100%"
                  height="100%"
                  style={{ objectFit: 'cover', display: 'block' }}
                  preview={false}
                  onClick={() => {
                    setPreviewIdx(idx)
                    setPreviewOpen(true)
                  }}
                  fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f0f0f0' width='100' height='100'/%3E%3Ctext x='50' y='55' text-anchor='middle' fill='%23999' font-size='12'%3EKhông tải được%3C/text%3E%3C/svg%3E"
                />

                {/* Overlay actions */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.45)',
                  opacity: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'opacity .2s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                >
                  <Tooltip title="Xem ảnh lớn">
                    <Button
                      size="small"
                      shape="circle"
                      icon={<EyeOutlined />}
                      onClick={() => { setPreviewIdx(idx); setPreviewOpen(true) }}
                    />
                  </Tooltip>
                  {!readOnly && (
                    <Popconfirm
                      title="Xóa ảnh này?"
                      okText="Xóa"
                      cancelText="Hủy"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => handleDelete(photo.id)}
                    >
                      <Tooltip title="Xóa ảnh">
                        <Button size="small" shape="circle" danger icon={<DeleteOutlined />} />
                      </Tooltip>
                    </Popconfirm>
                  )}
                </div>

                {/* Info badge at bottom */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                  padding: '16px 4px 4px',
                  fontSize: 10,
                  color: '#fff',
                  lineHeight: 1.3,
                }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {photo.uploaded_by}
                  </div>
                  <div style={{ opacity: 0.85 }}>{formatTime(photo.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </Image.PreviewGroup>
      )}

      {/* Metadata row */}
      {photos.length > 0 && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#8c8c8c' }}>
          {photos.length} ảnh · Tổng dung lượng:{' '}
          {formatSize(photos.reduce((s, p) => s + (p.size_bytes || 0), 0))}
        </div>
      )}
    </div>
  )
}
