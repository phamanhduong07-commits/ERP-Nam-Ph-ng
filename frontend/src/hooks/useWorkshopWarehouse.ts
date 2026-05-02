import { useQuery } from '@tanstack/react-query'
import { warehousesApi } from '../api/warehouses'

export function useWorkshopWarehouse(
  phanXuongId: number | undefined | null,
  loaiKho: string,
) {
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesApi.list().then(r => r.data),
  })

  if (!phanXuongId) return undefined
  return warehouses.find(
    w => w.phan_xuong_id === phanXuongId && w.loai_kho === loaiKho && w.trang_thai
  )
}
