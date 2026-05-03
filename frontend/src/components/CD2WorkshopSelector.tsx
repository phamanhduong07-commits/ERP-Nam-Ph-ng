import { Select, Space, Tag } from 'antd'
import type { PhanXuong } from '../api/warehouse'

interface Props {
  value: number | undefined
  onChange: (id: number | undefined) => void
  phanXuongList: PhanXuong[]
  size?: 'small' | 'middle' | 'large'
}

export default function CD2WorkshopSelector({ value, onChange, phanXuongList, size = 'middle' }: Props) {
  return (
    <Space size={4}>
      <span style={{ fontSize: 13, color: '#595959' }}>Xưởng:</span>
      <Select
        size={size}
        allowClear
        placeholder="Tất cả xưởng"
        value={value ?? null}
        onChange={v => onChange(v ?? undefined)}
        style={{ minWidth: 160 }}
        options={[
          ...phanXuongList.map(px => ({
            value: px.id,
            label: (
              <Space size={4}>
                {px.ten_xuong}
                <Tag
                  color={px.cong_doan === 'cd1_cd2' ? 'blue' : 'green'}
                  style={{ fontSize: 10, margin: 0, padding: '0 4px' }}
                >
                  {px.cong_doan === 'cd1_cd2' ? 'CD1+2' : 'CD2'}
                </Tag>
              </Space>
            ),
          })),
        ]}
      />
    </Space>
  )
}
