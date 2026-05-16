import { useQuery } from '@tanstack/react-query'
import { phapNhanApi, PhapNhan } from '../api/phap_nhan'
import { COMPANY_CONFIGS } from '../utils/exportUtils'
import type { PrintCompanyInfo } from '../utils/exportUtils'

/** Fetch toàn bộ pháp nhân active, cache 5 phút */
export function usePhapNhanList() {
  return useQuery<PhapNhan[]>({
    queryKey: ['phap-nhan-active'],
    queryFn: () => phapNhanApi.list({ active_only: true }).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })
}

/** Fallback config theo name-pattern khi DB chưa có logo/màu */
function _fallbackConfig(pn: PhapNhan): PrintCompanyInfo {
  const name = pn.ten_phap_nhan.toUpperCase()
  if (name.includes("VISUNPACK")) return COMPANY_CONFIGS["VISUNPACK"]
  if (name.includes("L.A") || name.includes("LONG AN") || name.includes(" LA")) return COMPANY_CONFIGS["NAM PHUONG LONG AN"]
  return COMPANY_CONFIGS["NAM PHUONG"]
}

/**
 * Lấy thông tin pháp nhân để in.
 * - Nếu có `id` → lấy pháp nhân khớp id đó.
 * - Nếu không có `id` → dùng pháp nhân active đầu tiên làm default.
 * Ưu tiên logo_path + mau_sac_chinh từ DB; fallback về COMPANY_CONFIGS nếu chưa set.
 */
export function usePhapNhanForPrint(id?: number | null): PrintCompanyInfo | undefined {
  const { data: list } = usePhapNhanList()
  if (!list || list.length === 0) return undefined
  const pn = id ? list.find(p => p.id === id) : list[0]
  if (!pn) return undefined

  const fallback = _fallbackConfig(pn)

  return {
    ...fallback,
    ten: pn.ten_phap_nhan || fallback.ten,
    dia_chi: pn.dia_chi ?? fallback.dia_chi,
    ma_so_thue: pn.ma_so_thue ?? fallback.ma_so_thue,
    so_dien_thoai: pn.so_dien_thoai ?? fallback.so_dien_thoai,
    tai_khoan: pn.tai_khoan ?? fallback.tai_khoan,
    ngan_hang: pn.ngan_hang ?? fallback.ngan_hang,
    // Ưu tiên DB; nếu chưa có thì dùng fallback config
    logo: pn.logo_path ? `/${pn.logo_path.replace(/^\//, '')}` : fallback.logo,
    primary_color: pn.mau_sac_chinh ?? fallback.primary_color,
    accent_color: pn.mau_sac_chinh ?? fallback.accent_color,
    footer_accent_color: pn.mau_sac_chinh ?? fallback.footer_accent_color,
  }
}
