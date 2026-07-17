# Lint and Fix

**Objective**: Automate adherence to project-specific styling rules and prevent build or compilation errors right from the first edit.

## Rules

*   **Zero-Warning Policy**: AI-generated code must pass the local linter and type checker on the first try with zero warnings or errors introduced.
*   **Implicit Fixes**: If the agent detects a lint error or formatting inconsistency while reading existing code within the target scope, it should proactively propose or apply a fix as part of the current task.
*   **Command Execution**: Use `npm run lint` / `npm test` to verify syntax and styling before finalizing the response.

## Examples

### Do
*   Always run the project's canonical verification script before reporting a task complete:
```bash
# Verify syntax and formatting cleanly before returning
npm run lint -- --fix
npm run typecheck
```

### Don't
*   Don't leave unused imports, unannotated variables, or `any` / `TODO` shortcuts when generating production code.
*   Don't suppress lint rules (e.g., `// eslint-disable-next-line` or `# noqa`) unless explicitly instructed by the user with documented justification.
