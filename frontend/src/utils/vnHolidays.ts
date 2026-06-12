/**
 * Ngày lễ Việt Nam — Dương lịch (cố định) + Âm lịch (hardcode 2024-2030).
 *
 * Phân loại:
 *  - 'lễ chính': nghỉ chính thức (theo Luật Lao động) → màu đỏ
 *  - 'lễ phụ': lễ ghi nhớ, ngày Quốc tế → màu cam
 *  - 'lễ ngành': ngày của ngành/giới (Phụ nữ VN, Nhà giáo...) → màu xanh
 *  - 'tâm linh': lễ tâm linh dân gian → màu tím
 */

export interface VnHoliday {
  ngay: string         // "MM-DD" (dương lịch) hoặc resolved date
  ten: string
  icon: string
  loai: 'le_chinh' | 'le_phu' | 'le_nganh' | 'tam_linh'
  color: string
  nghi_le?: boolean    // có được nghỉ lễ không
  am_lich?: boolean    // đánh dấu lễ âm lịch (để biết là di động qua các năm)
}

// ─── Lễ DƯƠNG LỊCH (cố định mỗi năm) ───
const SOLAR_HOLIDAYS: VnHoliday[] = [
  { ngay: '01-01', ten: 'Tết Dương lịch',             icon: '🎊', loai: 'le_chinh', color: '#cf1322', nghi_le: true },
  { ngay: '02-03', ten: 'Thành lập Đảng CSVN',        icon: '⭐', loai: 'le_phu',   color: '#fa541c' },
  { ngay: '02-14', ten: 'Valentine',                  icon: '💝', loai: 'le_phu',   color: '#eb2f96' },
  { ngay: '03-08', ten: 'Quốc tế Phụ nữ',             icon: '🌹', loai: 'le_nganh', color: '#1677ff' },
  { ngay: '03-26', ten: 'Thành lập Đoàn TNCS HCM',    icon: '🎖️', loai: 'le_phu',   color: '#fa541c' },
  { ngay: '04-30', ten: 'Giải phóng miền Nam',        icon: '🇻🇳', loai: 'le_chinh', color: '#cf1322', nghi_le: true },
  { ngay: '05-01', ten: 'Quốc tế Lao động',           icon: '🛠️', loai: 'le_chinh', color: '#cf1322', nghi_le: true },
  { ngay: '05-07', ten: 'Chiến thắng Điện Biên Phủ',  icon: '🏆', loai: 'le_phu',   color: '#fa541c' },
  { ngay: '05-19', ten: 'Sinh nhật Bác Hồ',           icon: '☀️', loai: 'le_phu',   color: '#fa541c' },
  { ngay: '06-01', ten: 'Quốc tế Thiếu nhi',          icon: '🎈', loai: 'le_phu',   color: '#fa8c16' },
  { ngay: '06-21', ten: 'Báo chí CM Việt Nam',        icon: '📰', loai: 'le_nganh', color: '#1677ff' },
  { ngay: '07-27', ten: 'Thương binh Liệt sĩ',        icon: '🕊️', loai: 'le_phu',   color: '#fa541c' },
  { ngay: '08-19', ten: 'CM Tháng Tám',               icon: '🌟', loai: 'le_phu',   color: '#fa541c' },
  { ngay: '09-02', ten: 'Quốc khánh 2/9',             icon: '🇻🇳', loai: 'le_chinh', color: '#cf1322', nghi_le: true },
  { ngay: '10-10', ten: 'Giải phóng Thủ đô',          icon: '🏛️', loai: 'le_phu',   color: '#fa541c' },
  { ngay: '10-20', ten: 'Phụ nữ Việt Nam',            icon: '🌸', loai: 'le_nganh', color: '#1677ff' },
  { ngay: '11-20', ten: 'Nhà giáo Việt Nam',          icon: '👨‍🏫', loai: 'le_nganh', color: '#1677ff' },
  { ngay: '12-22', ten: 'QĐND Việt Nam',              icon: '🪖', loai: 'le_nganh', color: '#1677ff' },
  { ngay: '12-24', ten: 'Đêm Giáng sinh',             icon: '🎄', loai: 'le_phu',   color: '#52c41a' },
  { ngay: '12-25', ten: 'Giáng sinh',                 icon: '🎅', loai: 'le_phu',   color: '#52c41a' },
]

