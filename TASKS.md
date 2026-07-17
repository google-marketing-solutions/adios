# Execution Plan & Task Breakdown: Adios 2.0 Advanced (Web App Architecture)

> [!IMPORTANT]
> **MANDATORY PRE-EXECUTION READ DIRECTIVE:**
> All AI agents, subagents, and engineering contributors **MUST read and review this `TASKS.md` file** in its entirety before initiating any implementation, debugging, or verification task. Verify all dependencies, task statuses, and Given/When/Then acceptance criteria to prevent duplicate work or out-of-order execution. Once a task is completed and verified by passing unit/integration tests, its status **MUST** be updated to `[x] Done` in this document.

> **Translated From:** [PRD.md](./PRD.md)  
> **Steering Guidelines:** [AGENTS.md](./AGENTS.md)  
> **Status:** Active Agile Execution Plan & Backlog  
> **Methodology:** Agile Playbook — Vertical Decomposition into Epics, User Stories (INVEST), and SMART Tasks (<16h effort)  
> **Target Stack:** Python 3.11+ / FastAPI / Pydantic v2 / Pytest / Ruff (Backend API) + Angular 22+ / TypeScript (Frontend Web App Standalone Components & Signals; 0% Apps Script / clasp)

---

## 1. Project Governance & DACI Framework

To ensure accountability and prevent scope drift across engineering and product teams, the **DACI Governance Model** governs all deliverables:

| Role | Assigned Entity / Persona | Responsibilities |
| :--- | :--- | :--- |
| **Driver (D)** | Engineering Lead / Project Manager Subagent (`codeboon-project_manager`) | Drives sprint planning, vertical task decomposition, dependency unblocking, and continuous verification against [PRD.md](./PRD.md) and [AGENTS.md](./AGENTS.md). |
| **Approver (A)** | Product Owner (SEA & Brand Lead / User) | Final sign-off on PRD requirements, acceptance criteria verification, HITL workflow design, and production deployment authorization. |
| **Contributors (C)** | Software Engineers, AI/ML Engineers, QA Automation Leads | Implement Python/FastAPI backend modules (`.py`), GCP/Vertex AI integrations, and Pytest suites following [TASKS.md](./TASKS.md). Implement Angular 22+ TypeScript (`.component.ts` / `.service.ts`) standalone frontend components. |
| **Informed (I)** | Performance Marketing Managers, E-commerce Operations, Legal/Brand Compliance | Receive bi-weekly sprint demo reports, telemetry dashboards (`Ad Strength` / time savings), and legal guardrail audits. |

---

## 2. Agile Sprint Ceremonies & Execution Protocols

1. **Mandatory Backlog Protocol:**  
   All AI agents and engineering contributors **MUST read [TASKS.md](./TASKS.md)** prior to starting any implementation task to verify dependencies and avoid duplicate work. Once a task's Given/When/Then acceptance criteria are verified by tests, its status MUST be updated to `[x] Done` in this document.
2. **Sprint Duration & Cadence:**  
   2-week sprints with vertical slice delivery (each sprint delivers a fully tested, end-to-end working slice across UI, API, and storage layers).
3. **Work-in-Progress (WIP) Limits:**  
   Maximum of 3 concurrent active (`In Progress`) tasks per engineering subagent to prevent context switching and incomplete integrations.
4. **Codebase Verification & Debunked Assumptions Checkpoint:**  
   Prior to implementing GCP APIs or UI components, verification spikes (`TASK-000`) ensure foundational scaffolding ([pyproject.toml](./pyproject.toml), [requirements.txt](./requirements.txt), build/lint pipeline, and Pytest harness [tests/test_health.py](./tests/test_health.py)) exists and passes, directly debunking the assumption that business logic can be written without verified build toolchains or that legacy Node/Express/Apps Script backends remain active.

---

## 3. Priority Taxonomy & Effort Estimation

- **P0 (Critical Infrastructure & Legal Guardrails):** Must be completed first; blocks all deployment and ensures data sovereignty, first-party legal compliance, and system stability.
- **P1 (Core Campaign MVP):** Campaign-level asset group rotations, KPI eviction engines, and GCS synchronization.
- **P2 (Product Studio & AI Backgrounds):** Merchant Center integration, background replacement, dual-ID sync, and HITL review grid.
- **P3 (Video Animations & Power User Mapping):** Animated product video generation, YouTube API sync, and manual category configurations.
- **P4 (Campaign Text Spell Check):** Automated and on-demand grammar/spell checking for PMax text assets.
- **Future (Scope-Bounded GenAI Studio):** Vertex AI text-to-image generation from scratch (strictly segregated from MVP critical path to prevent scope bloat).

All tasks are scoped to **<16 hours** of engineering effort (`[XS]` ≤ 2h, `[S]` 2–4h, `[M]` 4–8h, `[L]` 8–16h). Any feature exceeding 16h is split into subtasks (`TASK-XYZ.1`, `TASK-XYZ.2`).

---

## Phase 0: Architecture, Foundation, Infrastructure & Governance (Epic 0)
**Goal:** Establish verified Python/FastAPI project scaffolding, enforce EU cloud compute/storage data residency, provision dynamic hierarchical GCS buckets, govern API authentication via Service Accounts, and ingest machine-readable brand schemas.

### User Story 0.1: Project Foundation & Build Toolchain
> *As an engineer, I want a standardized Python 3 / FastAPI backend and Angular 22+ frontend development environment with automated linting, type-checking, and testing pipelines, so that all API services and UI components compile and run reliably.*

- [x] **TASK-000: Initialize Python 3 / FastAPI & Angular 22+ Web App Project Foundation & Verification Harness**
  - *Priority:* `P0` | *Effort:* `[M]` (6h) | *Dependencies:* `None` | *PRD Ref:* Section 6.4 | *Target File(s):* [pyproject.toml](./pyproject.toml), [requirements.txt](./requirements.txt), [src/main.py](./src/main.py), [tests/test_health.py](./tests/test_health.py), [frontend/package.json](./frontend/package.json)
  - *Description:* Complete and verify backend configurations ([pyproject.toml](./pyproject.toml), [requirements.txt](./requirements.txt), `ruff`, `mypy`, `pytest`), and source directory structure (`src/campaign/`, `src/product/`, `src/core/`). Configure Uvicorn ASGI server and FastAPI entry point ([src/main.py](./src/main.py)) and baseline health harness ([tests/test_health.py](./tests/test_health.py)). Verify Angular 22+ standalone frontend workspace initialized in `frontend/` with package dependencies, enforcing zero legacy Apps Script or NodeJS backends.
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** a clean checkout of the repository in a virtual environment (`python -m venv .venv`) and Node environment,
    - **When** the developer executes `pip install -e .[dev]` and `npm install` inside `frontend/`, then runs `pytest` alongside `ruff check src tests`, and `npm run build` in `frontend/`,
    - **Then** all linters pass without errors, unit tests pass successfully, FastAPI starts cleanly, and the Angular 22 frontend compiles standalone components successfully.

### User Story 0.2: Cloud Governance & Data Residency Lock
> *As a brand compliance officer, I want all AI model inference and GCS storage operations locked to strict European regulatory jurisdictions (`europe-west1` / `europe-west3`), so that our enterprise organization complies with EU data sovereignty laws.*

- [ ] **TASK-001: GCP Compute & Data Residency Enforcement Wrapper**
  - *Priority:* `P0` | *Effort:* `[M]` (6h) | *Dependencies:* `TASK-000` | *PRD Ref:* Section 6.1 | *Target File(s):* [src/core/gcp_config.py](./src/core/gcp_config.py)
  - *Description:* Implement a centralized GCP client config wrapper ([src/core/gcp_config.py](./src/core/gcp_config.py)) that validates and locks all API requests for Vertex AI (`Imagen`, `GenAI`), Scene Machine, and Cloud Storage to designated EU regions (`europe-west1` / `europe-west3`).
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** an AI generation request or GCS bucket initialization call instantiated via the client wrapper,
    - **When** a non-EU region parameter (e.g., `us-central1` or `asia-east1`) is passed or injected via configuration,
    - **Then** the client wrapper throws a synchronous `DataResidencyViolationError` and prevents the API call from executing.

