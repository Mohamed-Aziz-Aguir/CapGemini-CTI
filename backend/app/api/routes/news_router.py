from fastapi import APIRouter
from app.services.news_service import get_all_news
from app.models.news_model import NewsItem

router = APIRouter()

@router.get("/", response_model=list[NewsItem])
async def list_news():
    return await get_all_news()
