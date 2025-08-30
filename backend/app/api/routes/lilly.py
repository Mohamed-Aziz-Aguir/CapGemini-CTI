# app/api/routes/lilly.py
from fastapi import APIRouter, Query, Body, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from app.services.lilly_service import LillyService

# Router without inner prefix; main mounts it at /api/lilly
router = APIRouter(tags=["Lilly"])

@router.post("/chat")
async def chat_lilly(
    message: str = Body(..., embed=True),
    stream: bool = Query(True, description="Stream response if True")
):
    try:
        if stream:
            gen = await LillyService.chat(message, stream=True)
            return StreamingResponse(gen, media_type="text/plain; charset=utf-8")
        else:
            answer = await LillyService.chat(message, stream=False)
            return JSONResponse({"answer": answer})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/enrich_cve")
async def enrich_cve(
    cve_id: str = Body(..., embed=True),
    cve_description: str = Body(..., embed=True),
    stream: bool = Query(False)
):
    try:
        if stream:
            gen = await LillyService.enrich_cve(cve_id, cve_description, stream=True)
            return StreamingResponse(gen, media_type="text/plain; charset=utf-8")
        else:
            answer = await LillyService.enrich_cve(cve_id, cve_description, stream=False)
            return JSONResponse({"answer": answer})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/simplify_cve")
async def simplify_cve(
    cve_id: str = Body(..., embed=True),
    cve_description: str = Body(..., embed=True),
    stream: bool = Query(False)
):
    try:
        if stream:
            gen = await LillyService.explain_cve_for_nonexpert(cve_id, cve_description, stream=True)
            return StreamingResponse(gen, media_type="text/plain; charset=utf-8")
        else:
            answer = await LillyService.explain_cve_for_nonexpert(cve_id, cve_description, stream=False)
            return JSONResponse({"answer": answer})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/clear")
async def clear_chat():
    LillyService.clear_chat()
    return {"status": "success", "message": "Chat memory cleared."}
