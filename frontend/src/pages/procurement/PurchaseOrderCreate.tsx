import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Card, Form, Input, DatePicker, Select, Button, Space, Table, InputNumber,
  Typography, message, Divider, Row, Col, Popconfirm,
} from 'antd'
import { PlusOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { procurementApi, PO_LOAI } from '../../api/procurement'
import type { POItemCreate } from '../../api/procurement'
import { suppliersApi } from '../../api/suppliers'
import { paperMaterialsFullApi } from '../../api/paperMaterials'
import { otherMaterialsApi } from '../../api/otherMaterials'
import { usersApi } from '../../api/usersApi'

const { Title } = Typography

interface LineItem extends POItemCreate {
  _key: number
}

let _key = 1

export default function PurchaseOrderCreate() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const loaiParam = searchParams.get('loai') || 'giay_cuon'
  const [form] = Form.useForm()
  const [lines, setLines] = useState<LineItem[]>([{ _key: _key++, so_luong: 1, don_gia: 0 }])
  const isGiay = loaiParam === 'giay_cuon'

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-all'],
    queryFn: () => suppliersApi.all().then(r => r.data),
  })

  const { data: paperMaterials } = useQuery({
    queryKey: ['paper-materials-all'],
    queryFn: () => paperMaterialsFullApi.list({ page_size: 500 }).then(r => r.data.items),
    enabled: isGiay,
  })

  const { data: otherMaterials } = useQuery({
    queryKey: ['other-materials-all'],
    queryFn: () => otherMaterialsApi.list({ page_size: 500 }).then(r => r.data.items),
    enabled: !isGiay,
  })

  const { data: users } = useQuery({
    queryKey: ['users-all'],
    queryFn: () => usersApi.list().then(r => r.data),
  })

  const create = useMutation({
    mutationFn: procurementApi.createPO,
    onSuccess: (res) => {
      message.success(`Tạo đơn ${res.data.so_don_mua} thành công`)
      navigate(`/procurement/purchase-orders?id=${res.data.id}`)
    },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Lỗi tạo đơn'),
  })

  const handleSubmit = async () => {
    try {
      const vals = await form.validateFields()
      const items = lines.map(l => ({
        paper_material_id: isGiay ? l.paper_material_id : undefined,
        other_material_id: !isGiay ? l.other_material_id : undefined,
        ten_hang: l.ten_hang,
        so_cuon: isGiay ? l.so_cuon : undefined,
        so_luong: l.so_luong,
        dvt: l.dvt,
        don_gia: l.don_gia || 0,
        ghi_chu: l.ghi_chu,
      }))
      create.mutate({
        loai_don: loaiParam,
        ngay_dat: vals.ngay_dat.format('YYYY-MM-DD'),
        supplier_id: vals.supplier_id,
        nv_thu_mua_id: vals.nv_thu_mua_id || null,
        ten_nhom_hang: vals.ten_nhom_hang || null,
        noi_dung: vals.noi_dung || null,
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
      const updated = { ...l, [field]: value }
      if (field === 'so_luong' || field === 'don_gia') {
        // auto-calculated but tracked per-line
      }
      if (field === 'paper_material_id' && isGiay) {
        const pm = paperMaterials?.find(p => p.id === value)
        if (pm) updated.dvt = 'kg'
      }
      if (field === 'other_material_id' && !isGiay) {
        const om = otherMaterials?.find(o => o.id === value)
        if (om) {
          updated.ten_hang = om.ten
          updated.dvt = (om as any).dvt || ''
        }
      }
      return updated
    }))
  }

  const addLine = () => setLines(prev => [...prev, { _key: _key++, so_luong: 1, don_gia: 0 }])
  const removeLine = (key: number) => setLines(prev => prev.filter(l => l._key !== key))

  const tong = lines.reduce((s, l) => s + (l.so_luong || 0) * (l.don_gia || 0), 0)

  const columns = [
    {
      title: 'STT',
      width: 45,
      render: (_: unknown, __: unknown, i: number) => i + 1,
      align: 'center' as const,
    },
    ...(isGiay ? [{
      title: 'Nguyên liệu giấy',
      width: 200,
      render: (_: unknown, row: LineItem) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          showSearch
          optionFilterProp="label"
          placeholder="Chọn nguyên liệu"
          value={row.paper_material_id}
          onChange={v => updateLine(row._key, 'paper_material_id', v)}
          options={paperMaterials?.map(p => ({ value: p.id, label: `${p.ma_chinh} — ${p.ten}` }))}
        />
      ),
    }] : [{
      title: 'Tên hàng',
      width: 200,
      render: (_: unknown, row: LineItem) => (
        <Input
          size="small"
          value={row.ten_hang || ''}
          onChange={e => updateLine(row._key, 'ten_hang', e.target.value)}
          placeholder="Tên hàng hóa"
        />
      ),
    }]),
    ...(isGiay ? [{
      title: 'Số cuộn',
      width: 80,
      render: (_: unknown, row: LineItem) => (
        <InputNumber
          size="small"
          style={{ width: '100%' }}
          min={0}
          value={row.so_cuon}
          onChange={v => updateLine(row._key, 'so_cuon', v)}
        />
      ),
    }] : []),
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
        <Input
          size="small"
          value={row.dvt || ''}
          onChange={e => updateLine(row._key, 'dvt', e.target.value)}
        />
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
        <Input
          size="small"
          value={row.ghi_chu || ''}
          onChange={e => updateLine(row._key, 'ghi_chu', e.target.value)}
        />
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
          <Title level={5} style={{ margin: 0 }}>
            Tạo đơn mua — {PO_LOAI[loaiParam] || loaiParam}
          </Title>
        </Space>
      }
      extra={
        <Space>
          <Button onClick={() => navigate(-1)}>Hủy</Button>
          <Button type="primary" loading={create.isPending} onClick={handleSubmit}>
            Lưu đơn mua
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" initialValues={{ ngay_dat: dayjs() }}>
        <Row gutter={16}>
          <Col span={6}>
            <Form.Item label="Ngày đặt" name="ngay_dat" rules={[{ required: true }]}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
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
            <Form.Item label="NV thu mua" name="nv_thu_mua_id">
              <Select
                showSearch
                allowClear
                optionFilterProp="label"
                placeholder="Chọn nhân viên"
                options={(users as any[])?.map((u: any) => ({ value: u.id, label: u.ho_ten }))}
              />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item label="Nhóm hàng" name="ten_nhom_hang">
              <Input placeholder="Nhóm hàng..." />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="Nội dung" name="noi_dung">
              <Input.TextArea rows={2} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Ghi chú" name="ghi_chu">
              <Input.TextArea rows={2} />
            </Form.Item>
          </Col>
        </Row>
      </Form>

      <Divider orientation="left" style={{ margin: '4px 0 8px' }}>Chi tiết đơn hàng</Divider>

      <Table
        size="small"
        rowKey="_key"
        columns={columns}
        dataSource={lines}
        pagination={false}
        scroll={{ x: 700 }}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={isGiay ? 6 : 5} align="right">
              <strong>Tổng:</strong>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="right">
              <strong>{tong.toLocaleString('vi-VN')}</strong>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={2} colSpan={2} />
          </Table.Summary.Row>
        )}
      />

      <Button
        icon={<PlusOutlined />}
        style={{ marginTop: 8 }}
        onClick={addLine}
        size="small"
      >
        Thêm dòng
      </Button>
    </Card>
  )
}
