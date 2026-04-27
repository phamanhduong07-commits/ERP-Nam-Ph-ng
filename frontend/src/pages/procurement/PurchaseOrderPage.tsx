import { useParams, useNavigate } from 'react-router-dom'
import PurchaseOrderDetail from './PurchaseOrderDetail'

export default function PurchaseOrderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  if (!id) { navigate('/procurement/purchase-orders'); return null }
  return <PurchaseOrderDetail orderId={Number(id)} />
}
