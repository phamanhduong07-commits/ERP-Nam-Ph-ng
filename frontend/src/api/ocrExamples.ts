import client from './client'

export interface OcrExample {
  id: number
  ten_ncc: string
  ten_ncc_chuan: string
  img_path: string
  img_url: string
  extracted_json: string
  ghi_chu: string | null
  created_at: string | null
}

export interface OcrSupplierSummary {
  ten_ncc_chuan: string
  so_mau: number
}

export const ocrExamplesApi = {
  list: () => client.get<OcrExample[]>('/ocr-examples'),

  listSuppliers: () => client.get<OcrSupplierSummary[]>('/ocr-examples/suppliers'),

  create: (formData: FormData) =>
    client.post<OcrExample>('/ocr-examples', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  delete: (id: number) => client.delete(`/ocr-examples/${id}`),
}
