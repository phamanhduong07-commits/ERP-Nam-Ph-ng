import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Col, Drawer, Empty, Menu, Progress, Row,
  Space, Spin, Statistic, Table, Tag, Tooltip, Typography, message,
} from 'antd'
import {
  InboxOutlined, PlusOutlined, ReloadOutlined, WarningOutlined,
} from '@ant-design/icons'
import { warehouseApi } from '../../api/warehouse'
import type { WarehouseSlot, WarehouseSlotNA, PhanXuongWithWarehouses, TonKho } from '../../api/warehouse'

const { Title, Text } = Typography

// Chỉ hiển thị kho NVL (giấy cuộn + NVL phụ)
const NVL_LOAI = ['GIAY_CUON', 'NVL_PHU'] as const
type NvlLoai = (typeof NVL_LOAI)[number]

const LOAI_CONFIG: Record<NvlLoai, { label: string; color: string; note: string }> = {
  GIAY_CUON: { label: 'Kho giấy cuộn', color: '#1677ff', note: 'Xưởng CD1+CD2' },
  NVL_PHU:   { label: 'Kho NVL phụ',   color: '#fa8c16', note: 'Tất cả xưởng' },
}

function fmtMoney(v: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(v)
}
function fmtN(v: number) {
  return new Intl.NumberFormat('vi-VN').format(v)
}
function progressColor(pct: number) {
  if (pct > 90) return '#ff4d4f'
  if (pct > 70) return '#faad14'
  return '#52c41a'
}
function isNA(slot: WarehouseSlot | WarehouseSlotNA | null | undefined): slot is WarehouseSlotNA {
  return slot !== null && slot !== undefined && 'not_applicable' in slot
}

