from datetime import datetime, timezone

import vertexai
from vertexai.generative_models import Content, GenerativeModel, Part

from app.core.config import settings
from app.schemas.chat import ChatRequest, ChatResponse

_initialized = False


def _init_vertexai() -> None:
    global _initialized
    if not _initialized:
        vertexai.init(
            project=settings.google_cloud_project,
            location=settings.gemini_location,
        )
        _initialized = True


def build_history(request: ChatRequest) -> list[Content]:
    """会話履歴を Vertex AI の Content 形式に変換する"""
    contents: list[Content] = []
    for item in request.history:
        role = "user" if item.role == "user" else "model"
        contents.append(
            Content(
                role=role,
                parts=[Part.from_text(item.content)],
            )
        )
    return contents


async def generate_reply(request: ChatRequest) -> ChatResponse:
    """Gemini API を呼び出してリプライを生成する（ADC 認証）"""
    _init_vertexai()

    model = GenerativeModel(settings.gemini_model)
    history = build_history(request)

    chat = model.start_chat(history=history)
    response = chat.send_message(request.message)

    reply_text = response.text
    created_at = datetime.now(timezone.utc).isoformat()

    return ChatResponse(reply=reply_text, created_at=created_at)
