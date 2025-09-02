#!/usr/bin/env bash
# setup_backend.sh
# One-shot bootstrap script for your CTI backend (FastAPI + Elasticsearch + Redis)
# Usage: copy-paste and run from your backend/ directory:
#   bash setup_backend.sh            # basic setup (docker, es, redis, venv, deps, start uvicorn)
#   bash setup_backend.sh with-lilly # do the optional llama.cpp clone & build (no model download)
#
# Notes:
# - This script assumes Ubuntu/Debian environment.
# - It uses Docker for Elasticsearch + Redis.
# - It will create a Python venv at ./venv, install pinned requirements, create .env, and start uvicorn in background.
# - If you want to run as a different user or customize envs, edit the generated .env after running.
# - You must still download the GGUF model manually (Hugging Face) if you want Lilly local LLM.
#
set -euo pipefail

### ---------- Configuration (edit variables below if needed) ----------
# The script assumes you run it from the 'backend' directory (where app/main.py lives).
REPO_DIR="$(pwd)"
APP_MAIN="${REPO_DIR}/app/main.py"

PYTHON_BIN=$(command -v python3 || true)
VENV_DIR="${REPO_DIR}/.venv"
REQ_FILE="${REPO_DIR}/requirements.txt"
ENV_FILE="${REPO_DIR}/.env"
DOCKER_COMPOSE_FILE="${REPO_DIR}/docker-compose.yml"
UVICORN_LOG="${REPO_DIR}/uvicorn.log"
UVICORN_PIDFILE="${REPO_DIR}/uvicorn.pid"

# Versions (these match the ones you told me)
PYTHON_VERSION_REQUIRED="3.13"
ELASTICSEARCH_IMAGE="docker.elastic.co/elasticsearch/elasticsearch:8.13.0"
REDIS_IMAGE="redis:7-alpine"

# Default environment variables for .env (safe defaults)
ES_HOST_DEFAULT="http://localhost:9200"
REDIS_URL_DEFAULT="redis://localhost:6379/0"
LILLY_SERVER_URL_DEFAULT="http://localhost:8080"

# Author / contact info (from you)
AUTHOR_NAME="Mohamed Aziz Aguir & Yahya Kaddour"
AUTHOR_EMAIL="mohamedaziz.aguir@outlook.com"
SUPERVISOR="Mohamed Amine Boussaid"

