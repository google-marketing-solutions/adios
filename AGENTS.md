---
title: Project Agent Configuration
description: Global steering for coding agents in this repository
---

# Project Context
Enterprise-grade Web App automation and creative enhancement platform for managing, generating, and optimizing Performance Max (PMax) campaign assets and Google Merchant Center (GMC) product media at scale via Google Ads API, Content API for Shopping, and Vertex AI.

# Tech Stack
*   **Backend Language**: Python 3.11+ (FastAPI / Pydantic / Uvicorn)
*   **Frontend Language**: TypeScript (Angular 22+ Web App)
*   **Key Dependencies**: `google-cloud-aiplatform` (Vertex AI), `google-ads` (Google Ads API), `google-api-python-client` (Content API for Shopping, YouTube Data API v3), `pydantic` (v2 Strict Validation), `pytest`, `ruff`

# Hierarchical Context & Precedence
In AI-assisted workflows (e.g., Jetski / Gemini Coder), context files (`AGENTS.md` / `GEMINI.md`) are loaded hierarchically across multiple levels:
*   **User-Level** (e.g., `~/.config/agents/GEMINI.md` or `~/.gemini/GEMINI.md`): Defines personal preferences across all workspaces.
*   **Project-Level** (e.g., `<repo_root>/AGENTS.md` or `<repo_root>/GEMINI.md`): Defines shared team expectations and architectural invariants for the specific repository.
*   **Precedence Policy**: Context closest to the working directory and tool-specific context override higher-level user or repository defaults.

# Core Agent Rules
These rules are active for every interaction across this codebase:
*   Always check `_agents/rules/` before proposing or making structural changes.
*   Maintain the **"Smart Developer"** perspective: be explicit, precise, and concise without conversational fluff.
*   **Opinionated Steering Keywords**: When defining instructions or modifying system prompts, use authoritative keywords (**`always`**, **`must`**, **`never`**) to establish unambiguous behavioral boundaries.
*   Verify all assumptions by reading existing implementations and imports before writing code.
*   **Local Server Orchestration**: When starting or stopping local development servers on Windows, **always** execute the batch files in the `local/` directory (`local\start-server.bat` or `local\stop-server.bat` respectively) rather than running raw `uvicorn` or `npm` commands directly.
*   Follow the specific guidelines linked below for specialized tasks.

# Modular Rule & Skill Inclusion
Rules are discovered dynamically from individual markdown files in `_agents/rules/*` based on file pattern matching (`globs`). When crafting context configurations, include specific modular rules using direct import syntax where supported (e.g., `@./_agents/rules/python_styling.md`). For on-demand capabilities, leverage isolated `SKILL.md` folders inside local skill directories (`.gemini/skills/` or `.agents/skills/`).

## 🐍 Python 3 & FastAPI Best Practices

The Adios 2.0 Advanced backend is built on Python 3.11+, leveraging FastAPI and Pydantic v2 for static type checking, runtime validation, and high-concurrency async I/O.

### Type Safety & Structural Guidelines

| Category | Recommended Approach | Legacy / Discouraged Approach | Why It Matters |
| :--- | :--- | :--- | :--- |
| **Type Hints** | Always use Python 3.11+ type hints (`list[str]`, `dict[str, Any]`, `X \| Y`). | Avoid `Any` or untyped function signatures. | Static type checkers (`mypy`, `pyright`) and Pydantic rely on strict type annotations to catch bugs at compile/lint time and serialize APIs cleanly. |
| **Schema Validation** | Use **Pydantic v2 Models** (`BaseModel`, `Field()`) for all API requests/responses. | Avoid raw dictionary manipulation or ad-hoc validation loops. | Pydantic guarantees exact schema enforcement, automatic OpenAPI doc generation, and high-performance Rust-backed JSON parsing. |
| **Async / Await** | Use `async def` for FastAPI endpoints and I/O-bound Google API client interactions. | Blocking synchronous calls on the main Uvicorn event loop. | `async def` ensures the Uvicorn ASGI server can concurrently handle large batch requests without freezing thread pools. |
| **Linting & Formatting** | Always run **`ruff check`** and **`ruff format`**. | Avoid mixing flake8, black, and isort with inconsistent configurations. | `ruff` enforces a unified, lightning-fast quality standard across all backend files. |

