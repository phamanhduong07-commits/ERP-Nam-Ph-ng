import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { socket } from '../utils/socket'

/**
 * Đồng bộ React Query cache với server qua Socket.io.
 *
 * Backend (main.py middleware `broadcast_mutations`) phát event `data_changed`
 * sau mỗi mutation thành công kèm { resource, method }. Hook này nghe event đó
 * và invalidate đúng queryKey [resource] để mọi tab/đang mở tự refetch dữ liệu mới.
 *
 * Khi socket reconnect (mạng chập chờn → nối lại), ta đã có thể bỏ lỡ một số
 * event trong lúc mất kết nối → invalidate toàn bộ cache để đảm bảo không stale.
 */
export function useDataChangeSync(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    const handler = (data: { resource: string; method: string }) => {
      // Event thiếu resource → không biết invalidate gì, bỏ qua để tránh
      // invalidate nhầm toàn bộ cache (queryKey [undefined]).
      if (!data?.resource) return
      queryClient.invalidateQueries({ queryKey: [data.resource] })
    }

    const reconnectHandler = () => {
      // Có thể đã miss event lúc mất kết nối → refetch tất cả cho an toàn.
      queryClient.invalidateQueries()
    }

    socket.on('data_changed', handler)
    // socket.io-client v4: sự kiện 'reconnect' nằm trên Manager, không phải Socket
    socket.io.on('reconnect', reconnectHandler)

    return () => {
      socket.off('data_changed', handler)
      socket.io.off('reconnect', reconnectHandler)
    }
  }, [queryClient])
}
