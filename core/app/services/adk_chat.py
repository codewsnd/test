from __future__ import annotations

import json
from collections.abc import AsyncIterator
from uuid import uuid4

from google.adk.agents import Agent
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.models.lite_llm import LiteLlm
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from app.core.settings import Settings
from app.schemas.chat import ChatRequest, ChatResponse


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
    def _text_from_event(event: object) -> str:
        content = getattr(event, "content", None)
        parts = getattr(content, "parts", None)
        if not parts:
            return ""
        return "".join(part.text or "" for part in parts)

    @staticmethod
    def _sse(event: str, data: dict[str, object]) -> str:
        return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