### User Story 0.3: Hierarchical Cloud Storage Synchronization
> *As a marketing manager, I want GCS buckets automatically structured to mirror my live Google Ads campaign topology, so that uploaded and generated assets are organized cleanly by account, campaign, asset group, and aspect ratio.*

- [ ] **TASK-002.1: Idempotent Hierarchical GCS Bucket & Prefix Manager**
  - *Priority:* `P0` | *Effort:* `[M]` (8h) | *Dependencies:* `TASK-001` | *PRD Ref:* Section 6.1, Section 11 (GCS Folder Architecture) | *Target File(s):* [src/core/gcs_manager.py](./src/core/gcs_manager.py)
  - *Description:* Build `GcsStorageManager` ([src/core/gcs_manager.py](./src/core/gcs_manager.py)) that dynamically creates and verifies GCS path structures mirroring the campaign topology: `/{account_id}/{campaign_id}_{campaign_name}/{asset_group_id}_{asset_group_name}/{aspect_ratio}/`. Incorporate asyncio locking to prevent race conditions during bulk folder initialization.
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** an array of 50 target Asset Groups selected during a bulk upload,
    - **When** `GcsStorageManager.ensurePathStructure(assetGroups)` is called concurrently across background workers,
    - **Then** exactly one GCS folder prefix is created per unique path without duplicate write conflicts or API rate-limit errors.

- [ ] **TASK-002.2: GCS Fallback Storage Bucket & IAM Governance Setup**
  - *Priority:* `P0` | *Effort:* `[S]` (4h) | *Dependencies:* `TASK-002.1` | *PRD Ref:* Section 6.1, Section 7 (Feature 1.4) | *Target File(s):* [src/core/fallback_storage.py](./src/core/fallback_storage.py)
  - *Description:* Provision and configure the dedicated `Evergreen Fallback Bucket` (`/{account_id}/fallback_evergreen/{aspect_ratio}/`) with strict Service Account IAM read/write permissions and public-read / signed-URL policies for authorized Merchant Center and Google Ads ingestion ([src/core/fallback_storage.py](./src/core/fallback_storage.py)).
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** an unauthenticated external request versus an authorized Service Account request,
    - **When** attempting to write or modify assets in the fallback bucket,
    - **Then** unauthorized write attempts return `403 Forbidden`, while authorized Google Ads/Merchant Center ingestion endpoints successfully fetch asset URLs.

### User Story 0.4: API Authentication & Service Account Governance
> *As a system architect, I want dedicated, least-privilege Service Account and OAuth credentials managed via Secret Manager, so that Google Ads API, Content API for Shopping, and YouTube Data API access is secure and auditable.*

- [ ] **TASK-003: Service Account & OAuth Credential Provider Engine**
  - *Priority:* `P0` | *Effort:* `[M]` (8h) | *Dependencies:* `TASK-001` | *PRD Ref:* Section 6.4 | *Target File(s):* [src/core/auth_provider.py](./src/core/auth_provider.py)
  - *Description:* Implement `AuthTokenProvider` ([src/core/auth_provider.py](./src/core/auth_provider.py)) interfacing with GCP Secret Manager to manage OAuth 2.0 refresh tokens and Service Account JWT credentials for Google Ads API, Content API for Shopping (Primary GMC and CSS Partner MC), and YouTube Data API v3 with automatic token refresh and exponential backoff on `401/403/429` responses.
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** an expiring or revoked OAuth token during a long-running batch job,
    - **When** an API call returns a `401 Unauthorized` status code,
    - **Then** the provider automatically refreshes the access token via the refresh token, retries the request transparently up to 3 times, and logs audit metrics.

### User Story 0.5: Machine-Readable Brand Schema Ingestion
> *As a brand manager, I want to define structured YAML/JSON brand guidelines once per brand entity, so that AI vision gates and generation prompts automatically enforce our exact composition, color, and negative rules.*

- [ ] **TASK-004: Standardized Brand Guidelines Schema Parser & Validator**
  - *Priority:* `P0` | *Effort:* `[M]` (6h) | *Dependencies:* `TASK-000` | *PRD Ref:* Section 7 (Feature 5), Section 11 (Brand Guidelines) | *Target File(s):* [src/core/brand_schema.py](./src/core/brand_schema.py)
  - *Description:* Define Pydantic v2 models and JSON Schema ([src/core/brand_schema.py](./src/core/brand_schema.py)) representing entity brand rules (`primaryColors`, `forbiddenKeywords`, `minPaddingPct`, `productCenteringRequired`, `logoRules`). Build a parser that validates ingested configurations and exposes them to prompt-builders and vision evaluators.
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** a brand configuration JSON file uploaded by a brand manager,
    - **When** the schema parser processes the configuration,
    - **Then** valid files return a typed `BrandConfig` object, while malformed configs (missing required fields or invalid percentage ranges) throw descriptive Pydantic validation errors with exact field identifiers.

---

## Phase 1: Campaign-Level Automatic Image Upload & KPI Rotation (Epic 1)
**Goal:** Streamline bulk image uploads, enforce native aspect ratio assignments without resizing, execute KPI-driven smart replacements when asset group slots are full, protect locked brand assets, and automate scheduled promotional image lifecycles with evergreen fallback recovery.

### User Story 1.1: Bulk Upload & Asset Group Selection
> *As a marketing manager, I want to upload static images via the Adios 2.0 UI and select target PMax Asset Groups across multiple campaigns using real-time filters, so that I can assign creatives across dozens of groups in a single action.*

- [ ] **TASK-101.1: Asset Group Filter & Selection Grid UI Component**
  - *Priority:* `P1` | *Effort:* `[L]` (12h) | *Dependencies:* `TASK-000` | *PRD Ref:* Section 7 (Feature 1.1) | *Target File(s):* [frontend/src/app/campaign/asset-group-grid.component.ts](./frontend/src/app/campaign/asset-group-grid.component.ts)
  - *Description:* Build an interactive Angular standalone component grid ([frontend/src/app/campaign/asset-group-grid.component.ts](./frontend/src/app/campaign/asset-group-grid.component.ts)) using Signals for state management, allowing users to filter PMax Asset Groups by Account ID, Campaign Name, Asset Group Name, or Asset Group ID. Include multi-select checkboxes, slot capacity indicators (e.g., `18/20 Landscape`), and a batch selection summary bar.
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** a user viewing 200 available PMax Asset Groups,
    - **When** the user types "Summer Sale" into the Campaign Name filter and checks "Select All Filtered (15 groups)",
    - **Then** only the 15 matching asset groups are checked, and the selection bar updates to show `15 Asset Groups selected for batch assignment`.

- [ ] **TASK-101.2: Batch Assignment Payload Builder & API Dispatcher**
  - *Priority:* `P1` | *Effort:* `[M]` (8h) | *Dependencies:* `TASK-003`, `TASK-101.1` | *PRD Ref:* Section 7 (Feature 1.1) | *Target File(s):* [src/campaign/bulk_assign_controller.py](./src/campaign/bulk_assign_controller.py)
  - *Description:* Implement backend batch assignment controller ([src/campaign/bulk_assign_controller.py](./src/campaign/bulk_assign_controller.py)) that accepts uploaded image GCS URIs and selected Asset Group IDs, packages them into Google Ads API `AssetGroupAssetOperation` mutations, and dispatches them with rate-limit throttling.
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** a user clicking **"Save"** with 3 uploaded images and 10 selected Asset Groups,
    - **When** the batch controller dispatches the payload to the Google Ads API,
    - **Then** the mutations execute via bulk operations, returning individual success/failure statuses per group without failing the entire batch if one group errors.

