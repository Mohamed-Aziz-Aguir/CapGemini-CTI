Cyber Threat Intelligence Dashboard (CTI)

Repository: https://github.com/Mohamed-Aziz-Aguir/CapGemini-CTI

Project: CTI — Cyber Threat Intelligence Dashboard
Authors: Mohamed Aziz Aguir & Yahya Kaddour
Organization / Context: Capgemini (project work) — Students at ESPRIT
Supervisor: Mohamed Amine Boussaid
Project timeline: Start: 23 June — End: Today

This README is a complete, copy-paste-ready, step-by-step guide to the CTI repository. It documents architecture, technologies, exact commands used to run everything locally, API reference, deployment hints, and credits/third-party attributions (models, libraries, sites). Use this as the canonical repo README for GitHub.

Table of Contents

Project overview

Key features

Technologies & versions used

Architecture (diagram + explanation)

Repository layout

Prerequisites (system & accounts)

Quick start (local dev)

Backend — FastAPI (full setup & run)

Frontend — Next.js (full setup & run)

Elasticsearch (indices, sample data & setup)

Redis (optional)

Optional AI assistant (Lilly) using llama.cpp and GGUF model

Docker / Docker Compose (recommended)

API reference (most important endpoints + examples)

Data & indices used (exact names)

Troubleshooting & common issues

Security & production notes

Contributors & contacts

Acknowledgements, references & licenses

1 — Project overview

CTI is a web dashboard that centralizes and surfaces cybersecurity intelligence:

Searchable CVE database and browsing interface.

Zero-day tracker (search and list zero-day records).

Threat Catalog (many threat indices for tactics/techniques).

IOC Analyzer (leverages OTX and VirusTotal cached data in Elasticsearch).

Lilly AI assistant — optional local LLM for conversational cybersecurity help with streaming responses.

Backend: FastAPI (async). Frontend: Next.js (React with Framer Motion and Tailwind styles).

Goal: Provide security teams and researchers a single place to inspect, analyze, and explore threat intelligence data.

2 — Key features

CVE search & browse with pagination and exact/CVE-identifier search behavior.

Threat Catalog: multiple threat indices (execution, persistence, lateral movement, etc.). Click-to-browse categories and sub-threats. Collapsible, readable UI.

Zero-Day Tracker: list and search zero-day records stored in zeroday index.

IOC Analyzer: queries OTX/VT caches (Elasticsearch) and falls back to external APIs if missing.

Lilly AI (optional): a locally-hosted LLM (via llama.cpp) serving a cybersecurity assistant with streaming tokens. Streaming implemented server-side and front-end consumes stream to display incremental tokens.

Elasticsearch-backed datastore for fast search and indexing.

Next.js front-end with polished UI (Tailwind + Framer Motion).

3 — Technologies & exact versions (used in development)

Python: 3.13 (project developed/tested on Python 3.13).

FastAPI: 0.116.1.

Elasticsearch: 8.13.0 (single-node for dev).

Redis: 5.0.4 (optional caching/locking).

llama_cpp_python: 0.3.16 (optional, when interacting with model locally).

Node / Next.js: Next.js (latest supported by the code); Node 18+ recommended.

Frontend libs: axios, framer-motion, lucide-react, Tailwind CSS.

llama.cpp: upstream repo — https://github.com/ggerganov/llama.cpp

Model: Nekuromento/Lily-Cybersecurity-7B-v0.2-Q8_0-GGUF on Hugging Face — download and licensing depends on HF repo. (Model is optional and large; follow licensing.)

Important: Always check each dependency license before redistribution or production use.

4 — Architecture

Simple ASCII architecture:

                       +----------------------+
Browser (Next.js UI)  |  HTTP / SSE / REST    |
  (frontend)  <------> |  FastAPI backend     |
                       +---------+------------+
                                 |
                 +---------------+-----------------+
                 |                                 |
          Elasticsearch 8.x                    Redis (optional)
           (indices: asrg-cve, zeroday, etc.)          |
                 |                                 |
                 +                                 +
        Optional LLM server (llama.cpp)             External APIs
         (serves Lilly on port 8080)                (OTX / VirusTotal)


