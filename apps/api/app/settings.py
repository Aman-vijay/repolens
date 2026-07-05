from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# settings.py is at: repolens/apps/api/app/settings.py
# .parent              → repolens/apps/api/app/
# .parent.parent       → repolens/apps/api/
# .parent.parent.parent → repolens/apps/
# .parent×4            → repolens/           ← workspace root
root_env = Path(__file__).resolve().parent.parent.parent.parent / ".env"
app_env = Path(__file__).resolve().parent.parent / ".env"

if root_env.exists():
    load_dotenv(root_env)
if app_env.exists():
    load_dotenv(app_env)


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