### User Story 1.2: Native Aspect Ratio Enforcement (No-Resizing Policy)
> *As a creative lead, I want images strictly classified and assigned by their native uploaded dimensions without automatic resizing or cropping, so that our visual creative never suffers from distortion or awkward edge cutoffs.*

- [ ] **TASK-102: Image Aspect Ratio Inspector & Dimension Validator**
  - *Priority:* `P1` | *Effort:* `[S]` (4h) | *Dependencies:* `TASK-000` | *PRD Ref:* Section 3.2, Section 6.3, Section 7 (Feature 1) | *Target File(s):* [src/campaign/aspect_ratio_validator.py](./src/campaign/aspect_ratio_validator.py)
  - *Description:* Implement binary image header inspector ([src/campaign/aspect_ratio_validator.py](./src/campaign/aspect_ratio_validator.py)) that detects exact width/height upon upload and categorizes images into strict slots: Landscape (`1.91:1`, aspect ratio tolerance ±0.02 -> `MARKETING_IMAGE`), Square (`1:1`, tolerance ±0.01 -> `SQUARE_MARKETING_IMAGE`), Portrait (`4:5`, tolerance ±0.01 -> `PORTRAIT_MARKETING_IMAGE`).
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** an uploaded image file,
    - **When** the aspect ratio validator analyzes its dimensions (e.g., 1200x628 vs 1000x1000 vs 1000x1500),
    - **Then** it correctly maps valid ratios to their exact PMax field name, and immediately rejects any unsupported aspect ratio (e.g., 16:9 banner or odd crop 3:2) with an error message: `Unsupported aspect ratio [X:Y]. No automatic resizing is allowed; please upload 1.91:1, 1:1, or 4:5 images.`

### User Story 1.3: KPI-Driven Smart Replacement Engine
> *As an SEA manager, I want the system to automatically replace the lowest-performing image in an asset group when slot capacity is full, evaluated over a configurable time window and selected KPI, so that my campaigns continuously rotate toward top-performing creatives.*

- [ ] **TASK-103.1: Google Ads Performance Metrics Query Engine**
  - *Priority:* `P1` | *Effort:* `[M]` (8h) | *Dependencies:* `TASK-003` | *PRD Ref:* Section 7 (Feature 1.2) | *Target File(s):* [src/campaign/metrics_service.py](./src/campaign/metrics_service.py)
  - *Description:* Build `PerformanceMetricsService` ([src/campaign/metrics_service.py](./src/campaign/metrics_service.py)) querying GAQL (Google Ads Query Language) for asset-level performance metrics (`Impressions`, `CTR`, `Conversions`, `ROAS`, `PerformanceLabel` / Ad Strength contribution) across a user-selected evaluation window (7, 14, 30, or 90 days).
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** an Asset Group with 20 active square images and a user-selected evaluation window of 30 days governed by `CTR`,
    - **When** `PerformanceMetricsService.get_asset_rankings(asset_group_id, 'CTR', 30)` is invoked,
    - **Then** it returns a deterministic, sorted list of all linked assets from highest to lowest `CTR`, handling zero-impression assets via a configurable tie-breaker (e.g., oldest link date first).

- [ ] **TASK-103.2: Capacity Eviction & Replacement Transaction Executor**
  - *Priority:* `P1` | *Effort:* `[L]` (10h) | *Dependencies:* `TASK-102`, `TASK-103.1` | *PRD Ref:* Section 7 (Feature 1.2, 1.6) | *Target File(s):* [src/campaign/eviction_engine.py](./src/campaign/eviction_engine.py)
  - *Description:* Implement `EvictionEngine` ([src/campaign/eviction_engine.py](./src/campaign/eviction_engine.py)) that checks if an Asset Group has reached its slot capacity (e.g., 20/20 Square Images). If full, it filters out protected assets, identifies the lowest-ranking eligible asset from `PerformanceMetricsService`, unlinks it (`REMOVE` mutation), and links the new asset (`CREATE` mutation) within a single atomic batch transaction. Support dimension-locked vs. cross-dimension replacement rules.
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** a full Asset Group (20/20 1:1 images) where 5 images are protected and `Dimension-Locked Replacement` is active,
    - **When** a new 1:1 image is assigned with `CTR` optimization,
    - **Then** the engine identifies the lowest-CTR non-protected 1:1 image, unlinks it, links the new image, maintains exactly 20 square images, and logs the eviction reason (`KPI_OPTIMIZATION_CTR`).

### User Story 1.4: Protected & Fixed Asset Locking
> *As a brand manager, I want to lock mandatory brand logos and high-performing evergreen banners so they are never evicted during automated KPI rotations.*

- [ ] **TASK-104: Protected Asset Recognition & Locking Toggle**
  - *Priority:* `P1` | *Effort:* `[S]` (4h) | *Dependencies:* `TASK-103.2` | *PRD Ref:* Section 7 (Feature 1.3) | *Target File(s):* [src/campaign/asset_locking.py](./src/campaign/asset_locking.py)
  - *Description:* Build asset locking governance ([src/campaign/asset_locking.py](./src/campaign/asset_locking.py)) supporting both UI toggle state (stored in campaign metadata database) and automatic filename convention recognition (`*_FIXED.*` or `*_MANDATORY.*`).
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** an Asset Group containing an image named `Logo_Summer_FIXED.png` with the lowest CTR in the group,
    - **When** the `EvictionEngine` evaluates candidates for capacity eviction,
    - **Then** `Logo_Summer_FIXED.png` is excluded from the eviction pool, and the lowest-CTR non-protected image is evicted instead.

### User Story 1.5: Scheduled Promotional Rotation & Fallback Recovery
> *As a marketing manager, I want to schedule time-bound promotional images (`start_time` to `end_time`) that automatically insert and revert, restoring exact pre-promotion assets or fallback bucket images without manual intervention.*

- [ ] **TASK-105.1: Stateful Promotional Schedule Snapshot & Insertion Task**
  - *Priority:* `P1` | *Effort:* `[M]` (8h) | *Dependencies:* `TASK-103.2` | *PRD Ref:* Section 7 (Feature 1.4), Look-Ahead Bottleneck #3 | *Target File(s):* [src/campaign/promo_controller.py](./src/campaign/promo_controller.py)
  - *Description:* Implement `PromoScheduleController` ([src/campaign/promo_controller.py](./src/campaign/promo_controller.py)) triggered by a recurring background task worker. At `start_time`, before inserting a promotional asset, the controller creates and persists an immutable `PromotionSnapshot` record containing exact pre-promo slot occupancy and the specific Asset ID evicted to make room for the promo asset.
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** a promotional banner scheduled to activate on Nov 1 at 00:00 UTC for 10 Asset Groups,
    - **When** the scheduled task triggers on Nov 1,
    - **Then** the promotional banner is inserted across all 10 groups, and a `PromotionSnapshot` record is saved recording the exact 10 evicted Asset IDs and their original slot assignments.