Frontend talks to backend at http://localhost:8000 (configurable).

Backend reads/writes from Elasticsearch indices.

Optional: llama-server (from llama.cpp) serves model on http://localhost:8080 and backend proxies streaming.

5 — Repository layout (high-level)
CTI/
├─ backend/
│  ├─ app/
│  │  ├─ api/
│  │  │  ├─ routes/
│  │  │  │  ├─ ioc.py
│  │  │  │  ├─ lilly.py
│  │  │  │  ├─ zeroday.py
│  │  │  │  └─ threat_catalog.py
│  │  ├─ services/
│  │  │  ├─ zeroday_service.py
│  │  │  ├─ cve_service.py
│  │  │  └─ lilly_service.py
│  │  ├─ core/
│  │  │  └─ elasticsearch_client.py
│  │  ├─ models/
│  │  └─ main.py
│  ├─ requirements.txt
│  └─ Dockerfile
├─ frontend/
│  ├─ app/
│  ├─ components/
│  ├─ lib/
│  │  └─ api.ts
│  ├─ package.json
│  └─ next.config.js
├─ models/ (optional; not tracked — model files live here)
├─ scripts/
│  ├─ download_model.py
│  └─ start_llama.sh
└─ README.md   <-- (this file)

6 — Prerequisites & accounts

Local machine: Ubuntu 20.04/22.04 or similar Linux. (This project was developed and tested on Ubuntu.)

Docker / Docker Compose (optional but recommended).

Hugging Face account & token (only if you plan to download the Lily GGUF model).

Disk space: models may require many GBs (7B Q8 models ~ several GB).

Ports: backend 8000, elasticsearch 9200, llama-server 8080, frontend 3000 (or your chosen ports).

7 — Quick start (local dev — minimal)

Goal: Run Elasticsearch, backend, and frontend locally (without AI model).

Start Elasticsearch (Docker quick):

docker run -d --name es-local -p 9200:9200 -e "discovery.type=single-node" docker.elastic.co/elasticsearch/elasticsearch:8.13.0


Start backend:

cd ~/CTI/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# create backend/.env with ELASTICSEARCH_URL=http://localhost:9200
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000


Start frontend:

cd ~/CTI/frontend
npm install
# set NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 in .env.local
npm run dev


Open http://localhost:3000 and http://localhost:8000/docs.

8 — Backend — FastAPI setup (detailed)
8.1 Install & venv
cd ~/CTI/backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt


If requirements.txt not present, install core packages:

pip install fastapi uvicorn[standard] httpx elasticsearch[async] python-dotenv redis pydantic

8.2 Environment variables

Create backend/.env:

ELASTICSEARCH_URL=http://localhost:9200
REDIS_URL=redis://localhost:6379/0
LLAMA_SERVER_URL=http://localhost:8080


Make sure your app/core/elasticsearch_client.py instantiates an AsyncElasticsearch client:

# app/core/elasticsearch_client.py
import os
from elasticsearch import AsyncElasticsearch

ES_URL = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200")
es = AsyncElasticsearch(hosts=[ES_URL])

8.3 Run
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000


OpenAPI/Swagger UI at http://localhost:8000/docs.

9 — Frontend — Next.js setup (detailed)
9.1 Install
cd ~/CTI/frontend
npm install
# or: pnpm install

9.2 Environment

Create frontend/.env.local:

NEXT_PUBLIC_API_BASE_URL=http://localhost:8000


Make sure lib/api.ts uses NEXT_PUBLIC_API_BASE_URL (it does in the repo).

9.3 Run
npm run dev


Visit http://localhost:3000.

10 — Elasticsearch — indexes & sample data

Indices used in this project (exact names):

