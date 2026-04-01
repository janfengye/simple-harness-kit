# Simple Harness Kit

一套可移植、工具无关的 **Harness Engineering** 方法论 + 模板仓库——设计约束、反馈闭环和质量门控，让 AI 编码 Agent 在规模化场景下可靠运行。

## 这是什么

把本仓库的材料连同你的项目背景一起喂给 Claude Code、Codex 或任何 AI 编码 Agent，它会为你生成一套完整的、项目级的开发 Harness：Rules、Hooks、Constraints、QA 流水线和反馈闭环。

**不是另一个框架。** 不需要部署 Python 服务，不需要安装依赖。纯 Markdown + JS Hook——AI 读方法论，帮你生成项目配置。

## 核心理念

1. **Hook 强制 > LLM 自觉** — CLAUDE.md 里的规则靠 LLM "记忆"。Hook 在工具层 100% 拦截，LLM 无法绕过、不会遗忘。
2. **独立 Agent > 长对话** — 长对话导致规则漂移。每个任务启动独立 Agent，上下文干净 = 规则始终有效。
3. **5 层 QA 金字塔** — Agent 自验 → 工具检查(build/lint/test) → Spec 合规审查 → 双独立对抗验证(Santa Method) → 人工终审。AI 做前 4 层，人只做第 5 层。
4. **约束可追溯** — 每条规则有唯一 ID，每次修复引用 ID，每次违规有历史记录。
5. **跨工具、跨模型** — 同时提供 CLAUDE.md 和 AGENTS.md。支持 Claude 审 Claude，也支持 Codex 审 Claude（跨模型对抗 CR）。

## 快速开始

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

## 仓库结构

```
simple-harness-kit/
├── methodology/          # 方法论核心文档（"为什么"和"怎么做"）
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
├── templates/            # 生成模板（项目级配置的原材料）
│   ├── rules/
│   ├── hooks/
│   └── ...
├── skills/               # 可安装的 Claude Code / Codex Skills
├── examples/             # 实战验证案例（附完整证据链）
└── init-prompt.md        # 初始化 Prompt（填写项目信息后喂给 AI）
```

## 定位与对比

| 对比对象 | 关系 |
|---------|------|
| **ECC (Everything Claude Code)** | 站在 ECC 肩膀上——从 135 个 skill 中提炼子集，用 6 阶段 Loop 串成流程，加入约束追溯和反馈闭环 |
| **DeerFlow / LangGraph / CrewAI** | 它们构建 Agent 平台（需要 Python 部署），我们给现有开发流程加装 Harness（纯文档） |
| **OpenAI Harness Engineering** | 理念同源，我们提供可落地的模板和 Skill |
| **Cursor / Windsurf rules** | 它们有项目级规则，我们在规则之上加入 Hook 强制、QA 金字塔、反馈闭环 |
| **OpenCode** | 优秀的开源 Agent，但无 Hook/Skill 机制，可在我们的方法论下被编排使用 |

## 许可

MIT
