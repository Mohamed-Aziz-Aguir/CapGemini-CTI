Cyber Threat Intelligence Dashboard (CTI)

Authors: Mohamed Aziz Aguir & Yahya Kaddour
Organization / Company: Capgemini (project work)
University: ESPRIT
Supervisor: Mohamed Amine Boussaid
Repository: https://github.com/Mohamed-Aziz-Aguir/CapGemini-CTI

Primary contact: Mohamed Aziz Aguir — mohamedaziz.aguir@outlook.com — +216 93 236 576
(Add Yahya Kaddour contact details to the repo CONTRIBUTORS file if desired.)

Project timeline: Start: 2025-06-23 — End: (today / ongoing)

Table of Contents

Project Overview

Tech stack & Versions

Repository layout

Quick Start — one-shot bootstrap (Ubuntu)

Manual Setup (detailed)

Backend — config & endpoints

Frontend — config & fixes

Elasticsearch indices & data model

Optional: Local LLM (Lilly) using llama.cpp (instructions)

Dev scripts & convenience commands

Architecture diagrams (Mermaid)

Troubleshooting & FAQ

Credits & External Resources

License & Next steps

Project overview

This project is a full-stack Cyber Threat Intelligence (CTI) Dashboard built as a Capgemini school/industry project (ESPRIT). It provides:

IOC analysis (caching + third-party lookups)

Zero-day browsing and keyword search

Threat catalog browsing per ATT&CK-like categories (each category stored in Elasticsearch)

CVE search and browsing with pagination

Optional local LLM (Lilly) integration built on llama.cpp and a GGUF model

Frontend UI built with Next.js (React), styled with TailwindCSS, animations via Framer Motion

Tech stack & versions

Primary tech used in the project:

Python — 3.13

FastAPI — 0.116.1

Uvicorn — latest compatible (0.23.x)

Elasticsearch — 8.13.0 (Docker image used)

Redis — (Redis 7.x container; Python client redis==5.0.4)

llama_cpp_python — 0.3.16 (optional, for local LLM bindings)

Frontend — Next.js (React), TailwindCSS, Framer Motion, Axios

OS — Ubuntu (development & server)

All external resources and third-party projects must be used according to their licenses. See the Credits section for links.

Repository layout (recommended)
/backend
  /app
    main.py
    /api
      ioc.py
      zeroday.py
      threat_catalog.py
      search.py
      lilly.py
      news.py
    /services
      zeroday_service.py
      cve_service.py
      otx_service.py
      virustotal_service.py
      lilly_service.py
    /core
      elasticsearch_client.py
      config.py
  requirements.txt
  setup_backend_fixed.sh  # bootstrap helper (optional)
  docker-compose.yml
  .env.example
/frontend
  /components
  /pages or /app
  lib/api.ts
  package.json
  tailwind.config.js
README.md
LICENSE

Quick Start — one-shot bootstrap (Ubuntu)

A bootstrap script setup_backend_fixed.sh (included in /backend) automates most setup steps: Docker (Elasticsearch & Redis), Python venv, pip dependencies, .env creation, and starting uvicorn.

From backend/ directory:

# Make sure to be inside backend/ folder
cd backend

# Single-shot bootstrap (creates docker-compose, starts ES & Redis, creates venv, installs deps, starts uvicorn):
bash setup_backend_fixed.sh

# Optional: clone & build llama.cpp (no model download)
bash setup_backend_fixed.sh with-lilly


What the script does

Installs Docker if missing (Ubuntu/Debian).

Creates docker-compose.yml for Elasticsearch 8.13.0 and Redis.

Starts containers.

Creates a Python virtualenv in .venv and installs pinned dependencies from requirements.txt.

Generates a .env file with safe defaults.

Starts uvicorn (backend) in background and writes uvicorn.pid for convenience.

(Optional) clones and builds llama.cpp if with-lilly is passed.

If you prefer manual setup, see the manual setup section below.

Manual Setup (detailed)
1. Docker (Elasticsearch + Redis)

Create backend/docker-compose.yml (or use the provided) to run ES & Redis:

