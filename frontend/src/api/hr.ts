import client from './client'

export interface Department {
  id: number
  ma_bo_phan: string
  ten_bo_phan: string
  mo_ta?: string
  parent_id?: number
  phan_xuong_id?: number
  phap_nhan_id?: number
  trang_thai: boolean
  created_at: string
}

export interface Position {
  id: number
  ma_chuc_vu: string
  ten_chuc_vu: string
  cap_bac?: number
  mo_ta?: string
  trang_thai: boolean
}

export interface HealthCheckRecord {
  id: number
  employee_id: number
  ngay_kham: string
  loai_kham: string  // dinh_ky | dot_xuat | truoc_tuyen_dung | sau_om_dau
  phan_loai_suc_khoe?: string | null  // I-V
  noi_kham?: string | null
  bac_si?: string | null
  ket_luan?: string | null
  benh_man_tinh?: string | null
  file_url?: string | null
  chi_phi?: number
  ngay_kham_tiep_theo?: string | null
  ghi_chu?: string | null
  created_at?: string
  // Enriched
  ho_ten?: string | null
  ma_nv?: string | null
  ten_bo_phan?: string | null
  ten_phap_nhan?: string | null
}

export interface Team {
  id: number
  ten_to: string
  bo_phan_id?: number | null
  to_truong_id?: number | null
  mo_ta?: string | null
  trang_thai: boolean
  // Derived (server enriched)
  ten_bo_phan?: string | null
  ho_ten_to_truong?: string | null
  so_nv?: number
  created_at?: string
}

export interface Employee {
  id: number
  ma_nv: string
  ho_ten: string
  // Extended (giai đoạn 1 HR form)
  ho_dem?: string
  ten?: string
  ten_bi_danh?: string
  quoc_tich?: string
  dan_toc?: string
  ton_giao?: string
  noi_sinh_tinh?: string
  noi_sinh_dia_chi?: string
  tinh_que_quan?: string
  huyen_que_quan?: string
  phuong_que_quan?: string
  dia_chi_que_quan?: string
  tinh_ho_khau?: string
  huyen_ho_khau?: string
  phuong_ho_khau?: string
  dia_chi_ho_khau?: string
  dia_chi_hien_tai?: string
  dien_thoai_ban?: string
  avatar_url?: string
  // Existing
  ngay_sinh?: string
  gioi_tinh?: string
  cccd?: string
  ngay_cap?: string
  noi_cap?: string
  dia_chi?: string
  que_quan?: string
  so_dien_thoai?: string
  email?: string
  so_tk_ngan_hang?: string
  ten_ngan_hang?: string
  chi_nhanh_ngan_hang?: string
  phap_nhan_id?: number
  phan_xuong_id?: number
  bo_phan_id?: number
  to_id?: number | null
  chuc_vu_id?: number
  ma_van_tay?: string
  user_id?: number
  ngay_vao_lam?: string
  ngay_nghi_viec?: string
  trang_thai: string
  // Vận chuyển
  is_tai_xe?: boolean
  is_lo_xe?: boolean
  hang_bang_lai?: string
  ngay_het_han_bang?: string
  ten_bo_phan?: string
  ten_chuc_vu?: string
  ten_phan_xuong?: string
  ten_phap_nhan?: string
  ten_to?: string | null
  has_account?: boolean
  username?: string
  user_status?: boolean
}

export interface FamilyRelation {
  id: number
  employee_id: number
  ho_ten: string
  nam_sinh?: number
  moi_quan_he?: string
  nghe_nghiep?: string
  so_dien_thoai?: string
  ghi_chu?: string
  created_at: string
}

export interface EmployeeDocument {
  id: number
  employee_id: number
  ten_tai_lieu: string
  loai_tai_lieu: string
  file_path: string
  ngay_het_han?: string
  created_at: string
}

export interface EmployeeHistory {
  id: number
  employee_id: number
  loai: string  // he_so | chuc_vu | bo_phan | luong_cb | phu_cap
  gia_tri_cu?: string
  gia_tri_moi?: string
  ly_do?: string
  ngay_hieu_luc: string
  created_at: string
  created_by?: number
}

