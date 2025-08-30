import re
from typing import List, Dict, Optional
from app.core.elasticsearch_client import es


class ZeroDayService:
    def __init__(self, index_name: str = "zeroday"):
        self.index_name = index_name

    async def search_zeroday(self, query: Optional[str]) -> List[Dict]:
        """
        Search Zero-Day vulnerabilities.
        - If no query → return everything.
        - If query matches ZDI-CAN format → exact ID search.
        - Otherwise → keyword search in category & impact.
        """
        if not query:
            body = {
                "query": {"match_all": {}},
                "size": 100
            }
        else:
            must_clauses = []

            # Exact ZDI-CAN ID search
            if re.fullmatch(r"ZDI-CAN-\d+", query):
                must_clauses.append({"match": {"zero_day_id": query}})
            else:
                # Generic keyword search
                must_clauses.append({
                    "multi_match": {
                        "query": query,
                        "fields": ["category", "impact"],
                        "operator": "and"
                    }
                })

            body = {
                "query": {"bool": {"must": must_clauses}},
                "size": 100
            }

        response = await es.search(index=self.index_name, body=body)
        return [hit["_source"] for hit in response["hits"]["hits"]]
