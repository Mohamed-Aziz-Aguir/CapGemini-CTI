import requests
import json
import time
from typing import List, Dict, Any
from fastapi import HTTPException
import asyncio
from app.core.elasticsearch_client import es  # async ES client


class ASRGVulnerabilityService:
    @staticmethod
    def fetch_all_vulnerabilities(search_term: str) -> List[Dict[str, Any]]:
        """Fetch vulnerabilities (unchanged, sync)."""
        base_url = "https://api.asrg.io"
        all_vulnerabilities = []
        cursor = ""
        page_count = 0
        headers = {
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Origin": "https://asrg.io",
            "Referer": "https://asrg.io/",
        }

        while True:
            params = {"search": search_term, "cursor": cursor, "sort": "-created"}
            url = f"{base_url}/vulnerabilities"

            try:
                print(f"Fetching page {page_count + 1}...")
                response = requests.get(url, headers=headers, params=params)
                response.raise_for_status()
                data = response.json()

                vulnerabilities = data.get("vulnerabilities", [])
                page_info = data.get("pageInfo", {})
                all_vulnerabilities.extend(vulnerabilities)
                page_count += 1

                has_next_page = page_info.get("hasNextPage", False)
                if not has_next_page:
                    break
                cursor = page_info.get("endCursor", "")
                if not cursor:
                    break
                time.sleep(0.5)

            except requests.exceptions.RequestException as e:
                raise HTTPException(status_code=500, detail=f"API request failed: {str(e)}")
            except json.JSONDecodeError:
                raise HTTPException(status_code=500, detail="Invalid API response format")

        return all_vulnerabilities

    @staticmethod
    async def _index_vulnerabilities_async(index_name: str, vulnerabilities: List[Dict[str, Any]]) -> int:
        """Async ES indexing."""
        if await es.indices.exists(index=index_name):
            await es.indices.delete(index=index_name)
            print(f"Deleted existing index: {index_name}")

        success_count = 0
        for vuln in vulnerabilities:
            doc = {
                **vuln,
                "search_term": index_name.replace("asrg-", ""),
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            }
            try:
                await es.index(index=index_name, document=doc)
                success_count += 1
            except Exception as e:
                print(f"Error indexing document {vuln.get('name')}: {e}")

        await es.indices.refresh(index=index_name)
        return success_count

    @classmethod
    def index_vulnerabilities(cls, search_term: str, vulnerabilities: List[Dict[str, Any]]) -> Dict:
        """Wrap async ES calls to run synchronously."""
        if not vulnerabilities:
            return {"status": "error", "message": "No vulnerabilities to index"}

        index_name = f"asrg-{search_term.lower()}"
        try:
            success_count = asyncio.run(cls._index_vulnerabilities_async(index_name, vulnerabilities))
            return {
                "status": "success",
                "index": index_name,
                "documents_indexed": success_count,
                "total_documents": len(vulnerabilities),
                "message": f"Successfully indexed {success_count} vulnerabilities"
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Elasticsearch error: {str(e)}")

    @classmethod
    def fetch_and_index(cls, search_term: str) -> Dict:
        """Main method (mostly unchanged)."""
        print(f"\nStarting vulnerability collection for: {search_term}")

        try:
            vulnerabilities = cls.fetch_all_vulnerabilities(search_term)
            if not vulnerabilities:
                return {
                    "status": "success",
                    "message": "No vulnerabilities found",
                    "index": f"asrg-{search_term.lower()}",
                    "documents_indexed": 0
                }

            raw_file = f"/tmp/{search_term}_raw.jsonl"
            with open(raw_file, "w", encoding="utf-8") as f:
                for vuln in vulnerabilities:
                    f.write(json.dumps(vuln) + "\n")
            print(f"Saved raw data to {raw_file}")

            filtered_vulnerabilities = [
                vuln for vuln in vulnerabilities
                if vuln.get("relevance", False) or vuln.get("_source", {}).get("relevance", False)
            ]
            print(f"Filtered {len(filtered_vulnerabilities)}/{len(vulnerabilities)} as relevant")

            filtered_file = f"/tmp/{search_term}_filtered.jsonl"
            with open(filtered_file, "w", encoding="utf-8") as f:
                for vuln in filtered_vulnerabilities:
                    f.write(json.dumps(vuln) + "\n")
            print(f"Saved filtered data to {filtered_file}")

            # **Async ES call wrapped via asyncio.run()**
            index_result = cls.index_vulnerabilities(search_term, filtered_vulnerabilities)

            severity_counts = {}
            for vuln in filtered_vulnerabilities:
                severity = vuln.get("cvss", {}).get("baseSeverity", "unknown")
                severity_counts[severity] = severity_counts.get(severity, 0) + 1

            return {
                "status": "success",
                "index": index_result["index"],
                "documents_indexed": len(filtered_vulnerabilities),
                "total_in_api": len(vulnerabilities),
                "severity_counts": severity_counts,
                "latest_cves": [v["name"] for v in filtered_vulnerabilities[:3]]
            }

        except Exception as e:
            return {
                "status": "error",
                "message": str(e),
                "index": f"asrg-{search_term.lower()}"
            }

