import { io, Socket } from 'socket.io-client';

// Địa chỉ backend socket.io
const SOCKET_URL = window.location.origin;

/**
 * Lấy access token từ localStorage để pass vào socket.io auth.
 * Backend (socket_manager.py) bắt buộc token để chặn anonymous connect.
 */
function getToken(): string | null {
  // store/auth.ts dùng key 'token'; HRReportsPage.tsx + 1 vài chỗ dùng 'access_token'
  return localStorage.getItem('token') || localStorage.getItem('access_token')
}

export const socket: Socket = io(SOCKET_URL, {
  path: '/ws/socket.io',
  transports: ['websocket', 'polling'],
  autoConnect: false,  // KHÔNG auto-connect — chờ token sẵn sàng
  reconnection: true,
  auth: (cb) => {
    // Lấy token mới mỗi lần connect/reconnect (handles refresh-token rotation)
    cb({ token: getToken() })
  },
});

// Auto-connect nếu đã có token (user đã login từ trước, vd reload trang)
if (getToken()) {
  socket.connect()
}

/**
 * Gọi sau khi login để start socket connection.
 * Token được lấy từ localStorage tại thời điểm connect (qua auth callback ở trên).
 */
export function connectSocket() {
  if (!socket.connected) socket.connect()
}

/**
 * Gọi sau khi logout để disconnect socket.
 */
export function disconnectSocket() {
  if (socket.connected) socket.disconnect()
}

socket.on('connect', () => {
  console.log('✅ Connected to WebSocket server');
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from WebSocket server');
});

socket.on('connect_error', (error) => {
  console.error('⚠️ WebSocket connection error:', error.message);
});
