# Experiment B: Fyrre Magazine — 搜索筛选 + E2E 测试

## 概述

| 项目 | 详情 |
|------|------|
| 项目 | [asbhogal/Fyrre-Magazine](https://github.com/asbhogal/Fyrre-Magazine)（Next.js 13 + Tailwind + Shadcn + GSAP + Playwright E2E） |
| 需求 | 搜索框 + 分类标签筛选 + 修复 3 个 E2E + 新增 E2E + a11y |
| 工具 | Claude Code + Claude Opus 4.6 |
| Harness Kit | simple-harness-kit（含 Experiment A 的 M1-M5 修正） |
| 结果 | 14 个 E2E 测试全过，3 次 Loop 迭代，Santa Round 1 NAUGHTY → Round 2 NICE |

## 执行路径

```
SETUP → PLAN(13 tasks)
  → EXECUTE(子需求1+2: 搜索+筛选)
  → VERIFY(L3 FAIL: a11y+交互 4 个问题)
  → FEEDBACK(修复)
  → EXECUTE(子需求3: E2E 测试)
  → VERIFY(L2 PASS, L4 NAUGHTY: 双 Reviewer 发现 8 个问题)
  → FEEDBACK(Santa Fix Cycle)
  → VERIFY(L4 NICE)
  → REVIEW
```

## 关键发现

### Layer 4 Santa Method 的价值

双 Reviewer 联合发现了 8 个问题，很多是单一 Review 难以发现的：
1. aria-live 区域条件渲染（屏幕阅读器无法感知）
2. 使用 `<img>` 而非 Next.js `<Image>`
3. 缺少组合场景 E2E 测试
4. 筛选按钮缺少 role="group"
5. React key 使用 index
6. 废弃组件未删除
7. 缺少 useMemo 优化
8. 无效 HTML 嵌套

### 暴露的方法论问题（已修正到 M6-M10）

| 编号 | 问题 | 修正 |
|------|------|------|
| M6 | 代码未 commit（同 Experiment A） | 新增 commit-check.js Hook |
| M7 | 时间戳全是占位符 | session-log 强制要求真实时间 |
| M8 | Santa Round 2 "隐式确认" | qa-pyramid 强调每轮必须独立 Reviewer |
| M9 | VH 记录修复后未更新 | feedback-loop 加 VH 更新要求 |
| M10 | PLAN 拆 13 任务但执行只改 1 文件 | workflow 加前端按文件/组件拆分建议 |

### vs Experiment A 对比

| 维度 | Experiment A | Experiment B |
|------|-------------|-------------|
| 复杂度 | 库函数，单功能 | 前端页面，多组件+E2E+a11y |
| Loop 迭代 | 1 次 | 3 次 |
| Santa | 跳过 | 完整执行，Round 1 NAUGHTY |
| 测试类型 | 单元测试 | E2E + a11y |
| 暴露问题 | 5 个 | 5 个（新的维度） |

## 证据文件

```
experiment-b/
├── README.md                 # 本文件
├── session-log.md            # 完整 session 日志
├── last-verification.json    # 最终 QA 验证报告
├── constraints.md            # 生成的约束系统（11 条）
└── experiment-b.patch        # 代码变更 diff
```
