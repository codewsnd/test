from __future__ import annotations

import re
from urllib.parse import urlsplit

from mcp import ClientSession, types as mcp_types
from mcp.client.streamable_http import streamablehttp_client

from app.core.settings import Settings
from app.schemas.tool import GetAllToolsApiItem, GetAllToolsApiParameter

_GENERIC_SERVER_NAMES = {
    "mcp",
    "mcp server",
    "spring ai mcp server",
    "spring-ai-mcp-server",
}
_ICON_KEYS = {"default", "python", "web", "confluence", "jira", "internal"}


class ToolCatalogService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def list_tools(self, *, use_cache: bool = True) -> list[GetAllToolsApiItem]:
        del use_cache

        if not self._settings.mcp_enabled:
            return []

        server_info, tools = await self._fetch_tools_from_mcp()
        filtered_tools = self._filter_tools(tools)
        mcp_server_name = self._resolve_server_name(server_info)
        provider = self._resolve_provider(mcp_server_name)
        icon = self._resolve_icon(provider)
        tool_prefix = self._resolve_tool_prefix(provider, mcp_server_name)

        return [
            self._map_tool(
                tool,
                mcp_server_name=mcp_server_name,
                provider=provider,
                icon=icon,
                tool_prefix=tool_prefix,
            )
            for tool in filtered_tools
        ]

    async def _fetch_tools_from_mcp(
        self,
    ) -> tuple[mcp_types.Implementation, list[mcp_types.Tool]]:
        async with streamablehttp_client(
            url=self._settings.mcp_server_url,
            timeout=self._settings.mcp_timeout_seconds,
            sse_read_timeout=self._settings.mcp_sse_read_timeout_seconds,
            terminate_on_close=False,
        ) as (read_stream, write_stream, _):
            async with ClientSession(read_stream, write_stream) as session:
                initialize_result = await session.initialize()
                tools_result = await session.list_tools()
                return initialize_result.serverInfo, tools_result.tools

    def _filter_tools(self, tools: list[mcp_types.Tool]) -> list[mcp_types.Tool]:
        if not self._settings.mcp_tool_names:
            return tools

        selected_tool_names = set(self._settings.mcp_tool_names)
        return [tool for tool in tools if tool.name in selected_tool_names]

    def _map_tool(
        self,
        tool: mcp_types.Tool,
        *,
        mcp_server_name: str,
        provider: str,
        icon: str,
        tool_prefix: str,
    ) -> GetAllToolsApiItem:
        tool_description = self._clean_description(tool.description)
        tool_category = self._resolve_category(tool.name, tool_description)
        tool_display_name = self._resolve_tool_display_name(tool)

        return GetAllToolsApiItem(
            tool_name=tool.name,
            tool_display_name=tool_display_name,
            mcp_server_name=mcp_server_name,
            tool_full_name=f"{tool_prefix}/{tool.name}",
            tool_category=tool_category,
            tool_description=tool_description,
            tag=self._build_tags(tool.name, tool_category, provider, tool_description),
            parameters=self._extract_parameters(tool.inputSchema),
            provider=provider,
            icon=icon,
            is_hidden_in_tool=False,
        )

    def _resolve_server_name(self, server_info: mcp_types.Implementation) -> str:
        for candidate in (server_info.title, server_info.name):
            normalized = self._clean_label(candidate)
            if normalized and normalized.lower() not in _GENERIC_SERVER_NAMES:
                return normalized

        parsed_url = urlsplit(self._settings.mcp_server_url)
        if parsed_url.netloc:
            return parsed_url.netloc

        return "MCP Server"

    def _resolve_provider(self, mcp_server_name: str) -> str:
        hostname = (urlsplit(self._settings.mcp_server_url).hostname or "").lower()
        if hostname in {"127.0.0.1", "localhost"}:
            return "Internal"

        lowered_name = mcp_server_name.lower()
        if "jira" in lowered_name:
            return "JIRA"
        if "confluence" in lowered_name:
            return "Confluence"
        if "python" in lowered_name:
            return "Python"
        if "web" in lowered_name:
            return "Web"

        return mcp_server_name

    @staticmethod
    def _resolve_icon(provider: str) -> str:
        normalized = provider.strip().lower()
        if normalized in _ICON_KEYS:
            return normalized

        return "default"

    @staticmethod
    def _resolve_tool_prefix(provider: str, mcp_server_name: str) -> str:
        for candidate in (provider, mcp_server_name, "mcp"):
            prefix = ToolCatalogService._slugify(candidate)
            if prefix:
                return prefix

        return "mcp"

    @staticmethod
    def _resolve_tool_display_name(tool: mcp_types.Tool) -> str:
        annotation_title = tool.annotations.title if tool.annotations else None
        for candidate in (annotation_title, tool.title):
            normalized = ToolCatalogService._clean_label(candidate)
            if normalized:
                return normalized

        return ToolCatalogService._humanize_identifier(tool.name)

    @staticmethod
    def _clean_description(description: str | None) -> str:
        if not description:
            return ""

        normalized = re.sub(r"\s+", " ", description).strip()
        for marker in ("TRIGGER KEYWORDS:", "CRITICAL RULES:"):
            marker_index = normalized.find(marker)
            if marker_index > 0:
                normalized = normalized[:marker_index].strip()

        if normalized and normalized[-1] not in ".!?":
            normalized = f"{normalized}."

        return normalized

    @staticmethod
    def _resolve_category(tool_name: str, tool_description: str) -> str:
        haystack = f"{tool_name} {tool_description}".lower()

        if any(keyword in haystack for keyword in ("test", "qa", "requirement", "api")):
            return "Engineering & DevOps"
        if any(keyword in haystack for keyword in ("ppt", "powerpoint", "presentation", "copy deck", "copydeck", "slide")):
            return "Productivity & Knowledge"
        if any(keyword in haystack for keyword in ("weather", "temperature", "forecast", "climate")):
            return "Utilities"

        return "MCP Tools"

    @staticmethod
    def _build_tags(
        tool_name: str,
        tool_category: str,
        provider: str,
        tool_description: str,
    ) -> list[str]:
        tags: list[str] = ["MCP", provider]
        haystack = f"{tool_name} {tool_description}".lower()

        if "copy deck" in haystack or "copydeck" in haystack:
            tags.append("Copy Deck")
        elif "test" in haystack:
            tags.append("Test Case")
        elif any(keyword in haystack for keyword in ("ppt", "powerpoint", "presentation", "slide")):
            tags.append("PPT")
        elif "weather" in haystack:
            tags.append("Weather")
        else:
            tags.append(tool_category)

        deduped_tags: list[str] = []
        for tag in tags:
            normalized_tag = ToolCatalogService._clean_label(tag)
            if normalized_tag and normalized_tag not in deduped_tags:
                deduped_tags.append(normalized_tag)

        return deduped_tags[:3]

    @staticmethod
    def _extract_parameters(input_schema: dict[str, object] | None) -> list[GetAllToolsApiParameter]:
        if not input_schema:
            return []

        properties = input_schema.get("properties")
        if not isinstance(properties, dict):
            return []

        required_names = {
            item for item in input_schema.get("required", []) if isinstance(item, str)
        }
        parameters: list[GetAllToolsApiParameter] = []

        for param_name, raw_definition in properties.items():
            if not isinstance(raw_definition, dict):
                raw_definition = {}

            param_description = raw_definition.get("description")
            if not isinstance(param_description, str) or not param_description.strip():
                param_description = f"Input parameter for {param_name}."

            parameters.append(
                GetAllToolsApiParameter(
                    param_name=param_name,
                    param_description=re.sub(r"\s+", " ", param_description).strip(),
                    required=param_name in required_names,
                )
            )

        return parameters

    @staticmethod
    def _humanize_identifier(value: str) -> str:
        normalized = re.sub(r"[_\\-]+", " ", value).strip()
        normalized = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", normalized)
        return normalized.title() if normalized else value

    @staticmethod
    def _clean_label(value: str | None) -> str:
        if not value:
            return ""

        return re.sub(r"\s+", " ", value).strip()

    @staticmethod
    def _slugify(value: str) -> str:
        normalized = value.strip().lower()
        normalized = re.sub(r"[^a-z0-9]+", "-", normalized)
        return normalized.strip("-")
