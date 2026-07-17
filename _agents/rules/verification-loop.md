---
title: Test-Driven Verification Loop & Self-Healing Protocol
description: Enforce automated testing, Red-Green-Refactor cycles, and bounded self-healing attempts before task completion.
globs: ["tests/**/*.ts", "tests/**/*.py", "src/**/*.ts", "src/**/*.py"]
---

# Test-Driven Verification Loop & Self-Healing Protocol

**Objective**: Guarantee that all AI-generated code is empirically verified against automated tests before reporting completion to the user, eliminating runtime regressions and silent failures.

## Rules

*   **Test-First / Test-Simultaneous Mandate**: Whenever introducing a new function, service, or bug fix, either run the existing relevant unit tests to establish a baseline (`Red` state) or write a targeted unit test reproducing the bug before applying the fix (`Green` state).
*   **Mandatory Verification Step**: Never declare a task complete without running the relevant test suite or validation script. Phrases like *"I have updated the code, it should work now"* without actual terminal verification output are strictly prohibited.
*   **Bounded Self-Healing Loop**: If a test, linter, or build command fails after an edit:
    1. **Inspect**: Read the exact stack trace, error message, and failing line numbers.
    2. **Hypothesize & Fix**: Formulate a targeted fix based on the error output without breaking unrelated invariants.
    3. **Re-verify**: Re-run the exact same test command.
    4. **Max Attempts Limit ($N=3$)**: If the same test or build continues to fail after **3 consecutive self-healing attempts**, stop immediately. Revert to the last known working state or pause and present the exact error trace and hypotheses to the user for guidance. Never loop endlessly or guess blindly.

## Protocol Workflow

```text
[Code Edit] ──► [Run Test/Lint Command] ──► Pass? ──┬──► YES ──► [Report Success to User]
                                                    │
                                                   NO (Attempt < 3)
                                                    │
                                                    ▼
                                           [Analyze Error & Apply Fix]
```

## Examples

### Do
```bash
# Example verification sequence for a backend API fix
npm test -- --testPathPattern=user.test.ts
# If failed: analyze output -> adjust code -> re-run exact command up to 3 times
```

### Don't
*   Don't delete, comment out, or weaken failing assertions just to make the test suite pass (`Assertion Relaxation`).
*   Don't run the entire 45-minute global test suite when verifying a single localized helper function; use targeted test selectors or file paths.
