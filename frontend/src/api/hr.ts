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

export interface Employee {
  id: number
  ma_nv: string
  ho_ten: string
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
  chuc_vu_id?: number
  ma_van_tay?: string
  user_id?: number
  ngay_vao_lam?: string
  ngay_nghi_viec?: string
  trang_thai: string
  ten_bo_phan?: string
  ten_chuc_vu?: string
  ten_phan_xuong?: string
  ten_phap_nhan?: string
  has_account?: boolean
  username?: string
  user_status?: boolean
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

  // Positions
  listPositions: () => client.get<Position[]>('/hr/positions'),
  createPosition: (data: Partial<Position>) => client.post<Position>('/hr/positions', data),

  // Employees
  listEmployees: (params?: { search?: string; phan_xuong_id?: number; phap_nhan_id?: number; bo_phan_id?: number }) =>
    client.get<Employee[]>('/hr/employees', { params }),
  getEmployee: (id: number) => client.get<Employee>(`/hr/employees/${id}`),
  getEmployeeHistory: (id: number) => client.get<any[]>(`/hr/employees/${id}/history`),
  createEmployee: (data: Partial<Employee>) => client.post<Employee>('/hr/employees', data),
  updateEmployee: (id: number, data: Partial<Employee>) => client.put<Employee>(`/hr/employees/${id}`, data),
  bulkCreateEmployees: (items: Partial<Employee>[]) => client.post('/hr/employees/bulk', { items }),
  listExpiringContracts: (days: number = 30) => client.get<any[]>('/hr/contracts/expiring', { params: { days } }),
  issueAccount: (id: number) => client.post(`/hr/employees/${id}/issue-account`),
  toggleAccountStatus: (id: number) => client.post(`/hr/employees/${id}/toggle-account-status`),

  // Attendance
  listAttendance: (params?: { employee_id?: number; from_date?: string; to_date?: string }) =>
    client.get<any[]>('/hr/attendance', { params }),
  bulkCreateAttendance: (logs: any[]) => client.post('/hr/attendance/bulk', logs),
  importAttendance: (rows: any[]) => client.post('/hr/attendance/import', rows),

  // Leave Requests
  listLeaveRequests: (params?: { trang_thai?: string }) =>
    client.get<any[]>('/hr/leave-requests', { params }),
  createLeaveRequest: (data: any) => client.post('/hr/leave-requests', data),
  approveLeaveRequest: (id: number, y_kien?: string, trang_thai: string = 'bgd_duyet') =>
    client.put(`/hr/leave-requests/${id}/approve`, { y_kien_duyet: y_kien, trang_thai }),

  // Payroll Configs
  listPayrollConfigs: () => client.get<PayrollConfig[]>('/hr/payroll-configs'),
  createPayrollConfig: (data: Partial<PayrollConfig>) => client.post<PayrollConfig>('/hr/payroll-configs', data),
  updatePayrollConfig: (id: number, data: Partial<PayrollConfig>) => client.put<PayrollConfig>(`/hr/payroll-configs/${id}`, data),
  bulkCreatePayrollConfigs: (items: Partial<PayrollConfig>[]) => client.post('/hr/payroll-configs/bulk', { items }),
}
