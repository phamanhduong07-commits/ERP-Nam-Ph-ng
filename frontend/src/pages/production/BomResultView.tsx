import { useQuery } from '@tanstack/react-query'
import { Alert, Card, Col, Row, Spin, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { bomApi, vnd } from '../../api/bom'
import type { BomLayerResult } from '../../api/bom'

interface Props {
  productionOrderItemId: number
}

const { Text } = Typography

const SOURCE_CONFIG = {
  quote:     { label: 'Dữ liệu từ báo giá',       color: 'success'  as const },
  cau_truc:  { label: 'Kết cấu thông dụng',        color: 'warning'  as const },
  product:   { label: 'Từ thông tin sản phẩm',     color: 'default'  as const },
}

const layerColumns: ColumnsType<BomLayerResult> = [
  { title: 'Vị trí lớp',     dataIndex: 'vi_tri_lop',         width: 110 },
  { title: 'Mã KH',          dataIndex: 'ma_ky_hieu',         width: 80  },
  { title: 'ĐL (g/m²)',      dataIndex: 'dinh_luong',         width: 90,  align: 'right', render: v => Number(v).toFixed(0) },
  { title: 'TL/thùng (kg)',  dataIndex: 'trong_luong_1con',   width: 110, align: 'right', render: v => Number(v).toFixed(4) },
  { title: 'SL cần (kg)',    dataIndex: 'trong_luong_can_tong', width: 105, align: 'right', render: v => Number(v).toFixed(2) },
  { title: 'Đơn giá/kg',    dataIndex: 'don_gia_kg',          width: 105, align: 'right', render: v => vnd(Number(v)) },
  {
    title: 'Thành tiền',
    dataIndex: 'thanh_tien',
    width: 115,
    align: 'right',
    render: v => <Text strong>{vnd(Number(v))}</Text>,
  },
]

type CostRow = { key: string; label: string; value: number; bold?: boolean; indent?: boolean; separator?: boolean }

export default function BomResultView({ productionOrderItemId }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['bom-from-poi', productionOrderItemId],
    queryFn: () => bomApi.fromProductionItem(productionOrderItemId).then(r => r.data),
    retry: false,
    staleTime: 30_000,
  })

  if (isLoading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
      <Spin size="large" />
    </div>
  )

  if (error) {
    const detail = (error as any)?.response?.data?.detail ?? ''
    return (
      <Alert
        type="warning"
        showIcon
        message="Chưa có dữ liệu báo giá"
        description={detail || 'Mã hàng này chưa có thông tin kết cấu từ báo giá.'}
        style={{ margin: 16 }}
      />
    )
  }

  if (!data) return null

  const src = SOURCE_CONFIG[data.source] ?? SOURCE_CONFIG.cau_truc

  // Danh sách khoản gia công thêm — chỉ hiện khoản > 0
  const ADDON_LABELS: [keyof typeof data.addon_detail, string][] = [
    ['d1_chong_tham',     'Chống thấm'],
    ['d2_in_flexo',       'In Flexo'],
    ['d3_in_ky_thuat_so', 'In kỹ thuật số'],
    ['d4_chap_xa',        'Chạp / Xả'],
    ['d5_boi',            'Bồi'],
    ['d6_be',             'Bế khuôn'],
    ['d7_dan',            'Dán'],
    ['d7_ghim',           'Ghim'],
    ['d8_can_mang',       'Cán màng'],
    ['d9_san_pham_kho',   'Sản phẩm khó (2%)'],
  ]
  const addonRows = ADDON_LABELS
    .filter(([key]) => (data.addon_detail[key] ?? 0) > 0)
    .map(([key, label], i) => ({
      key: `d${i}`,
      label: `   · ${label}`,
      value: data.addon_detail[key],
      indent: true,
    }))

  const costRows: CostRow[] = [
    { key: 'a',     label: 'A. Chi phí giấy',      value: data.chi_phi_giay },
    { key: 'b',     label: 'B. Chi phí gián tiếp', value: data.chi_phi_gian_tiep },
    ...data.gian_tiep_breakdown.map((g, i) => ({
      key: `b${i}`,
      label: `   · ${g.ten}`,
      value: g.thanh_tien,
      indent: true,
    })),
    { key: 'c',     label: 'C. Hao hụt sản xuất',  value: data.chi_phi_hao_hut },
    { key: 'd',     label: 'D. Gia công thêm',      value: data.chi_phi_addon },
    ...addonRows,
    { key: 'sep',   label: '',                      value: 0, separator: true },
    { key: 'total', label: 'TỔNG BIẾN PHÍ',         value: data.bien_phi, bold: true },
  ]

  const hasBaoGia = data.gia_ban_bao_gia > 0

  // Kiểm tra các flag gia công thực tế đọc từ báo giá
  const addonFlags = {
    'Chống thấm':  (data.flag_chong_tham  ?? 0) > 0,
    'In Flexo':    (data.flag_in_flexo_mau ?? 0) > 0,
    'Bồi':         data.flag_boi          ?? false,
    'Chạp / Xả':   data.flag_chap_xa      ?? false,
    'Dán':         data.flag_dan          ?? false,
    'Ghim':        data.flag_ghim         ?? false,
    'Bế khuôn':    (data.flag_be_so_con   ?? 0) > 0,
    'Cán màng':    (data.flag_can_mang    ?? 0) > 0,
    'SP khó (2%)': data.flag_san_pham_kho ?? false,
  }
  const activeFlags = Object.entries(addonFlags).filter(([, v]) => v).map(([k]) => k)
  const noAddons = data.source === 'quote' && data.chi_phi_addon === 0

  return (
    <div style={{ paddingBottom: 16 }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Card size="small" style={{ marginBottom: 10 }}>
        <Row gutter={[16, 4]} align="middle" wrap>
          <Col>
            <Tag color={src.color} style={{ marginRight: 0 }}>{src.label}</Tag>
          </Col>
          <Col>
            <Text strong style={{ fontSize: 14 }}>{data.loai_thung}</Text>
            <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
              {data.dai}×{data.rong}×{data.cao} cm &nbsp;·&nbsp; {data.so_lop} lớp &nbsp;·&nbsp; {data.to_hop_song}
            </Text>
          </Col>
          <Col>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Khổ TT: {data.dimensions.kho_tt}×{data.dimensions.dai_tt} cm
              &nbsp;·&nbsp; Diện tích: {Number(data.dimensions.dien_tich).toFixed(4)} m²/con
            </Text>
          </Col>
          <Col>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Số lượng: <Text strong style={{ fontSize: 12 }}>{vnd(data.so_luong)}</Text> thùng
            </Text>
          </Col>
        </Row>
      </Card>

      {/* ── Chẩn đoán dịch vụ gia công ─────────────────────────────────────── */}
      {data.source === 'quote' && (
        <Card size="small" style={{ marginBottom: 10 }}>
          <Row gutter={8} align="middle">
            <Col>
              <Text style={{ fontSize: 12, color: '#595959' }}>
                <strong>Dịch vụ gia công từ báo giá:</strong>
              </Text>
            </Col>
            <Col flex="1">
              {activeFlags.length > 0
                ? activeFlags.map(f => (
                    <Tag key={f} color="blue" style={{ fontSize: 11, marginBottom: 2 }}>{f}</Tag>
                  ))
                : <Text type="secondary" style={{ fontSize: 11 }}>Không có dịch vụ nào được chọn trong báo giá</Text>
              }
            </Col>
          </Row>
          {noAddons && (
            <Alert
              type="info"
              showIcon
              style={{ marginTop: 8, fontSize: 11 }}
              message="D = 0: Báo giá không ghi nhận dịch vụ gia công thêm"
              description="Nếu sản phẩm có chống thấm / bồi / bế / dán / ghim / cán màng, hãy cập nhật lại báo giá và tích chọn các dịch vụ tương ứng."
            />
          )}
        </Card>
      )}

      {/* ── Kết cấu giấy ──────────────────────────────────────────────────── */}
      <Card size="small" title="Kết cấu giấy & khối lượng" style={{ marginBottom: 10 }}>
        <Table
          columns={layerColumns}
          dataSource={data.bom_layers}
          rowKey={(_, i) => String(i)}
          pagination={false}
          size="small"
          scroll={{ x: 720 }}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={4}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Hao hụt: {(data.ty_le_hao_hut * 100).toFixed(1)}%
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right">
                <Text strong>
                  {data.bom_layers.reduce((s, l) => s + Number(l.trong_luong_can_tong), 0).toFixed(2)} kg
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} />
              <Table.Summary.Cell index={6} align="right">
                <Text strong>{vnd(data.chi_phi_giay)} đ</Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </Card>

      {/* ── Chi phí & Lãi lỗ ─────────────────────────────────────────────── */}
      <Row gutter={10}>
        <Col xs={24} md={14}>
          <Card size="small" title="Bảng biến phí">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {costRows.map(row => {
                  if (row.separator) return (
                    <tr key={row.key}>
                      <td colSpan={2} style={{ padding: '3px 0' }}>
                        <div style={{ borderTop: '1px solid #d9d9d9' }} />
                      </td>
                    </tr>
                  )
                  return (
                    <tr
                      key={row.key}
                      style={{ background: row.bold ? '#e6f4ff' : row.indent ? '#fafafa' : undefined }}
                    >
                      <td style={{
                        padding: '5px 10px',
                        color: row.bold ? '#1677ff' : row.indent ? '#888' : undefined,
                        fontWeight: row.bold ? 600 : 400,
                      }}>
                        {row.label}
                      </td>
                      <td style={{
                        padding: '5px 10px',
                        textAlign: 'right',
                        fontWeight: row.bold ? 700 : row.indent ? 400 : 400,
                        color: row.bold ? '#1677ff' : row.indent ? '#888' : undefined,
                        fontSize: row.bold ? 14 : 13,
                        whiteSpace: 'nowrap',
                      }}>
                        {vnd(row.value)} đ
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        </Col>

        <Col xs={24} md={10}>
          <Card size="small" title="Lãi / Lỗ so với báo giá">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                <tr>
                  <td style={{ padding: '6px 10px', color: '#595959' }}>Giá báo (đ/thùng)</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500 }}>
                    {hasBaoGia ? `${vnd(data.gia_ban_bao_gia)} đ` : <Text type="secondary">—</Text>}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 10px', color: '#595959' }}>Biến phí (đ/thùng)</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500 }}>
                    {vnd(data.bien_phi)} đ
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ padding: '3px 0' }}>
                    <div style={{ borderTop: '1px solid #d9d9d9' }} />
                  </td>
                </tr>
                {hasBaoGia ? (
                  <tr style={{ background: data.lai_gop >= 0 ? '#f6ffed' : '#fff2f0' }}>
                    <td style={{
                      padding: '8px 10px',
                      fontWeight: 600,
                      color: data.lai_gop >= 0 ? '#389e0d' : '#cf1322',
                    }}>
                      {data.lai_gop >= 0 ? 'Lãi gộp' : 'Lỗ gộp'}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      <div style={{
                        fontWeight: 700,
                        fontSize: 15,
                        color: data.lai_gop >= 0 ? '#389e0d' : '#cf1322',
                      }}>
                        {data.lai_gop >= 0 ? '+' : ''}{vnd(data.lai_gop)} đ
                      </div>
                      <div style={{
                        fontSize: 12,
                        color: data.lai_gop >= 0 ? '#52c41a' : '#ff4d4f',
                      }}>
                        ({data.lai_gop >= 0 ? '+' : ''}{data.ty_le_lai.toFixed(1)}%)
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td colSpan={2} style={{ padding: '8px 10px' }}>
                      <Alert
                        type="info"
                        showIcon={false}
                        message="Chưa có giá báo — không thể tính lãi/lỗ"
                        style={{ fontSize: 12 }}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
