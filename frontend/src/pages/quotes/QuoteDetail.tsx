import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card, Descriptions, Tag, Table, Button, Space, Typography, Row, Col,
  Divider, Popconfirm, message, Skeleton,
} from 'antd'
import {
  ArrowLeftOutlined, EditOutlined, CheckCircleOutlined, StopOutlined, FileAddOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { quotesApi, QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS } from '../../api/quotes'
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

interface Props {
  quoteId?: number
  embedded?: boolean
}

export default function QuoteDetail({ quoteId, embedded = false }: Props) {
  const params = useParams<{ id: string }>()
  const id = quoteId ?? (params.id ? Number(params.id) : undefined)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

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
      render: (v: string) => v || '—',
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
        style={{ marginBottom: 16 }}
      >
        <Table<QuoteItem>
          columns={columns}
          dataSource={quote.items}
          rowKey={(r, i) => r.id ?? i ?? 0}
          pagination={false}
          size="small"
          scroll={{ x: 1200 }}
        />
      </Card>

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
