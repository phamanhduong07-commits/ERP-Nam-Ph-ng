import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Row, Col, Button, Drawer, Menu, Table, Typography, Tag,
  Progress, Spin, Empty, Space, Statistic, message, Tooltip,
} from 'antd'
import {
  PlusOutlined, ReloadOutlined, WarningOutlined,
} from '@ant-design/icons'
import { warehouseApi } from '../../api/warehouse'
import type { WarehouseSlot, WarehouseSlotNA, PhanXuongWithWarehouses, TonKho } from '../../api/warehouse'

const { Title, Text } = Typography

const LOAI_CONFIG: Record<string, { label: string; color: string }> = {
  GIAY_CUON:  { label: 'Kho giấy cuộn',  color: '#1677ff' },
  NVL_PHU:    { label: 'Kho NVL phụ',    color: '#fa8c16' },
  PHOI:       { label: 'Kho phôi sóng',  color: '#722ed1' },
  THANH_PHAM: { label: 'Kho thành phẩm', color: '#52c41a' },
}

const ALL_LOAI = ['GIAY_CUON', 'NVL_PHU', 'PHOI', 'THANH_PHAM']

function progressColor(pct: number) {
  if (pct > 90) return '#ff4d4f'
  if (pct > 70) return '#faad14'
  return '#52c41a'
}

function fmtMoney(v: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(v)
}

function fmtN(v: number) {
  return new Intl.NumberFormat('vi-VN').format(v)
}

function isNA(slot: WarehouseSlot | WarehouseSlotNA | null): slot is WarehouseSlotNA {
  return slot !== null && 'not_applicable' in slot
}

