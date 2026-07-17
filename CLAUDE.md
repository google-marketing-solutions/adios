# Claude Code Project Configuration

> **Note**: This repository uses a Universal Agent Configuration. The primary configuration and invariants are defined in [`AGENTS.md`](AGENTS.md) and `_agents/rules/`.

## Core Invariants for Claude Code
1. **Holistic Reading**: Always inspect imports and definitions (`_agents/rules/holistic-reading.md`) before modifying files.
2. **Lint & Fix**: Ensure all generated code passes local verification with zero warnings (`_agents/rules/lint-and-fix.md`).
3. **Verification Loop**: Run unit tests after non-trivial edits (`_agents/rules/verification-loop.md`).
4. **Command Safety**: Do not run destructive git or filesystem commands (`_agents/rules/safety-and-scope.md`).

## Sub-Rule Discovery
When working on specific domains, inspect the modular rules located in `_agents/rules/`:
- `_agents/rules/pacing.md`
- `_agents/rules/glob-scoped-rules.md`
- `_agents/rules/subagent-orchestration.md`
