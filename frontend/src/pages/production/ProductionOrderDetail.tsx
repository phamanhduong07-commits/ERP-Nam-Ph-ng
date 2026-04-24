import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient, useQueries } from '@tanstack/react-query'
import {
  Card, Descriptions, Tag, Button, Space, Table, Typography,
  Row, Col, Divider, Popconfirm, message, Progress, InputNumber,
  Statistic, Tabs, Collapse, Drawer,
} from 'antd'
import {
  ArrowLeftOutlined, PlayCircleOutlined, CheckCircleOutlined,
  CloseOutlined, SaveOutlined, CalculatorOutlined, EditOutlined,
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
import BomResultView from './BomResultView'
import SxParamsTab from './SxParamsTab'
import { bomApi } from '../../api/bom'

const { Title, Text } = Typography

interface Props {
  orderId?: number
  embedded?: boolean
}

export default function ProductionOrderDetail({ orderId, embedded = false }: Props) {
  const params = useParams<{ id: string }>()
  const id = orderId ?? (params.id ? Number(params.id) : undefined)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [editingProgress, setEditingProgress] = useState<Record<number, number>>({})
  const [editingBomItemId, setEditingBomItemId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState('lap-lenh')
  const [savingProgress, setSavingProgress] = useState<number | null>(null)

  const { data: order, isLoading } = useQuery({
    queryKey: ['production-order', id],
    queryFn: () => productionOrdersApi.get(Number(id)).then((r) => r.data),
    enabled: !!id,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['production-order', id] })

  const bomStatusQueries = useQueries({
    queries: (order?.items ?? []).map(item => ({
      queryKey: ['bom-by-item', item.id] as const,
      queryFn: () => bomApi.getByItem(item.id).then(r => ({
        itemId: item.id,
        bomId: r.data.id,
        trang_thai: r.data.trang_thai,
        gia_ban_cuoi: r.data.gia_ban_cuoi,
      })),
      retry: false,
      enabled: !!order,
      staleTime: Infinity,
    })),
  })

  const bomStatusMap = Object.fromEntries(
    bomStatusQueries.filter(q => q.data).map(q => [q.data!.itemId, q.data!])
  )

  const handleStart = async () => {
    try {
      await productionOrdersApi.start(Number(id))
      message.success('Đã bắt đầu sản xuất')
      invalidate()
    } catch {
      message.error('Thất bại')
    }
  }

  const handleComplete = async () => {
    try {
      await productionOrdersApi.complete(Number(id))
      message.success('Lệnh hoàn thành')
      invalidate()
    } catch {
      message.error('Thất bại')
    }
  }

  const handleCancel = async () => {
    try {
      await productionOrdersApi.cancel(Number(id))
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
      await productionOrdersApi.updateItemProgress(Number(id), itemId, val)
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

  const renderKetCau = (r: ProductionOrderItem) => {
    const d = r.dai ?? r.product?.dai
    const rr = r.rong ?? r.product?.rong
    const c = r.cao ?? r.product?.cao
    const layers = [
      { label: 'Mặt ngoài', code: r.mat,    dl: r.mat_dl },
      { label: 'Sóng 1',   code: r.song_1,  dl: r.song_1_dl },
      { label: 'Mặt 1',    code: r.mat_1,   dl: r.mat_1_dl },
      { label: 'Sóng 2',   code: r.song_2,  dl: r.song_2_dl },
      { label: 'Mặt 2',    code: r.mat_2,   dl: r.mat_2_dl },
      { label: 'Sóng 3',   code: r.song_3,  dl: r.song_3_dl },
      { label: 'Mặt trong',code: r.mat_3,   dl: r.mat_3_dl },
    ].filter(l => l.dl)

    if (!d && !layers.length) return null
    return (
      <div style={{ padding: '6px 0', fontSize: 12, color: '#595959' }}>
        {d && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.loai_thung && <Tag style={{ fontSize: 11 }}>{r.loai_thung}</Tag>}
            {d}×{rr}×{c} cm &nbsp;·&nbsp; {r.so_lop ?? '?'} lớp
            {r.to_hop_song ? ` (${r.to_hop_song})` : ''}
          </Text>
        )}
        {layers.length > 0 && (
          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {layers.map(l => `${l.label}: ${l.code || '?'} ${l.dl}g/m²`).join(' / ')}
            </Text>
          </div>
        )}
        {r.gia_ban_muc_tieu != null && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            Giá mục tiêu: {new Intl.NumberFormat('vi-VN').format(r.gia_ban_muc_tieu)} đ
          </Text>
        )}
      </div>
    )
  }

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
      width: 110,
      align: 'center',
      render: (_, r) => {
        const bomInfo = bomStatusMap[r.id]
        return (
          <Space direction="vertical" size={2} align="center">
            {bomInfo && (
              <Tag
                color={bomInfo.trang_thai === 'confirmed' ? 'success' : 'processing'}
                style={{ fontSize: 11, margin: 0 }}
              >
                {bomInfo.trang_thai === 'confirmed' ? '✓ Đã duyệt' : 'Nháp'}
              </Tag>
            )}
            <Button
              size="small"
              icon={<CalculatorOutlined />}
              type={bomInfo ? 'default' : 'dashed'}
              onClick={() => setEditingBomItemId(r.id)}
            >
              {bomInfo ? 'Xem/Sửa BOM' : 'Tính BOM'}
            </Button>
          </Space>
        )
      },
    },
  ]

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        {!embedded && (
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/production/orders')}>
            Quay lại
          </Button>
        )}
        <Title level={4} style={{ margin: 0 }}>
          {embedded ? order.so_lenh : `Lệnh sản xuất: ${order.so_lenh}`}
        </Title>
        <Tag color={TRANG_THAI_COLORS[order.trang_thai]}>{TRANG_THAI_LABELS[order.trang_thai]}</Tag>
      </Space>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} md={embedded ? 24 : 16}>
          <Card>
            <Descriptions column={embedded ? 1 : 2} size="small" bordered>
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
              {order.ghi_chu && (
                <Descriptions.Item label="Ghi chú" span={2}>
                  {order.ghi_chu}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </Col>

        {!embedded && (
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
        )}
      </Row>

      {embedded && (
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={8} align="middle">
            <Col flex="auto">
              <Progress
                percent={pct}
                status={pct === 100 ? 'success' : 'active'}
                format={() => `${tong_hoan_thanh.toLocaleString('vi-VN')} / ${tong_ke_hoach.toLocaleString('vi-VN')}`}
              />
            </Col>
            <Col>
              <Space size={4}>
                {order.trang_thai === 'moi' && (
                  <Popconfirm title="Bắt đầu sản xuất?" onConfirm={handleStart} okText="Bắt đầu">
                    <Button size="small" type="primary" icon={<PlayCircleOutlined />}>Bắt đầu</Button>
                  </Popconfirm>
                )}
                {['moi', 'dang_chay'].includes(order.trang_thai) && (
                  <Popconfirm title="Hoàn thành lệnh SX?" onConfirm={handleComplete} okText="Hoàn thành">
                    <Button size="small" icon={<CheckCircleOutlined />} style={{ color: 'green', borderColor: 'green' }}>
                      Hoàn thành
                    </Button>
                  </Popconfirm>
                )}
                {['moi', 'dang_chay'].includes(order.trang_thai) && (
                  <Popconfirm title="Huỷ lệnh?" onConfirm={handleCancel} okText="Huỷ" okButtonProps={{ danger: true }}>
                    <Button size="small" danger icon={<CloseOutlined />}>Huỷ</Button>
                  </Popconfirm>
                )}
              </Space>
            </Col>
          </Row>
        </Card>
      )}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'lap-lenh',
            label: (
              <Space size={4}>
                <EditOutlined />
                Lập lệnh SX
              </Space>
            ),
            children: (
              <SxParamsTab orderId={order.id} items={order.items} />
            ),
          },
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
                  expandable={{
                    expandedRowRender: (r) => renderKetCau(r),
                    rowExpandable: (r) => !!(r.dai || r.mat_dl || r.song_1_dl),
                    showExpandColumn: true,
                  }}
                />
              </Card>
            ),
          },
          {
            key: 'bom',
            label: (
              <Space size={4}>
                <CalculatorOutlined />
                Định mức (BOM)
              </Space>
            ),
            children: (
              <>
                <Collapse
                  defaultActiveKey={order.items.map(i => String(i.id))}
                  style={{ background: 'transparent' }}
                  items={order.items.map(item => {
                    const bomInfo = bomStatusMap[item.id]
                    return {
                      key: String(item.id),
                      label: (
                        <Row align="middle" wrap={false} style={{ width: '100%' }}>
                          <Col flex="auto">
                            <Space size={8}>
                              <Text strong style={{ fontSize: 13 }}>{item.ten_hang}</Text>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {new Intl.NumberFormat('vi-VN').format(Number(item.so_luong_ke_hoach))} {item.dvt}
                              </Text>
                              {item.product?.ma_amis && (
                                <Text type="secondary" style={{ fontSize: 11 }}>[{item.product.ma_amis}]</Text>
                              )}
                              {bomInfo ? (
                                <Tag
                                  color={bomInfo.trang_thai === 'confirmed' ? 'success' : 'processing'}
                                  style={{ fontSize: 11, margin: 0 }}
                                >
                                  {bomInfo.trang_thai === 'confirmed' ? '✓ Đã duyệt' : 'Nháp'}
                                </Tag>
                              ) : (
                                <Tag style={{ fontSize: 11, margin: 0 }}>Chưa có BOM</Tag>
                              )}
                            </Space>
                          </Col>
                          <Col>
                            <Button
                              size="small"
                              type={bomInfo ? 'default' : 'primary'}
                              icon={<CalculatorOutlined />}
                              onClick={e => { e.stopPropagation(); setEditingBomItemId(item.id) }}
                              style={{ marginRight: 8 }}
                            >
                              {bomInfo ? 'Sửa BOM' : 'Tính BOM'}
                            </Button>
                          </Col>
                        </Row>
                      ),
                      children: <BomResultView key={item.id} productionOrderItemId={item.id} />,
                    }
                  })}
                />

                {/* Drawer — BOM calculator with full save functionality */}
                <Drawer
                  open={!!editingBomItemId}
                  onClose={() => setEditingBomItemId(null)}
                  width={Math.min(1200, window.innerWidth - 48)}
                  title={
                    editingBomItemId
                      ? `Định mức BOM — ${order.items.find(i => i.id === editingBomItemId)?.ten_hang ?? ''}`
                      : 'Định mức BOM'
                  }
                  destroyOnClose
                  bodyStyle={{ padding: 0 }}
                >
                  {editingBomItemId && (
                    <BomCalculatorPanel
                      key={editingBomItemId}
                      production_order_item_id={editingBomItemId}
                      onBomSaved={() => {
                        qc.invalidateQueries({ queryKey: ['bom-by-item', editingBomItemId] })
                        qc.invalidateQueries({ queryKey: ['bom-from-poi', editingBomItemId] })
                      }}
                    />
                  )}
                </Drawer>
              </>
            ),
          },
        ]}
      />
    </div>
  )
}
