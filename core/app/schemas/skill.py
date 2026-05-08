from pydantic import BaseModel, ConfigDict, Field


class SkillItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    description: str = ""
    when_to_use: str = Field(default="", alias="whenToUse")
    content: str = Field(..., min_length=1)
    command_name: str = Field(default="", alias="commandName")
    trigger_keywords: list[str] = Field(default_factory=list, alias="triggerKeywords")
    tool_names: list[str] = Field(default_factory=list, alias="toolNames")
    allowed_tools: list[str] = Field(default_factory=list, alias="allowedTools")
    argument_hint: str = Field(default="", alias="argumentHint")
    arguments: list[str] = Field(default_factory=list)
    disable_model_invocation: bool = Field(default=False, alias="disableModelInvocation")
    user_invocable: bool = Field(default=True, alias="userInvocable")
    model: str | None = None
    effort: str | None = None
    context: str | None = None
    agent: str | None = None
    paths: list[str] = Field(default_factory=list)
    shell: str | None = None
    tags: list[str] = Field(default_factory=list)
    source: str = "Core registry"
    source_path: str | None = Field(default=None, alias="sourcePath")
    resource_files: list[str] = Field(default_factory=list, alias="resourceFiles")
    version: str = "1.0.0"
    author: str = "Core Team"
    install_count: int = Field(default=0, alias="installCount")
    trust_level: str = Field(default="reviewed", alias="trustLevel")
    homepage_url: str | None = Field(default=None, alias="homepageUrl")
    claude_code_compatible: bool = Field(default=True, alias="claudeCodeCompatible")
    enabled: bool = True


class SkillAppliedItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: str
    description: str = ""
    reason: str = ""
    arguments: str = ""
    command_name: str = Field(default="", alias="commandName")
    tool_names: list[str] = Field(default_factory=list, alias="toolNames")
    allowed_tools: list[str] = Field(default_factory=list, alias="allowedTools")


class SkillAppliedEvent(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    skills: list[SkillAppliedItem] = Field(default_factory=list)
