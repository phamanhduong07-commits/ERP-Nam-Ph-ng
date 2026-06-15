import { useEffect, useRef } from 'react'
import { useHotkeyRegistry } from '../contexts/HotkeyContext'

export function useHotkey(
  key: string,
  handler: () => void,
  description: string,
  group: string = 'Trang hiện tại',
  enabled: boolean = true,
): void {
  const { registerHotkey, unregisterHotkey } = useHotkeyRegistry()

  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!enabled) {
      unregisterHotkey(key)
      return () => unregisterHotkey(key)
    }

    registerHotkey({
      key,
      description,
      group,
      handler: () => handlerRef.current(),
    })

    return () => unregisterHotkey(key)
  }, [key, description, group, enabled, registerHotkey, unregisterHotkey])
}
