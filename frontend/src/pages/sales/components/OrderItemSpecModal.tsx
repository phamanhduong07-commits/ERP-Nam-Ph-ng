import { useEffect, useState } from 'react'
import { Modal, Form, Select, InputNumber, Input, Row, Col, Button, Tabs, Typography } from 'antd'
import { AppstoreOutlined } from '@ant-design/icons'
import { SO_LOP_OPTIONS, TO_HOP_SONG_OPTIONS, LOAI_THUNG_OPTIONS } from '../../../api/quotes'
import CauTrucModal from '../../quotes/components/CauTrucModal'
import type { CauTruc } from '../../../api/cauTruc'

export interface OrderItemSpec {
  loai_thung: string | null
  dai: number | null
  rong: number | null
  cao: number | null
  so_lop: number | null
  to_hop_song: string | null
  mat: string | null;     mat_dl: number | null
  song_1: string | null;  song_1_dl: number | null
  mat_1: string | null;   mat_1_dl: number | null
  song_2: string | null;  song_2_dl: number | null
  mat_2: string | null;   mat_2_dl: number | null
  song_3: string | null;  song_3_dl: number | null
  mat_3: string | null;   mat_3_dl: number | null
  loai_in: string | null
  so_mau: number | null
  loai_lan: string | null
  c_tham: string | null
  can_man: string | null
  kho_tt: number | null
  dai_tt: number | null
  dien_tich: number | null
}

export const EMPTY_SPEC: OrderItemSpec = {
  loai_thung: null, dai: null, rong: null, cao: null,
  so_lop: null, to_hop_song: null,
  mat: null, mat_dl: null,
  song_1: null, song_1_dl: null,
  mat_1: null, mat_1_dl: null,
  song_2: null, song_2_dl: null,
  mat_2: null, mat_2_dl: null,
  song_3: null, song_3_dl: null,
  mat_3: null, mat_3_dl: null,
  loai_in: null, so_mau: null, loai_lan: null,
  c_tham: null, can_man: null,
  kho_tt: null, dai_tt: null, dien_tich: null,
}

interface Props {
  open: boolean
  spec: OrderItemSpec
  tenHang?: string
  onClose: () => void
  onSave: (spec: OrderItemSpec) => void
}

const LOAI_THUNG_GROUPED = [
  { label: 'Thùng', options: LOAI_THUNG_OPTIONS.filter(o => o.group === 'Thùng') },
  { label: 'Hộp',   options: LOAI_THUNG_OPTIONS.filter(o => o.group === 'Hộp') },
  { label: 'Khay',  options: LOAI_THUNG_OPTIONS.filter(o => o.group === 'Khay') },
]

const LOAI_IN_OPTIONS = [
  { value: 'flexo', label: 'In Flexo' },
  { value: 'ky_thuat_so', label: 'In kỹ thuật số' },
  { value: 'offset', label: 'In Offset' },
]

const CHONG_THAM_OPTIONS = [
  { value: 'Không', label: 'Không' },
  { value: '1 mặt', label: '1 mặt' },
  { value: '2 mặt', label: '2 mặt' },
]

const CAN_MAN_OPTIONS = [
  { value: 'Không', label: 'Không' },
  { value: '1 mặt', label: '1 mặt' },
  { value: '2 mặt', label: '2 mặt' },
]

const PAPER_LAYERS = [
  { label: 'Mặt ngoài', code: 'mat',    dl: 'mat_dl' },
  { label: 'Sóng 1',    code: 'song_1', dl: 'song_1_dl' },
  { label: 'Mặt 1',     code: 'mat_1',  dl: 'mat_1_dl' },
  { label: 'Sóng 2',    code: 'song_2', dl: 'song_2_dl' },
  { label: 'Mặt 2',     code: 'mat_2',  dl: 'mat_2_dl' },
  { label: 'Sóng 3',    code: 'song_3', dl: 'song_3_dl' },
  { label: 'Mặt trong', code: 'mat_3',  dl: 'mat_3_dl' },
] as const

