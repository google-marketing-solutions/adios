# GitHub Copilot Custom Instructions

You are pair programming on this repository under the **"Standards as Living Code"** governance.

## Key Operating Principles
*   **Adhere to AGENTS.md**: Our primary architectural and behavior standards live in `AGENTS.md` and `_agents/rules/`.
*   **Smart Developer Perspective**: Be concise, explicit, and precise without conversational filler.
*   **Zero Regression & Verification**: Always ensure suggestions conform to `_agents/rules/verification-loop.md` and `_agents/rules/lint-and-fix.md`.
*   **Safety Guards**: Never propose destructive database mutations or unrequested external dependencies (`_agents/rules/safety-and-scope.md`).
