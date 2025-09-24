import asyncio
from playwright.async_api import async_playwright
from app.core.elasticsearch_client import es
import json

INDEX_NAME = "zeroday"


async def scrape_vicone_data():
    all_data = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        await page.goto("https://vicone.com/automotive-zero-day-vulnerabilities", timeout=60000)
        await page.wait_for_selector("table")

        try:
            await page.wait_for_selector("#dt-length-0", state="visible", timeout=10000)
            await page.select_option("#dt-length-0", value="100")
            await page.wait_for_selector("table tbody tr", state="visible", timeout=5000)
        except Exception as e:
            print(f"Failed to set entries per page to 100: {e}")

        print("Scraping data...")
        rows = await page.query_selector_all("table tbody tr")

        for row in rows:
            cols = await row.query_selector_all("td")
            if len(cols) == 4:
                item = {
                    "zero_day_id": (await cols[0].inner_text()).strip(),
                    "cve": (await cols[1].inner_text()).strip(),
                    "category": (await cols[2].inner_text()).strip(),
                    "impact": (await cols[3].inner_text()).strip()
                }
                all_data.append(item)

        await browser.close()
    return all_data


async def index_to_es(data):
    # Delete old index
    if await es.indices.exists(index=INDEX_NAME):
        await es.indices.delete(index=INDEX_NAME)

    await es.indices.create(
        index=INDEX_NAME,
        body={
            "mappings": {
                "properties": {
                    "zero_day_id": {"type": "keyword"},
                    "cve": {"type": "keyword"},
                    "category": {"type": "text"},
                    "impact": {"type": "text"}
                }
            }
        }
    )

    for item in data:
        await es.index(index=INDEX_NAME, document=item)


async def main():
    data = await scrape_vicone_data()
    print(f"Scraped {len(data)} records")
    await index_to_es(data)
    print(f"Indexed {len(data)} records into '{INDEX_NAME}'")
    await es.close()



if __name__ == "__main__":
    asyncio.run(main())
