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

## Data Storage & State Architecture

Adios 2.0 has completely transitioned to a stateless backend architecture utilizing Google Cloud Native services for multi-tenant isolation, atomic scheduling, and robust persistence.

### 1. Google Cloud Storage (GCS)
Binary assets (images uploaded via the Asset Uploader) are stored securely in Google Cloud Storage.
* **Bucket**: Dynamically configured via `GCS_BUCKET` in `config.txt`.
* **Path Structure**: Assets are stored under the `/assets/` prefix and uniquely identified by a file token:
  `gs://<GCS_BUCKET>/assets/<file_token>_<original_filename>`
* Supported by `src/core/gcs_service.py`.

### 2. Google Firestore (Native Mode)
State persistence, audit logs, and scheduling records are stored in Google Firestore (Standard Edition, Native Mode). 
* **Database**: Configured via `FIRESTORE_DATABASE_ID` in `config.txt`.
* **Collections & Schemas** (defined via Pydantic in `src/core/firestore_service.py`):
  
  #### `assets`
  Stores Google Ads Asset metadata mapped to their GCS URIs.
  * **Document ID**: `google_ads_asset_id`
  * **Fields**: `google_ads_asset_id`, `customer_id`, `gcs_uri`, `asset_name`, `asset_group_ids`, `created_at`

  #### `asset_group_links`
  Audit log of all successful and failed Google Ads API LINK/UNLINK mutations.
  * **Document ID**: Unique UUID `operation_id`
  * **Fields**: `operation_type` (LINK | UNLINK), `customer_id`, `asset_group_id`, `google_ads_asset_id`, `google_ads_asset_group_asset_id`, `status` (SUCCESS | FAILED), `error_message`, `timestamp`

  #### `protected_assets`
  Stores account-wide Asset protections and lock states.
  * **Document ID**: `google_ads_asset_id`
  * **Fields**: `customer_id`, `is_protected`, `updated_at`

  #### `scheduled_jobs`
  Manages future-dated asset linking/unlinking background jobs.
  * **Document ID**: `job_id`
  * **Fields**: `customer_id`, `asset_group_ids`, `asset_name`, `image_gcs_uri`, `asset_id`, `start_date`, `end_date`, `field_type`, `status` (PENDING | LINKED | COMPLETED_UNLINKED | FAILED), `error_message`, `created_at`, `updated_at`, `swap_rules` (Optional)

---

## Automated KPI Eviction Engine

When assigning images to an Asset Group, Adios 2.0 automatically enforces Google Ads PMax capacity limits and intelligently manages asset lifecycle based on performance metrics following an exact execution sequence:

### 1. Capacity Enforcement & Idempotency
* **Duplicate Link Check (Idempotency)**: If the new asset is already linked to the target Asset Group, the operation skips mutation and returns immediately as a successful NO-OP.
* **Combined Limit Check**: A strict maximum of **20 images total** (across all aspect ratios: landscape, square, portrait) is enforced per Asset Group to align with Google Ads API constraints. If the total is < 20, the asset is appended directly.

### 2. Eviction Eligibility & Protected Candidate Filtering
If capacity limits are reached and eviction swap rules are provided, candidates are isolated via a strict exclusion hierarchy:
* **Same-Format Matching**: To preserve responsive layout requirements, only existing assets of the **exact same aspect ratio/format type** are eligible for eviction.
* **Account-Level Protection**: Assets marked as "Protected" in Firestore are completely exempt from eviction consideration.
* **Statistical Significance Thresholds**: If `min_impressions` or `min_clicks` constraints are enabled, any candidate falling below these minimum values is never evicted. If both are set, an "AND" logic gate applies (candidate must pass both filters).

### 3. KPI Performance Evaluation & Sorting Logic
If eligible candidates remain, their performance metrics are queried from the Google Ads API and evaluated:
* **Directional Sorting**: Eviction of the lowest performer is determined by the specific KPI metric type:
  * **Higher is Better** (Ascending sorting, evicts minimum value): CTR, Conv Rate, ROAS, Conversions, Clicks, Impressions.
  * **Lower is Better** (Descending sorting, evicts maximum value): CPA, Cost.
* **Tie-Breaking**: In the event of identical KPI values, candidates are deterministically sorted by `asset_id` to ensure consistent execution.
* **No Eligible Candidates**: If all matching format assets are either protected or fall below minimum thresholds, the eviction halts and returns a `FAILED` status with: *"No eligible assets found to swap. All assets are either protected or below minimum performance thresholds."*

### 4. Lookback Window Segments
Dates are mapped precisely to standard Google Ads reporting segments:
* **7d / 30d / 90d**: Dynamically calculated preceding days relative to execution time.
* **Quarter**: Queries the previous full closed calendar quarter (e.g., if the current date is in Q3 [Jul-Sep], it targets the entirety of Q2 [Apr-Jun]).
* **Last 90 Days**: Explicit preceding 90 days.
* **Custom**: Exact user-specified integer duration.

---

## Local Development

To run the frontend and backend servers concurrently, use the local development orchestrator:
```bash
# Start both servers (FastAPI on 8000, Angular SPA on 4200)
./local/start-servers.sh
```
The frontend proxy is configured to automatically route api calls (`/v1/*` and `/health`) to the FastAPI backend.
