---
title: Scope Containment, Negative Guardrails & Command Safety
description: Strict invariants to prevent scope creep, unauthorized dependencies, comment deletion, and destructive terminal operations.
globs: ["**/*"]
---

# Scope Containment, Negative Guardrails & Command Safety

**Objective**: Protect repository integrity by enforcing strict boundaries on what the AI agent can and cannot do during automated refactoring and terminal execution.

## 1. Scope Containment & Negative Guardrails

*   **Zero Unrequested Dependencies**: Never add new third-party libraries, NPM packages, PyPI modules, or external APIs without explicit prior authorization from the user. Always prefer existing standard library tools or pre-installed repository dependencies.
*   **Preserve Unrelated Code & Comments**: Never delete, rewrite, or reformat existing comments, docstrings, or code blocks that are outside the immediate scope of the requested change. Maintain documentation integrity at all times.
*   **Relative File Links in Markdown**: Whenever creating, updating, or generating `.md` files (`TASKS.md`, `PRD.md`, `README.md`, specs, or artifacts within the target project directory), you **MUST ALWAYS** format all file links as **relative paths to the project directory** (e.g., `[PRD.md](./PRD.md)` or `[src/auth.py](./src/auth.py)` or `[Header](./docs/spec.md#L10)`). You **MUST NEVER** use absolute `file:///Users/...` URIs inside project markdown files, as absolute paths break portability across different developer machines and version control systems.
*   **No Silent Error Swallowing**: Never introduce `try/catch` or `except Exception:` blocks that silently swallow exceptions without logging, re-throwing, or explicit error handling.
*   **No Unrequested Refactoring ("Over-Engineering")**: Do not rewrite adjacent "ugly" but working code unless specifically asked. Focus 100% of the attention budget and diff footprint on solving the user's specific problem.

## 2. Terminal & Git Safety Allowlist

### Authorized / Safe Commands (Can run autonomously)
*   **Read-Only Inspection**: `git status`, `git diff`, `git log -n 10`, `ls -la`, `pwd`, `find`, `grep` / `rg` (on scoped dirs).
*   **Local Verification**: `npm test`, `pytest`, `cargo test`, `npm run lint`, `cargo check`, `go test ./...`.
*   **Local Build**: `npm run build`, `make`, `cargo build`, `bazel build //...`.

### Strictly Forbidden / High-Risk Commands (Require explicit human sign-off)
*   **Destructive Filesystem**: `rm -rf /`, `rm -rf *`, deleting entire folders or database files directly.
*   **Destructive Git Operations**: `git reset --hard`, `git clean -fd`, `git push --force`, `git checkout .` (discarding unstashed user work).
*   **Production Mutations**: Running live database migrations against production endpoints, deploying directly to cloud instances (`terraform apply`, `kubectl delete`, `gcloud app deploy`) without human confirmation.

## Examples

### Do
*   If you notice a deprecated method in a file you are editing, but it is unrelated to the current task, leave it untouched or mention it as an informational note at the end of your response.

### Don't
```bash
# NEVER run destructive git commands that could wipe out the user's uncommitted work
git reset --hard HEAD~1
git clean -fdx
```
