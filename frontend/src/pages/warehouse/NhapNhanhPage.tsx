import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Button, Card, Form, Input, InputNumber, Select, Typography, message, Result } from 'antd'
import { CameraOutlined, CheckCircleFilled, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { warehouseApi, QuickCapturePayload } from '../../api/warehouse'
import { useQuery } from '@tanstack/react-query'
import { suppliersApi } from '../../api/suppliers'
import { warehouseApi as whApi } from '../../api/warehouse'

const { Title, Text } = Typography

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

export default function NhapNhanhPage() {
  const [searchParams] = useSearchParams()
  const loaiParam = searchParams.get('loai')   // null | 'nvl' | 'phoi'
  const isNVL = loaiParam === 'nvl'
  const isPhoi = loaiParam === 'phoi'
  const [form] = Form.useForm()
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [done, setDone] = useState<{ soPhieu: string; tenNCC: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.all().then(r => r.data),
    staleTime: 300_000,
  })

  const { data: phanXuongs = [] } = useQuery({
    queryKey: ['phan-xuong-list'],
    queryFn: () => whApi.listPhanXuong().then(r => r.data),
    staleTime: 300_000,
  })

  const captureMut = useMutation({
    mutationFn: (data: QuickCapturePayload) => warehouseApi.quickCaptureGoodsReceipt(data),
    onSuccess: (res) => {
      const ncc = suppliers.find((s: any) => s.id === form.getFieldValue('supplier_id'))
      setDone({
        soPhieu: res.data.so_phieu,
        tenNCC: ncc?.ten_viet_tat || ncc?.ten_don_vi || '',
      })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi gửi phiếu'),
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
    try {
      const v = await form.validateFields()
      const invoice_image = await fileToBase64(imageFile)
      captureMut.mutate({
        ngay_nhap: dayjs().format('YYYY-MM-DD'),
        supplier_id: v.supplier_id,
        phan_xuong_id: v.phan_xuong_id,
        loai_kho_auto: isNVL ? 'NVL_PHU' : isPhoi ? 'PHOI' : 'GIAY_CUON',
        so_xe: v.so_xe || null,
        invoice_image,
        hd_tong_kg: v.hd_tong_kg || null,
      })
    } catch { /* validation inline */ }
  }

  const handleReset = () => {
    setDone(null)
    setPreviewUrl(null)
    setImageFile(null)
    form.resetFields()
  }

  if (done) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f9f0', padding: 16 }}>
        <Result
          icon={<CheckCircleFilled style={{ color: '#52c41a', fontSize: 72 }} />}
          title={<span style={{ fontSize: 22 }}>Đã ghi nhận!</span>}
          subTitle={
            <div style={{ fontSize: 16, marginTop: 8 }}>
              <div>Phiếu: <strong>{done.soPhieu}</strong></div>
              <div style={{ marginTop: 4 }}>NCC: <strong>{done.tenNCC}</strong></div>
              <div style={{ marginTop: 12, color: '#666', fontSize: 14 }}>
                Bộ phận nhập liệu sẽ hoàn thiện số lượng và giá.
              </div>
            </div>
          }
          extra={
            <Button type="primary" size="large" icon={<ReloadOutlined />} onClick={handleReset}
              style={{ height: 52, fontSize: 18, borderRadius: 8 }}>
              Ghi nhận xe tiếp theo
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '16px 12px' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 20, color: isNVL ? '#722ed1' : isPhoi ? '#389e0d' : '#1677ff' }}>
          {isNVL ? '🧴 Ghi nhận xe nhập NVL' : isPhoi ? '🟩 Ghi nhận xe nhập phôi' : '📦 Ghi nhận xe nhập giấy'}
        </Title>

        <Form form={form} layout="vertical" size="large">

          {/* Xưởng */}
          <Card size="small" style={{ marginBottom: 12, borderRadius: 12 }}>
            <Form.Item name="phan_xuong_id" label={<Text strong style={{ fontSize: 16 }}>Xưởng</Text>}
              rules={[{ required: true, message: 'Chọn xưởng' }]} style={{ marginBottom: 0 }}>
              <Select placeholder="Đang ở xưởng nào?" style={{ fontSize: 16 }}
                options={phanXuongs.filter((p: any) => p.trang_thai).map((p: any) => ({
                  value: p.id, label: p.ten_xuong,
                }))} />
            </Form.Item>
          </Card>

          {/* NCC */}
          <Card size="small" style={{ marginBottom: 12, borderRadius: 12 }}>
            <Form.Item name="supplier_id" label={<Text strong style={{ fontSize: 16 }}>Nhà cung cấp</Text>}
              rules={[{ required: true, message: 'Chọn NCC' }]} style={{ marginBottom: 0 }}>
              <Select showSearch placeholder="Tìm tên NCC..." style={{ fontSize: 16 }}
                filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
                options={suppliers.map((s: any) => ({
                  value: s.id,
                  label: s.ten_viet_tat || s.ten_don_vi || s.ma_ncc,
                }))} />
            </Form.Item>
          </Card>

          {/* Số xe */}
          <Card size="small" style={{ marginBottom: 12, borderRadius: 12 }}>
            <Form.Item name="so_xe" label={<Text strong style={{ fontSize: 16 }}>Số xe</Text>}
              style={{ marginBottom: 0 }}>
              <Input placeholder="VD: 51C-12345" style={{ fontSize: 16 }} />
            </Form.Item>
          </Card>

          {/* Tổng KG phiếu NCC */}
          <Card size="small" style={{ marginBottom: 12, borderRadius: 12 }}>
            <Form.Item name="hd_tong_kg" label={<Text strong style={{ fontSize: 16 }}>Tổng KG trên phiếu NCC</Text>}
              style={{ marginBottom: 0 }}>
              <InputNumber placeholder="Nhập từ phiếu NCC" style={{ width: '100%', fontSize: 16 }} min={0}
                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
            </Form.Item>
          </Card>

          {/* Chụp ảnh */}
          <Card size="small" style={{ marginBottom: 20, borderRadius: 12 }}>
            <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 10 }}>
              Ảnh phiếu xuất kho NCC {isNVL ? '(NVL)' : isPhoi ? '(phôi)' : '(giấy)'} <Text type="danger">*</Text>
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
                block
                type="dashed"
                size="large"
                icon={<CameraOutlined />}
                onClick={() => fileInputRef.current?.click()}
                style={{ height: 120, fontSize: 18, borderRadius: 8, borderWidth: 2 }}
              >
                <div>
                  <CameraOutlined style={{ fontSize: 36, display: 'block', marginBottom: 6 }} />
                  Chụp ảnh phiếu xuất NCC
                </div>
              </Button>
            )}
          </Card>

          <Button
            type="primary"
            block
            size="large"
            loading={captureMut.isPending}
            onClick={handleSubmit}
            style={{ height: 56, fontSize: 20, borderRadius: 12, fontWeight: 700 }}
          >
            Gửi ghi nhận
          </Button>
        </Form>
      </div>
    </div>
  )
}
