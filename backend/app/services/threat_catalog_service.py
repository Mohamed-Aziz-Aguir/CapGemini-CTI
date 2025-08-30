from typing import List, Dict
from app.core.elasticsearch_client import es  # should be AsyncElasticsearch

class ThreatCatalogService:
    def __init__(self):
        self.valid_categories = [
            "execution", "privilege_escalation", "lateral_movement",
            "exfiltration", "credential_access", "collection",
            "repudiation", "denial_of_service", "spoofing",
            "affect_vehicle_function", "information_disclosure",
            "defense_evasion", "command_and_control", "discovery",
            "initial_access", "persistence", "elevation_of_privilege",
            "tampering", "manipulate_environment",
        ]

    async def search(self, category: str, keyword: str) -> List[Dict]:
        if category not in self.valid_categories:
            raise ValueError("Invalid category name")

        query = {
            "multi_match": {
                "query": keyword,
                "fields": ["title", "description", "mitigation"],
            }
        }

        resp = await es.search(index=category, query=query)
        return [hit["_source"] for hit in resp["hits"]["hits"]]
