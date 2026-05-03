from __future__ import annotations

import json
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from uuid import uuid4

from google.adk.agents import Agent
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.models.lite_llm import LiteLlm
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from app.core.settings import Settings
from app.schemas.chat import (
    ChatMessage,
    ChatRequest,
    ChatResponse,
    ChatStreamCompatRequest,
)


DEFAULT_INSTRUCTION = (
    "You are a concise assistant running through Google ADK. "
    "Answer the user directly and keep responses practical."
)


class LocalChatAgent(Agent):
    pass


class AdkChatService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._session_service = InMemorySessionService()
        self._runner = Runner(
            app_name=settings.app_name,
            agent=self._build_agent(settings),
            session_service=self._session_service,
        )

    def _build_agent(self, settings: Settings) -> Agent:
        return LocalChatAgent(
            name="local_chat_agent",
            model=LiteLlm(
                model=f"openai/{settings.oml_model}",
                api_base=settings.oml_base_url,
                api_key=settings.oml_api_key,
                timeout=settings.request_timeout_seconds,
                drop_params=True,
            ),
            instruction=DEFAULT_INSTRUCTION,
        )

    async def chat(self, request: ChatRequest) -> ChatResponse:
        session_id = await self._ensure_session(request.user_id, request.session_id)
        content = self._content_from_text(request.message)
        answer_parts: list[str] = []

        async for event in self._runner.run_async(
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
        session_id = await self._ensure_session(request.user_id, request.session_id)
        content = self._content_from_text(request.message)
        sent_partial = False

        async for event in self._runner.run_async(
            user_id=request.user_id,
            session_id=session_id,
            new_message=content,
            run_config=RunConfig(streaming_mode=StreamingMode.SSE),
        ):
            text = self._text_from_event(event)
            if not text or not text.strip():
                continue

            if event.partial:
                sent_partial = True
                yield self._sse("message", {"session_id": session_id, "delta": text})
            elif event.is_final_response() and not sent_partial:
                yield self._sse("message", {"session_id": session_id, "delta": text})

        yield self._sse("done", {"session_id": session_id, "done": True})

    async def stream_chat_compat(self, request: ChatStreamCompatRequest) -> AsyncIterator[str]:
        prompt = self._messages_to_prompt(request.messages)
        session_id = await self._ensure_session(request.user_id, f"compat-{uuid4()}")
        content = self._content_from_text(prompt)
        sent_partial = False

        try:
            async for event in self._runner.run_async(
                user_id=request.user_id,
                session_id=session_id,
                new_message=content,
                run_config=RunConfig(streaming_mode=StreamingMode.SSE),
            ):
                text = self._text_from_event(event)
                if not text or not text.strip():
                    continue

                payload = self._spring_ai_chunk(text)
                if event.partial:
                    sent_partial = True
                    yield self._sse("message", payload)
                elif event.is_final_response() and not sent_partial:
                    yield self._sse("message", payload)
        except Exception as exc:
            yield self._sse("error-message", {"error": f"LLM request failed: {exc}"})
            return

        yield self._sse("done", {"done": True})

    async def chat_compat(self, request: ChatStreamCompatRequest) -> dict[str, object]:
        prompt = self._messages_to_prompt(request.messages)
        response = await self.chat(
            ChatRequest(
                message=prompt,
                session_id=request.request_id,
                user_id=request.user_id,
            )
        )

        content = response.message.strip()
        model_name = request.model_name or self._settings.oml_model
        return {
            "success": True,
            "data": {
                "content": content,
                "modelName": model_name,
                "agentName": "local_chat_agent",
                "timestamp": datetime.now(UTC).isoformat(),
                "characterCount": len(content),
            },
        }

    async def _ensure_session(self, user_id: str, session_id: str | None) -> str:
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
        return session_id

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
    def _text_from_event(event: object) -> str:
        content = getattr(event, "content", None)
        parts = getattr(content, "parts", None)
        if not parts:
            return ""
        return "".join(part.text or "" for part in parts)

    @staticmethod
    def _spring_ai_chunk(text: str) -> dict[str, object]:
        return {
            "output": {
                "text": text,
                "messageType": "ASSISTANT",
            },
            "metadata": {},
        }

    @staticmethod
    def _sse(event: str, data: object) -> str:
        return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
