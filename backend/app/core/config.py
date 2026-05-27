from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    google_client_id: str
    google_cloud_project: str
    allowed_origins: str = "http://localhost:3000"
    gemini_location: str = "us-central1"
    gemini_model: str = "gemini-1.5-pro"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",")]

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
