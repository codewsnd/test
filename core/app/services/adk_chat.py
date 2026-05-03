from __future__ import annotations

import json
from collections.abc import AsyncIterator, Callable
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from google.adk.agents import Agent
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.events import Event
from google.adk.models.lite_llm import LiteLlm
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.tools import McpToolset
from google.adk.tools.mcp_tool import StreamableHTTPConnectionParams
from google.genai import types
from pydantic import BaseModel

from app.core.settings import Settings
from app.schemas.agent import ResolvedAgentConfig
from app.schemas.chat import (
    ChatDoneEvent,
    ChatMessage,
    ChatRequest,
    ChatResponse,
    ChatSessionEvent,
    ChatStatusEvent,
    ChatStreamCompatRequest,
)
from app.services.agent_config import AgentConfigService


class LocalChatAgent(Agent):
    pass


class AdkChatService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._session_service = InMemorySessionService()
        self._agent_config_service = AgentConfigService(settings)

    def _build_agent(self, agent_config: ResolvedAgentConfig) -> Agent:
        return LocalChatAgent(
            name="chat_agent",
            model=LiteLlm(
                model=f"openai/{agent_config.model_name}",
                api_base=self._settings.oml_base_url,
                api_key=self._settings.oml_api_key,
                timeout=self._settings.request_timeout_seconds,
                drop_params=True,
                temperature=agent_config.temperature,
                max_tokens=agent_config.max_tokens,
                top_p=agent_config.top_p,
                frequency_penalty=agent_config.frequency_penalty,
                presence_penalty=agent_config.presence_penalty,
            ),
            instruction=agent_config.system_prompt,
            tools=self._build_tools(agent_config.tools),
        )

    def _build_runner(self, agent_config: ResolvedAgentConfig) -> Runner:
        return Runner(
            app_name=self._settings.app_name,
            agent=self._build_agent(agent_config),
            session_service=self._session_service,
        )

    def _build_tools(self, tool_names: list[str]) -> list[McpToolset]:
        if not self._settings.mcp_enabled or not tool_names:
            return []

        return [
            McpToolset(
                connection_params=StreamableHTTPConnectionParams(
                    url=self._settings.mcp_server_url,
                    timeout=self._settings.mcp_timeout_seconds,
                    sse_read_timeout=self._settings.mcp_sse_read_timeout_seconds,
                    terminate_on_close=False,
                ),
                tool_filter=tool_names or None,
            )
        ]

    async def chat(self, request: ChatRequest) -> ChatResponse:
        agent_config = await self._agent_config_service.resolve_agent_config(
            agent_id=request.agent_id,
            requested_model_name=request.model_name,
        )
        session_id, _ = await self._ensure_session(request.user_id, request.session_id)
        content = self._content_from_text(request.message)
        answer_parts: list[str] = []
        runner = self._build_runner(agent_config)

        async for event in runner.run_async(
            user_id=request.user_id,
            session_id=session_id,
            new_message=content,
        ):
            if event.is_final_response():
                answer_parts.append(self._text_from_event(event))

        return ChatResponse(
            session_id=session_id,
            message="".join(answer_parts).strip(),
        )

    async def stream_chat(self, request: ChatRequest) -> AsyncIterator[str]:
        agent_config = await self._agent_config_service.resolve_agent_config(
            agent_id=request.agent_id,
            requested_model_name=request.model_name,
        )
        async for chunk in self._stream_response(
            agent_config=agent_config,
            user_id=request.user_id,
            session_id_hint=request.session_id,
            request_id=request.session_id,
            prompt=request.message,
            message_payload_builder=self._plain_text_chunk,
        ):
            yield chunk

    async def stream_chat_compat(self, request: ChatStreamCompatRequest) -> AsyncIterator[str]:
        agent_config = await self._agent_config_service.resolve_agent_config(
            agent_id=request.agent_id,
            requested_model_name=request.model_name,
        )
        session_id_hint = self._build_session_hint(
            conversation_id=request.conversation_id,
            request_id=request.request_id,
            agent_id=request.agent_id,
        )
        session_id, is_new_session = await self._ensure_session(request.user_id, session_id_hint)
        prompt = (
            self._messages_to_prompt(request.messages)
            if is_new_session
            else self._latest_user_message(request.messages)
        )

        async for chunk in self._stream_response(
            agent_config=agent_config,
            user_id=request.user_id,
            session_id_hint=session_id,
            request_id=request.request_id,
            conversation_id=request.conversation_id,
            prompt=prompt,
            message_payload_builder=self._spring_ai_chunk,
            session_resumed=not is_new_session,
            bootstrap_mode="client-transcript" if is_new_session else "session-memory",
            prepared_session=(session_id, is_new_session),
        ):
            yield chunk

    async def chat_compat(self, request: ChatStreamCompatRequest) -> dict[str, object]:
        agent_config = await self._agent_config_service.resolve_agent_config(
            agent_id=request.agent_id,
            requested_model_name=request.model_name,
        )
        session_id_hint = self._build_session_hint(
            conversation_id=request.conversation_id,
            request_id=request.request_id,
            agent_id=request.agent_id,
        )
        session_id, is_new_session = await self._ensure_session(request.user_id, session_id_hint)
        prompt = (
            self._messages_to_prompt(request.messages)
            if is_new_session
            else self._latest_user_message(request.messages)
        )
        response = await self.chat(
            ChatRequest(
                message=prompt,
                session_id=session_id,
                agent_id=request.agent_id,
                model_name=agent_config.model_name,
                user_id=request.user_id,
            )
        )

        content = response.message.strip()
        return {
            "success": True,
            "data": {
                "content": content,
                "modelName": agent_config.model_name,
                "timestamp": datetime.now(UTC).isoformat(),
                "characterCount": len(content),
            },
        }

    async def _ensure_session(self, user_id: str, session_id: str | None) -> tuple[str, bool]:
        if not session_id:
            session_id = str(uuid4())

        session = await self._session_service.get_session(
            app_name=self._settings.app_name,
            user_id=user_id,
            session_id=session_id,
        )
        if session is None:
            await self._session_service.create_session(
                app_name=self._settings.app_name,
                user_id=user_id,
                session_id=session_id,
            )
            return session_id, True
        return session_id, False

    async def _stream_response(
        self,
        *,
        agent_config: ResolvedAgentConfig,
        user_id: str,
        session_id_hint: str | None,
        prompt: str,
        message_payload_builder: Callable[[str, str, int, bool], dict[str, object]],
        request_id: str | None = None,
        conversation_id: str | None = None,
        session_resumed: bool = False,
        bootstrap_mode: str = "direct-message",
        prepared_session: tuple[str, bool] | None = None,
    ) -> AsyncIterator[str]:
        session_id, created_session = (
            prepared_session
            if prepared_session is not None
            else await self._ensure_session(user_id, session_id_hint)
        )
        started_at = self._iso_now()
        session_was_resumed = session_resumed or not created_session
        runner = self._build_runner(agent_config)

        yield self._sse(
            "session",
            ChatSessionEvent(
                sessionId=session_id,
                requestId=request_id,
                conversationId=conversation_id,
                modelName=agent_config.model_name,
                startedAt=started_at,
                resumed=session_was_resumed,
            ),
        )
        yield self._sse(
            "status",
            self._status_event(
                stage="accepted",
                state="processing",
                label="Request accepted",
                detail="The chat request has been accepted and is preparing execution.",
                session_id=session_id,
            ),
        )
        yield self._sse(
            "status",
            self._status_event(
                stage="session-ready",
                state="completed",
                label="Session ready",
                detail=(
                    "Resumed in-memory session context."
                    if session_was_resumed
                    else f"Started a new session using {bootstrap_mode}."
                ),
                session_id=session_id,
            ),
        )
        yield self._sse(
            "status",
            self._status_event(
                stage="generating",
                state="processing",
                label="Model running",
                detail=f"Dispatching request to model {agent_config.model_name}.",
                session_id=session_id,
            ),
        )

        content = self._content_from_text(prompt)
        sent_partial = False
        first_chunk_sent = False
        chunk_count = 0
        character_count = 0

        try:
            async for event in runner.run_async(
                user_id=user_id,
                session_id=session_id,
                new_message=content,
                run_config=RunConfig(streaming_mode=StreamingMode.SSE),
            ):
                for function_call in event.get_function_calls():
                    yield self._sse("tool-call", self._tool_call_payload(function_call))
                    yield self._sse(
                        "status",
                        self._status_event(
                            stage="tool-running",
                            state="processing",
                            label="Tool running",
                            detail=f"Calling tool {function_call.name or 'unknown-tool'}.",
                            session_id=session_id,
                        ),
                    )

                for function_response in event.get_function_responses():
                    yield self._sse("tool-result", self._tool_result_payload(function_response))
                    yield self._sse(
                        "status",
                        self._status_event(
                            stage="tool-completed",
                            state="processing",
                            label="Tool completed",
                            detail=f"Tool {function_response.name or 'unknown-tool'} returned a result.",
                            session_id=session_id,
                        ),
                    )

                text = self._text_from_event(event)
                if not text or not text.strip():
                    continue

                if not first_chunk_sent:
                    first_chunk_sent = True
                    yield self._sse(
                        "status",
                        self._status_event(
                            stage="responding",
                            state="processing",
                            label="Streaming response",
                            detail="The assistant has started returning content.",
                            session_id=session_id,
                        ),
                    )

                chunk_count += 1
                character_count += len(text)

                payload = message_payload_builder(
                    text,
                    session_id,
                    chunk_count,
                    event.partial,
                )
                if event.partial:
                    sent_partial = True
                    yield self._sse("message", payload)
                elif event.is_final_response() and not sent_partial:
                    yield self._sse("message", payload)
        except Exception as exc:
            error_message = f"LLM request failed: {exc}"
            yield self._sse(
                "status",
                self._status_event(
                    stage="failed",
                    state="error",
                    label="Request failed",
                    detail=error_message,
                    session_id=session_id,
                ),
            )
            yield self._sse(
                "error-message",
                {
                    "error": error_message,
                    "sessionId": session_id,
                    "requestId": request_id,
                    "conversationId": conversation_id,
                    "timestamp": self._iso_now(),
                },
            )
            return

        yield self._sse(
            "status",
            self._status_event(
                stage="finalizing",
                state="processing",
                label="Finalizing response",
                detail="The assistant is closing the stream and preparing completion metadata.",
                session_id=session_id,
            ),
        )

        completed_at = self._iso_now()
        yield self._sse(
            "status",
            self._status_event(
                stage="completed",
                state="completed",
                label="Response completed",
                detail=f"Generated {character_count} characters across {chunk_count} chunks.",
                session_id=session_id,
            ),
        )
        yield self._sse(
            "done",
            ChatDoneEvent(
                sessionId=session_id,
                requestId=request_id,
                conversationId=conversation_id,
                done=True,
                chunkCount=chunk_count,
                characterCount=character_count,
                completedAt=completed_at,
            ),
        )

    @staticmethod
    def _content_from_text(text: str) -> types.Content:
        return types.Content(
            role="user",
            parts=[types.Part.from_text(text=text)],
        )

    @staticmethod
    def _messages_to_prompt(messages: list[ChatMessage]) -> str:
        if not messages:
            raise ValueError("At least one message is required")

        system_messages: list[str] = []
        transcript_lines: list[str] = []

        for message in messages:
            content = message.content.strip()
            if not content:
                continue

            role = message.role.strip().lower()
            if role == "system":
                system_messages.append(content)
            elif role == "assistant":
                transcript_lines.append(f"Assistant: {content}")
            else:
                transcript_lines.append(f"User: {content}")

        if not transcript_lines:
            raise ValueError("At least one user or assistant message is required")

        prompt_sections = [
            "Continue the conversation below and reply only as the assistant."
        ]
        if system_messages:
            prompt_sections.append("System instructions:\n" + "\n\n".join(system_messages))
        prompt_sections.append("Conversation:\n" + "\n\n".join(transcript_lines))
        return "\n\n".join(prompt_sections)

    @staticmethod
    def _latest_user_message(messages: list[ChatMessage]) -> str:
        for message in reversed(messages):
            content = message.content.strip()
            if content and message.role.strip().lower() == "user":
                return content

        raise ValueError("At least one user message is required")

    @staticmethod
    def _build_session_hint(
        *,
        conversation_id: str | None,
        request_id: str | None,
        agent_id: str | None,
    ) -> str:
        base_id = conversation_id or request_id or f"compat-{uuid4()}"
        if not agent_id:
            return base_id

        return f"{base_id}:agent:{agent_id}"

    @staticmethod
    def _text_from_event(event: Event | object) -> str:
        content = getattr(event, "content", None)
        parts = getattr(content, "parts", None)
        if not parts:
            return ""
        return "".join(part.text or "" for part in parts)

    @staticmethod
    def _spring_ai_chunk(
        text: str,
        session_id: str,
        chunk_index: int,
        partial: bool,
    ) -> dict[str, object]:
        return {
            "output": {
                "text": text,
                "messageType": "ASSISTANT",
            },
            "metadata": {
                "sessionId": session_id,
                "chunkIndex": chunk_index,
                "partial": partial,
                "createdAt": AdkChatService._iso_now(),
            },
        }

    @staticmethod
    def _plain_text_chunk(
        text: str,
        session_id: str,
        chunk_index: int,
        partial: bool,
    ) -> dict[str, object]:
        return {
            "sessionId": session_id,
            "delta": text,
            "chunkIndex": chunk_index,
            "partial": partial,
            "createdAt": AdkChatService._iso_now(),
        }

    @staticmethod
    def _status_event(
        *,
        stage: str,
        state: str,
        label: str,
        detail: str,
        session_id: str,
    ) -> ChatStatusEvent:
        return ChatStatusEvent(
            stage=stage,
            state=state,
            label=label,
            detail=detail,
            sessionId=session_id,
            timestamp=AdkChatService._iso_now(),
        )

    @staticmethod
    def _tool_call_payload(function_call: types.FunctionCall) -> dict[str, object]:
        tool_name = function_call.name or "unknown-tool"
        params = AdkChatService._stringify_payload(function_call.args or function_call.partial_args or {})
        return {
            "toolName": tool_name,
            "toolCallId": function_call.id,
            "params": params,
            "toolname": tool_name,
            "timestamp": AdkChatService._iso_now(),
        }

    @staticmethod
    def _tool_result_payload(function_response: types.FunctionResponse) -> dict[str, object]:
        tool_name = function_response.name or "unknown-tool"
        result = AdkChatService._stringify_payload(function_response.response or function_response.parts or {})
        return {
            "toolName": tool_name,
            "toolCallId": function_response.id,
            "result": result,
            "tool-result": result,
            "timestamp": AdkChatService._iso_now(),
        }

    @staticmethod
    def _stringify_payload(value: Any) -> str:
        if isinstance(value, str):
            return value

        try:
            return json.dumps(value, ensure_ascii=False, default=str)
        except TypeError:
            return str(value)

    @staticmethod
    def _iso_now() -> str:
        return datetime.now(UTC).isoformat()

    @staticmethod
    def _sse(event: str, data: object) -> str:
        payload = (
            data.model_dump(by_alias=True, exclude_none=True)
            if isinstance(data, BaseModel)
            else data
        )
        return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
