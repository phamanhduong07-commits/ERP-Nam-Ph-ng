import axios from 'axios'

const client = axios.create({ baseURL: '/api' })

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Track if we already showed network error to avoid spam
let _networkErrShown = false

client.interceptors.response.use(
  (res) => {
    _networkErrShown = false   // reset on success
    return res
  },
  (err) => {
    if (err.response) {
      // Server responded but with error
      if (err.response.status === 401) {
        // Token expired or invalid → force re-login
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        // Show a brief notification before redirect
        if (typeof window !== 'undefined') {
          const msg = document.createElement('div')
          msg.style.cssText = [
            'position:fixed;top:20px;left:50%;transform:translateX(-50%)',
            'background:#faad14;color:#000;padding:12px 24px;border-radius:8px',
            'font-size:14px;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,.2)',
          ].join(';')
          msg.textContent = '⚠️ Phiên đăng nhập đã hết hạn. Đang chuyển về trang đăng nhập...'
          document.body.appendChild(msg)
          setTimeout(() => { window.location.href = '/login' }, 1500)
        }
      }
    } else if (err.code === 'ERR_NETWORK' || err.code === 'ECONNREFUSED' || !err.response) {
      // No response = server unreachable (wrong port, backend down, etc.)
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
    return Promise.reject(err)
  }
)

export default client
