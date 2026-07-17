# Session Handoff: 2026-07-16

## Current Progress
*   [x] Initialized canonical repository governance via "Standards as Living Code" (`AGENTS.md`, `_agents/rules/`, universal IDE wrappers).
*   [x] Purged legacy clasp / Apps Script / Sheets Add-on assumptions from `PRD.md` to establish pure Web App architecture.
*   [x] Transitioned backend architecture to Python 3 / FastAPI (`pyproject.toml`, `requirements.txt`, `src/main.py`, `tests/test_health.py`).
*   [x] Updated `TASKS.md` with strict Python 3 / FastAPI backend stack and DACI governance.
*   [x] Re-initialized target frontend architecture from React to Angular 19+ (Standalone Components & Signals in `frontend/`).

## Context for Next Session
*   **Working Branch**: `main`
*   **Target Backend Stack**: Python 3.11+ / FastAPI / Pydantic / Pytest / Ruff
*   **Target Frontend Stack**: Angular 19+ Web App (Standalone Components & Signals with API bindings to FastAPI backend)
*   **Critical Constraints**: Do not reintroduce Node/Express backend or Apps Script / clasp dependencies. All Google Ads API and Content API for Shopping integrations must run via Python / FastAPI backend services.

## Immediate Next Steps
1. Create/activate a Python virtual environment (`python3 -m venv .venv && source .venv/bin/activate`) and run `pip install -r requirements.txt`.
2. Verify local health test baseline at any time (`pytest tests/test_health.py && ruff check`).
3. Begin sprint execution with `TASK-001` (`src/core/gcp_config.py` - EU Data Residency Wrapper) and `TASK-003` (`src/core/auth_provider.py` - Service Account & OAuth Credential Provider Engine) following `TASKS.md`.
