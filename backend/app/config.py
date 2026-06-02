import sys
from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_INSECURE_DEFAULTS = {
    "change-this-secret-key-immediately",
    "secret",
    "secretkey",
    "your-secret-key",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql://erp_user:erp_password@localhost:5432/erp_nam_phuong"
    SECRET_KEY: str = "change-this-secret-key-immediately"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    @model_validator(mode="after")
    def _check_secret_key(self) -> "Settings":
        if self.SECRET_KEY in _INSECURE_DEFAULTS or len(self.SECRET_KEY) < 32:
            print(
                "\n[SECURITY ERROR] SECRET_KEY không an toàn!\n"
                "  Hãy thêm vào backend/.env:\n"
                "  SECRET_KEY=<chuỗi ngẫu nhiên ít nhất 32 ký tự>\n"
                "  Tạo nhanh: python -c \"import secrets; print(secrets.token_hex(32))\"\n",
                file=sys.stderr,
            )
            sys.exit(1)
        return self
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

    # SQL Server HTCPH — hệ thống ERP cũ, dùng để sync giá NVL
    HTCPH_HOST: str = "203.162.54.176"
    HTCPH_PORT: int = 1441
    HTCPH_USER: str = "duong"
    HTCPH_PASSWORD: str = ""
    HTCPH_DB: str = "HTCPH"

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

    # MISA meInvoice — hóa đơn điện tử
    MISA_API_URL: str = "https://ws.meinvoice.vn"
    MISA_USERNAME: str = ""
    MISA_PASSWORD: str = ""
    MISA_COMPANY_CODE: str = ""  # Mã công ty trên MISA
    MISA_TEMPLATE_CODE: str = "01GTKT0/001"  # Mẫu số hóa đơn
    MISA_SERIAL: str = ""  # Ký hiệu (VD: C25TAA)


settings = Settings()