asrg-cve
zeroday
otx-iocs
vt-iocs
execution
privilege_escalation
lateral_movement
initial_access
collection
command_and_control
defense_ecasion        # NOTE: index name contains a TYPO in original dataset
credential_access
discovery
persistence
tampering
exfiltration
spoofing
information_disclosure
repudiation
manipulate_environment


Keep the defense_ecasion name intact if your ES cluster uses that exact name. If you prefer the correct spelling, reindex to defense_evasion.

10.1 Insert example data (curl)
# Example: index one zeroday document
curl -X POST "http://localhost:9200/zeroday/_doc" -H 'Content-Type: application/json' -d'{
  "zero_day_id": "ZDI-CAN-26359",
  "cve": "Not yet assigned",
  "category": "Electric Vehicle Chargers",
  "impact": "Bypass authentication on the system."
}'

10.2 Confirm index content
curl -X GET "http://localhost:9200/zeroday/_search?pretty" -H 'Content-Type: application/json' -d'{
  "query": { "match_all": {} },
  "size": 10
}'

11 — Redis (optional)

Redis is optional, used for caching and ephemeral storage. Install:

sudo apt install redis-server
sudo systemctl enable --now redis


Set REDIS_URL in .env.

12 — Optional AI: Lilly (llama.cpp + GGUF model)

This section is optional and large. Only do this if you have extra disk space and compute.

12.1 Model repo & binary

Model: https://huggingface.co/Nekuromento/Lily-Cybersecurity-7B-v0.2-Q8_0-GGUF. Follow model licensing and HF usage policy.

12.2 Steps (high level)

Clone and build llama.cpp with curl support:

git clone https://github.com/ggerganov/llama.cpp.git
cd llama.cpp
LLAMA_CURL=1 make


Download GGUF model to backend/models/lilly/lily-cybersecurity-7b-v0.2-q8_0.gguf. Use huggingface_hub or huggingface-cli with your token.

Start llama-server (binary name may vary; check build/bin):

./build/bin/llama-server \
  -m ~/CTI/backend/models/lilly/lily-cybersecurity-7b-v0.2-q8_0.gguf \
  --host 0.0.0.0 \
  --port 8080 \
  --ctx-size 4096 \
  --n-gpu-layers 0


Set LLAMA_SERVER_URL=http://localhost:8080 in backend .env.

Backend LillyService will stream responses from the llama server and append assistant messages into in-memory chat memory. The backend exposes /api/lilly/chat for frontend to chat with Lilly.

Important licensing note: Respect model license and attribution. Some HF models require agreement to terms.

13 — Docker / Docker Compose (recommended)

A production-ready docker-compose.yml can orchestrate:

Elasticsearch

Redis

Backend (FastAPI container)

Frontend (Next.js container)

(Optional) Helpers (llama container or model serving)

The repo can include docker/docker-compose.yml. If you want, I can provide a ready-to-use docker-compose.yml for your exact stack.

14 — API reference (selected)

POST /api/ioc/analyze — Analyze IOC
Request body: { "value": "<ioc>" }
Response: combined object with "ioc", "otx", and "virustotal".

POST /api/lilly/chat?stream=true — Stream chat response from Lilly. Body: { "message": "<text>" }
POST /api/lilly/clear — clear chat memory.

GET /zeroday/search?query=<q> — Search zero-day index. If query is omitted or empty string, returns all (match_all). Response schema: { count: <n>, results: [ ... ] }.

GET /threat-catalog/get?category=<category> — returns all docs from the named index (case-insensitive on category). Example category: execution.

GET /api/search/all?q=<q>&page=1&page_size=10 — CVE search / browse with pagination.

Example curl:

curl -X GET "http://localhost:8000/zeroday/search?query=electric" -H "accept: application/json"

15 — Data & indices: how data is represented

Zero-day records (example):

{
  "zero_day_id": "ZDI-CAN-26359",
  "cve": "Not yet assigned",
  "category": "Electric Vehicle Chargers",
  "impact": "Bypass authentication on the system."
}


