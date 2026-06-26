import { Row, Col, Input, InputNumber, Divider } from 'antd'
import { Typography } from 'antd'
import type { QuoteFinance } from '../quoteHelpers'

const { Text } = Typography

interface QuoteFinancePanelProps {
  finance: QuoteFinance
  updateFinance: (patch: Partial<QuoteFinance>) => void
  onGiaBanChange: (v: number) => void
  hideCostDetails?: boolean
}

const fmt = (v?: number | string) => `${v ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

export default function QuoteFinancePanel({
  finance, updateFinance, onGiaBanChange, hideCostDetails = false,
}: QuoteFinancePanelProps) {
  if (hideCostDetails) {
    return (
      <div style={{ background: '#fff7e6', padding: 8, borderRadius: 6, height: '100%' }}>
        <Text strong style={{ fontSize: 12, color: '#fa8c16' }}>GIÁ BÁN</Text>
        <Row gutter={4} style={{ marginTop: 8 }} align="middle">
          <Col span={12}><Text style={{ fontSize: 11 }}>Giá bán / thùng</Text></Col>
          <Col span={12}>
            <InputNumber size="small" style={{ width: '100%' }}
              value={finance.gia_ban}
              onChange={v => onGiaBanChange(v || 0)}
              formatter={fmt} />
          </Col>
        </Row>
      </div>
    )
  }

  return (
    <div style={{ background: '#fff7e6', padding: 8, borderRadius: 6, height: '100%' }}>
      <Text strong style={{ fontSize: 12, color: '#fa8c16' }}>TÀI CHÍNH</Text>

      {([
        ['CP bảng in', 'chi_phi_bang_in'],
        ['CP khuôn',   'chi_phi_khuon'],
        ['CP vận chuyển', 'chi_phi_van_chuyen'],
      ] as [string, keyof QuoteFinance][]).map(([label, field]) => (
        <Row key={field} gutter={4} style={{ marginTop: 6 }} align="middle">
          <Col span={12}><Text style={{ fontSize: 11 }}>{label}</Text></Col>
          <Col span={12}>
            <InputNumber
              size="small" style={{ width: '100%' }}
              value={finance[field] as number}
              onChange={v => updateFinance({ [field]: v || 0 })}
              formatter={fmt} min={0}
            />
          </Col>
        </Row>
      ))}

      <Divider style={{ margin: '6px 0' }} />

      <Row gutter={4} style={{ marginTop: 4 }} align="middle">
        <Col span={12}><Text style={{ fontSize: 11 }}>Tổng tiền hàng</Text></Col>
        <Col span={12}>
          <InputNumber
            size="small" style={{ width: '100%' }}
            value={finance.tong_tien_hang}
            onChange={v => updateFinance({ tong_tien_hang: v || 0 })}
            formatter={fmt}
          />
        </Col>
      </Row>

      <Row gutter={4} style={{ marginTop: 4 }} align="middle">
        <Col span={7}><Text style={{ fontSize: 11 }}>VAT %</Text></Col>
        <Col span={5}>
          <InputNumber
            size="small" style={{ width: '100%' }}
            value={finance.ty_le_vat}
            onChange={v => updateFinance({ ty_le_vat: v || 0 })}
            min={0} max={30}
          />
        </Col>
        <Col span={12}>
          <InputNumber
            size="small" style={{ width: '100%' }}
            value={finance.tien_vat}
            readOnly formatter={fmt}
          />
        </Col>
      </Row>

      <Row gutter={4} style={{ marginTop: 4 }} align="middle">
        <Col span={12}><Text style={{ fontSize: 11 }}>CP HH và DV</Text></Col>
        <Col span={12}>
          <InputNumber size="small" style={{ width: '100%' }}
            value={finance.chi_phi_hang_hoa_dv} readOnly formatter={fmt} />
        </Col>
      </Row>

      <Divider style={{ margin: '6px 0' }} />

      {/* Chi phí khác */}
      <Row gutter={4} style={{ marginTop: 4 }}>
        <Col span={12}>
          <Input size="small" placeholder="Tên CP khác 1"
            addonBefore={<span style={{ fontSize: 10, color: '#888' }}>CP1</span>}
            value={finance.chi_phi_khac_1_ten}
            onChange={e => updateFinance({ chi_phi_khac_1_ten: e.target.value })} />
        </Col>
        <Col span={12}>
          <InputNumber size="small" style={{ width: '100%' }}
            addonBefore={<span style={{ fontSize: 10, color: '#888' }}>₫</span>}
            value={finance.chi_phi_khac_1}
            onChange={v => updateFinance({ chi_phi_khac_1: v || 0 })}
            formatter={fmt} />
        </Col>
      </Row>
      <Row gutter={4} style={{ marginTop: 4 }}>
        <Col span={12}>
          <Input size="small" placeholder="Tên CP khác 2"
            addonBefore={<span style={{ fontSize: 10, color: '#888' }}>CP2</span>}
            value={finance.chi_phi_khac_2_ten}
            onChange={e => updateFinance({ chi_phi_khac_2_ten: e.target.value })} />
        </Col>
        <Col span={12}>
          <InputNumber size="small" style={{ width: '100%' }}
            addonBefore={<span style={{ fontSize: 10, color: '#888' }}>₫</span>}
            value={finance.chi_phi_khac_2}
            onChange={v => updateFinance({ chi_phi_khac_2: v || 0 })}
            formatter={fmt} />
        </Col>
      </Row>

      <Row gutter={4} style={{ marginTop: 4 }} align="middle">
        <Col span={12}><Text style={{ fontSize: 11 }}>Chiết khấu</Text></Col>
        <Col span={12}>
          <InputNumber size="small" style={{ width: '100%' }}
            value={finance.chiet_khau}
            onChange={v => updateFinance({ chiet_khau: v || 0 })}
            formatter={fmt} />
        </Col>
      </Row>

      <Divider style={{ margin: '6px 0' }} />

      <Row gutter={4} align="middle">
        <Col span={12}><Text strong style={{ fontSize: 12 }}>Tổng cộng</Text></Col>
        <Col span={12}>
          <Text strong style={{ fontSize: 13, color: '#f5222d' }}>
            {finance.tong_cong.toLocaleString('vi-VN')} ₫
          </Text>
        </Col>
      </Row>

      <Row gutter={4} style={{ marginTop: 4 }} align="middle">
        <Col span={12}><Text style={{ fontSize: 11 }}>Giá bán</Text></Col>
        <Col span={12}>
          <InputNumber size="small" style={{ width: '100%' }}
            value={finance.gia_ban}
            onChange={v => onGiaBanChange(v || 0)}
            formatter={fmt} />
        </Col>
      </Row>

      <Row gutter={4} style={{ marginTop: 4 }} align="middle">
        <Col span={12}><Text style={{ fontSize: 11 }}>Giá Phôi</Text></Col>
        <Col span={12}>
          <Text strong style={{ color: '#52c41a', fontSize: 13 }}>
            {finance.gia_phoi > 0 ? finance.gia_phoi.toLocaleString('vi-VN') + ' đ' : '—'}
          </Text>
        </Col>
      </Row>

      <Row gutter={4} style={{ marginTop: 4 }} align="middle">
        <Col span={12}><Text style={{ fontSize: 11 }}>Giá TP (nội bộ)</Text></Col>
        <Col span={12}>
          <InputNumber size="small" style={{ width: '100%' }}
            value={finance.gia_xuat_phoi_vsp}
            onChange={v => updateFinance({ gia_xuat_phoi_vsp: v || 0 })}
            formatter={fmt} />
        </Col>
      </Row>
    </div>
  )
}
