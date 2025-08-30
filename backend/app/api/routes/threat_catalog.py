from fastapi import APIRouter, Query, HTTPException
from typing import List, Dict
from app.core.elasticsearch_client import es  # AsyncElasticsearch

router = APIRouter()

# Allowed categories (indices)
VALID_CATEGORIES = {
    "execution",
    "privilege_escalation",
    "lateral_movement",
    "initial_access",
    "collection",
    "command_and_control",
    "defense_ecasion",   # typo kept because it exists in ES
    "credential_access",
    "discovery",
    "persistence",
    "tampering",
    "exfiltration",
    "spoofing",
    "information_disclosure",
    "repudiation",
    "manipulate_environment"
}

@router.get("/get")
async def get_threat_catalog(
    category: str = Query(..., description="Threat category (index name, case-insensitive)")
) -> List[Dict]:
    """
    Get the entire threat catalog for a given category (index).
    Returns [] if the index doesn't exist.
    """
    try:
        index_name = category.lower()

        if index_name not in VALID_CATEGORIES:
            raise HTTPException(status_code=400, detail=f"Invalid category: {category}")

        # check if index exists
        if not await es.indices.exists(index=index_name):
            return []  # ✅ return empty list instead of 500

        body = {
            "query": {"match_all": {}},
            "size": 10000
        }

        response = await es.search(index=index_name, body=body)
        return [hit["_source"] for hit in response["hits"]["hits"]]

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
