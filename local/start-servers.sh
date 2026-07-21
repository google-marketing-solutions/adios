#!/bin/bash
# Local development orchestration script to start backend & frontend servers concurrently.

# Exit immediately if a command exits with a non-zero status
set -e

# Resolve absolute paths
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_DIR}"

# Add local node binary to PATH if it exists
if [ -d "${REPO_DIR}/.node/bin" ]; then
  export PATH="${REPO_DIR}/.node/bin:${PATH}"
fi

echo "=========================================================================="
echo "Starting Adios 2.0 Development Orchestrator"
echo "Repository Root: ${REPO_DIR}"
echo "=========================================================================="

# Check if python dependencies are installed
if [ ! -f "requirements.txt" ]; then
  echo "Error: requirements.txt not found!"
  exit 1
fi

CONFIG_FILE="${REPO_DIR}/config.txt"
# Load variables from config.txt if present
if [ -f "${CONFIG_FILE}" ]; then
  echo "[INFO] Loading environment configuration from 'config.txt'..."
  set -o allexport
  # Filter out comments and blank lines before sourcing
  eval "$(grep -v '^#' "${CONFIG_FILE}" | grep -v '^[[:space:]]*$' | sed 's/^/export /')"
  set +o allexport
else
  echo "[WARNING] 'config.txt' not found! Environment variables might not be loaded."
fi

# Trap SIGINT / SIGTERM to clean up background processes
cleanup() {
  echo ""
  echo "Shutting down servers gracefully..."
  if [ -n "${BACKEND_PID}" ]; then
    echo "Stopping Backend (PID: ${BACKEND_PID})..."
    kill -TERM "${BACKEND_PID}" 2>/dev/null || true
  fi
  if [ -n "${FRONTEND_PID}" ]; then
    echo "Stopping Frontend (PID: ${FRONTEND_PID})..."
    kill -TERM "${FRONTEND_PID}" 2>/dev/null || true
  fi
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Start backend FastAPI server
echo "Starting FastAPI Backend on http://localhost:8000..."
PYTHON_BIN="python3"
if [ -d ".venv" ]; then
  PYTHON_BIN=".venv/bin/python"
fi
${PYTHON_BIN} -m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Wait briefly for backend to check port
sleep 2

# Start frontend Angular server
echo "Starting Angular Frontend on http://localhost:4200..."
cd frontend
npm run start &
FRONTEND_PID=$!

# Keep script running to forward logs and wait for cleanup
wait
