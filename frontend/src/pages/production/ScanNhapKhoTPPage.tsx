import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Alert, Button, Card, Col, Form, Input, InputNumber,
  message, Row, Space, Spin, Statistic, Tag, Typography,
} from 'antd'
import type { InputRef } from 'antd'
import { BarcodeOutlined, CameraOutlined, CheckCircleFilled, ClearOutlined } from '@ant-design/icons'
import { cd2Api, ScanLookupResult } from '../../api/cd2'
import QrScannerModal from '../../components/QrScannerModal'

const { Title, Text } = Typography

interface FormValues {
  so_luong_nhap: number
  so_luong_loi?: number
  ghi_chu?: string
}

export default function ScanNhapKhoTPPage() {
  const [soLsx, setSoLsx] = useState('')
  const [lookup, setLookup] = useState<{ loading: boolean; result: ScanLookupResult | null; error: string | null }>({
    loading: false, result: null, error: null,
  })
  const [lastResult, setLastResult] = useState<{ so_phieu: string; so_luong_nhap: number } | null>(null)
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [form] = Form.useForm<FormValues>()
  const lsxRef = useRef<InputRef>(null)

  const doLookup = async (code: string) => {
    const trimmed = code.trim()
    if (!trimmed) return
    setLookup({ loading: true, result: null, error: null })
    setLastResult(null)
    try {
      const res = await cd2Api.scanLookup(trimmed)
      setLookup({ loading: false, result: res.data, error: null })
      form.setFieldValue('so_luong_nhap', null)
      form.setFieldValue('so_luong_loi', null)
      form.setFieldValue('ghi_chu', '')
    } catch {
      setLookup({ loading: false, result: null, error: `Không tìm thấy LSX: ${trimmed}` })
    }
  }

  const handleLsxKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') doLookup(soLsx)
  }

  const handleScanResult = (code: string) => {
    setIsScannerOpen(false)
    setSoLsx(code)
    doLookup(code)
  }

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      cd2Api.nhapKhoTPScan({
        so_lsx: soLsx.trim(),
        so_luong_nhap: values.so_luong_nhap,
        so_luong_loi: values.so_luong_loi ?? 0,
        ghi_chu: values.ghi_chu || undefined,
      }),
    onSuccess: (res) => {
      setLastResult({ so_phieu: res.data.so_phieu, so_luong_nhap: res.data.so_luong_nhap })
      message.success(`Đã nhập kho TP — ${res.data.so_phieu}`)
      form.resetFields()
      // Re-fetch lookup để cập nhật số đã nhập
      doLookup(soLsx)
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      message.error(err?.response?.data?.detail ?? 'Lỗi nhập kho thành phẩm')
    },
  })

  const handleReset = () => {
    setSoLsx('')
    setLookup({ loading: false, result: null, error: null })
    setLastResult(null)
    form.resetFields()
    setTimeout(() => lsxRef.current?.focus(), 50)
  }

  const info = lookup.result
  const keHoach = info?.so_luong_ke_hoach ?? 0
  const daNhap = info?.da_scan ?? 0

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px' }}>
      <Title level={4} style={{ marginBottom: 16 }}>
        <BarcodeOutlined style={{ marginRight: 8 }} />
        Quét mã nhập kho Thành Phẩm
      </Title>

      {/* LSX Input */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>Mã lệnh sản xuất (LSX)</Text>
        <Space.Compact style={{ width: '100%', marginTop: 4 }}>
          <Input
            ref={lsxRef}
            value={soLsx}
            onChange={e => setSoLsx(e.target.value)}
            onKeyDown={handleLsxKeyDown}
            placeholder="Nhập hoặc quét mã LSX..."
            size="large"
            autoFocus
          />
          <Button
            size="large"
            icon={<CameraOutlined />}
            onClick={() => setIsScannerOpen(true)}
          />
          <Button
            size="large"
            onClick={() => doLookup(soLsx)}
            type="primary"
          >
            Tra cứu
          </Button>
        </Space.Compact>
      </Card>

      {/* Lookup error */}
      {lookup.error && (
        <Alert type="error" message={lookup.error} style={{ marginBottom: 12 }} showIcon />
      )}

      {/* Loading */}
      {lookup.loading && <Spin style={{ display: 'block', textAlign: 'center', marginBottom: 12 }} />}

      {/* Product Info */}
      {info && (
        <Card
          size="small"
          style={{ marginBottom: 12, background: '#f0f9ff', borderColor: '#bae0ff' }}
          title={<Text strong>{info.ten_hang || soLsx}</Text>}
          extra={<Tag color="blue">{soLsx}</Tag>}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Statistic title="Kế hoạch (thùng)" value={keHoach ?? '—'} />
            </Col>
            <Col span={12}>
              <Statistic
                title="Đã nhập kho (tổng scan)"
                value={daNhap ?? 0}
                valueStyle={{ color: daNhap >= keHoach && keHoach > 0 ? '#52c41a' : undefined }}
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* Success banner */}
      {lastResult && (
        <Alert
          type="success"
          icon={<CheckCircleFilled />}
          message={
            <span>
              Nhập kho thành công — phiếu <strong>{lastResult.so_phieu}</strong>{' '}
              ({lastResult.so_luong_nhap.toLocaleString('vi-VN')} thùng)
            </span>
          }
          style={{ marginBottom: 12 }}
          showIcon
        />
      )}

      {/* Entry Form */}
      {info && (
        <Card size="small" title="Nhập số lượng">
          <Form
            form={form}
            layout="vertical"
            onFinish={values => mutation.mutate(values)}
            initialValues={{ so_luong_loi: 0 }}
          >
            <Form.Item
              label="Số lượng nhập (thùng)"
              name="so_luong_nhap"
              rules={[{ required: true, message: 'Nhập số lượng' }, { type: 'number', min: 1, message: 'Phải > 0' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                size="large"
                min={1}
                placeholder="Số thùng nhập kho"
                autoFocus
              />
            </Form.Item>

            <Form.Item label="Số lượng lỗi (thùng)" name="so_luong_loi">
              <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
            </Form.Item>

            <Form.Item label="Ghi chú" name="ghi_chu">
              <Input placeholder="(tuỳ chọn)" />
            </Form.Item>

            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button icon={<ClearOutlined />} onClick={handleReset}>
                Xoá / Scan mới
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={mutation.isPending}
                icon={<CheckCircleFilled />}
              >
                Nhập kho TP
              </Button>
            </Space>
          </Form>
        </Card>
      )}

      <QrScannerModal
        open={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScanResult}
      />
    </div>
  )
}
