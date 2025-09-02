Project: Cyber Threat Intelligence Dashboard (CTI)
Authors: Mohamed Aziz Aguir & Yahya Kaddour
Organization: Capgemini (project work)
School: ESPRIT
Supervisor: Mohamed Amine Boussaid
Repo: https://github.com/Mohamed-Aziz-Aguir/CapGemini-CTI

This README provides a complete, copy-pasteable set of instructions to run the full CTI project locally (backend + frontend), how to wire its dependencies (Elasticsearch, Redis), how to run the optional AI model (Lilly via llama.cpp), and how to use / test the API. It contains example environment files, Docker Compose snippets, troubleshooting tips, admin contacts and credits.

Table of contents

Project overview

Architecture summary (quick diagram)

Requirements & versions

Repository layout

Quick local install (Ubuntu) — recommended order

Backend setup (FastAPI) — full details

Frontend setup (Next.js) — full details

Elasticsearch setup and indices

Redis (optional)

Optional AI (Lilly) — llama.cpp & GGUF model (download/build/run)

Docker / Docker Compose (recommended multi-service)

Environment file examples (.env)

API reference (common endpoints + sample requests)

Debugging & troubleshooting

Security & production notes

Credits, acknowledgements & licenses

Contacts

1 — Project overview

This CTI project is a cyber threat intelligence dashboard with:

Backend API (FastAPI) for IOC analysis, Zero-day search, Threat Catalog, Chat AI (Lilly), and general search.

Frontend (Next.js) for the UI (chat, IOC analyzer, Threat Catalog, Zero-Day tracker).

Data store using Elasticsearch (indices for threat catalog, CVEs, OTX/VT IOCs, zero-day entries).

Optional: a locally hosted LLM model (Lilly) served by llama.cpp to provide streaming chatbot responses.

Core aims:

Provide researchers with searchable CVE/zero-day data.

Analyze IOCs using OTX/VirusTotal (or cached ES indexes).

Offer an AI assistant tuned for cybersecurity.

2 — Architecture (quick diagram)
[Browser (Next.js frontend)]
            ⇅ (HTTP / Websocket)
[FastAPI Backend (uvicorn)]
   ├─ /api/ioc -> IOC analyzer (calls OTX/VT or ES)
   ├─ /api/lilly -> proxies to Lilly server (optional)
   ├─ /zeroday -> search zero-day index (Elasticsearch)
   ├─ /threat-catalog -> fetch threat indices from ES
   └─ /api/search -> CVE search / browse (ES)

Backend data stores:
   ├─ Elasticsearch  (indices: asrg-cve, zeroday, otx-iocs, vt-iocs, <threat indices>)
   └─ Redis (optional for caching or rate-limiting)

Optional AI:
   [llama.cpp / llama-server] <- GGUF model (Lilly)
           ^ listens on port (e.g. 8080)

3 — Requirements & versions (tested)

Use these versions for best compatibility:

OS: Ubuntu 20.04 / 22.04 (developer machine)

Python: 3.13 (you used 3.13; 3.10+ is fine)

FastAPI: 0.116.1

Elasticsearch: 8.13.0

Redis: 5.0.4 (server)

llama_cpp_python: 0.3.16 (if using Python client to call models)

Node.js (for frontend): Node 18+ recommended (Next.js compatible)

Docker & Docker Compose v2 (if using containers)

Note: Elastic 8.x requires some configuration for security (passwords / certificates) when used in production. For local dev you may run single-node "dev" Elasticsearch.

4 — Repository layout (recommended)
CTI/
├─ backend/                     # FastAPI backend
│  ├─ app/
│  │  ├─ api/
│  │  │  ├─ routes/              # ioc.py, lilly.py, zeroday.py, threat_catalog.py, search.py
│  │  ├─ services/               # zeroday_service.py, cve_service.py, lilly_service.py, etc.
│  │  ├─ core/                   # config.py, elasticsearch_client.py
│  │  ├─ models/                 # pydantic models and data
│  ├─ requirements.txt
│  ├─ Dockerfile
│  └─ .env.example
├─ frontend/                    # Next.js frontend
│  ├─ app/
│  ├─ components/
│  ├─ lib/api.ts
│  ├─ package.json
│  └─ .env.local.example
├─ docker/
│  └─ docker-compose.yml
├─ scripts/
│  ├─ download_model.py
│  └─ start_llama.sh
└─ README.md  (this file)

5 — Quick local install (Ubuntu)

Below is the condensed step-by-step you can copy/paste. Do them in order.

5.1 Install system packages
# Update & install common tools
sudo apt update && sudo apt install -y git curl wget build-essential cmake python3 python3-venv python3-pip libcurl4-openssl-dev

# (Optional) for llama.cpp performance
sudo apt install -y libopenblas-dev

5.2 Clone repo
cd ~
git clone https://github.com/Mohamed-Aziz-Aguir/CapGemini-CTI.git CTI
cd CTI

6 — Backend setup (FastAPI)
6.1 Create virtual environment & install dependencies
cd ~/CTI/backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt


If requirements.txt is missing, common dev dependencies include:

