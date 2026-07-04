from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


class Settings(BaseSettings):
    clerk_secret_key: str = ""
    clerk_webhook_secret: str = ""
    frontend_url: str = "http://localhost:3000"
    superadmin_clerk_user_id: str = ""
    redis_url: str = ""

    @property
    def cors_origins(self) -> list[str]:
        origins = {
            self.frontend_url.rstrip("/"),
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        }
        return sorted(origin for origin in origins if origin)


@lru_cache
def get_settings() -> Settings:
    return Settings()
