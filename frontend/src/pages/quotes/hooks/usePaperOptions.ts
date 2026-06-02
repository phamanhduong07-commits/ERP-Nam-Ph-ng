import { useState, useEffect, useRef } from 'react'
import { paperMaterialsApi } from '../../../api/quotes'

export function usePaperOptions() {
  const [mkList, setMkList] = useState<string[]>([])
  const [byMk, setByMk] = useState<Record<string, number[]>>({})
  const [paperCodes, setPaperCodes] = useState<Record<string, string>>({})
  const [rawToMk, setRawToMk] = useState<Record<string, string>>({})
  const [giaBanMap, setGiaBanMap] = useState<Record<string, number>>({})
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    paperMaterialsApi.options().then(res => {
      setMkList(res.data.ma_ky_hieu)
      setByMk(res.data.by_mk)
      setPaperCodes(res.data.paper_codes || {})
      setRawToMk(res.data.raw_to_mk || {})
      setGiaBanMap(res.data.gia_ban_map || {})
    })
  }, [])

  return { mkList, byMk, paperCodes, rawToMk, giaBanMap }
}
