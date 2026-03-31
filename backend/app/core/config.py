from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = BASE_DIR / "data" / "estherica.db"
DEFAULT_ENCRYPTION_KEY = "75AtrKy0JZXNuMreCvxJiJpR3VoUd8causm68EKw-Ac="


class Settings(BaseSettings):
    app_name: str = "Estherica API"
    api_prefix: str = "/api"
    database_url: str = f"sqlite:///{DEFAULT_DB_PATH}"
    admin_email: str = "admin@estherica.local"
    admin_password: str = "change-me"
    jwt_secret: str = "replace-this-in-production"
    encryption_key: str = DEFAULT_ENCRYPTION_KEY
    access_token_expire_minutes: int = 60 * 12
    timezone: str = "Asia/Jerusalem"
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str | None) -> str:
        if value is None:
            return f"sqlite:///{DEFAULT_DB_PATH}"
        normalized = str(value).strip()
        if not normalized:
            return f"sqlite:///{DEFAULT_DB_PATH}"
        return normalized

    @field_validator("encryption_key", mode="before")
    @classmethod
    def normalize_encryption_key(cls, value: str | None) -> str:
        if value is None:
            return DEFAULT_ENCRYPTION_KEY
        normalized = str(value).strip()
        if not normalized:
            return DEFAULT_ENCRYPTION_KEY
        return normalized

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
