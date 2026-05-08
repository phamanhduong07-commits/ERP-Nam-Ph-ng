import { useQuery } from '@tanstack/react-query'
import { phapNhanApi, PhapNhan } from '../api/phap_nhan'
import type { PrintCompanyInfo } from '../utils/exportUtils'

/** Fetch toàn bộ pháp nhân active, cache 5 phút */
export function usePhapNhanList() {
  return useQuery<PhapNhan[]>({
    queryKey: ['phap-nhan-active'],
    queryFn: () => phapNhanApi.list({ active_only: true }).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Lấy thông tin pháp nhân để in.
 * - Nếu có `id` → lấy pháp nhân khớp id đó.
 * - Nếu không có `id` → dùng pháp nhân active đầu tiên làm default.
 * Trả về `PrintCompanyInfo` hoặc `undefined` khi đang tải.
 */
export function usePhapNhanForPrint(id?: number | null): PrintCompanyInfo | undefined {
  const { data: list } = usePhapNhanList()
  if (!list || list.length === 0) return undefined
  const pn = id ? (list.find(p => p.id === id) ?? list[0]) : list[0]
  return {
    ten: pn.ten_phap_nhan,
    dia_chi: pn.dia_chi,
    ma_so_thue: pn.ma_so_thue,
    so_dien_thoai: pn.so_dien_thoai,
    tai_khoan: pn.tai_khoan,
    ngan_hang: pn.ngan_hang,
  }
}
