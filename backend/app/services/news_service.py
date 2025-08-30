from app.core.elasticsearch_client import es
from app.models.news_model import NewsItem

INDEX_NAME = "newsupstream"


async def get_all_news() -> list[NewsItem]:
    query = {
        "query": {"match_all": {}},
        "sort": [{"pubDate.keyword": {"order": "desc"}}],  # use keyword to sort
        "size": 50
    }

    results = await es.search(
        index=INDEX_NAME,
        query=query["query"],
        sort=query["sort"],
        size=query["size"]
    )

    news_list = [
        NewsItem(**hit["_source"]) for hit in results["hits"]["hits"]
    ]
    return news_list
