import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { warehouseApi } from '../api/warehouse'
import type { PhanXuong } from '../api/warehouse'

const STORAGE_KEY = 'cd2_selected_xuong'

export function useCD2Workshop() {
  const [phanXuongId, setPhanXuongIdState] = useState<number | undefined>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? Number(stored) : undefined
  })

  const { data: phanXuongList = [] } = useQuery<PhanXuong[]>({
    queryKey: ['phan-xuong-list'],
    queryFn: () => warehouseApi.listPhanXuong().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const setPhanXuongId = (id: number | undefined) => {
    setPhanXuongIdState(id)
    if (id === undefined) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, String(id))
    }
  }

  // Nếu xưởng đã lưu không còn tồn tại → reset
  useEffect(() => {
    if (phanXuongId && phanXuongList.length > 0) {
      const exists = phanXuongList.some(px => px.id === phanXuongId)
      if (!exists) setPhanXuongId(undefined)
    }
  }, [phanXuongList, phanXuongId])

  return { phanXuongId, setPhanXuongId, phanXuongList }
}
