# 6 阶段工作流

## 总览

```
┌─────────────────────────────────────────────────────────┐
│              HARNESS ENGINEERING LOOP                    │
│                                                         │
│  ① PLAN ──→ ② SETUP ──→ ③ EXECUTE ──→ ④ VERIFY         │
│                                           │             │
│                                           ↓             │
│                          ⑥ FEEDBACK ←── ⑤ REVIEW        │
│                              │                          │
│                              ↓                          │
│                   不达标 → 规则升级 → 回到 ③              │
│                   达标 → 交付 → 下一轮                    │
└─────────────────────────────────────────────────────────┘
```

## ① PLAN（规划）

**谁：** Director（人）+ AI 辅助
**做什么：**
1. 明确需求和验收标准
2. 任务拆解——每个任务 ≤15 分钟可独立验证
3. 定义每个任务的 done 条件
4. 识别任务间依赖关系

**Gate 条件（满足才进入下一阶段）：**
- [ ] 每个任务有明确的验收标准
- [ ] 任务粒度 ≤15 分钟
- [ ] 每个任务有单一主要风险
- [ ] 依赖关系已标注

**输出物：** 任务清单（带验收标准和依赖关系）

**拆解原则（15 分钟法则）：**
每个任务应该是独立可验证的最小单元：
- "写失败测试" — 一个任务
- "运行验证失败" — 一个任务
- "写最少代码通过" — 一个任务
- "运行验证通过" — 一个任务
- "Commit" — 一个任务

## ② SETUP（搭建）

**谁：** AI Agent（harness-init skill）
**做什么：**
1. 生成项目级 Rules（.claude/rules/）
2. 生成 Hooks（scripts/hooks/ + .claude/settings.json）
3. 生成 Constraints（docs/constraints.md）
4. 验证 Hook 拦截生效

**Gate 条件：**
- [ ] Rules 文件存在且内容正确
- [ ] Hooks 配置在 settings.json 中
- [ ] Hook 拦截测试通过（故意触发一次，验证被拦截）
- [ ] constraints.md 已创建，ID 格式正确

**输出物：** 完整的 .claude/ 配置 + hooks 脚本 + constraints.md

**注意：** 已有 Harness 的项目跳过此阶段。

## ③ EXECUTE（执行）

**谁：** Implementer Agent（独立 Agent 实例）
**做什么：**
1. 按任务清单逐个执行
2. 每个任务启动独立 Agent
3. TDD：先写失败测试 → 最少代码通过 → 重构
4. 引用 Constraint ID
5. 完成后自验

**Gate 条件（每个任务）：**
- [ ] 测试先写且先失败
- [ ] 代码通过测试
- [ ] 无新 warning/error
- [ ] Commit 引用了 Constraint ID（如果是修复类）

**执行模式：**

```
Director 调度
  ├→ Task 1: dispatch Implementer Agent A
  │   → 完成 → 返回结果
  ├→ Task 2: dispatch Implementer Agent B
  │   → 完成 → 返回结果
  └→ ...
```

每个 Agent 独立上下文，不受其他任务污染。

## ④ VERIFY（验证）

**谁：** QA Agent + Reviewer Agent
**做什么：** 按 QA 金字塔逐层检查

```
Layer 1: Agent Self-Verify    → 已在 ③ 中完成
Layer 2: Verification Loop     → Build/Type/Lint/Test/Security/Diff
Layer 3: Spec Compliance Review → 独立 Agent 对照 spec
Layer 4: Santa Method          → 双独立 Reviewer（高风险时）
```

**Gate 条件：**
- [ ] Layer 2 全部 PASS
- [ ] Layer 3 verdict = PASS
- [ ] Layer 4 verdict = NICE（如果启用）

**输出物：** 各层 QA 报告

详见 [04-qa-pyramid.md](./04-qa-pyramid.md)

## ⑤ REVIEW（审查）

**谁：** Director（人）
**做什么：** 交付前 5 项复盘

1. **流程合规**：是否按 6 阶段 Loop 执行？
2. **QA 达标**：各层 QA 报告是否完整？
3. **需求完整**：所有需求是否全部处理？
4. **规则升级**：过程中新问题是否写入 constraints？
5. **改进机会**：哪些步骤下次可以优化？

**Gate 条件：**
- [ ] 5 项复盘全部 ✓

**达标 → 交付**
**不达标 → 进入 ⑥ FEEDBACK**

## ⑥ FEEDBACK（反馈）

**谁：** Director + AI Agent
**做什么：** F1-F5 反馈处理流程

```
F1: 记录原话     → 不解读不简化，原样记录问题
F2: 分类层级     → 规则层 / 工具层 / 配置层 / 页面层
F3: 提炼规则     → 不是"把 X 改成 Y"，而是"所有 X 类必须满足 Y"
F4: 写入文件     → constraints.md（用 ID 编号）
F5: 派 Agent     → 引用 Constraint ID，按规则修复
```

**写完规则后回到 ③ EXECUTE**，进入新的迭代。

详见 [08-feedback-loop.md](./08-feedback-loop.md)

## Inner Loop / Outer Loop

```
Outer Loop（人 / Director）
  PLAN → 审查计划 → ... → REVIEW → 方向修正
  ↕                              ↕
Inner Loop（AI）
  ③ EXECUTE → ④ VERIFY → 不通过 → ⑥ FEEDBACK → ③ EXECUTE
  （可以多次迭代，人不需要介入每次循环）
```

人在 Outer Loop 控制方向和最终质量。
AI 在 Inner Loop 执行和自我修正。
人的介入点是 ① PLAN 和 ⑤ REVIEW。

## 简化模式

不是所有项目都需要完整 6 阶段。按复杂度选择：

| 复杂度 | 使用阶段 | 适用场景 |
|--------|---------|---------|
| 轻量 | ③→④（Layer 1-2 only） | 小改动、bug fix |
| 标准 | ①→②→③→④→⑤ | 新功能、重构 |
| 完整 | 全部 6 阶段 + Layer 4 Santa | 高风险、复杂逻辑、生产部署 |