version: "3.8"
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.13.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    ports:
      - "9200:9200"
    volumes:
      - esdata:/usr/share/elasticsearch/data
    healthcheck:
      test: ["CMD-SHELL", "curl -sSf http://localhost:9200/ || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  esdata:


Start:

docker compose up -d
# wait until Elasticsearch healthy:
curl -sSf http://localhost:9200/

2. Python virtualenv & dependencies
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt


Suggested requirements.txt

fastapi==0.116.1
uvicorn[standard]==0.23.2
elasticsearch[async]==8.13.0
httpx==0.24.1
aiohttp==3.8.4
redis==5.0.4
python-dotenv==1.0.0
pydantic==1.10.11
# optional:
# llama_cpp_python==0.3.16

3. Environment variables

Create .env (or copy .env.example) inside backend/:

APP_ENV=development
DEBUG=true
HOST=0.0.0.0
PORT=8000

ES_HOST=http://localhost:9200
ES_USERNAME=
ES_PASSWORD=

REDIS_URL=redis://localhost:6379/0

VT_API_KEY=
OTX_API_KEY=

LILLY_SERVER_URL=http://localhost:8080

PROJECT_AUTHORS="Mohamed Aziz Aguir & Yahya Kaddour"
PROJECT_CONTACT="mohamedaziz.aguir@outlook.com"
PROJECT_SUPERVISOR="Mohamed Amine Boussaid"

4. Start Backend (development)

Activate venv and run:

source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload


Open API docs: http://localhost:8000/docs

5. Frontend (development)

From /frontend:

# if you use npm
npm install
npm run dev

# or with pnpm
pnpm install
pnpm dev


Open http://localhost:3000 (or your Next.js dev port).

Backend — configuration & endpoints

Key routers are included in app/main.py:

app.include_router(news_router.router, prefix="/news", tags=["News"])
app.include_router(ioc.router, prefix="/api/ioc", tags=["IOC"])
app.include_router(lilly.router, prefix="/api/lilly", tags=["Lilly"])
app.include_router(zeroday_router.router, prefix="/zeroday", tags=["Zero-Day"])
app.include_router(threat_catalog.router, prefix="/threat-catalog", tags=["Threat Catalog"])
app.include_router(search.router, prefix="/api/search", tags=["Search & Browse"])

Important endpoints

POST /api/ioc/analyze — Body: { "value": "github.com" }
Returns: { ioc, otx, virustotal } — ES cache first, fallback to external APIs.

GET /zeroday/search?query=<keyword or ZDI-CAN-####>
If query omitted or empty — returns all zero-days (backend service supports optional query).
Response structure: { "count": <n>, "results": [ { zero_day_id, cve, category, impact }, ... ] }

GET /threat-catalog/get?category=<index>
category must match ES index name (case-insensitive mapping done in route). Example: category=execution

GET /api/search/all?q=<query>&page=1&page_size=10
CVE search with pagination (returns results and pagination metadata).

POST /api/lilly/chat — Chat to local Lilly (if set up) — implement as required on server side.

Frontend — recommended fixes & lib/api.ts (important)

IMPORTANT: The Zero-Day backend expects parameter name query. Ensure frontend calls use params: { query: <value> } when hitting /zeroday/search.

Copy/paste this lib/api.ts into /frontend/lib/api.ts:

// /frontend/lib/api.ts
import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export async function getNews(limit = 10) {
  const res = await axios.get(`${API_BASE}/news/`, { params: { limit } });
  return res.data;
}

export async function analyzeIoc(ioc: string) {
  const res = await axios.post(`${API_BASE}/api/ioc/analyze`, { value: ioc });
  return res.data;
}

// Backend expects `query` param for zero-day
export async function searchZeroDay(q: string) {
  const res = await axios.get(`${API_BASE}/zeroday/search`, { params: { query: q } });
  return res.data;
}

export async function getThreatCatalog(category: string) {
  const res = await axios.get(`${API_BASE}/threat-catalog/get`, { params: { category } });
  return res.data;
}

export async function searchAll(q: string, page = 1, page_size = 10) {
  const res = await axios.get(`${API_BASE}/api/search/all`, {
    params: { q, page, page_size },
  });
  return res.data;
}

export default {
  getNews,
  analyzeIoc,
  searchZeroDay,
  getThreatCatalog,
  searchAll,
};


Zero-Day frontend behavior

To list all zero-days, call searchZeroDay("") (backend service supports empty query and will return all docs).

To search by keyword (e.g. electric), call searchZeroDay("electric").

To search by ID (e.g. ZDI-CAN-26359), call searchZeroDay("ZDI-CAN-26359").

Common bug: If frontend receives { count: 96, results: [...] }, ensure code uses response.data.results when mapping to UI items.

Elasticsearch indices & data model

Indices used (exact names are the ones found in your ES cluster; some contain typos that are preserved here):

execution

privilege_escalation

lateral_movement

initial_access

collection

command_and_control

defense_ecasion (typo preserved)

credential_access

discovery

persistence

tampering

exfiltration

spoofing

information_disclosure

repudiation

manipulate_environment

zeroday

asrg-cve

otx-iocs

vt-iocs

newsupstream (if present)

Zero-day index sample document (from your data):

{
  "zero_day_id": "ZDI-CAN-26359",
  "cve": "Not yet assigned",
  "category": "Electric Vehicle Chargers",
  "impact": "Bypass authentication on the system."
}


Threat-catalog sample document (top-level):

{
  "ThreatName": "Persistence",
  "ThreatID": "T.P.001",
  "SubThreats": [
    {
      "ThreatName": "Abuse UDS For Persistence",
      "ThreatID": "T.P.002",
      "AttackFeasibilityLevel": "HIGH",
      "FeasibilityRating": {
        "ET": { "description": "..." },
        "SE": { "description": "..." },
        "KoIC": { "description": "..." }
      },
      "Description": "...",
      "RefineThreatClass": "T.P.001, Persistence",
      "SecurityProperties": { "Confidentiality": true, "Integrity": true },
      "ActsOn": ""
    }
  ]
}

Optional: Local LLM (Lilly) with llama.cpp

Model: Nekuromento/Lily-Cybersecurity-7B-v0.2-Q8_0-GGUF (Hugging Face).
Note: Model download is manual — follow Hugging Face rules and authentication.

Steps (short summary):

Clone llama.cpp:

git clone https://github.com/ggerganov/llama.cpp.git
cd llama.cpp
LLAMA_CURL=1 make


Download the GGUF model file from Hugging Face (requires permission/accepting license) and place it at:

backend/models/lilly/lily-cybersecurity-7b-v0.2-q8_0.gguf


Run the llama-server:

cd backend/models/llama.cpp/build/bin
./llama-server \
  -m ~/CTI/backend/models/lilly/lily-cybersecurity-7b-v0.2-q8_0.gguf \
  --host 0.0.0.0 \
  --port 8080 \
  --ctx-size 4096 \
  --n-gpu-layers 0


Configure backend .env:

LILLY_SERVER_URL=http://localhost:8080


Backend lilly route should POST to local server for generation. See app/services/lilly_service.py for details.

Dev scripts & convenience commands

Start Elasticsearch & Redis:

docker compose up -d


Stop:

docker compose down


Start backend (dev):

source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000


Show uvicorn logs (if script started uvicorn in background):

tail -f uvicorn.log


Recreate venv & install:

rm -rf .venv
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

Architecture diagrams (Mermaid)

You can paste these Mermaid diagrams in GitHub markdown (GitHub supports Mermaid in markdown):

High-level diagram

graph TD
  Browser[User Browser] -->|REST / WebSocket| Frontend[Frontend (Next.js)]
  Frontend -->|REST| Backend[Backend (FastAPI)]
  Backend -->|Elasticsearch queries| ES[Elasticsearch 8.13]
  Backend -->|Cache| Redis[Redis]
  Backend -->|OTX/VT HTTP| External[External APIs (OTX, VirusTotal)]
  Backend -->|LLM API| Lilly[Lilly (llama-server)]
  Lilly -->|GGUF model file| Model[GGUF model]


Component flow (Zero-Day)

sequenceDiagram
  participant U as User
  participant F as Frontend
  participant B as Backend (FastAPI)
  participant ES as Elasticsearch

  U->>F: type "electric"
  F->>B: GET /zeroday/search?query=electric
  B->>ES: search zeroday index
  ES-->>B: returns hits
  B-->>F: {count, results}
  F-->>U: render list

Troubleshooting & FAQ

Q: Frontend requests to /zeroday/search?query=... return 404 while Swagger works.
A: Common causes:

Frontend lib/api.ts used wrong param name (must use params: { query: q }). Fix shown above.

CORS / proxy mismatch: ensure dev server uses correct NEXT_PUBLIC_API_BASE_URL or uses relative calls if frontend dev server proxies backend.

Path prefix mismatch: backend router is mounted at /zeroday in app/main.py — ensure calls target /zeroday/search.

Q: Elasticsearch index missing or 500 errors.
A: Confirm ES container is healthy (docker compose logs elasticsearch), ensure enough memory for ES, check index names (typos matter). Use curl http://localhost:9200/_cat/indices?v to inspect indices.

Q: defense_ecasion vs defense_evasion typo:
A: The project keeps the index name as-is to match the ES indices you already have. If you want to standardize, create a new index defense_evasion and reindex the data, then update backend lists.

Q: Lilly / model issues:
A: Download GGUF model manually, ensure hardware requirements (RAM / GPU) are sufficient, build llama.cpp with proper flags.

Credits & External Resources

FastAPI — https://fastapi.tiangolo.com/

Uvicorn — https://www.uvicorn.org/

Elasticsearch — https://www.elastic.co/

Redis — https://redis.io/

llama.cpp — https://github.com/ggerganov/llama.cpp

Lily model on Hugging Face — https://huggingface.co/Nekuromento/Lily-Cybersecurity-7B-v0.2-Q8_0-GGUF

Tailwind CSS — https://tailwindcss.com/

Framer Motion — https://www.framer.com/motion/

Axios — https://axios-http.com/

License & next steps

Add a LICENSE file to the repository (MIT recommended unless your organization requires otherwise).

Suggested next steps:

Add CI (GitHub Actions) to run lint, tests, and build the frontend.

Add a CONTRIBUTING.md with contributor workflow and PR template.

Add an EXPORT of your ES mapping or seed scripts to populate dev data.

Produce the LaTeX report (20+ pages) and a PDF for project submission.

Appendices
A — Example zeroday_service.py (clean & copy-paste ready)
# backend/app/services/zeroday_service.py
import re
from typing import List, Dict, Optional
from app.core.elasticsearch_client import es  # AsyncElasticsearch client

class ZeroDayService:
    def __init__(self, index_name: str = "zeroday"):
        self.index_name = index_name

    async def search_zeroday(self, query: Optional[str]) -> List[Dict]:
        """
        If query is None or empty -> return all docs (size limited)
        If query matches ZDI-CAN-<digits> -> exact match on zero_day_id
        Otherwise -> multi_match on category and impact
        """
        if not query:
            body = {"query": {"match_all": {}}, "size": 100}
        else:
            must_clauses = []
            if re.fullmatch(r"ZDI-CAN-\d+", query):
                must_clauses.append({"match": {"zero_day_id": query}})
            else:
                must_clauses.append({
                    "multi_match": {
                        "query": query,
                        "fields": ["category", "impact"],
                        "operator": "and"
                    }
                })
            body = {"query": {"bool": {"must": must_clauses}}, "size": 100}

        response = await es.search(index=self.index_name, body=body)
        return [hit["_source"] for hit in response["hits"]["hits"]]

B — Example zeroday router (copy-paste ready)
# backend/app/api/zeroday.py
from fastapi import APIRouter, Query
from typing import Optional
from app.services.zeroday_service import ZeroDayService

router = APIRouter()

@router.get("/search")
async def search_zerodays(query: Optional[str] = Query(None, description="Zero-Day ID or keyword")):
    service = ZeroDayService()
    results = await service.search_zeroday(query=query)
    return {"count": len(results), "results": results}

C — Frontend snippet for Zero-Day list (example pattern)

Ensure you use response.data.results when reading backend responses:

// in frontend page:
const res = await api.searchZeroDay(query);
const items = res.results || res; // safe fallback
