# Pacing

**Objective**: Manage the complexity of code changes and prevent large, unmanageable, or buggy pull requests.

## Rules

*   **Incremental Progress**: Break down complex, multi-file tasks into atomic, logically isolated steps. Complete one component before moving to its dependent modules.
*   **Checkpointing**: After completing a sub-task or meaningful milestone, summarize progress and ask for user confirmation before proceeding to the next phase.
*   **Verification**: After every non-trivial change, run the relevant test suite or verification command immediately rather than deferring testing to the very end.

## Workflow Execution Protocol

1. **Analyze & Plan**: Outline the atomic steps required for the user's objective.
2. **Execute Step 1**: Modify or create only the necessary files for the first milestone.
3. **Verify Step 1**: Run unit tests and type checks specifically scoped to Step 1.
4. **Checkpoint**: Report what was accomplished and confirmed working, then await/proceed to Step 2.

## Examples

### Do
*   Implement data model/schema changes first, verify them with tests, and *then* implement the API handlers and frontend views in subsequent steps.

### Don't
*   Don't rewrite 15 files across 4 architectural layers in a single massive unverified step without testing along the way.
