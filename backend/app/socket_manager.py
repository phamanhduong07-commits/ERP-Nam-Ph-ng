import socketio

# Khởi tạo AsyncServer cho Socket.io
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*', # Sẽ được cấu hình chi tiết nếu cần
    logger=True,
    engineio_logger=True
)

# ASGI app để mount vào FastAPI
# Lưu ý: Khi mount vào /ws trong main.py, socket.io sẽ nhận các request /ws/socket.io
socket_app = socketio.ASGIApp(sio, socketio_path='')
