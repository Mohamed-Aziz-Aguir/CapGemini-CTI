from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    elastic_host: str
    redis_host: str
    otx_api_key: str
    virustotal_api_key: str
    LILLY_SERVER_URL : str
    class Config:
        env_file = ".env"

LLAMA_SERVER_URL = "http://localhost:8080/v1/chat/completions"
LLILLY_MODEL_PATH = "/home/aziz/CTI/backend/models/lilly/lily-cybersecurity-7b-v0.2-q8_0.gguf"

settings = Settings()

