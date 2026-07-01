import { Row, Col, Input, InputNumber, Select, Checkbox, Radio, Switch, Spin } from 'antd'
import { Button, Card, Space, Typography, Divider, Tag, Tooltip } from 'antd'
import { PlusOutlined, AppstoreOutlined, ThunderboltOutlined, SyncOutlined } from '@ant-design/icons'
import type { QuoteItem } from '../../../api/quotes'
import {
  LOAI_IN_OPTIONS, LOAI_BE_OPTIONS, DIE_CUT_TYPES, SO_LOP_OPTIONS, TO_HOP_SONG_OPTIONS,
  getSongType, calcBoxDimensions, calcOffsetCost, calcOffsetSheetDims, buildPaperSymbol,
} from '../../../api/quotes'
import type { OffsetAddonPrice } from '../../../api/offsetAddonPrices'
import type { TemPaperPrice } from '../../../api/temPaperPrices'
import type { QuoteFinance } from '../quoteHelpers'
import { buildGhiChu, LOAI_THUNG_GROUPED, TEM_LOAI_GIAY_OPTIONS } from '../quoteHelpers'
import type { ProductFull } from '../../../api/products'
import type { PhanXuong } from '../../../api/warehouse'
import LayerRow from './LayerRow'
import QuoteFinancePanel from './QuoteFinancePanel'

const { Text } = Typography

export interface QuoteItemEditorProps {
  ci: QuoteItem
  setCI: (patch: Partial<QuoteItem>) => void
  editingIdx: number | null
  onAdd: () => void
  onCancelEdit: () => void
  // paper options
  mkList: string[]
  byMk: Record<string, number[]>
  paperCodes: Record<string, string>
  // products
  productOptions: { value: number; label: string; record: ProductFull }[]
  productSearching: boolean
  onProductSearch: (q: string) => void
  onProductDropdownOpen: (open: boolean) => void
  onProductSelect: (val: number) => void
  onProductClear: () => void
  // pricing
  isCalcLoading: boolean
  hasFormulaPriceData: (item: QuoteItem) => boolean
  onCalcForce: () => void
  // tem / offset addon prices
  temPaperList: TemPaperPrice[]
  getAddonPrice: (loai: string) => OffsetAddonPrice | undefined
  // finance panel
  finance: QuoteFinance
  updateFinance: (patch: Partial<QuoteFinance>) => void
  onGiaBanChange: (v: number) => void
  // misc
  phanXuongList: PhanXuong[]
  onOpenCauTruc: () => void
  onAutoName: () => void
  getCustomerId: () => number | undefined
  onSaveToProduct?: () => Promise<void>
  saveToProductLoading?: boolean
  hideCostDetails?: boolean
}

