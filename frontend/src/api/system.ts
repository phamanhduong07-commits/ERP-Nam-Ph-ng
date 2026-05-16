import client from './client'

export interface PrintTemplate {
  ma_mau: string
  ten_mau: string
  html_content: string
  phap_nhan_id?: number
  css_content?: string
  variables_meta?: any
}

export interface ExcelTemplate {
  ma_mau: string
  ten_mau: string
  phap_nhan_id?: number
  column_config: any[]
}

export const systemApi = {
  getTemplates: () => client.get<PrintTemplate[]>('/system/templates').then(r => r.data),
  getTemplate: (ma: string, phap_nhan_id?: number, strict = false) => 
    client.get<PrintTemplate>(`/system/templates/${ma}`, { params: { phap_nhan_id, strict } }).then(r => r.data),
  updateTemplate: (ma: string, data: Partial<PrintTemplate>) => client.put(`/system/templates/${ma}`, data),
  deleteTemplate: (ma: string, phap_nhan_id?: number) => client.delete(`/system/templates/${ma}`, { params: { phap_nhan_id } }),
  
  getExcelTemplates: () => client.get<ExcelTemplate[]>('/system/excel-templates').then(r => r.data),
  getExcelTemplate: (ma: string, phap_nhan_id?: number, strict = false) =>
    client.get<ExcelTemplate>(`/system/excel-templates/${ma}`, { params: { phap_nhan_id, strict } }).then(r => r.data),
  updateExcelTemplate: (ma: string, data: Partial<ExcelTemplate>) => client.put(`/system/excel-templates/${ma}`, data),
  deleteExcelTemplate: (ma: string, phap_nhan_id?: number) => client.delete(`/system/excel-templates/${ma}`, { params: { phap_nhan_id } }),

  getSettings: () => client.get<Record<string, string>>('/system/settings').then(r => r.data),
  updateSetting: (key: string, value: string) => client.put('/system/settings', { key, value }),
}
