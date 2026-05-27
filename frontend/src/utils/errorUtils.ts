/**
 * Extracts a human-readable error message from a FastAPI error response.
 * FastAPI returns detail as a string (4xx) or array of {type, loc, msg, input, ctx} (422).
 */
type ApiError = {
  response?: {
    data?: {
      detail?: string | Array<{ msg?: string }> | Record<string, unknown>
    }
  }
  message?: string
}

export function getErrorMessage(err: unknown, fallback = 'Có lỗi xảy ra'): string {
  const apiErr = err as ApiError
  const detail = apiErr?.response?.data?.detail

  if (typeof detail === 'string') return detail

  if (Array.isArray(detail)) {
    return detail
      .map((item) => item?.msg ?? JSON.stringify(item))
      .join('; ')
  }

  if (detail && typeof detail === 'object') {
    return JSON.stringify(detail)
  }

  return apiErr?.message || fallback
}
