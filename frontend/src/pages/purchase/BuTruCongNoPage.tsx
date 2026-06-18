import { useState } from 'react'
import {
  Button, Card, DatePicker, Form, InputNumber, message, Select, Space,
  Table, Typography, Alert, Row, Col,
} from 'antd'
import { RetweetOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const API = '/api'

type APInvoice = { id: number; so_hoa_don: string; ngay_lap: string; con_lai: number }
type ARInvoice = { id: number; so_hoa_don: string; ngay_hoa_don: string; con_lai: number }
type BuTruItem = {
  purchase_invoice_id: number; sales_invoice_id: number; so_tien_doi_tru: number
  _so_hd_mua?: string; _so_hd_ban?: string
}

export default function BuTruCongNoPage() {
  const qc = useQueryClient()
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const [items, setItems] = useState<BuTruItem[]>([])
  const [form] = Form.useForm()

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-select'],
    queryFn: () => axios.get(`${API}/suppliers?limit=500`).then(r => r.data.items ?? r.data),
  })

  const { data: apData, isLoading: loadAP } = useQuery({
    queryKey: ['bu-tru-ap', supplierId],
    queryFn: () => axios.get(`${API}/doi-tru/pending/${supplierId}`).then(r => r.data),
    enabled: !!supplierId,
  })

  const { data: arData, isLoading: loadAR } = useQuery({
    queryKey: ['bu-tru-ar', supplierId],
    queryFn: () => axios.get(`${API}/doi-tru/pending-ar/${supplierId}`).then(r => r.data),
    enabled: !!supplierId,
  })

  const createMut = useMutation({
    mutationFn: (body: object) => axios.post(`${API}/doi-tru/bu-tru-cong-no`, body),
    onSuccess: (res) => {
      message.success(`Đã bù trừ ${res.data.ma_doi_tru} — ${res.data.tong_tien_doi_tru.toLocaleString('vi-VN')} đ`)
      setItems([])
      qc.invalidateQueries({ queryKey: ['bu-tru-ap', supplierId] })
      qc.invalidateQueries({ queryKey: ['bu-tru-ar', supplierId] })
    },
    onError: (e: any) => message.error(e.response?.data?.detail ?? 'Lỗi bù trừ'),
  })

  function addItem() {
    const apId = form.getFieldValue('ap_id')
    const arId = form.getFieldValue('ar_id')
    const amount = form.getFieldValue('amount')
    if (!apId || !arId || !amount) { message.warning('Chọn đủ HĐ mua, HĐ bán và số tiền'); return }
    const ap = apData?.invoices?.find((i: APInvoice) => i.id === apId)
    const ar = arData?.sales_invoices?.find((i: ARInvoice) => i.id === arId)
    setItems(prev => [...prev, {
      purchase_invoice_id: apId, sales_invoice_id: arId, so_tien_doi_tru: amount,
      _so_hd_mua: ap?.so_hoa_don, _so_hd_ban: ar?.so_hoa_don,
    }])
    form.resetFields(['ap_id', 'ar_id', 'amount'])
  }

  function handleConfirm() {
    if (!supplierId || items.length === 0) { message.warning('Chưa có dòng bù trừ nào'); return }
    const ngay = form.getFieldValue('ngay')
    createMut.mutate({
      supplier_id: supplierId,
      ngay_doi_tru: ngay ? ngay.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      ghi_chu: form.getFieldValue('ghi_chu'),
      items: items.map(({ purchase_invoice_id, sales_invoice_id, so_tien_doi_tru }) => ({
        purchase_invoice_id, sales_invoice_id, so_tien_doi_tru,
      })),
    })
  }

  const apCols = [
    { title: 'Số HĐ mua', dataIndex: 'so_hoa_don' },
    { title: 'Ngày', dataIndex: 'ngay_lap' },
    { title: 'Còn phải trả (AP)', dataIndex: 'con_lai', render: (v: number) => <Text type="danger">{v.toLocaleString('vi-VN')}</Text> },
  ]
  const arCols = [
    { title: 'Số HĐ bán', dataIndex: 'so_hoa_don' },
    { title: 'Ngày', dataIndex: 'ngay_hoa_don' },
    { title: 'Còn phải thu (AR)', dataIndex: 'con_lai', render: (v: number) => <Text type="success">{v.toLocaleString('vi-VN')}</Text> },
  ]
  const itemCols = [
    { title: 'HĐ mua (AP)', dataIndex: '_so_hd_mua' },
    { title: 'HĐ bán (AR)', dataIndex: '_so_hd_ban' },
    { title: 'Số tiền bù trừ', dataIndex: 'so_tien_doi_tru', render: (v: number) => <Text strong>{v.toLocaleString('vi-VN')}</Text> },
    {
      title: '', key: 'del',
      render: (_: unknown, __: unknown, idx: number) => (
        <Button size="small" danger onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}>Xóa</Button>
      ),
    },
  ]

  const noArMessage = arData?.message

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}><RetweetOutlined /> Bù trừ công nợ</Title>
      <Text type="secondary">
        Bù trừ công nợ phải trả NCC (AP) với công nợ phải thu KH (AR) cho cùng một đối tác
      </Text>

      <Card style={{ marginTop: 16 }}>
        <Form form={form} layout="inline">
          <Form.Item label="Nhà cung cấp (kiêm KH)" required>
            <Select
              showSearch optionFilterProp="label" placeholder="Chọn NCC kiêm khách hàng"
              style={{ width: 320 }}
              options={(suppliers || []).map((s: any) => ({ value: s.id, label: s.ten_ncc }))}
              onChange={v => { setSupplierId(v); setItems([]) }}
            />
          </Form.Item>
          <Form.Item label="Ngày bù trừ" name="ngay" initialValue={dayjs()}>
            <DatePicker format="DD/MM/YYYY" />
          </Form.Item>
        </Form>
      </Card>

      {supplierId && noArMessage && (
        <Alert style={{ marginTop: 16 }} message={noArMessage} type="warning" showIcon />
      )}

      {supplierId && !noArMessage && (
        <>
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={12}>
              <Card title="Công nợ phải trả NCC (AP)" size="small" loading={loadAP}>
                <Table
                  dataSource={apData?.invoices || []} columns={apCols}
                  rowKey="id" size="small" pagination={false} scroll={{ y: 220 }}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Công nợ phải thu KH (AR)" size="small" loading={loadAR}>
                <Table
                  dataSource={arData?.sales_invoices || []} columns={arCols}
                  rowKey="id" size="small" pagination={false} scroll={{ y: 220 }}
                />
              </Card>
            </Col>
          </Row>

          <Card title="Tạo dòng bù trừ" style={{ marginTop: 16 }} size="small">
            <Form form={form} layout="inline">
              <Form.Item name="ap_id" label="HĐ mua (AP)">
                <Select style={{ width: 200 }} placeholder="Chọn HĐ mua" options={
                  (apData?.invoices || []).map((i: APInvoice) => ({
                    value: i.id,
                    label: `${i.so_hoa_don} (${i.con_lai.toLocaleString('vi-VN')})`,
                  }))
                } />
              </Form.Item>
              <Form.Item name="ar_id" label="HĐ bán (AR)">
                <Select style={{ width: 200 }} placeholder="Chọn HĐ bán" options={
                  (arData?.sales_invoices || []).map((i: ARInvoice) => ({
                    value: i.id,
                    label: `${i.so_hoa_don} (${i.con_lai.toLocaleString('vi-VN')})`,
                  }))
                } />
              </Form.Item>
              <Form.Item name="amount" label="Số tiền">
                <InputNumber<number>
                  style={{ width: 150 }}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => {
                    const cleaned = v ? v.replace(/,/g, '') : ''
                    return cleaned ? parseFloat(cleaned) : 0
                  }}
                  min={1}
                />
              </Form.Item>
              <Button onClick={addItem} type="dashed">+ Thêm dòng</Button>
            </Form>
          </Card>

          {items.length > 0 && (
            <Card
              title={`Danh sách bù trừ (${items.length} dòng)`}
              style={{ marginTop: 16 }}
              extra={
                <Space>
                  <Text strong>
                    Tổng: {items.reduce((s, i) => s + i.so_tien_doi_tru, 0).toLocaleString('vi-VN')} đ
                  </Text>
                  <Button
                    type="primary" icon={<CheckCircleOutlined />}
                    onClick={handleConfirm} loading={createMut.isPending}
                  >
                    Xác nhận bù trừ
                  </Button>
                </Space>
              }
            >
              <Table
                dataSource={items} columns={itemCols}
                rowKey={(_, idx) => String(idx)}
                size="small" pagination={false}
              />
            </Card>
          )}
        </>
      )}

      {!supplierId && (
        <Alert style={{ marginTop: 24 }} message="Chọn nhà cung cấp kiêm khách hàng để thực hiện bù trừ công nợ AP vs AR" type="info" showIcon />
      )}
    </div>
  )
}
