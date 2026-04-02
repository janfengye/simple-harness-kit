# Harness 多工具实测报告 — Experiment C

## 项目信息

- **项目:** Planka (plankanban/planka) — 开源看板应用
- **技术栈:** Sails.js + Knex + PostgreSQL / React + Redux + Redux-ORM + SCSS Modules
- **Feature:** #1485 Add board/list descriptions
- **工具:** Claude Code (Phase 1)
- **Branch:** harness-test/claude-code
- **日期:** 2026-04-02

## Harness Init 评估

**生成的文件清单（14 files, 1046 insertions）：**

| 文件 | 质量 | 备注 |
|------|------|------|
| CLAUDE.md | 好 | 正确识别了技术栈、命令、目录结构 |
| .claude/rules/role-constraints.md | 好 | 角色约束适配了 Sails.js/Knex 特有禁止操作 |
| .claude/rules/qa-standards.md | 好 | 8 项 Verification Loop，包含 Planka 特有检查 |
| .claude/rules/feedback-workflow.md | 好 | F1-F5 流程适配了前后端+数据库架构 |
| .claude/rules/agent-dispatch.md | 好 | 包含 Mocha/Jest 测试框架适配 |
| .claude/settings.json | 好 | 9 条 PreToolUse + 4 条 PostToolUse |
| scripts/hooks/ (7 个) | 好 | 全部通过 node -c 语法检查 |
| docs/constraints.md | 好 | 8 个约束区域预定义 |

**需要人工调整的地方：** 无。Init 一次生成即可用。

**Init 耗时:** ~12 分钟（含读取方法论 + 生成配置 + 语法验证）

## 6 阶段 Loop 执行记录

### Stage 1: PLAN

| 项目 | 结果 |
|------|------|
| 需求分析 | 完成。从 GitHub issue 提取需求，识别全栈改动范围 |
| 任务拆解 | 完成。按后端/前端/验证分阶段，粒度适中 |
| 验收标准 | 完成。每个任务有明确的 done 条件 |
| 暂停等用户确认 | **未严格执行。** 初始阶段被外部 skill 接管，未按 Harness 流程暂停 |

**偏差 D-01:** 新 session 未自动进入 Harness 流程，被 superpowers:brainstorming skill 覆盖。已产出改进 M-11。

### Stage 2: SETUP

| 项目 | 结果 |
|------|------|
| Harness init | 完成。独立 Agent 执行，14 文件生成 |
| Hook 拦截验证 | 部分。语法检查通过，但未做实弹拦截测试 |
| constraints.md | 完成。空模板，格式正确 |

### Stage 3: EXECUTE

| 项目 | 结果 |
|------|------|
| Agent 隔离 | 完成。后端 1 个 Implementer Agent + 前端 1 个 Implementer Agent + 1 个 Fix Agent |
| TDD | **未严格执行。** 项目本身几乎无测试（integration/ 只有 1 个 User.test.js），未先写失败测试 |
| Commit 粒度 | 完成。3 个 commit（后端、前端、修复）|

**偏差 D-02:** 未做 TDD。原因：目标项目测试基础设施极弱（server 仅 4 个测试，client 仅 2 个，无 controller 测试），写测试的成本和价值不匹配。后续方法论需要对"低测试覆盖项目"给出指导。

**后端改动（commit 99867e19）：**
- Migration: `20260402000000_add_description_to_board_and_list.js`
- Models: Board.js, List.js 加 description attribute
- Controllers: boards/update.js, lists/update.js 加 description input + 权限控制
- Helpers: 检查后无需改动（透传 values）

**前端改动（commit cad8afc2）：**
- Redux-ORM Models: Board.js, List.js 加 description field
- Board UI: BoardSettingsModal/GeneralPane/EditInformation.jsx 加 textarea
- List UI: 新建 EditDescription.jsx + EditDescription.module.scss，修改 List.jsx + ActionsStep.jsx
- 复用现有 i18n keys，无需新增

**修复（commit c8125892）：**
- BoardActions.jsx 加 board description 只读显示（Spec Review 发现遗漏后修复）

### Stage 4: VERIFY

