import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button, Card, Popconfirm, Space, Tag, Typography, message,
} from 'antd'
import {
  CheckCircleOutlined, DeleteOutlined, ExportOutlined,
  PlusOutlined, PrinterOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  productionPlansApi, type PlanLineResponse, PLAN_TRANG_THAI,
} from '../../api/productionPlans'
import { LOAI_LAN_LABELS } from '../../api/quotes'
import AddLinesModal from './AddLinesModal'

const { Text } = Typography

// ─── Hệ số sóng ───────────────────────────────────────────────────────────────
const TAKE_UP: Record<string, number> = { E: 1.22, B: 1.32, C: 1.45, A: 1.56 }

function getSongLetters(s: string | null | undefined) {
  return (s ?? '').replace(/-/g, '').toUpperCase().split('').filter(Boolean)
}

// ─── Tính toán ────────────────────────────────────────────────────────────────

function calcSoTam(slKeHoach: number, soDao: number | null): number {
  return soDao && soDao > 0 ? Math.ceil(slKeHoach / soDao) : Math.ceil(slKeHoach)
}

function calcMetToi(soTam: number, daiTt: number | null): number {
  if (!daiTt) return 0
  return Math.round(soTam * daiTt) / 100
}

function calcLayerKg(
  soTam: number,
  kho1: number | null,
  daiTt: number | null,
  dl: number | null,
  isSong: boolean,
  songType: string | null,
): number {
  if (!kho1 || !daiTt || !dl) return 0
  const take = isSong ? (TAKE_UP[songType ?? ''] ?? 1.0) : 1.0
  const area = (kho1 * daiTt * take) / 10000
  return Math.round((dl * area / 1000) * soTam * 10) / 10
}

/** Quy cách sản phẩm — dạng như PDF: 159*160_3L B hoặc 26*22*16_5L C-B */
function calcQuyCache(r: PlanLineResponse): string {
  const soLop = r.so_lop ?? 3
  const song = r.to_hop_song ?? ''
  if (r.cao && Number(r.cao) > 0) {
    return `${r.dai}×${r.rong}×${r.cao}_${soLop}L ${song}`
  }
  // Tấm phẳng
  const daiTt = r.dai_tt ? Number(r.dai_tt) : (r.dai ?? '?')
  const kho1  = r.kho1   ? Number(r.kho1)   : (r.rong ?? '?')
  return `${daiTt}×${kho1}_${soLop}L ${song}`
}

/** QCCL = chiều rộng mỗi nửa + cao + chiều rộng mỗi nửa */
function calcQCCL(rong: number | null, cao: number | null, soLop: number | null): string {
  if (!cao || Number(cao) <= 0 || !rong) return ''
  const layers = soLop ?? 3
  const allow  = layers <= 3 ? 0.1 : layers <= 5 ? 0.2 : 0.3
  const side   = Math.round((Number(rong) / 2 + allow) * 10) / 10
  return `${side}+${Number(cao)}+${side}`
}

/** Mặt trong là lớp mặt cuối cùng (innermost face) */
function getMatInner(r: PlanLineResponse): { ma: string | null; dl: number | null; isSongIdx: number } {
  const soLop = r.so_lop ?? 3
  if (soLop >= 7) return { ma: r.mat_3, dl: r.mat_3_dl, isSongIdx: 6 }
  if (soLop >= 5) return { ma: r.mat_2, dl: r.mat_2_dl, isSongIdx: 4 }
  return { ma: r.mat_1, dl: r.mat_1_dl, isSongIdx: 2 }
}

// ─── Kiểu dữ liệu bảng (bao gồm dòng tổng kết khổ) ─────────────────────────

type GroupFooter = {
  _type: 'footer'
  id: string
  kho: number
  soLenh: number
  soMT: number
}
type LineRow = PlanLineResponse & { _type: 'line' }
type TableRow = LineRow | GroupFooter

function isFooter(r: TableRow): r is GroupFooter { return r._type === 'footer' }

