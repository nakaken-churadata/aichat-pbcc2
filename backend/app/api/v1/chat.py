from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.gemini import generate_reply

router = APIRouter()


@router.post("/message", response_model=ChatResponse)
async def send_message(
    request: ChatRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
) -> ChatResponse:
    """チャットメッセージを送信し、Gemini の応答を返す"""
    return await generate_reply(request)
