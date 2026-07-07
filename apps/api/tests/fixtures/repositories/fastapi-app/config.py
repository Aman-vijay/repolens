"""Configuration settings."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "FastAPI App"
    database_url: str = "sqlite:///./app.db"
    debug: bool = False

    class Config:
        env_file = ".env"


settings = Settings()
