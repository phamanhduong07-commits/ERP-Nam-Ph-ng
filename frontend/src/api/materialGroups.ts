import client from './client'

export interface MaterialGroup {
  id: number
  ma_nhom: string
  ten_nhom: string
  la_nhom_giay: boolean
  bo_phan: string | null
  phan_xuong: string | null
  trang_thai: boolean
  created_at: string
}

export type MaterialGroupCreate = Omit<MaterialGroup, 'id' | 'created_at'>

export const materialGroupsApi = {
  list: (params?: { la_nhom_giay?: boolean }) =>
    client.get<MaterialGroup[]>('/material-groups', { params }),
  all: () => client.get<{ id: number; ma_nhom: string; ten_nhom: string }[]>('/material-groups/all'),
  create: (data: MaterialGroupCreate) => client.post<MaterialGroup>('/material-groups', data),
  update: (id: number, data: Partial<MaterialGroupCreate>) => client.put<MaterialGroup>(`/material-groups/${id}`, data),
  delete: (id: number) => client.delete(`/material-groups/${id}`),
}
