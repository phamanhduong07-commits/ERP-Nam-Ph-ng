import client from './client'

export interface MediaItem {
  id: number
  url: string
  filename: string
  mime_type: string
  size_bytes: number
  note: string
  created_at: string
  uploaded_by: string
}

export const mediaApi = {
  /** Tải danh sách ảnh của 1 record */
  list: (module: string, recordId: string | number) =>
    client.get<MediaItem[]>(`/media/${module}/${recordId}`),

  /** Upload 1 ảnh mới */
  upload: (module: string, recordId: string | number, file: File, note = '') => {
    const form = new FormData()
    form.append('module', module)
    form.append('record_id', String(recordId))
    form.append('note', note)
    form.append('file', file)
    return client.post<MediaItem>('/media/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  /** Xóa 1 ảnh */
  delete: (mediaId: number) => client.delete(`/media/${mediaId}`),
}
