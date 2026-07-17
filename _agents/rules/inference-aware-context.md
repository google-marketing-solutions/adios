---
title: Inference-Aware Context Ordering & Prefix Prompt Caching
description: Maximize GPU KV-cache hits, reduce Time-To-First-Token (TTFT), and cut token costs by strictly ordering prompts from most static to most volatile.
globs: ["AGENTS.md", "GEMINI.md", "_agents/**", ".cursor/rules/**"]
---

# Inference-Aware Context Ordering & Prefix Prompt Caching

**Objective**: Structure project instructions and context files to align with the underlying GPU inference engine mechanics (such as vLLM `PagedAttention` Block-Hash Caching, SGLang `RadixAttention`, and Anthropic/OpenAI/Gemini Prompt Caching APIs), saving up to **90% of prefill compute and latency**.

## 1. The Inference Mechanics Behind Context Degradation & Caching

During LLM inference, the **Prefill Phase** is an expensive $O(n^2)$ compute-bound operation where the model calculates Key (`K`) and Value (`V`) attention tensors across all prompt tokens and stores them in GPU VRAM (the **KV Cache**).

To avoid recomputing these tensors across turns, modern inference engines and prompt caching APIs key the cache on the **exact prefix of token IDs via chained hashing** (`hashTokens(parent_hash, token_block)`):

```text
Prompt A: [Static System Rules | Volatile User Query A] ──► Hits Static Prefix KV Blocks
Prompt B: [Static System Rules | Volatile User Query B] ──► Hits Same Static Prefix KV Blocks (Skipped Prefill!)
```

### The Coarse-Granularity Gotcha (Why One Dynamic Byte Destroys Caching)
Because the cache key chains from the first token (`h0`) forward, **if even a single token at the start of your prompt changes, the chained hash diverges permanently from that point onward (`h_0 ≠ h_0'`)**. 
If you place a dynamic variable (like `Current Date: 2026-07-15`, a random UUID, a changing git branch, or a user greeting) at the very top of `AGENTS.md` or your global instruction prompt, every single turn becomes a **100% Cache MISS**. The engine is forced to re-run the entire $O(n^2)$ prefill from scratch every time.

## 2. The Golden Rule of Context Ordering: Static to Dynamic

To guarantee **KV Cache Reuse** across conversational turns and parallel subagent invocations, all instruction files and prompt payloads MUST be ordered from **Most Static (Front)** to **Most Dynamic / Volatile (Back)**:

```text
┌────────────────────────────────────────────────────────────────────────┐ ──► 100% CACHE HIT
│ 1. STATIC CORE (Prefix - Never Changes Across Sessions)                │     (KV Tensors Reused)
│    • AGENTS.md / GEMINI.md (Global Identity & Core Invariants)         │     (Prefill Skipped!)
│    • Static Rule Files (_agents/rules/*.md) & Tool Definitions         │
├────────────────────────────────────────────────────────────────────────┤
│ 2. SEMI-STATIC DOMAIN CONTEXT (Cache Breakpoint)                       │ ──► High Cache Reuse
│    • Scoped SKILL.md guidelines / Few-Shot Code Examples               │     within same domain
├────────────────────────────────────────────────────────────────────────┤
│ 3. VOLATILE / DYNAMIC TAIL (Suffix - Recomputed Every Turn)            │ ──► Uncached (Fresh Input)
│    • Session Handoff (SESSION_HANDOFF.md with timestamps/git branches) │     (Only these tokens
│    • Active Conversation History & Scratchpad Notes                    │      pay prefill compute)
│    • User Request (<USER_REQUEST>)                                     │
└────────────────────────────────────────────────────────────────────────┘
```

## 3. Mandatory Do's and Don'ts for Prompt & Rule Authors

### Do
*   **Keep `AGENTS.md` 100% Static**: Ensure your global configuration contains *only* immutable project rules, tech stack details, and file links.
*   **Isolate Volatile State to the Tail**: Put dynamic progress tracking (`session-handoff.md`, current time, active files, error logs) at the very bottom of the context payload or strictly inside dynamic task-specific messages.
*   **Leverage Parallel Subagent Cache Sharing**: When dispatching 5 parallel subagents (e.g., multi-agent code review), launch them with the exact same static `AGENTS.md` + rule prefix within the sliding TTL window (e.g., 5 minutes). The inference engine will serve all 5 subagents from the exact same physical VRAM slots (`refcount++`) with near-zero latency (`TTFT`).

### Don't
```markdown
<!-- NEVER DO THIS AT THE TOP OF AGENTS.md or GLOBAL INSTRUCTIONS -->
# Project Rules
- Current Date: 2026-07-15          <-- DYNAMIC BYTE! Invalidates 100% of KV cache after midnight!
- Working Branch: feature/login     <-- DYNAMIC BYTE! Invalidates cache every branch switch!
- Active User: @andriyku            <-- DYNAMIC BYTE!
```

Instead, keep `AGENTS.md` completely static, and pass the date/branch/user inside the user's dynamic turn suffix at the very bottom of the chat context.
