from playwright.sync_api import sync_playwright
from app.core.elasticsearch_client import es
import json

INDEX_NAME = "zeroday"

def scrape_vicone_zerodays():
    all_data = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.goto("https://vicone.com/automotive-zero-day-vulnerabilities", timeout=60000)
        page.wait_for_selector("table")

        # Set entries per page to 100
        try:
            page.wait_for_selector("#dt-length-0", state="visible", timeout=10000)
            page.select_option("#dt-length-0", value="100")
            page.wait_for_selector("table tbody tr", state="visible", timeout=5000)
        except Exception as e:
            print(f"Failed to set entries per page to 100: {e}")

        print("Scraping data...")
        page.wait_for_selector("table tbody tr", state="visible")
        rows = page.query_selector_all("table tbody tr")

        for row in rows:
            cols = row.query_selector_all("td")
            if len(cols) == 4:
                item = {
                    "zero_day_id": cols[0].inner_text().strip(),
                    "cve": cols[1].inner_text().strip(),
                    "category": cols[2].inner_text().strip(),
                    "impact": cols[3].inner_text().strip()
                }
                all_data.append(item)

        browser.close()

    # Save backup locally
    with open("vicone_zero_day_vulns.json", "w", encoding="utf-8") as f:
        json.dump(all_data, f, indent=2, ensure_ascii=False)

    # Delete old index
    print(f"Deleting old index '{INDEX_NAME}' (if exists)...")
    if es.indices.exists(index=INDEX_NAME):
        es.indices.delete(index=INDEX_NAME)

    # Create new index
    print(f"Creating new index '{INDEX_NAME}'...")
    es.indices.create(
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

    # Insert fresh data
    print("Indexing new data...")
    for item in all_data:
        es.index(index=INDEX_NAME, document=item)

    print(f"Scraped and indexed {len(all_data)} entries into Elasticsearch index '{INDEX_NAME}'.")

if __name__ == "__main__":
    scrape_vicone_zerodays()