fastapi==0.116.1
uvicorn[standard]
httpx
aiohttp
elasticsearch>=8.13.0
redis>=5.0.4
pydantic
python-dotenv
llama_cpp_python==0.3.16  # optional if you call model locally

6.2 Configuration (.env)

Create .env or export env variables. Example .env (backend/.env):

# Backend config
PYTHONPATH=./

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200

# Redis (optional)
REDIS_URL=redis://localhost:6379/0

# Lilly / Llama server (optional)
LLAMA_SERVER_URL=http://localhost:8080

# Uvicorn / FastAPI
HOST=0.0.0.0
PORT=8000

6.3 Elasticsearch client — elasticsearch_client.py

Make sure your app/core/elasticsearch_client.py creates an AsyncElasticsearch client and reads ELASTICSEARCH_URL from env. Example:

# app/core/elasticsearch_client.py
import os
from elasticsearch import AsyncElasticsearch

ES_URL = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200")

es = AsyncElasticsearch(hosts=[ES_URL])


Ensure your code uses await es.search(...) (async) and that es.indices.exists() is awaited.

6.4 Run backend
# from backend directory, with venv activated
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000


Open http://localhost:8000/docs
 to see the Swagger OpenAPI UI.

7 — Frontend setup (Next.js)
7.1 Install
cd ~/CTI/frontend
# Use npm or pnpm/yarn
npm install
# or
# pnpm install
# yarn

7.2 Environment variables

frontend/.env.local example:

NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

7.3 Run dev server
npm run dev
# default Next dev port 3000


Open http://localhost:3000
.

The frontend uses lib/api.ts which by default reads NEXT_PUBLIC_API_BASE_URL.

8 — Elasticsearch setup & indices

For development, run a single-node Elasticsearch 8.13 instance. You can either:

Install Elasticsearch locally (tar/apt), or

Use Docker Compose (recommended for reproducibility).

8.1 Docker Compose snippet (Elasticsearch only)
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.13.0
    environment:
      - discovery.type=single-node
      - ES_JAVA_OPTS=-Xms512m -Xmx512m
    ports:
      - "9200:9200"
    volumes:
      - esdata:/usr/share/elasticsearch/data
volumes:
  esdata:


After starting, create indices used by the app (example index names from your system: asrg-cve, zeroday, otx-iocs, vt-iocs, execution, persistence, etc.).

You can bulk load JSON or use the backend scripts to ingest data.

9 — Redis (optional)

Redis is used optionally by some services (cache, rate limiting). To start locally:

sudo apt install redis-server
sudo systemctl enable --now redis
# or docker run -p 6379:6379 redis:7


Set REDIS_URL in the backend .env if you use Redis.

10 — Optional AI: Lilly (llama.cpp server + model)

Important: The AI model and llama.cpp are optional. They provide the Lilly assistant and streaming responses. If you don't want or cannot host the model locally, the backend still works without it.

10.1 Downloading the GGUF model (Hugging Face)

You provided the model repo:

https://huggingface.co/Nekuromento/Lily-Cybersecurity-7B-v0.2-Q8_0-GGUF


Large models require HF token if gated.

Example download using huggingface_hub (script included in scripts/download_model.py). Export HF token:

export HF_TOKEN="hf_..."   # your Hugging Face token
python3 scripts/download_model.py \
  --repo Nekuromento/Lily-Cybersecurity-7B-v0.2-Q8_0-GGUF \
  --filename lily-cybersecurity-7b-v0.2-q8_0.gguf \
  --out-dir backend/models/lilly

10.2 Build llama.cpp & run server
cd ~/CTI/backend/models
git clone https://github.com/ggerganov/llama.cpp.git
cd llama.cpp
LLAMA_CURL=1 make

# Then run (adjust binary name if different):
cd build/bin
./llama-server -m ~/CTI/backend/models/lilly/lily-cybersecurity-7b-v0.2-q8_0.gguf --host 0.0.0.0 --port 8080 --ctx-size 4096 --n-gpu-layers 0


If the llama-server binary is named differently in your build (some forks use llama or llama-cli), consult build/bin and the repo README.

Set LLAMA_SERVER_URL in backend .env if the backend will call the AI.

11 — Docker Compose (full stack example)

A simple docker/docker-compose.yml can orchestrate:

Elasticsearch

(Optional) Redis

(Optional) llama (llama-server)

Backend (if containerized)

Frontend (if containerized)

See the earlier docker/docker-compose.yml snippet in this README for an example.

12 — Environment example files

backend/.env.example

ELASTICSEARCH_URL=http://localhost:9200
REDIS_URL=redis://localhost:6379/0
LLAMA_SERVER_URL=http://localhost:8080
HOST=0.0.0.0
PORT=8000


frontend/.env.local.example

NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

13 — API reference (high-level)

These are the main endpoints provided by the backend. Use http://localhost:8000/docs when backend is running to inspect API docs.

POST /api/ioc/analyze — Analyze IOC. Body: { "value": "<ioc>" }. Returns combined OTX / VirusTotal / ES cached results.

POST /api/lilly/chat — Chat with Lilly (may stream). Body: { "message": "hello" }. Query param stream=true|false.

