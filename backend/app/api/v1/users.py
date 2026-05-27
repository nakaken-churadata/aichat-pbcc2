from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.schemas.users import UserResponse

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: Annotated[dict, Depends(get_current_user)],
) -> UserResponse:
    """ログイン中のユーザー情報を返す"""
    return UserResponse(
        email=current_user.get("email", ""),
        name=current_user.get("name", ""),
        picture=current_user.get("picture"),
    )