// ─── Lễ ÂM LỊCH (hardcode 2024-2030, resolve về DƯƠNG LỊCH) ───
// Tra cứu từ lịch âm — cập nhật khi cần năm mới.
const LUNAR_HOLIDAYS_BY_YEAR: Record<number, VnHoliday[]> = {
  2024: [
    { ngay: '2024-02-08', ten: 'Đưa ông Táo (23 Tết)', icon: '🪔', loai: 'tam_linh', color: '#722ed1', am_lich: true },
    { ngay: '2024-02-09', ten: 'Giao thừa',            icon: '🧨', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2024-02-10', ten: 'Mùng 1 Tết',           icon: '🧧', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2024-02-11', ten: 'Mùng 2 Tết',           icon: '🧧', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2024-02-12', ten: 'Mùng 3 Tết',           icon: '🧧', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2024-04-18', ten: 'Giỗ tổ Hùng Vương',    icon: '🏛️', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2024-09-17', ten: 'Tết Trung thu',         icon: '🥮', loai: 'tam_linh', color: '#722ed1', am_lich: true },
  ],
  2025: [
    { ngay: '2025-01-22', ten: 'Đưa ông Táo (23 Tết)', icon: '🪔', loai: 'tam_linh', color: '#722ed1', am_lich: true },
    { ngay: '2025-01-28', ten: 'Giao thừa',            icon: '🧨', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2025-01-29', ten: 'Mùng 1 Tết',           icon: '🧧', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2025-01-30', ten: 'Mùng 2 Tết',           icon: '🧧', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2025-01-31', ten: 'Mùng 3 Tết',           icon: '🧧', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2025-04-07', ten: 'Giỗ tổ Hùng Vương',    icon: '🏛️', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2025-10-06', ten: 'Tết Trung thu',         icon: '🥮', loai: 'tam_linh', color: '#722ed1', am_lich: true },
  ],
  2026: [
    { ngay: '2026-02-10', ten: 'Đưa ông Táo (23 Tết)', icon: '🪔', loai: 'tam_linh', color: '#722ed1', am_lich: true },
    { ngay: '2026-02-16', ten: 'Giao thừa',            icon: '🧨', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2026-02-17', ten: 'Mùng 1 Tết',           icon: '🧧', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2026-02-18', ten: 'Mùng 2 Tết',           icon: '🧧', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2026-02-19', ten: 'Mùng 3 Tết',           icon: '🧧', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2026-04-26', ten: 'Giỗ tổ Hùng Vương',    icon: '🏛️', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2026-09-25', ten: 'Tết Trung thu',         icon: '🥮', loai: 'tam_linh', color: '#722ed1', am_lich: true },
  ],
  2027: [
    { ngay: '2027-01-30', ten: 'Đưa ông Táo (23 Tết)', icon: '🪔', loai: 'tam_linh', color: '#722ed1', am_lich: true },
    { ngay: '2027-02-05', ten: 'Giao thừa',            icon: '🧨', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2027-02-06', ten: 'Mùng 1 Tết',           icon: '🧧', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2027-02-07', ten: 'Mùng 2 Tết',           icon: '🧧', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2027-02-08', ten: 'Mùng 3 Tết',           icon: '🧧', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2027-04-15', ten: 'Giỗ tổ Hùng Vương',    icon: '🏛️', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2027-09-15', ten: 'Tết Trung thu',         icon: '🥮', loai: 'tam_linh', color: '#722ed1', am_lich: true },
  ],
  2028: [
    { ngay: '2028-01-19', ten: 'Đưa ông Táo (23 Tết)', icon: '🪔', loai: 'tam_linh', color: '#722ed1', am_lich: true },
    { ngay: '2028-01-25', ten: 'Giao thừa',            icon: '🧨', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2028-01-26', ten: 'Mùng 1 Tết',           icon: '🧧', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2028-01-27', ten: 'Mùng 2 Tết',           icon: '🧧', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2028-01-28', ten: 'Mùng 3 Tết',           icon: '🧧', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2028-04-03', ten: 'Giỗ tổ Hùng Vương',    icon: '🏛️', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2028-10-03', ten: 'Tết Trung thu',         icon: '🥮', loai: 'tam_linh', color: '#722ed1', am_lich: true },
  ],
  2029: [
    { ngay: '2029-02-06', ten: 'Đưa ông Táo (23 Tết)', icon: '🪔', loai: 'tam_linh', color: '#722ed1', am_lich: true },
    { ngay: '2029-02-12', ten: 'Giao thừa',            icon: '🧨', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2029-02-13', ten: 'Mùng 1 Tết',           icon: '🧧', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2029-02-14', ten: 'Mùng 2 Tết',           icon: '🧧', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2029-02-15', ten: 'Mùng 3 Tết',           icon: '🧧', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2029-04-22', ten: 'Giỗ tổ Hùng Vương',    icon: '🏛️', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2029-09-22', ten: 'Tết Trung thu',         icon: '🥮', loai: 'tam_linh', color: '#722ed1', am_lich: true },
  ],
  2030: [
    { ngay: '2030-01-26', ten: 'Đưa ông Táo (23 Tết)', icon: '🪔', loai: 'tam_linh', color: '#722ed1', am_lich: true },
    { ngay: '2030-02-02', ten: 'Giao thừa',            icon: '🧨', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2030-02-03', ten: 'Mùng 1 Tết',           icon: '🧧', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2030-02-04', ten: 'Mùng 2 Tết',           icon: '🧧', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2030-02-05', ten: 'Mùng 3 Tết',           icon: '🧧', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2030-04-12', ten: 'Giỗ tổ Hùng Vương',    icon: '🏛️', loai: 'le_chinh', color: '#cf1322', nghi_le: true, am_lich: true },
    { ngay: '2030-09-11', ten: 'Tết Trung thu',         icon: '🥮', loai: 'tam_linh', color: '#722ed1', am_lich: true },
  ],
}

/**
 * Lấy danh sách lễ Việt Nam trong 1 tháng/năm cụ thể.
 *
 * @param year — năm dương lịch
 * @param month — tháng dương lịch (1-12)
 * @returns Map từ "YYYY-MM-DD" → list lễ trong ngày đó
 */
export function getVnHolidaysForMonth(year: number, month: number): Record<string, VnHoliday[]> {
  const result: Record<string, VnHoliday[]> = {}
  const mm = String(month).padStart(2, '0')

  // 1. Lễ dương lịch (cố định)
  for (const h of SOLAR_HOLIDAYS) {
    if (h.ngay.startsWith(mm + '-') || h.ngay.startsWith(mm)) {
      const dd = h.ngay.split('-')[1] || h.ngay.slice(3)
      const key = `${year}-${mm}-${dd}`
      result[key] = result[key] || []
      result[key].push(h)
    }
  }

  // 2. Lễ âm lịch (resolved theo năm)
  const lunars = LUNAR_HOLIDAYS_BY_YEAR[year] || []
  for (const h of lunars) {
    if (h.ngay.startsWith(`${year}-${mm}-`)) {
      const key = h.ngay
      result[key] = result[key] || []
      result[key].push(h)
    }
  }

  return result
}

/**
 * Kiểm tra 1 ngày có phải lễ nghỉ chính thức không.
 */
export function isVnPublicHoliday(dateIso: string): boolean {
  const [yearStr, mmStr, ddStr] = dateIso.split('-')
  const year = Number(yearStr)
  const month = Number(mmStr)
  const map = getVnHolidaysForMonth(year, month)
  return (map[dateIso] || []).some(h => h.nghi_le)
}
