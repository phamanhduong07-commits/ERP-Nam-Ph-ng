import client from '../api/client'

export interface MSTInfo {
  name: string
  shortName: string
  address: string
  status: string
}

export async function lookupMST(mst: string): Promise<MSTInfo> {
  const clean = mst.trim().replace(/\s/g, '')
  if (!clean) throw new Error('Vui lòng nhập MST')

  const res = await client.get<MSTInfo>(`/mst-lookup/${clean}`)
  return res.data
}
