import client from './client'

export interface UserInfo {
  id: number
  username: string
  ho_ten: string
  email: string | null
  role: string
  phan_xuong: string | null
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: UserInfo
}

export const authApi = {
  login: (username: string, password: string) => {
    const form = new URLSearchParams()
    form.append('username', username)
    form.append('password', password)
    return client.post<TokenResponse>('/auth/login', form)
  },
  refresh: (refresh_token: string) =>
    client.post<TokenResponse>('/auth/refresh', { refresh_token }),
  me: () => client.get<UserInfo>('/auth/me'),
  changePassword: (old_password: string, new_password: string) =>
    client.post('/auth/change-password', { old_password, new_password }),
}
