from fastapi import APIRouter

from app.api.v1 import chat, users

router = APIRouter(prefix="/api/v1")

router.include_router(chat.router, prefix="/chat", tags=["chat"])
router.include_router(users.router, prefix="/users", tags=["users"])
