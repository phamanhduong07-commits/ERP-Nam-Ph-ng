import { useState, useCallback, useMemo } from 'react'
import { Button, Tooltip, Badge } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import ColumnSettings from '../components/ColumnSettings'

export type ColPrefs = Record<string, {
  visible: boolean
  order: number
  label?: string
  width?: number
  fixed?: 'left' | false
}>

export function getColKey<T>(col: ColumnsType<T>[number]): string {
  const k = (col as any).key ?? (col as any).dataIndex
  return k !== undefined && k !== null ? String(k) : ''
}

function loadPrefs(pageKey: string): ColPrefs {
  try {
    const raw = localStorage.getItem(`erp-cols-v1-${pageKey}`)
    return raw ? (JSON.parse(raw) as ColPrefs) : {}
  } catch {
    return {}
  }
}

function savePrefs(pageKey: string, prefs: ColPrefs) {
  try {
    localStorage.setItem(`erp-cols-v1-${pageKey}`, JSON.stringify(prefs))
  } catch {}
}

function autoGenerateColumn<T>(key: string, sampleValue?: unknown): ColumnsType<T>[number] {
  const isDate = typeof sampleValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(sampleValue)
  const isNum = typeof sampleValue === 'number'
  const isBool = typeof sampleValue === 'boolean'
  const label = key.replace(/_/g, ' ')

  return {
    key,
    dataIndex: key,
    title: label,
    align: isNum ? ('right' as const) : undefined,
    render: (v: unknown) => {
      if (v === null || v === undefined) return '—'
      if (isBool || typeof v === 'boolean') return v ? 'Có' : 'Không'
      if (isDate && typeof v === 'string') return v.slice(0, 10).split('-').reverse().join('/')
      if (isNum || typeof v === 'number') return (v as number).toLocaleString('vi-VN')
      if (typeof v === 'object') return '—'
      return String(v)
    },
  } as ColumnsType<T>[number]
}

export interface UseColumnPrefsOptions {
  nonHideable?: string[]
  /** Column keys hidden by default — user can show via settings modal */
  defaultHidden?: string[]
  /**
   * Pass API response rows here to auto-discover DB fields not yet in columns[].
   * Extra fields appear in the settings modal (hidden by default) so users can toggle them on.
   * Only scalar fields are included (objects/arrays are skipped).
   */
  data?: unknown[]
}

export function useColumnPrefs<T>(
  pageKey: string,
  columns: ColumnsType<T>,
  options?: UseColumnPrefsOptions,
): {
  displayColumns: ColumnsType<T>
  settingsButton: React.ReactNode
} {
  const { nonHideable = [], defaultHidden = [] } = options ?? {}
  const [open, setOpen] = useState(false)
  const [prefs, setPrefs] = useState<ColPrefs>(() => loadPrefs(pageKey))

  // Stable string — only changes when field names change, not when row values change
  const dataKeyStr = useMemo(() => {
    if (!options?.data?.length) return ''
    return Object.keys(options.data[0] as object).sort().join(',')
  }, [options?.data])

  // Auto-generate columns for fields in data that are not in columns[]
  const autoColumns = useMemo<ColumnsType<T>>(() => {
    if (!dataKeyStr || !options?.data?.length) return []
    const definedKeys = new Set(columns.map(col => getColKey(col)).filter(Boolean))
    const firstRow = options.data[0] as Record<string, unknown>
    return Object.keys(firstRow)
      .filter(k => {
        if (definedKeys.has(k)) return false
        const v = firstRow[k]
        return v === null || typeof v !== 'object'  // skip nested objects & arrays
      })
      .map(k => autoGenerateColumn<T>(k, firstRow[k]))
  }, [dataKeyStr, columns])

  const allColumns = useMemo<ColumnsType<T>>(
    () => [...columns, ...autoColumns],
    [columns, autoColumns],
  )

  // Merge stored prefs — defaultHidden and auto-discovered columns start as visible:false
  const mergedPrefs = useMemo<ColPrefs>(() => {
    const autoKeys = new Set(autoColumns.map(col => getColKey(col)))
    const result: ColPrefs = {}
    allColumns.forEach((col, idx) => {
      const key = getColKey(col)
      if (!key) return
      const hiddenByDefault = defaultHidden.includes(key) || autoKeys.has(key)
      result[key] = prefs[key] ?? { visible: !hiddenByDefault, order: idx }
    })
    return result
  }, [allColumns, autoColumns, prefs, defaultHidden])

  const displayColumns = useMemo<ColumnsType<T>>(() => {
    const isLeft = (col: ColumnsType<T>[number]) => {
      const k = getColKey(col)
      return col.fixed === 'left' || mergedPrefs[k]?.fixed === 'left'
    }
    return [...allColumns]
      .sort((a, b) => {
        if (isLeft(a) && !isLeft(b)) return -1
        if (!isLeft(a) && isLeft(b)) return 1
        if (a.fixed === 'right' && b.fixed !== 'right') return 1
        if (b.fixed === 'right' && a.fixed !== 'right') return -1
        const ka = getColKey(a)
        const kb = getColKey(b)
        return (mergedPrefs[ka]?.order ?? 0) - (mergedPrefs[kb]?.order ?? 0)
      })
      .filter(col => {
        const key = getColKey(col)
        if (!key) return true
        return mergedPrefs[key]?.visible !== false
      })
      .map(col => {
        const key = getColKey(col)
        if (!key) return col
        const pref = mergedPrefs[key]
        if (!pref) return col
        const overrides: Record<string, unknown> = {}
        if (pref.label) overrides.title = pref.label
        if (pref.width !== undefined) overrides.width = pref.width
        if (pref.fixed === 'left' && col.fixed !== 'left') overrides.fixed = 'left'
        return Object.keys(overrides).length ? { ...col, ...overrides } : col
      }) as ColumnsType<T>
  }, [allColumns, mergedPrefs])

  const handleSave = useCallback(
    (newPrefs: ColPrefs) => {
      setPrefs(newPrefs)
      savePrefs(pageKey, newPrefs)
      setOpen(false)
    },
    [pageKey],
  )

  const hiddenCount = Object.values(mergedPrefs).filter(p => !p.visible).length

  const settingsButton = (
    <>
      <Tooltip title="Tùy chỉnh cột">
        <Badge count={hiddenCount} size="small" offset={[-2, 2]}>
          <Button
            icon={<SettingOutlined />}
            size="small"
            onClick={() => setOpen(true)}
          />
        </Badge>
      </Tooltip>
      {open && (
        <ColumnSettings
          open={open}
          columns={allColumns as ColumnsType<unknown>}
          prefs={mergedPrefs}
          nonHideable={nonHideable}
          onSave={handleSave}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )

  return { displayColumns, settingsButton }
}
