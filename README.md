# Adios 2.0 Advanced

Enterprise-grade Web App automation and creative enhancement platform for
managing, generating, and optimizing Performance Max (PMax) campaign assets and
Google Merchant Center (GMC) product media.

## Tech Stack

*   **Backend**: Python 3.11+ / FastAPI / Pydantic v2 / Uvicorn / Pytest
*   **Frontend**: Angular 22+ (Standalone Components & Signals / Material Design
    / SCSS)

--------------------------------------------------------------------------------

## Local Setup & Installation

### 1. Python Backend Setup

First, prepare the Python virtual environment and install the required
dependencies:

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

--------------------------------------------------------------------------------

## Running Tests

### Running Python Backend Tests

To run the Pytest suite, you must set `PYTHONPATH` to the repository root
directory:

```bash
PYTHONPATH=. .venv/bin/pytest tests/
```

### Running Linter (Ruff)

```bash
.venv/bin/ruff check src/ tests/
```

--------------------------------------------------------------------------------

## Data Storage & State Architecture

Adios 2.0 has completely transitioned to a stateless backend architecture
utilizing Google Cloud Native services for multi-tenant isolation, atomic
scheduling, and robust persistence.

### 1. Google Cloud Storage (GCS)

Binary assets (images uploaded via the Asset Uploader) are stored securely in
Google Cloud Storage.

*   **Bucket**: Dynamically configured via `GCS_BUCKET` in `config.txt`.
*   **Path Structure**: Assets are stored under the `/assets/` prefix and
    uniquely identified by a file token:
    `gs://<GCS_BUCKET>/assets/<file_token>_<original_filename>`
*   Supported by `src/core/gcs_service.py`.

### 2. Google Firestore (Native Mode)

State persistence, audit logs, and scheduling records are stored in Google
Firestore (Standard Edition, Native Mode).

*   **Database**: Configured via `FIRESTORE_DATABASE_ID` in `config.txt`.
*   **Collections & Schemas** (defined via Pydantic in
    `src/core/firestore_service.py`):

    #### `assets`

    Stores Google Ads Asset metadata mapped to their GCS URIs.

    *   **Document ID**: `google_ads_asset_id`
    *   **Fields**: `google_ads_asset_id`, `customer_id`, `gcs_uri`,
        `asset_name`, `asset_group_ids`, `created_at`

    #### `asset_group_links`

    Audit log of all successful and failed Google Ads API LINK/UNLINK
    mutations. * **Document ID**: Unique UUID `operation_id` * **Fields**:
    `operation_type` (LINK | UNLINK), `customer_id`, `asset_group_id`,
    `google_ads_asset_id`, `google_ads_asset_group_asset_id`, `status` (SUCCESS
    | FAILED), `error_message`, `timestamp`

    #### `protected_assets`

    Stores account-wide Asset protections and lock states. * **Document ID**:
    `google_ads_asset_id` * **Fields**: `customer_id`, `is_protected`,
    `updated_at`

    #### `scheduled_jobs`

    Manages scheduled asset unlinking background jobs. * **Document ID**:
    `job_id` * **Fields**: `customer_id`, `asset_group_ids`, `asset_name`,
    `image_gcs_uri`, `asset_id`, `end_date`, `field_type`, `status` (LINKED |
    COMPLETED_UNLINKED | FAILED), `error_message`, `created_at`, `updated_at`,
    `swap_rules` (Optional)

--------------------------------------------------------------------------------

## Automated KPI Eviction Engine

When assigning images to an Asset Group, Adios 2.0 automatically enforces Google
Ads PMax capacity limits and intelligently manages asset lifecycle based on
performance metrics following an exact execution sequence:

### 1. Capacity Enforcement & Idempotency

*   **Duplicate Link Check (Idempotency)**: If the new asset is already linked
    to the target Asset Group, the operation skips mutation and returns
    immediately as a successful NO-OP.
*   **Combined Limit Check**: A strict maximum of **20 images total** (across
    all aspect ratios: landscape, square, portrait, tall portrait) is enforced
    per Asset Group to align with Google Ads API constraints. If the total is <
    20, the asset is appended directly.

### 2. Eviction Eligibility & Protected Candidate Filtering

If capacity limits are reached and eviction swap rules are provided, candidates
are isolated via a strict exclusion hierarchy:

*   **Format Matching & Cross-Ratio Swaps**: By default, only existing assets of
    the **exact same aspect ratio/format type** are eligible for eviction to
    preserve responsive layouts. However, if `allow_cross_aspect_ratio_swap` is
    enabled in the rules, assets of any format can be evicted.
*   **Account-Level Protection**: Assets marked as "Protected" in Firestore are
    completely exempt from eviction consideration.
*   **Temporal Grace Period**: To prevent rapid, cyclic, or redundant swaps,
    assets newly linked within the hardcoded **1 minute** grace period
    (`grace_period_minutes`) are strictly protected. This allows the system to
    completely block daisy-chain eviction loops during rapid bulk uploads (as
    requests arrive seconds apart) while still enabling immediate manual
    re-testing without waiting 24 hours. The lifecycle timeline is reconstructed
    utilizing Firestore `asset_group_links` audit logs.
