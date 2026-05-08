import { useQuery } from '@tanstack/react-query'
import { phapNhanApi, PhapNhan } from '../api/phap_nhan'
import { theoDoiApi, PhanXuongItem } from '../api/theoDoi'

export function usePhapNhan() {
  const query = useQuery<PhapNhan[]>({
    queryKey: ['phap-nhan-active'],
    queryFn: () => phapNhanApi.list({ active_only: true }).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
  return { 
    phapNhanList: query.data || [], 
    isLoading: query.isLoading 
  }
}

export function usePhanXuong() {
  const query = useQuery<PhanXuongItem[]>({
    queryKey: ['phan-xuong-list'],
    queryFn: () => theoDoiApi.listPhanXuong().then(r => r.data),
    staleTime: 10 * 60 * 1000,
  })
  return { 
    phanXuongList: query.data || [], 
    isLoading: query.isLoading 
  }
}
