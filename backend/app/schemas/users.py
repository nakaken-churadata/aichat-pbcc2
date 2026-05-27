from pydantic import BaseModel


class UserResponse(BaseModel):
    email: str
    name: str
    picture: str | None = None
