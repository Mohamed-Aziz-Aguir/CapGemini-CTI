# 📡 Cyber Threat Intelligence (CTI) — Backend

> **Repository:** https://github.com/Mohamed-Aziz-Aguir/CapGemini-CTI  
> **Component:** Backend (FastAPI + Elasticsearch + optional Lilly LLM)  
> **Authors:** Mohamed Aziz Aguir & Yahya Kaddour  
> **Supervisor:** Mohamed Amine Boussaid (Capgemini)  
> **Project period:** 23 June — 02 September 2025

---

## 🔖 Quick summary

This backend provides the REST API and services powering the CTI Dashboard:

- Built with **FastAPI** (async) — automatic OpenAPI docs.
- Stores and searches CTI data in **Elasticsearch 8.13.0**.
- Optional on-prem LLM (Lilly) using **llama.cpp** / GGUF.
- Optional **Redis** for caching.
- Exposes endpoints for:
  - Zero-day search & listing
  - Threat catalog retrieval (index-per-category)
  - CVE search / browse with pagination
  - IOC analysis (OTX, VirusTotal + ES cache)
  - Optional Lilly chat streaming

This README focuses on the backend: install, config, running, endpoints, and troubleshooting.

---

## 🧾 Authors & Contacts

- **Mohamed Aziz Aguir** — mohamedaziz.aguir@outlook.com — +216 93 236 576  
- **Yahya Kaddour** — *(please add email)*  
- **Supervisor:** Mohamed Amine Boussaid (Capgemini)

---

## 🧰 Technology & Versions

- Python 3.13  
- FastAPI 0.116.1  
- Elasticsearch 8.13.0  
- `llama_cpp_python` 0.3.16 (optional, for Lilly)  
- Redis 5.0.4 (optional)  
- uvicorn for serving (development)  
- aiohttp / httpx / requests (as used by services)  

---

## 📁 Repo layout (backend)

backend/
├─ app/
│ ├─ api/
│ │ ├─ routes/
│ │ │ ├─ ioc.py
│ │ │ ├─ zeroday.py
│ │ │ ├─ threat_catalog.py
│ │ │ ├─ search.py
│ │ │ └─ lilly.py
│ ├─ services/
│ │ ├─ zeroday_service.py
│ │ ├─ cve_service.py
│ │ ├─ threat_catalog_service.py
│ │ ├─ otx_service.py
│ │ └─ virustotal_service.py
│ ├─ core/
│ │ └─ elasticsearch_client.py
│ ├─ models/
│ └─ main.py
├─ Dockerfile
├─ requirements.txt
└─ README.md <-- (this file)

yaml
Copy code

> Note: exact file names may vary; README assumes the file structure you provided.

---

## ⚙️ Required environment

Recommended to run on **Ubuntu** (development tested there). Production can be on any Linux server.

