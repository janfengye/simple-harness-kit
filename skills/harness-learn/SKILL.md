---
name: harness-learn
description: 分析 session 观察数据，提取行为模式生成 instinct，给出改进建议和 Token 优化提议。Use when user says "分析学习数据"、"看看有什么模式"、"harness learn"。
---

# Harness Learn

从 `.harness/observations.jsonl` 分析行为模式，生成 instinct（原子化行为片段），给出改进和 Token 优化建议。

## 何时使用

- 用户说"看看学到了什么"、"分析一下"、"harness learn"
- 项目积累了一段时间的开发数据后
- 想知道哪些文件是高风险的（高频修改但可能没测试）

## 前置条件

- session-logger Hook 已启用（`HARNESS_LOG` 和 `HARNESS_LEARN` 都不是 `off`）
- `.harness/observations.jsonl` 存在且有数据（建议 20+ 条）

## 执行

```bash
node scripts/hooks/harness-learn.js --report
```

## 分析维度

1. **工具序列模式** — 相同 3 步序列出现 3+ 次（如 Grep→Read→Edit）
2. **高频工具对** — A 之后总是跟 B（如 Edit→Bash）
3. **高频修改文件** — 经常被编辑的文件 = 高风险，可能需要测试覆盖
4. **Token 优化** — 稳定 instinct（置信度 ≥0.9）建议提炼为 Rule

## 输出

- `.harness/instincts/*.json` — 生成的 instinct 文件
- `.harness/learn-report.md` — 分析报告（展示给用户）

## Instinct 生命周期

```
observation 积累
    ↓ harness-learn 分析
instinct (置信度 0.3)
    ↓ 多次观察确认
instinct (置信度 0.9)
    ↓ --promote 建议
Rule (.claude/rules/)  ← 零 token 消耗
    ↓ 如果可强制
Hook (脚本)           ← 100% 可靠
```

## 与 ECC continuous-learning-v2 的区别

| 维度 | ECC | 我们 |
|------|-----|------|
| Hook 开销 | 重（Bash 414行 + Python ×3-4 fork） | 轻（Node.js 单进程，<50ms） |
| 分析方式 | 后台 Agent 调 Haiku（消耗 API） | 纯本地规则匹配（零 API 调用） |
| 触发方式 | 自动后台轮询 | 按需手动（`/harness-learn`） |
| 后台进程 | nohup + PID + flock | 无 |
| Instinct 粒度 | 用户全局 ↔ 项目级 | 用户级（团队多人相同才提议晋升项目级） |
