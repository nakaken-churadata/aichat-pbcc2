from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router
from app.core.config import settings

app = FastAPI(
    title="社内 AI チャット API",
    description="@churadata.okinawa ドメイン限定の Gemini チャット API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/api/v1/health", tags=["health"])
async def health_check() -> dict:
    return {"status": "ok"}
