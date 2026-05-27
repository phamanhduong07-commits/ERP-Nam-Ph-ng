import {
  Drawer, Spin, Statistic, Row, Col, Table, Tag, Typography, Divider,
  Alert, Button, Space, Progress, Tooltip, Badge,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PrinterOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { productionPlansApi, type KhsxBaoCaoLsx, type KhsxBaoCaoGiay } from '../../api/productionPlans'
import dayjs from 'dayjs'
import EmptyState from "../../components/EmptyState"

const { Text, Title } = Typography

const TRANG_THAI_LSX_COLOR: Record<string, string> = {
  moi: 'default', dang_chay: 'processing', tam_dung: 'warning',
  hoan_thanh: 'success', huy: 'error',
}
const TRANG_THAI_LSX_LABEL: Record<string, string> = {
  moi: 'Mới', dang_chay: 'Đang chạy', tam_dung: 'Tạm dừng',
  hoan_thanh: 'Hoàn thành', huy: 'Huỷ',
}
const PLAN_TRANG_THAI_COLOR: Record<string, string> = {
  nhap: 'default', da_xuat: 'blue', hoan_thanh: 'green',
}
const PLAN_TRANG_THAI_LABEL: Record<string, string> = {
  nhap: 'Nháp', da_xuat: 'Đang SX', hoan_thanh: 'Hoàn thành',
}

function fmt(n: number, d = 1) {
  return n.toLocaleString('vi-VN', { maximumFractionDigits: d })
}

function haoHutColor(pct: number) {
  if (pct < 0) return '#cf1322'
  if (pct > 10) return '#cf1322'
  if (pct > 5) return '#d46b08'
  return '#389e0d'
}

interface Props {
  planId: number | null
  onClose: () => void
}

export default function KhsxBaoCaoDrawer({ planId, onClose }: Props) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['khsx-bao-cao', planId],
    queryFn: () => productionPlansApi.getBaoCao(planId!).then(r => r.data),
    enabled: planId != null,
  })

  const drawerWidth = Math.min(960, window.innerWidth - 16)

  const handlePrint = () => {
    const printContent = document.getElementById('khsx-bao-cao-print')
    if (!printContent) return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`
      <html><head><title>Báo cáo ${data?.plan.so_ke_hoach}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; }
        th { background: #f0f0f0; }
        .right { text-align: right; }
        .center { text-align: center; }
        h2 { margin-bottom: 4px; }
        .meta { color: #666; margin-bottom 12px; }
        @media print { .no-print { display: none; } }
      </style></head><body>
      ${printContent.innerHTML}
      </body></html>
    `)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 300)
  }

  const lsxCols: ColumnsType<KhsxBaoCaoLsx> = [
    {
      title: 'Số lệnh', dataIndex: 'so_lenh', width: 120,
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text code style={{ fontSize: 11 }}>{v}</Text>
          {r.ngay_chay && (
            <Text type="secondary" style={{ fontSize: 10 }}>
              {dayjs(r.ngay_chay).format('DD/MM')}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Trạng thái', dataIndex: 'trang_thai', width: 105,
      render: v => (
        <Tag color={TRANG_THAI_LSX_COLOR[v] ?? 'default'} style={{ fontSize: 10 }}>
          {TRANG_THAI_LSX_LABEL[v] ?? v}
        </Tag>
      ),
    },
    {
      title: 'Sản phẩm', dataIndex: 'ten_hang', ellipsis: true,
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 11 }}>{v || '—'}</Text>
          {r.so_lop && (
            <Tag color="purple" style={{ fontSize: 10 }}>{r.so_lop}L</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Khổ giấy', dataIndex: 'kho_giay_cm', width: 90, align: 'right',
      render: (v, r) => v
        ? <Text style={{ fontSize: 11 }}>{fmt(v, 0)} cm{r.so_dao ? ` ×${r.so_dao}` : ''}</Text>
        : '—',
    },
    {
      title: 'Tiến độ', dataIndex: 'so_tam', width: 130,
      render: (_, r) => {
        const pct = r.completion_pct
        const started = r.so_tam > 0
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <Text style={{ fontSize: 11 }}>
                {fmt(r.so_tam, 0)}<Text type="secondary"> / {fmt(r.so_luong_ke_hoach, 0)}</Text>
              </Text>
              <Text strong style={{ fontSize: 11, color: pct >= 100 ? '#389e0d' : pct > 0 ? '#1677ff' : '#bfbfbf' }}>
                {pct}%
              </Text>
            </div>
            <Progress
              percent={Math.min(pct, 100)}
              size="small"
              showInfo={false}
              strokeColor={pct >= 100 ? '#52c41a' : pct > 0 ? '#1677ff' : '#d9d9d9'}
              style={{ margin: '2px 0 0' }}
              status={!started ? 'normal' : pct >= 100 ? 'success' : 'active'}
            />
          </div>
        )
      },
    },
    {
      title: 'Tấm lỗi', dataIndex: 'so_tam_loi', width: 70, align: 'right',
      render: v => v > 0
        ? <Text type="danger" style={{ fontSize: 11 }}>{fmt(v, 0)}</Text>
        : <Text type="secondary" style={{ fontSize: 11 }}>0</Text>,
    },
    {
      title: 'kg TP', dataIndex: 'kg_tot', width: 85, align: 'right',
      render: v => (
        <Text strong style={{ color: '#389e0d', fontSize: 11 }}>{fmt(v)} kg</Text>
      ),
    },
    {
      title: 'kg lỗi', dataIndex: 'kg_loi', width: 75, align: 'right',
      render: v => v > 0
        ? <Text type="danger" style={{ fontSize: 11 }}>{fmt(v)} kg</Text>
        : <Text type="secondary" style={{ fontSize: 11 }}>0</Text>,
    },
  ]

  const giayCols: ColumnsType<KhsxBaoCaoGiay> = [
    {
      title: 'Mã giấy', dataIndex: 'ma_chinh', width: 100,
      render: v => <Text code style={{ fontSize: 11 }}>{v || '—'}</Text>,
    },
    {
      title: 'Tên giấy', dataIndex: 'ten', ellipsis: true,
      render: v => <Text style={{ fontSize: 11 }}>{v || '—'}</Text>,
    },
    {
      title: 'Khổ (cm)', dataIndex: 'kho_cm', width: 85, align: 'right',
      render: v => v ? fmt(v, 1) : '—',
    },
    {
      title: 'ĐL (g/m²)', dataIndex: 'gsm', width: 90, align: 'right',
      render: v => v ? fmt(v, 0) : '—',
    },
    {
      title: 'Kg xuất', dataIndex: 'kg_xuat', width: 110, align: 'right',
      render: v => (
        <Text strong style={{ color: '#1677ff' }}>{fmt(v)} kg</Text>
      ),
    },
  ]

  const titleNode = data ? (
    <Space>
      <span>{`Báo cáo — ${data.plan.so_ke_hoach}`}</span>
      <Tag color={PLAN_TRANG_THAI_COLOR[data.plan.trang_thai] ?? 'default'}>
        {PLAN_TRANG_THAI_LABEL[data.plan.trang_thai] ?? data.plan.trang_thai}
      </Tag>
      {data.warnings.length > 0 && (
        <Tooltip title={data.warnings.join(' | ')}>
          <Badge count={data.warnings.length} color="orange" size="small">
            <WarningOutlined style={{ color: '#faad14', fontSize: 16 }} />
          </Badge>
        </Tooltip>
      )}
    </Space>
  ) : 'Báo cáo KHSX'

  return (
    <Drawer
      open={planId != null}
      onClose={onClose}
      title={titleNode}
      width={drawerWidth}
      destroyOnClose
      extra={
        data && (
          <Button icon={<PrinterOutlined />} size="small" onClick={handlePrint}>
            In báo cáo
          </Button>
        )
      }
    >
      {isLoading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" tip="Đang tải báo cáo..." />
        </div>
      )}

      {error && (
        <Alert
          type="error"
          message="Không tải được báo cáo"
          description={(error as {response?: {data?: {detail?: string}}})?.response?.data?.detail || (error as {message?: string})?.message || 'Lỗi không xác định'}
          action={
            <Button size="small" icon={<ReloadOutlined />} onClick={() => refetch()}>
              Thử lại
            </Button>
          }
        />
      )}

      {data && (
        <div id="khsx-bao-cao-print">
          {/* ── Header plan info ── */}
          <div style={{ marginBottom: 12, color: '#595959', fontSize: 12 }}>
            <Space split={<span style={{ color: '#d9d9d9' }}>|</span>}>
              <span>Ngày KH: <strong>{dayjs(data.plan.ngay_ke_hoach).format('DD/MM/YYYY')}</strong></span>
              <span>Số lệnh: <strong>{data.lsx_list.length}</strong></span>
            </Space>
          </div>

          {/* ── Warnings ── */}
          {data.warnings.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {data.warnings.map((w, i) => (
                <Alert key={i} type="warning" message={w} showIcon style={{ marginBottom: 4 }} />
              ))}
            </div>
          )}

          {/* ── Tiến độ tổng thể ── */}
          <Row gutter={8} style={{ marginBottom: 8 }}>
            <Col span={24}>
              <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 6, padding: '8px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: 12 }}>Tiến độ tổng thể</Text>
                  <Text strong style={{ fontSize: 14, color: data.completion_pct >= 100 ? '#389e0d' : '#1677ff' }}>
                    {fmt(data.tong_so_tam, 0)} / {fmt(data.tong_so_tam_ke_hoach, 0)} tấm
                    {' '}({data.completion_pct}%)
                  </Text>
                </div>
                <Progress
                  percent={Math.min(data.completion_pct, 100)}
                  strokeColor={data.completion_pct >= 100 ? '#52c41a' : '#1677ff'}
                  status={data.completion_pct >= 100 ? 'success' : 'active'}
                  format={pct => `${pct}%`}
                />
              </div>
            </Col>
          </Row>

          {/* ── Stats ── */}
          <Row gutter={8} style={{ marginBottom: 8 }}>
            <Col span={6}>
              <Statistic
                title="Giấy đã xuất"
                value={fmt(data.tong_kg_giay_dung)}
                suffix="kg"
                valueStyle={{ fontSize: 18, color: '#1677ff' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Phôi tốt"
                value={fmt(data.tong_kg_thanh_pham)}
                suffix="kg"
                valueStyle={{ fontSize: 18, color: '#389e0d' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Phôi lỗi"
                value={fmt(data.tong_kg_loi)}
                suffix="kg"
                valueStyle={{ fontSize: 18, color: data.tong_kg_loi > 0 ? '#cf1322' : '#595959' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Hao hụt"
                value={fmt(data.hao_hut_kg)}
                suffix={`kg`}
                valueStyle={{ fontSize: 18, color: haoHutColor(data.hao_hut_pct) }}
              />
              <Text style={{ fontSize: 11, color: haoHutColor(data.hao_hut_pct) }}>
                {data.hao_hut_kg < 0 ? '⚠ ' : ''}{data.hao_hut_pct}%{data.hao_hut_pct > 10 ? ' — cao' : data.hao_hut_pct > 5 ? ' — trung bình' : ''}
              </Text>
            </Col>
          </Row>

          <Row gutter={8} style={{ marginBottom: 12 }}>
            <Col span={12}>
              <Statistic
                title="Tổng tấm lỗi"
                value={fmt(data.tong_so_tam_loi, 0)}
                suffix="tấm"
                valueStyle={{ fontSize: 15, color: data.tong_so_tam_loi > 0 ? '#cf1322' : '#595959' }}
              />
            </Col>
          </Row>

          <Divider style={{ margin: '8px 0 12px' }} />

          {/* ── Danh sách LSX ── */}
          <Title level={5} style={{ marginBottom: 8 }}>
            Danh sách lệnh sản xuất
          </Title>
          {data.lsx_list.length === 0 ? (
            <Alert type="info" message="Chưa có lệnh SX nào trong kế hoạch này" />
          ) : (
            <Table<KhsxBaoCaoLsx>
              rowKey="id"
              dataSource={data.lsx_list}
              columns={lsxCols}
              size="small"
              pagination={false}
              scroll={{ x: 720 }}
              style={{ marginBottom: 16 }}
              rowClassName={r => r.so_tam === 0 ? 'row-not-started' : ''}
              summary={() => {
                const totKg = data.tong_kg_thanh_pham
                const totKgL = data.tong_kg_loi
                return (
                  <Table.Summary.Row style={{ fontWeight: 700, background: '#fafafa' }}>
                    <Table.Summary.Cell index={0} colSpan={4}>Tổng</Table.Summary.Cell>
                    <Table.Summary.Cell index={4}>
                      <Text style={{ fontSize: 11 }}>
                        {fmt(data.tong_so_tam, 0)} tấm ({data.completion_pct}%)
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={5} align="right">
                      {data.tong_so_tam_loi > 0
                        ? <Text type="danger" style={{ fontSize: 11 }}>{fmt(data.tong_so_tam_loi, 0)}</Text>
                        : <Text type="secondary" style={{ fontSize: 11 }}>0</Text>}
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={6} align="right">
                      <Text style={{ color: '#389e0d', fontSize: 11 }}>{fmt(totKg)} kg</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={7} align="right">
                      {totKgL > 0
                        ? <Text type="danger" style={{ fontSize: 11 }}>{fmt(totKgL)} kg</Text>
                        : <Text type="secondary" style={{ fontSize: 11 }}>0</Text>}
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )
              }}
            />
          )}

          <Divider style={{ margin: '8px 0 12px' }} />

          {/* ── Giấy đã dùng ── */}
          <Title level={5} style={{ marginBottom: 8 }}>Giấy đã xuất theo kế hoạch này</Title>
          {data.giay_dung.length === 0 ? (
            <Alert
              type="info"
              message="Chưa có phiếu xuất giấy nào liên kết với kế hoạch này"
              description="Giấy sẽ tự động xuất hiện khi thao tác cân cuộn giấy chọn kế hoạch này."
              showIcon
            />
          ) : (
            <Table<KhsxBaoCaoGiay>
              rowKey="paper_material_id"
              dataSource={data.giay_dung}
              columns={giayCols}
              size="small"
              pagination={false}
              summary={() => {
                const total = data.tong_kg_giay_dung
                return (
                  <Table.Summary.Row style={{ fontWeight: 700, background: '#fafafa' }}>
                    <Table.Summary.Cell index={0} colSpan={4}>Tổng giấy xuất</Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right">
                      <Text style={{ color: '#1677ff' }}>{fmt(total)} kg</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )
              }}
            />
          )}
        </div>
      )}

      <style>{`
        .row-not-started td { color: #bfbfbf !important; }
        .row-not-started .ant-tag { opacity: 0.5; }
      `}</style>
    </Drawer>
  )
}
