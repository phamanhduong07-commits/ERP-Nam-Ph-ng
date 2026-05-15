import client from './client'

export interface PrintTemplate {
  ma_mau: string
  ten_mau: string
  html_content: string
  phap_nhan_id?: number
  css_content?: string
  variables_meta?: any
}

export const systemApi = {
  getTemplates: () => client.get<PrintTemplate[]>('/system/templates').then(r => r.data),
  getTemplate: (ma: string, phap_nhan_id?: number) => 
    client.get<PrintTemplate>(`/system/templates/${ma}`, { params: { phap_nhan_id } }).then(r => r.data),
  updateTemplate: (ma: string, data: Partial<PrintTemplate>) => client.put(`/system/templates/${ma}`, data),
  deleteTemplate: (ma: string, phap_nhan_id?: number) => client.delete(`/system/templates/${ma}`, { params: { phap_nhan_id } }),
  
  getSettings: () => client.get<Record<string, string>>('/system/settings').then(r => r.data),
  updateSetting: (key: string, value: string) => client.put('/system/settings', { key, value }),
}
