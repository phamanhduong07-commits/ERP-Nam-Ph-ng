import { useSearchParams } from 'react-router-dom'
import MasterDetailLayout from '../../components/MasterDetailLayout'
import OrderList from './OrderList'
import OrderDetail from './OrderDetail'

export default function SalesOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('id') ? Number(searchParams.get('id')) : null

  return (
    <MasterDetailLayout
      master={
        <OrderList
          selectedId={selectedId}
          onSelect={(id) => setSearchParams({ id: String(id) })}
        />
      }
      detail={selectedId ? <OrderDetail key={selectedId} orderId={selectedId} embedded /> : null}
      emptyText="Chọn đơn hàng để xem chi tiết"
    />
  )
}
