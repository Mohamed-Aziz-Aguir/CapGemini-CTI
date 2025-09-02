# Cyber Threat Intelligence Dashboard (CTI)

**Authors:** Mohamed Aziz Aguir & Yahya Kaddour  
**Organization / Company:** Capgemini (project work)  
**University:** ESPRIT  
**Supervisor:** Mohamed Amine Boussaid  
**Repository:** https://github.com/Mohamed-Aziz-Aguir/CapGemini-CTI

**Primary contact:** Mohamed Aziz Aguir — `mohamedaziz.aguir@outlook.com`   

**Project timeline:** Start: `2025-06-23` — End: *(today / ongoing)*

---

## Table of Contents

1. Project Overview
2. Tech stack & Versions
3. Repository layout
4. Quick Start — one-shot bootstrap (Ubuntu)
5. Manual Setup (detailed)
6. Backend — config & endpoints
7. Frontend — config & fixes
8. Elasticsearch indices & data model
9. Optional: Local LLM (Lilly) using `llama.cpp` (instructions)
10. Dev scripts & convenience commands
11. Architecture diagrams (Mermaid)
12. Troubleshooting & FAQ
13. Credits & External Resources
14. License & Next steps
15. Appendices (examples & snippets)

---

## Project overview

This project is a full-stack Cyber Threat Intelligence (CTI) Dashboard built as a Capgemini school/industry project (ESPRIT). It provides:

- IOC analysis (caching + third-party lookups)
- Zero-day browsing and keyword search
- Threat catalog browsing per ATT&CK-like categories (each category stored in Elasticsearch)
- CVE search and browsing with pagination
- Optional local LLM (Lilly) integration built on `llama.cpp` and a GGUF model
- Frontend UI built with Next.js (React), styled with TailwindCSS, animations via Framer Motion

---

## Tech stack & versions

Primary tech used in the project:

- **Python** — 3.13  
- **FastAPI** — 0.116.1  
- **Uvicorn** — 0.23.x  
- **Elasticsearch** — 8.13.0 (Docker image used)  
- **Redis** — Redis 7.x (container); Python client redis==5.0.4  
- **llama_cpp_python** — 0.3.16 (optional, for local LLM bindings)  
- **Frontend** — Next.js (React), TailwindCSS, Framer Motion, Axios  
- **OS** — Ubuntu (development & server)

---

## Repository layout (recommended)

```
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
    /models
      /lilly/
      /llama.cpp/
  requirements.txt
  setup_backend_fixed.sh
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
```

---

## Manual Setup (detailed)

### 1. Docker (Elasticsearch + Redis)

Create `backend/docker-compose.yml` (or use the provided) to run ES & Redis. Example file is included in the repository.

Start:

```bash
docker compose up -d
# wait until Elasticsearch healthy:
curl -sSf http://localhost:9200/
```

### 2. Python virtualenv & dependencies

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

### 3. Environment variables

Create `.env` inside `backend/` with values like:

```
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
```

### 4. Start Backend (development)

Activate venv and run:

```bash
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Open API docs: `http://localhost:8000/docs`

### 5. Frontend (development)

From `/frontend`:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

---

## Backend — configuration & endpoints

Key routers included in `app/main.py` (examples):

- `POST /api/ioc/analyze` — Body: `{ "value": "github.com" }`  
  Returns: `{ ioc, otx, virustotal }`.

- `GET /zeroday/search?query=<keyword or ZDI-CAN-####>`  
  If `query` omitted or empty — returns all zero-days (backend supports optional `query`).  
  Response: `{ "count": <n>, "results": [ ... ] }`

- `GET /threat-catalog/get?category=<index>`  
  Example: `category=execution`

- `GET /api/search/all?q=<query>&page=1&page_size=10`  
  CVE search with pagination (returns `results` and `pagination`).

---

## Frontend — important fixes

- The Zero-Day backend expects parameter name `query`. Use `params: { query: q }` when calling `/zeroday/search`.
- When backend returns `{ count: 96, results: [...] }`, frontend should read `response.data.results`.
- In `frontend/lib/api.ts` ensure `searchZeroDay` uses `params: { query: q }`.

