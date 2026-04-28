from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://erp_user:erp_password@localhost:5432/erp_nam_phuong"
    SECRET_KEY: str = "change-this-secret-key-immediately"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    APP_NAME: str = "ERP Nam Phuong"
    DEBUG: bool = False

    # CD2 MES integration
    CD2_URL: str = "http://cd2-namphuong.mypacksoft.com:38981"
    CD2_USERNAME: str = ""
    CD2_PASSWORD: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
