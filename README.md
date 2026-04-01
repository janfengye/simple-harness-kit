# Simple Harness Kit

**[中文文档](README.zh-CN.md)**

A portable, tool-agnostic **Harness Engineering** methodology + template repo.

> "Don't ask which model is smarter. Ask whose execution system is more reliable."

### The Problem

| Pain Point | Solution |
|-----------|---------|
| Rule drift in long conversations | Hook enforcement (100% tool-level interception) |
| Unstable code quality | 5-Layer QA Pyramid (AI does 4 layers, humans do final review) |
| No knowledge accumulation | Constraint ID tracing + F1-F5 feedback loops |
| Blind to actual behavior | Continuous learning (auto-captures patterns, improvement suggestions) |

### Quick Start

**First time (once per project):**

Tell your AI agent:
```
Read ~/path/to/simple-harness-kit/init-prompt.md and the methodology/ directory.
Initialize Harness for this project.
```

Or install the skill and run `/harness-init`.

**After that — just describe your feature:**
```
Implement drag-and-drop priority reordering with optimistic updates and rollback on failure.
```

The AI automatically follows the 6-Stage Loop: Plan → TDD implementation → QA verification → Review → commit. **No commands needed** — Rules and Hooks drive the process.

### Core Mechanisms

- **6-Stage Loop:** Plan → Setup → Execute → Verify → Review → Feedback (loops until quality gates pass)
- **5-Layer QA Pyramid:** TDD self-verify → Tool checks (build/lint/test) → Spec review (independent reviewer) → Santa Method (dual adversarial) → Human review
- **7 Hooks:** safety-guard, agent-check, verification-gate, commit-check, delivery-review, context-monitor, session-logger — fire at 100% reliability regardless of context length
- **Continuous Learning:** Auto-captures tool usage patterns (<50ms, no overhead), analyzes at each REVIEW stage. Pure local analysis, zero API calls. Discovers workflow habits, hot files needing tests, stable patterns to promote to Rules (token savings)

### Real-World Validation

| Experiment | Project | Type | Tests | Loops | Key Finding |
|-----------|---------|------|-------|-------|------------|
| **A** | [json-2-csv](https://github.com/mrodrig/json-2-csv) (459 stars) | TS library | TDD + 6 unit tests | 1 | Independent reviewer caught interaction bug missed by implementer |
| **B** | [Fyrre Magazine](https://github.com/asbhogal/Fyrre-Magazine) | Next.js frontend | 14 Playwright E2E + axe a11y | 3 | Santa Method dual reviewers found 8 deep issues (aria-live, React key, unused components...) |

10 methodology corrections (M1-M10) produced across both experiments, all fed back into this repo.

**Experiment B — feature delivery:**

| Initial state | Search filtering |
|---------|---------|
| ![Initial](https://github.com/duoglas/simple-harness-kit/releases/download/v0.1.0/demo-1-top.png) | ![Search](https://github.com/duoglas/simple-harness-kit/releases/download/v0.1.0/demo-2-search-secret.png) |

| Category filter | Search + filter combo |
|---------|-------------|
| ![Filter](https://github.com/duoglas/simple-harness-kit/releases/download/v0.1.0/demo-3-sculptures.png) | ![Combo](https://github.com/duoglas/simple-harness-kit/releases/download/v0.1.0/demo-4-combo.png) |

| Empty state | Mobile responsive |
|--------|-----------|
| ![Empty](https://github.com/duoglas/simple-harness-kit/releases/download/v0.1.0/demo-5-empty-state.png) | ![Mobile](https://github.com/duoglas/simple-harness-kit/releases/download/v0.1.0/demo-6-mobile.png) |

> Details: [examples/experiment-a/](examples/experiment-a/) | [examples/experiment-b/](examples/experiment-b/)

### Selection Rationale

We surveyed three layers: **agent frameworks** (DeerFlow/LangGraph/CrewAI — build agent platforms, need Python deployment), **coding tools** (Claude Code/Codex/Gemini/Cursor — all support hooks now except Windsurf), and **methodology systems** (ECC Superpowers/Ralphinho/OpenAI Harness Eng. — good skills but no unified loop). We chose **high constraint strength + low setup cost**: hooks guarantee enforcement, pure docs guarantee zero deployment. See [methodology/01-comparison.md](methodology/01-comparison.md) for full analysis.

### Tool Compatibility

> All experiments verified on **Claude Code**. Other tools analyzed from docs, **not yet tested**.

| Tool | Hook Support | Status |
|------|-------------|--------|
| **Claude Code** | Native PreToolUse/PostToolUse | **Verified** |
| **Codex CLI** | v0.117+ | Untested |
| **Gemini CLI** | v0.26+ BeforeTool/AfterTool | Untested |
| **Cursor** | v1.7+ hooks | Untested |
| **OpenCode** | Plugin API (needs rewrite) | Untested |
| **Windsurf** | Audit only, no block | **Not supported** |

### Environment Variables

| Variable | Value | Effect |
|----------|-------|--------|
| `HARNESS_LOG` | `off` | Disable session-log recording |
| `HARNESS_AUTO` | `full` | Full auto, no PLAN pause |
| `HARNESS_AUTO` | `off` | Pause at every stage |
| `HARNESS_LEARN` | `off` | Disable observations.jsonl |
| `HARNESS_ATTRIBUTION` | `off` | Don't add "Harnessed by" to README |

### Repo Structure

```
simple-harness-kit/
├── methodology/   14 methodology docs
├── templates/     5 rule templates + 7 hook scripts + 4 config templates
├── skills/        7 skills (init user-triggered | rest AI-auto)
├── examples/      2 real-world experiments (A + B)
├── tests/         6 regression scenarios
└── init-prompt.md initialization prompt
```

### License

MIT

---

Harnessed by [Simple Harness Kit](https://github.com/duoglas/simple-harness-kit)
