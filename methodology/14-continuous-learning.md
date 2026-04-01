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
    ↓ 建议提炼
Rule (.claude/rules/) — session 级加载，更紧凑
    ↓ 如果可以工具级强制
Hook (脚本) — 零 token，100% 可靠
```

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

## 关闭

- `HARNESS_LOG=off` — 关闭所有记录
- `HARNESS_LEARN=off` — 只关闭 observations.jsonl，session-log.md 仍然记录

不影响其他 Hook（safety-guard 等）。
