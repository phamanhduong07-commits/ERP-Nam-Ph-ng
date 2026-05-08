import client from './client'

export interface ImportPreviewRow {
  row: number
  status: 'create' | 'update' | 'error' | 'skip'
  errors: string[]
  data: Record<string, unknown>
}

export interface ImportResult {
  commit: boolean
  total: number
  created: number
  updated: number
  skipped: number
  errors: number
  rows: ImportPreviewRow[]
}

export const importExportApi = {
  downloadTemplate: async (endpoint: string, filename: string) => {
    const res = await client.get(`${endpoint}/import-template`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  },
  importExcel: (endpoint: string, file: File, commit = false) => {
    const formData = new FormData()
    formData.append('file', file)
    return client.post<ImportResult>(`${endpoint}/import`, formData, {
      params: { commit },
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}
