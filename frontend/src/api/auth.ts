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
  token_type: string
  user: UserInfo
}

export const authApi = {
  login: (username: string, password: string) => {
    const form = new FormData()
    form.append('username', username)
    form.append('password', password)
    return client.post<TokenResponse>('/auth/login', form)
  },
  me: () => client.get<UserInfo>('/auth/me'),
  changePassword: (old_password: string, new_password: string) =>
    client.post('/auth/change-password', null, {
      params: { old_password, new_password },
    }),
}
