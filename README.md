# Simple Harness Kit

[中文](#中文) | [English](#english)

---

## 中文

一套可移植、工具无关的 **Harness Engineering** 方法论 + 模板仓库。

> "不要问哪个模型更聪明，要问谁的执行系统更可靠。"

### 解决什么问题

AI 编码 Agent 在实际使用中有三个核心痛点：

| 痛点 | 症状 | 我们的解法 |
|------|------|-----------|
| **规则遗忘** | 长对话后 Agent 开始忽略早期设定的约束 | Hook 强制执行（工具层拦截，LLM 无法绕过） |
| **质量不稳定** | 有时候写得好，有时候有 bug，全靠运气 | 5 层 QA 金字塔（AI 做 4 层，人只做最后 1 层） |
| **经验不沉淀** | 同样的问题反复出现，每次从头修 | Constraint ID 追溯 + F1-F5 反馈闭环 |

### 怎么运作

把本仓库的材料喂给 AI Agent（Claude Code / Codex / Gemini CLI / Cursor），它会为你的项目生成一套完整的开发 Harness。**不需要部署服务，不需要安装依赖，纯 Markdown + JS Hook。**

```
你的项目 + simple-harness-kit → AI 读取方法论 → 生成项目级配置
                                                    │
                    ┌───────────────────────────────┘
                    ↓
          .claude/rules/        规则文件（角色约束、QA 标准、反馈流程）
          scripts/hooks/        Hook 脚本（安全防护、Agent 合规、验证门控）
          docs/constraints.md   约束系统（规则 ID、违规记录）
          .claude/settings.json Hook 配置
```

---

### 核心机制

#### 6 阶段 Loop

```
  ① PLAN ──→ ② SETUP ──→ ③ EXECUTE ──→ ④ VERIFY
                                           │
                                           ↓
                          ⑥ FEEDBACK ←── ⑤ REVIEW
                              │
                              ↓
                   不达标 → 规则升级 → 回到 ③
                   达标 → 交付
```

详见 [methodology/03-workflow.md](methodology/03-workflow.md)

#### 5 层 QA 金字塔

```
  ┌──────────────────────────────────┐
  │ L5: Human Review   人工终审       │  ← 人只做这层
  ├──────────────────────────────────┤
  │ L4: Santa Method   双独立对抗验证  │  ← AI: 两个 Reviewer 都通过才放行
  ├──────────────────────────────────┤
  │ L3: Spec Review    规格合规审查    │  ← AI: 独立 Reviewer ≠ 实现者
  ├──────────────────────────────────┤
  │ L2: Verification   工具自动检查    │  ← 自动: Build/Type/Lint/Test/Security
  ├──────────────────────────────────┤
  │ L1: Self-Verify    Agent 自验     │  ← TDD 红绿重构
  └──────────────────────────────────┘
```

详见 [methodology/04-qa-pyramid.md](methodology/04-qa-pyramid.md)

#### Hook 强制执行

```
  可靠性：
  Hook（工具层拦截）     ████████████████████ 100%
  Rules（.claude/rules）  ████████████░░░░░░░░  ~70%
  CLAUDE.md 指令         ██████████░░░░░░░░░░  ~60%
  口头叮嘱               ██████░░░░░░░░░░░░░░  ~40%
```

7 个内置 Hook：

| Hook | 触发 | 作用 |
|------|------|------|
| safety-guard | PreToolUse:Bash | 拦截 rm -rf、force push、DROP TABLE 等 |
| agent-check | PreToolUse:Agent | 修复类 Agent 必须引用 Constraint ID |
| verification-gate | PreToolUse:Bash | commit 前检查 QA 是否完成 |
| commit-check | PreToolUse:Bash | AI commit 必须带 Co-Authored-By |
| delivery-review | PreToolUse:Bash | 交付前触发 5 项复盘 |
| context-monitor | PreToolUse:Edit/Write | 工具调用超阈值提醒 compact |
| session-logger | PostToolUse:* | 自动记录全过程到 session-log |

详见 [methodology/05-hook-enforcement.md](methodology/05-hook-enforcement.md)

---

### 测试策略

5 层 QA 金字塔是框架，具体到项目中需要落地为可执行的测试方案。

#### 我们支持的测试方法

| 测试方法 | 在哪一层 | 怎么用 |
|---------|---------|--------|
| **TDD（测试驱动开发）** | Layer 1 | 铁律：先写失败测试再实现。Agent 自验的基础 |
| **单元测试** | Layer 1-2 | 函数/模块级别，Mocha/Jest/Vitest/pytest |
| **集成测试** | Layer 2 | API 端到端、数据库交互、服务间调用 |
| **E2E 测试** | Layer 2 | Playwright/Cypress，模拟用户操作验证页面行为 |
| **a11y 无障碍测试** | Layer 2 | axe-core/Playwright a11y，WCAG 合规检查 |
| **安全扫描** | Layer 2 | grep 秘钥扫描 + npm audit + 自定义规则 |
| **Spec Compliance Review** | Layer 3 | 独立 AI Reviewer 对照需求规格逐项检查 |
| **Santa Method 对抗验证** | Layer 4 | 双独立 AI Reviewer，相同 rubric，都通过才放行 |
| **跨模型 CR** | Layer 4 扩展 | Codex adversarial-review 审查 Claude 产出 |

#### 已有项目缺少测试怎么办

很多项目没有单测或自动化测试覆盖。**用户不需要自己写测试——AI 写，用户验收。** Harness Kit 的策略是让 AI 渐进式补充测试，用户只需要告诉 AI 做什么。

**阶段 1：一句话让 AI 搭建测试基础设施**

```bash
claude

> 按照 Harness 方法论，分析当前项目：
> - 项目用了什么框架？适合什么测试工具？
> - 搭建测试基础设施（安装依赖、配置文件、示例测试）
> - 不改任何业务代码，只搭测试环境
```

AI 会自动判断技术栈并搭建：React → Vitest + Playwright、Python → pytest、Go → go test 等。

**阶段 2：让 AI 为高风险模块补测试**

```bash
> 分析 src/auth/ 目录的代码，为所有公开函数生成单元测试。
> 不修改业务代码，只写测试。
> 如果测试发现 bug，记录到 constraints.md 但不修复（我来决定是否修）。
```

AI 读代码 → 理解行为 → 生成测试 → 运行 → 报告覆盖率和发现的问题。用户看报告决定要不要修。

**阶段 3：日常开发中自然积累**

后续每次开发新功能或修 bug，Harness 的 TDD 纪律会自动覆盖：
- 新功能 → EXECUTE 阶段先写测试再实现
- 修 bug → F1-F5 闭环中 F5 要求"先写复现测试再修复"
- 覆盖率只增不减（verification-gate Hook 可以检查）

```
覆盖率路径：
  0%  →  搭建基础设施（阶段 1）
  │
  20% →  AI 补高风险模块测试（阶段 2）
  │
  40% →  日常开发 TDD 自然积累（阶段 3）
  │
  60%+ → 持续积累，无需专项投入
```

**用户全程做的事：**
1. 告诉 AI "搭建测试环境"
2. 告诉 AI "给这个模块写测试"
3. 看报告，决定是否修发现的 bug
4. 后续正常开发，TDD 纪律自动保持

**用户不需要做的事：**
- 不需要自己写测试用例
- 不需要自己配置测试框架
- 不需要自己算覆盖率

#### 其他框架怎么做测试

| 框架/工具 | 测试策略 | 我们借鉴了什么 |
|---------|---------|-------------|
| **ECC Superpowers** | TDD 铁律 "NO CODE WITHOUT FAILING TEST"，红绿重构循环 | Layer 1 的 TDD 纪律直接来自 Superpowers |
| **ECC verification-loop** | Build→Type→Lint→Test→Security→Diff 六阶段检查 | Layer 2 的 Verification Loop 完整借鉴 |
| **ECC santa-method** | 双独立 Reviewer + 收敛修复循环 + batch sampling | Layer 4 的 Santa Method 完整借鉴 |
| **ECC eval-harness** | pass@k 指标（pass@1, pass@3）+ Capability/Regression Eval | 我们的量化指标体系来源 |
| **Ralphinho RFC-DAG** | 每个 work unit 按复杂度分 tier，不同 tier 不同测试深度 | 我们的简化模式（轻量/标准/完整）参考了 tier 分级思想 |
| **OpenAI Harness Engineering** | 3 人团队日均 3.5 PR，百万行仓库 | 验证了 Hook + 约束 + 自动化 QA 可以规模化 |
| **GitHub Squad** | inspectable, predictable, repository-native | 我们的 session-log 和 constraints 遵循同样原则：plain text，版本化，可审查 |

---

### 使用场景实例

#### 场景 1：新项目初始化

```bash
# 1. 创建项目
mkdir my-app && cd my-app && npm init -y && git init

# 2. 启动 Claude Code
claude

# 3. 初始化 Harness
> 读取 ~/ops/simple-harness-kit/init-prompt.md 和 methodology/ 目录。
> 我的项目信息：
> - 名称: my-app
> - 描述: React + TypeScript 的任务管理应用
> - 技术栈: React 19 + TypeScript + Vite + Vitest + Playwright
> - 构建命令: npm run build
> - 测试命令: npm test
> - 风险等级: 中
> 帮我生成完整的 Harness 配置。
```

AI 会生成：
```
.claude/rules/        ← 5 个规则文件
scripts/hooks/        ← 7 个 Hook 脚本
docs/constraints.md   ← 约束系统（初始模板）
.claude/settings.json ← Hook 配置
CLAUDE.md             ← 项目说明
```

然后故意测一下 Hook：
```
> rm -rf /
[Safety Guard] 禁止删除根目录或 home 目录   ← Hook 拦截成功
```

#### 场景 2：日常开发一个功能

```bash
# 已有 Harness 的项目，开始开发新功能
claude

> 按照 Harness 的 6 阶段 Loop，帮我实现用户登录功能。
> 需求：
> - 邮箱+密码登录表单
> - 输入验证（Zod schema）
> - 提交后调用 /api/auth/login
> - 成功跳转首页，失败显示错误
> - E2E 测试覆盖正常登录和错误场景
```

AI 自动按流程执行：
```
① PLAN: 拆解为 4 个任务（表单组件→API 对接→错误处理→E2E 测试）
③ EXECUTE: TDD 开发，先写失败测试
④ VERIFY: Layer 2 (Build/Lint/Test PASS) → Layer 3 (Spec Review PASS)
⑤ REVIEW: 5 项复盘 ✓
→ commit（自动带 Co-Authored-By）
```

#### 场景 3：处理用户反馈

```bash
# 用户/测试/Review 说"搜索结果不对"
claude

> [Harness 反馈]
> 问题：搜索中文时结果为空，但文章标题确实包含搜索词
> 场景：/magazine 页面的搜索框
> 期望：中文搜索应该正常工作
```

AI 按 F1-F5 执行：
```
F1: 记录原话 → "搜索中文时结果为空"
F2: 分类 → 工具层（src/ 逻辑 bug）
F3: 提炼规则 → "搜索必须支持 Unicode 字符，包括中文、日文、韩文"
F4: 写入 → C-SEARCH-04 到 docs/constraints.md
F5: 派 Agent → "修复 C-SEARCH-04 违规，扫描所有搜索逻辑"
```

#### 场景 4：给已有项目加装 Harness

```bash
# 项目已有 5000 行代码，但只有 10% 测试覆盖
claude

> 读取 ~/ops/simple-harness-kit/init-prompt.md 和 methodology/ 目录。
> 补充信息：
> - 已有测试覆盖率：10%（仅核心模块有单测）
> - 已有 CI/CD：GitHub Actions（build + lint）
> - 需要重点约束的目录：src/api/, src/auth/
> - 已知的质量问题：auth 模块没有错误处理，API 响应格式不一致
>
> 帮我加装 Harness，并把已知的质量问题写入初始 constraints。
```

AI 会：
1. 生成 Harness 配置，但**不要求立即达到 80% 覆盖率**
2. 把已知问题写入 constraints.md（如 `C-API-01: API 响应必须使用统一格式`）
3. QA 标准设为渐进式：当前覆盖率基准 10%，每次 commit 不降低

---

### 选型分析

#### 背景：2026 年的 AI 工程范式转变

AI 从"回答系统"转向"执行系统"。微软 .NET 团队用 GitHub Copilot Agent 10 个月合并 535 个 PR，净贡献 27 万行代码（[来源](https://devblogs.microsoft.com/dotnet/ten-months-with-cca-in-dotnet-runtime/)）。OpenAI 提出 [Harness Engineering](https://openai.com/index/harness-engineering/) 概念——3 人团队日均 3.5 PR 管理百万行仓库。

核心问题不再是"AI 能不能写代码"，而是**"如何让 AI 可控地参与工程协作"**。

#### 我们调研了什么

##### Agent 编排框架（构建 Agent 的基础设施）

| 框架 | Stars | 定位 | 核心能力 | 适合谁 |
|------|-------|------|---------|--------|
| **DeerFlow 2.0** (字节) | 25K+ | SuperAgent Harness | 子 Agent 编排 + Docker 沙箱 + 长期记忆 + Skill | 构建 Agent 产品/平台的团队 |
| **LangGraph** | — | 有状态 DAG 引擎 | 图编排 + checkpoint + 错误恢复，34.5M 月下载 | 需要复杂工作流的 Python 开发者 |
| **CrewAI** | 44K+ | 角色协作框架 | 快速多 Agent 原型，角色定义简单 | 快速 PoC |
| **Open SWE** (LangChain) | — | 企业内部 Coding Agent | 生产 Coding Agent 模式，Stripe/Ramp/Coinbase 在用 | 有 ML 团队的大企业 |
| **Composio** | — | 多 Agent 编排器 | 每个 Agent 独立 worktree/branch/PR + CI 自修 | 需要并行跑多个 Agent 的团队 |

**我们为什么不用它们：** 这些框架解决的是"构建 Agent 平台"的问题——需要 Python 开发、服务部署、框架学习。而我们要解决的是"用 AI Agent 做日常开发"的质量控制问题。两个不同层面。

##### AI 编码工具（直接用来写代码的工具）

| 工具 | Hook 支持 | 阻止能力 | Skill | Agent 隔离 | Harness 适配 |
|------|----------|---------|-------|-----------|-------------|
| **Claude Code** | PreToolUse/PostToolUse | exit 2 阻止 | SKILL.md | Agent tool (独立子 Agent) | **最佳** |
| **Codex CLI** | pre_tool_use/post_tool_use (v0.117+) | exit 2 阻止 | SKILL.md (兼容) | 云端沙箱 | **良好** |
| **Gemini CLI** | BeforeTool/AfterTool (v0.26+) | exit 2 阻止 | 无 | 无原生 | **良好** |
| **Cursor** | hooks (v1.7+) | allow/deny | Marketplace | Background Agent | **良好** |
| **OpenCode** | tool.execute.before/after (插件) | 插件 API | 无 | 无 | 一般 |
| **Windsurf** | 仅 model response | 仅审计 | 无 | Cascade | **不支持** |

**关键发现：** 2026 年 Q1，除 Windsurf 外，所有主流工具都实现了 Hook 阻止能力。我们的 Hook 脚本（Node.js, stdin JSON, exit 2）可以跨工具复用。

##### 方法论/Skill 体系（怎么组织工作流程）

| 方案 | 核心理念 | 我们的关系 |
|------|---------|-----------|
| **ECC Superpowers** (14 skills) | TDD 铁律 + Santa Method + Verification Loop + 两阶段 Review | **继承**：从 135 个 skill 中提炼最佳子集 |
| **ECC agent-harness-construction** | Action Space 设计 + Observation 设计 + 错误恢复 | **参考**：Hook 和 Agent 模板设计 |
| **ECC agentic-engineering** | Eval-first loop + 15 分钟任务粒度 + 模型路由 | **参考**：PLAN 阶段的任务拆解标准 |
| **ECC continuous-learning-v2** | Hook 驱动行为学习（100% 触发率） | **参考**：session-logger Hook 的设计思路 |
| **Ralphinho RFC-DAG** | RFC→依赖DAG→分层并行→merge queue + eviction | **参考**：复杂度分 tier 的思想 |
| **OpenAI Harness Engineering** | 约束 + 反馈 + 规模化 | **理念同源**：我们提供可落地的模板 |
| **GitHub Squad** | inspectable, predictable, repository-native | **原则对齐**：plain text, 版本化, 可审查 |

#### 设计决策

| 决策点 | 我们的选择 | 为什么 | 放弃了什么 |
|--------|-----------|--------|-----------|
| 约束机制 | Hook 强制执行 | 100% 可靠，不依赖 LLM 自觉 | 纯 Rules（靠 LLM 记忆，上下文长了就忘） |
| QA 方案 | 5 层金字塔 + 角色隔离 | 纵深防御，每层拦截不同维度 | 单层检查（只跑测试就完事） |
| 反馈机制 | Constraint ID + F1-F5 闭环 | 规则可追溯，经验会沉淀 | ad-hoc 修复（改完就忘，下次重犯） |
| Agent 隔离 | 按角色隔离（Implementer ≠ Reviewer） | 消除 author-bias | 一个 Agent 全搞定（省 token 但质量差） |
| 载体形式 | 纯文档 + JS Hook | 零部署，AI 读了就能用 | 框架/服务（需要部署维护，学习成本高） |
| 跨工具 | CLAUDE.md + AGENTS.md 双格式 | 不绑定单一厂商 | Claude Code 专属（锁死生态） |

#### 定位图

```
                   约束强度
                     ↑
                     │
  Simple Harness Kit │  企业定制方案
  (Hook 强制+5层 QA   │  (DeerFlow/内部平台)
   +约束追溯+         │
   跨工具兼容)        │
                     │
  ───────────────────┼──────────────── 上手成本
                     │
  Rules-only 方案    │  Agent 编排框架
  (CLAUDE.md/rules   │  (LangGraph/CrewAI
   靠 LLM 自觉)      │   需要 Python 开发)
                     │
```

---

### 实战验证

我们用两个真实开源项目验证了这套方法论，覆盖了不同复杂度、不同测试方法、不同 Loop 迭代深度。

#### Experiment A: json-2-csv — 库函数级

| 维度 | 数据 |
|------|------|
| **项目** | [mrodrig/json-2-csv](https://github.com/mrodrig/json-2-csv)（TypeScript，459 stars） |
| **需求** | [#281](https://github.com/mrodrig/json-2-csv/issues/281) 添加 `alwaysQuote` 配置项 |
| **代码量** | 6 文件，+78/-16 行 |
| **复杂度** | 低——单选项 + 核心函数修改 + 边界处理 |
| **测试方法** | TDD (Layer 1) + Mocha 单元测试 (Layer 2) + AI Spec Review (Layer 3) |
| **测试数据** | 141→147（新增 6 个单测），覆盖正常值/空值/数字/分隔符/组合 |
| **Loop 迭代** | 1 次 — Layer 3 独立 Reviewer 发现 `alwaysQuote + fieldTitleMap` 交互 bug |
| **生成 Constraints** | 3 组 7 条 + VH-01 违规记录 |

```
执行路径：
SETUP → PLAN(6 tasks) → EXECUTE → VERIFY ──→ L3 FAIL!
                                                │ alwaysQuote + fieldTitleMap
                        ┌───────────────────────┘ 交互 bug
                        ↓
              FEEDBACK(F1-F5: 提炼规则 C-DATA-01)
                        ↓
              EXECUTE-2 → VERIFY-2(PASS) → REVIEW ✓
```

**关键验证：** Layer 3 独立 Reviewer 发现了 Implementer 遗漏的交互 bug——`wrapHeaderFields` 在 `generateCsvHeader` 之前执行导致 `fieldTitleMap` 查找失败。这个 bug 在单一 Agent 长对话中几乎不可能被发现，因为 Author 和 Reviewer 是同一个上下文，共享同样的思维盲区。

**方法论反馈 (M1-M5)：** 同功能 TDD 步骤不需要 Agent 隔离、SETUP 需要 Hook 实弹测试、REVIEW 需检查代码已 commit 等 5 项修正。

> 详见 [examples/experiment-a/](examples/experiment-a/)（含完整 session-log、QA 报告、constraints、code diff）

#### Experiment B: Fyrre Magazine — 前端页面级

| 维度 | 数据 |
|------|------|
| **项目** | [asbhogal/Fyrre-Magazine](https://github.com/asbhogal/Fyrre-Magazine)（Next.js 13 + Tailwind + Shadcn + GSAP + Playwright） |
| **需求** | 搜索框 + 分类标签筛选 + 修复 3 个 E2E + 新增 9 个 E2E + a11y |
| **代码量** | 8 文件，+152/-129 行 |
| **复杂度** | 中——多组件交互 + 状态管理 + 响应式 + 无障碍 + E2E |
| **测试方法** | TDD (L1) + Playwright E2E (L2) + axe a11y (L2) + AI Spec Review (L3) + **Santa Method 双 Reviewer** (L4) |
| **测试数据** | 0→14 个 E2E（修复 3 + 新增 9），含搜索/筛选/组合/重置/持久化/a11y 场景 |
| **Loop 迭代** | 3 次 — L3 发现 4 个 a11y 问题 → L4 Santa 双 Reviewer 发现 8 个深层问题 → 修复后 NICE |
| **生成 Constraints** | 3 组 11 条 + VH-01 违规记录 |

```
执行路径：
SETUP → PLAN(13 tasks)
  → EXECUTE(搜索+筛选) → VERIFY ──→ L3 FAIL!
                                      │  4 个 a11y + 交互问题
                                      │  (aria-label 位置错误、
                                      │   All 清除搜索破坏组合、
                                      │   aria-live 缺失、href 缺 /)
                      ┌───────────────┘
                      ↓
            FEEDBACK(修复 4 个问题)
                      ↓
            EXECUTE(E2E 测试) → VERIFY ──→ L4 Santa NAUGHTY!
                                            │  Reviewer A: 8 issues
                                            │  Reviewer B: 6 findings
                                            │
                                            │  共同发现：
                                            │  • aria-live 条件渲染
                                            │  • <img> 未用 Next Image
                                            │  • 缺 search-by-description 测试
                                            │  • 缺 role="group"
                                            │  • index 作 React key
                                            │  • 废弃组件未删
                                            │  • 缺 useMemo
                                            │  • 无效 HTML 嵌套
                            ┌───────────────┘
                            ↓
                  FEEDBACK(Santa Fix: 修复全部 8+6 issues)
                            ↓
                  VERIFY(L4 Round 2) → NICE ✓ → REVIEW ✓
```

**关键验证：** Santa Method 双独立 Reviewer 联合发现 8 个深层问题——这些问题在常规单人 Code Review 中很容易被忽略（aria-live 条件渲染、React key 滥用 index、废弃组件遗留等）。两个 Reviewer 独立工作，消除了"我觉得可以"的主观偏差。

**方法论反馈 (M6-M10)：** AI commit 需要 Co-Authored-By、session-log 需真实时间戳、Santa 每轮必须独立 Reviewer、VH 修复后需更新、前端 PLAN 按组件拆分等 5 项修正。

> 详见 [examples/experiment-b/](examples/experiment-b/)（含完整 session-log、QA 报告、constraints、code diff）

#### 两次实验对比

| 维度 | Experiment A | Experiment B |
|------|-------------|-------------|
| 项目类型 | 库函数 | 前端页面 |
| 代码变更 | +78/-16 | +152/-129 |
| 测试方法 | TDD + Mocha 单元测试 | TDD + Playwright E2E + axe a11y |
| Loop 迭代 | 1 次 | 3 次 |
| QA 最高层级 | Layer 3 (Spec Review) | **Layer 4 (Santa Method)** |
| Layer 3 发现问题 | 1 个 | 4 个 |
| Layer 4 发现问题 | — | **8 个** |
| Constraints 生成 | 3 组 7 条 | 3 组 11 条 |
| 方法论反馈 | M1-M5 (5 项修正) | M6-M10 (5 项修正) |

**两次实验共产出 10 项方法论修正 (M1-M10)**，全部已反馈回本仓库。这本身就是 Harness Engineering 的 Feedback Loop 在 meta 层面的运作——方法论在实践中被验证和改进。

---

### 测试覆盖策略

#### 对不同项目状态的应对

| 项目状态 | 策略 | Layer 2 基准 |
|---------|------|-------------|
| 新项目（0% 覆盖） | TDD 从第一行代码开始，自然达到高覆盖 | ≥80% |
| 已有项目（<30% 覆盖） | 渐进式：新代码 TDD + 修 bug 时补回归测试 | 不低于当前值，逐步提升 |
| 已有项目（30-80% 覆盖） | 标准 TDD + 对高风险模块专项补测试 | 每次 commit 不降低 |
| 已有项目（>80% 覆盖） | 维持 TDD 纪律 + 关注边界和组合场景 | ≥80% |

#### 不同测试类型的选择

| 项目类型 | 建议测试组合 |
|---------|------------|
| CLI 工具/库函数 | 单元测试为主 + 少量集成测试 |
| REST API | 单元测试 + API 集成测试 + 安全扫描 |
| Web 前端 | 组件单测 + E2E (Playwright) + a11y (axe) |
| 全栈应用 | 单元 + 集成 + E2E + a11y + 安全扫描 |
| 数据管线 | 单元 + 数据质量测试 + 幂等性测试 |

---

### 最佳实践

#### 新手上路

1. 先用**轻量模式**（只跑 Layer 1-2 QA）感受流程
2. 用 `init-prompt.md` 生成配置，不需要手动写
3. **故意触发一次 Hook 拦截**（输入 `rm -rf /`），建立信心
4. 读一遍 Experiment A 的 session-log，理解真实操作过程

#### 日常开发

1. **小改动**：轻量模式（Execute→Verify L1-2），不需要完整 6 阶段
2. **新功能**：标准模式，跑完 Layer 1-3
3. **高风险**：完整模式，必须跑 Layer 4 Santa Method
4. 每次 commit 带 `Co-Authored-By` 标注 AI 工具和模型

#### 团队推广

1. 先在一个试点项目上跑通（照着 Experiment A/B 做）
2. 收集 session-log 和量化数据（Layer 3/4 发现了多少 bug）
3. 用数据说服团队，不用说教
4. 逐步推广，允许轻量模式作为入门

---

### 初始化指令：哪些是必要的

实验中我们给 AI 的初始化指令比较长。实际使用中，**核心必要信息**只有以下几项：

| 信息 | 必要性 | 为什么 |
|------|--------|--------|
| 读取 init-prompt.md + methodology/ | **必须** | 方法论是 Harness 的核心 |
| 项目名称 + 一句话描述 | **必须** | AI 需要理解上下文 |
| 技术栈 | **必须** | 决定 Hook 和 QA 的具体命令 |
| 构建/测试/lint 命令 | **必须** | Layer 2 Verification Loop 直接调用 |
| 风险等级 | 建议 | 决定用轻量/标准/完整模式 |
| 已知问题 | 建议 | 写入初始 constraints |
| 每个阶段切换明确标注 | 建议 | 提高 session-log 可读性 |
| "偏差必须记录" | **必须** | 偏差是方法论改进的最有价值输入 |
| 子需求拆解细节 | **不必须** | 可以让 AI 在 PLAN 阶段自己拆 |
| "先执行 SETUP" | **不必须** | 方法论已规定流程顺序 |

**最简初始化指令（只需 5 行）：**

```
读取 ~/path/to/simple-harness-kit/init-prompt.md 和 methodology/ 目录。
项目: [名称], [一句话描述]
技术栈: [语言/框架], 构建: [命令], 测试: [命令], Lint: [命令]
需求: [描述需求]
偏差必须记录到 .harness/session-log.md。
```

### Session Log：为什么需要，怎么用

#### 为什么需要 Session Log

Session Log 不是"走形式的记录"，它有三个实际用途：

1. **证据链** — 证明 Harness 真的在运行，不是只存在于文档里
2. **偏差采集** — 方法论说应该 X 但实际做了 Y 的记录，是改进方法论的直接输入
3. **操作参考** — 新人读 session-log 能看到真实的操作过程（不是理想化的流程图）

#### 自动 vs 手动

| 记录内容 | 谁记 | 可靠性 |
|---------|------|--------|
| 工具操作（Agent 派发、Bash 命令、文件变更） | **session-logger.js Hook 自动记录** | 100% |
| 人的指示原话 | AI 在规则引导下主动记录 | ~80% |
| AI 的决策依据 | AI 在规则引导下主动记录 | ~70% |
| 偏差分析 | AI 在规则引导下主动记录 | ~60%——需要 AI "诚实承认偏离" |

这就是为什么 Hook + Rule 双保险：Hook 保证操作层面不丢数据，Rule 引导 AI 记录更高层的"为什么"。

#### 团队如何用 Session Log 改进框架

**个人层面：** 每次实验结束后，review 自己的 session-log，找到偏差和不顺畅的地方。

**团队层面：** 把 session-log 中的偏差记录汇总提交到 simple-harness-kit 仓库的 Issue：

```markdown
## Session Log 反馈

**项目**: [项目名]
**日期**: [日期]
**使用模式**: [轻量/标准/完整]

### 偏差记录（从 session-log 摘录）

1. **方法论要求**: [X]
   **实际执行**: [Y]
   **原因**: [为什么偏离]
   **建议**: [对方法论的修改建议]

2. ...

### 不顺畅的地方

1. [哪个阶段/Hook/Gate 有问题]
2. [什么情况下方法论不适用]

### 附件

- session-log.md（完整日志）
```

我们会定期从 Issue 中提取共性问题，更新 methodology/ 和 templates/——就像 Experiment A/B 产出的 M1-M10 修正一样。

**这是 Harness Engineering 的 Feedback Loop 在组织层面的运作**：

```
个人使用 → session-log 记录偏差
    ↓
提交 Issue（附 session-log）
    ↓
维护者分析共性问题
    ↓
更新 methodology/templates
    ↓
下次使用时自动采用改进后的版本
```

### 工具兼容性

我们的 Hook 脚本（Node.js, stdin JSON, exit 2 = 阻止）可以跨工具复用：

| 工具 | 兼容性 | 说明 |
|------|--------|------|
| **Claude Code** | ✅ 原生支持 | 配置写在 .claude/settings.json |
| **Codex CLI** | ✅ 社区适配 | hooks.json 格式，有适配器复用 Claude 配置 |
| **Gemini CLI** | ⚠️ 协议兼容 | .gemini/settings.json，事件名需映射 (BeforeTool) |
| **Cursor** | ✅ 可读 Claude 配置 | .cursor/hooks.json 或直接读 .claude/settings.json |
| **OpenCode** | ❌ 需改写 | TypeScript 插件 API，不兼容 JSON stdin |
| **Windsurf** | ❌ 不支持 | 无 PreToolUse 级别阻止能力 |

### 快速开始

```bash
# 在任何项目目录中，告诉你的 AI Agent：
"读取 ~/path/to/simple-harness-kit/init-prompt.md 和 methodology/ 目录。
 我的项目是 [描述]，技术栈是 [xxx]。
 帮我生成完整的 Harness 配置。"
```

或安装 Claude Code Skills：
```bash
cp -r skills/* ~/.claude/skills/
# 然后在任何项目中使用 /harness-init
```

### 仓库结构

```
simple-harness-kit/
├── methodology/          # 方法论核心（13 篇）
│   ├── 00-philosophy.md         哲学基础
│   ├── 01-comparison.md         选型分析与工具对比
│   ├── 02-roles.md              角色定义
│   ├── 03-workflow.md           6 阶段 Loop
│   ├── 04-qa-pyramid.md         ★ 5 层 QA 金字塔
│   ├── 05-hook-enforcement.md   ★ Hook 强制执行策略
│   ├── 06-agent-isolation.md    ★ 独立 Agent 执行模式
│   ├── 07-checkpoints.md        Gate 条件清单
│   ├── 08-feedback-loop.md      F1-F5 反馈闭环
│   ├── 09-cross-model-review.md 跨模型对抗 CR
│   ├── 10-anti-patterns.md      反模式与 Red Flags
│   ├── 11-session-log.md        全过程记录机制
│   └── 12-commit-standards.md   AI Co-Authored-By 规范
├── templates/            # 生成模板（16 个文件）
│   ├── rules/                   5 个规则模板
│   ├── hooks/                   7 个 Hook 脚本
│   └── *.tmpl                   4 个配置模板
├── skills/               # 可安装 Skills（5 个）
│   ├── harness-init/            一键初始化
│   ├── harness-qa/              5 层 QA 检查
│   ├── harness-santa/           Santa 对抗验证
│   ├── harness-feedback/        反馈闭环
│   └── harness-review/          交付前复盘
├── examples/             # 实战验证（2 个实验）
│   ├── experiment-a/            json-2-csv（库函数，1 次 Loop）
│   └── experiment-b/            Fyrre Magazine（前端页面，3 次 Loop）
└── init-prompt.md        # 初始化 Prompt
```

### 许可

MIT

---

## English

A portable, tool-agnostic **Harness Engineering** methodology + template repo.

> "Don't ask which model is smarter. Ask whose execution system is more reliable."

### The Problem

AI coding agents have three core pain points: **rule drift** (agents forget constraints in long conversations), **unstable quality** (sometimes good, sometimes buggy), and **no knowledge accumulation** (same issues keep recurring). We solve these with Hook enforcement (100% reliable tool-level interception), a 5-Layer QA Pyramid (AI handles 4 layers, humans only do final review), and Constraint ID tracing with F1-F5 feedback loops.

### How It Works

Feed this repo to any AI agent (Claude Code / Codex / Gemini CLI / Cursor). It generates project-specific Rules, Hooks, Constraints, and QA pipelines. **No services to deploy, no dependencies. Pure Markdown + JS hooks.**

### Core Mechanisms

- **6-Stage Loop:** Plan → Setup → Execute → Verify → Review → Feedback
- **5-Layer QA Pyramid:** TDD self-verify → Tool checks → Spec compliance (independent reviewer) → Santa Method (dual adversarial) → Human review
- **7 Built-in Hooks:** safety-guard, agent-check, verification-gate, commit-check, delivery-review, context-monitor, session-logger

### Real-World Validation

| Experiment | Project | Changes | Tests | Loops | Key Finding |
|-----------|---------|---------|-------|-------|------------|
| **A** | [json-2-csv](https://github.com/mrodrig/json-2-csv) (TS lib) | +78/-16 | 6 unit tests | 1 | Layer 3 reviewer caught interaction bug missed by implementer |
| **B** | [Fyrre Magazine](https://github.com/asbhogal/Fyrre-Magazine) (Next.js) | +152/-129 | 14 E2E + a11y | 3 | Santa Method dual reviewers found 8 deep issues |

Both experiments produced **10 methodology corrections (M1-M10)**, all fed back into this repo.

### Tool Compatibility

Hook scripts (Node.js, stdin JSON, exit 2 = block) work on: **Claude Code** (native) | **Codex CLI** (v0.117+) | **Gemini CLI** (v0.26+) | **Cursor** (v1.7+). Not supported: Windsurf (no block capability).

### Quick Start

```bash
"Read ~/path/to/simple-harness-kit/init-prompt.md and the methodology/ directory.
 My project is [description], tech stack is [xxx].
 Generate my full harness setup."
```

### License

MIT
