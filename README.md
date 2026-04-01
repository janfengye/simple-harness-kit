# Simple Harness Kit

[中文](#中文) | [English](#english)

---

## 中文

一套可移植、工具无关的 **Harness Engineering** 方法论 + 模板仓库。

> "不要问哪个模型更聪明，要问谁的执行系统更可靠。"

### 解决什么问题

| 痛点 | 症状 | 解法 |
|------|------|------|
| **规则遗忘** | 长对话后 Agent 忽略约束 | Hook 强制执行（工具层 100% 拦截） |
| **质量不稳定** | 有时好有时 bug | 5 层 QA 金字塔（AI 做 4 层，人只做终审） |
| **经验不沉淀** | 同样问题反复出现 | Constraint ID 追溯 + F1-F5 反馈闭环 |

### 核心机制

**6 阶段 Loop：** Plan → Setup → Execute → Verify → Review → Feedback（不达标则循环）

**5 层 QA 金字塔：**
```
  L5: Human Review    人工终审           ← 人只做这层
  L4: Santa Method    双独立对抗验证      ← 两个 AI Reviewer 都通过才放行
  L3: Spec Review     规格合规审查        ← 独立 Reviewer ≠ 实现者
  L2: Verification    工具自动检查        ← Build/Type/Lint/Test/Security
  L1: Self-Verify     Agent 自验          ← TDD 红绿重构
```

**Hook 强制执行：** 7 个内置 Hook，在工具层 100% 拦截——safety-guard | agent-check | verification-gate | commit-check | delivery-review | context-monitor | session-logger

详见 [methodology/](methodology/) 全部 13 篇文档。

---

### 快速开始

在你的项目中启动 AI Agent，输入：

```
读取 ~/path/to/simple-harness-kit/init-prompt.md 和 methodology/ 目录。
这是我的项目，帮我初始化 Harness 并开发以下需求：
[描述你的需求]
```

AI 会自动扫描项目的技术栈、构建方式、测试框架等信息，然后：
1. 生成 Rules / Hooks / Constraints / Settings（② SETUP）
2. 按 6 阶段 Loop 执行你的需求
3. 全过程记录到 `.harness/session-log.md`

或安装 Skills 后用斜杠命令触发：
```bash
cp -r skills/* ~/.claude/skills/
```

然后在任何项目中输入 `/harness-init`，AI 会：
1. **自动扫描**项目的 package.json / pyproject.toml / go.mod 等，识别技术栈和构建方式
2. **问你**缺少的信息（比如风险等级、已知问题）
3. **生成**全套配置：Rules(5) + Hooks(7) + Constraints + Settings
4. **实弹测试**一次 Hook 拦截，确认生效
5. 输出初始化报告，你可以直接开始开发

---

### 使用场景

#### 初始化 Harness + 开发需求（最常见）

```
读取 ~/ops/simple-harness-kit/init-prompt.md 和 methodology/ 目录。
初始化 Harness，然后实现以下需求：

为文章列表页添加搜索和分类筛选功能：
- 搜索框实时过滤文章标题和摘要
- 分类标签点击筛选，支持搜索+筛选组合使用
- 无结果时显示空状态
- 需要 E2E 测试覆盖搜索、筛选、组合场景
```

AI 自动处理：扫描技术栈 → 生成配置 → PLAN 拆解 → TDD 实现 → 多层 QA → 复盘。

#### 日常开发（已有 Harness）

```
按 Harness 流程，帮我实现：
用户可以拖拽调整任务优先级，拖拽结束后自动保存到后端。
要求：乐观更新，失败时回滚并提示。
```

用户只提供**做什么**和**业务约束**，技术实现由 AI 决定。

#### 处理反馈

```
[Harness 反馈]
问题：搜索中文时结果为空，但文章标题包含搜索词
期望：中文搜索正常工作
```

AI 自动执行 F1-F5：记录 → 分类 → 提炼规则 → 写入 constraints → 按规则修复。

#### 给已有项目加装

```
读取 ~/ops/simple-harness-kit/init-prompt.md 和 methodology/ 目录。
这个项目已有代码，帮我加装 Harness。
已知问题：auth 模块没有错误处理，API 响应格式不一致。
```

AI 扫描项目 → 生成配置 → 已知问题写入 constraints → QA 标准按当前状态渐进设置。

#### 补测试（已有项目缺少测试）

**用户不写测试——AI 写，用户验收。**

```
分析 src/auth/ 的代码，为所有公开函数生成单元测试。
不改业务代码，只写测试。发现 bug 记录到 constraints 但不修。
```

AI 读代码 → 生成测试 → 运行 → 报告问题。后续每次开发，TDD 纪律自动维持覆盖率只增不减。

---

### 实战验证

用两个真实开源项目验证，覆盖不同复杂度、测试方法和 Loop 深度。

#### Experiment A: json-2-csv — 库函数级

| 维度 | 数据 |
|------|------|
| **项目** | [mrodrig/json-2-csv](https://github.com/mrodrig/json-2-csv)（TypeScript，459 stars） |
| **需求** | [#281](https://github.com/mrodrig/json-2-csv/issues/281) 添加 `alwaysQuote` 配置项 |
| **代码量** | 6 文件，+78/-16 行 |
| **复杂度** | 低——单选项 + 核心函数修改 + 边界处理 |
| **测试** | TDD + Mocha 单元测试，141→147（新增 6） |
| **Loop** | 1 次迭代（Layer 3 Spec Review 发现交互 bug） |

```
SETUP → PLAN(6) → EXECUTE → VERIFY ─→ L3 FAIL: alwaysQuote+fieldTitleMap 交互 bug
                                        ↓
                              FEEDBACK(提炼规则 C-DATA-01) → EXECUTE-2 → VERIFY(PASS) → REVIEW ✓
```

**关键发现：** 独立 Reviewer 发现了 Implementer 遗漏的交互 bug——单一 Agent 长对话中几乎不可能自己发现。

> 详见 [examples/experiment-a/](examples/experiment-a/)

#### Experiment B: Fyrre Magazine — 前端页面级

| 维度 | 数据 |
|------|------|
| **项目** | [asbhogal/Fyrre-Magazine](https://github.com/asbhogal/Fyrre-Magazine)（Next.js + Tailwind + Playwright） |
| **需求** | 搜索 + 分类筛选 + 修复/新增 E2E + a11y |
| **代码量** | 8 文件，+152/-129 行 |
| **复杂度** | 中——多组件交互 + 响应式 + 无障碍 + E2E |
| **测试** | TDD + Playwright E2E 14 个 + axe a11y |
| **Loop** | 3 次迭代（L3 FAIL → L4 Santa NAUGHTY → L4 NICE） |

```
SETUP → PLAN(13) → EXECUTE(搜索+筛选) → VERIFY ─→ L3 FAIL: 4 个 a11y+交互问题
                                                     ↓
                                           FEEDBACK(修复) → EXECUTE(E2E)
                                                     ↓
                                           VERIFY ─→ L4 Santa NAUGHTY: 双 Reviewer 发现 8 个问题
                                                     ↓
                                           FEEDBACK(Fix Cycle) → VERIFY(L4 NICE) → REVIEW ✓
```

**Santa Method 发现的 8 个深层问题：** aria-live 条件渲染、`<img>` 未用 Next Image、缺少组合 E2E、缺少 `role="group"`、index 作 React key、废弃组件未删、缺 useMemo、无效 HTML 嵌套。常规 Code Review 很难同时发现这些。

> 详见 [examples/experiment-b/](examples/experiment-b/)

#### 对比

| 维度 | Experiment A | Experiment B |
|------|-------------|-------------|
| 类型 | 库函数 | 前端页面 |
| 测试方法 | Mocha 单元测试 | Playwright E2E + axe a11y |
| Loop 迭代 | 1 次 | 3 次 |
| QA 最高层 | Layer 3 | **Layer 4 Santa** |
| 发现问题 | 1 个 | **12 个** |
| 方法论反馈 | M1-M5 | M6-M10 |

两次实验共产出 **10 项方法论修正**，全部已反馈回本仓库。

---

### 选型分析

#### 背景

2026 年，AI 从"回答系统"转向"执行系统"。微软 .NET 团队用 Copilot Agent 10 个月合并 535 个 PR（[来源](https://devblogs.microsoft.com/dotnet/ten-months-with-cca-in-dotnet-runtime/)）。OpenAI 提出 [Harness Engineering](https://openai.com/index/harness-engineering/)——3 人团队日均 3.5 PR 管理百万行仓库。核心问题：**如何让 AI 可控地参与工程协作？**

#### 调研：三个层级

**Agent 编排框架**（DeerFlow / LangGraph / CrewAI / Composio）——解决"构建 Agent 平台"，需要 Python 开发和部署。我们的问题是"用 Agent 做日常开发的质量控制"，层面不同。

**AI 编码工具**（Claude Code / Codex / Gemini CLI / Cursor / OpenCode / Windsurf）——2026 Q1 除 Windsurf 外全部支持 Hook 阻止。我们的 Hook 脚本可跨工具复用。详见 [methodology/01-comparison.md](methodology/01-comparison.md)

**方法论体系**（ECC Superpowers / Ralphinho / OpenAI Harness Eng. / GitHub Squad）——有理念有工具有 Skill，缺少把它们串成可执行流程的方法论。

#### 我们从各框架借鉴了什么

| 来源 | 借鉴维度 | 具体影响 |
|------|---------|---------|
| **ECC Superpowers** | 工作流 + 测试 + Agent 执行 + 上下文管理 | TDD 铁律、两阶段 Review、subagent 隔离、context-monitor |
| **ECC verification-loop** | QA 自动化 | Layer 2 六阶段检查 |
| **ECC santa-method** | 对抗验证 | Layer 4 双独立 Reviewer + 收敛循环 |
| **ECC eval-harness** | 量化度量 | pass@k 指标体系 |
| **ECC continuous-learning-v2** | 行为记录 | session-logger Hook（100% 事件捕获） |
| **ECC safety-guard** | 安全防护 | safety-guard Hook |
| **ECC rules-distill** | 规则治理 | Constraint ID 体系灵感 |
| **Ralphinho RFC-DAG** | 任务编排 + 角色隔离 | 复杂度分 tier、Author ≠ Reviewer |
| **OpenAI Harness Engineering** | 工程实践 | 验证了约束+自动化可规模化 |
| **GitHub Squad** | 设计原则 + 存储 | inspectable/predictable/repository-native、plain text 版本化 |
| **DeerFlow 2.0** | 架构概念 | SuperAgent Harness 概念层对齐 |
| **微软 Agentic Platform** | 渐进路线 | 轻量/标准/完整三级模式 |
| **AGENTS.md 标准** | 跨工具兼容 | CLAUDE.md + AGENTS.md 双格式 |

#### 设计决策

| 决策 | 选择 | 理由 | 放弃 |
|------|------|------|------|
| 约束机制 | Hook 强制 | 100% 可靠 | Rules-only（上下文长了就忘） |
| QA | 5 层金字塔 + 角色隔离 | 纵深防御 | 单层测试 |
| 反馈 | Constraint ID + F1-F5 | 经验沉淀 | ad-hoc 修复 |
| Agent | 按角色隔离 | 消除 author-bias | 单 Agent 全搞定 |
| 载体 | 纯文档 + JS Hook | 零部署 | 框架/服务 |
| 兼容 | CLAUDE.md + AGENTS.md | 不锁厂商 | 单工具绑定 |

---

### 参与改进

每次使用 Harness 时，`.harness/session-log.md` 会自动记录全过程。其中**偏差记录**最有价值——方法论说应该 X，实际做了 Y。

**团队成员提交反馈：** 在 simple-harness-kit 仓库开 Issue，附上 session-log 中的偏差记录：

```markdown
## Session Log 反馈
项目: [名] | 日期: [日期] | 模式: [轻量/标准/完整]

### 偏差
1. 方法论要求: [X] → 实际: [Y] → 原因: [为什么] → 建议: [改什么]

### 不顺畅的地方
1. [描述]

### 附件
- session-log.md
```

我们会定期从 Issue 提取共性问题更新方法论——Experiment A/B 产出的 M1-M10 修正就是这个流程。

---

### 工具兼容性

| 工具 | Hook 兼容 | 说明 |
|------|----------|------|
| **Claude Code** | ✅ 原生 | .claude/settings.json |
| **Codex CLI** | ✅ 适配 | hooks.json，有社区适配器 |
| **Gemini CLI** | ⚠️ 协议兼容 | .gemini/settings.json，事件名需映射 |
| **Cursor** | ✅ 兼容 | 可读 .claude/settings.json |
| **OpenCode** | ❌ 需改写 | TypeScript 插件 API |
| **Windsurf** | ❌ 不支持 | 无 PreToolUse 阻止能力 |

### 仓库结构

```
simple-harness-kit/
├── methodology/   13 篇方法论文档
├── templates/     5 规则模板 + 7 Hook 脚本 + 4 配置模板
├── skills/        5 个 Skills (init/qa/santa/feedback/review)
├── examples/      2 个实战验证 (Experiment A + B)
└── init-prompt.md 初始化 Prompt
```

### 许可

MIT — 零法律摩擦，最大化采纳。方法论项目的价值在于被广泛使用。

---

## English

A portable, tool-agnostic **Harness Engineering** methodology + template repo.

> "Don't ask which model is smarter. Ask whose execution system is more reliable."

### The Problem

| Pain Point | Solution |
|-----------|---------|
| Rule drift in long conversations | Hook enforcement (100% tool-level interception) |
| Unstable code quality | 5-Layer QA Pyramid (AI does 4 layers, humans do final review) |
| No knowledge accumulation | Constraint ID tracing + F1-F5 feedback loops |

### Quick Start

In your project, tell any AI agent:

```
Read ~/path/to/simple-harness-kit/init-prompt.md and the methodology/ directory.
This is my project, initialize Harness and implement:
[describe your feature]
```

The AI scans your tech stack automatically and generates Rules, Hooks, Constraints, then executes your feature through the 6-Stage Loop.

### Core Mechanisms

- **6-Stage Loop:** Plan → Setup → Execute → Verify → Review → Feedback
- **5-Layer QA:** TDD → Tool checks → Spec review (independent) → Santa Method (dual adversarial) → Human review
- **7 Hooks:** safety-guard, agent-check, verification-gate, commit-check, delivery-review, context-monitor, session-logger

### Real-World Validation

| Experiment | Project | Tests | Loops | Key Finding |
|-----------|---------|-------|-------|------------|
| **A** | [json-2-csv](https://github.com/mrodrig/json-2-csv) | 6 unit | 1 | Independent reviewer caught interaction bug |
| **B** | [Fyrre Magazine](https://github.com/asbhogal/Fyrre-Magazine) | 14 E2E + a11y | 3 | Santa dual reviewers found 8 deep issues |

10 methodology corrections produced, all fed back.

### Tool Compatibility

Works on: **Claude Code** (native) | **Codex CLI** (v0.117+) | **Gemini CLI** (v0.26+) | **Cursor** (v1.7+). Not supported: Windsurf.

### License

MIT