function buildTableRows(lines: PlanLineResponse[]): { rows: TableRow[]; totalMT: number } {
  const sorted = [...lines].sort((a, b) => {
    const ka = Number(a.kho_giay) || 0
    const kb = Number(b.kho_giay) || 0
    return ka !== kb ? ka - kb : a.thu_tu - b.thu_tu
  })

  const rows: TableRow[] = []
  let totalMT = 0
  let curKho: number | null = null
  let groupRows: PlanLineResponse[] = []

  const pushFooter = (kho: number, group: PlanLineResponse[]) => {
    const soMT = group.reduce((s, r) => {
      const soTam = calcSoTam(Number(r.so_luong_ke_hoach), r.so_dao)
      return s + calcMetToi(soTam, r.dai_tt)
    }, 0)
    totalMT += soMT
    rows.push({ _type: 'footer', id: `footer-${kho}`, kho, soLenh: group.length, soMT: Math.round(soMT * 10) / 10 })
  }

  for (const line of sorted) {
    const kho = Number(line.kho_giay) || 0
    if (curKho !== null && kho !== curKho) {
      pushFooter(curKho, groupRows)
      groupRows = []
    }
    curKho = kho
    groupRows.push(line)
    rows.push({ ...line, _type: 'line' })
  }
  if (groupRows.length > 0 && curKho !== null) pushFooter(curKho, groupRows)

  return { rows, totalMT: Math.round(totalMT * 10) / 10 }
}

// ─── Cell giấy (mã + kg) ──────────────────────────────────────────────────────
function PaperCell({ ma, dl, kg, isSong }: { ma: string | null; dl: number | null; kg: number; isSong: boolean }) {
  if (!ma) return <span style={{ color: '#d9d9d9' }}>===</span>
  return (
    <div style={{ lineHeight: 1.3 }}>
      <div style={{ fontWeight: 600, fontSize: 11, color: isSong ? '#1677ff' : '#389e0d' }}>{ma}</div>
      {dl != null && <div style={{ fontSize: 10, color: '#8c8c8c' }}>{dl}g/m²</div>}
      {kg > 0 && <div style={{ fontSize: 10, color: '#fa8c16', fontWeight: 600 }}>{kg.toFixed(0)} kg</div>}
    </div>
  )
}

// ─── Component chính ──────────────────────────────────────────────────────────

interface Props { planId: number; embedded?: boolean }

