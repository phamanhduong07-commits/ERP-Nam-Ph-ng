import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'

export interface HotkeyDefinition {
  key: string
  description: string
  group: string
  handler: () => void
}

interface HotkeyRegistryApi {
  registerHotkey: (def: HotkeyDefinition) => void
  unregisterHotkey: (key: string) => void
  getHotkeys: () => HotkeyDefinition[]
}

const HotkeyContext = createContext<HotkeyRegistryApi | null>(null)

function normalizeComboFromDefinition(key: string): string {
  return key
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0)
    .join('+')
}

function normalizeComboFromEvent(event: KeyboardEvent): string {
  const parts: string[] = []
  if (event.ctrlKey || event.metaKey) parts.push('ctrl')
  if (event.altKey) parts.push('alt')
  parts.push(event.key.toLowerCase())
  return parts.join('+')
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.hasAttribute('data-hotkey-override')) return false

  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true

  return target.isContentEditable
}

export function HotkeyProvider({ children }: { children: ReactNode }) {
  const registry = useRef<Map<string, HotkeyDefinition>>(new Map())

  const registerHotkey = useCallback((def: HotkeyDefinition) => {
    const normalizedKey = normalizeComboFromDefinition(def.key)
    if (registry.current.has(normalizedKey)) {
      console.warn(`[HotkeyProvider] Phím tắt "${normalizedKey}" đã được đăng ký — ghi đè handler cũ.`)
    }
    registry.current.set(normalizedKey, { ...def, key: normalizedKey })
  }, [])

  const unregisterHotkey = useCallback((key: string) => {
    registry.current.delete(normalizeComboFromDefinition(key))
  }, [])

  const getHotkeys = useCallback(() => Array.from(registry.current.values()), [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return

      const combo = normalizeComboFromEvent(event)
      const definition = registry.current.get(combo)
      if (!definition) return

      event.preventDefault()
      definition.handler()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const api = useMemo<HotkeyRegistryApi>(
    () => ({ registerHotkey, unregisterHotkey, getHotkeys }),
    [registerHotkey, unregisterHotkey, getHotkeys],
  )

  return <HotkeyContext.Provider value={api}>{children}</HotkeyContext.Provider>
}

export function useHotkeyRegistry(): HotkeyRegistryApi {
  const context = useContext(HotkeyContext)
  if (!context) {
    throw new Error('useHotkeyRegistry phải được dùng bên trong <HotkeyProvider>.')
  }
  return context
}
