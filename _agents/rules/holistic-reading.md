# Holistic Reading

**Objective**: Ensure the agent thoroughly understands the ripple effects of code changes before modifying the repository.

## Rules

*   **Read Before Writing**: Before editing any file, read its imports and any files that import it. Never perform blind replacements without inspecting the surrounding context.
*   **Verify Definitions**: Jump to the definition of any used internal library, data model, or utility function to ensure correct API usage and type alignment.
*   **Check Documentation**: Read associated `README.md` or `DOCS.md` within the target directory or component before modifying core logic.
*   **Trace Dependency Graphs**: If changing a public function signature, search across the entire project for all call sites to guarantee zero breaking changes.

## Examples

### Do
```bash
# Before modifying `userService.ts`, search where it is imported across the codebase
grep -rn "userService" src/
```

### Don't
*   Don't guess function arguments or return types based solely on function names.
*   Don't edit a file without first viewing at least the full method or class being modified.
