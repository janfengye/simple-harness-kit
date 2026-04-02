# 多工具实测设计

## 目标

用同一个 feature，分别用 Claude Code 和 Codex 完成完整的 Harness 流程（init + 6 阶段 Loop），对比执行效果，验证方法论的跨工具适用性。

## 测试项目

- **项目:** Planka (plankanban/planka) — 开源看板，React + Redux + Sails.js + PostgreSQL
- **Feature:** [#1485 Add board/list descriptions](https://github.com/plankanban/planka/issues/1485)
- **选择理由:** 全栈改动（DB migration + API + UI），复杂度适中，产品易理解

## 分阶段执行

### Phase 1: Claude Code 实测

在独立 branch `harness-test/claude-code` 上执行。

**准备阶段:**
1. Fork Planka 到用户 GitHub 账号
2. Clone 到本地，创建 branch
3. 用 init-prompt.md 对 Planka 做 Harness init（生成 CLAUDE.md、Rules、Hooks 等）

**实测阶段（6 阶段 Loop）:**
1. **Plan** — 读 #1485 issue，分析需求，写实现计划
2. **Setup** — TDD，写测试用例
3. **Execute** — 实现 feature（DB migration + API + UI）
4. **Verify** — 跑测试、lint、build
5. **Review** — 触发 harness-learn，独立审查
6. **Feedback** — 记录偏差，反馈到方法论

### Phase 2: Codex 实测（后续）

安装 Codex 后，在 branch `harness-test/codex` 上对同一 feature 重复上述流程。

## 记录维度

- **流程完整度:** 6 阶段是否都走到
- **Harness 机制生效情况:** Hooks、QA 金字塔、Constraint 是否按预期工作
- **偏差和问题:** init 生成质量、规则冲突、工具限制等
- **代码产出质量:** 文件数、行数、测试覆盖、build/lint 状态

## 对比报告

实测完成后输出报告，放在 `examples/` 下与 Experiment A/B 并列。

```
# Harness 多工具实测报告

## 项目信息
- 项目: Planka (plankanban/planka)
- Feature: #1485 Add board/list descriptions
- 工具: Claude Code (Phase 1) / Codex (Phase 2)

## Harness Init 评估
- 生成的配置文件清单
- 质量评分（Rules 是否贴合项目、Hooks 是否可用）
- 需要人工调整的地方

## 6 阶段 Loop 执行记录
每阶段记录：实际行为、是否符合方法论、偏差

## QA 金字塔覆盖
哪几层跑到了、每层发现了什么

## 产出物
- 代码变更摘要（文件数、行数）
- 测试覆盖
- Build/lint 状态

## 发现的方法论改进点
编号 M-xx，反馈到 methodology/

## 工具对比（Phase 2 后补充）
| 维度 | Claude Code | Codex |
|------|------------|-------|
| init 生成质量 | | |
| 6 阶段完整度 | | |
| QA 覆盖层数 | | |
| 代码质量 | | |
| 偏差数量 | | |
| 总耗时 | | |
```

## 成功标准

1. Harness init 能为 Planka 生成可用的配置（无需大量人工修改）
2. 6 阶段 Loop 完整走完，各阶段行为符合方法论描述
3. QA 金字塔至少覆盖 3 层
4. Feature 实现功能正确，build 通过
5. 产出至少 1 条方法论改进反馈
