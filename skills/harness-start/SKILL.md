---
name: harness-start
description: 启动 Harness 任务（交互式收集需求，自动带上全部流程约束）。Use when starting a new feature, task, or any development work in a Harness-enabled project.
---

# Harness Start

交互式启动一个 Harness 任务，自动注入全部流程约束。

## 执行流程

### Step 1: 询问需求

向用户提问：

```
请描述你要做的任务：
```

等待用户回答。如果用户在 `/harness-start` 后面直接附了内容，用那个内容，不需要再问。

### Step 2: 进入 PLAN 阶段

将 `.harness/current-stage.json` 设为 PLAN，然后按以下约束执行：

**流程约束（全部强制，不可跳过）：**

1. **PLAN 暂停** — 任务拆解完成后，输出任务清单，暂停等用户确认。用户没说"继续/go/确认"之前不进入下一阶段。
2. **VERIFY 量化证据** — 不接受"看起来没问题"。必须有命令输出、测试结果、检查报告等可复现的证据。
3. **真实验证** — 功能性变更必须在真实场景验证，不能只靠 mock 或文件存在性检查。
4. **交付检查清单** — 向用户交付结果之前，逐项回答：
   - 流程合规：按 PLAN → EXECUTE → VERIFY 执行了吗？
   - QA 达标：验证证据充分吗？
   - 真实验证：功能性变更在真实场景跑过了吗？
   - 需求完整：所有需求都处理了吗？
   - 规则升级：过程中新问题写入 constraints 了吗？
5. **Session Log** — 关键决策和偏差必须记录到 .harness/session-log.md。工具调用由 Hook 自动记录，但"为什么这么做"和"偏离了什么"需要主动写。

### Step 3: 开始执行

按 6 阶段 Loop 正常执行：
```
PLAN → EXECUTE → VERIFY → REVIEW
```

如果 REVIEW 不达标，进入 FEEDBACK 循环。