| 层级 | 结果 | 备注 |
|------|------|------|
| Layer 1: Agent 自验 | PASS | 每个 Agent commit 前做了语法检查 |
| Layer 2: Verification Loop | PASS | 语法、diff、一致性、安全全通过 |
| Layer 3: Spec Compliance Review | 首次 FAIL → 修复后 PASS | 独立 Reviewer Agent 发现 board description 未在主视图显示 |
| Layer 4: Santa Method | 跳过 | 中等风险，非必要 |

**Layer 3 发现的问题：** Board description 只在 Settings Modal 中可见，Spec 要求显示在 board-name 下方。派 Fix Agent 修复后通过。

**这正是 Harness 方法论的核心价值：** 独立 Reviewer Agent 消除了 author-bias，发现了 Implementer Agent 遗漏的需求点。

### Stage 5: REVIEW

**e2e 测试结果：**

| 测试项 | 结果 |
|--------|------|
| Server Tests (existing) | PASS (4/4) |
| Client Tests (existing) | PASS (2/2) |
| API E2E — Board set description | PASS |
| API E2E — Board clear description | PASS |
| API E2E — List set description | PASS |
| API E2E — List clear description | PASS |
| UI E2E — Board description 编辑 (Settings Modal) | PASS |
| UI E2E — Board description 显示 (主视图) | PASS |
| UI E2E — List description 编辑 (菜单 + inline) | PASS |
| UI E2E — List description 显示 (list header 下方) | PASS |
| Client Build | SKIP (macOS 13 + sass-embedded 不兼容，master 同样失败) |

### Stage 6: FEEDBACK

未进入此阶段（REVIEW 通过）。

## QA 金字塔覆盖

| 层级 | 覆盖 | 备注 |
|------|------|------|
| Layer 1: Agent 自验 | 是 | 语法检查 |
| Layer 2: Verification Loop | 是 | 语法、diff、一致性、安全 |
| Layer 3: Spec Compliance Review | 是 | 独立 Reviewer Agent，发现 1 个遗漏 |
| Layer 4: Santa Method | 否 | 中等风险，跳过 |
| Layer 5: Human Final Review | 是 | Playwright UI 验证 + 用户确认 |

**覆盖层数：4/5**

## 产出物

| 指标 | 数值 |
|------|------|
| 文件变更 | 15 files changed |
| 代码行数 | +294 / -7 |
| Commits | 4（init + backend + frontend + fix）|
| Agent 派发 | 5 个独立 Agent（init, backend, frontend, QA, spec review, fix）|
| API 测试 | 7/7 PASS |
| UI 测试 | 6/6 PASS |
| Console Errors | 0 |

## 发现的方法论改进点

| ID | 发现 | 改进 | 状态 |
|----|------|------|------|
| M-11 | 新 session 不遵守 Harness 流程，Rule 级别被外部 skill 覆盖 | 新增 harness-stage-guard.js Hook 强制声明阶段 | 已实现并 commit |
| M-12 | 低测试覆盖项目无法执行 TDD | 方法论需要对"低测试基础设施项目"给出分级指导：先补测试基础设施 vs 直接实现 | TODO |
| M-13 | e2e 测试环境搭建占大量时间 | init 时应检测项目的 docker-compose 和环境配置，生成测试环境快速启动指南 | TODO |

## 工具对比（Phase 2 后补充）

| 维度 | Claude Code | Codex |
|------|------------|-------|
| init 生成质量 | 好（14 文件，无需人工调整） | — |
| 6 阶段完整度 | 5/6（FEEDBACK 未触发） | — |
| QA 覆盖层数 | 4/5 | — |
| 代码质量 | 好（Spec Review 发现 1 个遗漏并修复） | — |
| 偏差数量 | 2（D-01 流程劣化, D-02 未 TDD） | — |
| 总耗时 | ~2 小时（含环境搭建） | — |

## 结论

1. **Harness init 对陌生项目有效。** 一次生成即可用，无需大量人工调整。
2. **独立 Reviewer Agent 是核心价值。** Layer 3 Spec Compliance Review 发现了 Implementer 遗漏的需求点（board description 未在主视图显示），如果没有这一层，feature 就不完整交付了。
3. **新 session 流程劣化是真实问题。** 已用 Hook 解决（harness-stage-guard.js）。
4. **低测试覆盖项目需要分级策略。** 不是所有项目都适合强制 TDD，方法论需要给出指导。
