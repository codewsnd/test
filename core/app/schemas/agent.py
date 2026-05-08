from pydantic import BaseModel, Field


class StoredAgentPayload(BaseModel):
    id: int
    name: str
    model_name: str | None = None
    system_prompt: str | None = None
    temperature: float | None = None
    max_tokens: int | None = None
    top_p: float | None = None
    frequency_penalty: float | None = None
    presence_penalty: float | None = None
    output_type: str | None = None
    tools: str | None = None
    template_schemas: str | None = None


class ResolvedAgentConfig(BaseModel):
    agent_id: str | None = Field(default=None, alias="agentId")
    agent_name: str | None = Field(default=None, alias="agentName")
    model_name: str = Field(..., alias="modelName")
    system_prompt: str = Field(..., alias="systemPrompt")
    tools: list[str] = Field(default_factory=list)
    skill_ids: list[str] = Field(default_factory=list, alias="skillIds")
    temperature: float | None = None
    max_tokens: int | None = Field(default=None, alias="maxTokens")
    top_p: float | None = Field(default=None, alias="topP")
    frequency_penalty: float | None = Field(default=None, alias="frequencyPenalty")
    presence_penalty: float | None = Field(default=None, alias="presencePenalty")
    output_type: str | None = Field(default=None, alias="outputType")
