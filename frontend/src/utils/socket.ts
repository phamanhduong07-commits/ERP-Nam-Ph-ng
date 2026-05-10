import { io, Socket } from 'socket.io-client';

// Địa chỉ backend socket.io
// Vì sử dụng Vite proxy, chúng ta có thể trỏ thẳng tới /ws nếu proxy được cấu hình, 
// hoặc trỏ tới port backend (mặc định 8000 hoặc 5175 tùy setup).
// Trong môi trường development local, backend thường chạy ở port 8000.
const SOCKET_URL = window.location.origin; // Thử sử dụng origin hiện tại

export const socket: Socket = io(SOCKET_URL, {
  path: '/ws/socket.io', // fastapi-socketio/python-socketio mặc định thêm /socket.io
  transports: ['websocket', 'polling'],
  autoConnect: true,
  reconnection: true,
});

// Helper để log trạng thái
socket.on('connect', () => {
  console.log('✅ Connected to WebSocket server');
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from WebSocket server');
});

socket.on('connect_error', (error) => {
  console.error('⚠️ WebSocket connection error:', error);
});
