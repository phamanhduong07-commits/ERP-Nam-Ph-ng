import { useSearchParams } from 'react-router-dom'
import MasterDetailLayout from '../../components/MasterDetailLayout'
import ProductionPlanList from './ProductionPlanList'
import ProductionPlanDetail from './ProductionPlanDetail'

export default function ProductionPlansPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('id') ? Number(searchParams.get('id')) : null

  return (
    <MasterDetailLayout
      master={
        <ProductionPlanList
          selectedId={selectedId}
          onSelect={(id) => setSearchParams({ id: String(id) })}
        />
      }
      detail={
        selectedId
          ? <ProductionPlanDetail key={selectedId} planId={selectedId} embedded />
          : null
      }
      emptyText="Chọn kế hoạch để xem chi tiết"
    />
  )
}
