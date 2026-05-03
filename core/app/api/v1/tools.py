from fastapi import APIRouter, HTTPException, Query, status

from app.core.settings import get_settings
from app.schemas.tool import GetAllToolsApiItem
from app.services.tool_catalog import ToolCatalogService

router = APIRouter(tags=["tools"])
settings = get_settings()
tool_catalog_service = ToolCatalogService(settings)


@router.get("/api/v1/mcp/tools", response_model=list[GetAllToolsApiItem])
@router.get(
    "/aether/api/v1/mcp/tools",
    response_model=list[GetAllToolsApiItem],
    include_in_schema=False,
)
async def get_mcp_tools(
    use_cache: bool = Query(default=True, alias="usecache"),
) -> list[GetAllToolsApiItem]:
    try:
        return await tool_catalog_service.list_tools(use_cache=use_cache)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to list MCP tools: {exc}",
        ) from exc
