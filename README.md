#!/usr/bin/env bash
# setup_backend_fixed.sh
# One-shot bootstrap script for your CTI backend (FastAPI + Elasticsearch + Redis)
# Usage: run from your backend/ directory:
#   bash setup_backend_fixed.sh            # basic setup (docker, es, redis, venv, deps, start uvicorn)
#   bash setup_backend_fixed.sh with-lilly # optional: clone & build llama.cpp (no model download)
#
# Notes:
# - Designed for Ubuntu/Debian. Adjust if using another distro.
# - Uses Docker for Elasticsearch + Redis. Requires Docker to be installed (script installs if missing).
# - Creates a Python venv at ./venv, installs pinned requirements, creates .env, and starts uvicorn in background.
# - You must still download the GGUF model manually (Hugging Face) if you want Lilly local LLM.
#
set -euo pipefail

### ---------- Configuration (edit variables below if needed) ----------
REPO_DIR="$(pwd)"
APP_MAIN="${REPO_DIR}/app/main.py"

PYTHON_BIN="$(command -v python3 || true)"
VENV_DIR="${REPO_DIR}/.venv"
REQ_FILE="${REPO_DIR}/requirements.txt"
ENV_FILE="${REPO_DIR}/.env"
DOCKER_COMPOSE_FILE="${REPO_DIR}/docker-compose.yml"
UVICORN_LOG="${REPO_DIR}/uvicorn.log"
UVICORN_PIDFILE="${REPO_DIR}/uvicorn.pid"

# Versions you provided
PYTHON_VERSION_REQUIRED="3.13"
ELASTICSEARCH_IMAGE="docker.elastic.co/elasticsearch/elasticsearch:8.13.0"
REDIS_IMAGE="redis:7-alpine"

# .env defaults
ES_HOST_DEFAULT="http://localhost:9200"
REDIS_URL_DEFAULT="redis://localhost:6379/0"
LILLY_SERVER_URL_DEFAULT="http://localhost:8080"

# Author / contact
AUTHOR_NAME="Mohamed Aziz Aguir & Yahya Kaddour"
AUTHOR_EMAIL="mohamedaziz.aguir@outlook.com"
SUPERVISOR="Mohamed Amine Boussaid"

