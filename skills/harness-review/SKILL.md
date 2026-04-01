---
name: harness-review
description: 执行交付前 5 项复盘检查，确保流程合规和质量达标。Use when about to deliver work to users, before final handoff, or when completing a development cycle.
---

# Harness Review

交付前 5 项复盘——确保流程完整、质量达标、规则沉淀。

## 何时使用

- 即将交付工作成果
- 完成一轮开发循环
- 创建 PR 前
- 用户说"复盘"或"交付检查"

## 5 项复盘检查

### 1. 流程合规

- 是否按 6 阶段 Loop 执行？（Plan → Setup → Execute → Verify → Review → Feedback）
- 是否有跳过的阶段？如果有，原因是什么？
- 是否有绕过 Gate 条件的情况？

### 2. QA 达标

- Layer 2 Verification Loop 是否执行？报告是否完整？
- 构建成功？类型检查通过？Lint 通过？测试通过？覆盖率达标？
- Layer 3 Spec Review 是否执行（如果适用）？
- Layer 4 Santa Method 是否执行（如果是高风险）？

### 3. 需求完整

- 逐项对照原始需求：每个需求点是否都有对应的实现？
- 是否有部分完成或推迟的需求？如果有，是否已记录？

### 4. 规则升级

- 开发过程中是否发现新问题？
- 新问题是否已通过 F3-F4 提炼为规则并写入 constraints.md？
- Violation History 是否更新？

### 5. 改进机会

- 哪些步骤耗时最长？有没有自动化的空间？
- 哪些 Agent 派发效果不好？prompt 需要怎么改进？
- Hook 有没有漏拦或误拦的情况？
- QA 流程有没有改进空间？

## 输出格式

```
DELIVERY REVIEW
===============

1. 流程合规:    [✓/✗] {备注}
2. QA 达标:     [✓/✗] {备注}
3. 需求完整:    [✓/✗] {备注}
4. 规则升级:    [✓/✗] {备注}
5. 改进机会:    {列出 1-3 个改进点}

结论: [可以交付 / 需要补充工作]
```

## 与 Hooks 配合

`delivery-review.js` Hook 会在打开交付物时自动触发复盘提醒。本 Skill 提供完整的复盘流程。
