import { useSearchParams } from 'react-router-dom'
import MasterDetailLayout from '../../components/MasterDetailLayout'
import MaterialReceiptList from './MaterialReceiptList'
import MaterialReceiptDetail from './MaterialReceiptDetail'

export default function MaterialReceiptsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('id') ? Number(searchParams.get('id')) : null

  return (
    <MasterDetailLayout
      master={
        <MaterialReceiptList
          selectedId={selectedId}
          onSelect={(id) => setSearchParams({ id: String(id) })}
        />
      }
      detail={selectedId ? <MaterialReceiptDetail key={selectedId} receiptId={selectedId} embedded /> : null}
      emptyText="Chọn phiếu nhập để xem chi tiết"
    />
  )
}