function visibleLayerCodes(soLop: number | null): string[] {
  if (soLop === 1) return ['mat']
  if (soLop === 3) return ['mat', 'song_1', 'mat_1']
  if (soLop === 5) return ['mat', 'song_1', 'mat_1', 'song_2', 'mat_2']
  if (soLop === 7) return ['mat', 'song_1', 'mat_1', 'song_2', 'mat_2', 'song_3', 'mat_3']
  return []
}

export default function OrderItemSpecModal({ open, spec, tenHang, onClose, onSave }: Props) {
  const [local, setLocal] = useState<OrderItemSpec>(spec)
  const [cauTrucOpen, setCauTrucOpen] = useState(false)

  useEffect(() => {
    if (open) setLocal(spec)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const set = <K extends keyof OrderItemSpec>(field: K, value: OrderItemSpec[K]) =>
    setLocal(prev => ({ ...prev, [field]: value }))

  const handleCauTruc = (ct: CauTruc) => {
    setLocal(prev => ({
      ...prev,
      so_lop: ct.so_lop,
      to_hop_song: ct.to_hop_song,
      mat: ct.mat, mat_dl: ct.mat_dl,
      song_1: ct.song_1, song_1_dl: ct.song_1_dl,
      mat_1: ct.mat_1, mat_1_dl: ct.mat_1_dl,
      song_2: ct.song_2, song_2_dl: ct.song_2_dl,
      mat_2: ct.mat_2, mat_2_dl: ct.mat_2_dl,
      song_3: ct.song_3, song_3_dl: ct.song_3_dl,
      mat_3: ct.mat_3, mat_3_dl: ct.mat_3_dl,
    }))
    setCauTrucOpen(false)
  }

  const activeLayers = visibleLayerCodes(local.so_lop)

  const tabItems = [
    {
      key: '1',
      label: 'Cơ bản',
      children: (
        <Form layout="vertical" size="small">
          <Form.Item label="Loại thùng">
            <Select
              allowClear placeholder="Chọn loại thùng..."
              value={local.loai_thung ?? undefined}
              onChange={v => set('loai_thung', v ?? null)}
              options={LOAI_THUNG_GROUPED}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="Dài (cm)">
                <InputNumber value={local.dai ?? undefined} onChange={v => set('dai', v ?? null)} style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Rộng (cm)">
                <InputNumber value={local.rong ?? undefined} onChange={v => set('rong', v ?? null)} style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Cao (cm)">
                <InputNumber value={local.cao ?? undefined} onChange={v => set('cao', v ?? null)} style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Số lớp">
                <Select
                  allowClear placeholder="Chọn..."
                  value={local.so_lop ?? undefined}
                  onChange={v => { set('so_lop', v ?? null); set('to_hop_song', null) }}
                  options={SO_LOP_OPTIONS.map(v => ({ value: v, label: `${v} lớp` }))}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Số màu">
                <InputNumber value={local.so_mau ?? undefined} onChange={v => set('so_mau', v ?? null)} min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      ),
    },
    {
      key: '2',
      label: 'Gia công',
      children: (
        <Form layout="vertical" size="small">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Loại in">
                <Select
                  allowClear placeholder="Không in"
                  value={local.loai_in ?? undefined}
                  onChange={v => set('loai_in', v ?? null)}
                  options={LOAI_IN_OPTIONS}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Số màu in">
                <InputNumber value={local.so_mau ?? undefined} onChange={v => set('so_mau', v ?? null)} min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Chống thấm">
                <Select
                  allowClear placeholder="Không"
                  value={local.c_tham ?? undefined}
                  onChange={v => set('c_tham', v ?? null)}
                  options={CHONG_THAM_OPTIONS}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Cán màng">
                <Select
                  allowClear placeholder="Không"
                  value={local.can_man ?? undefined}
                  onChange={v => set('can_man', v ?? null)}
                  options={CAN_MAN_OPTIONS}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Loại lằn">
                <Select
                  allowClear placeholder="Không"
                  value={local.loai_lan ?? undefined}
                  onChange={v => set('loai_lan', v ?? null)}
                  options={[
                    { value: 'bang', label: 'Bằng' },
                    { value: 'am_duong', label: 'Âm dương' },
                  ]}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="Khổ TT (cm)">
                <InputNumber value={local.kho_tt ?? undefined} onChange={v => set('kho_tt', v ?? null)} min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Dài TT (cm)">
                <InputNumber value={local.dai_tt ?? undefined} onChange={v => set('dai_tt', v ?? null)} min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Diện tích (m²)">
                <InputNumber value={local.dien_tich ?? undefined} onChange={v => set('dien_tich', v ?? null)} min={0} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      ),
    },
    {
      key: '3',
      label: 'Cấu trúc giấy',
      children: (
        <Form layout="vertical" size="small">
          <Row gutter={12} align="middle" style={{ marginBottom: 12 }}>
            <Col flex={1}>
              <Form.Item label="Tổ hợp sóng" style={{ marginBottom: 0 }}>
                <Select
                  allowClear placeholder="Chọn tổ hợp sóng"
                  value={local.to_hop_song ?? undefined}
                  onChange={v => set('to_hop_song', v ?? null)}
                  options={(TO_HOP_SONG_OPTIONS[local.so_lop ?? 0] ?? []).map(v => ({ value: v, label: v }))}
                  disabled={!local.so_lop || (TO_HOP_SONG_OPTIONS[local.so_lop] ?? []).length === 0}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col style={{ paddingTop: 20 }}>
              <Button icon={<AppstoreOutlined />} onClick={() => setCauTrucOpen(true)}>
                Chọn kết cấu giấy
              </Button>
            </Col>
          </Row>

          <Row style={{ marginBottom: 4, color: '#999', fontSize: 11 }}>
            <Col style={{ width: 90 }}>Lớp</Col>
            <Col flex={1} style={{ paddingLeft: 8 }}>Mã giấy</Col>
            <Col style={{ width: 150, paddingLeft: 8 }}>Định lượng (g/m²)</Col>
          </Row>
          {PAPER_LAYERS.map(layer => {
            const active = activeLayers.includes(layer.code)
            return (
              <Row key={layer.code} gutter={8} align="middle" style={{ marginBottom: 8, opacity: active ? 1 : 0.35 }}>
                <Col style={{ width: 90, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, color: '#555' }}>{layer.label}</span>
                </Col>
                <Col flex={1}>
                  <Input
                    placeholder="Mã giấy"
                    value={(local[layer.code as keyof OrderItemSpec] as string) ?? ''}
                    onChange={e => set(layer.code as keyof OrderItemSpec, (e.target.value || null) as never)}
                    disabled={!active}
                  />
                </Col>
                <Col style={{ width: 150 }}>
                  <InputNumber
                    min={0} style={{ width: '100%' }} placeholder="0" addonAfter="g/m²"
                    value={(local[layer.dl as keyof OrderItemSpec] as number) ?? undefined}
                    onChange={v => set(layer.dl as keyof OrderItemSpec, (v ?? null) as never)}
                    disabled={!active}
                  />
                </Col>
              </Row>
            )
          })}
        </Form>
      ),
    },
    {
      key: '4',
      label: 'Kho',
      children: (
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          Thông tin kho không áp dụng cho dòng đơn hàng.
        </Typography.Text>
      ),
    },
    {
      key: '5',
      label: 'Tem Offset',
      children: (
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          Thông số tem offset không áp dụng cho dòng đơn hàng.
        </Typography.Text>
      ),
    },
  ]

  return (
    <>
      <Modal
        open={open}
        title={`Thông số kỹ thuật${tenHang ? ` — ${tenHang}` : ''}`}
        width={640}
        onCancel={onClose}
        onOk={() => onSave(local)}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnClose
      >
        <Tabs items={tabItems} size="small" style={{ minHeight: 280 }} />
      </Modal>

      <CauTrucModal
        open={cauTrucOpen}
        soLop={local.so_lop ?? 0}
        onClose={() => setCauTrucOpen(false)}
        onSelect={handleCauTruc}
      />
    </>
  )
}