export interface LaborContract {
  id: number
  employee_id: number
  so_hop_dong: string
  loai_hop_dong: string
  ngay_ky: string
  ngay_hieu_luc: string
  ngay_het_han?: string
  luong_co_ban: number
  phu_cap?: number
  trang_thai: string
}

export interface CheckInLocation {
  id: number
  ten: string
  dia_chi?: string
  lat: number
  lng: number
  ban_kinh_m: number
  mau_sac?: string
  ghi_chu?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CheckInResponse {
  success: boolean
  message: string
  type: 'in' | 'out'
  log_id?: number
  location_id?: number
  location_name?: string
  distance_m?: number
}

export interface AttendanceToday {
  log_id: number
  employee_id: number
  ma_nv: string
  ho_ten: string
  gio_vao?: string
  gio_ra?: string
  loai: string
  checkin_lat?: number
  checkin_lng?: number
  checkin_address?: string
  checkin_selfie_url?: string
  checkin_distance_m?: number
  checkout_address?: string
  location_id?: number
  location_name?: string
  trang_thai: string
}

export interface PayrollConfig {
  id: number
  ma_hang: string
  ten_hang: string
  phan_xuong_id?: number
  cong_doan?: string
  phan_tram_luong_sp: number
  don_gia: number
  loai: string
  ghi_chu?: string
  trang_thai: boolean
}

export const hrApi = {
  // Departments
  listDepartments: () => client.get<Department[]>('/hr/departments'),
  createDepartment: (data: Partial<Department>) => client.post<Department>('/hr/departments', data),
  updateDepartment: (id: number, data: Partial<Department>) => client.put<Department>(`/hr/departments/${id}`, data),
  deleteDepartment: (id: number) => client.delete(`/hr/departments/${id}`),

  // Positions
  listPositions: () => client.get<Position[]>('/hr/positions'),
  createPosition: (data: Partial<Position>) => client.post<Position>('/hr/positions', data),
  updatePosition: (id: number, data: Partial<Position>) => client.put<Position>(`/hr/positions/${id}`, data),
  deletePosition: (id: number) => client.delete(`/hr/positions/${id}`),

  // Teams (Tổ / Nhóm — cấp dưới Bộ phận)
  listTeams: (params?: { bo_phan_id?: number }) =>
    client.get<Team[]>('/hr/teams', { params }),
  createTeam: (data: Partial<Team>) => client.post<Team>('/hr/teams', data),
  updateTeam: (id: number, data: Partial<Team>) => client.put<Team>(`/hr/teams/${id}`, data),
  deleteTeam: (id: number) => client.delete(`/hr/teams/${id}`),

  // Health Checks (Khám sức khỏe định kỳ)
  listHealthChecks: (params?: {
    employee_id?: number; phan_loai?: string;
    from_date?: string; to_date?: string; due_soon_days?: number
  }) => client.get<HealthCheckRecord[]>('/hr/health-checks', { params }),
  healthCheckSummary: () => client.get<{
    total_records: number; total_nv: number; nv_da_kham: number; nv_chua_kham: number
    due_30: number; due_60: number; overdue: number
    by_phan_loai: { name: string; value: number }[]
  }>('/hr/health-checks/summary'),
  createHealthCheck: (data: Partial<HealthCheckRecord>) =>
    client.post<HealthCheckRecord>('/hr/health-checks', data),
  updateHealthCheck: (id: number, data: Partial<HealthCheckRecord>) =>
    client.put<HealthCheckRecord>(`/hr/health-checks/${id}`, data),
  deleteHealthCheck: (id: number) => client.delete(`/hr/health-checks/${id}`),

  // Safety — BHLĐ
  safetyListEquipments: (params?: { active_only?: boolean }) =>
    client.get<any[]>('/hr/safety/equipments', { params }),
  safetyCreateEquipment: (data: any) => client.post('/hr/safety/equipments', data),
  safetyUpdateEquipment: (id: number, data: any) => client.put(`/hr/safety/equipments/${id}`, data),
  safetyDeleteEquipment: (id: number) => client.delete(`/hr/safety/equipments/${id}`),
  safetyListIssues: (params?: { employee_id?: number; equipment_id?: number; expiring_days?: number }) =>
    client.get<any[]>('/hr/safety/issues', { params }),
  safetyCreateIssue: (data: any) => client.post('/hr/safety/issues', data),
  safetyDeleteIssue: (id: number) => client.delete(`/hr/safety/issues/${id}`),
  // Safety — Trainings
  safetyListTrainings: (params?: { nhom?: string; trang_thai?: string }) =>
    client.get<any[]>('/hr/safety/trainings', { params }),
  safetyCreateTraining: (data: any) => client.post('/hr/safety/trainings', data),
  safetyUpdateTraining: (id: number, data: any) => client.put(`/hr/safety/trainings/${id}`, data),
  safetyDeleteTraining: (id: number) => client.delete(`/hr/safety/trainings/${id}`),
  safetyListParticipants: (training_id: number) =>
    client.get<any[]>(`/hr/safety/trainings/${training_id}/participants`),
  safetyAddParticipants: (training_id: number, body: any[]) =>
    client.post(`/hr/safety/trainings/${training_id}/participants`, body),
  safetyUpdateParticipant: (id: number, data: any) => client.put(`/hr/safety/participants/${id}`, data),
  safetyDeleteParticipant: (id: number) => client.delete(`/hr/safety/participants/${id}`),
  // Safety — Accidents
  safetyListAccidents: (params?: { muc_do?: string; from_date?: string; to_date?: string }) =>
    client.get<any[]>('/hr/safety/accidents', { params }),
  safetyCreateAccident: (data: any) => client.post('/hr/safety/accidents', data),
  safetyUpdateAccident: (id: number, data: any) => client.put(`/hr/safety/accidents/${id}`, data),
  safetyDeleteAccident: (id: number) => client.delete(`/hr/safety/accidents/${id}`),
  // KPI
  kpiListTemplates: (params?: { active_only?: boolean }) =>
    client.get<any[]>('/hr/kpi/templates', { params }),
  kpiGetTemplate: (id: number) => client.get<any>(`/hr/kpi/templates/${id}`),
  kpiCreateTemplate: (data: any) => client.post('/hr/kpi/templates', data),
  kpiUpdateTemplate: (id: number, data: any) => client.put(`/hr/kpi/templates/${id}`, data),
  kpiDeleteTemplate: (id: number) => client.delete(`/hr/kpi/templates/${id}`),

  kpiListCycles: () => client.get<any[]>('/hr/kpi/cycles'),
  kpiCreateCycle: (data: any) => client.post('/hr/kpi/cycles', data),
  kpiUpdateCycle: (id: number, data: any) => client.put(`/hr/kpi/cycles/${id}`, data),
  kpiDeleteCycle: (id: number) => client.delete(`/hr/kpi/cycles/${id}`),

  kpiGenerateEvaluations: (data: any) => client.post('/hr/kpi/evaluations/generate', data),
  kpiListEvaluations: (params?: { cycle_id?: number; employee_id?: number; trang_thai?: string; bo_phan_id?: number }) =>
    client.get<any[]>('/hr/kpi/evaluations', { params }),
  kpiGetEvaluation: (id: number) => client.get<any>(`/hr/kpi/evaluations/${id}`),
  kpiSubmitEvaluation: (id: number, data: any) => client.put(`/hr/kpi/evaluations/${id}/submit`, data),
  kpiApproveEvaluation: (id: number, nhan_xet_bgd?: string) =>
    client.put(`/hr/kpi/evaluations/${id}/approve`, null, { params: { nhan_xet_bgd } }),
  kpiDeleteEvaluation: (id: number) => client.delete(`/hr/kpi/evaluations/${id}`),

  kpiSummary: (params?: { cycle_id?: number }) =>
    client.get<{ total: number; by_status: Record<string, number>;
                 by_xep_loai: { name: string; value: number }[]; avg_score: number }>(
      '/hr/kpi/summary', { params },
    ),

  // Payroll Adjustments — Sprint D.4
  listAdjustments: (params?: { thang?: number; nam?: number; employee_id?: number; loai?: string; sub_loai?: string; bo_phan_id?: number; trang_thai?: string }) =>
    client.get<any[]>('/hr/payroll-adjustments', { params }),
  adjustmentEnum: () => client.get<{ cong_them: { value: string; label: string }[]; khau_tru: { value: string; label: string }[] }>('/hr/payroll-adjustments/enum'),
  adjustmentSummary: (params: { thang: number; nam: number; bo_phan_id?: number }) =>
    client.get<any>('/hr/payroll-adjustments/summary', { params }),
  createAdjustment: (data: any) => client.post('/hr/payroll-adjustments', data),
  bulkCreateAdjustments: (items: any[]) => client.post('/hr/payroll-adjustments/bulk', { items }),
  updateAdjustment: (id: number, data: any) => client.put(`/hr/payroll-adjustments/${id}`, data),
  approveAdjustment: (id: number) => client.put(`/hr/payroll-adjustments/${id}/approve`),
  deleteAdjustment: (id: number) => client.delete(`/hr/payroll-adjustments/${id}`),
  autoGenBhxh: (data: { thang: number; nam: number; bo_phan_id?: number }) =>
    client.post('/hr/payroll-adjustments/auto-generate-bh', data),

  // Production outputs — Sprint D.2
  listProductionOutputs: (params?: { nam?: number; thang?: number; ma_hang?: string; bo_phan_id?: number; to_id?: number; trang_thai?: string }) =>
    client.get<any[]>('/hr/production-outputs', { params }),
  productionSummary: (params: { nam: number; thang: number; bo_phan_id?: number }) =>
    client.get<{
      ky: string; tu_ngay: string; den_ngay: string
      tong_san_luong: number; tong_san_luong_loi: number; tong_quy_luong_sp: number
      so_ngay_co_sl: number; so_record_da_xac_nhan: number; so_record_cho_xac_nhan: number
      by_ma_hang: { ma_hang: string; ten_hang: string | null; san_luong: number; san_luong_loi: number; quy_luong: number }[]
      by_bo_phan: { ten_bo_phan: string; san_luong: number; quy_luong: number }[]
    }>('/hr/production-outputs/summary', { params }),
  createProductionOutput: (data: any) => client.post('/hr/production-outputs', data),
  bulkCreateProductionOutput: (items: any[]) => client.post('/hr/production-outputs/bulk', { items }),
  updateProductionOutput: (id: number, data: any) => client.put(`/hr/production-outputs/${id}`, data),
  confirmProductionOutput: (id: number) => client.put(`/hr/production-outputs/${id}/confirm`),
  deleteProductionOutput: (id: number) => client.delete(`/hr/production-outputs/${id}`),

  // Payroll Engine (Sprint D.3)
  enginePreview: (data: { nam: number; thang: number; bo_phan_id?: number }) =>
    client.post('/hr/payroll/engine/preview', { ...data, dry_run: true }),
  engineCommit: (data: { nam: number; thang: number; bo_phan_id?: number }) =>
    client.post('/hr/payroll/engine/commit', { ...data, dry_run: false }),

  // Payroll Runs (Sprint D.5)
  listPayrollRuns: (params: { nam: number; thang: number; bo_phan_id?: number; trang_thai?: string }) =>
    client.get<any[]>('/hr/payroll-runs', { params }),
  payrollRunsSummary: (params: { nam: number; thang: number; bo_phan_id?: number }) =>
    client.get<{
      total: number
      quy_luong_san_pham: number; quy_bu_toi_thieu_vung: number
      quy_cong_them: number; quy_khau_tru: number; quy_thuc_linh: number
      by_trang_thai: Record<string, number>
    }>('/hr/payroll-runs/summary', { params }),
  chotPayroll: (data: { nam: number; thang: number; bo_phan_id?: number; ghi_chu?: string; xac_nhan_tat_ca?: boolean }) =>
    client.post('/hr/payroll-runs/chot', data),
  duyetThanhToanPayroll: (data: { nam: number; thang: number; bo_phan_id?: number; xac_nhan_tat_ca?: boolean }) =>
    client.post('/hr/payroll-runs/duyet-thanh-toan', data),
  moKhoaPayrollRun: (id: number, ly_do: string) => client.post(`/hr/payroll-runs/${id}/mo-khoa`, { ly_do }),
  deleteDraftRuns: (data: { nam: number; thang: number; bo_phan_id?: number; xac_nhan_tat_ca?: boolean }) =>
    client.post('/hr/payroll-runs/delete-drafts', data),

  // Payroll Complaints (Sprint D.5 — Điều 16)
  listComplaints: (params?: { thang?: number; nam?: number; trang_thai?: string; bo_phan_id?: number }) =>
    client.get<any[]>('/hr/payroll-complaints', { params }),
  complaintsSummary: (params: { thang?: number; nam?: number }) =>
    client.get<{ tong: number; by_trang_thai: Record<string, number> }>('/hr/payroll-complaints/summary', { params }),
  createComplaint: (data: any) => client.post('/hr/payroll-complaints', data),
  updateComplaint: (id: number, data: any) => client.put(`/hr/payroll-complaints/${id}`, data),
  takeComplaint: (id: number) => client.post(`/hr/payroll-complaints/${id}/take`),
  resolveComplaint: (id: number, data: any) => client.post(`/hr/payroll-complaints/${id}/resolve`, data),
  deleteComplaint: (id: number) => client.delete(`/hr/payroll-complaints/${id}`),
  autoExpireComplaints: () => client.post('/hr/payroll-complaints/_auto_expire'),

  // My Payslip — Mobile (Sprint D.5)
  getMyPayslip: (nam: number, thang: number) => client.get<any>(`/hr/my-payslip/${nam}/${thang}`),
  listMyAvailableMonths: () => client.get<{ nam: number; thang: number; trang_thai: string; thuc_linh: number }[]>('/hr/my-payslip/list/available'),

  // My KPI + Health (Polish-2 Mobile)
  getMyKpiList: () => client.get<any[]>('/hr/me/kpi'),
  getMyKpiDetail: (id: number) => client.get<any>(`/hr/me/kpi/${id}`),
  getMyHealthChecks: () => client.get<{
    history: any[]
    next_check: string | null
    overdue_days: number
    upcoming_in_days: number | null
    tong_so_lan_kham: number
    phan_loai_gan_nhat: string | null
  }>('/hr/me/health-checks'),

  // Safety summary
  safetySummary: () => client.get<{
    bhld: { total_equipments: number; issues_30d: number; expiring_30d: number }
    training: { trainings_ytd: number; participants_ytd: number; expiring_certs_30d: number }
    accidents: { ytd: number; nhe: number; nang: number; tu_vong: number; unreported_serious: number }
  }>('/hr/safety/summary'),

  // HR Dashboard
  hrDashboardOverview: () => client.get<{
    summary: { total: number; dang_lam: number; tam_nghi: number; da_nghi: number;
               new_hires_ytd: number; resigned_ytd: number; turnover_pct: number }
    by_gender: { name: string; value: number }[]
    by_phap_nhan: { name: string; value: number }[]
    by_bo_phan: { name: string; value: number }[]
    age_distribution: { name: string; value: number }[]
    tenure_distribution: { name: string; value: number }[]
    alerts: {
      birthdays_30d: number; contracts_expiring_60d: number; no_account: number; missing_info: number
      // Phase 1 alerts:
      health_overdue?: number; cert_expiring_60d?: number; tnld_unreported?: number
    }
  }>('/hr/dashboard/overview'),

  // Employees
  listEmployees: (params?: { search?: string; phan_xuong_id?: number; phap_nhan_id?: number; bo_phan_id?: number }) =>
    client.get<Employee[]>('/hr/employees', { params }),
  getEmployee: (id: number) => client.get<Employee>(`/hr/employees/${id}`),
  getEmployeeHistory: (id: number) => client.get<any[]>(`/hr/employees/${id}/history`),
  createEmployee: (data: Partial<Employee>) => client.post<Employee>('/hr/employees', data),
  updateEmployee: (id: number, data: Partial<Employee>) => client.put<Employee>(`/hr/employees/${id}`, data),
  bulkCreateEmployees: (items: Partial<Employee>[]) => client.post('/hr/employees/bulk', { items }),
  listExpiringContracts: (days: number = 30) => client.get<any[]>('/hr/contracts/expiring', { params: { days } }),
  importContractAllowances: (rows: any[]) => client.post('/hr/contracts/import-allowances', rows),
  issueAccount: (id: number) => client.post(`/hr/employees/${id}/issue-account`),
  linkUser: (id: number, user_id: number | null) => client.patch(`/hr/employees/${id}/link-user`, { user_id }),
  syncSaleAccounts: (employee_ids: number[]) =>
    client.post<{ created: any[]; skipped: any[]; errors: any[] }>('/hr/employees/sync-sale-accounts', { employee_ids }),

  // Family Relations
  listFamilyRelations: (employeeId: number) =>
    client.get<FamilyRelation[]>(`/hr/employees/${employeeId}/family-relations`),
  createFamilyRelation: (employeeId: number, data: Partial<FamilyRelation>) =>
    client.post<FamilyRelation>(`/hr/employees/${employeeId}/family-relations`, data),
  updateFamilyRelation: (id: number, data: Partial<FamilyRelation>) =>
    client.put<FamilyRelation>(`/hr/family-relations/${id}`, data),
  deleteFamilyRelation: (id: number) =>
    client.delete(`/hr/family-relations/${id}`),

  // Documents (File hồ sơ)
  listEmployeeDocuments: (employeeId: number) =>
    client.get<EmployeeDocument[]>(`/hr/employees/${employeeId}/documents`),
  createEmployeeDocument: (employeeId: number, data: Partial<EmployeeDocument>) =>
    client.post<EmployeeDocument>(`/hr/employees/${employeeId}/documents`, data),
  deleteEmployeeDocument: (id: number) =>
    client.delete(`/hr/employee-documents/${id}`),

  // History (Thuyên chuyển / Chức vụ / Lương / Phụ cấp)
  listEmployeeHistoryTyped: (employeeId: number, loai?: string) =>
    client.get<EmployeeHistory[]>(`/hr/employees/${employeeId}/history-typed`, {
      params: loai ? { loai } : undefined,
    }),
  createEmployeeHistory: (employeeId: number, data: Partial<EmployeeHistory>) =>
    client.post<EmployeeHistory>(`/hr/employees/${employeeId}/history-typed`, data),
  deleteEmployeeHistory: (id: number) =>
    client.delete(`/hr/employee-history/${id}`),

  // Contracts (Quá trình hợp đồng)
  listEmployeeContracts: (employeeId: number) =>
    client.get<LaborContract[]>(`/hr/employees/${employeeId}/contracts`),

  // Check-in Locations (Sprint B)
  listCheckinLocations: (params?: { include_inactive?: boolean }) =>
    client.get<CheckInLocation[]>('/hr/checkin-locations', { params }),
  createCheckinLocation: (data: Partial<CheckInLocation>) =>
    client.post<CheckInLocation>('/hr/checkin-locations', data),
  updateCheckinLocation: (id: number, data: Partial<CheckInLocation>) =>
    client.put<CheckInLocation>(`/hr/checkin-locations/${id}`, data),
  deleteCheckinLocation: (id: number) =>
    client.delete(`/hr/checkin-locations/${id}`),

  // Mobile checkin
  myActiveCheckinLocations: () =>
    client.get<CheckInLocation[]>('/hr/me/checkin-locations'),
  myCheckinToday: () =>
    client.get<{ has_log: boolean; ngay: string; gio_vao?: string; gio_ra?: string; checkin_location_id?: number; checkin_distance_m?: number; checkin_address?: string; checkout_address?: string }>('/hr/me/checkin-today'),
  submitCheckin: (data: { lat: number; lng: number; address?: string; selfie_url?: string; type: 'in' | 'out' }) =>
    client.post<CheckInResponse>('/hr/me/checkin', data),

  // HR realtime
  attendanceToday: () =>
    client.get<AttendanceToday[]>('/hr/attendance/today'),

  // ─── Benefits (Phúc lợi) ───
  listBenefitPolicies: (params?: { is_active?: boolean; loai?: string }) =>
    client.get<any[]>('/hr/benefits/policies', { params }),
  createBenefitPolicy: (data: any) =>
    client.post('/hr/benefits/policies', data),
  updateBenefitPolicy: (id: number, data: any) =>
    client.put(`/hr/benefits/policies/${id}`, data),
  deleteBenefitPolicy: (id: number) =>
    client.delete(`/hr/benefits/policies/${id}`),

  listBenefitRecords: (params?: { status?: string; employee_id?: number; thang?: number; nam?: number }) =>
    client.get<any[]>('/hr/benefits/records', { params }),
  createBenefitRecord: (data: any) =>
    client.post('/hr/benefits/records', data),
  bulkCreateHolidayBenefit: (data: any) =>
    client.post('/hr/benefits/records/bulk-holiday', data),
  approveBenefitRecord: (id: number) =>
    client.post(`/hr/benefits/records/${id}/approve`),
  markBenefitPaid: (id: number) =>
    client.post(`/hr/benefits/records/${id}/mark-paid`),
  cancelBenefitRecord: (id: number, ly_do: string) =>
    client.post(`/hr/benefits/records/${id}/cancel`, { ly_do }),
  scanBirthday: (target_date?: string) =>
    client.post('/hr/benefits/scan-birthday', null, { params: target_date ? { target_date } : undefined }),
  upcomingBirthdays: (days = 30) =>
    client.get<any[]>('/hr/benefits/upcoming-birthdays', { params: { days } }),
  familyEvents: (params?: { days?: number; loai?: string; con_tuoi_min?: number; con_tuoi_max?: number }) =>
    client.get<any[]>('/hr/benefits/family-events', { params }),
  familyEventsSummary: (params?: { days?: number; con_tuoi_min?: number; con_tuoi_max?: number }) =>
    client.get<{ sinh_nhat_nv: number; co_con_nho: number; tham_nien: number; hd_het_han: number; total: number }>(
      '/hr/benefits/family-events/summary', { params },
    ),

  // Mobile self-service
  myBenefits: () => client.get<any[]>('/hr/me/benefits'),
  myEligibleBenefits: () => client.get<any[]>('/hr/me/eligible-benefits'),

  // HR Dashboard
  benefitDashboard: (thang: number, nam: number) =>
    client.get<{
      thang: number; nam: number;
      kpi: { chi_thang: number; chi_nam: number; chi_cung_ky_nam_truoc: number;
             pct_change_yoy: number | null; so_nv_nhan_thang: number; so_record_thang: number };
      by_loai: Array<{ loai: string; tong_tien: number; so_luot: number }>;
      by_phong_ban: Array<{ ten_bo_phan: string; tong_tien: number; so_luot: number }>;
      trend_12_thang: Array<{ thang: number; tong_tien: number }>;
      calendar_events: Record<string, Array<{ loai: string; ho_ten: string; muc_tien: number; trang_thai: string }>>;
    }>('/hr/benefits/dashboard', { params: { thang, nam } }),
  toggleAccountStatus: (id: number) => client.post(`/hr/employees/${id}/toggle-account-status`),

  // Attendance
  listAttendance: (params?: { employee_id?: number; from_date?: string; to_date?: string }) =>
    client.get<any[]>('/hr/attendance', { params }),
  bulkCreateAttendance: (logs: any[]) => client.post('/hr/attendance/bulk', logs),
  importAttendance: (rows: any[]) => client.post('/hr/attendance/import', rows),

  // Leave Requests
  listLeaveRequests: (params?: { status?: string; loai_don?: string; employee_id?: number }) =>
    client.get<any[]>('/hr/leave-requests', { params }),
  createLeaveRequest: (data: any) => client.post('/hr/leave-requests', data),
  // Sprint C contract: POST với body {decision, y_kien}. Auto-detect bước workflow theo role.
  approveLeaveRequest: (id: number, decision: 'approve' | 'reject' = 'approve', y_kien?: string) =>
    client.post(`/hr/leave-requests/${id}/approve`, { decision, y_kien }),
  cancelLeaveRequest: (id: number) =>
    client.post(`/hr/leave-requests/${id}/cancel`),

  // Payroll Configs
  listPayrollConfigs: (params?: { loai?: string }) =>
    client.get<PayrollConfig[]>('/hr/payroll-configs', { params }),
  createPayrollConfig: (data: Partial<PayrollConfig>) => client.post<PayrollConfig>('/hr/payroll-configs', data),
  updatePayrollConfig: (id: number, data: Partial<PayrollConfig>) => client.put<PayrollConfig>(`/hr/payroll-configs/${id}`, data),
  bulkCreatePayrollConfigs: (items: Partial<PayrollConfig>[]) => client.post('/hr/payroll-configs/bulk', { items }),
  listPayrollHolidays: (params?: { from_date?: string; to_date?: string }) =>
    client.get<any[]>('/hr/payroll-holidays', { params }),
  createPayrollHoliday: (data: any) => client.post('/hr/payroll-holidays', data),
  deletePayrollHoliday: (id: number) => client.delete(`/hr/payroll-holidays/${id}`),
}
