from slowapi import Limiter
from slowapi.util import get_remote_address

# config_filename="__none__" — file không tồn tại, tránh Starlette Config đọc .env với cp1252 encoding
limiter = Limiter(key_func=get_remote_address, storage_uri="memory://", config_filename="__none__")