- [ ] **TASK-105.2: Promotional Expiration & Fallback Restoration Service**
  - *Priority:* `P1` | *Effort:* `[M]` (8h) | *Dependencies:* `TASK-002.2`, `TASK-105.1` | *PRD Ref:* Section 7 (Feature 1.4) | *Target File(s):* [src/campaign/promo_expiration.py](./src/campaign/promo_expiration.py)
  - *Description:* Build expiration handler (`PromoExpirationService` in [src/campaign/promo_expiration.py](./src/campaign/promo_expiration.py)). At `end_time`, the service unlinks the promotional asset and attempts to relink the exact `evicted_asset_id` recorded in `PromotionSnapshot`. If that asset has been deleted or is unavailable in Google Ads, the service queries the `Evergreen Fallback Bucket` (`TASK-002.2`), uploads/links an evergreen asset of the exact same aspect ratio, and clears the promotion snapshot.
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** an active promotion expiring on Dec 27 at 00:00 UTC where the originally evicted asset `Asset_123` is still valid,
    - **When** the expiration handler runs on Dec 27,
    - **Then** the promo banner is unlinked and `Asset_123` is cleanly restored. If `Asset_123` was purged, an evergreen image from `/fallback_evergreen/{aspect_ratio}/` is linked instead without leaving an empty slot.

### User Story 1.6: Audit Log & Execution Reporting Table
> *As an operations auditor, I want a real-time table displaying every automated asset replacement, insertion, and API error with granular timestamps and drill-down reasons.*

- [ ] **TASK-106: Replacement Audit Log & Error Table Component**
  - *Priority:* `P1` | *Effort:* `[M]` (6h) | *Dependencies:* `TASK-101.2`, `TASK-103.2`, `TASK-105.2` | *PRD Ref:* Section 7 (Feature 1.5) | *Target File(s):* [src/campaign/audit_logger.py](./src/campaign/audit_logger.py), [frontend/src/app/campaign/audit-log-table.component.ts](./frontend/src/app/campaign/audit-log-table.component.ts)
  - *Description:* Implement persistent audit logging service ([src/campaign/audit_logger.py](./src/campaign/audit_logger.py)) that writes execution payloads to a structured store/database, and build an Angular standalone UI table component ([frontend/src/app/campaign/audit-log-table.component.ts](./frontend/src/app/campaign/audit-log-table.component.ts)) using Signals rendering: `Timestamp | Account | Campaign Name | Asset Group Name | Replaced Asset ID/Name | New Asset ID/Name | Reason (KPI Optimization vs. Scheduled Promo) | Status (Success/Error details)`.
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** a batch execution of 15 KPI evictions where 1 fails due to a Google Ads API rate limit (`429`),
    - **When** the user opens the Replacement Summary tab,
    - **Then** exactly 15 log rows appear: 14 marked with status `SUCCESS` (showing replaced and new asset names/IDs), and 1 marked `ERROR` with the full API error message and retry status.

---

## Phase 2: Product-Level Image Background Change Studio (Epic 2)
**Goal:** Enable bulk e-commerce SKU ingestion, enforce First-Party (`Own-Brand`) legal guardrails, parameterize background generation prompts via AI Vision/Scene presets, provide an interactive HITL review grid with natural-language comment loops, and execute dual-ID synchronization across Primary GMC and CSS Partner MC feeds.

### User Story 2.1: Merchant Center Product Ingestion & Selection
> *As a marketing manager, I want to browse and select products directly from my Merchant Center feeds using category filters or bulk CSV `item_id` uploads, so that I can batch-process product background transformations.*

- [ ] **TASK-201: Merchant Center Product Picker UI & Content API Client**
  - *Priority:* `P2` | *Effort:* `[L]` (12h) | *Dependencies:* `TASK-003` | *PRD Ref:* Section 7 (Feature 2.1) | *Target File(s):* [src/product/mc_client.py](./src/product/mc_client.py), [frontend/src/app/product/product-picker-grid.component.ts](./frontend/src/app/product/product-picker-grid.component.ts)
  - *Description:* Build Content API for Shopping integration ([src/product/mc_client.py](./src/product/mc_client.py)) fetching product feeds with pagination and caching. Build Angular standalone frontend product picker using Signals ([frontend/src/app/product/product-picker-grid.component.ts](./frontend/src/app/product/product-picker-grid.component.ts)) with category hierarchy tree filtering (`Pet Supplies > Dry Food`), CSV/text area `item_id` bulk paste, and multi-row selection checkboxes with real-time thumbnail preview of `image_link`.
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** a Merchant Center account with 10,000 SKUs,
    - **When** the user pastes 250 comma-separated `item_id`s into the bulk ingestion box and clicks "Load Products",
    - **Then** the UI fetches and displays exact metadata (`title`, `brand`, `google_product_category`, `image_link`) for the 250 matching SKUs within 5 seconds.

### User Story 2.2: Legal Rights Guardrail (First-Party SKU Enforcement)
> *As corporate legal counsel, I want automated background replacements and animations strictly restricted to our Own-Brand (first-party) SKUs, so that we never violate third-party intellectual property or derivative modification laws.*

- [ ] **TASK-202: First-Party SKU Legal Guardrail Gatekeeper**
  - *Priority:* `P0` (Safety/Legal) | *Effort:* `[M]` (6h) | *Dependencies:* `TASK-201` | *PRD Ref:* Section 7 (Feature 2 Legal Guardrail), Section 11 | *Target File(s):* [src/product/legal_guardrail.py](./src/product/legal_guardrail.py)
  - *Description:* Implement legal verification middleware ([src/product/legal_guardrail.py](./src/product/legal_guardrail.py)) that checks SKU `brand` or custom label attributes against an organization-configured whitelist of First-Party / Own-Brand names. Any SKU not matching the first-party whitelist is hard-blocked from Features 2 and 3.
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** a batch selection containing 90 own-brand SKUs (`Brand: Adios-FirstParty`) and 10 third-party partner SKUs (`Brand: ExternalVendor`),
    - **When** the user initiates background generation or animation,
    - **Then** the system permits processing for the 90 own-brand SKUs, but blocks the 10 third-party SKUs with a red UI alert: `Legal Restriction: Automated modification is restricted to first-party Own-Brand SKUs. [10 SKUs excluded].`

### User Story 2.3: Scene & Prompt Configuration Studio
> *As a creative user, I want to configure visual themes, lighting, background sharpness, and negative rules for my selected SKUs, so that AI-generated backgrounds match seasonal campaign goals and aspect ratio variations.*

- [ ] **TASK-203: Visual Prompt Configuration & Payload Compiler**
  - *Priority:* `P2` | *Effort:* `[M]` (8h) | *Dependencies:* `TASK-004`, `TASK-202` | *PRD Ref:* Section 7 (Feature 2.2) | *Target File(s):* [src/product/prompt_compiler.py](./src/product/prompt_compiler.py), [frontend/src/app/product/scene-config-form.component.ts](./frontend/src/app/product/scene-config-form.component.ts)
  - *Description:* Build Angular standalone form component using Signals ([frontend/src/app/product/scene-config-form.component.ts](./frontend/src/app/product/scene-config-form.component.ts)) allowing users to select: Theme/Seasonality (Spring, Summer, Autumn, Winter, Holiday, Sale), Background Focus (Blurry/Bokeh vs Sharp), Scene Context (Modern living room, kitchen, patio, studio), Lighting (Warm studio, natural sunlight), Style (Elegant, Playful, Minimalist), Negative Constraints (`no text, no people, no logos, no watermarks, no distorted objects`), and Target Aspect Ratios (1:1, 4:5, 1.91:1, 9:16). Build backend prompt compiler ([src/product/prompt_compiler.py](./src/product/prompt_compiler.py)) that merges these settings with brand rules (`TASK-004`) to output structured inference payloads.
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** a selected SKU and user settings: `Theme: Holiday Season`, `Context: Cozy living room with blurred festive lights`, `Aspect Ratios: 1:1, 4:5`,
    - **When** the form is submitted,
    - **Then** the prompt compiler outputs exact JSON generation requests for Vertex AI/Scene Machine containing positive prompts, negative exclusions, exact pixel dimensions for 1:1 and 4:5, and brand color constraints.

