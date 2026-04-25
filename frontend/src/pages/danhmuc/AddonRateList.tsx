import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, Form, Input, InputNumber, message, Modal, Popconfirm,
  Row, Space, Table, Tag, Tooltip, Typography,
} from 'antd'
import {
  EditOutlined, ReloadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { addonRatesApi, AddonRateItem } from '../../api/bom'

const { Text, Title } = Typography

const NHOM_LABELS: Record<string, string> = {
  d1: 'Chống thấm',
  d2: 'In Flexo (Dọc / Ngang)',
  d3: 'In kỹ thuật số',
  d4: 'Chạp / Xả',
  d5: 'Bồi',
  d6: 'Bế khuôn',
  d7: 'Dán / Ghim',
  d8: 'Cán màng',
  d9: 'Sản phẩm khó (% tỷ lệ)',
}

const DON_VI_LABELS: Record<string, string> = { m2: 'đ/m²', pcs: 'đ/cái', pct: '%' }

const NHOM_COLORS: Record<string, string> = {
  d1: 'cyan',
  d2: 'blue',
  d3: 'geekblue',
  d4: 'purple',
  d5: 'magenta',
  d6: 'red',
  d7: 'orange',
  d8: 'gold',
  d9: 'green',
}

interface EditForm {
  ten: string
  don_gia: number
  ghi_chu: string
}

export default function AddonRateList() {
  const qc = useQueryClient()
  const [editItem, setEditItem] = useState<AddonRateItem | null>(null)
  const [form] = Form.useForm<EditForm>()

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['addon-rates'],
    queryFn: () => addonRatesApi.list().then(r => r.data),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { ten?: string; don_gia?: number; ghi_chu?: string } }) =>
      addonRatesApi.update(id, data),
    onSuccess: () => {
      message.success('Đã cập nhật khoản mục')
      setEditItem(null)
      qc.invalidateQueries({ queryKey: ['addon-rates'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi cập nhật'),
  })

  const handleEdit = (r: AddonRateItem) => {
    setEditItem(r)
    form.setFieldsValue({
      ten: r.ten,
      don_gia: Number(r.don_gia),
      ghi_chu: r.ghi_chu ?? '',
    })
  }

  const handleSave = async () => {
    if (!editItem) return
    const vals = await form.validateFields()
    updateMut.mutate({
      id: editItem.id,
      data: { ten: vals.ten, don_gia: vals.don_gia, ghi_chu: vals.ghi_chu || undefined },
    })
  }

  const seedMut = useMutation({
    mutationFn: () => addonRatesApi.seed(),
    onSuccess: () => {
      message.success('Đã reset về mặc định')
      qc.invalidateQueries({ queryKey: ['addon-rates'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi reset'),
  })

  // Group by nhom
  const nhomKeys = Object.keys(NHOM_LABELS)
  const grouped = nhomKeys.map(nhom => ({
    nhom,
    label: NHOM_LABELS[nhom],
    items: items.filter(i => i.nhom === nhom),
  }))

  const cols: ColumnsType<AddonRateItem> = [
    {
      title: 'STT',
      dataIndex: 'thu_tu',
      width: 50,
      align: 'center',
      render: (v: number) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Khoản mục',
      dataIndex: 'ten',
      render: (v: string, r: AddonRateItem) => (
        <span>
          <Text style={{ fontSize: 13 }}>{v}</Text>
          {r.ghi_chu && (
            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
              {r.ghi_chu}
            </Text>
          )}
        </span>
      ),
    },
    {
      title: 'Đơn vị',
      dataIndex: 'don_vi',
      width: 70,
      align: 'center',
      render: (v: string) => (
        <Tag style={{ fontSize: 11 }}>{DON_VI_LABELS[v] ?? v}</Tag>
      ),
    },
    {
      title: 'Đơn giá',
      dataIndex: 'don_gia',
      width: 160,
      align: 'right',
      render: (v: number, r: AddonRateItem) => {
        const unit = DON_VI_LABELS[r.don_vi] ?? r.don_vi
        const formatted = r.don_vi === 'pct'
          ? `${Number(v)}%`
          : `${new Intl.NumberFormat('vi-VN').format(Number(v))} ${unit}`
        return (
          <Text strong style={{ fontSize: 13 }}>
            {formatted}
          </Text>
        )
      },
    },
    {
      title: '',
      width: 60,
      align: 'center',
      render: (_: unknown, r: AddonRateItem) => (
        <Tooltip title="Sửa khoản mục">
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(r)}
          />
        </Tooltip>
      ),
    },
  ]

  if (items.length === 0 && !isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <Card>
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <Title level={5} type="secondary">Chưa có dữ liệu phí gia công</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              Bấm "Khởi tạo mặc định" để seed dữ liệu từ hệ thống.
            </Text>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              loading={seedMut.isPending}
              onClick={() => seedMut.mutate()}
            >
              Khởi tạo mặc định
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>Phí gia công / dịch vụ thêm</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Đơn giá các dịch vụ gia công — ảnh hưởng trực tiếp đến giá thành sản phẩm
          </Text>
        </Col>
        <Col>
          <Popconfirm
            title="Reset toàn bộ về giá trị mặc định?"
            description="Mọi thay đổi trước đó sẽ bị mất."
            onConfirm={() => seedMut.mutate()}
            okText="Reset"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button icon={<ReloadOutlined />} loading={seedMut.isPending}>
              Reset mặc định
            </Button>
          </Popconfirm>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {grouped.map(({ nhom, label, items: nhomItems }) => {
          if (nhomItems.length === 0) return null
          const color = NHOM_COLORS[nhom] || 'default'
          return (
            <Col xs={24} lg={12} key={nhom}>
              <Card
                size="small"
                title={
                  <Space>
                    <Tag color={color} style={{ fontWeight: 700, fontSize: 13 }}>
                      {nhom.toUpperCase()}
                    </Tag>
                    <Text style={{ fontSize: 13 }}>{label}</Text>
                  </Space>
                }
              >
                <Table<AddonRateItem>
                  rowKey="id"
                  dataSource={nhomItems}
                  columns={cols}
                  loading={isLoading}
                  size="small"
                  pagination={false}
                />
              </Card>
            </Col>
          )
        })}
      </Row>

      <Card size="small" style={{ marginTop: 16, background: '#f6ffed', borderColor: '#b7eb8f' }}>
        <Text style={{ fontSize: 12 }}>
          <strong>Lưu ý:</strong> Thay đổi đơn giá sẽ áp dụng ngay cho các tính toán BOM mới.
          Dữ liệu BOM đã lưu trước đó không bị ảnh hưởng.
          Phí d9 (Sản phẩm khó) là tỷ lệ % nhân với (Chi phí giấy + Chi phí gián tiếp + Chi phí hao hụt).
          Phí d7 (Dán / Ghim) là đơn giá cố định theo đ/cái.
        </Text>
      </Card>

      {/* Modal chỉnh sửa khoản mục */}
      <Modal
        open={!!editItem}
        title={
          <Space>
            <Tag color={NHOM_COLORS[editItem?.nhom ?? ''] || 'default'}>
              {editItem?.nhom?.toUpperCase()}
            </Tag>
            <span>Chỉnh sửa khoản mục</span>
          </Space>
        }
        onCancel={() => setEditItem(null)}
        onOk={handleSave}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={updateMut.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            label="Tên khoản mục"
            name="ten"
            rules={[{ required: true, message: 'Nhập tên khoản mục' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label={`Đơn giá (${DON_VI_LABELS[editItem?.don_vi ?? ''] ?? editItem?.don_vi})`}
            name="don_gia"
            rules={[{ required: true, message: 'Nhập đơn giá' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              step={editItem?.don_vi === 'pct' ? 0.1 : 1}
              precision={editItem?.don_vi === 'pct' ? 2 : 0}
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>
          <Form.Item label="Ghi chú" name="ghi_chu">
            <Input.TextArea rows={2} placeholder="Ghi chú / mô tả công thức tính (tuỳ chọn)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
