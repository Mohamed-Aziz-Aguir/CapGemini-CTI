from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from app.services.zeroday_service import ZeroDayService

router = APIRouter()


@router.get("/search")
async def search_zerodays(query: Optional[str] = Query(None, description="Zero-Day ID or keyword")):
    """
    Endpoint to search Zero-Day vulnerabilities.
    - If no query → return everything.
    - If query matches 'ZDI-CAN-XXXX' → exact ID search.
    - Otherwise → search in category & impact.
    """
    try:
        service = ZeroDayService()
        results = await service.search_zeroday(query=query)
        return {"count": len(results), "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
