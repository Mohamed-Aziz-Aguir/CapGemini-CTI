from fastapi import APIRouter, Query
from app.services.cve_service import CVEService

router = APIRouter()

cve_service = CVEService()  # instantiate once

@router.get("/all")
async def search_or_browse(
    q: str = Query("", description="CVE or keyword search"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100)
):
    if q:
        # search for exact CVE or keyword
        result = await cve_service.search(q, page=page, page_size=page_size)
        return result
    else:
        # browse all CVEs
        result = await cve_service.get_all_cves(page=page, page_size=page_size)
        return result
