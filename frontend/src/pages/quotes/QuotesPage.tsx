import { useSearchParams } from 'react-router-dom'
import MasterDetailLayout from '../../components/MasterDetailLayout'
import QuoteList from './QuoteList'
import QuoteDetail from './QuoteDetail'

export default function QuotesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('id') ? Number(searchParams.get('id')) : null

  return (
    <MasterDetailLayout
      master={
        <QuoteList
          selectedId={selectedId}
          onSelect={(id) => setSearchParams({ id: String(id) })}
        />
      }
      detail={selectedId ? <QuoteDetail key={selectedId} quoteId={selectedId} embedded /> : null}
      emptyText="Chọn báo giá để xem chi tiết"
    />
  )
}
