import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Button, Card, Col, DatePicker, Drawer, Form, Input, InputNumber,
  Popconfirm, Row, Select, Space, Table, Tag, Typography, message,
} from 'antd'
import { AuditOutlined, DeleteOutlined, MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  CreateStockAdjustmentPayload, StockAdjustment, TonKho, warehouseApi,
} from '../../api/warehouse'
import { warehousesApi } from '../../api/warehouses'

const { Title, Text } = Typography

function fmtNum(v: number) {
  return Number(v || 0).toLocaleString('vi-VN', { maximumFractionDigits: 3 })
}

function diffColor(v: number) {
  if (v > 0) return '#52c41a'
  if (v < 0) return '#ff4d4f'
  return '#666'
}

export default function StockAdjustmentsPage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [filterKho, setFilterKho] = useState<number | undefined>()
  const [tuNgay, setTuNgay] = useState<string | undefined>()
  const [denNgay, setDenNgay] = useState<string | undefined>()
  const [selectedKho, setSelectedKho] = useState<number | undefined>()

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: () => warehousesApi.list().then(r => r.data),
  })

  const { data: phieuList = [], isLoading } = useQuery({
    queryKey: ['stock-adjustments', filterKho, tuNgay, denNgay],
    queryFn: () => warehouseApi.listStockAdjustments({
      warehouse_id: filterKho, tu_ngay: tuNgay, den_ngay: denNgay,
    }).then(r => r.data),
  })

  const { data: tonKho = [] } = useQuery({
    queryKey: ['ton-kho-kiem-ke', selectedKho],
    queryFn: () => selectedKho
      ? warehouseApi.getTonKho({ warehouse_id: selectedKho }).then(r => r.data)
      : Promise.resolve([]),
    enabled: !!selectedKho,
  })

  const createMut = useMutation({
    mutationFn: (data: CreateStockAdjustmentPayload) => warehouseApi.createStockAdjustment(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-adjustments'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      qc.invalidateQueries({ queryKey: ['ton-kho-kiem-ke'] })
      message.success('Da tao phieu kiem ke')
      setOpen(false)
      form.resetFields()
      setSelectedKho(undefined)
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Loi tao phieu kiem ke'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => warehouseApi.deleteStockAdjustment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-adjustments'] })
      qc.invalidateQueries({ queryKey: ['ton-kho'] })
      qc.invalidateQueries({ queryKey: ['ton-kho-kiem-ke'] })
      message.success('Da xoa phieu kiem ke')
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Loi xoa phieu'),
  })

  const activeWarehouses = warehouses.filter(w => w.trang_thai)

  const handleTonKhoSelect = (rowIndex: number, balanceId: number) => {
    const t = tonKho.find(x => x.id === balanceId)
    if (!t) return
    const items = form.getFieldValue('items') || []
    const updated = [...items]
    updated[rowIndex] = {
      ...updated[rowIndex],
      inventory_balance_id: balanceId,
      ten_hang: t.ten_hang,
      don_vi: t.don_vi,
      so_luong_so_sach: t.ton_luong,
      so_luong_thuc_te: t.ton_luong,
      don_gia: t.don_gia_binh_quan,
    }
    form.setFieldValue('items', updated)
  }

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields()
      const items = (v.items || [])
        .filter((it: any) => it.inventory_balance_id)
        .map((it: any) => ({
          inventory_balance_id: it.inventory_balance_id,
          so_luong_thuc_te: Number(it.so_luong_thuc_te || 0),
          ghi_chu: it.ghi_chu || null,
        }))
      if (items.length === 0) {
        message.warning('Them it nhat 1 dong hang')
        return
      }
      if (items.every((it: any) => {
        const ton = tonKho.find(t => t.id === it.inventory_balance_id)
        return ton && Number(it.so_luong_thuc_te) === Number(ton.ton_luong)
      })) {
        message.warning('Chua co chenh lech ton kho')
        return
      }
      createMut.mutate({
        warehouse_id: v.warehouse_id,
        ngay: v.ngay.format('YYYY-MM-DD'),
        ly_do: v.ly_do || null,
        ghi_chu: v.ghi_chu || null,
        items,
      })
    } catch {
      // Form validation is displayed inline.
    }
  }

  const columns = [
    { title: 'So phieu', dataIndex: 'so_phieu', width: 150, render: (v: string) => <Text strong style={{ color: '#1677ff' }}>{v}</Text> },
    { title: 'Ngay', dataIndex: 'ngay', width: 110 },
    { title: 'Kho', dataIndex: 'ten_kho', width: 180 },
    { title: 'Ly do', dataIndex: 'ly_do', render: (v: string | null) => v || '-' },
    {
      title: 'Chenh lech', width: 130, align: 'right' as const,
      render: (_: unknown, r: StockAdjustment) => {
        const total = r.items.reduce((s, it) => s + it.chenhlech, 0)
        return <Text strong style={{ color: diffColor(total) }}>{fmtNum(total)}</Text>
      },
    },
    { title: 'TT', dataIndex: 'trang_thai', width: 90, render: (v: string) => <Tag>{v}</Tag> },
    {
      title: '', width: 50,
      render: (_: unknown, r: StockAdjustment) => (
        <Popconfirm title="Xoa phieu kiem ke nay?" onConfirm={() => deleteMut.mutate(r.id)} okButtonProps={{ danger: true }}>
          <Button danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  const expandedRowRender = (r: StockAdjustment) => (
    <Table dataSource={r.items} rowKey="id" size="small" pagination={false}
      columns={[
        { title: 'Ten hang', dataIndex: 'ten_hang' },
        { title: 'DVT', dataIndex: 'don_vi', width: 70 },
        { title: 'So sach', dataIndex: 'so_luong_so_sach', width: 110, align: 'right' as const, render: fmtNum },
        { title: 'Thuc te', dataIndex: 'so_luong_thuc_te', width: 110, align: 'right' as const, render: fmtNum },
        { title: 'Chenh lech', dataIndex: 'chenhlech', width: 110, align: 'right' as const, render: (v: number) => <Text style={{ color: diffColor(v) }}>{fmtNum(v)}</Text> },
        { title: 'Ghi chu', dataIndex: 'ghi_chu', render: (v: string | null) => v || '-' },
      ]}
    />
  )

  return (
    <div style={{ paddingBottom: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space><AuditOutlined style={{ fontSize: 20, color: '#1677ff' }} /><Title level={4} style={{ margin: 0 }}>Kiem ke / dieu chinh ton</Title></Space>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />}
            onClick={() => { form.resetFields(); setSelectedKho(undefined); setOpen(true) }}>
            Tao phieu kiem ke
          </Button>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Row gutter={[8, 8]}>
          <Col xs={24} sm={8}>
            <Select placeholder="Kho" style={{ width: '100%' }} allowClear value={filterKho} onChange={setFilterKho}
              options={warehouses.map(w => ({ value: w.id, label: w.ten_kho }))} />
          </Col>
          <Col xs={12} sm={6}>
            <DatePicker placeholder="Tu ngay" style={{ width: '100%' }} format="DD/MM/YYYY"
              onChange={d => setTuNgay(d ? d.format('YYYY-MM-DD') : undefined)} />
          </Col>
          <Col xs={12} sm={6}>
            <DatePicker placeholder="Den ngay" style={{ width: '100%' }} format="DD/MM/YYYY"
              onChange={d => setDenNgay(d ? d.format('YYYY-MM-DD') : undefined)} />
          </Col>
        </Row>
      </Card>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table dataSource={phieuList} columns={columns} rowKey="id" loading={isLoading} size="small"
          expandable={{ expandedRowRender }} pagination={{ pageSize: 20, showSizeChanger: true }} scroll={{ x: 850 }} />
      </Card>

      <Drawer open={open} onClose={() => setOpen(false)} title="Tao phieu kiem ke / dieu chinh ton" width={820}
        footer={
          <Space>
            <Button onClick={() => setOpen(false)}>Huy</Button>
            <Button type="primary" loading={createMut.isPending} onClick={handleSubmit}>Luu phieu</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ ngay: dayjs(), items: [] }}>
          <Alert type="info" showIcon style={{ marginBottom: 16 }}
            message="Nhap so luong thuc te sau kiem ke. He thong se tu dong tang/giam ton va luu lich su giao dich dieu chinh." />

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="warehouse_id" label="Kho kiem ke" rules={[{ required: true, message: 'Chon kho' }]}>
                <Select placeholder="Chon kho"
                  options={activeWarehouses.map(w => ({ value: w.id, label: w.ten_kho }))}
                  onChange={v => { setSelectedKho(v); form.setFieldValue('items', []) }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ngay" label="Ngay kiem ke" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ly_do" label="Ly do">
                <Input placeholder="Kiem ke dinh ky, lech kho..." />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ghi_chu" label="Ghi chu">
                <Input placeholder="Ghi chu phieu..." />
              </Form.Item>
            </Col>
          </Row>

          {!selectedKho && (
            <div style={{ color: '#faad14', marginBottom: 12, fontSize: 13 }}>
              Chon kho truoc de lay danh sach ton kho.
            </div>
          )}

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
                  <Text strong>Danh sach mat hang kiem ke</Text>
                  <Button size="small" type="dashed" icon={<PlusOutlined />}
                    disabled={!selectedKho}
                    onClick={() => add({})}>
                    Them dong
                  </Button>
                </Row>

                {fields.map(({ key, name }) => {
                  const items = form.getFieldValue('items') || []
                  const item = items[name] || {}
                  const selected: TonKho | undefined = tonKho.find(t => t.id === item.inventory_balance_id)
                  const soSach = Number(item.so_luong_so_sach ?? selected?.ton_luong ?? 0)
                  const thucTe = Number(item.so_luong_thuc_te ?? soSach)
                  const chenhLech = thucTe - soSach

                  return (
                    <Card key={key} size="small" style={{ marginBottom: 8, background: '#fafafa' }}>
                      <Row gutter={[8, 4]}>
                        <Col span={15}>
                          <Form.Item name={[name, 'inventory_balance_id']} label="Mat hang"
                            rules={[{ required: true, message: 'Chon mat hang' }]} style={{ marginBottom: 4 }}>
                            <Select size="small" showSearch placeholder="Chon tu ton kho..."
                              filterOption={(inp, opt) => (opt?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
                              options={tonKho.map(t => ({
                                value: t.id,
                                label: `${t.ten_hang} - ton: ${fmtNum(t.ton_luong)} ${t.don_vi}`,
                              }))}
                              onChange={id => handleTonKhoSelect(name, id)}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={4}>
                          <Form.Item name={[name, 'don_vi']} label="DVT" style={{ marginBottom: 4 }}>
                            <Input size="small" readOnly style={{ background: '#f5f5f5' }} />
                          </Form.Item>
                        </Col>
                        <Col span={4}>
                          <Form.Item label="Chenh lech" style={{ marginBottom: 4 }}>
                            <Text strong style={{ color: diffColor(chenhLech) }}>{fmtNum(chenhLech)}</Text>
                          </Form.Item>
                        </Col>
                        <Col span={1} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 20 }}>
                          <MinusCircleOutlined style={{ color: '#ff4d4f', fontSize: 16, cursor: 'pointer' }} onClick={() => remove(name)} />
                        </Col>

                        <Col span={8}>
                          <Form.Item name={[name, 'so_luong_so_sach']} label="So sach" style={{ marginBottom: 4 }}>
                            <InputNumber size="small" readOnly style={{ width: '100%', background: '#f5f5f5' }} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item name={[name, 'so_luong_thuc_te']} label="Thuc te"
                            rules={[{ required: true, message: 'Nhap so luong' }]} style={{ marginBottom: 4 }}>
                            <InputNumber size="small" min={0} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item name={[name, 'ghi_chu']} label="Ghi chu" style={{ marginBottom: 4 }}>
                            <Input size="small" placeholder="..." />
                          </Form.Item>
                        </Col>
                        <Form.Item name={[name, 'ten_hang']} hidden><Input /></Form.Item>
                        <Form.Item name={[name, 'don_gia']} hidden><Input /></Form.Item>
                      </Row>
                    </Card>
                  )
                })}

                {fields.length === 0 && selectedKho && tonKho.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#bbb', padding: 24 }}>Kho nay chua co ton kho</div>
                )}
                {fields.length === 0 && selectedKho && tonKho.length > 0 && (
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({})}>
                    Them dong kiem ke
                  </Button>
                )}
              </>
            )}
          </Form.List>
        </Form>
      </Drawer>
    </div>
  )
}
