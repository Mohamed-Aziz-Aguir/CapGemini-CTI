import httpx
import asyncio
import xml.etree.ElementTree as ET
from app.core.elasticsearch_client import es
import logging

logger = logging.getLogger(__name__)

NEWS_FEED_URL = "https://upstream.auto/feed/"
INDEX_NAME = "newsupstream"


async def fetch_and_store_news():
    try:
        # Delete old index if it exists
        if await es.indices.exists(index=INDEX_NAME):
            await es.indices.delete(index=INDEX_NAME)
            logger.info(f"🗑️ Deleted old index '{INDEX_NAME}'")

        # Create a fresh index
        await es.indices.create(index=INDEX_NAME)
        logger.info(f"📦 Created new index '{INDEX_NAME}'")

        # Fetch feed
        async with httpx.AsyncClient() as client:
            response = await client.get(NEWS_FEED_URL)
            response.raise_for_status()

        root = ET.fromstring(response.text)
        channel = root.find("channel")
        items = channel.findall("item")

        # Store each news item
        for i, item in enumerate(items):
            news_doc = {
                "title": item.find("title").text,
                "link": item.find("link").text,
                "description": item.find("description").text if item.find("description") is not None else None,
                "pubDate": item.find("pubDate").text if item.find("pubDate") is not None else None,
                "guid": item.find("guid").text if item.find("guid") is not None else None,
            }

            # Use guid or fallback to counter as ID
            doc_id = news_doc["guid"] or str(i)

            await es.index(index=INDEX_NAME, id=doc_id, document=news_doc)

        logger.info(f"✅ Fetched and stored {len(items)} news items into '{INDEX_NAME}'")

    except Exception as e:
        logger.error(f"❌ Error fetching/storing news: {e}")

    finally:
        # Always close async client to avoid warnings
        await es.close()


if __name__ == "__main__":
    asyncio.run(fetch_and_store_news())
