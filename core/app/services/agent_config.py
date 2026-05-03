from __future__ import annotations

from urllib.parse import parse_qs, urlsplit

import asyncpg

from app.core.settings import Settings
from app.schemas.agent import ResolvedAgentConfig, StoredAgentPayload


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

        payload = await self._fetch_db_agent(agent_id)
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

    async def _fetch_db_agent(self, agent_id: str) -> StoredAgentPayload:
        try:
            parsed_agent_id = int(agent_id)
        except ValueError as exc:
            raise RuntimeError(f"Invalid agent id: {agent_id}.") from exc

        connection_kwargs = self._build_connection_kwargs()
        connection = None
        try:
            connection = await asyncpg.connect(**connection_kwargs)
            record = await connection.fetchrow(
                """
                SELECT
                    id,
                    name,
                    model_name,
                    system_prompt,
                    temperature,
                    max_tokens,
                    top_p,
                    frequency_penalty,
                    presence_penalty,
                    output_type,
                    tools
                FROM chat_agents_info
                WHERE id = $1
                  AND is_deleted = FALSE
                LIMIT 1
                """,
                parsed_agent_id,
            )
        except (OSError, asyncpg.PostgresError) as exc:
            raise RuntimeError(
                "Failed to connect to PostgreSQL while loading agent "
                f"{agent_id} from {self._settings.agent_db_jdbc_url}."
            ) from exc
        finally:
            if connection is not None:
                await connection.close()

        if record is None:
            raise RuntimeError(f"Agent {agent_id} was not found in PostgreSQL.")

        return StoredAgentPayload.model_validate(dict(record))

    def _build_connection_kwargs(self) -> dict[str, object]:
        jdbc_url = self._settings.agent_db_jdbc_url.strip()
        if jdbc_url.startswith("jdbc:"):
            jdbc_url = jdbc_url[len("jdbc:") :]

        parsed = urlsplit(jdbc_url)
        database = parsed.path.lstrip("/")
        if parsed.scheme not in {"postgresql", "postgres"} or not parsed.hostname or not database:
            raise RuntimeError(
                f"Invalid PostgreSQL JDBC URL: {self._settings.agent_db_jdbc_url}."
            )

        query_params = parse_qs(parsed.query)
        timeout = self._settings.agent_db_connect_timeout_seconds
        raw_connect_timeout = query_params.get("connectTimeout", [None])[-1]
        if raw_connect_timeout:
            try:
                timeout = float(raw_connect_timeout)
            except ValueError:
                pass

        sslmode = (query_params.get("sslmode", [""])[-1] or "").strip().lower()
        ssl = False if sslmode == "disable" else None

        return {
            "host": parsed.hostname,
            "port": parsed.port or 5432,
            "user": self._settings.agent_db_username,
            "password": self._settings.agent_db_password,
            "database": database,
            "timeout": timeout,
            "ssl": ssl,
        }

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