function WarehouseCard({
  loai,
  slot,
  onInit,
  onDetail,
}: {
  loai: NvlLoai
  slot: WarehouseSlot | WarehouseSlotNA | null | undefined
  onInit?: () => void
  onDetail?: (slot: WarehouseSlot) => void
}) {
  const cfg = LOAI_CONFIG[loai]
  const [hovered, setHovered] = useState(false)

  if (isNA(slot)) {
    return (
      <div style={{
        border: '1px dashed #d9d9d9', borderRadius: 8, padding: 16,
        background: '#fafafa', minHeight: 150, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
        <Tag color="default">{cfg.label}</Tag>
        <Text type="secondary" style={{ fontSize: 12 }}>Không áp dụng cho xưởng CD2</Text>
        <Text type="secondary" style={{ fontSize: 11 }}>{cfg.note}</Text>
      </div>
    )
  }

  if (!slot) {
    return (
      <div style={{
        border: '1px dashed #faad14', borderRadius: 8, padding: 16,
        background: '#fffbe6', minHeight: 150, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <WarningOutlined style={{ color: '#faad14', fontSize: 20 }} />
        <Tag color="orange">{cfg.label}</Tag>
        <Text type="secondary" style={{ fontSize: 12 }}>Chưa có kho</Text>
        {onInit && (
          <Button size="small" type="primary" ghost icon={<PlusOutlined />} onClick={onInit}>
            Tạo kho
          </Button>
        )}
      </div>
    )
  }

  const pct = slot.phan_tram_lap_day
  return (
    <div
      style={{
        border: `1px solid ${hovered ? cfg.color : cfg.color + '40'}`,
        borderRadius: 8, padding: 16, background: '#fff', minHeight: 150,
        cursor: 'pointer',
        boxShadow: hovered ? `0 2px 8px ${cfg.color}30` : undefined,
        transition: 'box-shadow 0.2s, border-color 0.2s',
      }}
      onClick={() => onDetail?.(slot)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Tag color={cfg.color} style={{ marginRight: 0, fontWeight: 600 }}>{cfg.label}</Tag>
          <Tooltip title={slot.ten_kho}>
            <Text type="secondary" style={{ fontSize: 11 }}>{slot.ma_kho}</Text>
          </Tooltip>
        </div>

        <Row gutter={8}>
          <Col span={12}>
            <Statistic
              title={<span style={{ fontSize: 11 }}>Mặt hàng</span>}
              value={slot.tong_so_mat_hang}
              valueStyle={{ fontSize: 18 }}
            />
          </Col>
          <Col span={12}>
            <Statistic
              title={<span style={{ fontSize: 11 }}>Giá trị tồn</span>}
              value={slot.tong_gia_tri}
              formatter={v => fmtMoney(Number(v))}
              valueStyle={{ fontSize: 13, color: '#52c41a' }}
            />
          </Col>
        </Row>

        {pct !== null ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <Text style={{ fontSize: 11 }}>
                {fmtN(slot.tong_so_luong)} {slot.don_vi_suc_chua ?? ''}
              </Text>
              <Text style={{ fontSize: 11, color: progressColor(pct) }}>{pct.toFixed(1)}%</Text>
            </div>
            <Progress
              percent={Math.min(pct, 100)}
              showInfo={false}
              strokeColor={progressColor(pct)}
              size="small"
            />
          </div>
        ) : (
          <Text type="secondary" style={{ fontSize: 11 }}>
            {fmtN(slot.tong_so_luong)} {slot.don_vi_suc_chua ?? ''} (chưa cấu hình sức chứa)
          </Text>
        )}
      </Space>
    </div>
  )
}

export default function KhoNVLPage() {
  const queryClient = useQueryClient()
  const [selectedPxId, setSelectedPxId] = useState<number | 'all'>('all')
  const [detailSlot, setDetailSlot] = useState<WarehouseSlot | null>(null)

  const { data: list = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['kho-theo-xuong'],
    queryFn: () => warehouseApi.listTheoPhanXuong().then(r => r.data),
    refetchInterval: 60_000,
    retry: 3,
  })

  const { data: detailItems = [], isFetching: detailLoading } = useQuery<TonKho[]>({
    queryKey: ['ton-kho-detail', detailSlot?.id],
    queryFn: () => warehouseApi.getTonKho({ warehouse_id: detailSlot!.id }).then(r => r.data),
    enabled: !!detailSlot,
    staleTime: 30_000,
  })

  const initMut = useMutation({
    mutationFn: (pxId: number) => warehouseApi.initWarehousesForPhanXuong(pxId),
    onSuccess: (res) => {
      const created = res.data.filter(r => r.created).length
      message.success(`Đã tạo ${created} kho mới`)
      queryClient.invalidateQueries({ queryKey: ['kho-theo-xuong'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi khởi tạo kho'),
  })

  const displayList = selectedPxId === 'all' ? list : list.filter(px => px.id === selectedPxId)

  // Chỉ tính giá trị từ kho GIAY_CUON + NVL_PHU
  const totalGiaTri = list.reduce((sum, px) => {
    const gc = px.warehouses.GIAY_CUON
    const nvl = px.warehouses.NVL_PHU
    const gcVal = gc && !isNA(gc) ? (gc as WarehouseSlot).tong_gia_tri : 0
    const nvlVal = nvl && !isNA(nvl) ? (nvl as WarehouseSlot).tong_gia_tri : 0
    return sum + gcVal + nvlVal
  }, 0)

  const totalMatHang = list.reduce((sum, px) => {
    const gc = px.warehouses.GIAY_CUON
    const nvl = px.warehouses.NVL_PHU
    const gcMH = gc && !isNA(gc) ? (gc as WarehouseSlot).tong_so_mat_hang : 0
    const nvlMH = nvl && !isNA(nvl) ? (nvl as WarehouseSlot).tong_so_mat_hang : 0
    return sum + gcMH + nvlMH
  }, 0)

  const drawerSlotCfg = detailSlot
    ? LOAI_CONFIG[detailSlot.loai_kho as NvlLoai] ?? { label: detailSlot.loai_kho, color: '#1677ff' }
    : null
  const totalDetailGiaTri = detailItems.reduce((s, r) => s + (r.gia_tri_ton ?? 0), 0)
  const totalDetailSoLuong = detailItems.reduce((s, r) => s + (r.ton_luong ?? 0), 0)

  function getLoaiForFactory(px: PhanXuongWithWarehouses): NvlLoai[] {
    // cd1_cd2 (Hoàng Gia, Nam Thuận): có cả giấy cuộn + NVL phụ
    // cd2 (Củ Chi, Hóc Môn): chỉ có NVL phụ
    return px.cong_doan === 'cd1_cd2' ? ['GIAY_CUON', 'NVL_PHU'] : ['NVL_PHU']
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <InboxOutlined style={{ fontSize: 22, color: '#1677ff' }} />
          <Title level={4} style={{ margin: 0 }}>Kho Nguyên Vật Liệu</Title>
        </Space>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => queryClient.invalidateQueries({ queryKey: ['kho-theo-xuong'] })}
        >
          Làm mới
        </Button>
      </div>

      {/* Thống kê tổng */}
      {!isLoading && !isError && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={8}>
            <Card size="small">
              <Statistic
                title="Tổng giá trị NVL tồn"
                value={totalGiaTri}
                formatter={v => fmtMoney(Number(v))}
                valueStyle={{ color: '#1677ff', fontSize: 18 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8}>
            <Card size="small">
              <Statistic
                title="Tổng mặt hàng NVL"
                value={totalMatHang}
                valueStyle={{ fontSize: 18 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small">
              <Statistic
                title="Số xưởng"
                value={list.length}
                suffix="xưởng"
                valueStyle={{ fontSize: 18, color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : isError ? (
        <Empty
          description="Không tải được dữ liệu — thử bấm Làm mới"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" onClick={() => refetch()}>Tải lại</Button>
        </Empty>
      ) : list.length === 0 ? (
        <Empty description="Chưa có xưởng nào" />
      ) : (
        <Row gutter={[16, 0]} wrap={false} align="top">
          {/* Menu lọc xưởng */}
          <Col flex="200px" style={{ minWidth: 160 }}>
            <div style={{
              background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8,
              overflow: 'hidden', position: 'sticky', top: 16,
            }}>
              <div style={{ padding: '8px 16px', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                <Text strong style={{ fontSize: 12 }}>Xưởng sản xuất</Text>
              </div>
              <Menu
                mode="inline"
                inlineIndent={12}
                selectedKeys={[String(selectedPxId)]}
                style={{ border: 'none', fontSize: 13 }}
                onClick={({ key }) => setSelectedPxId(key === 'all' ? 'all' : Number(key))}
                items={[
                  {
                    key: 'all',
                    label: (
                      <span>
                        Tất cả
                        <Tag style={{ marginLeft: 6, fontSize: 10 }} color="default">{list.length}</Tag>
                      </span>
                    ),
                  },
                  ...list.map((px: PhanXuongWithWarehouses) => ({
                    key: String(px.id),
                    label: (
                      <div style={{ lineHeight: '1.4' }}>
                        <div>{px.ten_xuong}</div>
                        <Tag
                          color={px.cong_doan === 'cd1_cd2' ? 'blue' : 'green'}
                          style={{ fontSize: 10, margin: 0 }}
                        >
                          {px.cong_doan === 'cd1_cd2' ? 'CD1+CD2' : 'CD2'}
                        </Tag>
                      </div>
                    ),
                  })),
                ]}
              />
            </div>
          </Col>

          {/* Cards xưởng */}
          <Col flex="1" style={{ minWidth: 0 }}>
            {displayList.map((px: PhanXuongWithWarehouses) => {
              const loaiList = getLoaiForFactory(px)
              return (
                <Card
                  key={px.id}
                  style={{ marginBottom: 16 }}
                  title={
                    <Space>
                      <span>{px.ten_xuong}</span>
                      <Tag color={px.cong_doan === 'cd1_cd2' ? 'blue' : 'green'}>
                        {px.cong_doan === 'cd1_cd2' ? 'CD1 + CD2 (Giấy cuộn + NVL)' : 'CD2 (Chỉ NVL)'}
                      </Tag>
                      {!px.trang_thai && <Tag color="default">Ngừng</Tag>}
                    </Space>
                  }
                  extra={
                    <Button
                      size="small"
                      icon={<PlusOutlined />}
                      loading={initMut.isPending}
                      onClick={() => initMut.mutate(px.id)}
                    >
                      Khởi tạo kho
                    </Button>
                  }
                >
                  <Row gutter={[16, 16]}>
                    {loaiList.map(loai => (
                      <Col
                        key={loai}
                        xs={24}
                        sm={px.cong_doan === 'cd1_cd2' ? 12 : 24}
                        md={px.cong_doan === 'cd1_cd2' ? 12 : 10}
                      >
                        <WarehouseCard
                          loai={loai}
                          slot={(px.warehouses as any)[loai]}
                          onInit={() => initMut.mutate(px.id)}
                          onDetail={setDetailSlot}
                        />
                      </Col>
                    ))}
                  </Row>
                </Card>
              )
            })}
          </Col>
        </Row>
      )}

      {/* Drawer chi tiết tồn kho */}
      <Drawer
        title={
          <Space>
            {drawerSlotCfg && (
              <Tag color={drawerSlotCfg.color} style={{ marginRight: 0 }}>{drawerSlotCfg.label}</Tag>
            )}
            <span>{detailSlot?.ten_kho}</span>
            {detailSlot?.ma_kho && (
              <Text type="secondary" style={{ fontSize: 12 }}>{detailSlot.ma_kho}</Text>
            )}
          </Space>
        }
        open={!!detailSlot}
        onClose={() => setDetailSlot(null)}
        width={620}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={20}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="Giá trị tồn kho"
                  value={totalDetailGiaTri}
                  formatter={v => fmtMoney(Number(v))}
                  valueStyle={{ color: '#1677ff', fontSize: 16 }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Tổng số lượng"
                  value={totalDetailSoLuong}
                  formatter={v => fmtN(Number(v))}
                  suffix={detailSlot?.don_vi_suc_chua ?? ''}
                  valueStyle={{ color: '#389e0d', fontSize: 16 }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Số mặt hàng"
                  value={detailItems.length}
                  valueStyle={{ fontSize: 16 }}
                />
              </Col>
            </Row>

            {detailItems.length === 0 ? (
              <Empty
                description="Kho này chưa có hàng tồn kho"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <Table<TonKho>
                rowKey="id"
                size="small"
                dataSource={detailItems}
                pagination={{ pageSize: 20, showSizeChanger: false }}
                scroll={{ x: 500 }}
                columns={[
                  {
                    title: 'Tên NVL',
                    dataIndex: 'ten_hang',
                    ellipsis: true,
                    render: (v: string, r: TonKho) => (
                      <Space direction="vertical" size={0}>
                        <Text strong style={{ fontSize: 12 }}>{v}</Text>
                        {r.ton_luong < r.ton_toi_thieu && r.ton_toi_thieu > 0 && (
                          <Tag color="red" style={{ fontSize: 10 }}>
                            <WarningOutlined /> Dưới mức tối thiểu
                          </Tag>
                        )}
                      </Space>
                    ),
                  },
                  {
                    title: 'Tồn kho',
                    dataIndex: 'ton_luong',
                    width: 110,
                    align: 'right' as const,
                    sorter: (a: TonKho, b: TonKho) => a.ton_luong - b.ton_luong,
                    render: (v: number, r: TonKho) => (
                      <Space direction="vertical" size={0} style={{ lineHeight: 1.3 }}>
                        <Text
                          strong
                          style={{
                            color: v > 0
                              ? (v < r.ton_toi_thieu && r.ton_toi_thieu > 0 ? '#ff4d4f' : '#389e0d')
                              : '#aaa',
                            fontSize: 12,
                          }}
                        >
                          {fmtN(v)}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 10 }}>{r.don_vi}</Text>
                      </Space>
                    ),
                  },
                  {
                    title: 'Đơn giá BQ',
                    dataIndex: 'don_gia_binh_quan',
                    width: 120,
                    align: 'right' as const,
                    render: (v: number) => v > 0
                      ? <Text style={{ fontSize: 12 }}>{fmtMoney(v)}</Text>
                      : <Text type="secondary">—</Text>,
                  },
                  {
                    title: 'Giá trị tồn',
                    dataIndex: 'gia_tri_ton',
                    width: 130,
                    align: 'right' as const,
                    render: (v: number) => (
                      <Text strong style={{ color: v > 0 ? '#1677ff' : '#aaa', fontSize: 12 }}>
                        {v > 0 ? fmtMoney(v) : '—'}
                      </Text>
                    ),
                  },
                ]}
                summary={() => (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={2}>
                      <Text strong style={{ fontSize: 12 }}>Tổng cộng</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} />
                    <Table.Summary.Cell index={3} align="right">
                      <Text strong style={{ color: '#1677ff', fontSize: 12 }}>{fmtMoney(totalDetailGiaTri)}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            )}
          </Space>
        )}
      </Drawer>
    </div>
  )
}
