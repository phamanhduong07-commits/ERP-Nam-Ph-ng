import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Descriptions, Tag, Table, Button, Space, Typography, Row, Col,
  Divider, Popconfirm, message, Skeleton, Drawer, Badge,
} from 'antd'
import {
  ArrowLeftOutlined, EditOutlined, CheckCircleOutlined, StopOutlined, FileAddOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { quotesApi, QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS, LOAI_IN_OPTIONS, getSongType } from '../../api/quotes'
import type { QuoteItem } from '../../api/quotes'

const { Title, Text } = Typography

const vnd = (v: number | null | undefined) =>
  v != null ? new Intl.NumberFormat('vi-VN').format(Math.round(v)) : '—'

const GIAN_TIEP_M2: Record<number, number> = { 3: 898, 5: 1178.2, 7: 1800.2 }

const paperSummary = (item: QuoteItem) => {
  const parts: string[] = []
  if (item.mat) parts.push(`${item.mat}${item.mat_dl ? `/${item.mat_dl}` : ''}`)
  if (item.song_1) parts.push(`~${item.song_1}${item.song_1_dl ? `/${item.song_1_dl}` : ''}`)
  if (item.mat_1) parts.push(`${item.mat_1}${item.mat_1_dl ? `/${item.mat_1_dl}` : ''}`)
  if (item.song_2) parts.push(`~${item.song_2}${item.song_2_dl ? `/${item.song_2_dl}` : ''}`)
  if (item.mat_2) parts.push(`${item.mat_2}${item.mat_2_dl ? `/${item.mat_2_dl}` : ''}`)
  if (item.song_3) parts.push(`~${item.song_3}${item.song_3_dl ? `/${item.song_3_dl}` : ''}`)
  if (item.mat_3) parts.push(`${item.mat_3}${item.mat_3_dl ? `/${item.mat_3_dl}` : ''}`)
  return parts.join(' | ') || '—'
}

// ─── Item Detail Drawer ────────────────────────────────────────────────────────
function ItemDetailDrawer({
  item,
  quoteId,
  canEdit,
  onClose,
  onEditClick,
}: {
  item: QuoteItem | null
  quoteId: number | undefined
  canEdit: boolean
  onClose: () => void
  onEditClick: () => void
}) {
  if (!item) return null

  const soLop = item.so_lop ?? 3
  const gianTiepRate = GIAN_TIEP_M2[soLop]
  const chiPhiGianTiep = gianTiepRate && item.dien_tich ? gianTiepRate * item.dien_tich : null

  // Build layer rows
  type LayerDef = { label: string; ma: string | null; dl: number | null; isSong: boolean }
  const layers: LayerDef[] = [
    { label: 'Mặt (ngoài)', ma: item.mat, dl: item.mat_dl, isSong: false },
    { label: `Sóng ${getSongType(item.to_hop_song, 0)}`, ma: item.song_1, dl: item.song_1_dl, isSong: true },
    { label: 'Mặt 1', ma: item.mat_1, dl: item.mat_1_dl, isSong: false },
    ...(soLop >= 5 ? [
      { label: `Sóng ${getSongType(item.to_hop_song, 1)}`, ma: item.song_2, dl: item.song_2_dl, isSong: true },
      { label: 'Mặt 2', ma: item.mat_2, dl: item.mat_2_dl, isSong: false },
    ] : []),
    ...(soLop >= 7 ? [
      { label: `Sóng ${getSongType(item.to_hop_song, 2)}`, ma: item.song_3, dl: item.song_3_dl, isSong: true },
      { label: 'Mặt 3', ma: item.mat_3, dl: item.mat_3_dl, isSong: false },
    ] : []),
  ]

  const loaiInLabel = LOAI_IN_OPTIONS.find(o => o.value === item.loai_in)?.label ?? item.loai_in

  const checkFlags = [
    item.do_kho && 'Độ khó',
    item.ghim && 'Ghim',
    item.chap_xa && 'CHAP XÃ',
    item.do_phu && 'Độ phủ',
    item.dan && 'Dán',
    item.boi && 'Bổi',
    item.be_lo && 'Bê lỗ',
  ].filter(Boolean) as string[]

  const PANEL = { borderRadius: 8, padding: '10px 14px', marginBottom: 10 }

  return (
    <Drawer
      open={!!item}
      onClose={onClose}
      width={Math.min(640, window.innerWidth - 32)}
      title={
        <Space>
          <EyeOutlined style={{ color: '#1677ff' }} />
          <span style={{ fontWeight: 700 }}>{item.ten_hang || '—'}</span>
          {item.ma_amis && <Text code style={{ fontSize: 11 }}>{item.ma_amis}</Text>}
          {item.loai && <Tag style={{ fontSize: 10 }}>{item.loai}</Tag>}
        </Space>
      }
      extra={
        canEdit ? (
          <Button type="primary" size="small" icon={<EditOutlined />} onClick={onEditClick}>
            Chỉnh sửa
          </Button>
        ) : null
      }
      destroyOnClose
    >
      {/* ── Thông tin chung ── */}
      <div style={{ ...PANEL, background: '#f8f9fa', border: '1px solid #e8e8e8' }}>
        <Row gutter={[12, 6]}>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11 }}>Số lượng</Text>
            <div><Text strong>{vnd(item.so_luong)} {item.dvt}</Text></div>
          </Col>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11 }}>Ghi chú</Text>
            <div><Text>{item.ghi_chu || '—'}</Text></div>
          </Col>
        </Row>
      </div>

      {/* ── LOẠI GIẤY ── */}
      <div style={{ ...PANEL, background: '#f0f5ff', border: '1px solid #adc6ff' }}>
        <Text strong style={{ fontSize: 12, color: '#1890ff' }}>LOẠI GIẤY</Text>
        <Row gutter={8} style={{ marginTop: 6 }}>
          <Col span={8}>
            <Text type="secondary" style={{ fontSize: 11 }}>Số lớp</Text>
            <div><Tag color="blue" style={{ fontWeight: 700, fontSize: 13 }}>{soLop} lớp</Tag></div>
          </Col>
          <Col span={16}>
            <Text type="secondary" style={{ fontSize: 11 }}>Tổ hợp sóng</Text>
            <div>
              {item.to_hop_song
                ? <Tag color="geekblue" style={{ fontWeight: 700, fontSize: 13 }}>{item.to_hop_song}</Tag>
                : <Text type="secondary">—</Text>}
            </div>
          </Col>
        </Row>

        {/* Layer table */}
        <div style={{ marginTop: 8 }}>
          <Row style={{ marginBottom: 2 }}>
            <Col span={8}><Text style={{ fontSize: 10, color: '#8c8c8c', fontWeight: 600 }}>Lớp</Text></Col>
            <Col span={9}><Text style={{ fontSize: 10, color: '#8c8c8c', fontWeight: 600 }}>Mã KH đồng cấp</Text></Col>
            <Col span={7}><Text style={{ fontSize: 10, color: '#8c8c8c', fontWeight: 600 }}>Định lượng</Text></Col>
          </Row>
          {layers.map((l, i) => (
            <Row key={i} style={{ marginBottom: 3, padding: '2px 0', borderTop: i > 0 ? '1px solid #e6f0ff' : 'none' }}>
              <Col span={8}>
                <Text style={{ fontSize: 11, color: l.isSong ? '#1890ff' : '#262626', fontStyle: l.isSong ? 'italic' : 'normal' }}>
                  {l.label}
                </Text>
              </Col>
              <Col span={9}>
                {l.ma
                  ? <Tag color={l.isSong ? 'blue' : undefined} style={{ fontSize: 11, margin: 0 }}>{l.ma}</Tag>
                  : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>}
              </Col>
              <Col span={7}>
                {l.dl != null
                  ? <Text style={{ fontSize: 11 }}>{l.dl} g/m²</Text>
                  : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>}
              </Col>
            </Row>
          ))}
        </div>

        {item.don_gia_m2 != null && (
          <Row style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #adc6ff' }}>
            <Col span={8}><Text style={{ fontSize: 11 }}>Đơn giá m²</Text></Col>
            <Col span={16}><Text strong style={{ fontSize: 11 }}>{vnd(item.don_gia_m2)} đ</Text></Col>
          </Row>
        )}
      </div>

      {/* ── KÍCH THƯỚC & IN ẤN ── */}
      <div style={{ ...PANEL, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
        <Text strong style={{ fontSize: 12, color: '#52c41a' }}>KÍCH THƯỚC &amp; IN ẤN</Text>
        <Row gutter={[12, 6]} style={{ marginTop: 8 }}>
          <Col span={8}>
            <Text type="secondary" style={{ fontSize: 11 }}>Loại thùng</Text>
            <div>{item.loai_thung ? <Tag>{item.loai_thung}</Tag> : <Text type="secondary">—</Text>}</div>
          </Col>
          <Col span={16}>
            <Text type="secondary" style={{ fontSize: 11 }}>Kích thước D × R × C (cm)</Text>
            <div>
              {item.dai && item.rong && item.cao
                ? <Text strong style={{ fontSize: 13 }}>{item.dai} × {item.rong} × {item.cao} cm</Text>
                : <Text type="secondary">—</Text>}
            </div>
          </Col>
          <Col span={8}>
            <Text type="secondary" style={{ fontSize: 11 }}>Khổ TT (cm)</Text>
            <div><Text>{item.kho_tt ?? '—'}</Text></div>
          </Col>
          <Col span={8}>
            <Text type="secondary" style={{ fontSize: 11 }}>Dài TT (cm)</Text>
            <div><Text>{item.dai_tt ?? '—'}</Text></div>
          </Col>
          <Col span={8}>
            <Text type="secondary" style={{ fontSize: 11 }}>Diện tích (m²)</Text>
            <div><Text>{item.dien_tich != null ? Number(item.dien_tich).toFixed(4) : '—'}</Text></div>
          </Col>
        </Row>

        <Divider style={{ margin: '8px 0' }} />

        <Row gutter={[12, 4]}>
          <Col span={8}>
            <Text type="secondary" style={{ fontSize: 11 }}>Loại in</Text>
            <div>
              {item.loai_in && item.loai_in !== 'khong_in'
                ? <Tag color="purple">{loaiInLabel}</Tag>
                : <Text type="secondary">Không in</Text>}
            </div>
          </Col>
          {item.loai_in !== 'khong_in' && (
            <Col span={8}>
              <Text type="secondary" style={{ fontSize: 11 }}>Số màu</Text>
              <div><Text>{item.so_mau ?? '—'}</Text></div>
            </Col>
          )}
          {item.loai_lan && (
            <Col span={8}>
              <Text type="secondary" style={{ fontSize: 11 }}>Loại lằn</Text>
              <div><Tag color="volcano">{item.loai_lan === 'lan_bang' ? 'Lằn bằng' : 'Lằn âm dương'}</Tag></div>
            </Col>
          )}
        </Row>

        {checkFlags.length > 0 && (
          <Row style={{ marginTop: 6 }}>
            <Col span={24}>
              <Text type="secondary" style={{ fontSize: 11 }}>Đặc tính: </Text>
              <Space size={4} wrap>
                {checkFlags.map(f => <Tag key={f} color="orange" style={{ fontSize: 10 }}>{f}</Tag>)}
              </Space>
            </Col>
          </Row>
        )}

        {(item.c_tham || item.can_man || item.so_c_be || item.may_in || item.ban_ve_kt) && (
          <Row gutter={[12, 4]} style={{ marginTop: 6 }}>
            {item.c_tham && item.c_tham !== 'Không' && (
              <Col span={8}><Text type="secondary" style={{ fontSize: 11 }}>Chống thấm: </Text><Tag color="cyan" style={{ fontSize: 10 }}>{item.c_tham}</Tag></Col>
            )}
            {item.can_man && item.can_man !== 'Không' && (
              <Col span={8}><Text type="secondary" style={{ fontSize: 11 }}>Cán màng: </Text><Tag color="cyan" style={{ fontSize: 10 }}>{item.can_man}</Tag></Col>
            )}
            {item.so_c_be   && <Col span={8}><Text type="secondary" style={{ fontSize: 11 }}>Số c bề: </Text><Text style={{ fontSize: 11 }}>{item.so_c_be}</Text></Col>}
            {item.may_in    && <Col span={8}><Text type="secondary" style={{ fontSize: 11 }}>Máy in: </Text><Tag color="geekblue" style={{ fontSize: 10 }}>{item.may_in}</Tag></Col>}
            {item.ban_ve_kt && <Col span={16}><Text type="secondary" style={{ fontSize: 11 }}>Bản vẽ KT: </Text><Text style={{ fontSize: 11 }}>{item.ban_ve_kt}</Text></Col>}
          </Row>
        )}
      </div>

      {/* ── TÀI CHÍNH ── */}
      <div style={{ ...PANEL, background: '#fff7e6', border: '1px solid #ffd591' }}>
        <Text strong style={{ fontSize: 12, color: '#fa8c16' }}>TÀI CHÍNH</Text>
        <Row gutter={[12, 6]} style={{ marginTop: 8 }}>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11 }}>Đơn giá m²</Text>
            <div><Text>{item.don_gia_m2 != null ? `${vnd(item.don_gia_m2)} đ` : '—'}</Text></div>
          </Col>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11 }}>Chi phí giấy ≈</Text>
            <div>
              {item.don_gia_m2 && item.dien_tich
                ? <Text>{vnd(item.don_gia_m2 * item.dien_tich)} đ</Text>
                : <Text type="secondary">—</Text>}
            </div>
          </Col>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11 }}>CP Gián tiếp (m²)</Text>
            <div>
              {chiPhiGianTiep != null
                ? <Text>{vnd(chiPhiGianTiep)} đ</Text>
                : <Text type="secondary">—</Text>}
            </div>
          </Col>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11 }}>Giá bán / thùng</Text>
            <div><Text strong style={{ fontSize: 15, color: '#f5222d' }}>{vnd(item.gia_ban)} đ</Text></div>
          </Col>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11 }}>Thành tiền (SL × Giá)</Text>
            <div>
              <Text strong style={{ color: '#1677ff' }}>
                {vnd((item.gia_ban || 0) * (item.so_luong || 0))} đ
              </Text>
            </div>
          </Col>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11 }}>Lấy giá mới NL</Text>
            <div><Badge status={item.lay_gia_moi_nl ? 'success' : 'default'} text={item.lay_gia_moi_nl ? 'Có' : 'Không'} /></div>
          </Col>
        </Row>
      </div>
    </Drawer>
  )
}

