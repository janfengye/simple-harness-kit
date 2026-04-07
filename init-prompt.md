# Harness 初始化 Prompt

> 将此文档 + methodology/ 目录一起发给 Claude / Codex，它即可为你的项目生成完整的 Harness 配置。

## 快速开始

告诉 AI：

```
读取 ~/path/to/simple-harness-kit/init-prompt.md 和 methodology/ 目录。
为这个项目初始化 Harness。
```

AI 会自动扫描项目（package.json、技术栈、目录结构），不需要你手动填写项目信息。

如果有特殊情况需要补充，直接说：

```
补充：这个项目没有测试框架，重点约束 src/auth/ 目录。
```

## 生成清单

### 必选（基础设施，所有项目都必须生成，不可跳过）

| 组件 | 文件 | 作用 |
|------|------|------|
| 阶段声明强制 | `scripts/hooks/harness-stage-guard.js` | 强制新 session 声明 Harness 阶段，PLAN 阶段禁止写操作 |
| Session 初始化 | `scripts/hooks/harness-session-start.js` | 新 session 重置阶段、输出 banner |
| 全过程记录 | `scripts/hooks/session-logger.js` | 自动记录工具调用到 session-log + observations |
| 安全防护 | `scripts/hooks/safety-guard.js` | 拦截 rm -rf、force push 等危险命令 |
| Hooks 配置 | `.claude/settings.json` | 注册所有 Hook 到 Claude Code |
| 项目说明 | `CLAUDE.md` | 项目级指令，指向 rules |
| 约束系统 | `docs/constraints.md` | 初始约束模板 |
| 角色约束 | `.claude/rules/role-constraints.md` | Director/Implementer/Reviewer 职责 |
| QA 标准 | `.claude/rules/qa-standards.md` | 量化验收指标 |
| 反馈流程 | `.claude/rules/feedback-workflow.md` | F1-F5 反馈处理 |
| 入口规则 | `.claude/rules/harness-entry.md` | 新 session banner + 等待指令 |

### 可选（按项目需要选配）

| 组件 | 文件 | 何时需要 | 何时跳过 |
|------|------|---------|---------|
| Agent 派发规范 | `.claude/rules/agent-dispatch.md` | 会派 Agent 做子任务 | 纯文档项目、不用 Agent |
| Agent prompt 合规 | `scripts/hooks/agent-check.js` | 有修复类 Agent 需要引用 Constraint ID | 不用 Agent |
| 验证门控 | `scripts/hooks/verification-gate.js` | 有测试框架，commit 前需要验证 | 无测试框架的早期项目 |
| 交付前复盘 | `scripts/hooks/delivery-review.js` | 有交付物（pdf/pptx/zip 等） | 纯代码项目 |
| Co-Authored-By 检查 | `scripts/hooks/commit-check.js` | 团队需要统计 AI 辅助占比 | 个人项目 |
| 上下文预算监控 | `scripts/hooks/context-monitor.js` | 长 session、复杂任务 | 短任务 |
| 持续学习 | `scripts/hooks/harness-learn.js` | 想从行为数据中发现模式 | 初期不需要 |
| Codex 兼容 | `AGENTS.md` | 同时用 Codex/Cursor | 只用 Claude Code |

## 生成后必须验证（C-INIT-03）

init 完成后，输出以下检查清单：

```
Harness Init 完整性检查
========================
必选组件:
  [OK/MISSING] .claude/settings.json
  [OK/MISSING] .claude/rules/role-constraints.md
  [OK/MISSING] .claude/rules/qa-standards.md
  [OK/MISSING] .claude/rules/feedback-workflow.md
  [OK/MISSING] .claude/rules/harness-entry.md
  [OK/MISSING] scripts/hooks/harness-stage-guard.js
  [OK/MISSING] scripts/hooks/harness-session-start.js
  [OK/MISSING] scripts/hooks/session-logger.js
  [OK/MISSING] scripts/hooks/safety-guard.js
  [OK/MISSING] docs/constraints.md
  [OK/MISSING] CLAUDE.md

可选组件（已生成）:
  [列出本次生成的可选组件]

可选组件（已跳过，附理由）:
  [列出跳过的组件和原因]

settings.json Hook 注册数: N 个

下一步:
1. 开一个新 session（当前 session 的 Hook 不会生效）
2. 新 session 中验证 banner 输出
3. 故意触发一次违规操作，验证 Hook 拦截
```

任何必选组件 MISSING 都必须修复后再结束 init。

## Codex 用户注意

Codex 执行 init 时必须使用 `--full-auto` 或 `-s workspace-write` 模式，否则文件可能无法正确写入磁盘：

```bash
codex --full-auto "Read ~/simple-harness-kit/init-prompt.md and methodology/. Initialize Harness for this project."
```

## settings.json 最小配置

settings.json 必须至少包含以下 Hook 注册（必选 4 个）：

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "node scripts/hooks/harness-session-start.js" }] }
    ],
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "node scripts/hooks/harness-stage-guard.js" }] },
      { "matcher": "Edit", "hooks": [{ "type": "command", "command": "node scripts/hooks/harness-stage-guard.js" }] },
      { "matcher": "Write", "hooks": [{ "type": "command", "command": "node scripts/hooks/harness-stage-guard.js" }] },
      { "matcher": "Agent", "hooks": [{ "type": "command", "command": "node scripts/hooks/harness-stage-guard.js" }] },
      { "matcher": "TaskUpdate", "hooks": [{ "type": "command", "command": "node scripts/hooks/harness-stage-guard.js" }] },
      { "matcher": "Read", "hooks": [{ "type": "command", "command": "node scripts/hooks/harness-stage-guard.js" }] },
      { "matcher": "Grep", "hooks": [{ "type": "command", "command": "node scripts/hooks/harness-stage-guard.js" }] },
      { "matcher": "Glob", "hooks": [{ "type": "command", "command": "node scripts/hooks/harness-stage-guard.js" }] },
      { "matcher": "WebFetch", "hooks": [{ "type": "command", "command": "node scripts/hooks/harness-stage-guard.js" }] },
      { "matcher": "WebSearch", "hooks": [{ "type": "command", "command": "node scripts/hooks/harness-stage-guard.js" }] },
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "node scripts/hooks/safety-guard.js" }] }
    ],
    "PostToolUse": [
      { "matcher": "Agent", "hooks": [{ "type": "command", "command": "node scripts/hooks/session-logger.js" }] },
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "node scripts/hooks/session-logger.js" }] },
      { "matcher": "Edit", "hooks": [{ "type": "command", "command": "node scripts/hooks/session-logger.js" }] },
      { "matcher": "Write", "hooks": [{ "type": "command", "command": "node scripts/hooks/session-logger.js" }] }
    ],
    "PostToolUseFailure": [
      { "hooks": [{ "type": "command", "command": "node scripts/hooks/session-logger.js" }] }
    ],
    "StopFailure": [
      { "hooks": [{ "type": "command", "command": "node scripts/hooks/session-logger.js" }] }
    ],
    "TaskCompleted": [
      { "hooks": [{ "type": "command", "command": "node scripts/hooks/harness-stage-guard.js" }] }
    ]
  }
}
```

可选 Hook 在此基础上追加。
