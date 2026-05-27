from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from app.core.config import settings

security = HTTPBearer()

ALLOWED_DOMAIN = "churadata.okinawa"


def verify_google_id_token(token: str) -> dict:
    """Google の id_token を JWKS で検証し、hd クレームを確認する"""
    try:
        idinfo = google_id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            settings.google_client_id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid id_token: {e}",
        )

    hd = idinfo.get("hd")
    if hd != ALLOWED_DOMAIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Forbidden domain: {hd}",
        )

    return idinfo


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> dict:
    """依存性注入で現在のユーザー情報を取得する"""
    return verify_google_id_token(credentials.credentials)