export default function QuoteItemEditor({
  ci, setCI, editingIdx, onAdd, onCancelEdit,
  mkList, byMk, paperCodes,
  productOptions, productSearching, onProductSearch, onProductDropdownOpen, onProductSelect, onProductClear,
  isCalcLoading, hasFormulaPriceData, onCalcForce,
  temPaperList, getAddonPrice,
  finance, updateFinance, onGiaBanChange,
  phanXuongList, onOpenCauTruc, onAutoName, getCustomerId,
  onSaveToProduct, saveToProductLoading,
  hideCostDetails = false,
}: QuoteItemEditorProps) {
  const boxCalc = !ci.khong_ct
    ? calcBoxDimensions(ci.loai_thung, ci.dai, ci.rong, ci.cao, ci.so_lop, ci.be_so_con ?? 1, ci.loai_be, ci.be_hai_manh, ci.ho_nap, ci.ho_day)
    : null

  return (
    <Card
      style={{ marginBottom: 12 }}
      title={
        <Space>
          <Text strong>{editingIdx !== null ? `Sửa dòng ${editingIdx + 1}` : 'Thêm mặt hàng'}</Text>
          {editingIdx !== null && (
            <Button size="small" onClick={onCancelEdit}>Huỷ sửa</Button>
          )}
        </Space>
      }
      extra={
        <Space>
          {ci.product_id != null && onSaveToProduct && (
            <Button
              size="small"
              icon={<SyncOutlined />}
              loading={saveToProductLoading}
              onClick={onSaveToProduct}
            >
              Lưu vào danh mục
            </Button>
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
            {editingIdx !== null ? 'Cập nhật dòng' : 'Thêm vào danh sách'}
          </Button>
        </Space>
      }
    >
      {/* ── Row 1: Product info ───────────────────────────────── */}
      <Row gutter={8} style={{ marginBottom: 8 }}>
        <Col span={3}>
          <Input
            size="small" placeholder="Mã AMIS"
            value={ci.loai || ''}
            onChange={e => setCI({ loai: e.target.value })}
          />
        </Col>
        <Col span={6}>
          <Select
            size="small" style={{ width: '100%' }}
            showSearch allowClear filterOption={false}
            placeholder="🔍 Tìm SP danh mục..."
            value={ci.product_id ?? undefined}
            onSearch={onProductSearch}
            onSelect={onProductSelect}
            onDropdownVisibleChange={onProductDropdownOpen}
            onClear={onProductClear}
            notFoundContent={
              productSearching
                ? <Spin size="small" />
                : (getCustomerId() ? 'Không tìm thấy' : 'Gõ tên / mã AMIS...')
            }
            options={productOptions}
          />
        </Col>
        <Col span={8}>
          <Input
            size="small" placeholder="*Tên hàng"
            value={ci.ten_hang}
            onChange={e => setCI({ ten_hang: e.target.value, product_id: null, ma_amis: ci.ma_amis })}
            addonAfter={
              <Tooltip title="Tự tạo tên: Thùng Carton DxRxC NL / Tấm NL">
                <ThunderboltOutlined
                  style={{ cursor: 'pointer', color: '#fa8c16' }}
                  onClick={onAutoName}
                />
              </Tooltip>
            }
          />
        </Col>
        <Col span={2}>
          <Input size="small" placeholder="ĐVT"
            value={ci.dvt}
            onChange={e => setCI({ dvt: e.target.value })}
          />
        </Col>
        <Col span={2}>
          <InputNumber size="small" style={{ width: '100%' }}
            placeholder="Số lượng BG"
            value={ci.so_luong}
            onChange={v => setCI({ so_luong: v || 0 })}
            min={0}
          />
        </Col>
        <Col span={3}>
          <Tooltip
            title={
              hasFormulaPriceData(ci)
                ? 'Bấm để tính theo công thức giá giấy + gián tiếp + gia công + hao hụt'
                : 'Nhập đủ kích thước, số lượng, sóng và các lớp giấy để tính giá'
            }
          >
            <InputNumber
              size="small" style={{ width: '100%', borderColor: ci.gia_ban ? undefined : '#ff4d4f' }}
              placeholder="Giá bán/thùng"
              value={ci.gia_ban || undefined}
              onChange={v => {
                // direct setCI — price-formula lock handled in parent's setCI logic via giaBanManualRef
                setCI({ gia_ban: v || 0 })
              }}
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              min={0}
              addonAfter={
                hasFormulaPriceData(ci) ? (
                  isCalcLoading
                    ? <Spin size="small" />
                    : (
                      <span
                        style={{ cursor: 'pointer', fontSize: 10, color: '#1890ff' }}
                        onClick={onCalcForce}
                      >
                        Gợi ý
                      </span>
                    )
                ) : undefined
              }
            />
          </Tooltip>
        </Col>
      </Row>

      <Divider style={{ margin: '8px 0' }} />

      {/* ── Row 2: Three panels ───────────────────────────────── */}
      <Row gutter={8}>
        {/* ── LEFT: Paper layers ───────────── */}
        <Col span={6}>
          <div style={{ background: '#f0f5ff', padding: 8, borderRadius: 6, height: '100%' }}>
            <Row justify="space-between" align="middle">
              <Col><Text strong style={{ fontSize: 12, color: '#1890ff' }}>LOẠI GIẤY</Text></Col>
              <Col>
                <Button
                  size="small" type="link" icon={<AppstoreOutlined />}
                  style={{ fontSize: 11, padding: '0 4px' }}
                  onClick={onOpenCauTruc}
                >
                  Chọn kết cấu
                </Button>
              </Col>
            </Row>

            <Row gutter={4} style={{ marginTop: 6 }}>
              <Col span={8}>
                <Text style={{ fontSize: 11 }}>Số lớp</Text>
                <Select
                  size="small" style={{ width: '100%' }}
                  value={ci.so_lop}
                  onChange={v => setCI({ so_lop: v, to_hop_song: null })}
                  options={SO_LOP_OPTIONS.map(n => ({ value: n, label: `${n} lớp` }))}
                />
              </Col>
              <Col span={16}>
                <Text style={{ fontSize: 11 }}>Tổ hợp sóng</Text>
                <Select
                  size="small" style={{ width: '100%' }}
                  allowClear placeholder="Chọn..."
                  value={ci.to_hop_song || undefined}
                  onChange={v => setCI({ to_hop_song: v ?? null })}
                  options={(TO_HOP_SONG_OPTIONS[ci.so_lop] ?? []).map(s => ({ value: s, label: s }))}
                  notFoundContent="Chọn số lớp trước"
                />
              </Col>
            </Row>

            <Row gutter={4} style={{ marginTop: 8 }}>
              <Col span={7} />
              <Col span={9}><Text style={{ fontSize: 10, color: '#8c8c8c' }}>Mã Giấy Đồng Cấp</Text></Col>
              <Col span={8}><Text style={{ fontSize: 10, color: '#8c8c8c' }}>Định lượng</Text></Col>
            </Row>

            <LayerRow label="Mặt" mkField="mat" dlField="mat_dl"
              ci={ci} setCI={setCI} mkList={mkList} byMk={byMk} paperCodes={paperCodes} />
            <LayerRow
              label={`Sóng ${getSongType(ci.to_hop_song, 0)}`}
              mkField="song_1" dlField="song_1_dl"
              ci={ci} setCI={setCI} mkList={mkList} byMk={byMk} paperCodes={paperCodes} />
            <LayerRow label="Mặt 1" mkField="mat_1" dlField="mat_1_dl"
              ci={ci} setCI={setCI} mkList={mkList} byMk={byMk} paperCodes={paperCodes} />

            {ci.so_lop >= 5 && <>
              <LayerRow
                label={`Sóng ${getSongType(ci.to_hop_song, 1)}`}
                mkField="song_2" dlField="song_2_dl"
                ci={ci} setCI={setCI} mkList={mkList} byMk={byMk} paperCodes={paperCodes} />
              <LayerRow label="Mặt 2" mkField="mat_2" dlField="mat_2_dl"
                ci={ci} setCI={setCI} mkList={mkList} byMk={byMk} paperCodes={paperCodes} />
            </>}

            {ci.so_lop >= 7 && <>
              <LayerRow
                label={`Sóng ${getSongType(ci.to_hop_song, 2)}`}
                mkField="song_3" dlField="song_3_dl"
                ci={ci} setCI={setCI} mkList={mkList} byMk={byMk} paperCodes={paperCodes} />
              <LayerRow label="Mặt 3" mkField="mat_3" dlField="mat_3_dl"
                ci={ci} setCI={setCI} mkList={mkList} byMk={byMk} paperCodes={paperCodes} />
            </>}

            <Row style={{ marginTop: 6 }}>
              <Col span={7}><Text style={{ fontSize: 11 }}>Mã Ký Hiệu</Text></Col>
              <Col span={17}>
                <Tag color="geekblue" style={{ margin: 0 }}>
                  {ci.ma_ky_hieu || buildPaperSymbol(ci, paperCodes) || '—'}
                </Tag>
              </Col>
            </Row>

            <Divider style={{ margin: '6px 0' }} />
            <Row style={{ marginTop: 2 }} align="middle">
              <Col span={14}>
                <Checkbox checked={ci.lay_gia_moi_nl}
                  onChange={e => setCI({ lay_gia_moi_nl: e.target.checked })}>
                  <Text style={{ fontSize: 11 }}>Lấy giá mới NL</Text>
                </Checkbox>
              </Col>
            </Row>
            <Row style={{ marginTop: 4 }} gutter={4} align="middle">
              <Col span={8}><Text style={{ fontSize: 11 }}>Đơn giá m²</Text></Col>
              <Col span={16}>
                <InputNumber size="small" style={{ width: '100%' }}
                  value={ci.don_gia_m2 || undefined}
                  onChange={v => setCI({ don_gia_m2: v })}
                  placeholder="0"
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                />
              </Col>
            </Row>
          </div>
        </Col>

        {/* ── MIDDLE: Dimensions & Printing ─── */}
        <Col span={12}>
          <div style={{ background: '#f6ffed', padding: 8, borderRadius: 6 }}>
            <Text strong style={{ fontSize: 12, color: '#52c41a' }}>KÍCH THƯỚC & IN ẤN</Text>

            {/* Box dimensions */}
            <Row gutter={6} style={{ marginTop: 6 }}>
              <Col span={6}>
                <Text style={{ fontSize: 11 }}>Loại thùng / hộp</Text>
                <Select
                  size="small" style={{ width: '100%' }}
                  value={ci.loai_thung || undefined}
                  onChange={v => setCI({ loai_thung: v })}
                  allowClear options={LOAI_THUNG_GROUPED}
                />
              </Col>
              <Col span={4}>
                <Text style={{ fontSize: 11 }}>Dài (cm)</Text>
                <InputNumber size="small" style={{ width: '100%' }} value={ci.dai || undefined}
                  onChange={v => setCI({ dai: v })} placeholder="0" min={0} step={0.1} />
              </Col>
              <Col span={4}>
                <Text style={{ fontSize: 11 }}>Rộng (cm)</Text>
                <InputNumber size="small" style={{ width: '100%' }} value={ci.rong || undefined}
                  onChange={v => setCI({ rong: v })} placeholder="0" min={0} step={0.1} />
              </Col>
              <Col span={4}>
                <Text style={{ fontSize: 11 }}>Cao (cm)</Text>
                <InputNumber size="small" style={{ width: '100%' }} value={ci.cao || undefined}
                  onChange={v => setCI({ cao: v })} placeholder="0" min={0} step={0.1} />
              </Col>
              <Col span={3}>
                <Text style={{ fontSize: 11 }}>Khổ TT (cm)</Text>
                <InputNumber size="small" style={{ width: '100%' }}
                  value={!ci.khong_ct ? (boxCalc?.kho_tt ?? ci.kho_tt ?? undefined) : (ci.kho_tt || undefined)}
                  onChange={v => setCI({ kho_tt: v })} placeholder="auto" step={0.1}
                  readOnly={!ci.khong_ct && boxCalc != null} />
              </Col>
              <Col span={3}>
                <Text style={{ fontSize: 11 }}>Dài TT (cm)</Text>
                <InputNumber size="small" style={{ width: '100%' }}
                  value={!ci.khong_ct ? (boxCalc?.dai_tt ?? ci.dai_tt ?? undefined) : (ci.dai_tt || undefined)}
                  onChange={v => setCI({ dai_tt: v })} placeholder="auto" step={0.1}
                  readOnly={!ci.khong_ct && boxCalc != null} />
              </Col>
            </Row>

            {boxCalc && (
              <Row style={{ marginTop: 3 }} align="middle">
                <Col span={24}>
                  <Space size={10} wrap>
                    <Text style={{ fontSize: 10, color: '#595959' }}>
                      Kho: <b>{boxCalc.kho1}</b> × Dài: <b>{boxCalc.dai1}</b> cm
                    </Text>
                    <Text style={{ fontSize: 10, color: '#1890ff' }}>
                      KKH: <b>{boxCalc.kho_ke_hoach}</b> cm
                    </Text>
                    <Text style={{ fontSize: 10, color: '#52c41a' }}>
                      Số dao: <b>{boxCalc.so_dao}</b>
                    </Text>
                    {boxCalc.hai_manh && (
                      <Tag color="orange" style={{ fontSize: 9, margin: 0 }}>2 mảnh</Tag>
                    )}
                  </Space>
                </Col>
              </Row>
            )}

            {ci.loai_thung && (DIE_CUT_TYPES.has(ci.loai_thung) || !!ci.co_be) && (
              <Row gutter={6} style={{ marginTop: 4 }}>
                <Col span={8}>
                  <Text style={{ fontSize: 11, color: '#722ed1', fontWeight: 600 }}>Loại bế khuôn</Text>
                  <Select
                    size="small" style={{ width: '100%' }}
                    allowClear placeholder="Chọn loại bế..."
                    value={ci.loai_be || undefined}
                    onChange={v => setCI({ loai_be: v ?? null })}
                    options={LOAI_BE_OPTIONS}
                  />
                </Col>
                {ci.kho_sx && ci.dai_sx ? (
                  <Col span={16}>
                    <Text style={{ fontSize: 11 }}>Khổ SX × Dài SX (cm)</Text>
                    <div>
                      <Text style={{ fontSize: 12, color: '#722ed1', fontWeight: 600 }}>
                        {ci.kho_sx} × {ci.dai_sx}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 10, marginLeft: 6 }}>(trước khuôn bế)</Text>
                    </div>
                  </Col>
                ) : null}
              </Row>
            )}

            <Row gutter={6} style={{ marginTop: 4 }}>
              <Col span={6}>
                <Tooltip title="Không tự động tính kích thước, nhập thủ công">
                  <Checkbox checked={ci.khong_ct} onChange={e => setCI({ khong_ct: e.target.checked })}>
                    <Text style={{ fontSize: 11 }}>Không CT</Text>
                  </Checkbox>
                </Tooltip>
              </Col>
              <Col span={8}>
                <Text style={{ fontSize: 11 }}>
                  Diện tích (m²)
                  {!ci.khong_ct && ci.dien_tich ? (
                    <Text style={{ fontSize: 10, color: '#52c41a', marginLeft: 4 }}>tự tính</Text>
                  ) : null}
                </Text>
                <InputNumber size="small" style={{ width: '100%' }}
                  value={!ci.khong_ct ? (boxCalc?.dien_tich ?? ci.dien_tich ?? undefined) : (ci.dien_tich || undefined)}
                  onChange={v => setCI({ dien_tich: v })} placeholder="0" step={0.0001}
                  readOnly={!ci.khong_ct} />
              </Col>
            </Row>

            {/* Tem Offset */}
            <Row gutter={6} style={{ marginTop: 6 }} align="middle">
              <Col>
                <Switch
                  size="small"
                  checked={ci.co_tem_offset}
                  onChange={v => {
                    const updates: Partial<QuoteItem> = { co_tem_offset: v }
                    if (v) {
                      const inAddon = getAddonPrice('in_offset')
                      if (inAddon) updates.tem_gia_in_1000to = inAddon.don_gia_m2
                    }
                    setCI(updates)
                  }}
                />
              </Col>
              <Col>
                <Text style={{ fontSize: 11, fontWeight: 600, color: '#722ed1' }}>Tem offset bồi</Text>
              </Col>
              {ci.co_tem_offset && (() => {
                const offsetResult = calcOffsetCost(ci.so_luong, ci)
                return offsetResult ? (
                  <Col>
                    <Text style={{ fontSize: 11, color: '#722ed1' }}>
                      ≈ {offsetResult.gia_ban_tem_per_cai.toLocaleString('vi-VN')} đ/cái
                      <Text type="secondary" style={{ fontSize: 10, marginLeft: 4 }}>
                        ({offsetResult.so_to} tờ{ci.tem_hai_manh ? ', 2 mảnh' : ''})
                      </Text>
                    </Text>
                  </Col>
                ) : null
              })()}
            </Row>

            {ci.co_tem_offset && (
              <Card size="small" style={{ marginTop: 6, background: '#faf0ff', border: '1px solid #d3adf7' }}>
                <Row gutter={6}>
                  <Col span={8}>
                    <Text style={{ fontSize: 10 }}>Loại giấy</Text>
                    <Select size="small" style={{ width: '100%' }} allowClear placeholder="DUP/Ivory/Couche"
                      value={ci.tem_loai_giay || undefined}
                      onChange={v => {
                        const dm = temPaperList.find(p =>
                          p.loai_giay === v &&
                          (p.gsm == null || Number(p.gsm) === (ci.tem_gsm ?? 0))
                        ) ?? temPaperList.find(p => p.loai_giay === v && p.gsm == null)
                        setCI({ tem_loai_giay: v ?? null, ...(dm ? { tem_don_gia_kg: Number(dm.don_gia_kg) } : {}) })
                      }}
                      options={TEM_LOAI_GIAY_OPTIONS}
                    />
                  </Col>
                  <Col span={8}>
                    <Text style={{ fontSize: 10 }}>GSM (g/m²)</Text>
                    <Select size="small" style={{ width: '100%' }} allowClear placeholder="Chọn GSM"
                      value={ci.tem_gsm ?? undefined}
                      onChange={v => {
                        const dm = ci.tem_loai_giay ? (
                          temPaperList.find(p =>
                            p.loai_giay === ci.tem_loai_giay &&
                            (p.gsm == null || Number(p.gsm) === (v ?? 0))
                          ) ?? temPaperList.find(p => p.loai_giay === ci.tem_loai_giay && p.gsm == null)
                        ) : null
                        setCI({ tem_gsm: v ?? null, ...(dm ? { tem_don_gia_kg: Number(dm.don_gia_kg) } : {}) })
                      }}
                      options={[200, 230, 250, 300, 350].map(g => ({ value: g, label: `${g} g/m²` }))}
                    />
                  </Col>
                </Row>

                <Row gutter={6} style={{ marginTop: 4 }} align="middle">
                  <Col>
                    <Button
                      size="small"
                      type={ci.tem_hai_manh ? 'primary' : 'default'}
                      style={{ fontSize: 11 }}
                      onClick={() => {
                        const next = !ci.tem_hai_manh
                        const updates: Partial<QuoteItem> = { tem_hai_manh: next }
                        if (ci.dai && ci.rong && ci.cao != null) {
                          const dims = calcOffsetSheetDims(ci.dai, ci.rong, ci.cao, next)
                          updates.tem_dai_to = dims.dai_to
                          updates.tem_rong_to = dims.rong_to
                        }
                        setCI(updates)
                      }}
                    >
                      {ci.tem_hai_manh ? '2 mảnh ✓' : 'Thùng 2 mảnh'}
                    </Button>
                  </Col>
                  {ci.tem_hai_manh && (
                    <Col>
                      <Checkbox
                        checked={ci.tem_khac_thiet_ke}
                        onChange={e => setCI({ tem_khac_thiet_ke: e.target.checked })}
                      >
                        <Text style={{ fontSize: 10 }}>Khác thiết kế (×2 kẹp màu/khuôn)</Text>
                      </Checkbox>
                    </Col>
                  )}
                  {(ci.dai && ci.rong && ci.cao != null) ? (
                    <Col>
                      <Button
                        size="small" style={{ fontSize: 11 }}
                        onClick={() => {
                          const dims = calcOffsetSheetDims(ci.dai!, ci.rong!, ci.cao!, ci.tem_hai_manh)
                          setCI({ tem_dai_to: dims.dai_to, tem_rong_to: dims.rong_to })
                        }}
                      >
                        Auto kích thước tờ
                      </Button>
                      <Text type="secondary" style={{ fontSize: 10, marginLeft: 6 }}>
                        {(() => {
                          const d = calcOffsetSheetDims(ci.dai!, ci.rong!, ci.cao!, ci.tem_hai_manh)
                          return `≈ ${d.dai_to} × ${d.rong_to} cm`
                        })()}
                      </Text>
                    </Col>
                  ) : null}
                </Row>

                <Row gutter={6} style={{ marginTop: 4 }}>
                  <Col span={6}>
                    <Text style={{ fontSize: 10 }}>Dài tờ (cm)</Text>
                    <InputNumber size="small" style={{ width: '100%' }} min={0} step={1}
                      value={ci.tem_dai_to ?? undefined}
                      onChange={v => setCI({ tem_dai_to: v })} />
                  </Col>
                  <Col span={6}>
                    <Text style={{ fontSize: 10 }}>Rộng tờ (cm)</Text>
                    <InputNumber size="small" style={{ width: '100%' }} min={0} step={1}
                      value={ci.tem_rong_to ?? undefined}
                      onChange={v => setCI({ tem_rong_to: v })} />
                  </Col>
                  <Col span={6}>
                    <Text style={{ fontSize: 10 }}>SP/tờ</Text>
                    <InputNumber size="small" style={{ width: '100%' }} min={1}
                      value={ci.tem_sp_per_to}
                      onChange={v => setCI({ tem_sp_per_to: v ?? 2 })} />
                  </Col>
                  <Col span={6}>
                    <Text style={{ fontSize: 10 }}>Bù hao (tờ)</Text>
                    <InputNumber size="small" style={{ width: '100%' }} min={0}
                      value={ci.tem_waste_to}
                      onChange={v => setCI({ tem_waste_to: v ?? 150 })} />
                  </Col>
                </Row>

                <Row gutter={6} style={{ marginTop: 4 }} align="middle">
                  <Col span={6}>
                    <Text style={{ fontSize: 10 }}>Số màu</Text>
                    <InputNumber size="small" style={{ width: '100%' }} min={0} max={8}
                      value={ci.tem_so_mau}
                      onChange={v => setCI({ tem_so_mau: v ?? 0 })} />
                  </Col>
                  {ci.tem_so_mau > 0 && (
                    <Col span={9}>
                      <Text style={{ fontSize: 9 }}>Kẹp màu (đ/màu)</Text>
                      <InputNumber size="small" style={{ width: '100%' }} min={0} step={10000} placeholder="đ/màu"
                        value={ci.tem_gia_kem_mau ?? undefined}
                        onChange={v => setCI({ tem_gia_kem_mau: v })}
                        formatter={v => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''} />
                    </Col>
                  )}
                  {ci.tem_so_mau > 0 && ci.tem_gia_in_1000to && (
                    <Col>
                      <Text type="secondary" style={{ fontSize: 10 }}>
                        {ci.tem_gia_in_1000to.toLocaleString('vi-VN')} đ/1000 tờ/màu
                      </Text>
                    </Col>
                  )}
                </Row>

                <Row gutter={8} style={{ marginTop: 4 }} align="middle">
                  <Col>
                    <Checkbox checked={ci.tem_co_can_mang} onChange={e => {
                      const addon = e.target.checked ? getAddonPrice('can_mang') : undefined
                      setCI({ tem_co_can_mang: e.target.checked, ...(addon ? { tem_gia_can_mang_m2: addon.don_gia_m2 } : {}) })
                    }}><Text style={{ fontSize: 10 }}>Cán màng</Text></Checkbox>
                  </Col>
                  <Col>
                    <Checkbox checked={ci.tem_co_uv} onChange={e => {
                      const addon = e.target.checked ? getAddonPrice('uv') : undefined
                      setCI({ tem_co_uv: e.target.checked, ...(addon ? { tem_gia_uv_m2: addon.don_gia_m2 } : {}) })
                    }}><Text style={{ fontSize: 10 }}>UV</Text></Checkbox>
                  </Col>
                  <Col>
                    <Checkbox checked={ci.tem_co_suppo} onChange={e => {
                      const addon = e.target.checked ? getAddonPrice('suppo') : undefined
                      setCI({ tem_co_suppo: e.target.checked, ...(addon ? { tem_gia_suppo_m2: addon.don_gia_m2 } : {}) })
                    }}><Text style={{ fontSize: 10 }}>Suppo</Text></Checkbox>
                  </Col>
                  <Col>
                    <Checkbox checked={ci.tem_co_luoi} onChange={e => {
                      const addon = e.target.checked ? getAddonPrice('luoi') : undefined
                      setCI({ tem_co_luoi: e.target.checked, ...(addon ? { tem_gia_luoi_m2: addon.don_gia_m2 } : {}) })
                    }}><Text style={{ fontSize: 10 }}>Lưới</Text></Checkbox>
                  </Col>
                  <Col>
                    <Checkbox checked={ci.tem_co_khuon_be} onChange={e => {
                      setCI({ tem_co_khuon_be: e.target.checked })
                    }}><Text style={{ fontSize: 10 }}>Khuôn bế</Text></Checkbox>
                  </Col>
                </Row>

                {(ci.tem_co_can_mang || ci.tem_co_uv || ci.tem_co_suppo || ci.tem_co_luoi || ci.tem_co_khuon_be) && (
                  <Row gutter={6} style={{ marginTop: 3 }}>
                    {ci.tem_co_can_mang && (
                      <Col span={6}>
                        <Text style={{ fontSize: 9 }}>Cán màng đ/m²</Text>
                        <InputNumber size="small" style={{ width: '100%' }} min={0} step={1000} placeholder="đ/m²"
                          value={ci.tem_gia_can_mang_m2 ?? undefined}
                          onChange={v => setCI({ tem_gia_can_mang_m2: v })}
                          formatter={v => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''} />
                      </Col>
                    )}
                    {ci.tem_co_uv && (
                      <Col span={6}>
                        <Text style={{ fontSize: 9 }}>UV đ/m²</Text>
                        <InputNumber size="small" style={{ width: '100%' }} min={0} step={500} placeholder="đ/m²"
                          value={ci.tem_gia_uv_m2 ?? undefined}
                          onChange={v => setCI({ tem_gia_uv_m2: v })}
                          formatter={v => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''} />
                      </Col>
                    )}
                    {ci.tem_co_suppo && (
                      <Col span={6}>
                        <Text style={{ fontSize: 9 }}>Suppo đ/m²</Text>
                        <InputNumber size="small" style={{ width: '100%' }} min={0} step={500} placeholder="đ/m²"
                          value={ci.tem_gia_suppo_m2 ?? undefined}
                          onChange={v => setCI({ tem_gia_suppo_m2: v })}
                          formatter={v => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''} />
                      </Col>
                    )}
                    {ci.tem_co_luoi && (
                      <Col span={6}>
                        <Text style={{ fontSize: 9 }}>Lưới đ/m²</Text>
                        <InputNumber size="small" style={{ width: '100%' }} min={0} step={500} placeholder="đ/m²"
                          value={ci.tem_gia_luoi_m2 ?? undefined}
                          onChange={v => setCI({ tem_gia_luoi_m2: v })}
                          formatter={v => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''} />
                      </Col>
                    )}
                    {ci.tem_co_khuon_be && (
                      <>
                        <Col span={8}>
                          <Text style={{ fontSize: 9 }}>Khuôn bế (đ)</Text>
                          <InputNumber size="small" style={{ width: '100%' }} min={0} step={100000} placeholder="đ"
                            value={ci.tem_gia_khuon_be ?? undefined}
                            onChange={v => setCI({ tem_gia_khuon_be: v })}
                            formatter={v => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''} />
                        </Col>
                        <Col span={8}>
                          <Text style={{ fontSize: 9 }}>Phân bổ (cái)</Text>
                          <InputNumber size="small" style={{ width: '100%' }} min={1} step={1000} placeholder="10000"
                            value={ci.tem_khuon_be_phan_bo}
                            onChange={v => setCI({ tem_khuon_be_phan_bo: v ?? 10000 })}
                            formatter={v => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''} />
                        </Col>
                      </>
                    )}
                  </Row>
                )}

                {!hideCostDetails && (() => {
                  const r = calcOffsetCost(ci.so_luong, ci)
                  if (!r || r.detail.tong_chi_phi === 0) return null
                  const f = (v: number) => v.toLocaleString('vi-VN')
                  return (
                    <Row gutter={4} style={{ marginTop: 6, padding: '4px 0', borderTop: '1px dashed #d3adf7' }}>
                      <Col span={24}>
                        <Text style={{ fontSize: 10, color: '#555' }}>
                          {r.so_to} tờ{ci.tem_hai_manh ? ' (2 mảnh)' : ''} × {r.dien_tich_to.toFixed(4)} m² &nbsp;|&nbsp;
                          {r.detail.chi_phi_giay > 0 && <>Giấy: <b>{f(r.detail.chi_phi_giay)}</b> &nbsp;</>}
                          {r.detail.chi_phi_in > 0 && <>In: <b>{f(r.detail.chi_phi_in)}</b> &nbsp;</>}
                          {r.detail.chi_phi_can_mang > 0 && <>CM: <b>{f(r.detail.chi_phi_can_mang)}</b> &nbsp;</>}
                          {r.detail.chi_phi_khuon_be > 0 && <>KB: <b>{f(r.detail.chi_phi_khuon_be)}</b> &nbsp;</>}
                          {r.detail.chi_phi_uv > 0 && <>UV: <b>{f(r.detail.chi_phi_uv)}</b> &nbsp;</>}
                          {r.detail.chi_phi_suppo > 0 && <>Suppo: <b>{f(r.detail.chi_phi_suppo)}</b> &nbsp;</>}
                          {r.detail.chi_phi_luoi > 0 && <>Lưới: <b>{f(r.detail.chi_phi_luoi)}</b> &nbsp;</>}
                          → <b style={{ color: '#722ed1' }}>{f(r.detail.tong_chi_phi)} đ tổng</b>
                          &nbsp;/ <b>{f(r.gia_ban_tem_per_cai)} đ/cái</b>
                        </Text>
                      </Col>
                    </Row>
                  )
                })()}
              </Card>
            )}

            <Divider style={{ margin: '6px 0' }} />

            {/* Printing */}
            <Row gutter={8} align="middle">
              <Col><Text style={{ fontSize: 11, fontWeight: 600 }}>Loại In: </Text></Col>
              <Col>
                <Radio.Group
                  size="small"
                  value={ci.loai_in}
                  onChange={e => setCI({ loai_in: e.target.value })}
                  options={LOAI_IN_OPTIONS}
                  optionType="button"
                />
              </Col>
              <Col>
                <Text style={{ fontSize: 11 }}>Số màu: </Text>
                <InputNumber
                  size="small" style={{ width: 60 }}
                  value={ci.so_mau}
                  onChange={v => setCI({ so_mau: v || 0 })}
                  min={0} max={10}
                />
              </Col>
            </Row>

            <Row gutter={16} style={{ marginTop: 6 }}>
              <Col>
                <Space wrap size={[16, 4]}>
                  <Checkbox checked={ci.do_kho}  onChange={e => setCI({ do_kho: e.target.checked })}><Text style={{ fontSize: 11 }}>Độ khó</Text></Checkbox>
                  <Checkbox checked={ci.ghim}    onChange={e => setCI({ ghim: e.target.checked })}><Text style={{ fontSize: 11 }}>Ghim</Text></Checkbox>
                  <Checkbox checked={ci.chap_xa} onChange={e => setCI({ chap_xa: e.target.checked })}><Text style={{ fontSize: 11 }}>Chạp Xã</Text></Checkbox>
                  <Checkbox checked={ci.do_phu}  onChange={e => setCI({ do_phu: e.target.checked })}><Text style={{ fontSize: 11 }}>Độ phủ</Text></Checkbox>
                  <Checkbox checked={ci.dan}     onChange={e => setCI({ dan: e.target.checked })}><Text style={{ fontSize: 11 }}>Dán</Text></Checkbox>
                  <Checkbox checked={ci.boi}     onChange={e => setCI({ boi: e.target.checked })}><Text style={{ fontSize: 11 }}>Bồi</Text></Checkbox>
                  <Checkbox checked={ci.be_lo}   onChange={e => setCI({ be_lo: e.target.checked })}><Text style={{ fontSize: 11 }}>Bế Lỗ</Text></Checkbox>
                  <Checkbox checked={ci.co_be}   onChange={e => setCI({ co_be: e.target.checked, ...(!e.target.checked ? { loai_be: null, be_hai_manh: false } : {}) })}><Text style={{ fontSize: 11 }}>Bế khuôn</Text></Checkbox>
                  <Checkbox checked={ci.be_hai_manh} onChange={e => setCI({ be_hai_manh: e.target.checked })}><Text style={{ fontSize: 11 }}>2 mảnh</Text></Checkbox>
                  {ci.loai_thung === 'A1' && (
                    <Checkbox
                      checked={ci.ho_mo ?? false}
                      onChange={e => setCI({ ho_mo: e.target.checked, ...(!e.target.checked ? { ho_nap: null, ho_day: null } : {}) })}
                    ><Text style={{ fontSize: 11 }}>Hở nắp/đáy</Text></Checkbox>
                  )}
                </Space>
              </Col>
            </Row>

            {ci.loai_thung === 'A1' && ci.ho_mo && (
              <Row gutter={8} style={{ marginTop: 6 }} align="middle">
                <Col span={6}>
                  <Text style={{ fontSize: 11 }}>Hở nắp (cm)</Text>
                  <InputNumber size="small" style={{ width: '100%' }} min={0}
                    value={ci.ho_nap ?? undefined}
                    onChange={v => setCI({ ho_nap: (v != null && Number.isFinite(v)) ? v : null })} />
                </Col>
                <Col span={6}>
                  <Text style={{ fontSize: 11 }}>Hở đáy (cm)</Text>
                  <InputNumber size="small" style={{ width: '100%' }} min={0}
                    value={ci.ho_day ?? undefined}
                    onChange={v => setCI({ ho_day: (v != null && Number.isFinite(v)) ? v : null })} />
                </Col>
                {ci.rong != null && (
                  <Col span={12} style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                    <Text style={{ fontSize: 10, color: '#888' }}>
                      Cánh T: {((ci.rong / 2) - (Number.isFinite(ci.ho_nap) ? (ci.ho_nap as number) : 0) / 2).toFixed(1)} cm
                      &nbsp;|&nbsp;
                      Cánh D: {((ci.rong / 2) - (Number.isFinite(ci.ho_day) ? (ci.ho_day as number) : 0) / 2).toFixed(1)} cm
                    </Text>
                  </Col>
                )}
              </Row>
            )}

            <Row gutter={8} style={{ marginTop: 6 }}>
              <Col span={8}>
                <Text style={{ fontSize: 11 }}>Chống thấm</Text>
                <Select size="small" style={{ width: '100%' }} allowClear placeholder="Không"
                  value={ci.c_tham || undefined}
                  onChange={v => setCI({ c_tham: v ?? null })}
                  options={[{ value: 'Không', label: 'Không' }, { value: '1 mặt', label: '1 mặt' }, { value: '2 mặt', label: '2 mặt' }]}
                />
              </Col>
              <Col span={8}>
                <Text style={{ fontSize: 11 }}>Cán màng</Text>
                <Select size="small" style={{ width: '100%' }} allowClear placeholder="Không"
                  value={ci.can_man || undefined}
                  onChange={v => setCI({ can_man: v ?? null })}
                  options={[{ value: 'Không', label: 'Không' }, { value: '1 mặt', label: '1 mặt' }, { value: '2 mặt', label: '2 mặt' }]}
                />
              </Col>
              <Col span={4}>
                <Text style={{ fontSize: 11 }}>Con bế/lần</Text>
                <Select size="small" style={{ width: '100%' }}
                  value={ci.be_so_con ?? 1}
                  onChange={(v: number) => setCI({ be_so_con: v > 1 ? v : null })}
                  options={[1, 2, 3, 4, 6, 8].map(n => ({ value: n, label: `${n} con` }))}
                />
              </Col>
            </Row>

            <Row gutter={8} style={{ marginTop: 4 }}>
              <Col span={8}>
                <Text style={{ fontSize: 11 }}>Máy In</Text>
                <Select size="small" style={{ width: '100%' }} allowClear placeholder="Chọn..."
                  value={ci.may_in || undefined}
                  onChange={v => setCI({ may_in: v ?? null })}
                  options={[
                    { value: '4 màu', label: '4 màu' },
                    { value: '5 màu', label: '5 màu' },
                    { value: '6 màu', label: '6 màu' },
                    { value: 'in dọc', label: 'In dọc' },
                  ]}
                />
              </Col>
              <Col span={8}>
                <Text style={{ fontSize: 11 }}>Loại lằn</Text>
                <Select size="small" style={{ width: '100%' }} allowClear placeholder="Chọn..."
                  value={ci.loai_lan || undefined}
                  onChange={v => setCI({ loai_lan: v ?? null })}
                  options={[
                    { value: 'lan_bang', label: 'Lằn bằng' },
                    { value: 'lan_am_duong', label: 'Lằn âm dương' },
                  ]}
                />
              </Col>
              <Col span={8}>
                <Text style={{ fontSize: 11 }}>Bản vẽ KT</Text>
                <Input size="small" value={ci.ban_ve_kt || ''} onChange={e => setCI({ ban_ve_kt: e.target.value })} />
              </Col>
            </Row>

            <Row style={{ marginTop: 4 }}>
              <Col span={24}>
                <Text style={{ fontSize: 11 }}>Xưởng SX (dòng này)</Text>
                <Select
                  size="small" allowClear
                  placeholder="Dùng xưởng của đơn"
                  style={{ width: '100%', marginBottom: 4 }}
                  value={ci.phan_xuong_id ?? undefined}
                  onChange={v => setCI({ phan_xuong_id: v ?? null })}
                  options={phanXuongList
                    .filter(p => p.trang_thai)
                    .map(p => ({ value: p.id, label: p.ten_xuong }))}
                />
              </Col>
            </Row>

            <Row style={{ marginTop: 4 }}>
              <Col span={24}>
                <Row justify="space-between" align="middle" style={{ marginBottom: 2 }}>
                  <Col>
                    <Text style={{ fontSize: 11 }}>Ghi chú dòng</Text>
                    <Text type="secondary" style={{ fontSize: 10, marginLeft: 6 }}>(tự sinh từ gia công)</Text>
                  </Col>
                  <Col>
                    <Tooltip title="Tự sinh lại ghi chú từ các chi tiết gia công">
                      <Button
                        size="small" type="text"
                        icon={<SyncOutlined style={{ fontSize: 11 }} />}
                        style={{ height: 18, padding: '0 4px', fontSize: 11, color: '#1677ff' }}
                        onClick={() => setCI({ ghi_chu: buildGhiChu(ci) || null })}
                      >
                        Tự sinh
                      </Button>
                    </Tooltip>
                  </Col>
                </Row>
                <Input
                  size="small"
                  value={ci.ghi_chu || ''}
                  placeholder={buildGhiChu(ci) || 'Chưa có dịch vụ gia công'}
                  onChange={e => setCI({ ghi_chu: e.target.value || null })}
                />
              </Col>
            </Row>
          </div>
        </Col>

        {/* ── RIGHT: Finance panel ─────────── */}
        <Col span={6}>
          <QuoteFinancePanel
            finance={finance}
            updateFinance={updateFinance}
            onGiaBanChange={onGiaBanChange}
            hideCostDetails={hideCostDetails}
          />
        </Col>
      </Row>
    </Card>
  )
}
