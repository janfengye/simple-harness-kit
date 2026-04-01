# CLAUDE.md

## Project Overview

Simple Harness Kit — a portable Harness Engineering methodology + template repository. Pure documentation project, no application code.

## What This Repo Is For

This repo contains methodology docs, templates, and skills that AI agents read to generate project-specific development harness configurations (Rules, Hooks, Constraints, QA pipelines).

## File Structure

- `methodology/` — Core methodology documents, numbered 00-10
- `templates/` — Generatable templates (.tmpl files) for rules, hooks, constraints
- `skills/` — Claude Code / Codex installable skills (SKILL.md format)
- `examples/` — Real-world validation experiments with evidence
- `init-prompt.md` — User fills project info, feeds to AI to generate harness

## Writing Conventions

- All docs in Chinese (methodology audience is Chinese-speaking teams)
- Code examples and technical terms keep English original
- Markdown format, no HTML
- File naming: lowercase with hyphens
- No emojis unless in diagrams

## Key Concepts (referenced across docs)

- **6-Stage Loop**: Plan → Setup → Execute → Verify → Review → Feedback
- **5-Layer QA Pyramid**: Self-verify → Tool checks → Spec review → Santa dual review → Human review
- **Hook Enforcement**: PreToolUse/PostToolUse hooks as primary constraint mechanism
- **Agent Isolation**: Fresh subagent per task, no context pollution
- **Constraint ID**: `C-{area}-{number}` format, single source of truth in constraints.md
- **F1-F5 Feedback Loop**: Record → Classify → Extract rule → Write to file → Dispatch agent
