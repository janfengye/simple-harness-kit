# Simple Harness Kit

[中文](#中文) | [English](#english)

---

## 中文

一套可移植、工具无关的 **Harness Engineering** 方法论 + 模板仓库——设计约束、反馈闭环和质量门控，让 AI 编码 Agent 在规模化场景下可靠运行。

### 这是什么

把本仓库的材料连同你的项目背景一起喂给 Claude Code、Codex 或任何 AI 编码 Agent，它会为你生成一套完整的、项目级的开发 Harness：Rules、Hooks、Constraints、QA 流水线和反馈闭环。

**不是另一个框架。** 不需要部署 Python 服务，不需要安装依赖。纯 Markdown + JS Hook——AI 读方法论，帮你生成项目配置。

### 核心理念

1. **Hook 强制 > LLM 自觉** — CLAUDE.md 里的规则靠 LLM "记忆"。Hook 在工具层 100% 拦截，无法绕过、不会遗忘。
2. **独立 Agent > 长对话** — 长对话导致规则漂移。每个任务启动独立 Agent，上下文干净 = 规则始终有效。
3. **5 层 QA 金字塔** — Agent 自验 → 工具检查(build/lint/test) → Spec 合规审查 → 双独立对抗验证(Santa Method) → 人工终审。AI 做前 4 层，人只做第 5 层。
4. **约束可追溯** — 每条规则有唯一 ID，每次修复引用 ID，每次违规有历史记录。
5. **跨工具、跨模型** — 同时提供 CLAUDE.md 和 AGENTS.md，支持跨模型对抗 CR。

### 快速开始

```bash
# 在任何项目目录中，告诉你的 AI Agent：
"读取 ~/path/to/simple-harness-kit/init-prompt.md 和 methodology/ 目录。
 我的项目是 [描述]，技术栈是 [xxx]。
 帮我生成完整的 Harness 配置。"
```

或者安装 Claude Code Skills：
```bash
cp -r skills/* ~/.claude/skills/
# 然后在任何项目中使用 /harness-init
```

### 仓库结构

```
simple-harness-kit/
├── methodology/          # 方法论核心文档
│   ├── 00-philosophy.md         哲学基础
│   ├── 01-comparison.md         对比与定位
│   ├── 02-roles.md              角色定义
│   ├── 03-workflow.md           6 阶段工作流
│   ├── 04-qa-pyramid.md         ★ 5 层 QA 金字塔
│   ├── 05-hook-enforcement.md   ★ Hook 强制执行策略
│   ├── 06-agent-isolation.md    ★ 独立 Agent 执行模式
│   ├── 07-checkpoints.md        Gate 条件清单
│   ├── 08-feedback-loop.md      F1-F5 反馈闭环
│   ├── 09-cross-model-review.md 跨模型对抗 CR
│   └── 10-anti-patterns.md      反模式与 Red Flags
├── templates/            # 生成模板
│   ├── rules/                   规则模板
│   ├── hooks/                   Hook 脚本
│   └── *.tmpl                   配置模板
├── skills/               # 可安装的 Skills
│   ├── harness-init/            一键初始化
│   ├── harness-qa/              5 层 QA 检查
│   ├── harness-santa/           Santa 对抗验证
│   ├── harness-feedback/        反馈闭环
│   └── harness-review/          交付前复盘
├── examples/             # 实战验证案例
└── init-prompt.md        # 初始化 Prompt
```

### 定位与对比

| 对比对象 | 关系 |
|---------|------|
| **ECC (Everything Claude Code)** | 站在 ECC 肩膀上——从 135 个 skill 中提炼子集，串成 6 阶段 Loop，加入约束追溯和反馈闭环 |
| **DeerFlow / LangGraph / CrewAI** | 它们构建 Agent 平台（需要 Python），我们给现有流程加装 Harness（纯文档） |
| **OpenAI Harness Engineering** | 理念同源，我们提供可落地的模板 |
| **Cursor / Windsurf rules** | 它们有项目级规则，我们在之上加入 Hook、QA 金字塔、反馈闭环 |
| **OpenCode** | 优秀的开源 Agent，可在我们的方法论下编排使用 |

### 许可

MIT

---

## English

A portable, tool-agnostic **Harness Engineering** methodology + template repo — designing constraints, feedback loops, and quality gates that make AI coding agents reliable at scale.

### What This Is

Feed this repo's materials to Claude Code, Codex, or any AI coding agent along with your project context. It generates a complete, project-specific development harness: Rules, Hooks, Constraints, QA pipeline, and feedback loops.

**Not another framework.** No Python services to deploy, no dependencies to install. Pure Markdown + JS hooks — the AI reads the methodology and generates your project config.

### Core Ideas

1. **Hook Enforcement > LLM Self-Discipline** — Rules in CLAUDE.md rely on the LLM "remembering." Hooks fire 100% at the tool level — unforgettable, unbypassable.
2. **Fresh Agent Per Task** — Long conversations cause rule drift. Each task gets an independent agent with clean context = rules always loaded.
3. **5-Layer QA Pyramid** — Agent self-verify → Tool checks (build/lint/test) → Spec compliance review → Dual adversarial review (Santa Method) → Human final review. AI handles Layers 1-4; humans only do Layer 5.
4. **Constraint Traceability** — Every rule has a unique ID. Every fix references an ID. Every violation has a history record.
5. **Cross-Tool, Cross-Model** — Ships both CLAUDE.md and AGENTS.md. Supports cross-model adversarial code review (e.g., Codex reviewing Claude's output).

### Quick Start

```bash
# In any project directory, tell your AI agent:
"Read ~/path/to/simple-harness-kit/init-prompt.md and the methodology/ directory.
 My project is [description], tech stack is [xxx].
 Generate my full harness setup."
```

Or install Claude Code Skills:
```bash
cp -r skills/* ~/.claude/skills/
# Then use /harness-init in any project
```

### Repo Structure

```
simple-harness-kit/
├── methodology/          # Core methodology docs
│   ├── 00-philosophy.md         Philosophy
│   ├── 01-comparison.md         Comparison & positioning
│   ├── 02-roles.md              Roles
│   ├── 03-workflow.md           6-Stage workflow
│   ├── 04-qa-pyramid.md         ★ 5-Layer QA Pyramid
│   ├── 05-hook-enforcement.md   ★ Hook enforcement strategy
│   ├── 06-agent-isolation.md    ★ Agent isolation pattern
│   ├── 07-checkpoints.md        Gate conditions
│   ├── 08-feedback-loop.md      F1-F5 feedback loop
│   ├── 09-cross-model-review.md Cross-model adversarial CR
│   └── 10-anti-patterns.md      Anti-patterns & red flags
├── templates/            # Generation templates
│   ├── rules/                   Rule templates
│   ├── hooks/                   Hook scripts
│   └── *.tmpl                   Config templates
├── skills/               # Installable Skills
│   ├── harness-init/            One-click initialization
│   ├── harness-qa/              5-Layer QA check
│   ├── harness-santa/           Santa adversarial review
│   ├── harness-feedback/        Feedback loop
│   └── harness-review/          Delivery review
├── examples/             # Real-world validation
└── init-prompt.md        # Initialization prompt
```

### Positioning

| vs | Relationship |
|----|-------------|
| **ECC (Everything Claude Code)** | We stand on ECC's shoulders — curate best skills into a structured Loop, add Constraint IDs, feedback loops, cross-tool compat |
| **DeerFlow / LangGraph / CrewAI** | They build agent platforms (need Python). We add harness to your existing workflow (pure docs) |
| **OpenAI Harness Engineering** | Same philosophy. We provide actionable templates |
| **Cursor / Windsurf rules** | They have project-level rules. We add Hook enforcement, QA pyramid, feedback loops on top |
| **OpenCode** | Great open-source agent. Can be orchestrated under our methodology |

### License

MIT
