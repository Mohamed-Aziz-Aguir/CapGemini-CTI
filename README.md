Project: Cyber Threat Intelligence Dashboard (CTI)
Repository: https://github.com/Mohamed-Aziz-Aguir/CapGemini-CTI

Authors: Mohamed Aziz Aguir & Yahya Kaddour
Organization / Context: Capgemini (student project at ESPRIT)
Supervisor: Mohamed Amine Boussaid
Timeline: Start 23 June — Finished today

What it is
A full-stack Cyber Threat Intelligence dashboard:

CVE search & browse (paginated)

Zero-Day tracker (search & list)

Threat Catalog (many indexed threat categories)

IOC Analyzer (OTX + VirusTotal cached in Elasticsearch)

Optional local AI assistant “Lilly” (llama.cpp + GGUF model) with streaming

Tech stack

Backend: FastAPI (Python 3.13)

Search DB: Elasticsearch 8.13.0

Cache: Redis 5.0.4 (optional)

Frontend: Next.js + React + Tailwind + Framer Motion

AI (optional): llama.cpp, llama_cpp_python 0.3.16, GGUF model (Nekuromento/Lily-Cybersecurity-7B-v0.2-Q8_0-GGUF on HuggingFace)

HTTP client: axios

Quick start (developer)

Start Elasticsearch (docker)

docker run -d --name es-local -p 9200:9200 -e "discovery.type=single-node" docker.elastic.co/elasticsearch/elasticsearch:8.13.0


Backend

cd ~/CTI/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# set ELASTICSEARCH_URL=http://localhost:9200 in .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# Swagger UI: http://localhost:8000/docs


Frontend

cd ~/CTI/frontend
npm install
# .env.local -> NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
npm run dev
# UI: http://localhost:3000


Optional: Lilly LLM (local)

Clone & build llama.cpp: git clone https://github.com/ggerganov/llama.cpp && cd llama.cpp && LLAMA_CURL=1 make

Download GGUF model to backend/models/lilly/ (Hugging Face repo: Nekuromento/Lily-Cybersecurity-7B-v0.2-Q8_0-GGUF).

Start server (example):

./build/bin/llama-server \
  -m ~/CTI/backend/models/lilly/lily-cybersecurity-7b-v0.2-q8_0.gguf \
  --host 0.0.0.0 \
  --port 8080 \
  --ctx-size 4096 \
  --n-gpu-layers 0


Set LLAMA_SERVER_URL=http://localhost:8080 in backend .env.

Important endpoints

GET /zeroday/search?query=... — search zero-day (omit/empty to list all)

GET /threat-catalog/get?category=<index> — fetch threat catalog by index

POST /api/ioc/analyze — body { "value": "<ioc>" }

GET /api/search/all?q=&page=1&page_size=10 — CVE search / browse

POST /api/lilly/chat — chat with Lilly (streaming support)

Exact ES indices used

asrg-cve, zeroday, otx-iocs, vt-iocs,
execution, privilege_escalation, lateral_movement, initial_access,
collection, command_and_control, defense_ecasion,
credential_access, discovery, persistence, tampering,
exfiltration, spoofing, information_disclosure, repudiation, manipulate_environment


Note: defense_ecasion is present in the dataset (typo preserved).

Contact

Mohamed Aziz Aguir — mohamedaziz.aguir@outlook.com
 — +216 93 236 576

Yahya Kaddour — (add email if needed)

Links & attributions

Repo: https://github.com/Mohamed-Aziz-Aguir/CapGemini-CTI

llama.cpp: https://github.com/ggerganov/llama.cpp

Lily model (Hugging Face): https://huggingface.co/Nekuromento/Lily-Cybersecurity-7B-v0.2-Q8_0-GGUF

FastAPI, Elasticsearch, Redis, Next.js, Tailwind, Framer Motion, axios — respective official sites
