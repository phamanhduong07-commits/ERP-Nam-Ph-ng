import sys
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context
from dotenv import load_dotenv

# 1. Cấu hình để Python tìm thấy code trong thư mục backend
sys.path.append(os.getcwd())

# 2. Load các biến môi trường từ file .env
load_dotenv()

# 3. Import Base
try:
    from app.database import Base
    print("--- OK: Base from app.database ---")
except ImportError:
    from app.models import Base
    print("--- OK: Base from app.models ---")

# --- BƯỚC QUAN TRỌNG: NẠP TẤT CẢ MODELS ĐỂ ALEMBIC KHÔNG ĐÒI XÓA BẢNG ---
# Đoạn code này sẽ tự động tìm các file trong thư mục app/models và nạp chúng vào Metadata
import importlib
models_path = os.path.join(os.getcwd(), "app", "models")
if os.path.exists(models_path):
    for file in os.listdir(models_path):
        if file.endswith(".py") and file != "__init__.py":
            module_name = f"app.models.{file[:-3]}"
            importlib.import_module(module_name)
    print(f"--- OK: models loaded, tables: {list(Base.metadata.tables.keys())} ---")
# ----------------------------------------------------------------------

config = context.config

# 4. Tự động lấy URL từ file .env
database_url = os.getenv("DATABASE_URL")
if database_url:
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+psycopg2://")
    config.set_main_option("sqlalchemy.url", database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection, 
            target_metadata=target_metadata,
            compare_type=True 
        )
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()