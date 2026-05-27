import { useRef, useState } from 'react'
import type { ApiError } from '../../api/types'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Button, Card, Form, Input, List, Result, Skeleton, Tag, Typography, message,
} from 'antd'
import {
  CameraOutlined, CheckCircleFilled, LeftOutlined, ReloadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import client from '../../api/client'

const { Title, Text } = Typography


const uploadPhotoViaMedia = async (file: File, doId: number): Promise<void> => {
  const fd = new FormData()
  fd.append('module', 'delivery_orders')
  fd.append('record_id', String(doId))
  fd.append('file', file)
  await client.post('/media/upload', fd)
}

interface MobileDO {
  id: number
  so_phieu: string
  ten_khach: string
  dia_chi_giao: string | null
  xe_van_chuyen: string | null
  nguoi_nhan: string | null
  ngay_xuat: string
  tong_thanh_toan: number
  trang_thai: string
}

export default function GiaoHangMobilePage() {
  const [selected, setSelected] = useState<MobileDO | null>(null)
  const [done, setDone] = useState<{ soPhieu: string; tenKhach: string } | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [form] = Form.useForm()

  const { data: doList = [], isLoading, refetch } = useQuery({
    queryKey: ['deliveries-mobile-today'],
    queryFn: () =>
      client.get<MobileDO[]>('/warehouse/deliveries/mobile-list').then(r => r.data),
    staleTime: 60_000,
  })

  const confirmMut = useMutation({
    mutationFn: (payload: { ten_nguoi_nhan: string; ghi_chu?: string }) =>
      client.post(`/warehouse/deliveries/${selected!.id}/xac-nhan`, {
        ngay_giao: dayjs().format('YYYY-MM-DD'),
        ...payload,
      }),
    onSuccess: () => {
      setDone({ soPhieu: selected!.so_phieu, tenKhach: selected!.ten_khach })
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      message.error((e as ApiError)?.response?.data?.detail || 'Lỗi xác nhận giao hàng'),
  })

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    e.target.value = ''
  }

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields()
      if (imageFile && selected) {
        setUploading(true)
        try {
          await uploadPhotoViaMedia(imageFile, selected.id)
        } finally {
          setUploading(false)
        }
      }
      confirmMut.mutate({
        ten_nguoi_nhan: v.ten_nguoi_nhan,
        ghi_chu: v.ghi_chu || undefined,
      })
    } catch (err: unknown) {
      setUploading(false)
      const apiErr = err as { response?: { data?: { detail?: string } } }
      if (apiErr?.response) {
        message.error(apiErr.response?.data?.detail || 'Lỗi upload ảnh')
      }
      /* validation errors handled inline */
    }
  }

  const handleReset = () => {
    setDone(null)
    setSelected(null)
    setPreviewUrl(null)
    setImageFile(null)
    form.resetFields()
    refetch()
  }

  // ── Success screen ───────────────────────────────────────────────────────
  if (done) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f9f0', padding: 16 }}>
        <Result
          icon={<CheckCircleFilled style={{ color: '#52c41a', fontSize: 72 }} />}
          title={<span style={{ fontSize: 22 }}>Đã xác nhận giao hàng!</span>}
          subTitle={
            <div style={{ fontSize: 16, marginTop: 8 }}>
              <div>Phiếu: <strong>{done.soPhieu}</strong></div>
              <div style={{ marginTop: 4 }}>Khách: <strong>{done.tenKhach}</strong></div>
            </div>
          }
          extra={
            <Button type="primary" size="large" icon={<ReloadOutlined />} onClick={handleReset}
              style={{ height: 52, fontSize: 18, borderRadius: 8 }}>
              Xác nhận phiếu tiếp theo
            </Button>
          }
        />
      </div>
    )
  }

  // ── Confirm screen ───────────────────────────────────────────────────────
  if (selected) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '16px 12px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <Button icon={<LeftOutlined />} onClick={() => { setSelected(null); setPreviewUrl(null); setImageFile(null); form.resetFields() }}
            style={{ marginBottom: 16 }}>
            Quay lại
          </Button>

          <Title level={3} style={{ textAlign: 'center', marginBottom: 16, color: '#1677ff' }}>
            🚛 Xác nhận giao hàng
          </Title>

          <Card size="small" style={{ marginBottom: 12, borderRadius: 12, background: '#e6f4ff', border: '1px solid #91caff' }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{selected.so_phieu}</div>
            <div style={{ fontSize: 15, marginTop: 4 }}>{selected.ten_khach}</div>
            {selected.dia_chi_giao && <div style={{ fontSize: 13, color: '#555', marginTop: 2 }}>{selected.dia_chi_giao}</div>}
          </Card>

          <Form form={form} layout="vertical" size="large">
            <Card size="small" style={{ marginBottom: 12, borderRadius: 12 }}>
              <Form.Item name="ten_nguoi_nhan" label={<Text strong style={{ fontSize: 16 }}>Người nhận hàng</Text>}
                rules={[{ required: true, message: 'Nhập tên người nhận' }]} style={{ marginBottom: 0 }}>
                <Input placeholder={selected.nguoi_nhan || 'Tên người nhận tại điểm giao'} style={{ fontSize: 16 }} />
              </Form.Item>
            </Card>

            <Card size="small" style={{ marginBottom: 12, borderRadius: 12 }}>
              <Form.Item name="ghi_chu" label={<Text strong style={{ fontSize: 16 }}>Ghi chú</Text>}
                style={{ marginBottom: 0 }}>
                <Input placeholder="VD: giao đủ, hàng nguyên vẹn..." style={{ fontSize: 16 }} />
              </Form.Item>
            </Card>

            <Card size="small" style={{ marginBottom: 20, borderRadius: 12 }}>
              <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 10 }}>
                Ảnh phiếu giao hàng có chữ ký
              </Text>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={handleCapture}
              />

              {previewUrl ? (
                <div>
                  <img src={previewUrl} alt="preview" style={{ width: '100%', borderRadius: 8, marginBottom: 10 }} />
                  <Button block size="large" icon={<CameraOutlined />} onClick={() => fileInputRef.current?.click()}
                    style={{ borderRadius: 8 }}>
                    Chụp lại
                  </Button>
                </div>
              ) : (
                <Button
                  block type="dashed" size="large" icon={<CameraOutlined />}
                  onClick={() => fileInputRef.current?.click()}
                  style={{ height: 120, fontSize: 18, borderRadius: 8, borderWidth: 2 }}
                >
                  <div>
                    <CameraOutlined style={{ fontSize: 36, display: 'block', marginBottom: 6 }} />
                    Chụp phiếu giao hàng
                  </div>
                </Button>
              )}
            </Card>

            <Button
              type="primary"
              block size="large"
              loading={uploading || confirmMut.isPending}
              onClick={handleSubmit}
              style={{ height: 56, fontSize: 20, borderRadius: 12, fontWeight: 700, background: '#1677ff' }}
            >
              {uploading ? 'Đang upload ảnh...' : 'Xác nhận đã giao'}
            </Button>
          </Form>
        </div>
      </div>
    )
  }

  // ── List screen ──────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '16px 12px' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 4, color: '#1677ff' }}>
          🚛 Xác nhận giao hàng
        </Title>
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 20 }}>
          Phiếu hôm nay cần xác nhận — {dayjs().format('DD/MM/YYYY')}
        </Text>

        <Button block icon={<ReloadOutlined />} onClick={() => refetch()} style={{ marginBottom: 16, borderRadius: 8 }}>
          Tải lại danh sách
        </Button>

        {isLoading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : doList.length === 0 ? (
          <Card style={{ borderRadius: 12, textAlign: 'center', padding: '32px 0' }}>
            <CheckCircleFilled style={{ fontSize: 48, color: '#52c41a', marginBottom: 12 }} />
            <div style={{ fontSize: 18, fontWeight: 600, color: '#52c41a' }}>Tất cả đã giao xong!</div>
            <div style={{ color: '#888', marginTop: 8 }}>Không còn phiếu nào cần xác nhận hôm nay</div>
          </Card>
        ) : (
          <List
            dataSource={doList}
            renderItem={item => (
              <Card
                key={item.id}
                size="small"
                style={{ marginBottom: 12, borderRadius: 12, cursor: 'pointer', border: '1.5px solid #d0e8ff' }}
                onClick={() => {
                  setSelected(item)
                  form.setFieldsValue({ ten_nguoi_nhan: item.nguoi_nhan || '' })
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{item.so_phieu}</div>
                    <div style={{ fontSize: 15, marginTop: 2 }}>{item.ten_khach}</div>
                    {item.dia_chi_giao && (
                      <div style={{ fontSize: 12, color: '#777', marginTop: 2 }}>{item.dia_chi_giao}</div>
                    )}
                    {item.xe_van_chuyen && (
                      <Tag color="orange" style={{ marginTop: 6 }}>{item.xe_van_chuyen}</Tag>
                    )}
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    <Button type="primary" size="small" style={{ borderRadius: 6 }}>
                      Xác nhận
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          />
        )}
      </div>
    </div>
  )
}
