# AGENTS.md

Compatible with OpenAI Codex, Cursor, and other tools supporting the AGENTS.md standard.

## Project Overview

Simple Harness Kit — a portable Harness Engineering methodology + template repository. Read `methodology/` for the full framework. Read `init-prompt.md` for how to bootstrap a new project.

## Conventions

- Documentation is in Chinese; code examples and technical terms stay in English
- All methodology docs are in `methodology/`, numbered 00-10
- Templates in `templates/` use `.tmpl` suffix
- Skills follow SKILL.md format with YAML frontmatter

## Key Workflow

This repo defines a 6-Stage development loop: Plan → Setup → Execute → Verify → Review → Feedback. Each stage has gate conditions that must be met before proceeding.

## When Working With This Repo

- To understand the methodology: read `methodology/00-philosophy.md` first, then others in order
- To generate a project harness: read `init-prompt.md` and follow instructions
- To install skills: copy `skills/*/` to your skills directory
