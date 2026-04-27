import { useSearchParams } from 'react-router-dom'
import MasterDetailLayout from '../../components/MasterDetailLayout'
import PurchaseOrderList from './PurchaseOrderList'
import PurchaseOrderDetail from './PurchaseOrderDetail'

export default function PurchaseOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('id') ? Number(searchParams.get('id')) : null

  return (
    <MasterDetailLayout
      master={
        <PurchaseOrderList
          selectedId={selectedId}
          onSelect={(id) => setSearchParams({ id: String(id) })}
        />
      }
      detail={selectedId ? <PurchaseOrderDetail key={selectedId} orderId={selectedId} embedded /> : null}
      emptyText="Chọn đơn mua để xem chi tiết"
    />
  )
}
