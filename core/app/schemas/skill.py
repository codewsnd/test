from pydantic import BaseModel, ConfigDict, Field


class SkillItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    description: str = ""
    content: str = Field(..., min_length=1)
    trigger_keywords: list[str] = Field(default_factory=list, alias="triggerKeywords")
    tool_names: list[str] = Field(default_factory=list, alias="toolNames")
    tags: list[str] = Field(default_factory=list)
    source: str = "Core registry"
    version: str = "1.0.0"
    author: str = "Core Team"
    install_count: int = Field(default=0, alias="installCount")
    trust_level: str = Field(default="reviewed", alias="trustLevel")
    homepage_url: str | None = Field(default=None, alias="homepageUrl")
    enabled: bool = True


class SkillAppliedItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: str
    description: str = ""
    reason: str = ""
    tool_names: list[str] = Field(default_factory=list, alias="toolNames")


class SkillAppliedEvent(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    skills: list[SkillAppliedItem] = Field(default_factory=list)
