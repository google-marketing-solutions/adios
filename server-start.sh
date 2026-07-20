#!/bin/bash
# ==============================================================================
# Adios 2.0 Backend Server Startup Script
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

CONFIG_FILE="${SCRIPT_DIR}/config.txt"
TEMPLATE_FILE="${SCRIPT_DIR}/config.template.txt"

# Highlight text formatting
bold=$(tput bold || echo "")
normal=$(tput sgr0 || echo "")
green=$(tput setaf 2 || echo "")
yellow=$(tput setaf 3 || echo "")

log() {
  echo -e "${green}[INFO]${normal} $1"
}

warn() {
  echo -e "${yellow}[WARNING]${normal} $1"
}

# Check if config.txt exists; if not, create it from template
if [ ! -f "${CONFIG_FILE}" ]; then
  warn "'config.txt' not found in workspace root."
  if [ -f "${TEMPLATE_FILE}" ]; then
    log "Copying 'config.template.txt' to 'config.txt'..."
    cp "${TEMPLATE_FILE}" "${CONFIG_FILE}"
    warn "Please update 'config.txt' with your active credentials."
  fi
fi

# Load variables from config.txt if present
if [ -f "${CONFIG_FILE}" ]; then
  log "Loading environment configuration from 'config.txt'..."
  set -o allexport
  # Filter out comments and blank lines before sourcing
  eval "$(grep -v '^#' "${CONFIG_FILE}" | grep -v '^[[:space:]]*$' | sed 's/^/export /')"
  set +o allexport
fi

# Locate python executable in .venv or system
if [ -f "${SCRIPT_DIR}/.venv/bin/uvicorn" ]; then
  UVICORN_CMD="${SCRIPT_DIR}/.venv/bin/uvicorn"
elif command -v uvicorn &> /dev/null; then
  UVICORN_CMD="uvicorn"
else
  echo "[ERROR] Uvicorn server not found. Please activate your virtualenv or run: pip install -r requirements.txt"
  exit 1
fi

PORT="${PORT:-8000}"
HOST="${HOST:-0.0.0.0}"

echo "=========================================================================="
echo "${bold}Starting Adios 2.0 Backend FastAPI Server${normal}"
echo "=========================================================================="
echo "Host        : ${bold}${HOST}${normal}"
echo "Port        : ${bold}${PORT}${normal}"
echo "Project ID  : ${bold}${GCP_PROJECT_ID:-Not Set (Using Fallback)}${normal}"
echo "Ads Customer: ${bold}${GOOGLE_ADS_MCC_CUSTOMER_ID:-${GOOGLE_ADS_CUSTOMER_ID:-Not Set}}${normal}"
echo "=========================================================================="

exec "${UVICORN_CMD}" src.main:app --host "${HOST}" --port "${PORT}" --reload
