import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { socket } from '../utils/socket'

/**
 * Đồng bộ React Query cache với server qua Socket.io.
 *
 * Backend (main.py middleware `broadcast_mutations`) phát event `data_changed`
 * sau mỗi mutation thành công kèm { resource, method, id }. Hook này nghe event
 * đó và invalidate đúng queryKey:
 *  - Nếu có id: invalidate [resource, id] (record cụ thể) + [resource] (list)
 *  - Nếu không có id: invalidate [resource] (tất cả queries của resource đó)
 *
 * Khi socket reconnect (mạng chập chờn → nối lại), ta có thể đã bỏ lỡ một số
 * event → invalidate toàn bộ cache sau 300ms (throttle để tránh thundering herd).
 */
export function useDataChangeSync(): void {
  const queryClient = useQueryClient()
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handler = (data: { resource: string; method: string; id?: number | null }) => {
      if (!data?.resource) return
      if (data.id != null) {
        // Granular: invalidate record cụ thể + list của resource đó
        queryClient.invalidateQueries({ queryKey: [data.resource, data.id] })
        queryClient.invalidateQueries({ queryKey: [data.resource] })
      } else {
        queryClient.invalidateQueries({ queryKey: [data.resource] })
      }
    }

    const reconnectHandler = () => {
      // Throttle: gom nhiều reconnect events trong 300ms thành 1 invalidate
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = setTimeout(() => {
        queryClient.invalidateQueries()
        reconnectTimerRef.current = null
      }, 300)
    }

    // Mobile: trình duyệt không fire 'focus' event đáng tin cậy khi quay lại từ
    // background (lock screen, chuyển app). visibilitychange đáng tin hơn và
    // hoạt động cả trên iOS Safari, Android Chrome, và PWA installed mode.
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        queryClient.invalidateQueries()
      }
    }

    socket.on('data_changed', handler)
    // socket.io-client v4: sự kiện 'reconnect' nằm trên Manager, không phải Socket
    socket.io.on('reconnect', reconnectHandler)
    document.addEventListener('visibilitychange', visibilityHandler)

    return () => {
      socket.off('data_changed', handler)
      socket.io.off('reconnect', reconnectHandler)
      document.removeEventListener('visibilitychange', visibilityHandler)
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    }
  }, [queryClient])
}