*   **Statistical Significance Thresholds**: If `min_impressions` or
    `min_clicks` constraints are enabled, any candidate falling below these
    minimum values is never evicted. If both are set, an "AND" logic gate
    applies (candidate must pass both filters).

### 3. KPI Performance Evaluation & Sorting Logic

If eligible candidates remain, their performance metrics are queried from the
Google Ads API and evaluated:

*   **Directional Sorting**: Eviction of the lowest performer is determined by
    the specific KPI metric type:
    *   **Higher is Better** (Ascending sorting, evicts minimum value): CTR,
        Conv Rate, ROAS, Conversions, Clicks, Impressions.
    *   **Lower is Better** (Descending sorting, evicts maximum value): CPA,
        Cost.
*   **Tie-Breaking**: In the event of identical KPI values, the engine prefers
    evicting **legacy/evergreen assets** (oldest link timestamp derived from
    Firestore) to ensure new assets are given sufficient time to run. If both
    lack link timestamps, sorting falls back deterministically to `asset_id`.
*   **No Eligible Candidates**: If all matching format assets are either
    protected or fall below minimum thresholds, the eviction halts and returns a
    `FAILED` status with: *"No more capacity. How to fix: check swap rules and
    protected images, number of images limit per asset group is 20."*

### 4. Lookback Window Segments

Dates are mapped precisely to standard Google Ads reporting segments:

*   **7d / 30d / 90d**: Dynamically calculated preceding days relative to
    execution time.
*   **Quarter**: Queries the previous full closed calendar quarter (e.g., if the
    current date is in Q3 [Jul-Sep], it targets the entirety of Q2 [Apr-Jun]).
*   **Last 90 Days**: Explicit preceding 90 days.
*   **Custom**: Exact user-specified integer duration.

--------------------------------------------------------------------------------

## Local Development

To run the frontend and backend servers concurrently, use the local development
orchestrator:

```bash
# Start both servers (FastAPI on 8000, Angular SPA on 4200)
# Linux / macOS
./local/start-servers.sh

# Windows
local\start-server.bat
```

To stop servers on Linux/macOS, use `Ctrl+C` or `./local/stop-servers.sh`. On
Windows, use `Ctrl+C` in the orchestrator window or run `local\stop-server.bat`.
The frontend proxy is configured to automatically route api calls (`/v1/*` and
`/health`) to the FastAPI backend.

### Demo Account & Local Testing

To facilitate local end-to-end frontend verification without an active Google
Ads Developer Token or live Asset Group data, the ID `0000000000` is configured
as a reserved **Demo Account**:

*   Selecting **Store DE PMax Demo (000-000-0000)** in the frontend
    automatically triggers a `source: "mock"` fallback in the backend.
*   It returns a static list of 5 test assets, which support reading and
    persisting "Protected" asset status directly to the `protected_assets`
    Firestore collection exactly like live accounts.

--------------------------------------------------------------------------------

## Automated PMax Scheduling & Lifecycle Simulation

Adios 2.0 supports scheduled automated End-Date unlinking rollbacks. To ensure
reliability, it links assets immediately upon assignment, isolates background
authentications by persisting the user's `refresh_token`, and guarantees atomic
rollbacks by storing an exact `evicted_asset_ids` mapping in Firestore.

### Manual End-to-End Local Testing

To test the full background lifecycle manually exactly as it will run via Google
Cloud Scheduler:

#### 1. Boot the Local Services

Start the orchestrator:

```bash
./local/start-servers.sh
```

#### 2. Schedule an Asset via FastAPI Swagger UI

1.  Open your browser and navigate to the interactive API docs:
    `http://localhost:8000/docs`.
2.  Expand the `POST /v1/campaign/assign` endpoint.
3.  Click the **"Try it out"** button.
4.  Execute an assignment payload passing an `end_date`. For example:

    ```json
    {
      "customer_id": "0000000000",
      "asset_group_ids": ["123456789"],
      "file_token": "YOUR_VALID_GCS_UPLOAD_TOKEN",
      "end_date": "2026-08-01",
      "swap_rules": {}
    }
    ```
5.  Click **Execute**. The API will IMMEDIATELY link the asset, and the response
    will return `"status": "SUCCESS"`. Simultaneously, a background job is
    registered in Firestore with `"status": "LINKED"`.

#### 3. Fast-Forward Time and Trigger the Background Scheduler

Normally, the daily Cloud Scheduler will hit the API endpoint every night. To
test the unlinking immediately, bypass the calendar by passing the future
`YYYY-MM-DD` date as a fast-forward argument to the local trigger script:

```bash
# Simulates that "today" is 2026-08-01 (triggers the atomic UNLINK & RESTORE phase)
./scripts/scheduler.sh "2026-08-01"
```

The server fetches the job, isolates Auth credentials using the persisted token,
invokes Google Ads mutations to unlink the asset, restores the original evicted
candidates, and transitions the state seamlessly without requiring you to wait
or change your system clock.
