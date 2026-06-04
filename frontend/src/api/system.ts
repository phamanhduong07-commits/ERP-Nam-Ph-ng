import client from './client'

export interface PrintTemplate {
  ma_mau: string
  ten_mau: string
  html_content: string
  phap_nhan_id?: number
  css_content?: string
  variables_meta?: Record<string, unknown>
}

export interface ExcelHeaderField {
  key: string
  label: string
}

export interface ExcelFooterConfig {
  show_total?: boolean
  sum_columns?: string[]
  show_signatures?: boolean
  signatures?: string[]
}

export interface ExcelStyleConfig {
  accent_color?: string
  alt_row_color?: string
  orientation?: 'portrait' | 'landscape'
  show_company_header?: boolean
  freeze_header?: boolean
}

export interface ExcelColumnConfig {
  key: string
  label: string
  width?: number
}

export interface ExcelTemplate {
  ma_mau: string
  ten_mau: string
  phap_nhan_id?: number
  column_config: ExcelColumnConfig[]
  header_config?: ExcelHeaderField[]
  footer_config?: ExcelFooterConfig
  style_config?: ExcelStyleConfig
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
