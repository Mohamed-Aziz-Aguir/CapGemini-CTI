# app/main.py
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import ioc, search, lilly, zeroday_router, threat_catalog, news_router

app = FastAPI(title="Cyber Threat Intelligence Dashboard")

# CORS for frontend (adjust origin in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(news_router.router, prefix="/news", tags=["News"])
app.include_router(ioc.router, prefix="/api/ioc", tags=["IOC"])
app.include_router(lilly.router, prefix="/api/lilly", tags=["Lilly"])
app.include_router(zeroday_router.router, prefix="/zeroday", tags=["Zero-Day"])
app.include_router(threat_catalog.router, prefix="/threat-catalog", tags=["Threat Catalog"])
app.include_router(search.router, prefix="/api/search", tags=["Search & Browse"])

# Serve static HTML/js
app.mount("/static", StaticFiles(directory="app/static"), name="static")
