import { useParams, useNavigate } from 'react-router-dom'
import MaterialReceiptDetail from './MaterialReceiptDetail'

export default function MaterialReceiptPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  if (!id) { navigate('/procurement/material-receipts'); return null }
  return <MaterialReceiptDetail receiptId={Number(id)} />
}
