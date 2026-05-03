from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ChatRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    message: str = Field(..., min_length=1, description="User message")
    session_id: str | None = Field(default=None, description="Optional ADK session id")
    agent_id: str | None = Field(default=None, alias="agentId")
    model_name: str | None = Field(default=None, alias="modelName")
    user_id: str = Field(default="local-user", min_length=1)


class ChatResponse(BaseModel):
    session_id: str
    message: str


class ChatMessage(BaseModel):
    role: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)


class ChatDocument(BaseModel):
    content: str | None = None
    base64url: list[str] | None = None
    type: str | None = None
    extension: str | None = None
    id: str | None = None
    name: str | None = None


class ChatStreamCompatRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    conversation_id: str | None = Field(default=None, alias="conversationId")
    request_id: str | None = Field(default=None, alias="requestId")
    agent_id: str | None = Field(default=None, alias="agentId")
    model_name: str | None = Field(default=None, alias="modelName")
    documents: list[ChatDocument] = Field(default_factory=list)
    messages: list[ChatMessage] = Field(..., min_length=1)
    user_id: str = Field(default="local-user", alias="userId", min_length=1)


class CompatAiChatResponse(BaseModel):
    content: str
    model_name: str = Field(..., alias="modelName")
    timestamp: str
    character_count: int = Field(..., alias="characterCount")


class CompatApiResponse(BaseModel):
    success: bool
    data: CompatAiChatResponse | None = None
    error: str | None = None
    code: int | None = None


class HealthResponse(BaseModel):
    status: str
    app: str
    version: str
    model: str


ChatStreamState = Literal["waiting", "processing", "completed", "error"]
ChatStreamStage = Literal[
    "accepted",
    "session-ready",
    "generating",
    "responding",
    "tool-running",
    "tool-completed",
    "finalizing",
    "completed",
    "failed",
]


class ChatSessionEvent(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    session_id: str = Field(..., alias="sessionId")
    request_id: str | None = Field(default=None, alias="requestId")
    conversation_id: str | None = Field(default=None, alias="conversationId")
    model_name: str | None = Field(default=None, alias="modelName")
    started_at: str = Field(..., alias="startedAt")
    resumed: bool = False


class ChatStatusEvent(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    stage: ChatStreamStage
    state: ChatStreamState
    label: str
    detail: str | None = None
    session_id: str | None = Field(default=None, alias="sessionId")
    timestamp: str


class ChatDoneEvent(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    session_id: str = Field(..., alias="sessionId")
    request_id: str | None = Field(default=None, alias="requestId")
    conversation_id: str | None = Field(default=None, alias="conversationId")
    done: bool = True
    chunk_count: int = Field(..., alias="chunkCount")
    character_count: int = Field(..., alias="characterCount")
    completed_at: str = Field(..., alias="completedAt")
