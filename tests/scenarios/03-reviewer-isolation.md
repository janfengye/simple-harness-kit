# 场景 3：Layer 3 角色隔离

## 前置条件
- 项目已初始化 Harness
- 需求有一定复杂度（需要边界处理）

## 指令

```
帮我实现日期范围验证函数：validateDateRange(start, end)
要求：start < end，不接受未来日期，最大跨度 365 天。
```

## 验证清单

- [ ] EXECUTE 阶段的 Implementer 和 VERIFY 阶段的 Spec Reviewer 是不同 Agent
- [ ] Spec Reviewer 的上下文中不包含 Implementer 的实现过程对话
- [ ] Spec Reviewer 输出结构化 PASS/FAIL 报告（逐项对照需求）
- [ ] 如果 Reviewer 发现问题，走 FEEDBACK 流程（不是直接修）

## 回归风险

角色隔离是消除 author-bias 的核心设计。如果 Reviewer 和 Implementer 是同一个 Agent，Layer 3 形同虚设。
