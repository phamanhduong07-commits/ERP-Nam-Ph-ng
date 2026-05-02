import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Row, Col, Button, Typography, Tag, Progress, Spin, Empty,
  Space, Statistic, message, Tooltip,
} from 'antd'
import {
  PlusOutlined, ReloadOutlined, WarningOutlined,
} from '@ant-design/icons'
import { warehouseApi } from '../../api/warehouse'
import type { WarehouseSlot, WarehouseSlotNA, PhanXuongWithWarehouses } from '../../api/warehouse'

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

function isNA(slot: WarehouseSlot | WarehouseSlotNA | null): slot is WarehouseSlotNA {
  return slot !== null && 'not_applicable' in slot
}

function WarehouseCard({
  loai, slot, onInit,
}: {
  loai: string
  slot: WarehouseSlot | WarehouseSlotNA | null
  onInit?: () => void
}) {
  const cfg = LOAI_CONFIG[loai]

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
    <div style={{
      border: `1px solid ${cfg.color}40`, borderRadius: 8, padding: 16,
      background: '#fff', minHeight: 140,
    }}>
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

  const { data: list = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['kho-theo-xuong'],
    queryFn: () => warehouseApi.listTheoPhanXuong().then(r => r.data),
    refetchInterval: 60_000,
    retry: 3,
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
        list.map((px: PhanXuongWithWarehouses) => (
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
                  />
                </Col>
              ))}
            </Row>
          </Card>
        ))
      )}
    </div>
  )
}
