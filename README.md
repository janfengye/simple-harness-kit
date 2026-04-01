# Simple Harness Kit

A portable, tool-agnostic **Harness Engineering** methodology + template repo — designing constraints, feedback loops, and quality gates that make AI coding agents reliable at scale.

一套可移植、工具无关的 **Harness Engineering** 方法论 + 模板仓库——设计约束、反馈闭环和质量门控，让 AI 编码 Agent 在规模化场景下可靠运行。

---

## What This Is / 这是什么

Feed this repo's materials to Claude Code, Codex, or any AI coding agent along with your project context. It generates a complete, project-specific development harness: Rules, Hooks, Constraints, QA pipeline, and feedback loops.

把本仓库的材料连同你的项目背景一起喂给 Claude Code、Codex 或任何 AI 编码 Agent，它会为你生成一套完整的、项目级的开发 Harness：Rules、Hooks、Constraints、QA 流水线和反馈闭环。

**Not another framework.** No Python services to deploy, no dependencies to install. Pure Markdown + JS hooks — the AI reads the methodology and generates your project config.

**不是另一个框架。** 不需要部署 Python 服务，不需要安装依赖。纯 Markdown + JS Hook——AI 读方法论，帮你生成项目配置。

## Core Ideas / 核心理念

1. **Hook Enforcement > LLM Self-Discipline / Hook 强制 > LLM 自觉** — Rules in CLAUDE.md rely on LLM "remembering." Hooks fire 100% at the tool level — unforgettable, unbypassable. CLAUDE.md 里的规则靠 LLM "记忆"，Hook 在工具层 100% 拦截，无法绕过、不会遗忘。

2. **Fresh Agent Per Task / 独立 Agent > 长对话** — Long conversations cause rule drift. Each task gets an independent agent with clean context = rules always loaded. 长对话导致规则漂移，每个任务启动独立 Agent，上下文干净 = 规则始终有效。

3. **5-Layer QA Pyramid / 5 层 QA 金字塔** — Agent self-verify → Tool checks (build/lint/test) → Spec compliance review → Dual adversarial review (Santa Method) → Human final review. AI handles Layers 1-4; humans only do Layer 5. AI 做前 4 层，人只做第 5 层。

4. **Constraint Traceability / 约束可追溯** — Every rule has a unique ID. Every fix references an ID. Every violation has a history record. 每条规则有唯一 ID，每次修复引用 ID，每次违规有历史记录。

5. **Cross-Tool, Cross-Model / 跨工具、跨模型** — Ships both CLAUDE.md and AGENTS.md. Supports Claude reviewing Claude, or Codex reviewing Claude (cross-model adversarial CR). 同时提供 CLAUDE.md 和 AGENTS.md，支持跨模型对抗 CR。

## Quick Start / 快速开始

```bash
# In any project directory, tell your AI agent:
# 在任何项目目录中，告诉你的 AI Agent：
"Read ~/path/to/simple-harness-kit/init-prompt.md and the methodology/ directory.
 My project is [description], tech stack is [xxx].
 Generate my full harness setup."
```

Or install the Claude Code Skills / 或者安装 Claude Code Skills：
```bash
cp -r skills/* ~/.claude/skills/
# Then use /harness-init in any project
# 然后在任何项目中使用 /harness-init
```

## Repo Structure / 仓库结构

```
simple-harness-kit/
├── methodology/          # Core methodology docs / 方法论核心文档
│   ├── 00-philosophy.md         Philosophy / 哲学基础
│   ├── 01-comparison.md         Comparison & positioning / 对比与定位
│   ├── 02-roles.md              Roles / 角色定义
│   ├── 03-workflow.md           6-Stage workflow / 6 阶段工作流
│   ├── 04-qa-pyramid.md         ★ 5-Layer QA Pyramid / 5 层 QA 金字塔
│   ├── 05-hook-enforcement.md   ★ Hook enforcement / Hook 强制执行策略
│   ├── 06-agent-isolation.md    ★ Agent isolation / 独立 Agent 执行模式
│   ├── 07-checkpoints.md        Gate conditions / Gate 条件清单
│   ├── 08-feedback-loop.md      F1-F5 feedback loop / 反馈闭环
│   ├── 09-cross-model-review.md Cross-model CR / 跨模型对抗 CR
│   └── 10-anti-patterns.md      Anti-patterns & red flags / 反模式
├── templates/            # Generation templates / 生成模板
│   ├── rules/
│   ├── hooks/
│   └── ...
├── skills/               # Installable Skills / 可安装的 Skills
├── examples/             # Real-world validation / 实战验证案例
└── init-prompt.md        # Initialization prompt / 初始化 Prompt
```

## Positioning / 定位与对比

| vs | Relationship / 关系 |
|----|---------------------|
| **ECC (Everything Claude Code)** | We stand on ECC's shoulders — curate its best skills into a structured Loop, add Constraint IDs, F1-F5 feedback, Hook templates, cross-tool compat. 站在 ECC 肩膀上，提炼 + 结构化 + 扩展。 |
| **DeerFlow / LangGraph / CrewAI** | They build agent platforms (need Python). We add harness to your existing dev workflow (pure docs). 它们构建 Agent 平台，我们给现有流程加装 Harness。 |
| **OpenAI Harness Engineering** | Same philosophy. We provide actionable templates. 理念同源，我们提供可落地的模板。 |
| **Cursor / Windsurf rules** | They have project-level rules. We add Hook enforcement, QA pyramid, feedback loops on top. 我们在规则之上加入 Hook、QA、反馈闭环。 |
| **OpenCode** | Great open-source agent, but no Hook/Skill system. Can be orchestrated under our methodology. 优秀的开源 Agent，可在我们的方法论下编排使用。 |

## License / 许可

MIT