interface Props {
  quoteId?: number
  embedded?: boolean
}

export default function QuoteDetail({ quoteId, embedded = false }: Props) {
  const params = useParams<{ id: string }>()
  const id = quoteId ?? (params.id ? Number(params.id) : undefined)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [previewItem, setPreviewItem] = useState<QuoteItem | null>(null)

  const { data: quote, isLoading } = useQuery({
    queryKey: ['quote', id],
    queryFn: () => quotesApi.get(Number(id)).then((r) => r.data),
    enabled: !!id,
  })

  const approveMutation = useMutation({
    mutationFn: () => quotesApi.approve(Number(id)),
    onSuccess: () => {
      message.success('Đã duyệt báo giá')
      queryClient.invalidateQueries({ queryKey: ['quote', id] })
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
    },
    onError: () => message.error('Duyệt thất bại'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => quotesApi.cancel(Number(id)),
    onSuccess: () => {
      message.success('Đã huỷ báo giá')
      queryClient.invalidateQueries({ queryKey: ['quote', id] })
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
    },
    onError: () => message.error('Huỷ thất bại'),
  })

  const taoDonHangMutation = useMutation({
    mutationFn: () => quotesApi.taoDonHang(Number(id)),
    onSuccess: (res) => {
      message.success(`Đã tạo đơn hàng ${res.data.so_don}`)
      navigate(`/sales/orders/${res.data.order_id}`)
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      message.error(detail || 'Lập đơn hàng thất bại', 6)
    },
  })

  const columns: ColumnsType<QuoteItem> = [
    {
      title: 'STT',
      width: 46,
      align: 'center',
      render: (_, __, i) => i + 1,
    },
    {
      title: 'Mã SP',
      dataIndex: 'ma_amis',
      width: 100,
      render: (v: string | null) =>
        v ? <Text code style={{ fontSize: 11 }}>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Tên hàng',
      dataIndex: 'ten_hang',
      ellipsis: true,
      render: (v: string, r: QuoteItem) => (
        <Space size={4}>
          <Text>{v || '—'}</Text>
          <EyeOutlined style={{ color: '#1677ff', fontSize: 12, opacity: 0.5 }} />
          {r.loai && <Text type="secondary" style={{ fontSize: 10 }}>({r.loai})</Text>}
        </Space>
      ),
    },
    {
      title: 'SL / ĐVT',
      width: 100,
      align: 'right',
      render: (_, r) => `${new Intl.NumberFormat('vi-VN').format(r.so_luong)} ${r.dvt}`,
    },
    {
      title: 'Kích thước',
      width: 130,
      render: (_, r) =>
        r.dai && r.rong && r.cao
          ? `${r.dai}×${r.rong}×${r.cao} cm`
          : '—',
    },
    {
      title: 'Lớp',
      dataIndex: 'so_lop',
      width: 50,
      align: 'center',
    },
    {
      title: 'Sóng',
      dataIndex: 'to_hop_song',
      width: 60,
      align: 'center',
      render: (v: string | null) => v || '—',
    },
    {
      title: 'Cấu trúc giấy',
      width: 200,
      render: (_, r) => (
        <Text style={{ fontSize: 11 }} type="secondary">{paperSummary(r)}</Text>
      ),
    },
    {
      title: 'CP Gián tiếp',
      width: 110,
      align: 'right',
      render: (_, r) => {
        const rate = GIAN_TIEP_M2[r.so_lop]
        if (!rate || !r.dien_tich) return '—'
        return (
          <Text style={{ fontSize: 12 }}>
            {vnd(rate * r.dien_tich)} đ
          </Text>
        )
      },
    },
    {
      title: 'Đơn giá',
      dataIndex: 'gia_ban',
      width: 110,
      align: 'right',
      render: (v: number) => `${vnd(v)} đ`,
    },
    {
      title: 'Ghi chú',
      dataIndex: 'ghi_chu',
      ellipsis: true,
      render: (v: string | null) => v || '—',
    },
  ]

  if (isLoading) return <Skeleton active />
  if (!quote) return <Text type="secondary" style={{ padding: 24, display: 'block' }}>Không tìm thấy báo giá</Text>

  const trangThai = quote.trang_thai

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            {!embedded && (
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/quotes')}>
                Quay lại
              </Button>
            )}
            <Title level={4} style={{ margin: 0 }}>
              {embedded ? quote.so_bao_gia : <>Báo giá: <Text style={{ color: '#1677ff' }}>{quote.so_bao_gia}</Text></>}
            </Title>
            <Tag color={QUOTE_STATUS_COLORS[trangThai]} style={{ fontSize: 13 }}>
              {QUOTE_STATUS_LABELS[trangThai] ?? trangThai}
            </Tag>
          </Space>
        </Col>
        <Col>
          <Space>
            {trangThai === 'moi' && (
              <Button
                size={embedded ? 'small' : 'middle'}
                icon={<EditOutlined />}
                onClick={() => navigate(`/quotes/${id}/edit`)}
              >
                Sửa
              </Button>
            )}
            {trangThai === 'moi' && (
              <Popconfirm
                title="Duyệt báo giá này?"
                onConfirm={() => approveMutation.mutate()}
                okText="Duyệt"
              >
                <Button
                  size={embedded ? 'small' : 'middle'}
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={approveMutation.isPending}
                >
                  Duyệt
                </Button>
              </Popconfirm>
            )}
            {trangThai === 'da_duyet' && (
              <Popconfirm
                title="Lập đơn hàng từ báo giá này?"
                onConfirm={() => taoDonHangMutation.mutate()}
                okText="Lập đơn"
              >
                <Button
                  size={embedded ? 'small' : 'middle'}
                  type="primary"
                  icon={<FileAddOutlined />}
                  loading={taoDonHangMutation.isPending}
                >
                  Lập đơn hàng
                </Button>
              </Popconfirm>
            )}
            {trangThai !== 'huy' && (
              <Popconfirm
                title="Huỷ báo giá này?"
                onConfirm={() => cancelMutation.mutate()}
                okText="Huỷ"
                okButtonProps={{ danger: true }}
              >
                <Button
                  size={embedded ? 'small' : 'middle'}
                  danger
                  icon={<StopOutlined />}
                  loading={cancelMutation.isPending}
                >
                  Huỷ
                </Button>
              </Popconfirm>
            )}
          </Space>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2, lg: embedded ? 2 : 3 }} bordered size="small">
          <Descriptions.Item label="Số báo giá">{quote.so_bao_gia}</Descriptions.Item>
          <Descriptions.Item label="Ngày BG">
            {dayjs(quote.ngay_bao_gia).format('DD/MM/YYYY')}
          </Descriptions.Item>
          <Descriptions.Item label="Ngày hết hạn">
            {quote.ngay_het_han ? dayjs(quote.ngay_het_han).format('DD/MM/YYYY') : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Khách hàng" span={2}>
            {quote.customer ? (
              <>
                <Text strong>[{quote.customer.ma_kh}]</Text> {quote.customer.ten_viet_tat}
                {quote.customer.ten_don_vi && (
                  <Text type="secondary"> — {quote.customer.ten_don_vi}</Text>
                )}
              </>
            ) : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            <Tag color={QUOTE_STATUS_COLORS[trangThai]}>
              {QUOTE_STATUS_LABELS[trangThai] ?? trangThai}
            </Tag>
          </Descriptions.Item>
          {quote.ghi_chu && (
            <Descriptions.Item label="Ghi chú" span={3}>{quote.ghi_chu}</Descriptions.Item>
          )}
          {quote.dieu_khoan && (
            <Descriptions.Item label="Điều khoản" span={3}>{quote.dieu_khoan}</Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Card
        title={`Chi tiết sản phẩm (${quote.items.length} dòng)`}
        extra={<Text type="secondary" style={{ fontSize: 11 }}><EyeOutlined /> Nhấn vào dòng để xem chi tiết</Text>}
        style={{ marginBottom: 16 }}
      >
        <Table<QuoteItem>
          columns={columns}
          dataSource={quote.items}
          rowKey={(r, i) => r.id ?? i ?? 0}
          pagination={false}
          size="small"
          scroll={{ x: 1200 }}
          onRow={(r) => ({
            onClick: () => setPreviewItem(r),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>

      <ItemDetailDrawer
        item={previewItem}
        quoteId={id}
        canEdit={trangThai === 'moi'}
        onClose={() => setPreviewItem(null)}
        onEditClick={() => { setPreviewItem(null); navigate(`/quotes/${id}/edit`) }}
      />

      <Card title="Tổng hợp chi phí">
        <Row gutter={[16, 8]} style={{ maxWidth: 500 }}>
          <Col span={14}><Text>Tiền hàng</Text></Col>
          <Col span={10} style={{ textAlign: 'right' }}>
            <Text strong>{vnd(quote.tong_tien_hang)} đ</Text>
          </Col>

          <Col span={14}><Text>CP Bảng in</Text></Col>
          <Col span={10} style={{ textAlign: 'right' }}>
            <Text>{vnd(quote.chi_phi_bang_in)} đ</Text>
          </Col>

          <Col span={14}><Text>CP Khuôn</Text></Col>
          <Col span={10} style={{ textAlign: 'right' }}>
            <Text>{vnd(quote.chi_phi_khuon)} đ</Text>
          </Col>

          <Col span={14}><Text>CP Vận chuyển</Text></Col>
          <Col span={10} style={{ textAlign: 'right' }}>
            <Text>{vnd(quote.chi_phi_van_chuyen)} đ</Text>
          </Col>

          <Col span={14}><Text>CP Hàng hóa DV</Text></Col>
          <Col span={10} style={{ textAlign: 'right' }}>
            <Text>{vnd(quote.chi_phi_hang_hoa_dv)} đ</Text>
          </Col>

          {quote.chi_phi_khac_1 > 0 && (
            <>
              <Col span={14}>
                <Text>{quote.chi_phi_khac_1_ten || 'CP Khác 1'}</Text>
              </Col>
              <Col span={10} style={{ textAlign: 'right' }}>
                <Text>{vnd(quote.chi_phi_khac_1)} đ</Text>
              </Col>
            </>
          )}

          {quote.chi_phi_khac_2 > 0 && (
            <>
              <Col span={14}>
                <Text>{quote.chi_phi_khac_2_ten || 'CP Khác 2'}</Text>
              </Col>
              <Col span={10} style={{ textAlign: 'right' }}>
                <Text>{vnd(quote.chi_phi_khac_2)} đ</Text>
              </Col>
            </>
          )}

          {quote.chiet_khau > 0 && (
            <>
              <Col span={14}><Text>Chiết khấu</Text></Col>
              <Col span={10} style={{ textAlign: 'right' }}>
                <Text type="danger">- {vnd(quote.chiet_khau)} đ</Text>
              </Col>
            </>
          )}

          <Col span={24}><Divider style={{ margin: '4px 0' }} /></Col>

          <Col span={14}><Text strong>Giá bán</Text></Col>
          <Col span={10} style={{ textAlign: 'right' }}>
            <Text strong>{vnd(quote.gia_ban)} đ</Text>
          </Col>

          <Col span={14}>
            <Text>VAT ({(quote.ty_le_vat * 100).toFixed(0)}%)</Text>
          </Col>
          <Col span={10} style={{ textAlign: 'right' }}>
            <Text>{vnd(quote.tien_vat)} đ</Text>
          </Col>

          <Col span={24}><Divider style={{ margin: '4px 0' }} /></Col>

          <Col span={14}>
            <Text strong style={{ fontSize: 15 }}>Tổng cộng</Text>
          </Col>
          <Col span={10} style={{ textAlign: 'right' }}>
            <Text strong style={{ fontSize: 16, color: '#1677ff' }}>
              {vnd(quote.tong_cong)} đ
            </Text>
          </Col>
        </Row>

        <Divider />
        <Text type="secondary" style={{ fontSize: 12 }}>
          Tạo lúc: {dayjs(quote.created_at).format('DD/MM/YYYY HH:mm')} •{' '}
          Cập nhật: {dayjs(quote.updated_at).format('DD/MM/YYYY HH:mm')}
        </Text>
      </Card>
    </div>
  )
}