---

### Code Execution & Immutability Patterns
*   **Config & Dependency Injection:** Use FastAPI `Depends()` for service injection, database/API client lifecycle management, and authentication headers.
*   **Modern Python Idioms:** Use `match / case` for structural pattern matching, `dataclasses` or `BaseModel` for data transfer objects, and explicit exception chaining (`raise CustomError(...) from exc`).
*   **Frontend / API Boundary:** The Angular 22+ frontend communicates with the FastAPI backend strictly via REST JSON boundaries (`/v1/...`). Never leak backend internal stack traces or Python object structures to frontend responses.

## 🌐 Best Practices for API Development

Modern API design prioritizes a **resource-oriented architecture** over arbitrary action-based endpoints. This design pattern standardizes how client applications interact with backend systems over HTTP/gRPC.

### API Method Conventions

| API Method | HTTP Verb | RPC Mapping | Standard Behavioral Rules |
|---|---|---|---|
| **Create** | `POST` | `CreateResource` | Must take a parent resource and the resource itself. Should return the created resource. |
| **Get** | `GET` | `GetResource` | Must retrieve a single resource by its unique resource name. |
| **List** | `GET` | `ListResources` | Must retrieve a collection of resources. Must support structured **pagination** (using token-based cursors). |
| **Update** | `PUT` or `PATCH` | `UpdateResource` | Must update a resource. **Prefer PATCH** with a field mask (e.g., `update_mask`) to support partial updates. |
| **Delete** | `DELETE` | `DeleteResource` | Must remove a resource by its unique resource name. |
| **Custom** | `POST` | `CustomAction` | Use only when standard CRUD operations cannot express the business logic (e.g., `CancelOrder`, `Purge`). |

### Core Design Principles
*   **Resource Names as Hierarchical Paths:** Resources are identified by structured, hierarchical names (e.g., `//publisher.googleapis.com/users/{user_id}/documents/{document_id}`). These names act as natural URIs and clearly define resource ownership.
*   **Structured Errors:** Rather than returning plain string messages, APIs must return structured errors. These errors should conform to a standard schema containing an error code (e.g., `400 Bad Request`), a canonical status (e.g., `INVALID_ARGUMENT`), and a list of structured details (such as input validation violations or help links).
*   **Backward Compatibility First:** Changes to API contracts must avoid breaking existing clients. Introduce major versions (e.g., `/v1`, `/v2`) only when backward compatibility is completely impossible. Utilize "dry run" parameters (e.g., `validate_only: true`) for complex mutations to let clients verify payloads without executing the actions.

## ☁️ Best Practices for Google Cloud

Deploying cloud-native solutions is organized around the core pillars of the **Google Cloud Well-Architected Framework**. This framework helps organizations design topologies that are resilient, secure, and cost-effective.

### The 5 Architectural Pillars

```
                      +-------------------+
                      |   Google Cloud    |
                      |  Well-Architected |
                      +---------+---------+
                                |
       +-----------------+------+-----------------+
       |                 |                        |
+------v------+   +------v------+          +------v------+
| Operational |   | Security &  |          | Reliability |
| Excellence  |   | Compliance  |          | Horizontal  |
| IaC, CI/CD  |   | IAM, KMS    |          | Scaling, HA |
+-------------+   +-------------+          +-------------+
```

### 1. Operational Excellence
*   **Infrastructure as Code (IaC):** Treat your entire cloud topology as version-controlled code. Implement architectures using repeatable templates (e.g., Terraform or Cloud Deployment Manager) to ensure environments can be easily duplicated or recovered.
*   **CI/CD Automation:** Deploy cloud workloads through automated pipelines. This practice guarantees that unit tests, integration tests, and security scanning run automatically on every change.