### ---------- Helper functions ----------
log() { echo -e "\033[1;36m[INFO]\033[0m $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
err() { echo -e "\033[1;31m[ERROR]\033[0m $*" 1>&2; }

require_file_exists() {
  if [[ ! -f "$1" ]]; then
    err "Required file not found: $1"
    exit 1
  fi
}

### ---------- Basic checks ----------
if [[ ! -f "${APP_MAIN}" ]]; then
  err "I can't find app/main.py in ${REPO_DIR}. Please run this script from the backend/ directory of your repository."
  exit 1
fi

# detect if running as root
SUDO_CMD=""
if [[ "$(id -u)" -ne 0 ]]; then
  SUDO_CMD="sudo"
fi

### ---------- Install system packages (docker prerequisites) ----------
log "Installing basic system packages (git, curl, ca-certificates) if missing..."
if ! command -v git >/dev/null 2>&1; then
  ${SUDO_CMD} apt-get update
  ${SUDO_CMD} apt-get install -y git curl ca-certificates gnupg lsb-release apt-transport-https
fi

### ---------- Install Docker (if missing) ----------
if ! command -v docker >/dev/null 2>&1; then
  log "Docker not found — installing Docker engine..."
  # Add Docker's official GPG key and set up repository
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

# Ensure current user can run docker (add to docker group)
if groups "$USER" | grep -q -v docker; then
  if ! groups "$USER" | grep -q docker; then
    log "Adding current user to docker group (so you can run docker without sudo)..."
    ${SUDO_CMD} usermod -aG docker "$USER" || true
    warn "If you were just added to docker group, you must log out and log back in for this to take effect."
  fi
fi

### ---------- Create docker-compose.yml for Elasticsearch + Redis ----------
if [[ -f "${DOCKER_COMPOSE_FILE}" ]]; then
  log "docker-compose.yml already exists — keeping it."
else
  log "Creating docker-compose.yml for Elasticsearch and Redis..."
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

### ---------- Start Elasticsearch & Redis via docker compose ----------
log "Starting Elasticsearch and Redis via docker compose..."
docker compose -f "${DOCKER_COMPOSE_FILE}" up -d

# Wait for Elasticsearch to be ready (simple loop)
log "Waiting for Elasticsearch to be healthy on http://localhost:9200 ..."
TRIES=0
MAX_TRIES=30
until curl -sS http://localhost:9200 >/dev/null 2>&1 || [[ ${TRIES} -ge ${MAX_TRIES} ]]; do
  TRIES=$((TRIES+1))
  echo -n "."
  sleep 2
done
echo
if ! curl -sS http://localhost:9200 >/dev/null 2>&1; then
  warn "Elasticsearch didn't respond after $((2*MAX_TRIES))s. Check the docker logs: docker compose -f ${DOCKER_COMPOSE_FILE} logs elasticsearch"
else
  log "Elasticsearch appears to be running."
fi

### ---------- Prepare Python venv and install dependencies ----------
if [[ -d "${VENV_DIR}" ]]; then
  log "Virtualenv found at ${VENV_DIR} — activating and installing dependencies."
else
  log "Creating Python virtual environment at ${VENV_DIR}..."
  if [[ -n "${PYTHON_BIN}" ]]; then
    "${PYTHON_BIN}" -m venv "${VENV_DIR}"
  else
    ${SUDO_CMD} apt-get update
    ${SUDO_CMD} apt-get install -y python3-venv python3-pip
    python3 -m venv "${VENV_DIR}"
  fi
fi

# Activate venv for subsequent pip installs in this script
# shellcheck source=/dev/null
source "${VENV_DIR}/bin/activate"

# Create requirements.txt if missing (use versions you specified)
if [[ -f "${REQ_FILE}" ]]; then
  log "requirements.txt found — installing from it."
else
  log "Creating a default requirements.txt with pinned versions (you can edit it afterwards)."
  cat > "${REQ_FILE}" <<'REQ'
fastapi==0.116.1
uvicorn[standard]==0.23.2
elasticsearch[async]==8.13.0
httpx==0.24.1
aiohttp==3.8.4
redis==5.0.4
python-dotenv==1.0.0
pydantic==1.10.11
# optional LLM bindings (install only if you plan to use local LLM)
# llama_cpp_python==0.3.16
REQ
fi

log "Installing Python dependencies (this can take a while)..."
pip install --upgrade pip setuptools wheel
pip install -r "${REQ_FILE}"

### ---------- Create .env with defaults if missing ----------
if [[ -f "${ENV_FILE}" ]]; then
  log ".env already exists — preserving it."
else
  log "Creating .env with sensible defaults. Edit as needed: ${ENV_FILE}"
  cat > "${ENV_FILE}" <<EOF
# .env - autogenerated. Edit values as needed.

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

### ---------- Run database migrations or initial indexing (optional) ----------
# (If you have initial indexing scripts, run them here or document them.)
log "Skipping initial indexing step (you may have seed scripts in your repo)."

### ---------- Start the FastAPI backend (uvicorn) ----------
if [[ -f "${UVICORN_PIDFILE}" ]]; then
  OLD_PID=$(cat "${UVICORN_PIDFILE}" || true)
  if [[ -n "${OLD_PID}" ]] && ps -p "${OLD_PID}" >/dev/null 2>&1; then
    warn "A uvicorn process appears to be running (pid ${OLD_PID}). I will not start a new one."
  else
    log "Starting uvicorn (backend) in background..."
    nohup "${VENV_DIR}/bin/uvicorn" app.main:app --host 0.0.0.0 --port 8000 --reload > "${UVICORN_LOG}" 2>&1 &
    echo $! > "${UVICORN_PIDFILE}"
    log "uvicorn started (pid $(cat ${UVICORN_PIDFILE})). Logs: ${UVICORN_LOG}"
  fi
else
  log "Starting uvicorn (backend) in background..."
  nohup "${VENV_DIR}/bin/uvicorn" app.main:app --host 0.0.0.0 --port 8000 --reload > "${UVICORN_LOG}" 2>&1 &
  echo $! > "${UVICORN_PIDFILE}"
  log "uvicorn started (pid $(cat ${UVICORN_PIDFILE})). Logs: ${UVICORN_LOG}"
fi

### ---------- Optional: llama.cpp (Lilly) setup if requested ----------
if [[ "${1:-}" == "with-lilly" ]]; then
  log "=== Optional Lilly (llama.cpp) setup requested ==="
  MODELS_DIR="${REPO_DIR}/models"
  LLAMA_DIR="${MODELS_DIR}/llama.cpp"
  mkdir -p "${MODELS_DIR}"
  if [[ -d "${LLAMA_DIR}" ]]; then
    log "llama.cpp already cloned in ${LLAMA_DIR}."
  else
    log "Cloning llama.cpp into ${LLAMA_DIR}..."
    git clone https://github.com/ggerganov/llama.cpp.git "${LLAMA_DIR}"
    log "Building llama.cpp (this may take some time)..."
    # Build with LLAMA_CURL=1 so you can use HF repo IDs with built helper binaries.
    pushd "${LLAMA_DIR}" >/dev/null
    # Try to build - may need build tools installed
    LLAMA_CURL=1 make
    popd >/dev/null
    log "llama.cpp built. You must download the GGUF model manually (Hugging Face)."
  fi

  cat <<LMSG

Lilly model installation notes:
- You indicated the model to use: https://huggingface.co/Nekuromento/Lily-Cybersecurity-7B-v0.2-Q8_0-GGUF
- The model file (e.g. lily-cybersecurity-7b-v0.2-q8_0.gguf) must be downloaded manually (Hugging Face auth may be required).
- Place the GGUF file under: ${REPO_DIR}/models/lilly/
- Example server start command (adapt paths):
  cd ${LLAMA_DIR}/build/bin
  ./llama-server -m ${REPO_DIR}/models/lilly/lily-cybersecurity-7b-v0.2-q8_0.gguf --host 0.0.0.0 --port 8080 --ctx-size 4096 --n-gpu-layers 0

LMSG
fi

### ---------- Final summary & next steps ----------
cat <<SUMMARY

✅ Setup finished (or mostly finished). Quick checklist:

- Docker & docker-compose plugin: installed
- Elasticsearch (8.13.0) + Redis: started via docker-compose
  - Elasticsearch URL: http://localhost:9200
- Python virtualenv created at: ${VENV_DIR}
- Requirements installed from: ${REQ_FILE}
- .env created at: ${ENV_FILE} (edit to add API keys & secrets)
- Uvicorn started in background (pid file: ${UVICORN_PIDFILE}; logs: ${UVICORN_LOG})
  - Open API docs: http://localhost:8000/docs
- Optional: run the script with "with-lilly" to clone and build llama.cpp (but you must still download the GGUF model manually).

Helpful commands:
- Show uvicorn logs: tail -f ${UVICORN_LOG}
- Show docker logs: docker compose -f ${DOCKER_COMPOSE_FILE} logs elasticsearch
- Stop services:
    docker compose -f ${DOCKER_COMPOSE_FILE} down
    kill \$(cat ${UVICORN_PIDFILE}) || true
- Recreate venv: rm -rf ${VENV_DIR} && bash setup_backend.sh

If something failed:
- Check ${UVICORN_LOG} for python tracebacks.
- Ensure Elasticsearch container is healthy: docker ps and docker compose -f ${DOCKER_COMPOSE_FILE} logs elasticsearch

SUMMARY

exit 0
