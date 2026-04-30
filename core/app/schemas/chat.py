from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User message")
    session_id: str | None = Field(default=None, description="Optional ADK session id")
    user_id: str = Field(default="local-user", min_length=1)


class ChatResponse(BaseModel):
    session_id: str
    message: str


class HealthResponse(BaseModel):
    status: str
    app: str
    version: str
    model: str
