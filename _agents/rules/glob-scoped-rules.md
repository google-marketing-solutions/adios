---
title: Scoped Rule Triggers via Glob Patterns
description: Best practices for configuring glob-based metadata headers to inject rules only when relevant files are edited.
globs: ["_agents/rules/**/*.md", ".cursor/rules/**/*.mdc", ".claude/rules/**/*.md"]
---

# Scoped Rule Triggers via Glob Patterns

**Objective**: Optimize the LLM's context window and Attention Budget by using file pattern matching (`globs`) to load specific domain rules **only** when files matching those patterns are viewed or modified.

## Why Use Glob Scoping?

When a repository grows large, putting database rules, CSS animation guidelines, backend API standards, and infrastructure deployment steps into a single global `AGENTS.md` overwhelms the AI assistant. This causes instruction collision (e.g., applying React styling rules to a Python backend script).

By attaching `globs:` metadata headers to each rule file, the agent's runtime dynamically activates instructions based on the user's active context.

## Rule Header Format Standard

Every modular rule file should begin with a YAML frontmatter block specifying its title, description, and target `globs`:

```yaml
---
title: Database Schema & Migration Rules
description: Enforce nullable constraints, rollback methods, and schema verification.
globs: ["src/db/**/*.sql", "src/models/**/*.py", "migrations/**/*.py"]
---
```

## Recommended Glob Mapping Strategy

| Domain / Layer | Recommended `globs` Pattern | Example Rules to Include |
| :--- | :--- | :--- |
| **Database & Models** | `["src/db/**", "migrations/**", "**/*.model.ts"]` | Schema invariants, migration naming, ORM session cleanup, no destructive drops. |
| **Frontend UI / Components** | `["src/components/**/*.tsx", "src/app/**/*.vue", "**/*.scss"]` | Accessibility (a11y) attributes, responsive breakpoints, state management patterns. |
| **Backend API Controllers** | `["src/api/**", "src/controllers/**", "src/routes/**"]` | Input validation (Pydantic/Zod), HTTP status codes, rate limiting guards. |
| **Tests & Specs** | `["tests/**", "**/*.spec.ts", "**/*.test.py"]` | Mocking guidelines, test data factories, assertion clarity, Red-Green-Refactor cycles. |
| **CI/CD & Config** | `["Dockerfile", ".github/workflows/**", "dist/**", "build/**", "bazel-bin/**"]` | Hermetic build rules, container size limits, secret handling guards. |

## Do's and Don'ts

### Do
*   Keep glob patterns specific enough to avoid false-positive activations across unrelated subdirectories.
*   Use multiple glob entries in the array when a rule spans both implementation and corresponding test files (e.g., `["src/services/*.ts", "tests/services/*.test.ts"]`).

### Don't
*   Don't use `globs: ["**/*"]` for specialized rules (e.g., SQL conventions); reserve global matching strictly for universal safety and pacing rules.
