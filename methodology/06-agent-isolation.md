# 独立 Agent 执行模式

## 核心问题

长对话中 Agent 为什么会"忘记规则"？

```
Session 开始：
  [System Prompt: rules + CLAUDE.md]  ← 权重高
  [User: 第一个任务]
  [Agent: 执行]

50 轮对话后：
  [System Prompt: rules + CLAUDE.md]  ← 权重被稀释
  [...几万 tokens 的对话历史...]
  [User: 第 N 个任务]
  [Agent: "这种情况应该例外吧..."]  ← 规则遗忘/合理化违规
```

上下文越长，system prompt 中规则的"有效权重"越低。这不是 bug，是 LLM 注意力机制的固有特性。

## 解决方案：每个任务一个独立 Agent

```
主 Agent（调度者/PM）
  ├── 只做：任务分配、结果验收、决策
  ├── 不做：直接写代码、直接执行 pipeline
  │
  ├→ dispatch Implementer Agent（任务 1）
  │   上下文 = rules + 任务描述 + 相关代码
  │   没有历史对话噪声
  │   rules 在最前面，权重最高
  │   执行完毕 → 返回结果 → Agent 销毁
  │
  ├→ dispatch Spec Reviewer Agent（审查任务 1）
  │   上下文 = rules + spec + 代码变更
  │   独立于 Implementer（消除 author-bias）
  │   只做审查，不做修改
  │
  ├→ dispatch Code Reviewer Agent（代码质量审查）
  │   上下文 = rules + 代码变更
  │   独立于 Implementer 和 Spec Reviewer
  │
  └→ 结果不合格？
      dispatch Fix Agent（带上问题上下文）
      新的独立 Agent，没有历史包袱
```

## 关键设计原则

### 1. Reviewer ≠ Author

写代码的 Agent 不能自己 review。

**为什么：** Author-bias 是代码审查中最大的质量漏洞。作者在审查自己代码时，会不自觉地用"我知道我想做什么"来弥补代码中的歧义和遗漏。

**怎么做：** Spec Compliance Review 和 Code Quality Review 都必须是独立的 Agent 实例。

### 2. 最小上下文原则

每个 Agent 只接收完成任务所必需的上下文：

| Agent 类型 | 接收什么 | 不接收什么 |
|-----------|---------|-----------|
| Implementer | rules + 任务描述 + 相关源码 | 其他任务的对话历史 |
| Spec Reviewer | rules + spec + 代码变更 | 实现过程中的试错记录 |
| Code Reviewer | rules + 代码变更 + 项目规范 | spec（避免被 spec 影响判断） |
| Fix Agent | rules + 问题描述 + 代码 | 之前 Agent 的完整对话 |

### 3. 提供完整文本，不要引用文件

```
❌ 错误做法：
  "Read the plan in docs/plan.md and implement Task 3"
  → Agent 需要额外一轮读取，浪费 token，可能读错

✅ 正确做法：
  直接把 Task 3 的完整文本嵌入 prompt
  → Agent 立即开始工作，上下文清晰
```

### 4. 两阶段 Review 顺序

```
Step 1: Spec Compliance Review
  → 功能对不对？需求满足了吗？
  → 如果功能都不对，做代码质量审查没有意义

Step 2: Code Quality Review（Spec 通过后才执行）
  → 代码质量行不行？安全？性能？可维护？
```

先保证"做对了"，再保证"做好了"。

## Agent 派发模板

### Implementer Agent

```markdown
## Context
你正在实现以下任务。请严格按照描述执行，不要添加额外功能。

## Rules
[粘贴项目 rules]

## Task
[粘贴完整任务描述，包含验收标准]

## Relevant Code
[粘贴相关源码文件内容]

## Constraints
参考 docs/constraints.md 中的以下约束：
[列出相关 Constraint IDs]

## Deliverables
1. 实现代码变更
2. 对应的测试（TDD：先写测试再实现）
3. 运行测试确认全部通过
4. Commit（引用 Constraint ID）
```

### Spec Compliance Reviewer Agent

```markdown
## Context
你是独立的规格审查者。你没有参与实现过程。

## Spec
[粘贴需求规格]

## Code Changes
[粘贴代码变更 diff 或文件内容]

## Instructions
逐项对照 Spec 检查代码变更：
1. 每个需求点是否被实现？
2. 实现是否符合规格描述？
3. 边界条件是否处理？
4. 是否有遗漏？

输出格式：
{
  "verdict": "PASS" | "FAIL",
  "checks": [
    {"requirement": "...", "result": "PASS|FAIL", "detail": "..."}
  ],
  "missing": ["..."],
  "concerns": ["..."]
}

严格检查。你的工作是发现问题。
```

### Code Quality Reviewer Agent

```markdown
## Context
你是独立的代码质量审查者。你没有参与实现过程。

## Code Changes
[粘贴代码变更]

## Project Standards
[粘贴项目编码规范]

## Review Focus
1. 逻辑正确性和边界条件
2. 错误处理
3. 安全性（无硬编码密钥、输入验证、注入防护）
4. 性能隐患
5. 可维护性
6. 测试覆盖充分性

输出格式：
{
  "verdict": "APPROVE" | "REQUEST_CHANGES",
  "critical": ["..."],   // 必须修复
  "important": ["..."],  // 应该修复
  "minor": ["..."],      // 建议修复
  "positive": ["..."]    // 做得好的地方
}

关注真正的问题，不纠结代码风格（lint 已经管了）。
```

## 模型选择策略

不同复杂度的任务可以用不同的模型，优化成本：

| 任务类型 | 推荐模型 | 理由 |
|---------|---------|------|
| 机械性实现（单文件、规格清晰） | Haiku / Sonnet | 够用，省钱快速 |
| 集成性实现（多文件、需要判断） | Sonnet / Opus | 需要更好的推理 |
| 架构性设计和 Review | Opus | 需要全局视角 |
| Spec Compliance Review | Sonnet | 对照检查不需要最强推理 |
| Code Quality Review | Opus | 需要发现深层问题 |

## Agent 状态处理

Implementer 可能返回以下状态：

| 状态 | 含义 | 处理 |
|------|------|------|
| DONE | 完成 | 进入 Review |
| DONE_WITH_CONCERNS | 完成但有顾虑 | 先评估顾虑再 Review |
| NEEDS_CONTEXT | 缺少信息 | 提供信息后重新派发 |
| BLOCKED | 无法继续 | 评估原因——上下文不够？任务太大？计划有误？ |

**永远不要忽略 NEEDS_CONTEXT 和 BLOCKED。** 强行让同一个 Agent 重试不会解决问题。

## 与 Hook 的配合

Agent 隔离解决"遗忘规则"，Hook 解决"违反规则"。两者互补：

```
Agent Isolation                     Hook Enforcement
  每个 Agent 有干净的 rules context     即使 Agent 想违规也会被拦截
  ↓                                   ↓
  Agent 知道规则                       Agent 被迫遵守规则
  ↓                                   ↓
  减少违规意图                          拦截漏网违规
```
