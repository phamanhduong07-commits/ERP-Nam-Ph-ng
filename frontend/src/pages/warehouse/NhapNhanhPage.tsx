import { useState } from 'react'
import type { ApiError } from '../../api/types'
import { useMutation } from '@tanstack/react-query'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Button, Result, Typography, message } from 'antd'
import { CheckCircleFilled, ReloadOutlined, LeftOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { warehouseApi, QuickCapturePayload } from '../../api/warehouse'
import { useAuthStore } from '../../store/auth'

const { Text } = Typography

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

const LOAI_CONFIG = {
  nvl:  { label: '🧴 Nhập NVL phụ',    color: '#722ed1', border: '#722ed1', bg: '#f9f0ff' },
  phoi: { label: '🟩 Nhập phôi',         color: '#389e0d', border: '#389e0d', bg: '#f6ffed' },
  '':   { label: '📄 Nhập giấy cuộn',    color: '#1677ff', border: '#1677ff', bg: '#e6f4ff' },
}

const captureId = 'nhap-nhanh-capture'

export default function NhapNhanhPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const loaiParam = (searchParams.get('loai') ?? '') as keyof typeof LOAI_CONFIG
  const cfg = LOAI_CONFIG[loaiParam] ?? LOAI_CONFIG['']

  const user = useAuthStore(s => s.user)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [done, setDone] = useState<{ soPhieu: string } | null>(null)

  const isNVL  = loaiParam === 'nvl'
  const isPhoi = loaiParam === 'phoi'

  const captureMut = useMutation({
    mutationFn: (data: QuickCapturePayload) => warehouseApi.quickCaptureGoodsReceipt(data),
    onSuccess: (res) => setDone({ soPhieu: res.data.so_phieu }),
    onError: (e: { response?: { data?: { detail?: string } } }) => message.error((e as ApiError)?.response?.data?.detail || 'Lỗi gửi phiếu'),
  })

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    e.target.value = ''
  }

  const handleSubmit = async () => {
    if (!imageFile) { message.warning('Chưa chụp ảnh phiếu xuất NCC'); return }
    if (!user?.phap_nhan_id) { message.error('Tài khoản chưa gán nhà máy — liên hệ admin'); return }
    const invoice_image = await fileToBase64(imageFile)
    captureMut.mutate({
      ngay_nhap: dayjs().format('YYYY-MM-DD'),
      phap_nhan_id: user.phap_nhan_id,
      loai_kho_auto: isNVL ? 'NVL_PHU' : isPhoi ? 'PHOI' : 'GIAY_CUON',
      invoice_image,
    })
  }

  const handleReset = () => {
    setDone(null)
    setPreviewUrl(null)
    setImageFile(null)
  }

  // ── Success ──────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#f6ffed', padding: 24,
      }}>
        <CheckCircleFilled style={{ fontSize: 80, color: '#52c41a', marginBottom: 16 }} />
        <div style={{ fontSize: 22, fontWeight: 700, color: '#135200', marginBottom: 8 }}>
          Đã ghi nhận!
        </div>
        <div style={{ fontSize: 17, color: '#389e0d', marginBottom: 4 }}>
          Phiếu: <strong>{done.soPhieu}</strong>
        </div>
        <div style={{ fontSize: 14, color: '#888', marginTop: 8, textAlign: 'center' }}>
          Bộ phận nhập liệu sẽ hoàn thiện NCC và số lượng.
        </div>
        <Button
          type="primary"
          size="large"
          icon={<ReloadOutlined />}
          onClick={handleReset}
          style={{ marginTop: 32, height: 52, fontSize: 17, borderRadius: 12, background: '#389e0d', borderColor: '#389e0d' }}
        >
          Ghi nhận xe tiếp theo
        </Button>
        <Button
          type="link"
          onClick={() => navigate('/gate-hub')}
          style={{ marginTop: 12, color: '#888' }}
        >
          ← Về trang chủ
        </Button>
      </div>
    )
  }

  // ── Main ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{
        background: cfg.color,
        paddingTop: 'env(safe-area-inset-top, 0px)',
        display: 'flex', alignItems: 'center',
        padding: '14px 14px',
        flexShrink: 0,
      }}>
        <Button
          icon={<LeftOutlined />}
          onClick={() => navigate('/gate-hub')}
          size="small"
          style={{ background: 'rgba(255,255,255,0.22)', border: 'none', color: '#fff', borderRadius: 8, marginRight: 12, flexShrink: 0 }}
        />
        <span style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>{cfg.label}</span>
      </div>

      {/* Camera area — chiếm toàn bộ không gian */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 14px 0' }}>

        <label htmlFor={captureId} style={{ display: 'flex', flexDirection: 'column', flex: 1, cursor: 'pointer' }}>
          <input
            id={captureId}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleCapture}
          />

          {previewUrl ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <img
                src={previewUrl}
                alt="preview"
                style={{ width: '100%', flex: 1, objectFit: 'contain', borderRadius: 12, background: '#000', minHeight: 0 }}
              />
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px 0', marginTop: 10,
                border: `1.5px solid ${cfg.border}`, borderRadius: 10,
                color: cfg.color, fontSize: 16, fontWeight: 600, background: '#fff',
              }}>
                📷 Chụp lại
              </div>
            </div>
          ) : (
            <div style={{
              flex: 1,
              minHeight: 260,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              border: `3px dashed ${cfg.border}`, borderRadius: 16,
              background: cfg.bg, gap: 12,
            }}>
              <span style={{ fontSize: 72 }}>📷</span>
              <Text strong style={{ fontSize: 20, color: cfg.color }}>Chụp ảnh phiếu xuất NCC</Text>
              <Text type="secondary" style={{ fontSize: 14 }}>Bấm để mở camera</Text>
            </div>
          )}
        </label>

      </div>

      {/* Fixed bottom submit */}
      <div style={{
        padding: '12px 14px',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        background: '#fff',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.10)',
        flexShrink: 0,
      }}>
        <Button
          type="primary"
          block
          size="large"
          loading={captureMut.isPending}
          disabled={!imageFile}
          onClick={handleSubmit}
          style={{
            height: 56, fontSize: 19, borderRadius: 12, fontWeight: 700,
            background: imageFile ? cfg.color : undefined,
            borderColor: imageFile ? cfg.color : undefined,
          }}
        >
          {imageFile ? '✓ Gửi ghi nhận' : 'Chụp ảnh trước'}
        </Button>
      </div>

    </div>
  )
}
