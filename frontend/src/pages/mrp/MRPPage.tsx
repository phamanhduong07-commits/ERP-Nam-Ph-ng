import { useState } from 'react'
import {
  Table, Button, Space, Tag, Form, InputNumber, DatePicker, Checkbox,
  message, Typography, Row, Col, Card, Statistic, Alert, Divider,
} from 'antd'
import { CalculatorOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import dayjs from 'dayjs'
import axios from 'axios'

const { Title, Text } = Typography

interface MRPRow {
  paper_material_id: number
  ten_nguyen_lieu: string
  ma_ky_hieu: string
  can_thiet_kg: number
  ton_kho_kg: number
  thieu_hut_kg: number
}

interface CreateYMHResult {
  so_ymh: string
  ymh_id: number
  so_vat_lieu: number
}

const API = '/api/mrp'
const fmt = (n: number) => Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 1 })

export default function MRPPage() {
  const [orderIds, setOrderIds] = useState<string>('')
  const [results, setResults] = useState<MRPRow[]>([])
  const [ymhResult, setYmhResult] = useState<CreateYMHResult | null>(null)
  const [form] = Form.useForm()

  const calcMut = useMutation({
    mutationFn: (ids: number[]) =>
      axios.post(`${API}/calculate`, { production_order_ids: ids }).then(r => r.data),
    onSuccess: (data: MRPRow[]) => {
      setResults(data)
      setYmhResult(null)
      if (data.length === 0) message.info('Không có nguyên liệu nào cần tính (chưa có BOM)')
    },
  })

  const createYMHMut = useMutation({
    mutationFn: (v: { production_order_ids: number[]; chi_tinh_thieu_hut: boolean; ngay_can?: string }) =>
      axios.post(`${API}/create-ymh`, v).then(r => r.data),
    onSuccess: (data: CreateYMHResult) => {
      setYmhResult(data)
      message.success(`Đã tạo ${data.so_ymh} với ${data.so_vat_lieu} vật liệu`)
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      message.error(msg || 'Không thể tạo YMH')
    },
  })

  const parseIds = () => {
    return orderIds.split(/[,\s]+/).map(Number).filter(n => n > 0)
  }

  const onCalculate = () => {
    const ids = parseIds()
    if (!ids.length) { message.warning('Nhập ít nhất 1 mã lệnh SX'); return }
    calcMut.mutate(ids)
  }

  const onCreateYMH = (values: { chi_tinh_thieu_hut: boolean; ngay_can?: dayjs.Dayjs }) => {
    const ids = parseIds()
    createYMHMut.mutate({
      production_order_ids: ids,
      chi_tinh_thieu_hut: values.chi_tinh_thieu_hut,
      ngay_can: values.ngay_can ? values.ngay_can.format('YYYY-MM-DD') : undefined,
    })
  }

  const shortageCount = results.filter(r => r.thieu_hut_kg > 0).length
  const totalShortage = results.reduce((s, r) => s + r.thieu_hut_kg, 0)

  const columns = [
    { title: 'Mã KH', dataIndex: 'ma_ky_hieu', width: 100 },
    { title: 'Tên nguyên liệu', dataIndex: 'ten_nguyen_lieu', ellipsis: true },
    {
      title: 'Cần (kg)',
      dataIndex: 'can_thiet_kg',
      align: 'right' as const,
      render: (v: number) => fmt(v),
    },
    {
      title: 'Tồn kho (kg)',
      dataIndex: 'ton_kho_kg',
      align: 'right' as const,
      render: (v: number) => fmt(v),
    },
    {
      title: 'Thiếu hụt (kg)',
      dataIndex: 'thieu_hut_kg',
      align: 'right' as const,
      render: (v: number) =>
        v > 0 ? <Tag color="red"><b>{fmt(v)}</b></Tag> : <Tag color="green">Đủ</Tag>,
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Title level={4}>MRP Lite — Hoạch định nhu cầu nguyên liệu</Title>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="bottom">
          <Col span={14}>
            <Text strong>Mã lệnh sản xuất (ID, cách nhau bởi dấu phẩy hoặc khoảng trắng)</Text>
            <div style={{ marginTop: 8 }}>
              <input
                value={orderIds}
                onChange={e => setOrderIds(e.target.value)}
                placeholder="VD: 1, 2, 5"
                style={{
                  width: '100%', padding: '6px 12px', border: '1px solid #d9d9d9',
                  borderRadius: 6, fontSize: 14,
                }}
              />
            </div>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<CalculatorOutlined />}
              loading={calcMut.isPending}
              onClick={onCalculate}
            >
              Tính MRP
            </Button>
          </Col>
        </Row>
      </Card>

      {results.length > 0 && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}><Card><Statistic title="Tổng vật liệu" value={results.length} /></Card></Col>
            <Col span={6}><Card><Statistic title="Vật liệu thiếu" value={shortageCount}
              valueStyle={{ color: shortageCount > 0 ? '#cf1322' : '#3f8600' }} /></Card></Col>
            <Col span={6}><Card><Statistic title="Tổng thiếu hụt" value={totalShortage}
              suffix="kg" formatter={v => fmt(Number(v))}
              valueStyle={{ color: totalShortage > 0 ? '#cf1322' : '#3f8600' }} /></Card></Col>
          </Row>

          <Card style={{ marginBottom: 16 }}>
            <Table rowKey="paper_material_id" dataSource={results} columns={columns}
              pagination={false} size="small"
              rowClassName={(r: MRPRow) => r.thieu_hut_kg > 0 ? 'ant-table-row-danger' : ''} />
          </Card>

          {shortageCount > 0 && (
            <Card title="Tạo Yêu cầu mua hàng (YMH)" style={{ marginBottom: 16 }}>
              <Form form={form} layout="inline" onFinish={onCreateYMH}
                initialValues={{ chi_tinh_thieu_hut: true }}>
                <Form.Item name="chi_tinh_thieu_hut" valuePropName="checked">
                  <Checkbox>Chỉ đặt mua vật liệu thiếu</Checkbox>
                </Form.Item>
                <Form.Item name="ngay_can" label="Ngày cần">
                  <DatePicker />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" htmlType="submit" icon={<ShoppingCartOutlined />}
                    loading={createYMHMut.isPending}>
                    Tạo YMH
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          )}

          {ymhResult && (
            <Alert type="success" showIcon
              message={`Đã tạo ${ymhResult.so_ymh} — ${ymhResult.so_vat_lieu} vật liệu`}
              description={`YMH ID: ${ymhResult.ymh_id} — Vào danh sách Yêu cầu mua hàng để xem chi tiết.`}
            />
          )}
        </>
      )}
    </div>
  )
}
