# Harness 初始化 Prompt

> 将此文档 + methodology/ 目录一起发给 Claude / Codex，它即可为你的项目生成完整的 Harness 配置。

## 快速开始

告诉 AI：

```
读取 <kit 绝对路径>/init-prompt.md 和 <kit 绝对路径>/methodology/ 目录 (如 ~/ops/simple-harness-kit 或 D:\\simple-harness-kit, 按你实际 clone 位置填)。
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
| Session 结束收尾 | `scripts/hooks/session-end.js` | SessionEnd 时归档 observations + 写结束标记 |
| Hook 共享依赖 | `scripts/hooks/find-root.js` | 上述 hook 通过 `require('./find-root')` 定位项目根目录（C-HOOK-05）。**AI 漏复制会导致所有 hook 报 MODULE_NOT_FOUND**，必须与 hook 同步复制 |
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
codex --full-auto "Read <KIT_ROOT>/init-prompt.md and <KIT_ROOT>/methodology/. Initialize Harness for this project." # 把 <KIT_ROOT> 替换为你 clone kit 的绝对路径
```

## settings.json 最小配置

settings.json 必须至少包含以下 Hook 注册。**真实源是 `tests/required-wiring.json`** —— 模板/validate.sh/此配置块都从它派生，本节由 `template-integrity.js` 强制对齐，不允许手工漂移：

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
    ],
    "SessionEnd": [
      { "hooks": [{ "type": "command", "command": "node scripts/hooks/session-end.js" }] }
    ]
  }
}
```

## 可选 Hook 与最小集的关系

**`tests/required-wiring.json` 是最小集（19 wirings），上面的 JSON 块严格等于这个最小集**。

**`templates/settings-json.tmpl` 是完整 superset**（最小集 + 下面 7 个可选 wiring），适合"想一次启用全部 optional 的项目"。

可选 wiring 清单：

| Event | Matcher | Script | 何时启用 |
|---|---|---|---|
| `PreToolUse` | `Bash` | `verification-gate.js` | 有测试框架，commit 前需要验证 |
| `PreToolUse` | `Bash` | `delivery-review.js` | 有交付物（pdf/pptx/zip 等） |
| `PreToolUse` | `Bash` | `commit-check.js` | 团队需要统计 AI 辅助占比 |
| `PreToolUse` | `Agent` | `agent-check.js` | 会派 Agent 做子任务，需要 Constraint ID 引用 |
| `PreToolUse` | `Edit` | `context-monitor.js` | 长 session 场景，需要超阈值提醒 compact |
| `PreToolUse` | `Write` | `context-monitor.js` | 同上 |
| `Stop` | (无 matcher) | `delivery-gate.js` | 严格交付守门——阻止在 EXECUTE/VERIFY(无证据)阶段宣称完成 |

**两种 init 策略**：

1. **最小集策略（推荐）**：从 `tests/required-wiring.json` 直接派生最小 settings.json，不含任何 optional wiring。再按上面表格根据项目需要逐项添加。`Stop` 段在最小集中**不存在**——只有添加 `delivery-gate.js` 时才出现。
2. **完整 superset 策略**：从 `templates/settings-json.tmpl` 复制完整版（含全部 optional），然后按"何时启用"列删除不需要的项。`Stop` 段在 template 中**存在**，需要根据是否启用 delivery-gate 决定是否保留。

详见 `skills/harness-init/SKILL.md` 第 3 步的"两种生成策略"对比段。