### User Story 2.4: Human-in-the-Loop (HITL) Review Studio & Comment Loop
> *As a marketing reviewer, I want to review AI-generated image variations in a clean grid, approve compliant assets, or reject flawed assets with natural language feedback that instantly triggers a corrected single-item regeneration.*

- [ ] **TASK-204.1: Interactive HITL Review Grid & Batch Action UI**
  - *Priority:* `P2` | *Effort:* `[L]` (12h) | *Dependencies:* `TASK-203` | *PRD Ref:* Section 7 (Feature 2.3) | *Target File(s):* [frontend/src/app/product/review-studio-grid.component.ts](./frontend/src/app/product/review-studio-grid.component.ts)
  - *Description:* Build standalone `HITLReviewStudio` component with Signals ([frontend/src/app/product/review-studio-grid.component.ts](./frontend/src/app/product/review-studio-grid.component.ts)) displaying side-by-side comparisons of the original SKU studio image and generated background variations across requested aspect ratios. Include actions: **[Confirm / Approve]** (moves to sync queue), **[Reject with Comment]** (opens text modal for specific feedback), and **[Batch Export Rejected CSV]** (downloads audit file of `item_id`, timestamp, and rejection reason).
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** 50 generated image variations in the review grid,
    - **When** the user checks 45 images and clicks "Confirm Selected", and clicks "Reject with Comment" on 1 image entering "Background shadow is too dark on left side",
    - **Then** 45 images transition to the approved sync queue, and the single rejected item enters the regeneration queue attached to its specific comment.

- [ ] **TASK-204.2: Prompt-Enrichment Middleware for Reviewer Rejection Comments**
  - *Priority:* `P2` | *Effort:* `[M]` (8h) | *Dependencies:* `TASK-204.1` | *PRD Ref:* Section 11 (LLM Comment Loop) | *Target File(s):* [src/product/prompt_enricher.py](./src/product/prompt_enricher.py)
  - *Description:* Implement feedback translation middleware ([src/product/prompt_enricher.py](./src/product/prompt_enricher.py)) that parses natural language reviewer comments and appends structured positive/negative prompt modifiers for single-item retry calls (e.g., translating "shadow too dark" -> positive prompt `balanced soft ambient lighting`, negative prompt `harsh dark shadows, uneven directional lighting`).
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** a rejected SKU image with comment "shadow too dark on left side",
    - **When** `PromptEnricher.enrich_for_regeneration(original_prompt, rejection_comment)` executes,
    - **Then** a new AI generation call is dispatched immediately with modified lighting weights without requiring manual prompt rewriting by the user.

### User Story 2.5: Dual-ID Merchant Center Synchronization & Chunked Async Batching
> *As an e-commerce lead operating both a Primary GMC account and a CSS Partner MC account, I want approved product images synchronized to both accounts simultaneously via chunked async processing, so that shopping ads display identical creative without hitting execution timeouts.*

- [ ] **TASK-205.1: Chunked Async Batch Processing & Continuation Queue**
  - *Priority:* `P0` (Scalability/Timeout Mitigation) | *Effort:* `[L]` (12h) | *Dependencies:* `TASK-204.1` | *PRD Ref:* Section 4.2, Section 6.2, Look-Ahead Bottleneck #2 | *Target File(s):* [src/core/batch_processor.py](./src/core/batch_processor.py)
  - *Description:* Build `ChunkedBatchProcessor` ([src/core/batch_processor.py](./src/core/batch_processor.py)) to manage bulk SKU syncs (up to 5,000 SKUs) without exceeding Content API rate limits or HTTP request timeouts. Chunk tasks into idempotent 50-item batches processed via asyncio worker pools or GCP Cloud Tasks. Store state (`completedSkuIds`, `failedSkuIds`, `continuationToken`) in persistent storage.
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** an approved batch of 5,000 SKUs ready for Merchant Center synchronization,
    - **When** the sync job initiates,
    - **Then** the batch processor splits the job into 100 chunks of 50 SKUs each, processes them asynchronously across worker instances without timing out, and provides a real-time progress bar (`Mapped 2,450 / 5,000 SKUs`).

- [ ] **TASK-205.2: Dual-ID Primary GMC & CSS Partner MC Sync Client**
  - *Priority:* `P2` | *Effort:* `[M]` (8h) | *Dependencies:* `TASK-205.1` | *PRD Ref:* Section 3.1, Section 4.2, Section 7 (Feature 2.4) | *Target File(s):* [src/product/dual_mc_sync.py](./src/product/dual_mc_sync.py)
  - *Description:* Build dual-account sync service ([src/product/dual_mc_sync.py](./src/product/dual_mc_sync.py)) inside the chunked processor. For every approved SKU, execute Content API for Shopping `products.update` (or `custombatch`) mutations to update `image_link` (or append to `additional_image_links`) on **both the Primary GMC ID and the CSS Partner MC ID** concurrently within the same transaction wrapper.
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** an approved image for SKU `SKU-999` where `PrimaryGMC = 11111` and `CSSPartnerMC = 22222`,
    - **When** the sync client executes the chunked update,
    - **Then** `additional_image_links` on both account 11111 and account 22222 receive the exact same public EU GCS image URL. If account 22222 fails, an error is logged and surfaced in the batch report without corrupting account 11111.

### User Story 2.6: Reversion & Campaign Bridge
> *As a marketing manager, I want a single-click button to revert any product's image back to its original studio photo, and a bridge button to push newly approved product lifestyle images directly into my PMax campaign asset groups.*

- [ ] **TASK-206: Single-Click Reversion & PMax Staging Bridge**
  - *Priority:* `P2` | *Effort:* `[M]` (6h) | *Dependencies:* `TASK-205.2` | *PRD Ref:* Section 7 (Feature 2.5) | *Target File(s):* [src/product/reversion_service.py](./src/product/reversion_service.py), [src/product/pmax_bridge.py](./src/product/pmax_bridge.py)
  - *Description:* Implement reversion handler ([src/product/reversion_service.py](./src/product/reversion_service.py)) restoring the original cached `image_link` across both Primary GMC and CSS MC feeds upon click. Build cross-module bridge ([src/product/pmax_bridge.py](./src/product/pmax_bridge.py)) allowing users in the Review Studio to click **"Push to PMax Asset Group"**, populating those images directly into Feature 1 (`TASK-101`) staging grid with pre-filled aspect ratios.
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** an approved background image currently live on 50 SKUs,
    - **When** the user selects the SKUs and clicks **"Revert to Baseline Photo"**,
    - **Then** both Primary GMC and CSS MC feeds are updated within 60 seconds with their original pre-transformation `image_link` URLs. When clicking **"Push to PMax"**, the selected images open in Feature 1's Asset Group assignment UI.

---

## Phase 3: Animated Product Video Generation & YouTube Sync (Epic 3)
> *As a marketing manager, I want to automatically generate 6–15 second animated product videos from static Merchant Center images across 16:9, 9:16, and 1:1 orientations, host them on YouTube with unlisted privacy, and sync them to both GMC feeds and PMax asset groups.*

### User Story 3.1: Category-Driven Motion Templates & Multi-Orientation Video Rendering
- [ ] **TASK-301: Category Motion Preset Engine & Parameter Mapping**
  - *Priority:* `P2` | *Effort:* `[M]` (8h) | *Dependencies:* `TASK-202` | *PRD Ref:* Section 7 (Feature 3.1) | *Target File(s):* [src/video/motion_templates.py](./src/video/motion_templates.py)
  - *Description:* Build `MotionTemplateEngine` ([src/video/motion_templates.py](./src/video/motion_templates.py)) mapping product categories (`google_product_category` / custom labels) to specific animation templates (e.g., `Category: Pet Food` -> `Falling Kibble into Bowl over 8s`; `Category: Liquids` -> `Shimmering container fill over 6s`). Inject static SKU images and brand constraints into the video animation prompt pipeline.
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** a batch of 20 first-party SKUs in the "Packaged Food" category selected for animation,
    - **When** the motion engine prepares generation requests,
    - **Then** each SKU automatically inherits the "Packaged Food foreground with falling motion" preset parameters without requiring manual animation timeline configuration.

