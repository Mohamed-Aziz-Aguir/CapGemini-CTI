Cyber Threat Intelligence Dashboard (CTI)

Repository: https://github.com/Mohamed-Aziz-Aguir/CapGemini-CTI

Authors: Mohamed Aziz Aguir & Yahya Kaddour
Organization / Context: Capgemini (student project at ESPRIT)
Supervisor: Mohamed Amine Boussaid
Timeline: Start 23 June — Finished today

Table of contents

Project overview

Features

Tech stack & versions

Architecture diagram (quick)

Prerequisites

Getting started — Quick setup (developer)

1) Elasticsearch (Docker)

2) Backend (FastAPI)

3) Frontend (Next.js)

4) Optional: Lilly LLM (llama.cpp + GGUF) — Local AI assistant

Environment variables (.env example)

API endpoints (useful ones)

Elasticsearch indices used in this project

Useful curl examples

Troubleshooting & tips

Diagrams & assets

License & Attributions

Contact

Project overview

This repository implements a Cyber Threat Intelligence dashboard containing:

CVE search & browse with pagination.

Zero-day tracker (search + list).

Threat catalog grouped by many tactical categories.

IOC analyzer (queries OTX + VirusTotal + optional Elasticsearch cache).

Optional local LLM assistant (“Lilly”) using llama.cpp and GGUF model (streaming responses).

Frontend: Next.js + React + Tailwind + Framer Motion.
Backend: FastAPI (async) with Elasticsearch as primary datastore; Redis optional for caching.
AI: optional local inference via llama.cpp serving a GGUF model (Nekuromento Lily Cybersecurity 7B).

Features

Elegant UI with tailwind + framer motion components.

Streaming chat for Lilly (if llama server is running).

Threat catalog with multiple indices and collapsible subthreat details.

IOC analyze endpoint which can query external APIs and/or Elasticsearch cache.

Zero-day search with keyword or ID search; supports listing all entries.

CVE browse/search with paginated results.

Tech stack & versions

Python: 3.13

FastAPI: 0.116.1

Elasticsearch: 8.13.0

Redis: 5.0.4 (optional)

llama_cpp_python: 0.3.16 (optional, for integration)

Node / Next.js: (project uses Next.js; install latest LTS Node)

Frontend libraries: Tailwind CSS, Framer Motion, axios, lucide-react

Keep these versions in mind when reproducing the environment.

Architecture diagram (quick)
[User Browser] <---> [Next.js Frontend (3000)]
       |
       v
[FastAPI Backend (8000)] <---> [Elasticsearch (9200)]
       |
       +---> [Redis (optional, caching)]
       |
       +---> [llama-server (8080) via llama.cpp] (optional for Lilly)


You can produce detailed diagrams via draw.io or mermaid (tools recommended in Diagrams & assets section).

Prerequisites

Install on Ubuntu (example):

Git

Node (LTS)

Python 3.13

Docker (for Elasticsearch)

Build tools for llama.cpp (GCC/Clang, make, etc.) — only if you want the AI locally

Getting started — Quick setup (developer)

This section assumes you cloned the repo already:

git clone https://github.com/Mohamed-Aziz-Aguir/CapGemini-CTI
cd CapGemini-CTI

1) Elasticsearch (Docker)

Start a local Elasticsearch (single-node) with Docker:

docker run -d --name es-local -p 9200:9200 \
  -e "discovery.type=single-node" \
  docker.elastic.co/elasticsearch/elasticsearch:8.13.0


Wait a few seconds then verify:

curl http://localhost:9200

2) Backend (FastAPI)
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# Create .env file according to the example below
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000


Swagger UI: http://localhost:8000/docs

OpenAPI JSON: http://localhost:8000/openapi.json

If you get Elasticsearch errors, check ELASTICSEARCH_URL in your .env and that ES is running and accessible.

3) Frontend (Next.js)
cd frontend
npm install
# set .env.local -> NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
npm run dev
# site served at http://localhost:3000


The frontend expects the backend endpoints listed below; the default NEXT_PUBLIC_API_BASE_URL should be http://localhost:8000.

4) Optional: Lilly LLM (llama.cpp + GGUF)

If you want to run the local AI assistant (optional):

Download/build llama.cpp

# choose a working directory, e.g. ~/CTI/backend/models
cd ~/CTI/backend/models
git clone https://github.com/ggerganov/llama.cpp.git
cd llama.cpp
# Build with curl model fetching support (optional)
LLAMA_CURL=1 make


Download GGUF model

You must follow Hugging Face model download rules (you may need to huggingface-cli login):

# Example using huggingface-cli (requires authentication)
huggingface-cli repo clone Nekuromento/Lily-Cybersecurity-7B-v0.2-Q8_0-GGUF
# OR download the .gguf file using `wget` if allowed:
# wget "<url-to-lily-cybersecurity-7b-v0.2-q8_0.gguf>" -O lily-cybersecurity-7b-v0.2-q8_0.gguf
# Place the .gguf into backend/models/lilly/


Run server (example)

# From llama.cpp build directory where the server binary exists
cd ~/CTI/backend/models/llama.cpp/build/bin
./llama-server \
  -m ~/CTI/backend/models/lilly/lily-cybersecurity-7b-v0.2-q8_0.gguf \
  --host 0.0.0.0 \
  --port 8080 \
  --ctx-size 4096 \
  --n-gpu-layers 0


Integrate with backend

