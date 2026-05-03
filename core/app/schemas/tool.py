from pydantic import BaseModel, Field


class GetAllToolsApiParameter(BaseModel):
    param_name: str = Field(..., min_length=1)
    param_description: str = ""
    required: bool = False


class GetAllToolsApiItem(BaseModel):
    tool_name: str = Field(..., min_length=1)
    tool_display_name: str = Field(..., min_length=1)
    mcp_server_name: str = Field(..., min_length=1)
    tool_full_name: str = Field(..., min_length=1)
    tool_category: str = Field(..., min_length=1)
    tool_description: str = ""
    tag: list[str] = Field(default_factory=list)
    parameters: list[GetAllToolsApiParameter] = Field(default_factory=list)
    provider: str | None = None
    icon: str | None = None
    is_hidden_in_tool: bool = False
