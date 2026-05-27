import axios from 'axios'
import { storage } from '../utils/storage'

const client = axios.create({ baseURL: '/api' })

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  const url = config.url || ''
  if (token && !url.includes('/auth/login') && !url.includes('/auth/refresh')) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // Strip empty-string params so FastAPI date/int validators don't receive "" and return 422
  if (config.params && typeof config.params === 'object') {
    config.params = Object.fromEntries(
      Object.entries(config.params).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    )
  }
  return config
})

// Track if we already showed network error to avoid spam
let _networkErrShown = false
// Track refresh in progress to avoid concurrent refresh calls
let _refreshPromise: Promise<void> | null = null
let _loggingOut = false

async function _tryRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) return false

  try {
    const res = await axios.post('/api/auth/refresh', { refresh_token: refreshToken })
    const { access_token, refresh_token: newRefresh, user } = res.data
    localStorage.setItem('token', access_token)
    localStorage.setItem('refresh_token', newRefresh)
    localStorage.setItem('user', JSON.stringify(user))
    return true
  } catch {
    return false
  }
}

client.interceptors.response.use(
  (res) => {
    _networkErrShown = false
    return res
  },
  async (err) => {
    if (err.response?.status === 401) {
      const originalRequest = err.config
      if (originalRequest?.url?.includes('/auth/login')) {
        return Promise.reject(err)
      }

      // Kiosk mode: worker dùng session riêng, không có JWT → để request fail bình thường
      if (!localStorage.getItem('token') && !!storage.get('cd2_worker_session')) {
        return Promise.reject(err)
      }

      // Tránh vòng lặp vô hạn khi endpoint /auth/refresh cũng trả 401
      if (originalRequest?.url?.includes('/auth/refresh') || originalRequest?._retry) {
        _doLogout()
        return Promise.reject(err)
      }

      originalRequest._retry = true

      // Nếu có refresh đang chạy, chờ nó xong
      if (_refreshPromise) {
        await _refreshPromise
      } else {
        _refreshPromise = _tryRefresh().then((ok) => {
          _refreshPromise = null
          if (!ok) _doLogout()
        })
        await _refreshPromise
      }

      const newToken = localStorage.getItem('token')
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return client(originalRequest)
      }
    } else if (err.code === 'ERR_NETWORK' || err.code === 'ECONNREFUSED' || !err.response) {
      if (!_networkErrShown) {
        _networkErrShown = true
        if (typeof window !== 'undefined') {
          const existing = document.getElementById('_erp_net_err')
          if (!existing) {
            const banner = document.createElement('div')
            banner.id = '_erp_net_err'
            banner.style.cssText = [
              'position:fixed;top:0;left:0;right:0;background:#ff4d4f',
              'color:#fff;text-align:center;padding:10px 16px;font-size:13px',
              'z-index:99999;cursor:pointer',
            ].join(';')
            banner.innerHTML = '🔴 Mất kết nối với máy chủ ERP. <b>Nhấn vào đây để tải lại trang.</b>'
            banner.onclick = () => window.location.reload()
            document.body.prepend(banner)
          }
        }
      }
    }
    // Normalize FastAPI 422 validation errors: detail is array of {type,loc,msg,...}
    if (err.response?.data?.detail && Array.isArray(err.response.data.detail)) {
      err.response.data.detail = err.response.data.detail
        .map((item: unknown) => (item as { msg?: string })?.msg ?? JSON.stringify(item))
        .join('; ')
    }
    return Promise.reject(err)
  }
)

function _doLogout() {
  if (_loggingOut) return
  _loggingOut = true

  storage.clearAll()   // xóa token + refresh_token + user + toàn bộ ERP data
  if (typeof window !== 'undefined') {
    if (window.location.pathname === '/login') return

    // Kiosk mode: công nhân chỉ có worker session, không có ERP token
    // clearAll() đã xóa cd2_worker_session → redirect về machine-login
    if (window.location.pathname.includes('cd2') || window.location.pathname.includes('machine')) {
      window.location.href = '/cd2/machine-login'
      return
    }

    const msg = document.createElement('div')
    msg.style.cssText = [
      'position:fixed;top:20px;left:50%;transform:translateX(-50%)',
      'background:#faad14;color:#000;padding:12px 24px;border-radius:8px',
      'font-size:14px;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,.2)',
    ].join(';')
    msg.textContent = '⚠️ Phiên đăng nhập đã hết hạn. Đang chuyển về trang đăng nhập...'
    if (document.body) document.body.appendChild(msg)
    const isGateRoute = ['/gate-hub', '/gate/', '/giao-hang-mobile'].some(
      p => window.location.pathname.startsWith(p)
    )
    setTimeout(() => { window.location.href = isGateRoute ? '/gate-login' : '/login' }, 1500)
  }
}

export default client
