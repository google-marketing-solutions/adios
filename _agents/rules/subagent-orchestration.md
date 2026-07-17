---
title: Multi-Agent & Subagent Orchestration
description: Guidelines for delegating specialized tasks to subagents to preserve context hygiene and improve review/testing depth.
globs: ["AGENTS.md", "_agents/**"]
---

# Multi-Agent & Subagent Orchestration

**Objective**: Maximize execution precision and maintain context hygiene during complex workflows by delegating distinct, specialized responsibilities to dedicated subagents rather than overloading a single primary agent session.

## When to Delegate to a Subagent

Use role-based subagent delegation when:
1. **Broad Codebase Research**: You need to search across thousands of files or internal documentation (`grep_search`, local symbol/AST search) without cluttering the primary agent's active memory with hundreds of intermediate search results.
2. **Adversarial Code Review / Critique**: You want an independent, unbiased analysis of a pull request or code diff (e.g., checking for security vulnerabilities, prompt injection, or missing edge cases without being biased by the author's rationale).
3. **Automated UI / Browser Testing**: You need to launch a browser session, navigate through multi-step user journeys, capture screenshots, and verify visual/interactive state while backend compilation or refactoring continues.
4. **Specialized Domain Execution**: You need to execute an isolated sub-task with a restricted set of tools and permissions (e.g., database schema verification or performance profiling).

## Core Subagent Roles Matrix

| Subagent Role | Primary Responsibility | Recommended Tool Scope | Key Execution Mandate |
| :--- | :--- | :--- | :--- |
| **Research Specialist** (`research-agent` / `code-explorer`) | Survey broad code structures, trace complex call graphs, and summarize project documentation (`README.md`, `DOCS.md`, architecture wikis). | Read-only (`view_file`, `grep_search`, `find_by_name`, symbol/AST search) | Return high-signal, condensed summaries and precise file/line citations; never propose edits directly. |
| **Code Reviewer / Critic** (`7hats-reviewer` / `security-critic`) | Conduct rigorous, adversarial diff inspections covering security, style compliance, and architectural boundaries. | Read-only + Diff analysis (`view_file`, `git diff`) | Output standardized comparative tables (`File | Change | Risk | Proposed Fix`) without conversational fluff. |
| **UI Verification Specialist** (`ui-test` / `browser-agent`) | Execute browser automation, verify responsive layouts, test accessibility, and capture screenshot evidence. | Browser automation (`browser_subagent`), local read/write for logs | Save visual proof (screenshots) to designated artifacts directories (`Screen_#.jpg`) and report console errors. |
| **Guide / Documentation Expert** (`framework-guide` / `docs-agent`) | Answer questions about AI coding framework capabilities, agent settings, custom skills, hooks, and IDE shortcuts. | Documentation lookup (`read_url_content`, local doc search) | Provide accurate, sourced explanations with clickable markdown links. |

## Orchestration Protocol (The Parent-Child Contract)

1. **Explicit Prompting**: When invoking a subagent, pass a **comprehensive, self-contained task prompt**. Since subagents do not inherit your short-term conversational chat history unless specified, include all necessary file paths, constraints, and target definitions in the prompt.
2. **Define Return Expectations**: State exactly what format the subagent should return (e.g., *"Return a markdown table of all callers to `FunctionX()` with line numbers and potential breaking risks"*).
3. **Async Continuation (No Polling)**: After launching a subagent, do not loop or poll for status. Continue independent work or stop calling tools; the messaging runtime will automatically wake up the parent orchestrator when the subagent completes its report.
4. **Synthesize, Don't Dump**: When the subagent returns its findings, synthesize the key insights for the user rather than dumping raw logs.