POST /api/lilly/clear — Clear chat memory.

GET /zeroday/search?query=<q> — Search or list zero-day entries. If query omitted or empty, returns all (or pagination).

GET /threat-catalog/get?category=<category> — Get threat catalog index (category is index name). Case-insensitive: execution works.

GET /api/search/all?q=<q>&page=1&page_size=10 — CVE search / browse with pagination.

POST /api/ioc/enrich_cve — enrich CVE (example).

POST /api/ioc/simplify_cve — simplify for non-expert.

Sample curl:

curl -X GET "http://localhost:8000/zeroday/search?query=electric" -H "accept: application/json"

14 — Debugging & troubleshooting (common issues)

Issue: 422 Unprocessable Entity when posting from frontend to /api/ioc/analyze

Make sure request body matches backend Pydantic model. Your backend expects { "value": "..." } (or as defined). Confirm axios.post('/api/ioc/analyze', { value: ioc }).

Issue: 404 Not Found for /zeroday/search?query= from frontend

Make sure frontend sends the correct param name (query) and backend route expects query. Use axios.get('/zeroday/search', { params: { query: term } }).

If you want "list all" behavior for empty query, ensure backend search_zeroday() handles query=None by returning all (match_all).

Issue: Empty results from frontend even though swagger shows results

Ensure frontend base URL points to backend (NEXT_PUBLIC_API_BASE_URL=http://localhost:8000) and API client uses that base. Also ensure axios requests include correct path and query param key.

Check browser devtools network tab for exact request and response code.

Issue: llama-server binary not found

Build llama.cpp and inspect build/bin. Some forks place binaries under different names; read llama.cpp README.

Issue: Elasticsearch returns 500 or 404 for some indices

Confirm index names exactly match what you query. Use lowercase index names. Example index list from your cluster:

execution
privilege_escalation
lateral_movement
initial_access
collection
command_and_control
defense_ecasion   # note typo
credential_access
discovery
persistence
tampering
exfiltration
spoofing
information_disclosure
repudiation
manipulate_environment


If necessary, correct defense_ecasion -> defense_evasion and reindex (or keep the typo in frontend/service to match ES).

15 — Security & production notes

Elasticsearch: running ES in production requires enabling security (user/password/certificates). The local single-node configuration is not secure.

Hugging Face model: respect model licensing and weights distribution rules. If the HF repo is gated, only download with appropriate credentials and license adherence.

CORS: In app.main CORS is set to allow_origins=["*"] for dev. Lock this down in production.

Secrets: Never commit tokens/secrets to git. Use environment variables and secure vaults.

Scaling: For heavy traffic, deploy backend behind a process manager (gunicorn/uvicorn workers) and use real Redis caching.

16 — Credits, acknowledgements & licenses

Project authors: Mohamed Aziz Aguir & Yahya Kaddour

Mohamed Aziz Aguir — mohamedaziz.aguir@outlook.com
 — +216 93 236 576

Yahya Kaddour — (please provide Yahya’s email for contact block)

Supervisor: Mohamed Amine Boussaid

Built while working with Capgemini; academic affiliation: ESPRIT.

Third-party software & websites referenced:

fastapi — https://fastapi.tiangolo.com/
 (MIT-like license)

llama.cpp — https://github.com/ggerganov/llama.cpp
 (check upstream license)

Hugging Face model hub — https://huggingface.co
 (model license per model)

Elasticsearch — https://www.elastic.co/
 (Apache-compatible or Elastic license depending on version)

Redis — https://redis.io/

Next.js — https://nextjs.org/

Framer Motion, TailwindCSS, axios, framer-motion, etc. — check each package’s license in package.json and node_modules.

Please ensure you review licenses for each dependency and the Lily model weights before redistribution.

17 — Contact & support

Project authors:

Mohamed Aziz Aguir — mohamedaziz.aguir@outlook.com
 — +216 93 236 576

Yahya Kaddour — (please add email here if desired)

Supervisor: Mohamed Amine Boussaid

Appendix — Useful commands

Start backend:

cd ~/CTI/backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000


Start frontend:

cd ~/CTI/frontend
npm run dev


Start ES + Redis (docker compose quick):

docker run -d --name es -p 9200:9200 -e "discovery.type=single-node" docker.elastic.co/elasticsearch/elasticsearch:8.13.0
docker run -d --name redis -p 6379:6379 redis:7


Download model (example):

export HF_TOKEN="hf_xxx"
python3 scripts/download_model.py --repo Nekuromento/Lily-Cybersecurity-7B-v0.2-Q8_0-GGUF --filename lily-cybersecurity-7b-v0.2-q8_0.gguf --out-dir backend/models/lilly


Build llama.cpp:

cd ~/CTI/backend/models/llama.cpp
LLAMA_CURL=1 make


Run llama-server:

~/CTI/backend/models/llama.cpp/build/bin/llama-server -m ~/CTI/backend/models/lilly/lily-cybersecurity-7b-v0.2-q8_0.gguf --host 0.0.0.0 --port 8080 --ctx-size 4096
