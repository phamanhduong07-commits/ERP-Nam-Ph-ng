import { useState } from 'react'
import { Button, Tooltip, message } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { lookupMST, MSTInfo } from '../utils/mstLookup'

interface Props {
  getMST: () => string
  onFound: (info: MSTInfo) => void
}

export default function MSTLookupButton({ getMST, onFound }: Props) {
  const [loading, setLoading] = useState(false)

  const handleLookup = async () => {
    const mst = getMST()
    if (!mst?.trim()) {
      message.warning('Nhập mã số thuế trước')
      return
    }
    setLoading(true)
    try {
      const info = await lookupMST(mst)
      onFound(info)
      message.success('Đã tìm thấy thông tin doanh nghiệp')
    } catch (e: any) {
      message.error(e?.message || 'Tra cứu thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Tooltip title="Tra cứu thông tin từ MST quốc gia">
      <Button
        icon={<SearchOutlined />}
        loading={loading}
        onClick={handleLookup}
        size="small"
        type="dashed"
      >
        Tra cứu MST
      </Button>
    </Tooltip>
  )
}
