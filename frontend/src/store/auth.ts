import { create } from 'zustand'
import type { UserInfo } from '../api/auth'
import { storage } from '../utils/storage'
import { connectSocket, disconnectSocket } from '../utils/socket'

interface AuthState {
  token: string | null
  refreshToken: string | null
  user: UserInfo | null
  setAuth: (token: string, refreshToken: string, user: UserInfo) => void
  logout: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('token'),
  refreshToken: localStorage.getItem('refresh_token'),
  user: (() => {
    try {
      const u = localStorage.getItem('user')
      return u ? JSON.parse(u) : null
    } catch {
      return null
    }
  })(),

  setAuth: (token, refreshToken, user) => {
    localStorage.setItem('token', token)
    localStorage.setItem('refresh_token', refreshToken)
    localStorage.setItem('user', JSON.stringify(user))
    set({ token, refreshToken, user })
    // Sau login: connect socket (backend giờ bắt buộc token)
    connectSocket()
  },

  logout: () => {
    disconnectSocket()
    storage.clearAll()   // xóa token + refresh_token + user + toàn bộ ERP data
    set({ token: null, refreshToken: null, user: null })
  },

  isAuthenticated: () => !!get().token && !!get().user,
}))
