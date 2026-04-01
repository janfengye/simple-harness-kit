# Simple Harness Kit

A portable, tool-agnostic methodology + template repo for **Harness Engineering** — the discipline of designing constraints, feedback loops, and quality gates that make AI coding agents reliable at scale.

## What This Is

Feed this repo's materials to Claude Code, Codex, or any AI coding agent along with your project context. It generates a complete, project-specific development harness: Rules, Hooks, Constraints, QA pipeline, and feedback loops.

**Not another framework.** No Python services to deploy, no dependencies to install. Pure Markdown + JS hooks — the AI reads the methodology and generates your project config.

## Core Ideas

1. **Hook Enforcement > LLM Self-Discipline** — Rules in CLAUDE.md rely on the LLM "remembering." Hooks fire 100% of the time at the tool level. Hooks are the only reliable constraint mechanism.
2. **Fresh Agent Per Task** — Long conversations cause rule drift. Each task gets an independent agent with clean context = rules always loaded.
3. **5-Layer QA Pyramid** — Agent self-verify → Tool checks (build/lint/test) → Spec compliance review → Dual adversarial review (Santa Method) → Human final review. AI handles Layers 1-4; humans only do Layer 5.
4. **Constraint Traceability** — Every rule has a unique ID. Every fix references an ID. Every violation has a history record.
5. **Cross-Tool, Cross-Model** — Ships both CLAUDE.md and AGENTS.md. Supports Claude reviewing Claude, or Codex reviewing Claude (cross-model adversarial CR).

## Quick Start

```bash
# In any project directory, tell your AI agent:
"Read ~/path/to/simple-harness-kit/init-prompt.md and the methodology/ directory.
 My project is [description], tech stack is [xxx].
 Generate my full harness setup."
```

Or install the skills for Claude Code:
```bash
cp -r skills/* ~/.claude/skills/
# Then use /harness-init in any project
```

## Repo Structure

```
simple-harness-kit/
├── methodology/          # Core methodology docs (the "why" and "how")
│   ├── 00-philosophy.md
│   ├── 01-comparison.md
│   ├── 02-roles.md
│   ├── 03-workflow.md
│   ├── 04-qa-pyramid.md         ★ 5-Layer QA
│   ├── 05-hook-enforcement.md   ★ Hook strategy
│   ├── 06-agent-isolation.md    ★ Independent agent execution
│   ├── 07-checkpoints.md
│   ├── 08-feedback-loop.md
│   ├── 09-cross-model-review.md
│   └── 10-anti-patterns.md
├── templates/            # Generation templates for project-specific configs
│   ├── rules/
│   ├── hooks/
│   └── ...
├── skills/               # Installable Claude Code / Codex skills
├── examples/             # Real-world validation with evidence
└── init-prompt.md        # Fill-in-the-blanks initialization prompt
```

## Positioning

| vs What | Relationship |
|---------|-------------|
| **ECC (Everything Claude Code)** | We stand on ECC's shoulders — curate its best skills into a structured Loop, add Constraint IDs, F1-F5 feedback, Hook templates, cross-tool compat |
| **DeerFlow / LangGraph / CrewAI** | They build agent platforms (need Python). We add harness to your existing dev workflow (pure docs) |
| **OpenAI Harness Engineering** | Same philosophy. We provide actionable templates, not just the concept |
| **Cursor / Windsurf rules** | They have project-level rules. We add Hook enforcement, QA pyramid, feedback loops on top |
| **OpenCode** | Great open-source agent, but no Hook/Skill system. Can be orchestrated under our methodology |

## License

MIT