- [ ] **TASK-302: Multi-Orientation Video Rendering & Spec Verification Engine**
  - *Priority:* `P2` | *Effort:* `[L]` (12h) | *Dependencies:* `TASK-301` | *PRD Ref:* Section 7 (Feature 3.2), Section 10 | *Target File(s):* [src/video/video_renderer.py](./src/video/video_renderer.py)
  - *Description:* Integrate with video generation backend (Scene Machine / Vertex AI video models) via `VideoRenderingService` ([src/video/video_renderer.py](./src/video/video_renderer.py)). Enforce generation of all 3 required PMax orientations: Horizontal (`16:9`), Vertical (`9:16`), and Square (`1:1`). Add post-rendering specification verifier ensuring duration is strictly `6s ≤ duration ≤ 15s` and framerate is stable (≥24 fps).
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** a video animation job for SKU `SKU-444`,
    - **When** the video rendering pipeline finishes,
    - **Then** exactly 3 video artifacts (16:9, 9:16, 1:1) are produced and verified; any video <6 seconds or >15 seconds is automatically rejected and re-rendered.

### User Story 3.2: YouTube API Hosting & Dual-ID Feed Synchronization
- [ ] **TASK-303: YouTube Data API v3 Upload & Privacy Governance Client**
  - *Priority:* `P2` | *Effort:* `[L]` (12h) | *Dependencies:* `TASK-003`, `TASK-302` | *PRD Ref:* Section 7 (Feature 3.4), Section 11 | *Target File(s):* [src/video/youtube_uploader.py](./src/video/youtube_uploader.py)
  - *Description:* Build YouTube upload service ([src/video/youtube_uploader.py](./src/video/youtube_uploader.py)) using chunked resumable uploads via YouTube Data API v3. Support two routing modes: if an **Advertiser-Owned Brand Channel ID** is configured, upload to that channel with user-configured `PUBLIC` or `UNLISTED` privacy; if omitted, upload to Google's auto-generated channel with **forced `UNLISTED`** privacy. Include API quota bucket tracking to prevent exceeding daily YouTube upload quotas (`10,000 units/day`).
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** an approved 9:16 animated product video where no custom channel ID is configured,
    - **When** `YoutubeUploader.upload_video(video_path, metadata)` executes,
    - **Then** the video is uploaded via chunked transfer, privacy status is strictly locked to `UNLISTED`, and a valid watch URL (`https://youtube.com/watch?v=...`) is returned and logged against daily quota consumption.

- [ ] **TASK-304: GMC Video Link & PMax Asset Group Video Synchronization**
  - *Priority:* `P2` | *Effort:* `[M]` (8h) | *Dependencies:* `TASK-205.2`, `TASK-303` | *PRD Ref:* Section 7 (Feature 3.4) | *Target File(s):* [src/video/pmax_video_assigner.py](./src/video/pmax_video_assigner.py)
  - *Description:* Extend `DualMcSync` (`TASK-205.2`) to populate the `[video_link]` attribute across both Primary GMC and CSS Partner MC product feeds with the generated YouTube URLs. Expose a direct attachment workflow ([src/video/pmax_video_assigner.py](./src/video/pmax_video_assigner.py)) allowing users to link these exact YouTube URLs to PMax Asset Group video slots.
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** 3 approved YouTube URLs (16:9, 9:16, 1:1) for SKU `SKU-555`,
    - **When** the sync service runs,
    - **Then** both Primary GMC and CSS MC feeds reflect the new `video_link`, and the user can attach all 3 orientations to target PMax Asset Groups in a single action, eliminating auto-generated video fallbacks.

### User Story 3.3: Rapid POC Scene Machine Shortcut
- [ ] **TASK-305: Scene Machine Project URL Bundle Shortcut**
  - *Priority:* `P3` | *Effort:* `[S]` (3h) | *Dependencies:* `TASK-201` | *PRD Ref:* Section 7 (Feature 3.5) | *Target File(s):* [frontend/src/app/video/scene-machine-shortcut.component.ts](./frontend/src/app/video/scene-machine-shortcut.component.ts)
  - *Description:* Build lightweight Angular standalone UI action button component **"Create in Scene Machine"** ([frontend/src/app/video/scene-machine-shortcut.component.ts](./frontend/src/app/video/scene-machine-shortcut.component.ts)) on selected static SKU assets. The handler packages the GCS signed URLs of the selected static assets and encodes them into a pre-configured import URL/manifest capable of being opened in a new browser tab directly in Scene Machine for manual fine-tuning.
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** 3 selected static images in the Product Studio,
    - **When** the user clicks "Create in Scene Machine",
    - **Then** a new browser tab opens to the Scene Machine workspace with the 3 GCS assets pre-loaded in the import staging tray without requiring manual file downloading and re-uploading.

---

## Phase 4: Campaign Text Automatic Spell Check (Epic 4)
**Goal:** Scan all PMax campaign text assets on demand or via scheduled recurring audits, flag spelling and grammar errors, present an interactive correction table with real-time character limit validation, and execute bulk API updates or CSV roundtrip exports.

### User Story 4.1: Text Asset Scanning Engine
> *As a marketing manager, I want an automated scanner to inspect all my PMax headlines and descriptions for typos and grammar mistakes, on demand or on a monthly cron schedule, so that our ads maintain high professional quality.*

- [ ] **TASK-401: PMax Text Asset Scanner & Grammar AI Engine**
  - *Priority:* `P4` | *Effort:* `[M]` (8h) | *Dependencies:* `TASK-003` | *PRD Ref:* Section 7 (Feature 4.1, 4.2) | *Target File(s):* [src/text/text_scanner.py](./src/text/text_scanner.py)
  - *Description:* Build text harvesting client ([src/text/text_scanner.py](./src/text/text_scanner.py)) querying Google Ads API for all active text assets across selected campaigns: `headlines` (max 30 chars), `long_headlines` (max 90 chars), `descriptions` (max 90 chars), and `path` strings (max 15 chars each). Pass harvested strings to grammar/spell checking AI engine (Vertex AI / Language API) to generate flagged typo reports and suggested corrections. Support both on-demand execution and scheduled recurring cron jobs.
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** 100 text assets across 5 PMax campaigns containing the headline `"Summr Discounts on All Items"`,
    - **When** the user triggers "Run Spell Check",
    - **Then** the scanner evaluates all strings within 15 seconds, flags `"Summr Discounts on All Items"` as a typo, and suggests the exact correction `"Summer Discounts on All Items"`.

### User Story 4.2: Interactive Review Table & Character Limit Validator
> *As a reviewer, I want to accept, ignore, or inline-edit spelling corrections in a table that enforces PMax character limits in real time, and bulk-sync all approved changes without interrupting ad serving.*

