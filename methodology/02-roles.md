# 角色定义

## 核心角色

Harness Engineering 中有 4 类角色，前 3 类由 AI Agent 承担，最后 1 类由人承担。

```
人（Outer Loop）
  └→ Director：设定目标、审查计划、最终验收、方向修正

AI（Inner Loop）
  ├→ Implementer：按任务描述和约束实现代码
  ├→ Reviewer：独立审查 Implementer 的产出
  └→ QA Agent：执行自动化检查和对抗验证
```

## Director（人 / PM）

**职责：**
- 定义需求和验收标准
- 审查 Agent 生成的计划
- 做最终交付决策（Layer 5）
- 处理 Agent 无法解决的 escalation
- 维护 constraints.md（规则的 single source of truth）

**可以做：**
- 读取任何文件
- 编辑 constraints.md、rules、docs
- 派发 Agent（通过 Agent tool）
- Git 操作
- 最终验收

**不应该做：**
- 直接写实现代码（应该派 Implementer Agent）
- 直接执行 pipeline 命令（应该派 Agent 执行）
- 跳过 QA 直接交付
- 用主观感觉做 QA（应该用量化指标）

**违规自检表：**

| 正在做 | 应该做 |
|--------|--------|
| 写具体实现代码 | 先写规则到 constraints.md，再派 Agent |
| 跳过 QA 直接给用户看 | 完成完整 QA 流程 |
| 用"看起来不错"做 QA | 用量化指标判断 |
| 在 prompt 中写死实现代码 | 只描述需求，让 Agent 决定实现 |

## Implementer Agent（AI）

**职责：**
- 按任务描述实现代码
- TDD：先写测试再实现
- 自验：运行测试确认通过
- Commit：引用 Constraint ID

**接收：** Rules + 任务描述 + 相关源码 + Constraint IDs
**不接收：** 其他任务的对话历史、review 结果（除非是针对自己的）

**行为准则：**
- 严格按任务描述执行，不添加额外功能（YAGNI）
- 先写失败测试，再写最少代码通过测试
- 每个 Constraint ID 的约束必须遵守
- 遇到不确定的问题，返回 NEEDS_CONTEXT，不要猜

## Reviewer Agent（AI）

分两种，按顺序执行：

### Spec Compliance Reviewer

**职责：** 逐项对照需求规格，检查实现是否完整和正确
**关键：** 独立于 Implementer（不同 Agent 实例，独立上下文）
**输出：** 结构化的 PASS/FAIL 清单

### Code Quality Reviewer

**职责：** 检查代码质量——逻辑、安全、性能、可维护性
**关键：** 在 Spec Compliance 通过之后才执行
**输出：** APPROVE / REQUEST_CHANGES + 分级 issues（critical/important/minor）

**共同准则：**
- 不做修改，只做审查
- 关注真正的问题，不纠结已被 lint 管住的风格
- 输出结构化报告，不输出散文式评价

## QA Agent（AI）

**职责：**
- Layer 2: 执行 Verification Loop（build/type/lint/test/security/diff）
- Layer 4: Santa Method 中的双独立 Reviewer

**特点：**
- 完全自动化，不需要人工干预
- 基于工具输出做判断（确定性 > 概率性）
- 输出量化报告

## 角色隔离的意义

```
Implementer 写代码
     ↓
     ↓ 代码交给另一个 Agent（独立上下文）
     ↓
Spec Reviewer 检查功能
     ↓
     ↓ 通过后交给另一个 Agent
     ↓
Code Reviewer 检查质量
     ↓
     ↓ 通过后
     ↓
QA Agent 做自动化检查
     ↓
     ↓ 全部通过
     ↓
Director（人）做最终审查
```

**为什么不让一个 Agent 全做？**
1. 上下文隔离防止 author-bias
2. 每个 Agent 有专注的职责和判断标准
3. 独立上下文意味着 rules 始终有效
4. 任何一个环节发现问题都能独立拦截