Threat catalog index documents typically look like:

{
  "ThreatName": "Persistence",
  "ThreatID": "T.P.001",
  "SubThreats": [
    {
      "ThreatName": "Abuse UDS For Persistence",
      "ThreatID": "T.P.002",
      "AttackFeasibilityLevel": "HIGH",
      "FeasibilityRating": { "ET": {"description": "..."} },
      "Description": "An attacker exploits the UDS protocol ...",
      "RefineThreatClass": "T.P.001, Persistence",
      "SecurityProperties": { "Confidentiality": true, "Integrity": true },
      "ActsOn": ""
    }
  ]
}


The frontend flattens SubThreats into cards with ThreatName, ThreatID, AttackFeasibilityLevel, Description, FeasibilityRating, and SecurityProperties.

16 — Troubleshooting & common issues

Frontend showing empty results but Swagger returns data

Confirm frontend is calling correct base URL: NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 and lib/api.ts uses it.

Ensure correct query param names: zeroday endpoint expects query not q. The frontend must call /zeroday/search?query=....

422 Unprocessable Entity on POSTs

Check the request JSON matches the backend Pydantic model. For instance /api/ioc/analyze expects { "value": "..." }.

404 for threat-catalog indices

Verify exact index names in Elasticsearch (all-lowercase). e.g. defense_ecasion vs defense_evasion.

LLM streaming issues

Ensure llama-server is running and reachable at LLAMA_SERVER_URL configured in .env. Check firewall/ports.

Large model downloads fail

Use git lfs or huggingface_hub tools and ensure enough disk space.

17 — Security & production notes

Never use allow_origins=["*"] in production; lock to your frontend domain.

When deploying Elasticsearch in production, enable authentication and TLS (Elasticsearch 8 defaults to security ON). Update ELASTICSEARCH_URL and client credentials.

Store secrets in environment variables or a secret manager. Do not commit .env.

Follow model license terms for Lily and other models. Do not redistribute model weights unless permitted.

18 — Contributors & contacts

Mohamed Aziz Aguir — mohamedaziz.aguir@outlook.com
 — +216 93 236 576

Yahya Kaddour — (please add Yahya’s email if you wish to include it here)

Supervisor: Mohamed Amine Boussaid

If you want a public contact for repo issues, use GitHub Issues on the repository.

19 — Acknowledgements, references & licenses

FastAPI — https://fastapi.tiangolo.com/

Elasticsearch — https://www.elastic.co/

llama.cpp — https://github.com/ggerganov/llama.cpp

Lily model (HF): Nekuromento/Lily-Cybersecurity-7B-v0.2-Q8_0-GGUF — https://huggingface.co/Nekuromento/Lily-Cybersecurity-7B-v0.2-Q8_0-GGUF

Redis — https://redis.io/

Next.js — https://nextjs.org/

Framer Motion — https://www.framer.com/motion/

Tailwind CSS — https://tailwindcss.com/

axios — https://axios-http.com/

lucide-react — https://lucide.dev/

Please inspect each dependency license file (package.json, requirements.txt, library docs) for specific licensing/attribution requirements.

Appendix — Helpful scripts & commands

Start backend (dev):

cd ~/CTI/backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000


Start frontend (dev):

cd ~/CTI/frontend
npm run dev


Elasticsearch (docker quick):

docker run -d --name es-local -p 9200:9200 -e "discovery.type=single-node" docker.elastic.co/elasticsearch/elasticsearch:8.13.0


Build & run llama.cpp (optional):

cd ~/CTI/backend/models
git clone https://github.com/ggerganov/llama.cpp.git
cd llama.cpp
LLAMA_CURL=1 make
# after downloading model to backend/models/lilly/lily-...gguf
./build/bin/llama-server -m ~/CTI/backend/models/lilly/lily-cybersecurity-7b-v0.2-q8_0.gguf --host 0.0.0.0 --port 8080 --ctx-size 4096 --n-gpu-layers 0