- [ ] **TASK-402: Interactive Spell Check Review Table with Character Validation**
  - *Priority:* `P4` | *Effort:* `[M]` (8h) | *Dependencies:* `TASK-401` | *PRD Ref:* Section 7 (Feature 4.3) | *Target File(s):* [frontend/src/app/text/spell-check-table.component.ts](./frontend/src/app/text/spell-check-table.component.ts)
  - *Description:* Build Angular standalone review UI table component with Signals ([frontend/src/app/text/spell-check-table.component.ts](./frontend/src/app/text/spell-check-table.component.ts)) rendering: `Campaign | Asset Group | Asset Type | Current Text | Flagged Error | AI Suggestion | Action`. Include row buttons: **[Accept Suggestion]** (stages suggestion), **[Deny / Ignore]** (marks false positive and hides), and **[Inline Edit]** (allows manual string typing). Add real-time keystroke validator ensuring inline edits never exceed field boundaries (`headlines ≤30`, `long_headlines/descriptions ≤90`, `path ≤15`).
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** an AI suggested correction for a headline (`Asset Type: HEADLINE`, max 30 chars),
    - **When** the user clicks "Inline Edit" and types a 33-character string (`"Unbelievable Summer Super Discounts Today"`),
    - **Then** the input box highlights red, displays `33/30 characters (exceeds limit by 3)`, and disables the "Stage Change" button until the string is shortened to ≤30 characters.

- [ ] **TASK-403: Bulk Apply API Sync & CSV Localization Export/Import**
  - *Priority:* `P4` | *Effort:* `[M]` (6h) | *Dependencies:* `TASK-402` | *PRD Ref:* Section 7 (Feature 4.4) | *Target File(s):* [src/text/bulk_text_updater.py](./src/text/bulk_text_updater.py)
  - *Description:* Implement **"Apply & Sync"** bulk mutation controller ([src/text/bulk_text_updater.py](./src/text/bulk_text_updater.py)) that commits all accepted/edited text patches via Google Ads API asset mutations without disrupting active ad rotation. Add CSV export/import handlers enabling teams to download the review table, share with external localization/compliance teams, and re-import verified corrections.
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** 25 accepted text corrections staged in the review table,
    - **When** the user clicks **"Apply & Sync"**,
    - **Then** the backend dispatches bulk update mutations to Google Ads API, successfully updating all 25 text assets and marking them `Synced` in the table. Roundtrip CSV export and re-import preserves all row IDs and character validations without data loss.

---

## Phase 5: Asset Scoring, Brand Gatekeeper & Prompt Middleware (Epic 5)
**Goal:** Automate quality control by passing every AI-generated image and video through a strict 2-stage verification gate: a technical pass/fail gate (dimensions, file size, duration) and an AI Vision brand rules gate (score 0–100). Automatically route high-scoring assets (≥85) to human review and trigger up to 2 self-healing retries for low-scoring assets before surfacing failures.

### User Story 5.1: Automated Technical & Brand Compliance Gatekeeper
> *As a brand manager, I want every generated visual automatically vetted for technical specs and scored against our brand rules before any human sees it, filtering out blurry, off-center, clipped, or hallucinated outputs.*

- [ ] **TASK-501: Automated Technical Verification Gate (Pass/Fail)**
  - *Priority:* `P0` (Quality Gatekeeper) | *Effort:* `[M]` (6h) | *Dependencies:* `TASK-102`, `TASK-203`, `TASK-302` | *PRD Ref:* Section 7 (Feature 5.1) | *Target File(s):* [src/ai/technical_gate.py](./src/ai/technical_gate.py)
  - *Description:* Build synchronous pre-check verification service ([src/ai/technical_gate.py](./src/ai/technical_gate.py)) that inspects generated asset metadata prior to AI Vision evaluation: verify dimensions exactly match requested aspect ratio (`1:1, 4:5, 1.91:1, 16:9, 9:16`), minimum resolution (`≥1200x628` for landscape), file size (`≤5 MB` for images), and video duration (`6s ≤ duration ≤ 60s`).
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** an AI-generated image file outputted at 800x418 (below the 1200x628 landscape minimum),
    - **When** `TechnicalGate.evaluate(asset_metadata)` executes,
    - **Then** the asset fails immediately with status `FAIL_TECHNICAL_RESOLUTION`, skipping expensive AI Vision scoring and triggering an immediate re-generation retry.

- [ ] **TASK-502: AI Vision Brand Rules Evaluator (Score 0–100)**
  - *Priority:* `P0` (Quality Gatekeeper) | *Effort:* `[L]` (12h) | *Dependencies:* `TASK-004`, `TASK-501` | *PRD Ref:* Section 7 (Feature 5.2) | *Target File(s):* [src/ai/vision_evaluator.py](./src/ai/vision_evaluator.py)
  - *Description:* Build vision evaluation engine ([src/ai/vision_evaluator.py](./src/ai/vision_evaluator.py)) calling Vertex AI Vision / Multimodal models with structured scoring prompts derived from `TASK-004` brand schemas. Evaluate and score assets on a `0–100` scale with strict deductions: Product Integrity (`-30` if product is clipped at edges), Centering & Composition (`-15` if primary SKU is off-center), Hallucination & Artifact Check (`-50` or `Auto-Fail` if non-existent accessories, strange text, or distorted objects appear), and Promotional Cleanliness (`Auto-Fail` if unauthorized sale badges or text overlays appear).
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** a generated product background where the product's top edge is clipped (`-30`) and a faint hallucinated text watermark appears (`Auto-Fail`),
    - **When** `VisionEvaluator.score_asset(image_uri, brand_config)` runs,
    - **Then** it returns `score: 0, status: 'AUTO_FAIL', reasons: ['Product top edge clipped (-30)', 'Hallucinated text/watermark detected (Auto-Fail)']`.

### User Story 5.2: Self-Healing Routing Loop & Quota Guardrails
> *As an AI pipeline architect, I want low-scoring assets to automatically self-heal through up to 2 retry attempts with adjusted temperature and negative prompts before alerting humans, while strictly throttling API concurrency to prevent rate-limit exhaustion.*

- [ ] **TASK-503: Automated Routing & Self-Healing Retry Loop with Rate-Limit Throttling**
  - *Priority:* `P0` (Pipeline Controller) | *Effort:* `[L]` (12h) | *Dependencies:* `TASK-502` | *PRD Ref:* Section 7 (Feature 5.3), Look-Ahead Bottleneck #4 | *Target File(s):* [src/ai/pipeline_router.py](./src/ai/pipeline_router.py)
  - *Description:* Implement `PipelineRouter` ([src/ai/pipeline_router.py](./src/ai/pipeline_router.py)). If asset `Score ≥ 85`, route directly to `HITLReviewStudio` (`TASK-204.1`). If `Score < 85` or `Auto-Fail`, trigger up to **2 automated self-healing retry calls** with dynamically adjusted temperature (lower for higher fidelity) and injected negative prompts targeting the specific deduction reasons (`e.g., negative prompt: clipped edges, off-center, text overlay`). Implement token-bucket rate limiting (max 10 concurrent generation retries) and a Dead-Letter Queue (DLQ) for items failing all 3 attempts.
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** an initial generation attempt that scores `72` due to an off-center SKU (`-15`) and slight background clutter (`-13`),
    - **When** `PipelineRouter` processes the score,
    - **Then** the asset does not appear in the human review grid; instead, it automatically dispatches Retry Attempt 1 with added negative prompts `off-center, asymmetric composition, cluttered background`. If Retry Attempt 1 scores `88`, it routes to the human review grid with `retries_used: 1`. If Attempt 3 still scores `<85`, it routes to the DLQ / failed review grid with full error history.

---

## Phase 6: Power User Configurations & Future Extensions (Epic 6)
**Goal:** Provide configurable category mapping for power users and establish clean architectural separation for future standalone GenAI text-to-image generation studios without disrupting core P1/P2 delivery.

### User Story 6.1: Power User Category Settings Adoption
> *As a power user, I want a Web App config module to map my product categories to specific AI generation presets once, so that my entire team shares standardized visual prompts during batch runs.*

