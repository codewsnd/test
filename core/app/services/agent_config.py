from __future__ import annotations

import httpx

from app.core.settings import Settings
from app.schemas.agent import BackendAgentPayload, ResolvedAgentConfig


DEFAULT_INSTRUCTION = (
    "You are a concise assistant running through Google ADK. "
    "Answer the user directly and keep responses practical."
)


class AgentConfigService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def resolve_agent_config(
        self,
        *,
        agent_id: str | None,
        requested_model_name: str | None = None,
    ) -> ResolvedAgentConfig:
        if not agent_id:
            return ResolvedAgentConfig(
                agentId=None,
                agentName="default",
                modelName=requested_model_name or self._settings.oml_model,
                systemPrompt=DEFAULT_INSTRUCTION,
                tools=list(self._settings.mcp_tool_names),
            )

        payload = await self._fetch_backend_agent(agent_id)
        return ResolvedAgentConfig(
            agentId=str(payload.id),
            agentName=payload.name,
            modelName=payload.model_name or requested_model_name or self._settings.oml_model,
            systemPrompt=payload.system_prompt or DEFAULT_INSTRUCTION,
            tools=self._normalize_tools(payload.tools),
            temperature=payload.temperature,
            maxTokens=payload.max_tokens,
            topP=payload.top_p,
            frequencyPenalty=payload.frequency_penalty,
            presencePenalty=payload.presence_penalty,
            outputType=payload.output_type,
        )

    async def _fetch_backend_agent(self, agent_id: str) -> BackendAgentPayload:
        async with httpx.AsyncClient(
            base_url=self._settings.agent_service_base_url.rstrip("/"),
            timeout=self._settings.agent_service_timeout_seconds,
            headers={"uid": "123456"},
        ) as client:
            response = await client.get(f"/agents/{agent_id}")
            response.raise_for_status()
            return BackendAgentPayload.model_validate(response.json())

    @staticmethod
    def _normalize_tools(raw_tools: str | None) -> list[str]:
        if not raw_tools:
            return []

        normalized: list[str] = []
        for item in raw_tools.split(","):
            value = item.strip()
            if not value:
                continue

            tool_name = value.rsplit("/", 1)[-1]
            if tool_name not in normalized:
                normalized.append(tool_name)

        return normalized
