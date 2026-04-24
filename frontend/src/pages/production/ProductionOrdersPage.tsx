import { useSearchParams } from 'react-router-dom'
import MasterDetailLayout from '../../components/MasterDetailLayout'
import ProductionOrderList from './ProductionOrderList'
import ProductionOrderDetail from './ProductionOrderDetail'

export default function ProductionOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('id') ? Number(searchParams.get('id')) : null

  return (
    <MasterDetailLayout
      master={
        <ProductionOrderList
          selectedId={selectedId}
          onSelect={(id) => setSearchParams({ id: String(id) })}
        />
      }
      detail={selectedId ? <ProductionOrderDetail key={selectedId} orderId={selectedId} embedded /> : null}
      emptyText="Chọn lệnh sản xuất để xem chi tiết"
    />
  )
}