Set LLAMA_SERVER_URL=http://localhost:8080 and LLILLY_MODEL_PATH (if required) in backend .env. The backend contains a streaming wrapper that will forward responses from that server to the frontend.

Environment variables (.env example)

Place a .env file in backend/ (used by your FastAPI config). Example:

# backend/.env
ELASTICSEARCH_URL=http://localhost:9200
REDIS_URL=redis://localhost:6379/0
LLAMA_SERVER_URL=http://localhost:8080
LLILLY_MODEL_PATH=local-lilly-model  # optional, depends on your LLM setup
SECRET_KEY=some-secret   # optional


Place a .env.local in frontend/:

# frontend/.env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

API endpoints (useful ones)

GET /zeroday/search?query=... — search zero-day. If query is omitted or blank, the backend returns all entries (paginated or limited to 100 in current service).

GET /threat-catalog/get?category=<index> — returns all documents from the specified threat index (case-insensitive).

POST /api/ioc/analyze — body { "value": "<ioc>" } — returns combined results (checks Elasticsearch cache then external APIs).

GET /api/search/all?q=&page=1&page_size=10 — search / browse CVEs with pagination.

POST /api/lilly/chat — body { "message": "..." }, query param stream=true|false — the backend streams content if stream=true.

Elasticsearch indices used in this project

These indices are referenced by the frontend and backend services. Keep names exact (typos preserved intentionally because the indices exist that way in ES):

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
defense_ecasion       # note: original index name contains 'ecasion' (typo)
credential_access
discovery
persistence
tampering
exfiltration
spoofing
information_disclosure
repudiation
manipulate_environment

Useful curl examples

Search zeroday keyword:

curl -G "http://localhost:8000/zeroday/search" --data-urlencode "query=electric"


Get threat catalog for execution:

curl "http://localhost:8000/threat-catalog/get?category=execution"


Chat Lilly (non-streaming):

curl -X POST "http://localhost:8000/api/lilly/chat?stream=false" -H "Content-Type: application/json" -d '{"message":"hello what is cve"}'


Analyze IOC:

curl -X POST "http://localhost:8000/api/ioc/analyze" -H "Content-Type: application/json" -d '{"value":"8.8.8.8"}'


CVE search:

curl "http://localhost:8000/api/search/all?q=CVE-2024-XXXX&page=1&page_size=10"

Troubleshooting & tips

404 /zeroday/search from frontend: ensure frontend API_BASE matches backend host:port. If using http://localhost:8000 for backend, set NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 in frontend/.env.local and restart the dev server.

CORS: Main app.main already sets permissive CORS for development. In production, restrict origins.

Large ES queries: some endpoints use size: 100 (threat catalog, zeroday). For production datasets use paginated endpoints instead of match_all.

llama model downloads: Hugging Face often requires authentication or git-lfs. Use huggingface-cli login and huggingface-cli repo clone or the provided download instructions on the model page.

Memory / CPU: running 7B models locally requires significant RAM; the GGUF quantized model reduces resource needs but still use caution.

Typos in index names: defense_ecasion exists in current data; rename indexes carefully if you decide to correct spelling.

Diagrams & assets

I recommend adding diagrams in an /docs/ folder:

architecture.png (deployment diagram)

dataflow.png (how requests go from frontend → backend → ES → external APIs)

llama-setup.png (optional LLM pipeline)

You can draw these using draw.io (diagrams.net) or Mermaid. If you want, I can generate Mermaid diagrams you can paste into GitHub README (GitHub requires plugins to render Mermaid; alternatively include generated PNGs).

Repository structure (high level)
/backend
  /app
    /api                 # fastapi routes (ioc, lilly, zeroday, threat-catalog, search)
    /services            # business logic (ZeroDayService, CVEService, LillyService, etc.)
    /core                # elasticsearch client, config
    main.py
  requirements.txt

/frontend
  /components
  /app/pages             # next.js pages
  .env.local
  package.json
  tailwind.config.js

Credits & Attributions

Project authors: Mohamed Aziz Aguir & Yahya Kaddour

Supervisor: Mohamed Amine Boussaid

Model (optional): Nekuromento/Lily-Cybersecurity-7B-v0.2-Q8_0-GGUF from Hugging Face (follow license and model terms).

llama.cpp by Georgi Gerganov — https://github.com/ggerganov/llama.cpp

FastAPI — https://fastapi.tiangolo.com

Elasticsearch — https://www.elastic.co

Next.js — https://nextjs.org

Tailwind CSS — https://tailwindcss.com

Framer Motion — https://www.framer.com/motion

axios — https://axios-http.com

Please respect the license/usage requirements of each external dependency and model provider.

License

This project is provided as-is. Add your preferred license file (e.g., LICENSE with MIT or Team/Company license). Example: MIT license recommended if you want permissive usage.

Contact

Mohamed Aziz Aguir — mohamedaziz.aguir@outlook.com
 — +216 93 236 576

Yahya Kaddour — (please add email if desired)

Appendix — Example .env files (copy & adapt)

backend/.env

ELASTICSEARCH_URL=http://localhost:9200
REDIS_URL=redis://localhost:6379/0
LLAMA_SERVER_URL=http://localhost:8080
LLILLY_MODEL_PATH=~/CTI/backend/models/lilly/lily-cybersecurity-7b-v0.2-q8_0.gguf
SECRET_KEY=very-secret


frontend/.env.local

NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
