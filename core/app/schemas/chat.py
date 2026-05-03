from pydantic import BaseModel, ConfigDict, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User message")
    session_id: str | None = Field(default=None, description="Optional ADK session id")
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
    agent_name: str = Field(..., alias="agentName")
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