### 2. Security, Privacy, and Compliance
*   **Principle of Least Privilege:** Strictly manage access control through Identity and Access Management (IAM). Bind permissions to dedicated Service Accounts with minimal scopes rather than using broad, user-level administrative roles.
*   **Encryption Everywhere:** Keep sensitive data encrypted both at rest and in transit. Leverage managed keys (via Cloud Key Management Service) to handle key rotation, separation of duties, and access auditing.

### 3. Reliability
*   **Horizontal Scaling:** Design services to scale horizontally rather than vertically. Use managed computing environments (e.g., Cloud Run or GKE) that dynamically adjust instances based on traffic loads.
*   **Failover & Redundancy:** Avoid single points of failure by spreading application layers across multiple zones and regions.

### 4. Cost Optimization
*   **Right-sizing & Autoscale:** Constantly analyze resource consumption. Configure systems to scale down to zero when idle and choose instances that match actual memory and CPU usage.

### 5. Performance Optimization
*   **Low-Latency Caching:** Place global load balancing and caching services in front of core APIs to reduce cold starts, save server bandwidth, and minimize round-trip latencies.

## 🎨 UI/UX Development Guidelines

Consistent layout rules, predictable transition timing, and robust accessibility patterns ensure a high-fidelity user experience.

| UX Category | Specification | Target Metric / Standard |
| :--- | :--- | :--- |
| **Layout & Grid** | **8px Grid System** | Align all structural margins, padding, and positioning elements to multiples of 8px (e.g., 8px, 16px, 24px, 32px) to ensure uniform whitespace. |
| **Component Architecture** | **Angular 22+ Material & Standalone & Signals** | Enforce material components and material design system. Enforce standalone components (`standalone: true`), strict TypeScript and template type checking (`strictTemplates: true`), and reactive **Signals** (`signal()`, `computed()`, `input()`, `output()`, and `resource()` API for REST endpoints). Avoid legacy NgModule patterns and unnecessary RxJS/Zone.js boilerplate. |
| **Aesthetics** | **Standardized Theme** | Establish a strict primary color palette, explicit typography scaling, and soft CSS shadows over harsh, hard-coded borders. |
| **Motion** | **Native CSS Transitions** | Enforce transition windows between **150ms and 300ms** utilizing native CSS. Avoid `@angular/animations` or heavy JS animations for simple transitions to prevent change detection and rendering overhead. |
| **Feedback** | **Visual Confirmation** | All active controls (buttons, links, form inputs) must explicitly implement hover states, active transitions, and visible focus rings. |
| **Semantic HTML** | **A11y Native Structures** | Replace unstructured `<div>` hierarchies with semantic equivalents like `<header>`, `<main>`, `<nav>`, `<article>`, and `<button>`. |
| **Navigation** | **Keyboard Accessibility** | Maintain absolute keyboard traversal pathways (`Tab` indexing) and define descriptive `aria-label` tags for non-text interactive components. |

## 🔴 Test-Driven Development (TDD) Best Practices

Test-Driven Development is a software design process, not just a testing mechanism. By writing automated assertions prior to writing functional code, developers establish a clear contract of requirements.

### The Standard TDD Cycle

```
         +---------------------------------------+
         |               1. RED                  |
         |  Write a small, failing test first.   |
         +-------------------+-------------------+
                             |
                      [Runs & Fails]
                             v
         +---------------------------------------+
         |              2. GREEN                 |
         |  Write minimum code to make it pass.  |
         +-------------------+-------------------+
                             |
                      [Runs & Passes]
                             v
         +---------------------------------------+
         |             3. REFACTOR               |
         |  Clean up structural code while       |
         |  keeping all existing tests green.    |
         +---------------------------------------+
```

### Strategic Rules for TDD
*   **Verify the Failure:** Always run your newly written test and verify that it fails before implementing the solution. A test that passes before code is written is invalid and usually indicates a false positive.
*   **Test Public Behavior, Not Internals:** Focus test assertions on public interfaces and APIs. Testing private methods binds tests to specific implementation details, making future refactoring extremely painful.
*   **Keep Tests Fast:** Minimize external network calls, file system writes, and database operations in your core TDD loop. If the test suite takes more than a few seconds to run, developers will stop running it locally.

