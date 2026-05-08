from fastapi import APIRouter, Query

from app.core.settings import get_settings
from app.schemas.skill import SkillItem
from app.services.skill_catalog import SkillCatalogService

router = APIRouter(tags=["skills"])
settings = get_settings()
skill_catalog_service = SkillCatalogService(settings)


@router.get("/api/v1/skills", response_model=list[SkillItem])
@router.get(
    "/aether/api/v1/skills",
    response_model=list[SkillItem],
    include_in_schema=False,
)
async def get_skills(
    use_cache: bool = Query(default=True, alias="usecache"),
) -> list[SkillItem]:
    return skill_catalog_service.list_skills(use_cache=use_cache)
