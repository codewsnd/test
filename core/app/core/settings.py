from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "core"
    app_version: str = "0.1.0"
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    oml_base_url: str = Field(
        default="http://127.0.0.1:22001/v1",
        validation_alias="OMLX_BASE_URL",
    )
    oml_api_key: str = Field(default="root1234", validation_alias="OMLX_API_KEY")
    oml_model: str = Field(
        default="Qwen3.5-35B-A3B-4bit",
        validation_alias="OMLX_MODEL",
    )
    request_timeout_seconds: float = 120.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
