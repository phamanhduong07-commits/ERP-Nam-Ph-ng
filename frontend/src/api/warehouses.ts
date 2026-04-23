import client from './client'

export interface Warehouse {
  id: number
  ma_kho: string
  ten_kho: string
  loai_kho: string
  dia_chi: string | null
  trang_thai: boolean
  created_at: string
}

export type WarehouseCreate = Omit<Warehouse, 'id' | 'created_at'>

export const warehousesApi = {
  list: () => client.get<Warehouse[]>('/warehouses'),
  create: (data: WarehouseCreate) => client.post<Warehouse>('/warehouses', data),
  update: (id: number, data: Partial<WarehouseCreate>) => client.put<Warehouse>(`/warehouses/${id}`, data),
  delete: (id: number) => client.delete(`/warehouses/${id}`),
}
