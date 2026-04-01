# Experiment A: json-2-csv — alwaysQuote 功能

## 概述

| 项目 | 详情 |
|------|------|
| 项目 | [mrodrig/json-2-csv](https://github.com/mrodrig/json-2-csv)（TypeScript, 459 stars） |
| 需求 | [#281](https://github.com/mrodrig/json-2-csv/issues/281) — 添加 `alwaysQuote` 选项 |
| 工具 | Claude Code + Claude Opus 4.6 |
| Harness Kit | simple-harness-kit (commit 5772a1a) |
| 结果 | 需求完成，147 测试全过，发现并修复 1 个交互 bug |

## 执行路径

```
SETUP → PLAN(6 tasks) → EXECUTE → VERIFY(Layer 3 FAIL) → FEEDBACK(F1-F5) → EXECUTE-2 → VERIFY-2(PASS) → REVIEW
```

Layer 3 的独立 Reviewer 发现了 `alwaysQuote + fieldTitleMap` 的交互 bug，通过 F1-F5 提炼为规则 C-DATA-01 后修复。**这验证了多层 QA 和 Reviewer 隔离的核心价值。**

## 代码变更

- 6 文件，+78/-16 行
- 新增 5 个测试（141→147 全过）
- 详见 `experiment-a.patch`

## 关键发现

### 验证了方法论的部分

1. **Layer 3 独立 Review 发现了 Implementer 遗漏的 bug** — 多层 QA 有效
2. **F1-F5 反馈闭环正常运转** — bug → 提炼规则 → 写入 constraints → 修复
3. **Constraint ID 体系可追溯** — C-DATA-01 + VH-01 记录完整
4. **Session Log 记录了全过程** — 包括偏差记录

### 暴露的问题（已修复到方法论中）

| 编号 | 问题 | 修复 |
|------|------|------|
| M1 | Agent 隔离写得太绝对，同功能 TDD 步骤不需要隔离 | 更新 06-agent-isolation.md，加隔离决策矩阵 |
| M2 | session-logger.js PostToolUse Hook 可能未触发 | 更新 05-hook-enforcement.md，强调实弹测试 |
| M3 | REVIEW 通过但代码未 commit | 07-checkpoints.md REVIEW Gate 加"代码已提交" |
| M4 | SETUP 没有 Hook 实弹测试 | 07-checkpoints.md SETUP Gate 强化 |
| M5 | 简化模式 PLAN 粒度不够具体 | 03-workflow.md 简化模式加 PLAN 粒度列 |

## 证据文件

```
experiment-a/
├── README.md                 # 本文件
├── session-log.md            # 完整 session 日志
├── last-verification.json    # 最终 QA 验证报告
├── constraints.md            # 生成的约束系统
└── experiment-a.patch        # 代码变更 diff
```
