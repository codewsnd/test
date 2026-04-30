from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from app.core.settings import get_settings
from app.schemas.chat import ChatRequest, ChatResponse, HealthResponse
from app.services.adk_chat import AdkChatService

router = APIRouter(prefix="/api/v1", tags=["chat"])
settings = get_settings()
chat_service = AdkChatService(settings)


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        app=settings.app_name,
        version=settings.app_version,
        model=settings.oml_model,
    )


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    try:
        return await chat_service.chat(request)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM request failed: {exc}",
        ) from exc


@router.post("/stream-chat")
async def stream_chat(request: ChatRequest) -> StreamingResponse:
    async def event_stream():
        try:
            async for chunk in chat_service.stream_chat(request):
                yield chunk
        except Exception as exc:
            yield chat_service._sse(
                "error",
                {"message": f"LLM request failed: {exc}"},
            )

    return StreamingResponse(event_stream(), media_type="text/event-stream")