---

## Elasticsearch indices & data model

Indices used (exact names preserved):

- execution
- privilege_escalation
- lateral_movement
- initial_access
- collection
- command_and_control
- defense_ecasion
- credential_access
- discovery
- persistence
- tampering
- exfiltration
- spoofing
- information_disclosure
- repudiation
- manipulate_environment
- zeroday
- asrg-cve
- otx-iocs
- vt-iocs
- newsupstream

Zero-day sample document:

```json
{
  "zero_day_id": "ZDI-CAN-26359",
  "cve": "Not yet assigned",
  "category": "Electric Vehicle Chargers",
  "impact": "Bypass authentication on the system."
}
```

Threat-catalog sample top-level document:

```json
{
  "ThreatName": "Persistence",
  "ThreatID": "T.P.001",
  "SubThreats": [ ... ]
}
```

---

## Optional: Local LLM (Lilly) with `llama.cpp`

**Model**: `Nekuromento/Lily-Cybersecurity-7B-v0.2-Q8_0-GGUF` (Hugging Face). Download manually.

Steps:

1. Clone `llama.cpp` and build:

```bash
git clone https://github.com/ggerganov/llama.cpp.git
cd llama.cpp
LLAMA_CURL=1 make
```

2. Download GGUF model from Hugging Face and place at:
`backend/models/lilly/lily-cybersecurity-7b-v0.2-q8_0.gguf`

3. Run `llama-server`:

```bash
cd backend/models/llama.cpp/build/bin
./llama-server -m ~/CTI/backend/models/lilly/lily-cybersecurity-7b-v0.2-q8_0.gguf --host 0.0.0.0 --port 8080 --ctx-size 4096 --n-gpu-layers 0
```

4. Configure `.env`:
`LILLY_SERVER_URL=http://localhost:8080`

---

## Dev scripts & convenience commands

- Start ES+Redis: `docker compose up -d`
- Stop: `docker compose down`
- Start backend: `uvicorn app.main:app --reload`
- Show logs: `tail -f uvicorn.log`

---

## Architecture diagrams (Mermaid)

High-level and sequence diagram snippets are included in the repo README for use with GitHub's Mermaid support.

---

## Troubleshooting & FAQ

- If frontend returns 404 on `/zeroday/search`, ensure the frontend call uses `params: { query }` and backend router is mounted at `/zeroday`.
- If Elasticsearch returns 500, check logs and index existence: `curl http://localhost:9200/_cat/indices?v`
- If running `llama.cpp` fails, ensure build tools and sufficient RAM.

---

## Credits & External Resources

- FastAPI — https://fastapi.tiangolo.com/  
- Uvicorn — https://www.uvicorn.org/  
- Elasticsearch — https://www.elastic.co/  
- Redis — https://redis.io/  
- llama.cpp — https://github.com/ggerganov/llama.cpp  
- Lily model — https://huggingface.co/Nekuromento/Lily-Cybersecurity-7B-v0.2-Q8_0-GGUF  
- Tailwind CSS — https://tailwindcss.com/  
- Framer Motion — https://www.framer.com/motion/  
- Axios — https://axios-http.com/

---

## Appendices

### Example `zeroday_service.py`

```py
# backend/app/services/zeroday_service.py
import re
from typing import List, Dict, Optional
from app.core.elasticsearch_client import es  # AsyncElasticsearch client

class ZeroDayService:
    def __init__(self, index_name: str = "zeroday"):
        self.index_name = index_name

    async def search_zeroday(self, query: Optional[str]) -> List[Dict]:
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
```

### Example `zeroday` router

```py
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
```

---

## License & next steps

Add a `LICENSE` file (MIT recommended). Suggested next steps: add CI, export ES mappings, create seed/index scripts, produce the LaTeX report (20+ pages).

---

*Generated for Mohamed Aziz Aguir & Yahya Kaddour — Capgemini / ESPRIT project.*
