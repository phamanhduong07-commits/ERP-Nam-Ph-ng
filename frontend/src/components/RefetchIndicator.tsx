import { SyncOutlined } from '@ant-design/icons'

interface Props {
  isFetching: boolean
}

/** Spinner nhỏ hiện khi React Query đang refetch (không phải load lần đầu). */
export function RefetchIndicator({ isFetching }: Props) {
  if (!isFetching) return null
  return <SyncOutlined spin style={{ fontSize: 13, color: '#1b168e', marginLeft: 6 }} />
}
