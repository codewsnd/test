from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from app.core.settings import get_settings
from app.schemas.chat import (
    CompatApiResponse,
    ChatStreamCompatRequest,
)
from app.services.adk_chat import AdkChatService

router = APIRouter(tags=["chat"])
settings = get_settings()
chat_service = AdkChatService(settings)


@router.post("/chat/completions", response_model=CompatApiResponse)
async def compat_chat_completions(request: ChatStreamCompatRequest) -> CompatApiResponse:
    try:
        payload = await chat_service.chat_compat(request)
        return CompatApiResponse.model_validate(payload)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM request failed: {exc}",
        ) from exc


@router.post("/chat/stream")
async def compat_stream_chat(request: ChatStreamCompatRequest) -> StreamingResponse:
    async def event_stream():
        try:
            async for chunk in chat_service.stream_chat_compat(request):
                yield chunk
        except Exception as exc:
            yield chat_service._sse(
                "error-message",
                {"error": f"LLM request failed: {exc}"},
            )

    return StreamingResponse(event_stream(), media_type="text/event-stream")
