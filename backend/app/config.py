from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql://erp_user:erp_password@localhost:5432/erp_nam_phuong"
    SECRET_KEY: str = "change-this-secret-key-immediately"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    # Danh sách origin được phép, ngăn cách bằng dấu phẩy
    # Ví dụ production: "https://erp.namphuong.com,https://erp-api.namphuong.com"
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:5174,http://localhost:3000"
    APP_NAME: str = "ERP Nam Phuong"
    APP_DEBUG: bool = Field(default=False, validation_alias=AliasChoices("APP_DEBUG", "ERP_DEBUG"))
    AUTO_CREATE_SCHEMA: bool = False

    # CD2 MES integration
    CD2_URL: str = "http://cd2-namphuong.mypacksoft.com:38981"
    CD2_USERNAME: str = ""
    CD2_PASSWORD: str = ""

settings = Settings()
