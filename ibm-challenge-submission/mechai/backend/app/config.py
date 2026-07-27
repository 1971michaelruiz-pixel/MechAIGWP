"""Application settings loaded from environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ── Database ──────────────────────────────────────────────────────────────
    database_url: str = "postgresql://mechai:mechai@localhost:5432/mechai"

    # ── Supabase / Auth ───────────────────────────────────────────────────────
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_jwt_secret: str = ""

    # ── OpenAI / Whisper ──────────────────────────────────────────────────────
    openai_api_key: str = ""
    whisper_model: str = "whisper-1"

    # ── Repair data providers ─────────────────────────────────────────────────
    nhtsa_tsb_api_url: str = "https://api.nhtsa.gov/complaints/complaintsByVehicle"
    default_repair_provider: str = "nhtsa"

    # ── App ───────────────────────────────────────────────────────────────────
    app_env: str = "development"
    log_level: str = "info"


settings = Settings()
