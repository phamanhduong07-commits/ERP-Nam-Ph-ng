// Shared API types dùng chung cho nhiều module

export type ApiError = Error & {
  response?: { data?: { detail?: string; [k: string]: unknown }; status?: number }
}

export function getErrDetail(e: unknown, fallback = 'Có lỗi xảy ra'): string {
  const err = e as ApiError
  return (err as ApiError)?.response?.data?.detail || err?.message || fallback
}

export interface PagedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}