## 🧪 Testing Standards: Unit vs. Integration

A healthy testing strategy separates rapid, isolated **unit tests** from deep, real-world **integration tests**.

### Python Backend Testing (Pytest) & Frontend Testing

| Dimension | Unit Testing (Pytest) | Integration (End-to-End) Testing |
| :--- | :--- | :--- |
| **Testing Scope** | Verifies isolated Pydantic schemas, helper utilities, pure algorithms, and single FastAPI endpoints via `TestClient`. | Verifies full user flows, multi-page routing, and complete backend network exchanges against Google Ads API mocks. |
| **Environment** | `pytest` + `pytest-asyncio` with `TestClient` (running over ASGI). | Headless browser drivers (Playwright / Cypress) against sandboxed FastAPI instances or API mock servers. |
| **External I/O** | All network requests to Google Ads API, Content API, and Vertex AI are completely mocked using `pytest.MonkeyPatch` or `unittest.mock`. | Runs against sandboxed environments with network interception or mock backends to verify true contract adherence. |
| **Best Practices** | • Ensure a **clean state** between individual tests via `pytest` fixtures.<br>• Validate both successful Pydantic model serialization and structured JSON error responses. | • Simulate realistic user actions across the Angular 22+ standalone UI.<br>• Verify boundary serialization between Angular Signals/resource REST clients and FastAPI endpoints. |

#### Python Unit Test Example (Pytest + FastAPI TestClient)
```python
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from src.main import app

@pytest.fixture
def client() -> TestClient:
    return TestClient(app)

def test_health_check_endpoint(client: TestClient) -> None:
    # Act
    response = client.get("/health")

    # Assert
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status_code"] == "healthy"
    assert "FastAPI" in data["architecture"]
```

# Sub-Rule Index
- [Holistic Reading](_agents/rules/holistic-reading.md)
- [Lint and Fix](_agents/rules/lint-and-fix.md)
- [Pacing](_agents/rules/pacing.md)
- [Safety and Scope](_agents/rules/safety-and-scope.md)
- [Glob Scoped Rules](_agents/rules/glob-scoped-rules.md)
- [Inference Aware Context](_agents/rules/inference-aware-context.md)
- [Verification Loop](_agents/rules/verification-loop.md)
- [Subagent Orchestration](_agents/rules/subagent-orchestration.md)

# Google Ads API Integration Standards

When implementing calls or mutations against the Google Ads API, strictly follow these requirements:

## Authentication & Header Requirements
* **Manager (MCC) Customer ID Header (`login-customer-id`)**:
  * Always set the Manager (MCC) Account ID (`GOOGLE_ADS_MCC_CUSTOMER_ID` in `config.txt`, e.g., `1234567890`) as the `login_customer_id` header when accessing or mutating resources in client customer accounts.
  * **Never** set a client customer account ID as the `login_customer_id` header in MCC hierarchy environments; doing so triggers `USER_PERMISSION_DENIED` authorization errors.
  * Always instantiate `GoogleAdsClient` via `default_auth_provider.get_google_ads_client(user_access_token=..., include_login_customer_id=True)`.

## Error Handling & Batch Operations
* **Error Formatting**: Always extract human-readable error messages from `GoogleAdsException` or gRPC errors using `_format_google_ads_error()` before returning HTTP errors to ensure full visibility into API validation issues.
* **Partial Failure Support**: Always set `partial_failure=True` on request objects (e.g. `MutateAssetGroupAssetsRequest(customer_id=..., partial_failure=True)`) when executing batch mutations via `mutate_asset_group_assets(request=...)` so valid sub-operations succeed even if individual target items fail validation.
* **Minimum Asset Group Requirements**: Remember that Google Ads API enforces minimum asset composition rules (3 headlines, 1 long headline, 1 description, 1 square image) on Performance Max asset groups before allowing asset linking.
