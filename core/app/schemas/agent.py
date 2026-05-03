from pydantic import BaseModel, ConfigDict, Field


class BackendAgentPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    name: str
    model_name: str | None = Field(default=None, alias="modelName")
    system_prompt: str | None = Field(default=None, alias="systemPrompt")
    temperature: float | None = None
    max_tokens: int | None = Field(default=None, alias="maxTokens")
    top_p: float | None = Field(default=None, alias="topP")
    frequency_penalty: float | None = Field(default=None, alias="frequencyPenalty")
    presence_penalty: float | None = Field(default=None, alias="presencePenalty")
    output_type: str | None = Field(default=None, alias="outputType")
    tools: str | None = None


class ResolvedAgentConfig(BaseModel):
    agent_id: str | None = Field(default=None, alias="agentId")
    agent_name: str | None = Field(default=None, alias="agentName")
    model_name: str = Field(..., alias="modelName")
    system_prompt: str = Field(..., alias="systemPrompt")
    tools: list[str] = Field(default_factory=list)
    temperature: float | None = None
    max_tokens: int | None = Field(default=None, alias="maxTokens")
    top_p: float | None = Field(default=None, alias="topP")
    frequency_penalty: float | None = Field(default=None, alias="frequencyPenalty")
    presence_penalty: float | None = Field(default=None, alias="presencePenalty")
    output_type: str | None = Field(default=None, alias="outputType")
