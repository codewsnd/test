import json
from functools import lru_cache
from typing import Annotated, Any
from urllib.parse import urlsplit, urlunsplit

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "core"
    app_version: str = "0.1.0"
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    oml_base_url: str = Field(
        default="http://127.0.0.1:22001/v1",
        validation_alias=AliasChoices(
            "spring.ai.openai.base-url",
            "SPRING_AI_OPENAI_BASE_URL",
            "OMLX_BASE_URL",
        ),
    )
    oml_api_key: str = Field(
        default="root1234",
        validation_alias=AliasChoices(
            "spring.ai.openai.api-key",
            "SPRING_AI_OPENAI_API_KEY",
            "OMLX_API_KEY",
        ),
    )
    oml_model: str = Field(
        default="Qwen3.5-35B-A3B-4bit",
        validation_alias=AliasChoices(
            "spring.ai.openai.chat.options.model",
            "SPRING_AI_OPENAI_CHAT_OPTIONS_MODEL",
            "OMLX_MODEL",
        ),
    )
    mcp_enabled: bool = Field(
        default=False,
        validation_alias=AliasChoices(
            "MCP_ENABLED",
            "CORE_MCP_ENABLED",
        ),
    )
    mcp_server_url: str = Field(
        default="http://127.0.0.1:8082/mcp",
        validation_alias=AliasChoices(
            "MCP_SERVER_URL",
            "CORE_MCP_SERVER_URL",
            "SPRINGBOOT3_BACKEND_MCP_URL",
        ),
    )
    mcp_timeout_seconds: float = Field(
        default=10.0,
        validation_alias=AliasChoices(
            "MCP_TIMEOUT_SECONDS",
            "CORE_MCP_TIMEOUT_SECONDS",
        ),
    )
    mcp_sse_read_timeout_seconds: float = Field(
        default=300.0,
        validation_alias=AliasChoices(
            "MCP_SSE_READ_TIMEOUT_SECONDS",
            "CORE_MCP_SSE_READ_TIMEOUT_SECONDS",
        ),
    )
    mcp_tool_names: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: [
            "createCopyDeck",
            "createTestCase",
            "createPpt",
            "queryWeather",
        ],
        validation_alias=AliasChoices(
            "MCP_TOOL_NAMES",
            "CORE_MCP_TOOL_NAMES",
        ),
    )
    request_timeout_seconds: float = 120.0
    cors_allow_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["null"],
        validation_alias="CORS_ALLOW_ORIGINS",
    )
    cors_allow_origin_regex: str | None = Field(
        default=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
        validation_alias="CORS_ALLOW_ORIGIN_REGEX",
    )
    cors_allow_credentials: bool = Field(
        default=True,
        validation_alias="CORS_ALLOW_CREDENTIALS",
    )
    cors_allow_methods: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["*"],
        validation_alias="CORS_ALLOW_METHODS",
    )
    cors_allow_headers: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["*"],
        validation_alias="CORS_ALLOW_HEADERS",
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator(
        "cors_allow_origins",
        "mcp_tool_names",
        "cors_allow_methods",
        "cors_allow_headers",
        mode="before",
    )
    @classmethod
    def parse_csv_or_json_list(cls, value: Any) -> Any:
        if not isinstance(value, str):
            return value

        raw_value = value.strip()
        if not raw_value:
            return []

        if raw_value.startswith("["):
            parsed_value = json.loads(raw_value)
            if isinstance(parsed_value, list):
                return parsed_value

        return [item.strip() for item in raw_value.split(",") if item.strip()]

    @field_validator("cors_allow_origin_regex", mode="before")
    @classmethod
    def empty_regex_to_none(cls, value: Any) -> Any:
        if isinstance(value, str) and not value.strip():
            return None

        return value

    @field_validator("oml_base_url", mode="before")
    @classmethod
    def normalize_openai_base_url(cls, value: Any) -> Any:
        if not isinstance(value, str):
            return value

        raw_value = value.strip()
        if not raw_value:
            return raw_value

        parsed = urlsplit(raw_value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            return raw_value

        normalized_path = parsed.path.rstrip("/")
        if normalized_path:
            return raw_value

        return urlunsplit((parsed.scheme, parsed.netloc, "/v1", parsed.query, parsed.fragment))


@lru_cache
def get_settings() -> Settings:
    return Settings()
