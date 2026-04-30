from fastapi import FastAPI

from app.api.v1.chat import router as chat_router
from app.core.settings import get_settings

settings = get_settings()

app = FastAPI(title=settings.app_name, version=settings.app_version)
app.include_router(chat_router)
