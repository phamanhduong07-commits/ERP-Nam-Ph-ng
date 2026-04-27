import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Card, Form, Input, DatePicker, Select, Button, Space, Table, InputNumber,
  Typography, message, Divider, Row, Col, Popconfirm,
} from 'antd'
import { PlusOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { procurementApi } from '../../api/procurement'
import type { ReceiptItemCreate } from '../../api/procurement'
import { suppliersApi } from '../../api/suppliers'
import { paperMaterialsFullApi } from '../../api/paperMaterials'
import { otherMaterialsApi } from '../../api/otherMaterials'
import { warehousesApi } from '../../api/warehouses'

const { Title } = Typography

interface LineItem extends ReceiptItemCreate {
  _key: number
}

let _key = 1

export default function MaterialReceiptCreate() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const poId = searchParams.get('po') ? Number(searchParams.get('po')) : null
  const [form] = Form.useForm()
  const [lines, setLines] = useState<LineItem[]>([{ _key: _key++, so_luong: 1, don_gia: 0 }])

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.all().then(r => r.data),
  })

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses-all'],
    queryFn: () => warehousesApi.list().then(r => r.data),
  })

  const { data: paperMaterials } = useQuery({
    queryKey: ['paper-materials-all'],
    queryFn: () => paperMaterialsFullApi.list({ page_size: 500 }).then(r => r.data.items),
  })

  const { data: otherMaterials } = useQuery({
    queryKey: ['other-materials-all'],
    queryFn: () => otherMaterialsApi.list({ page_size: 500 }).then(r => r.data.items),
  })

  const allMaterials = [
    ...(paperMaterials || []).map(p => ({ id: p.id, type: 'giay', label: `[Giấy] ${p.ma_chinh} — ${p.ten}`, dvt: 'kg', ten: p.ten })),
    ...(otherMaterials || []).map(o => ({ id: o.id, type: 'khac', label: `[Khác] ${o.ma_chinh} — ${o.ten}`, dvt: (o as any).dvt || '', ten: o.ten })),
  ]

  const create = useMutation({
    mutationFn: procurementApi.createReceipt,
    onSuccess: (res) => {
      message.success(`Tạo phiếu ${res.data.so_phieu} thành công`)
      navigate(`/procurement/material-receipts?id=${res.data.id}`)
    },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Lỗi tạo phiếu'),
  })

  const handleSubmit = async () => {
    try {
      const vals = await form.validateFields()
      const items: ReceiptItemCreate[] = lines.map(l => ({
        purchase_order_item_id: l.purchase_order_item_id || null,
        paper_material_id: l.paper_material_id || null,
        other_material_id: l.other_material_id || null,
        ten_hang: l.ten_hang,
        so_luong: l.so_luong,
        dvt: l.dvt,
        don_gia: l.don_gia || 0,
        ghi_chu: l.ghi_chu,
      }))
      create.mutate({
        ngay_nhap: vals.ngay_nhap.format('YYYY-MM-DD'),
        phan_xuong: vals.phan_xuong || null,
        warehouse_id: vals.warehouse_id,
        supplier_id: vals.supplier_id,
        purchase_order_id: poId || null,
        so_phieu_can: vals.so_phieu_can || null,
        bien_so_xe: vals.bien_so_xe || null,
        trong_luong_xe: vals.trong_luong_xe || null,
        trong_luong_hang: vals.trong_luong_hang || null,
        ghi_chu: vals.ghi_chu || null,
        items,
      })
    } catch {
      // validation failed
    }
  }

  const updateLine = (key: number, field: string, value: unknown) => {
    setLines(prev => prev.map(l => {
      if (l._key !== key) return l
      const updated: LineItem = { ...l, [field]: value }
      if (field === '_mat_id') {
        const mat = allMaterials.find(m => `${m.type}-${m.id}` === String(value))
        if (mat) {
          if (mat.type === 'giay') {
            updated.paper_material_id = mat.id
            updated.other_material_id = undefined
          } else {
            updated.other_material_id = mat.id
            updated.paper_material_id = undefined
          }
          updated.dvt = mat.dvt
          updated.ten_hang = mat.ten
        }
      }
      return updated
    }))
  }

  const addLine = () => setLines(prev => [...prev, { _key: _key++, so_luong: 1, don_gia: 0 }])
  const removeLine = (key: number) => setLines(prev => prev.filter(l => l._key !== key))

  const tong = lines.reduce((s, l) => s + (l.so_luong || 0) * (l.don_gia || 0), 0)

  const columns = [
    { title: 'STT', width: 45, render: (_: unknown, __: unknown, i: number) => i + 1, align: 'center' as const },
    {
      title: 'Nguyên liệu',
      width: 240,
      render: (_: unknown, row: LineItem) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          showSearch
          optionFilterProp="label"
          placeholder="Chọn nguyên liệu"
          value={row.paper_material_id ? `giay-${row.paper_material_id}` : row.other_material_id ? `khac-${row.other_material_id}` : undefined}
          onChange={v => updateLine(row._key, '_mat_id', v)}
          options={allMaterials.map(m => ({ value: `${m.type}-${m.id}`, label: m.label }))}
        />
      ),
    },
    {
      title: 'Số lượng',
      width: 100,
      render: (_: unknown, row: LineItem) => (
        <InputNumber
          size="small"
          style={{ width: '100%' }}
          min={0.001}
          step={0.001}
          value={row.so_luong}
          onChange={v => updateLine(row._key, 'so_luong', v || 0)}
        />
      ),
    },
    {
      title: 'ĐVT',
      width: 70,
      render: (_: unknown, row: LineItem) => (
        <Input size="small" value={row.dvt || ''} onChange={e => updateLine(row._key, 'dvt', e.target.value)} />
      ),
    },
    {
      title: 'Đơn giá',
      width: 120,
      render: (_: unknown, row: LineItem) => (
        <InputNumber
          size="small"
          style={{ width: '100%' }}
          min={0}
          step={1000}
          value={row.don_gia}
          onChange={v => updateLine(row._key, 'don_gia', v || 0)}
          formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
        />
      ),
    },
    {
      title: 'Thành tiền',
      width: 120,
      align: 'right' as const,
      render: (_: unknown, row: LineItem) =>
        ((row.so_luong || 0) * (row.don_gia || 0)).toLocaleString('vi-VN'),
    },
    {
      title: 'Ghi chú',
      render: (_: unknown, row: LineItem) => (
        <Input size="small" value={row.ghi_chu || ''} onChange={e => updateLine(row._key, 'ghi_chu', e.target.value)} />
      ),
    },
    {
      title: '',
      width: 40,
      render: (_: unknown, row: LineItem) => (
        <Popconfirm title="Xóa dòng?" onConfirm={() => removeLine(row._key)} okText="Xóa" cancelText="Không">
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  return (
    <Card
      size="small"
      title={
        <Space>
          <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate(-1)} />
          <Title level={5} style={{ margin: 0 }}>Tạo phiếu nhập nguyên liệu</Title>
        </Space>
      }
      extra={
        <Space>
          <Button onClick={() => navigate(-1)}>Hủy</Button>
          <Button type="primary" loading={create.isPending} onClick={handleSubmit}>
            Lưu phiếu nhập
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" initialValues={{ ngay_nhap: dayjs() }}>
        <Row gutter={16}>
          <Col span={4}>
            <Form.Item label="Ngày nhập" name="ngay_nhap" rules={[{ required: true }]}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={7}>
            <Form.Item label="Nhà cung cấp" name="supplier_id" rules={[{ required: true, message: 'Chọn NCC' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Chọn nhà cung cấp"
                options={suppliers?.map(s => ({ value: s.id, label: `${s.ma_ncc} — ${s.ten_viet_tat}` }))}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label="Kho nhập" name="warehouse_id" rules={[{ required: true, message: 'Chọn kho' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Chọn kho"
                options={warehouses?.map(w => ({ value: w.id, label: w.ten_kho }))}
              />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item label="Phân xưởng" name="phan_xuong">
              <Input placeholder="Phân xưởng..." />
            </Form.Item>
          </Col>
          <Col span={3}>
            <Form.Item label="Phiếu cân" name="so_phieu_can">
              <Input placeholder="Số phiếu cân" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={4}>
            <Form.Item label="Biển số xe" name="bien_so_xe">
              <Input placeholder="Biển số xe" />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item label="TL xe (tấn)" name="trong_luong_xe">
              <InputNumber style={{ width: '100%' }} min={0} step={0.001} />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item label="TL hàng (tấn)" name="trong_luong_hang">
              <InputNumber style={{ width: '100%' }} min={0} step={0.001} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Ghi chú" name="ghi_chu">
              <Input.TextArea rows={1} />
            </Form.Item>
          </Col>
        </Row>
      </Form>

      <Divider orientation="left" style={{ margin: '4px 0 8px' }}>Chi tiết nguyên liệu</Divider>

      <Table
        size="small"
        rowKey="_key"
        columns={columns}
        dataSource={lines}
        pagination={false}
        scroll={{ x: 700 }}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={5} align="right">
              <strong>Tổng:</strong>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="right">
              <strong>{tong.toLocaleString('vi-VN')}</strong>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={2} colSpan={2} />
          </Table.Summary.Row>
        )}
      />

      <Button icon={<PlusOutlined />} style={{ marginTop: 8 }} onClick={addLine} size="small">
        Thêm dòng
      </Button>
    </Card>
  )
}