export default function ProductionPlanDetail({ planId, embedded }: Props) {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)

  const { data: plan, isLoading } = useQuery({
    queryKey: ['production-plan', planId],
    queryFn: () => productionPlansApi.get(planId).then(r => r.data),
  })

  const exportMut = useMutation({
    mutationFn: () => productionPlansApi.export(planId),
    onSuccess: () => {
      message.success('Đã xuất kế hoạch')
      qc.invalidateQueries({ queryKey: ['production-plan', planId] })
      qc.invalidateQueries({ queryKey: ['production-plans'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })
  const deleteLineMut = useMutation({
    mutationFn: (lineId: number) => productionPlansApi.deleteLine(planId, lineId),
    onSuccess: () => { message.success('Đã xóa'); qc.invalidateQueries({ queryKey: ['production-plan', planId] }) },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })
  const completeLineMut = useMutation({
    mutationFn: (lineId: number) => productionPlansApi.completeLine(planId, lineId),
    onSuccess: () => { message.success('Hoàn thành'); qc.invalidateQueries({ queryKey: ['production-plan', planId] }) },
    onError: (e: any) => message.error(e?.response?.data?.detail || 'Lỗi'),
  })

  if (isLoading || !plan) return <div style={{ padding: 24 }}>Đang tải...</div>

  const statusInfo = PLAN_TRANG_THAI[plan.trang_thai] ?? { label: plan.trang_thai, color: 'default' }
  const canEdit   = plan.trang_thai !== 'hoan_thanh'
  const canExport = plan.trang_thai === 'nhap'

  const { rows, totalMT } = buildTableRows(plan.lines)

  // Tổng số cột trong bảng (dùng để colSpan dòng footer)
  const TOTAL_COLS = 21  // Thay đổi nếu thêm/bớt cột

  // ─── Helper render cho dòng footer (Kết thúc khổ) ───────────────────────
  const footerOnCell = (_r: TableRow) =>
    isFooter(_r) ? { colSpan: 0 } : {}

  const firstColOnCell = (r: TableRow) =>
    isFooter(r) ? { colSpan: TOTAL_COLS, style: { background: '#e6f4ff', padding: '5px 12px', fontWeight: 600 } } : {}

  const renderFirst = (r: TableRow) => {
    if (isFooter(r)) {
      return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
          <span>⬛ Kết thúc khổ <b>{r.kho} cm</b> — {r.soLenh} lệnh</span>
          <span style={{ color: '#1677ff', fontWeight: 700 }}>Số MT: {r.soMT.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</span>
        </div>
      )
    }
    return <Text type="secondary" style={{ fontSize: 11 }}>{(r as LineRow).thu_tu}</Text>
  }

  // ─── Render từng ô thông thường (bỏ qua nếu footer) ────────────────────
  function cell<T>(r: TableRow, render: (l: LineRow) => T): T | null {
    return isFooter(r) ? null : render(r as LineRow)
  }

  return (
    <div style={{ padding: embedded ? 0 : 24 }}>
      {/* ── Print styles ── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .ant-table-cell { padding: 2px 4px !important; font-size: 10px !important; }
          body { margin: 0; }
          .plan-header { margin-bottom: 8px; }
        }
      `}</style>

      {/* ── Header card (toolbar) ── */}
      <Card
        size="small"
        className="no-print"
        style={{ marginBottom: 12 }}
        bodyStyle={{ padding: '8px 12px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Text strong style={{ fontSize: 15 }}>{plan.so_ke_hoach}</Text>
            <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {dayjs(plan.ngay_ke_hoach).format('DD/MM/YYYY')} · {plan.lines.length} lệnh · MT: {totalMT.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
            </Text>
          </Space>
          <Space>
            {canExport && (
              <Button type="primary" icon={<ExportOutlined />} loading={exportMut.isPending} onClick={() => exportMut.mutate()}>
                Xuất kế hoạch
              </Button>
            )}
            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>In</Button>
            {canEdit && <Button icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>Thêm LSX</Button>}
          </Space>
        </div>
        {plan.ghi_chu && <Text type="secondary" style={{ fontSize: 12 }}>Ghi chú: {plan.ghi_chu}</Text>}
      </Card>

      {/* ── PDF-style header ── */}
      <div className="plan-header" style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontSize: 12 }}>
            <div><b>Ngày:</b> {dayjs(plan.ngay_ke_hoach).format('DD/MM/YYYY')}</div>
            <div><b>Nơi SX:</b></div>
            <div><b>Số phiếu:</b> {plan.so_ke_hoach}</div>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>KẾ HOẠCH SẢN XUẤT</div>
          </div>
          <div style={{ fontSize: 12, textAlign: 'right' }}>
            <div>Tổng số MT: <b style={{ color: '#1677ff', fontSize: 14 }}>{totalMT.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</b></div>
          </div>
        </div>
      </div>

      {/* ── Bảng kế hoạch ── */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#f0f5ff' }}>
              {/* Cột 1: STT — spans all when footer */}
              <th style={TH}>#</th>
              <th style={TH}>Mã KH</th>
              <th style={TH}>Số LSX</th>
              {/* Kết cấu giấy: 5 lớp */}
              <th style={{ ...TH, background: '#f6ffed', color: '#389e0d' }}>Mặt C</th>
              <th style={{ ...TH, background: '#e6f4ff', color: '#1677ff' }}>Sóng C</th>
              <th style={{ ...TH, background: '#f6ffed', color: '#389e0d' }}>Mặt B</th>
              <th style={{ ...TH, background: '#e6f4ff', color: '#1677ff' }}>Sóng B</th>
              <th style={{ ...TH, background: '#f6ffed', color: '#389e0d' }}>Mặt</th>
              {/* Thông số */}
              <th style={TH}>Quy Cách Sản Phẩm</th>
              <th style={TH}>Sóng</th>
              <th style={{ ...TH, color: '#1677ff' }}>Khổ (cm)</th>
              <th style={TH}>Dài (cm)</th>
              <th style={TH}>Số Tấm</th>
              <th style={TH}>Dao</th>
              <th style={TH}>QCCL</th>
              <th style={TH}>Khổ Xả</th>
              <th style={TH}>SL Thùng</th>
              <th style={TH}>Loại Lằn</th>
              <th style={TH}>Loại In</th>
              <th style={TH}>Ghi Chú</th>
              <th style={{ ...TH, color: '#fa8c16' }}>Mét Tới</th>
              <th style={{ ...TH }} className="no-print">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              if (isFooter(row)) {
                return (
                  <tr key={row.id} style={{ background: '#e6f4ff' }}>
                    <td colSpan={TOTAL_COLS} style={{ padding: '5px 12px', fontWeight: 600, fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>⬛ Kết thúc khổ <b>{row.kho} cm</b> — {row.soLenh} lệnh</span>
                        <span style={{ color: '#1677ff' }}>Số MT: <b>{row.soMT.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</b></span>
                      </div>
                    </td>
                  </tr>
                )
              }

              const r = row as LineRow
              const songs    = getSongLetters(r.to_hop_song)
              const soTam    = calcSoTam(Number(r.so_luong_ke_hoach), r.so_dao)
              const metToi   = calcMetToi(soTam, r.dai_tt)
              const qccl     = calcQCCL(r.rong, r.cao, r.so_lop)
              const soLop    = r.so_lop ?? 3
              const inner    = getMatInner(r)
              const kho1     = r.kho1 ? Number(r.kho1) : null
              const daiTt    = r.dai_tt ? Number(r.dai_tt) : null

              // Kg từng lớp
              const kgMatC   = calcLayerKg(soTam, kho1, daiTt, r.mat_dl, false, null)
              const kgSongC  = calcLayerKg(soTam, kho1, daiTt, r.song_1_dl, true, songs[0] ?? null)
              const kgMatB   = soLop >= 5 ? calcLayerKg(soTam, kho1, daiTt, r.mat_1_dl, false, null) : 0
              const kgSongB  = soLop >= 5 ? calcLayerKg(soTam, kho1, daiTt, r.song_2_dl, true, songs[1] ?? null) : 0
              const kgInner  = calcLayerKg(soTam, kho1, daiTt, inner.dl, false, null)

              const isOdd = idx % 2 === 0
              const rowBg = r.trang_thai === 'hoan_thanh' ? '#f6ffed' : isOdd ? '#fff' : '#fafafa'

              return (
                <tr key={r.id} style={{ background: rowBg }}>
                  {/* STT */}
                  <td style={{ ...TD, textAlign: 'center', color: '#8c8c8c' }}>{r.thu_tu}</td>

                  {/* Mã KH */}
                  <td style={{ ...TD, fontWeight: 600, whiteSpace: 'nowrap' }}>{r.ma_kh || '—'}</td>

                  {/* Số LSX */}
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.so_lenh || '—'}</span>
                  </td>

                  {/* Mặt C */}
                  <td style={TD}>
                    <PaperCell ma={r.mat} dl={r.mat_dl} kg={kgMatC} isSong={false} />
                  </td>

                  {/* Sóng C */}
                  <td style={TD}>
                    <PaperCell ma={r.song_1} dl={r.song_1_dl} kg={kgSongC} isSong={true} />
                  </td>

                  {/* Mặt B (chỉ có ≥5 lớp) */}
                  <td style={TD}>
                    {soLop >= 5
                      ? <PaperCell ma={r.mat_1} dl={r.mat_1_dl} kg={kgMatB} isSong={false} />
                      : <span style={{ color: '#d9d9d9', fontSize: 10 }}>—</span>}
                  </td>

                  {/* Sóng B (chỉ có ≥5 lớp) */}
                  <td style={TD}>
                    {soLop >= 5
                      ? <PaperCell ma={r.song_2} dl={r.song_2_dl} kg={kgSongB} isSong={true} />
                      : <span style={{ color: '#d9d9d9', fontSize: 10 }}>—</span>}
                  </td>

                  {/* Mặt trong */}
                  <td style={TD}>
                    <PaperCell ma={inner.ma} dl={inner.dl} kg={kgInner} isSong={false} />
                  </td>

                  {/* Quy cách sản phẩm */}
                  <td style={{ ...TD, whiteSpace: 'nowrap', fontWeight: 500 }}>
                    {calcQuyCache(r)}
                  </td>

                  {/* Sóng */}
                  <td style={{ ...TD, textAlign: 'center' }}>
                    {r.to_hop_song
                      ? <Tag color="purple" style={{ margin: 0, fontWeight: 700, fontSize: 12 }}>{r.to_hop_song}</Tag>
                      : '—'}
                  </td>

                  {/* Khổ */}
                  <td style={{ ...TD, textAlign: 'center', fontWeight: 700, color: '#1677ff', fontSize: 13 }}>
                    {r.kho_giay ? Number(r.kho_giay) : '—'}
                  </td>

                  {/* Dài */}
                  <td style={{ ...TD, textAlign: 'center' }}>
                    {daiTt ?? '—'}
                  </td>

                  {/* Số Tấm */}
                  <td style={{ ...TD, textAlign: 'center', fontWeight: 600 }}>
                    {soTam.toLocaleString('vi-VN')}
                  </td>

                  {/* Dao */}
                  <td style={{ ...TD, textAlign: 'center', fontWeight: 700, color: '#1677ff' }}>
                    {r.so_dao ?? '—'}
                  </td>

                  {/* QCCL */}
                  <td style={{ ...TD, textAlign: 'center', fontFamily: 'monospace', fontSize: 10 }}>
                    {qccl || '—'}
                  </td>

                  {/* Khổ Xả (kho1) */}
                  <td style={{ ...TD, textAlign: 'center', fontWeight: 600 }}>
                    {kho1 != null ? kho1.toFixed(1) : '—'}
                  </td>

                  {/* SL Thùng */}
                  <td style={{ ...TD, textAlign: 'right', fontWeight: 600 }}>
                    {Number(r.so_luong_ke_hoach).toLocaleString('vi-VN')}
                  </td>

                  {/* Loại Lằn */}
                  <td style={{ ...TD, textAlign: 'center' }}>
                    {r.loai_lan
                      ? <Tag color="volcano" style={{ margin: 0, fontSize: 10 }}>
                          {LOAI_LAN_LABELS[r.loai_lan] ?? r.loai_lan}
                        </Tag>
                      : <span style={{ color: '#d9d9d9' }}>—</span>}
                  </td>

                  {/* Loại In */}
                  <td style={{ ...TD, textAlign: 'center' }}>
                    {r.loai_in && r.loai_in !== 'khong_in'
                      ? <span style={{ fontSize: 10 }}>{r.loai_in === 'flexo' ? 'Flexo' : r.loai_in === 'ky_thuat_so' ? 'KTS' : r.loai_in}{r.so_mau ? ` ${r.so_mau}M` : ''}</span>
                      : <span style={{ color: '#d9d9d9', fontSize: 10 }}>Không</span>}
                  </td>

                  {/* Ghi Chú */}
                  <td style={{ ...TD, maxWidth: 160 }}>
                    <span style={{ fontSize: 10, color: '#595959' }}>{r.ghi_chu || ''}</span>
                  </td>

                  {/* Mét Tới */}
                  <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: '#fa8c16', fontSize: 12 }}>
                    {metToi > 0 ? metToi.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) : '—'}
                  </td>

                  {/* Hành động */}
                  <td style={{ ...TD, textAlign: 'center' }} className="no-print">
                    <Space size={4}>
                      {canEdit && r.trang_thai !== 'hoan_thanh' && (
                        <Popconfirm title="Hoàn thành dòng này?" onConfirm={() => completeLineMut.mutate(r.id)} okText="Có">
                          <Button size="small" type="text" icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />} />
                        </Popconfirm>
                      )}
                      {canEdit && (
                        <Popconfirm title="Xóa dòng này?" onConfirm={() => deleteLineMut.mutate(r.id)} okText="Xóa" okButtonProps={{ danger: true }}>
                          <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      )}
                      {r.trang_thai === 'hoan_thanh' && (
                        <Tag color="success" style={{ fontSize: 10 }}>HT</Tag>
                      )}
                    </Space>
                  </td>
                </tr>
              )
            })}

            {/* ── Dòng tổng cộng ── */}
            <tr style={{ background: '#fffbe6', fontWeight: 700 }}>
              <td colSpan={TOTAL_COLS} style={{ padding: '6px 12px', borderTop: '2px solid #faad14' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>Số phiếu: {plan.so_ke_hoach} &nbsp;·&nbsp; Tổng {plan.lines.length} lệnh sản xuất</span>
                  <span style={{ color: '#fa8c16' }}>
                    Tổng số MT: <b style={{ fontSize: 15 }}>{totalMT.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</b>
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Modal thêm LSX */}
      <AddLinesModal
        open={addOpen}
        planId={planId}
        existingItemIds={plan.lines.map(l => l.production_order_item_id)}
        onClose={() => setAddOpen(false)}
        onAdded={() => { setAddOpen(false); qc.invalidateQueries({ queryKey: ['production-plan', planId] }) }}
      />
    </div>
  )
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const TH: React.CSSProperties = {
  padding: '5px 6px',
  border: '1px solid #d9d9d9',
  textAlign: 'center',
  fontSize: 11,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  background: '#f0f5ff',
}

const TD: React.CSSProperties = {
  padding: '4px 6px',
  border: '1px solid #f0f0f0',
  verticalAlign: 'middle',
  fontSize: 11,
}
