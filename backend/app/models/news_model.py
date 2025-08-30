# app/models/news_models.py
from pydantic import BaseModel
from typing import Optional

class NewsItem(BaseModel):
    title: str
    link: str
    description: Optional[str]
    pubDate: Optional[str]
    guid: Optional[str]