function WarehouseCard({
  loai, slot, onInit, onDetail,
}: {
  loai: string
  slot: WarehouseSlot | WarehouseSlotNA | null
  onInit?: () => void
  onDetail?: (slot: WarehouseSlot) => void
}) {
  const cfg = LOAI_CONFIG[loai]
  const [hovered, setHovered] = useState(false)

  if (isNA(slot)) {
    return (
      <div style={{
        border: '1px dashed #d9d9d9', borderRadius: 8, padding: 16,
        background: '#fafafa', minHeight: 140, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <Tag color="default">{cfg.label}</Tag>
        <Text type="secondary" style={{ fontSize: 12, marginTop: 8 }}>Không áp dụng</Text>
      </div>
    )
  }

  if (!slot) {
    return (
      <div style={{
        border: '1px dashed #faad14', borderRadius: 8, padding: 16,
        background: '#fffbe6', minHeight: 140, display: 'flex',
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
        borderRadius: 8, padding: 16, background: '#fff', minHeight: 140,
        cursor: 'pointer',
        boxShadow: hovered ? `0 2px 8px ${cfg.color}30` : undefined,
        transition: 'box-shadow 0.2s, border-color 0.2s',
      }}
      onClick={() => onDetail?.(slot)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Space direction="vertical" style={{ width: '100%' }} size={6}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Tag color={cfg.color} style={{ marginRight: 0 }}>{cfg.label}</Tag>
          <Tooltip title={slot.ten_kho}>
            <Text type="secondary" style={{ fontSize: 11 }}>{slot.ma_kho}</Text>
          </Tooltip>
        </div>

        <Row gutter={8}>
          <Col span={12}>
            <Statistic
              title={<span style={{ fontSize: 11 }}>Mặt hàng</span>}
              value={slot.tong_so_mat_hang}
              valueStyle={{ fontSize: 16 }}
            />
          </Col>
          <Col span={12}>
            <Statistic
              title={<span style={{ fontSize: 11 }}>Giá trị</span>}
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
                {slot.tong_so_luong.toLocaleString()} {slot.don_vi_suc_chua ?? ''}
              </Text>
              <Text style={{ fontSize: 11, color: progressColor(pct) }}>
                {pct.toFixed(1)}%
              </Text>
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
            {slot.tong_so_luong.toLocaleString()} {slot.don_vi_suc_chua ?? ''} (chưa cấu hình sức chứa)
          </Text>
        )}
      </Space>
    </div>
  )
}

export default function KhoTheoXuongPage() {
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
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi khi khởi tạo kho'),
  })

  const displayList = selectedPxId === 'all' ? list : list.filter(px => px.id === selectedPxId)

  const totalGiaTri = detailItems.reduce((s, r) => s + (r.gia_tri_ton ?? 0), 0)
  const totalSoLuong = detailItems.reduce((s, r) => s + (r.ton_luong ?? 0), 0)

  const drawerCfg = detailSlot ? LOAI_CONFIG[detailSlot.loai_kho] : null

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Kho theo xưởng</Title>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => queryClient.invalidateQueries({ queryKey: ['kho-theo-xuong'] })}
        >
          Làm mới
        </Button>
      </div>

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
          {/* ── Menu lọc xưởng ── */}
          <Col flex="200px" style={{ minWidth: 160 }}>
            <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden', position: 'sticky', top: 16 }}>
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
                        <Tag style={{ marginLeft: 6, fontSize: 10 }} color="default">
                          {list.length}
                        </Tag>
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

          {/* ── Cards xưởng ── */}
          <Col flex="1" style={{ minWidth: 0 }}>
            {displayList.map((px: PhanXuongWithWarehouses) => (
              <Card
                key={px.id}
                style={{ marginBottom: 16 }}
                title={
                  <Space>
                    <span>{px.ten_xuong}</span>
                    <Tag color={px.cong_doan === 'cd1_cd2' ? 'blue' : 'green'}>
                      {px.cong_doan === 'cd1_cd2' ? 'CD1 + CD2' : 'CD2'}
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
                <Row gutter={[12, 12]}>
                  {ALL_LOAI.map(loai => (
                    <Col key={loai} xs={24} sm={12} md={6}>
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
            ))}
          </Col>
        </Row>
      )}

      {/* ── Drawer chi tiết kho ── */}
      <Drawer
        title={
          <Space>
            {drawerCfg && (
              <Tag color={drawerCfg.color} style={{ marginRight: 0 }}>{drawerCfg.label}</Tag>
            )}
            <span>{detailSlot?.ten_kho}</span>
            {detailSlot?.ma_kho && (
              <Text type="secondary" style={{ fontSize: 12 }}>{detailSlot.ma_kho}</Text>
            )}
          </Space>
        }
        open={!!detailSlot}
        onClose={() => setDetailSlot(null)}
        width={580}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={20}>
            {/* Thống kê tổng hợp */}
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="Giá trị tồn kho"
                  value={totalGiaTri}
                  formatter={v => fmtMoney(Number(v))}
                  valueStyle={{ color: '#1677ff', fontSize: 16 }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Tổng số lượng"
                  value={totalSoLuong}
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

            {/* Bảng chi tiết từng mặt hàng */}
            {detailItems.length === 0 ? (
              <Empty description="Kho này chưa có hàng tồn kho" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Table<TonKho>
                rowKey="id"
                size="small"
                dataSource={detailItems}
                pagination={false}
                scroll={{ x: 480 }}
                columns={[
                  {
                    title: 'Tên hàng',
                    dataIndex: 'ten_hang',
                    ellipsis: true,
                    render: (v: string) => <Text strong style={{ fontSize: 12 }}>{v}</Text>,
                  },
                  {
                    title: 'Tồn kho',
                    dataIndex: 'ton_luong',
                    width: 100,
                    align: 'right' as const,
                    render: (v: number, r: TonKho) => (
                      <Space direction="vertical" size={0} style={{ lineHeight: 1.3 }}>
                        <Text strong style={{ color: v > 0 ? '#389e0d' : '#cf1322', fontSize: 12 }}>
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
                      <Text strong style={{ color: '#1677ff', fontSize: 12 }}>{fmtMoney(totalGiaTri)}</Text>
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
