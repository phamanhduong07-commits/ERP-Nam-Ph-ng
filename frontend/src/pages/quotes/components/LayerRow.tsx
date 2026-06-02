import { Row, Col, Select } from 'antd'
import { Typography } from 'antd'
import type { QuoteItem } from '../../../api/quotes'
import { paperCodeKey } from '../../../api/quotes'

const { Text } = Typography

interface LayerRowProps {
  label: string
  mkField: keyof QuoteItem
  dlField: keyof QuoteItem
  ci: QuoteItem
  setCI: (p: Partial<QuoteItem>) => void
  mkList: string[]
  byMk: Record<string, number[]>
  paperCodes: Record<string, string>
}

export default function LayerRow({
  label, mkField, dlField, ci, setCI, mkList, byMk, paperCodes,
}: LayerRowProps) {
  const mkVal = ci[mkField] as string | null | undefined
  const dlVal = ci[dlField] as number | null | undefined

  const paperLabel = (mk: string) =>
    paperCodes[paperCodeKey(mk, dlVal)] || paperCodes[paperCodeKey(mk, null)] || mk

  const dlOptions = mkVal && byMk[mkVal]
    ? byMk[mkVal].map(n => ({ value: n, label: `${n} g/m²` }))
    : Object.values(byMk).flat().filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b)
      .map(n => ({ value: n, label: `${n} g/m²` }))

  return (
    <Row gutter={4} style={{ marginTop: 4 }} align="middle">
      <Col span={7}>
        <Text style={{ fontSize: 11 }}>{label}</Text>
      </Col>
      <Col span={9}>
        <Select
          size="small"
          style={{ width: '100%' }}
          showSearch
          allowClear
          placeholder="Mã giấy"
          value={mkVal || undefined}
          options={mkList.map(mk => ({ value: mk, label: paperLabel(mk) }))}
          onChange={v => {
            const dlOpts = v ? (byMk[v] ?? []) : []
            setCI({ [mkField]: v ?? null, [dlField]: dlOpts.length === 1 ? dlOpts[0] : null })
          }}
          filterOption={(input, opt) =>
            `${opt?.value ?? ''} ${opt?.label ?? ''}`.toLowerCase().includes(input.toLowerCase())
          }
        />
      </Col>
      <Col span={8}>
        <Select
          size="small"
          style={{ width: '100%' }}
          allowClear
          placeholder="g/m²"
          value={dlVal ?? undefined}
          options={dlOptions}
          onChange={v => setCI({ [dlField]: v ?? null })}
          notFoundContent="—"
        />
      </Col>
    </Row>
  )
}