- [ ] **TASK-601: Category-to-Preset Mapping UI & Workspace Persistence**
  - *Priority:* `P3` | *Effort:* `[M]` (8h) | *Dependencies:* `TASK-203`, `TASK-301` | *PRD Ref:* Section 7 (Feature 7) | *Target File(s):* [frontend/src/app/config/category-mapping-config.component.ts](./frontend/src/app/config/category-mapping-config.component.ts)
  - *Description:* Build Angular standalone configuration UI module component with Signals ([frontend/src/app/config/category-mapping-config.component.ts](./frontend/src/app/config/category-mapping-config.component.ts)) allowing users to map Merchant Center `google_product_category` strings (or custom labels `0-4`) to specific Feature 2 scene presets (`TASK-203`) and Feature 3 motion templates (`TASK-301`). Persist configuration map in shared database/config store accessible across multi-user workspaces.
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** a power user mapping `Home & Garden > Outdoor Lighting` -> `Scene: Sunny Outdoor Patio` + `Motion: Ambient Evening Glow`,
    - **When** any team member selects SKUs in that category and opens the Product Studio,
    - **Then** the scene and motion form fields automatically pre-populate with the shared mapped presets.

### User Story 6.2: Future Scope — Vertex AI Text-to-Image Creative Studio
> *As a creative lead, I want to generate lifestyle images from scratch using text prompts when no studio product photography exists (Future Scope).*

- [ ] **TASK-602: Standalone Vertex AI Text-to-Image Creative Generation Studio**
  - *Priority:* `Future` | *Effort:* `[XL]` (Bound to future milestone) | *Dependencies:* `TASK-001`, `TASK-004` | *PRD Ref:* Section 7 (Feature 6) | *Target File(s):* [src/studio/gen_ai_studio.py](./src/studio/gen_ai_studio.py)
  - *Description:* Build standalone creative generation workspace ([src/studio/gen_ai_studio.py](./src/studio/gen_ai_studio.py)) utilizing latest-generation Vertex AI (`Imagen 3` / `GenAI`) for from-scratch lifestyle imagery with native aspect ratio selection (1:1, 4:5, 1.91:1) and character/style consistency across variations. Output images directly to Adios 2.0 GCS buckets and PMax Asset Group staging.
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** an authorized user entering a text-to-image prompt (`"Family playing with dog in sunny backyard, professional commercial photography"`),
    - **When** generation is requested across 1:1 and 1.91:1,
    - **Then** the studio generates and displays high-fidelity lifestyle variations linkable directly to PMax Asset Groups.

---

## Phase 7: End-to-End Verification & Telemetry Instrumentation (Epic 7)
**Goal:** Validate all automated workflows and race-condition mitigations via rigorous integration test suites simulating 5,000-SKU loads and multi-campaign spell/KPI rotations, and instrument real-time HEART telemetry tracking manual hours saved (>75%) and PMax Ad Strength progression ("Excellent").

### User Story 7.1: E2E Seasonal Transition & Quality Audit Verification
> *As QA Lead, I want automated E2E test harnesses proving that large-scale seasonal transitions and pre-flight quality audits execute flawlessly across all gates, queues, and dual-ID feeds.*

- [ ] **TASK-701: E2E Holiday Seasonal Transition 5,000-SKU Integration Test Harness**
  - *Priority:* `P1` (Verification) | *Effort:* `[L]` (14h) | *Dependencies:* `TASK-105.2`, `TASK-204.1`, `TASK-205.2`, `TASK-503` | *PRD Ref:* Section 8 (Use Case A), Look-Ahead Bottleneck #2 | *Target File(s):* [tests/e2e/test_seasonal_transition.py](./tests/e2e/test_seasonal_transition.py)
  - *Description:* Build automated test suite ([tests/e2e/test_seasonal_transition.py](./tests/e2e/test_seasonal_transition.py)) simulating bulk ingestion of 5,000 first-party SKUs across Primary GMC and CSS Partner MC feeds. Verify complete execution flow: `TASK-502/503` gatekeeping (>85 routing, self-healing retries), `TASK-204` HITL batch approval, `TASK-205` chunked dual-ID sync without execution timeouts, `TASK-105` scheduled promotional timer insertion at `start_time`, and automated post-campaign reversion to exact pre-promo assets at `end_time`.
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** a simulated mock feed of 5,000 SKUs undergoing Holiday Season transition,
    - **When** the E2E test harness runs the simulated timeline from Oct 1 to Dec 27,
    - **Then** 100% of approved SKU image links successfully update on both Primary GMC and CSS MC feeds exactly at `start_time`, and on Dec 27 at `end_time`, 100% of SKUs revert to their exact pre-promotion baseline studio images without data loss or execution timeouts.

- [ ] **TASK-702: E2E Pre-Flight Campaign Quality & Eviction Audit Test Suite**
  - *Priority:* `P1` (Verification) | *Effort:* `[M]` (8h) | *Dependencies:* `TASK-103.2`, `TASK-104`, `TASK-402`, `TASK-403` | *PRD Ref:* Section 8 (Use Case B), Look-Ahead Bottleneck #3 | *Target File(s):* [tests/e2e/test_pre_flight_audit.py](./tests/e2e/test_pre_flight_audit.py)
  - *Description:* Build integration test suite ([tests/e2e/test_pre_flight_audit.py](./tests/e2e/test_pre_flight_audit.py)) verifying simultaneous execution of `TASK-401/402` spell checking across 15 text assets, and `TASK-103/104` capacity-based KPI eviction across 12 full PMax Asset Groups during a 40-banner summer rollout.
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** 12 full Asset Groups containing both lowest-CTR evergreen images and locked `*_FIXED` brand logos, plus text assets with known typos (`"Summr Discounts"`),
    - **When** the test harness runs the pre-flight audit and banner rollout,
    - **Then** the spell check successfully patches the typo, and the capacity eviction engine replaces the lowest-CTR evergreen images across all 12 groups while keeping 100% of `*_FIXED` locked assets untouched.

### User Story 7.2: HEART Metrics & Ad Strength Telemetry Instrumentation
> *As Product Owner, I want automated telemetry logging daily active users, manual hours saved, AI first-pass approval rates, and PMax Ad Strength progression so we can prove our success metrics.*

- [ ] **TASK-703: HEART Metrics & PMax Ad Strength Telemetry Dashboard Collector**
  - *Priority:* `P1` | *Effort:* `[M]` (8h) | *Dependencies:* `TASK-106`, `TASK-204.1`, `TASK-503` | *PRD Ref:* Section 9 (HEART Metrics), Section 10 | *Target File(s):* [src/core/telemetry_logger.py](./src/core/telemetry_logger.py), [frontend/src/app/telemetry/heart-dashboard.component.ts](./frontend/src/app/telemetry/heart-dashboard.component.ts)
  - *Description:* Implement non-blocking asynchronous telemetry logger ([src/core/telemetry_logger.py](./src/core/telemetry_logger.py)) capturing key PRD success signals: Daily/Weekly Active Users (DAU/WAU), manual hours saved per asset group update (benchmarked against 20 minutes per manual update -> targeting `>75% reduction`), AI First-Pass Approval Rate (targeting `>80% pass without regeneration`), and PMax Ad Strength distribution across managed campaigns (`Poor / Average / Good / Excellent`, targeting continuous upward progression to `Excellent`). Build Angular standalone dashboard UI component with Signals ([frontend/src/app/telemetry/heart-dashboard.component.ts](./frontend/src/app/telemetry/heart-dashboard.component.ts)) exposing these metrics.
  - *Acceptance Criteria (Given/When/Then):*
    - **Given** 100 asset group updates and 500 AI background generations processed in a week,
    - **When** the telemetry logger records execution events,
    - **Then** all metrics log asynchronously without degrading UI responsiveness, and the central dashboard accurately reports the exact percentage of time saved, AI first-pass pass rate, and the proportion of asset groups reaching `Excellent` Ad Strength.
