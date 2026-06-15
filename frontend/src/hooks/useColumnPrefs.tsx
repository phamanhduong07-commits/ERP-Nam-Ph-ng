import { useState, useCallback, useMemo } from 'react'
import { Button } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import ColumnSettings from '../components/ColumnSettings'

export type ColPrefs = Record<string, { visible: boolean; order: number }>

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

export interface UseColumnPrefsOptions {
  nonHideable?: string[]
}

export function useColumnPrefs<T>(
  pageKey: string,
  columns: ColumnsType<T>,
  options?: UseColumnPrefsOptions,
): {
  displayColumns: ColumnsType<T>
  settingsButton: React.ReactNode
} {
  const { nonHideable = [] } = options ?? {}
  const [open, setOpen] = useState(false)
  const [prefs, setPrefs] = useState<ColPrefs>(() => loadPrefs(pageKey))

  // Merge stored prefs with current columns — new columns default to visible
  const mergedPrefs = useMemo<ColPrefs>(() => {
    const result: ColPrefs = {}
    columns.forEach((col, idx) => {
      const key = getColKey(col)
      if (!key) return
      result[key] = prefs[key] ?? { visible: true, order: idx }
    })
    return result
  }, [columns, prefs])

  const displayColumns = useMemo<ColumnsType<T>>(() => {
    return [...columns]
      .sort((a, b) => {
        // fixed columns stay pinned to their side regardless of order
        if (a.fixed === 'left' && b.fixed !== 'left') return -1
        if (b.fixed === 'left' && a.fixed !== 'left') return 1
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
  }, [columns, mergedPrefs])

  const handleSave = useCallback(
    (newPrefs: ColPrefs) => {
      setPrefs(newPrefs)
      savePrefs(pageKey, newPrefs)
      setOpen(false)
    },
    [pageKey],
  )

  const settingsButton = (
    <>
      <Button icon={<SettingOutlined />} size="small" onClick={() => setOpen(true)}>
        Tùy chỉnh cột
      </Button>
      {open && (
        <ColumnSettings
          open={open}
          columns={columns as ColumnsType<unknown>}
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
