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

**Step 1: Install Skills (one command)**

```bash
git clone https://github.com/duoglas/simple-harness-kit.git ~/simple-harness-kit
bash ~/simple-harness-kit/install.sh
```

Update: `git -C ~/simple-harness-kit pull && bash ~/simple-harness-kit/install.sh`

**Step 2: Initialize Harness for your project (once per project)**

Enter your project directory, start Claude Code, and paste:

```
Read ~/simple-harness-kit/init-prompt.md and the methodology/ directory.
Initialize Harness for this project.

Project info:
- This is a [language/framework] project
- [Has/doesn't have] test framework
- [Brief description of project purpose]

Required steps:
1. Auto-scan project structure (package.json/directories/existing config) — don't ask me for info
2. Generate ALL mandatory components (marked in init-prompt.md):
   - 4 hook scripts: harness-stage-guard.js, harness-session-start.js, session-logger.js, safety-guard.js
   - 4 rules: role-constraints.md, qa-standards.md, feedback-workflow.md, harness-entry.md
   - settings.json (use minimum config from init-prompt.md, register all mandatory hooks)
   - docs/constraints.md, CLAUDE.md
3. Select optional components based on project needs (must explain why for any skipped)
4. Copy all hook scripts from ~/simple-harness-kit/scripts/hooks/ — do NOT write from scratch
5. Output completeness checklist (OK/MISSING for each mandatory component)
6. Fix any MISSING items immediately
7. Remind me: hooks take effect in the NEXT session, I need to start a new one
```

Or run `/harness-init` (requires Step 1 first).

> **Important:** You must start a new session after init. Hooks don't take effect in the current session.

**Step 3: Daily usage**

After starting a new session, Harness takes over automatically. Just describe your feature:

```
Follow Harness 6-Stage Loop.

Requirements:
1. Pause after PLAN for my confirmation before proceeding
2. VERIFY must have quantitative evidence (test output/check results), not "looks good"
3. Functional changes must be validated in real scenarios, not just mocks
4. Answer delivery checklist before presenting results (process compliance/QA/real verification/completeness/rule updates)

Feature: [your feature description]
```

**Handling feedback:**

```
[Harness Feedback] Follow F1-F5:
1. Record verbatim, don't interpret
2. Classify level (rule/tool/config/instance)
3. Extract general rule — "all X must satisfy Y", not ad-hoc fix
4. Write to constraints.md (with C-{area}-{number} ID)
5. Dispatch Agent to fix per rule (reference Constraint ID)

Issue: [describe the issue]
Expected: [describe expected behavior]
```

### Core Mechanisms

- **6-Stage Loop:** Plan → Setup → Execute → Verify → Review → Feedback (loops until quality gates pass)
- **5-Layer QA Pyramid:** TDD self-verify → Tool checks (build/lint/test) → Spec review (independent reviewer) → Santa Method (dual adversarial) → Human review
- **8 Hooks:** safety-guard, harness-stage-guard, agent-check, verification-gate, commit-check, delivery-review, context-monitor, session-logger — fire at 100% reliability regardless of context length
- **Continuous Learning:** Auto-captures tool usage patterns (<50ms, no overhead), analyzes at each REVIEW stage. Pure local analysis, zero API calls. Discovers workflow habits, hot files needing tests, stable patterns to promote to Rules (token savings)

### Real-World Validation

| Experiment | Project | Type | Tests | Loops | Key Finding |
|-----------|---------|------|-------|-------|------------|
| **A** | [json-2-csv](https://github.com/mrodrig/json-2-csv) (459 stars) | TS library | TDD + 6 unit tests | 1 | Independent reviewer caught interaction bug missed by implementer |
| **B** | [Fyrre Magazine](https://github.com/asbhogal/Fyrre-Magazine) | Next.js frontend | 14 Playwright E2E + axe a11y | 3 | Santa Method dual reviewers found 8 deep issues (aria-live, React key, unused components...) |
| **C** | [Planka](https://github.com/plankanban/planka) (11.5k stars) | Full-stack (Sails.js + React) | 7 API E2E + Playwright UI | 1 | Claude Code vs Codex comparison: independent reviewer is the core value; prompt quality determines output |

13 methodology corrections (M1-M13) produced across all experiments, all fed back into this repo.

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

> Details: [examples/experiment-a/](examples/experiment-a/) | [examples/experiment-b/](examples/experiment-b/) | [examples/experiment-c-planka/](examples/experiment-c-planka/)

### Selection Rationale

We surveyed three layers: **agent frameworks** (DeerFlow/LangGraph/CrewAI — build agent platforms, need Python deployment), **coding tools** (Claude Code/Codex/Gemini/Cursor — all support hooks now except Windsurf), and **methodology systems** (ECC Superpowers/Ralphinho/OpenAI Harness Eng. — good skills but no unified loop). We chose **high constraint strength + low setup cost**: hooks guarantee enforcement, pure docs guarantee zero deployment. See [methodology/01-comparison.md](methodology/01-comparison.md) for full analysis.

### Tool Compatibility

> Experiments A/B/C verified on **Claude Code**. Experiment C also verified on **Codex CLI**. Other tools analyzed from docs, not yet tested.

| Tool | Hook Support | Status |
|------|-------------|--------|
| **Claude Code** | Native PreToolUse/PostToolUse | **Verified** (Exp A/B/C) |
| **Codex CLI** | v0.117+ exec mode | **Verified** (Exp C) |
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
├── templates/     5 rule templates + 8 hook scripts + 4 config templates
├── skills/        7 skills (init user-triggered | rest AI-auto)
├── examples/      3 real-world experiments (A + B + C)
├── tests/         6 regression scenarios
└── init-prompt.md initialization prompt
```

### License

MIT

---

Harnessed by [Simple Harness Kit](https://github.com/duoglas/simple-harness-kit)
