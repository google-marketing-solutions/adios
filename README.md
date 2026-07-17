# Adios 2.0 Advanced

Enterprise-grade Web App automation and creative enhancement platform for managing, generating, and optimizing Performance Max (PMax) campaign assets and Google Merchant Center (GMC) product media.

## Tech Stack
*   **Backend**: Python 3.11+ / FastAPI / Pydantic v2 / Uvicorn / Pytest
*   **Frontend**: Angular 22+ (Standalone Components & Signals / Material Design / SCSS)

---

## Local Setup & Installation

### 1. Python Backend Setup
First, prepare the Python virtual environment and install the required dependencies:
```bash
# Create python virtual environment
python3 -m venv .venv

# Install dependencies from PyPI
.venv/bin/pip install -r requirements.txt --index-url https://pypi.org/simple
```

### 2. Angular Frontend Setup
Ensure Node.js 22 is installed, then install the frontend dependencies:
```bash
cd frontend
npm install
```

---

## Running Tests

### Running Python Backend Tests
To run the Pytest suite, you must set `PYTHONPATH` to the repository root directory:
```bash
PYTHONPATH=. .venv/bin/pytest tests/
```

### Running Linter (Ruff)
```bash
.venv/bin/ruff check src/ tests/
```

---

## Local Development

To run the frontend and backend servers concurrently, use the local development orchestrator:
```bash
# Start both servers (FastAPI on 8000, Angular SPA on 4200)
./local/start-servers.sh
```
The frontend proxy is configured to automatically route api calls (`/v1/*` and `/health`) to the FastAPI backend.
