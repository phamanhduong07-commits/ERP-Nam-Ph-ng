from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql://erp_user:erp_password@localhost:5432/erp_nam_phuong"
    SECRET_KEY: str = "change-this-secret-key-immediately"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080
    REFRESH_TOKEN_EXPIRE_DAYS: int = 90
    # Danh sách origin được phép, ngăn cách bằng dấu phẩy
    # Ví dụ production: "https://erp.namphuong.com,https://erp-api.namphuong.com"
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:5174,http://localhost:3000"
    APP_NAME: str = "ERP Nam Phuong"
    APP_DEBUG: bool = Field(default=False, validation_alias=AliasChoices("APP_DEBUG", "ERP_DEBUG"))
    AUTO_CREATE_SCHEMA: bool = False

    # Claude AI
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-sonnet-4-6"

    # ERP Agent provider: ollama | anthropic | auto
    AGENT_PROVIDER: str = "ollama"
    AGENT_MAX_ITERATIONS: int = 10

    # Ollama local AI
    OLLAMA_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "gemma4:latest"
    OLLAMA_TIMEOUT_SECONDS: float = 60.0

    # CD2 MES integration
    CD2_URL: str = "http://cd2-namphuong.mypacksoft.com:38981"
    CD2_USERNAME: str = ""
    CD2_PASSWORD: str = ""

    # Web Push (VAPID) — generate keys once, store in .env
    VAPID_PRIVATE_KEY: str = ""
    VAPID_PUBLIC_KEY: str = ""
    VAPID_EMAIL: str = "mailto:visunpack@namphuongbaobi.com"

    # SerpAPI for lead crawler
    SERPAPI_KEY: str = ""

    # GPS Bình Minh — vehicle tracking
    GPS_API_URL: str = "https://api.gpsbinhminh.vn/Vehicle/GpsInfos"
    GPS_PAGE_IDS: str = "504"
    GPS_USERNAME: str = ""
    GPS_PASSWORD: str = ""
    # History API (tùy chọn) — nếu Bình Minh có endpoint lịch sử, set URL vào đây để backfill sau restart
    # Ví dụ: GPS_HISTORY_API_URL=https://api.gpsbinhminh.vn/Report/Routes
    GPS_HISTORY_API_URL: str = ""
    # Bình Minh systemroute API — tổng hợp nhiên liệu hàng ngày
    # URL: https://systemroute.gpsbinhminh.vn
    # Token: lấy từ F12 → Network khi đăng nhập gpsbinhminh.vn (field "token" trong header)
    GPS_BINHMINH_SYSTEM_URL: str = "https://systemroute.gpsbinhminh.vn"
    GPS_BINHMINH_TOKEN: str = ""  # Session token — set trong .env, hết hạn thì lấy lại từ portal
    # Danh sách serial GPS device, ngăn cách bằng dấu phẩy — lấy từ F12 Network header 'Serial' trong TongHopNlBySerialListV2
    # Ví dụ: GPS_BINHMINH_SERIALS="679316178,123456789,987654321"
    GPS_BINHMINH_SERIALS: str = ""


settings = Settings()
