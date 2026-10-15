"""普通文本天气工具与 MCP Apps 天气卡片。"""

from dataclasses import asdict
from pathlib import Path

from fastmcp import FastMCP
from fastmcp.apps import AppConfig, ResourceCSP, UI_MIME_TYPE
from fastmcp.tools import ToolResult
from mcp.types import ToolAnnotations

from .mock_weather import DEFAULT_CITY, format_weather, get_mock_weather

WEATHER_VIEW_URI = "ui://weather/view.html"
WEATHER_TEMPLATE = Path(__file__).parent / "templates" / "weather.html"
WEATHER_ANNOTATIONS = ToolAnnotations(
    readOnlyHint=True,
    destructiveHint=False,
    idempotentHint=True,
    openWorldHint=False,
)


def get_weather_text(city: str = DEFAULT_CITY) -> str:
    """查询 Mock 天气并返回普通文本。支持北京、上海、广州、深圳、杭州。"""
    return format_weather(get_mock_weather(city))


def get_weather_app(city: str = DEFAULT_CITY) -> ToolResult:
    """查询 Mock 天气并用 MCP Apps 展示自定义 HTML 卡片。支持北京、上海、广州、深圳、杭州。"""
    weather = get_mock_weather(city)
    return ToolResult(
        content=format_weather(weather),
        structured_content=asdict(weather),
    )


def weather_view() -> str:
    """返回天气卡片模板，查询结果由 MCP Apps 宿主单独传入。"""
    return WEATHER_TEMPLATE.read_text(encoding="utf-8")


def register_weather_tools(mcp: FastMCP) -> None:
    """注册两个天气工具，并将 HTML 工具关联到 MCP Apps 资源。"""
    mcp.tool(annotations=WEATHER_ANNOTATIONS, output_schema=None)(get_weather_text)
    mcp.tool(
        annotations=WEATHER_ANNOTATIONS,
        app=AppConfig(resource_uri=WEATHER_VIEW_URI),
    )(get_weather_app)
    mcp.resource(
        WEATHER_VIEW_URI,
        mime_type=UI_MIME_TYPE,
        app=AppConfig(
            prefers_border=True,
            csp=ResourceCSP(
                resource_domains=["https://unpkg.com"],
                connect_domains=[],
            ),
        ),
    )(weather_view)