### System packages (Ubuntu)
```bash
sudo apt update
sudo apt install -y build-essential curl git python3 python3-venv python3-dev
🐍 Python virtualenv installation (dev)
bash
Copy code
# from backend/
python3 -m venv .venv
source .venv/bin/activate

# upgrade pip & install requirements
python -m pip install --upgrade pip
pip install -r requirements.txt
requirements.txt should include (examples):

makefile
Copy code
fastapi==0.116.1
uvicorn[standard]
elasticsearch[async]==8.13.0
httpx
aiohttp
redis==5.0.4
llama_cpp_python==0.3.16  # optional
python-dotenv
pydantic
🔌 Environment variables (.env recommended)
Create .env in backend/:

ini
Copy code
# .env
# Application
APP_ENV=development
DEBUG=true
HOST=0.0.0.0
PORT=8000

# Elasticsearch
ES_HOST=http://localhost:9200
ES_USERNAME=
ES_PASSWORD=

# Redis (optional)
REDIS_URL=redis://localhost:6379/0

# VirusTotal / OTX - if used
VT_API_KEY=your_virustotal_api_key
OTX_API_KEY=your_otx_api_key

# Lilly/LLM service (optional)
LILLY_SERVER_URL=http://localhost:8080
FastAPI app uses app.core.elasticsearch_client to read ES config. If es.indices.exists(...) calls fail, check ES_HOST + credentials.

🔁 Docker (optional)
docker-compose (example)
yaml
Copy code
version: "3.8"
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.13.0
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    ports:
      - "9200:9200"
    volumes:
      - esdata:/usr/share/elasticsearch/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: .
    env_file:
      - .env
    ports:
      - "8000:8000"
    depends_on:
      - elasticsearch
      - redis

volumes:
  esdata:
Backend Dockerfile (dev)
dockerfile
Copy code
FROM python:3.13-slim
WORKDIR /app
COPY ./requirements.txt /app/requirements.txt
RUN apt-get update && apt-get install -y build-essential git curl && \
    python -m pip install --upgrade pip && \
    pip install --no-cache-dir -r /app/requirements.txt && \
    apt-get clean && rm -rf /var/lib/apt/lists/*
COPY . /app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
▶️ Running backend locally (dev)
Ensure Elasticsearch is running (local Docker or system):

bash
Copy code
docker run -d --name es -p 9200:9200 \
  -e "discovery.type=single-node" \
  docker.elastic.co/elasticsearch/elasticsearch:8.13.0
Start Redis (optional):

bash
Copy code
docker run -d --name redis -p 6379:6379 redis:7-alpine
Start backend (venv):

bash
Copy code
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
Visit OpenAPI docs:

Swagger UI: http://localhost:8000/docs

ReDoc: http://localhost:8000/redoc

🔎 ES indices (as used in your setup)
You told me these indices exist on your local ES (kept exact names):

python
Copy code
execution
privilege_escalation
lateral_movement
initial_access
collection
command_and_control
defense_ecasion          # note: index contains a typo; intentionally kept
credential_access
discovery
persistence
tampering
exfiltration
spoofing
information_disclosure
repudiation
manipulate_environment
asrg-cve
otx-iocs
vt-iocs
zeroday
newsupstream
... (others)
Important: The frontend relies on these exact index names. If you rename indices in ES, update the ThreatCatalog service / frontend mapping.

🔧 Key backend files & services (summary)
app/core/elasticsearch_client.py — Async ES client initialization (reads ES_HOST + auth).

app/services/zeroday_service.py — Zeroday search (match_all if empty; exact ZDI-CAN-### match; multi_match on category/impact).

app/services/cve_service.py — CVE search with pagination (exact CVE detection).

app/services/threat_catalog_service.py — Valid categories + search/return subthreats.

app/services/otx_service.py / virustotal_service.py — fetch external IOC data.

app/api/routes/zeroday.py — /zeroday/search

app/api/routes/threat_catalog.py — /threat-catalog/get

app/api/ioc.py — /api/ioc/analyze

app/api/search.py — /api/search/all (CVE browsing & search)

app/api/lilly.py — /api/lilly/* (optional streaming endpoints to Lilly server)

📡 API Endpoints & Examples
Base URL: http://localhost:8000

1. Zero-day search
GET /zeroday/search?query=<keyword_or_id>

query optional: when empty or omitted, returns all (limited default size).

Example: list all

bash
Copy code
curl -X GET "http://localhost:8000/zeroday/search?query=" -H "accept: application/json"
Example: search

bash
Copy code
curl -X GET "http://localhost:8000/zeroday/search?query=Electric%20Vehicle%20Chargers" -H "accept: application/json"
Response:

json
Copy code
{
  "count": 96,
  "results": [
    {
      "zero_day_id": "ZDI-CAN-26359",
      "cve": "Not yet assigned",
      "category": "Electric Vehicle Chargers",
      "impact": "Bypass authentication on the system."
    },
    ...
  ]
}
2. Threat Catalog
GET /threat-catalog/get?category=<index_name> (case-insensitive)

category is the ES index name (e.g. execution, persistence, defense_ecasion).

Example:

bash
Copy code
curl -X GET "http://localhost:8000/threat-catalog/get?category=execution" -H "accept: application/json"
Response: Array of documents from that index, e.g.:

json
Copy code
[
  {
    "ThreatName": "Execution",
    "ThreatID": "T.Ex.001",
    "SubThreats": [ { /* ... */ } ]
  }
]
3. CVE search (paginated)
GET /api/search/all?q=<q>&page=1&page_size=10

If q matches CVE-YYYY-NNNN exact format, returns exact-match results.

Otherwise keyword multi_match.

Example:

bash
Copy code
curl -X GET "http://localhost:8000/api/search/all?q=&page=1&page_size=10" -H "accept: application/json"
Response: includes results and pagination block.

4. IOC analysis
POST /api/ioc/analyze
Payload (JSON):

json
Copy code
{ "value": "8.8.8.8" }
Important: Backend expects value (not ioc). If your front end was sending { ioc: "..." } you'll get 422. Fix: send { value: ... }.

Response:

json
Copy code
{
  "ioc": "8.8.8.8",
  "otx": { ... },
  "virustotal": { ... }
}
5. Lilly (LLM) chat (optional)
POST /api/lilly/chat?stream=true — streams partial tokens from local llama-server.
(Requires LILLY_SERVER_URL configured and llama-server up & running.)

✅ Known gotchas & troubleshooting
Below are the problems you encountered and how to fix them:

1. 422 Unprocessable Entity on /api/ioc/analyze
Cause: Frontend was sending JSON with a different field name (e.g. { ioc: "..." }) while backend expects { value: "..." }.
Fix: Update frontend to axios.post("/api/ioc/analyze", { value: input }) or change backend model to accept ioc. I recommend keeping value to match the current backend.

2. 404 for /zeroday/search?query=... from frontend
Cause: Frontend used parameter name q, while backend expects query.
Fix: Ensure frontend calls /zeroday/search with params: { query: term } (or update lib/api.ts to use query param). Example:

ts
Copy code
axios.get(`${API_BASE}/zeroday/search`, { params: { query: term } })
3. Threat catalog button names vs ES indices
You had a mismatch between the index names and UI button labels. Keep the exact index names (including defense_ecasion typo) in the frontend categories array to map to ES indices. If you correct the ES index name, update both ES and frontend mapping.

4. Empty results when ES returns documents
If the API returns JSON but frontend shows empty:

Confirm frontend reads response.data.results (zeroday) or response.data (threat-catalog).

Use browser devtools or backend logs to inspect the actual JSON returned by /zeroday/search.

5. Elasticsearch authentication or CORS
If ES is secured, set ES_USERNAME and ES_PASSWORD in .env.

FastAPI handles CORS for the frontend by default in app/main.py (currently allow_origins=["*"]).

🧩 Lilly (Local LLM) optional setup (summary)
This is optional. Only required if you want the local private assistant.

Clone and build llama.cpp

bash
Copy code
git clone https://github.com/ggerganov/llama.cpp.git
cd llama.cpp
# on Linux, with curl support to fetch HF models via repo id:
LLAMA_CURL=1 make
Download GGUF model (example):

Model: Nekuromento/Lily-Cybersecurity-7B-v0.2-Q8_0-GGUF

Download manually from Hugging Face (or use llama.cpp curl helpers).

Run llama-server

bash
Copy code
# example path adjustments
cd ~/CTI/backend/models/llama.cpp/llama.cpp-master/build/bin
./llama-server \
  -m ~/CTI/backend/models/lilly/lily-cybersecurity-7b-v0.2-q8_0.gguf \
  --host 0.0.0.0 \
  --port 8080 \
  --ctx-size 4096 \
  --n-gpu-layers 0
Backend config

Set LILLY_SERVER_URL=http://localhost:8080 in .env.

Ensure app.api.lilly routes call that URL and stream responses.

✅ Tests & validation
Use Swagger UI at /docs to test endpoints manually (good for catching 422/404 payload/param mismatches).

Use curl examples above to validate.

Check ES index health: curl -s http://localhost:9200/_cat/indices?v

Backend logs: watch uvicorn output for 200/404/422 codes like you saw earlier.

🔐 Production notes
Use secure credentials for Elasticsearch and do not expose ES to the public internet unless behind a proxy + auth.

For production, run behind Nginx with TLS, tune uvicorn workers, and scale ES cluster appropriately.

For Lilly: GPU & memory considerations — quantized models are helpful.

📚 Additional docs & artifacts
report.tex — LaTeX technical report (20+ pages)

/docs/architecture.mmd — mermaid diagrams

docker-compose.yml — quick dev stack

README_FRONTEND.md — instructions for frontend

discord_announcement.txt — one-line announcement for release

⚖️ License
Add your project-wide license file (e.g. LICENSE — MIT recommended). If using any model or 3rd-party dataset, respect their license (Hugging Face model usage terms).

📞 Final notes & contact
If you want, I can:

Produce a polished backend/Dockerfile and docker-compose.yml tuned for production.

Create OpenAPI snippets or Postman collection.

Create a minimal systemd service file to run uvicorn in production.

Contact: mohamedaziz.aguir@outlook.com — +216 93 236 576

