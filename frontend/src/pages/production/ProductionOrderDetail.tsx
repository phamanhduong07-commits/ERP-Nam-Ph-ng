import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Card, Descriptions, Tag, Button, Space, Table, Typography,
  Row, Col, Divider, Popconfirm, message, Progress, InputNumber,
  Statistic, Tabs,
} from 'antd'
import {
  ArrowLeftOutlined, PlayCircleOutlined, CheckCircleOutlined,
  CloseOutlined, SaveOutlined, CalculatorOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import {
  productionOrdersApi,
  TRANG_THAI_LABELS,
  TRANG_THAI_COLORS,
} from '../../api/productionOrders'
import type { ProductionOrderItem } from '../../api/productionOrders'
import BomCalculatorPanel from './BomCalculatorPanel'

const { Title, Text } = Typography

export default function ProductionOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const orderId = Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [editingProgress, setEditingProgress] = useState<Record<number, number>>({})
  const [bomItemId, setBomItemId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState('san-pham')
  const [savingProgress, setSavingProgress] = useState<number | null>(null)

  const { data: order, isLoading } = useQuery({
    queryKey: ['production-order', orderId],
    queryFn: () => productionOrdersApi.get(orderId).then((r) => r.data),
    enabled: !!orderId,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['production-order', orderId] })

  const handleStart = async () => {
    try {
      await productionOrdersApi.start(orderId)
      message.success('Đã bắt đầu sản xuất')
      invalidate()
    } catch {
      message.error('Thất bại')
    }
  }

  const handleComplete = async () => {
    try {
      await productionOrdersApi.complete(orderId)
      message.success('Lệnh hoàn thành')
      invalidate()
    } catch {
      message.error('Thất bại')
    }
  }

  const handleCancel = async () => {
    try {
      await productionOrdersApi.cancel(orderId)
      message.success('Đã huỷ lệnh')
      invalidate()
    } catch {
      message.error('Thất bại')
    }
  }

  const handleSaveProgress = async (itemId: number) => {
    const val = editingProgress[itemId]
    if (val === undefined) return
    setSavingProgress(itemId)
    try {
      await productionOrdersApi.updateItemProgress(orderId, itemId, val)
      message.success('Cập nhật tiến độ thành công')
      setEditingProgress((prev) => {
        const next = { ...prev }
        delete next[itemId]
        return next
      })
      invalidate()
    } catch {
      message.error('Thất bại')
    } finally {
      setSavingProgress(null)
    }
  }

  if (isLoading || !order) return <Card loading />

  const canEdit = ['moi', 'dang_chay'].includes(order.trang_thai)

  const tong_ke_hoach = order.items.reduce((s, i) => s + Number(i.so_luong_ke_hoach), 0)
  const tong_hoan_thanh = order.items.reduce((s, i) => s + Number(i.so_luong_hoan_thanh), 0)
  const pct = tong_ke_hoach > 0 ? Math.round((tong_hoan_thanh / tong_ke_hoach) * 100) : 0

  const columns: ColumnsType<ProductionOrderItem> = [
    {
      title: 'Sản phẩm',
      dataIndex: 'ten_hang',
      ellipsis: true,
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 13 }}>{v}</Text>
          {r.product && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              [{r.product.ma_amis}]
              {r.product.dai ? ` ${r.product.dai}×${r.product.rong}×${r.product.cao}cm` : ''}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'ĐVT',
      dataIndex: 'dvt',
      width: 80,
    },
    {
      title: 'SL kế hoạch',
      dataIndex: 'so_luong_ke_hoach',
      width: 120,
      align: 'right',
      render: (v) => <Text strong>{new Intl.NumberFormat('vi-VN').format(Number(v))}</Text>,
    },
    {
      title: 'SL hoàn thành',
      width: 200,
      render: (_, r) => {
        const isEditing = r.id in editingProgress
        const val = isEditing ? editingProgress[r.id] : Number(r.so_luong_hoan_thanh)
        const pctItem =
          Number(r.so_luong_ke_hoach) > 0
            ? Math.round((Number(r.so_luong_hoan_thanh) / Number(r.so_luong_ke_hoach)) * 100)
            : 0
        return (
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            {canEdit ? (
              <Space size={4}>
                <InputNumber
                  min={0}
                  max={Number(r.so_luong_ke_hoach)}
                  value={val}
                  style={{ width: 100 }}
                  size="small"
                  onChange={(v) =>
                    setEditingProgress((prev) => ({ ...prev, [r.id]: v || 0 }))
                  }
                />
                {isEditing && (
                  <Button
                    size="small"
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={savingProgress === r.id}
                    onClick={() => handleSaveProgress(r.id)}
                  />
                )}
              </Space>
            ) : (
              <Text>{new Intl.NumberFormat('vi-VN').format(Number(r.so_luong_hoan_thanh))}</Text>
            )}
            <Progress percent={pctItem} size="small" showInfo={false} />
          </Space>
        )
      },
    },
    {
      title: 'Ngày giao',
      dataIndex: 'ngay_giao_hang',
      width: 110,
      render: (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '—'),
    },
    {
      title: 'Ghi chú',
      dataIndex: 'ghi_chu',
      ellipsis: true,
      render: (v) => v || '—',
    },
    {
      title: 'BOM',
      width: 90,
      align: 'center',
      render: (_, r) => (
        <Button
          size="small"
          icon={<CalculatorOutlined />}
          onClick={() => {
            setBomItemId(r.id)
            setActiveTab('bom')
          }}
        >
          Tính BOM
        </Button>
      ),
    },
  ]

  const selectedItem = order.items.find((i) => i.id === bomItemId)

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/production/orders')}>
          Quay lại
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          Lệnh sản xuất: {order.so_lenh}
        </Title>
        <Tag color={TRANG_THAI_COLORS[order.trang_thai]}>{TRANG_THAI_LABELS[order.trang_thai]}</Tag>
      </Space>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} md={16}>
          <Card>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Số lệnh">{order.so_lenh}</Descriptions.Item>
              <Descriptions.Item label="Ngày lệnh">
                {dayjs(order.ngay_lenh).format('DD/MM/YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Đơn hàng liên kết">
                {order.so_don ? (
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0 }}
                    onClick={() => navigate(`/sales/orders/${order.sales_order_id}`)}
                  >
                    {order.so_don}
                  </Button>
                ) : (
                  '—'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={TRANG_THAI_COLORS[order.trang_thai]}>
                  {TRANG_THAI_LABELS[order.trang_thai]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Bắt đầu (KH)">
                {order.ngay_bat_dau_ke_hoach
                  ? dayjs(order.ngay_bat_dau_ke_hoach).format('DD/MM/YYYY')
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Hoàn thành (KH)">
                {order.ngay_hoan_thanh_ke_hoach
                  ? dayjs(order.ngay_hoan_thanh_ke_hoach).format('DD/MM/YYYY')
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Bắt đầu (TT)">
                {order.ngay_bat_dau_thuc_te
                  ? dayjs(order.ngay_bat_dau_thuc_te).format('DD/MM/YYYY')
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Hoàn thành (TT)">
                {order.ngay_hoan_thanh_thuc_te
                  ? dayjs(order.ngay_hoan_thanh_thuc_te).format('DD/MM/YYYY')
                  : '—'}
              </Descriptions.Item>
              {order.ghi_chu && (
                <Descriptions.Item label="Ghi chú" span={2}>
                  {order.ghi_chu}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card>
            <Row gutter={8}>
              <Col span={12}>
                <Statistic
                  title="Tổng SL kế hoạch"
                  value={tong_ke_hoach}
                  formatter={(v) => new Intl.NumberFormat('vi-VN').format(Number(v))}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Đã hoàn thành"
                  value={tong_hoan_thanh}
                  valueStyle={{ color: pct === 100 ? '#3f8600' : '#1677ff' }}
                  formatter={(v) => new Intl.NumberFormat('vi-VN').format(Number(v))}
                />
              </Col>
            </Row>
            <Divider style={{ margin: '12px 0' }} />
            <Progress
              percent={pct}
              status={pct === 100 ? 'success' : 'active'}
              strokeColor={pct === 100 ? '#52c41a' : '#1677ff'}
            />
          </Card>

          <Card style={{ marginTop: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {order.trang_thai === 'moi' && (
                <Popconfirm title="Bắt đầu sản xuất lệnh này?" onConfirm={handleStart} okText="Bắt đầu">
                  <Button type="primary" icon={<PlayCircleOutlined />} block>
                    Bắt đầu sản xuất
                  </Button>
                </Popconfirm>
              )}
              {['moi', 'dang_chay'].includes(order.trang_thai) && (
                <Popconfirm title="Hoàn thành lệnh SX?" onConfirm={handleComplete} okText="Hoàn thành">
                  <Button icon={<CheckCircleOutlined />} block style={{ color: 'green', borderColor: 'green' }}>
                    Hoàn thành
                  </Button>
                </Popconfirm>
              )}
              {['moi', 'dang_chay'].includes(order.trang_thai) && (
                <Popconfirm title="Huỷ lệnh sản xuất?" onConfirm={handleCancel} okText="Huỷ" okButtonProps={{ danger: true }}>
                  <Button danger icon={<CloseOutlined />} block>
                    Huỷ lệnh
                  </Button>
                </Popconfirm>
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'san-pham',
            label: `Chi tiết sản phẩm (${order.items.length} dòng)`,
            children: (
              <Card>
                {canEdit && (
                  <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
                    Nhập SL hoàn thành rồi nhấn <SaveOutlined /> để cập nhật — nhấn{' '}
                    <CalculatorOutlined /> để tính BOM cho từng dòng
                  </Text>
                )}
                <Table
                  columns={columns}
                  dataSource={order.items}
                  rowKey="id"
                  pagination={false}
                  size="middle"
                  scroll={{ x: 900 }}
                />
              </Card>
            ),
          },
          {
            key: 'bom',
            label: (
              <Space size={4}>
                <CalculatorOutlined />
                Tính BOM / Giá thành
                {bomItemId && (
                  <Tag color="blue" style={{ marginLeft: 4, fontSize: 11 }}>
                    {selectedItem?.ten_hang?.slice(0, 20) || `Dòng #${bomItemId}`}
                  </Tag>
                )}
              </Space>
            ),
            children: (
              <BomCalculatorPanel
                key={bomItemId ?? 'no-item'}
                production_order_item_id={bomItemId ?? undefined}
                initialValues={
                  selectedItem
                    ? {
                        loai_thung: 'A1',
                        dai: selectedItem.product?.dai ?? undefined,
                        rong: selectedItem.product?.rong ?? undefined,
                        cao: selectedItem.product?.cao ?? undefined,
                        so_lop: selectedItem.product?.so_lop,
                        so_luong: Number(selectedItem.so_luong_ke_hoach),
                      }
                    : undefined
                }
                onBomSaved={() => {
                  message.success('Đã xác nhận BOM')
                }}
              />
            ),
          },
        ]}
      />
    </div>
  )
}
