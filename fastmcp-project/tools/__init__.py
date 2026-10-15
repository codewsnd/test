"""项目工具的统一注册入口。"""

from fastmcp import FastMCP

from .weather import register_weather_tools


def register_tools(mcp: FastMCP) -> None:
    """注册项目中的 MCP 工具及其 UI 资源。"""
    register_weather_tools(mcp)