### ---------- Helpers ----------
log()  { echo -e "\033[1;36m[INFO]\033[0m $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
err()  { echo -e "\033[1;31m[ERROR]\033[0m $*" 1>&2; }

### ---------- Basic validation ----------
if [[ ! -f "${APP_MAIN}" ]]; then
  err "Cannot find app/main.py in ${REPO_DIR}. Run this script from the backend/ directory."
  exit 1
fi

SUDO_CMD=""
if [[ "$(id -u)" -ne 0 ]]; then
  SUDO_CMD="sudo"
fi

### ---------- Ensure minimal system packages ----------
log "Installing basic packages if missing (git, curl, ca-certificates)..."
if ! command -v git >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then
  ${SUDO_CMD} apt-get update
  ${SUDO_CMD} apt-get install -y git curl ca-certificates gnupg lsb-release apt-transport-https
fi

### ---------- Install Docker if missing ----------
if ! command -v docker >/dev/null 2>&1; then
  log "Docker not found — installing Docker..."
  ${SUDO_CMD} mkdir -p /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | ${SUDO_CMD} gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | ${SUDO_CMD} tee /etc/apt/sources.list.d/docker.list > /dev/null
  ${SUDO_CMD} apt-get update
  ${SUDO_CMD} apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  log "Docker installed."
else
  log "Docker already installed."
fi

# Ensure user is in docker group (so docker can be run without sudo)
if ! id -nG "$USER" | grep -qw docker; then
  log "Adding $USER to docker group..."
  ${SUDO_CMD} usermod -aG docker "$USER" || true
  warn "User added to docker group. You must logout/login (or reboot) for this to take effect."
fi

# Determine docker-compose command (modern 'docker compose' or fallback 'docker-compose')
DOCKER_COMPOSE_CMD="docker compose"
if ! ${DOCKER_COMPOSE_CMD} version >/dev/null 2>&1; then
  if command -v docker-compose >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker-compose"
  else
    warn "Neither 'docker compose' nor 'docker-compose' available. Docker Compose plugin should be installed with Docker."
  fi
fi
log "Using compose command: ${DOCKER_COMPOSE_CMD}"

### ---------- Create docker-compose.yml if missing ----------
if [[ -f "${DOCKER_COMPOSE_FILE}" ]]; then
  log "docker-compose.yml exists - leaving untouched."
else
  log "Writing ${DOCKER_COMPOSE_FILE} for Elasticsearch + Redis..."
  cat > "${DOCKER_COMPOSE_FILE}" <<'YAML'
version: "3.8"
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.13.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    ulimits:
      memlock:
        soft: -1
        hard: -1
    mem_limit: 1g
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
YAML
  log "docker-compose.yml created."
fi

### ---------- Start Elasticsearch & Redis ----------
log "Starting Elasticsearch and Redis with compose..."
${DOCKER_COMPOSE_CMD} -f "${DOCKER_COMPOSE_FILE}" up -d

log "Waiting for Elasticsearch to respond on http://localhost:9200 ..."
TRIES=0
MAX_TRIES=40
until curl -sS http://localhost:9200 >/dev/null 2>&1 || [[ ${TRIES} -ge ${MAX_TRIES} ]]; do
  TRIES=$((TRIES+1))
  printf "."
  sleep 2
done
echo
if ! curl -sS http://localhost:9200 >/dev/null 2>&1; then
  warn "Elasticsearch did not respond after $((2*MAX_TRIES))s. Check logs: ${DOCKER_COMPOSE_CMD} -f ${DOCKER_COMPOSE_FILE} logs elasticsearch"
else
  log "Elasticsearch is up."
fi

### ---------- Python venv & dependencies ----------
if [[ -d "${VENV_DIR}" ]]; then
  log "Virtualenv exists at ${VENV_DIR}."
else
  log "Creating Python virtualenv at ${VENV_DIR}..."
  if [[ -n "${PYTHON_BIN}" ]]; then
    "${PYTHON_BIN}" -m venv "${VENV_DIR}"
  else
    ${SUDO_CMD} apt-get update
    ${SUDO_CMD} apt-get install -y python3-venv python3-pip
    python3 -m venv "${VENV_DIR}"
  fi
fi

# Activate venv
# shellcheck source=/dev/null
source "${VENV_DIR}/bin/activate"

# Create requirements.txt if missing (pinned versions provided)
if [[ -f "${REQ_FILE}" ]]; then
  log "requirements.txt found - using it."
else
  log "Generating default requirements.txt (edit as needed)."
  cat > "${REQ_FILE}" <<'REQ'
fastapi==0.116.1
uvicorn[standard]==0.23.2
elasticsearch[async]==8.13.0
httpx==0.24.1
aiohttp==3.8.4
redis==5.0.4
python-dotenv==1.0.0
pydantic==1.10.11
# Optional LLM bindings (install only if using local LLM)
# llama_cpp_python==0.3.16
REQ
fi

log "Upgrading pip & installing requirements..."
pip install --upgrade pip setuptools wheel
pip install -r "${REQ_FILE}"

### ---------- Create .env defaults if missing ----------
if [[ -f "${ENV_FILE}" ]]; then
  log ".env already exists, preserving it."
else
  log "Creating .env with defaults at ${ENV_FILE}."
  cat > "${ENV_FILE}" <<EOF
# .env - autogenerated

APP_ENV=development
DEBUG=true
HOST=0.0.0.0
PORT=8000

# Elasticsearch
ES_HOST=${ES_HOST_DEFAULT}
ES_USERNAME=
ES_PASSWORD=

# Redis
REDIS_URL=${REDIS_URL_DEFAULT}

# External APIs
VT_API_KEY=
OTX_API_KEY=

# Local Lilly/LLM server (optional)
LILLY_SERVER_URL=${LILLY_SERVER_URL_DEFAULT}

# Project metadata
PROJECT_AUTHORS="${AUTHOR_NAME}"
PROJECT_CONTACT="${AUTHOR_EMAIL}"
PROJECT_SUPERVISOR="${SUPERVISOR}"
PROJECT_STARTED="2025-06-23"
PROJECT_FINISHED="$(date -I)"
EOF
fi

### ---------- Start FastAPI (uvicorn) ----------
if [[ -f "${UVICORN_PIDFILE}" ]]; then
  OLD_PID="$(cat "${UVICORN_PIDFILE}" || true)"
  if [[ -n "${OLD_PID}" ]] && ps -p "${OLD_PID}" >/dev/null 2>&1; then
    warn "Uvicorn already running (pid ${OLD_PID}). Not starting a second instance."
  else
    log "Starting uvicorn (background)..."
    nohup "${VENV_DIR}/bin/python" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > "${UVICORN_LOG}" 2>&1 &
    echo $! > "${UVICORN_PIDFILE}"
    log "Uvicorn started (pid $(cat ${UVICORN_PIDFILE})). Logs: ${UVICORN_LOG}"
  fi
else
  log "Starting uvicorn (background)..."
  nohup "${VENV_DIR}/bin/python" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > "${UVICORN_LOG}" 2>&1 &
  echo $! > "${UVICORN_PIDFILE}"
  log "Uvicorn started (pid $(cat ${UVICORN_PIDFILE})). Logs: ${UVICORN_LOG}"
fi

### ---------- Optional: llama.cpp (Lilly) setup ----------
if [[ "${1:-}" == "with-lilly" ]]; then
  log "Optional: cloning & building llama.cpp..."
  MODELS_DIR="${REPO_DIR}/models"
  LLAMA_DIR="${MODELS_DIR}/llama.cpp"
  mkdir -p "${MODELS_DIR}"
  if [[ -d "${LLAMA_DIR}" ]]; then
    log "llama.cpp already exists at ${LLAMA_DIR}."
  else
    git clone https://github.com/ggerganov/llama.cpp.git "${LLAMA_DIR}"
    log "Building llama.cpp (LLAMA_CURL=1). This may take time and may require build tools."
    pushd "${LLAMA_DIR}" >/dev/null
    LLAMA_CURL=1 make
    popd >/dev/null
    log "llama.cpp built. Download GGUF model manually from Hugging Face and place under ${MODELS_DIR}/lilly/"
    cat <<LMSG

Lilly model notes:
- Model: https://huggingface.co/Nekuromento/Lily-Cybersecurity-7B-v0.2-Q8_0-GGUF
- Download the GGUF file (requires Hugging Face auth for some models).
- Place file at: ${MODELS_DIR}/lilly/lily-cybersecurity-7b-v0.2-q8_0.gguf
- Example server start (adjust paths):
  cd ${LLAMA_DIR}/build/bin
  ./llama-server -m ${MODELS_DIR}/lilly/lily-cybersecurity-7b-v0.2-q8_0.gguf --host 0.0.0.0 --port 8080 --ctx-size 4096 --n-gpu-layers 0

LMSG
  fi
fi

### ---------- Final summary ----------
cat <<SUMMARY

✅ Setup script completed.

Checklist:
- Docker & compose: should be installed.
- Elasticsearch (8.13.0) + Redis: started via ${DOCKER_COMPOSE_CMD} -f ${DOCKER_COMPOSE_FILE} up -d
- Python venv: ${VENV_DIR}
- Requirements installed from: ${REQ_FILE}
- .env created at: ${ENV_FILE}
- Uvicorn started in background (pid file: ${UVICORN_PIDFILE}; logs: ${UVICORN_LOG})
  - Open API docs: http://localhost:8000/docs

Useful commands:
- Tail uvicorn logs: tail -f ${UVICORN_LOG}
- Docker compose logs: ${DOCKER_COMPOSE_CMD} -f ${DOCKER_COMPOSE_FILE} logs elasticsearch
- Stop services:
    ${DOCKER_COMPOSE_CMD} -f ${DOCKER_COMPOSE_FILE} down
    kill \$(cat ${UVICORN_PIDFILE}) || true
- Recreate venv: rm -rf ${VENV_DIR} && bash setup_backend_fixed.sh

If something failed:
- Check ${UVICORN_LOG} for Python tracebacks.
- Ensure Elasticsearch container health: ${DOCKER_COMPOSE_CMD} -f ${DOCKER_COMPOSE_FILE} ps
- If you were added to docker group, logout/login to apply group membership.

SUMMARY

exit 0
