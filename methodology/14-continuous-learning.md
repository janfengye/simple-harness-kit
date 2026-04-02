# 持续学习：从行为中自动提炼模式

## 两种规则积累方式

```
路径 1: 显式反馈（F1-F5）        路径 2: 隐式学习（harness-learn）
  人发现问题 → 手动提炼规则         Hook 自动记录行为 → 按需分析模式
  ↓                                ↓
  Constraint（强约束，立即生效）     Instinct（弱信号，逐步积累）
  ↓                                ↓
  适合: 明确的质量要求              适合: 渐进的习惯发现
```

路径 1 是核心（F1-F5 反馈闭环），路径 2 是内置补充。

## 工作原理

```
日常开发中的工具调用
    ↓ session-logger Hook 自动记录（<50ms，不影响开发）
.harness/observations.jsonl（结构化事件流）
    ↓ 用户触发 /harness-learn（或 AI 自动建议）
纯本地分析（不调 AI，不消耗 token）
    ↓
.harness/instincts/（行为模式）
.harness/learn-report.md（分析报告 + 改进建议）
```

**与 ECC continuous-learning-v2 的核心区别：**
- ECC 每次工具调用启动 3-4 个 Python 子进程 + 后台 Observer Agent 调 Haiku → **重，会卡住开发**
- 我们的 session-logger 是 Node.js 单进程（<50ms），分析是按需触发，不调 AI → **轻，无感知**

## 分析什么

| 维度 | 发现什么 | 价值 |
|------|---------|------|
| 工具序列模式 | "你总是 Grep→Read→Edit" | 确认工作流习惯 |
| 高频工具对 | "Edit 之后总是跟 Bash(test)" | TDD 纪律验证 |
| 高频修改文件 | "src/auth.ts 改了 15 次" | 高风险文件，需要测试覆盖 |
| Token 优化 | "这 3 个 instinct 已稳定" | 提炼为 Rule 省 token |

## Instinct 生命周期

```
observation 积累（自动）
    ↓ /harness-learn 分析
instinct 生成 (置信度 0.3)
    ↓ 多次观察确认
instinct 稳定 (置信度 0.9)
    ↓ --promote 自动晋升
Rule (.claude/rules/learned-*.md) — session 级加载，更紧凑
    ↓ 如果可以工具级强制
Hook (脚本) — 零 token，100% 可靠
```

## 自动晋升（--promote）

置信度 ≥ 0.9 且未晋升的 instinct，通过 `node scripts/hooks/harness-learn.js --promote` 自动生成 Rule 文件：

```bash
node scripts/hooks/harness-learn.js --promote

# 输出:
# 晋升 1 个稳定 instinct 为 Rule:
#   promoted: grep-read-edit (0.92) → .claude/rules/learned-grep-read-edit.md
```

**生成的 Rule 文件格式：**

```markdown
# 工具序列模式: Grep → Read → Edit

> 自动从行为数据晋升（instinct grep-read-edit，置信度 0.92，25 次观察）

此模式在开发过程中稳定出现。遵循此序列可以提高效率。

- **模式:** Grep → Read → Edit
- **晋升时间:** 2026-04-02
```

**晋升后：**
- instinct 标记 `promoted: true`，不再重复晋升
- Rule 文件在新 session 开头自动加载（.claude/rules/ 下所有 .md 文件）
- instinct 的 token 开销（每次推理都在上下文中）转移为 Rule 的一次性加载开销

**Token 节省量估算：**
一个 instinct 在上下文中大约占 50-100 tokens，每次工具调用都会被处理。晋升为 Rule 后只在 session 开头加载一次（约 30 tokens），后续不再消耗。如果一个 session 有 100 次工具调用，单个 instinct 的晋升大约节省 5000-10000 tokens。

## Instinct 粒度（团队场景）

```
用户级 instinct（默认，跟着人走）
    ↓ 同一项目多人出现相同 instinct
    ↓ 自动提议
项目级（团队共识，写入 repo）
    ↓ 多个项目出现
    ↓ 自动提议
组织级（全公司规范）
```

个人习惯不污染项目级。只有多个开发者独立形成相同模式，才值得提升。

## 周期性分析报告

```bash
# 最近 7 天的报告
node scripts/hooks/harness-learn.js --periodic 7 --report

# 最近 30 天
node scripts/hooks/harness-learn.js --periodic 30

# 报告保存到 .harness/reports/YYYY-MM-DD-Nd.md
```

报告内容：
- 本期观察数据量
- Instinct 变化（新增、置信度变化、已晋升）
- 高频工具模式（本期）
- 高频修改文件
- Token 优化机会（可晋升的 instinct）
- 改进建议

适合每周或每月运行一次，观察团队 AI 使用模式的变化趋势。

## 关闭

- `HARNESS_LOG=off` — 关闭所有记录
- `HARNESS_LEARN=off` — 只关闭 observations.jsonl，session-log.md 仍然记录

不影响其他 Hook（safety-guard 等）。
