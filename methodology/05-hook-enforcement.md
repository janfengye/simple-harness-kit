# Hook 强制执行策略

## 为什么 Hook 是核心

```
可靠性排名：

Hook（工具级拦截）     ████████████████████ 100%
Rules（.claude/rules/） ████████████░░░░░░░░  ~60-80%
CLAUDE.md 指令         ██████████░░░░░░░░░░  ~50-70%
Prompt 中的口头叮嘱     ██████░░░░░░░░░░░░░░  ~30-50%

                       ← 上下文越长，后三者越不可靠 →
```

Rules 和 CLAUDE.md 的内容在 session 开始时加载到上下文。随着对话变长：
- LLM 的注意力从 system prompt 漂移到最近的对话
- 早期加载的规则权重下降
- Agent 开始"合理化"违规行为（"这种情况应该例外"）

**Hook 不受此影响。** 它在 LLM 调用工具的管道上拦截，与上下文无关。

## Hook 类型

Claude Code 支持两种 Hook 触发点：

| 触发点 | 时机 | 用途 |
|--------|------|------|
| **PreToolUse** | Agent 调用工具之前 | 拦截违规操作、检查前置条件、注入提醒 |
| **PostToolUse** | Agent 调用工具之后 | 验证产出、记录行为、触发后续检查 |

Hook 返回值：
- `exit 0` — 放行
- `exit 2` — 阻止该工具调用
- `stderr` 输出 — 作为提醒/警告显示给 Agent

## 核心 Hook 清单

### 0. Session Logger（全过程记录）

**触发：** PostToolUse:Agent, PostToolUse:Bash, PostToolUse:Edit, PostToolUse:Write
**作用：** 每次工具调用后自动追加日志到 `.harness/session-log.md`

这是整个 Harness 的"黑匣子"。AI 可能忘记手动记录，但 Hook 不会忘。记录内容包括 Agent 派发、命令执行、文件变更。人的指示和偏差分析仍需 AI 在规则引导下主动记录，但工具操作层面有了 100% 的兜底。

> **实战经验（Experiment A）：** session-logger.js 的 PostToolUse Hook 在实验中可能未正确触发（日志全由 AI 主动写入）。**SETUP 阶段必须用实弹测试验证 Hook 生效**——不能只检查文件存在。排查方向：PostToolUse hook 的 stdin 格式是否与 PreToolUse 一致、hook 脚本是否有执行权限。

### 1. Safety Guard（安全防护）

**触发：** PreToolUse:Bash
**作用：** 拦截危险命令

```javascript
// 拦截模式
const BLOCKED = [
  { pattern: /rm\s+-rf\s+[\/~]/, msg: '禁止删除根目录或 home 目录' },
  { pattern: /git\s+push\s+--force/, msg: '禁止 force push，使用 --force-with-lease' },
  { pattern: /git\s+reset\s+--hard/, msg: '禁止 hard reset，请确认后手动执行' },
  { pattern: /--no-verify/, msg: '禁止跳过 git hooks' },
  { pattern: /DROP\s+(TABLE|DATABASE)/i, msg: '禁止直接 DROP，需要人工确认' },
];
```

### 2. Role Guard（角色越权拦截）

**触发：** PreToolUse:Bash
**作用：** PM 角色不直接执行 pipeline 命令

```javascript
// PM 模式下拦截直接执行
const PM_BLOCKED = [
  { pattern: /\b(python3?|node)\s+src\//, msg: 'PM 不直接执行 pipeline，请用 Agent' },
  { pattern: /npm\s+run\s+build/, msg: 'PM 不直接构建，请派 Agent 执行' },
];
```

### 3. Agent Prompt Check（Agent 派发合规）

**触发：** PreToolUse:Agent
**作用：** 修复类 Agent 必须引用 Constraint ID

```javascript
const prompt = String(input.tool_input?.prompt || '');
const desc = String(input.tool_input?.description || '');

const isFix = /fix|repair|修复|bug|审计|audit/i.test(desc + prompt.substring(0, 200));

if (isFix) {
  const hasConstraintRef = /C-[A-Z]+-\d+|constraints\.md/.test(prompt);
  if (!hasConstraintRef) {
    process.stderr.write(
      '[Agent Check] 修复类 Agent 未引用 Constraint ID。\n' +
      '→ 先写规则到 constraints.md，再派 Agent。\n'
    );
    // 不阻止，但发出警告
  }
}
```

### 4. Verification Gate（验证门控）

**触发：** PreToolUse:Bash (git commit)
**作用：** 提交前确认 QA 已完成

```javascript
const cmd = String(input.tool_input?.command || '');

if (/git\s+commit/.test(cmd)) {
  // 检查是否有 verification report
  const fs = require('fs');
  const reportExists = fs.existsSync('docs/verification-report.md') ||
    fs.existsSync('.harness/last-verification.json');

  if (!reportExists) {
    process.stderr.write(
      '[Verification Gate] 未找到验证报告。\n' +
      '→ 请先运行 QA 验证流程（Layer 2: Verification Loop）。\n'
    );
    process.exit(2); // 阻止提交
  }
}
```

### 5. Delivery Review（交付前复盘）

**触发：** PreToolUse:Bash (open/打开交付物)
**作用：** 在交付用户之前提醒复盘

```javascript
if (/open\s+.*\.(pptx|pdf|html|zip|apk|ipa)/.test(cmd)) {
  process.stderr.write(
    '\n[Delivery Review] 交付前复盘 5 项检查：\n' +
    '1. 流程合规：是否按 6 阶段 Loop 执行？\n' +
    '2. QA 达标：各层 QA 报告是否完整？\n' +
    '3. 需求完整：所有需求是否全部处理？\n' +
    '4. 规则升级：新问题是否写入 constraints？\n' +
    '5. 改进机会：哪些步骤可以优化？\n\n'
  );
}
```

### 6. Context Budget Monitor（上下文预算监控）

**触发：** PreToolUse:Edit, PreToolUse:Write
**作用：** 工具调用计数过多时提醒 compact

```javascript
const COUNTER_FILE = '/tmp/harness-tool-counter.json';
let counter = { count: 0 };
try { counter = JSON.parse(fs.readFileSync(COUNTER_FILE)); } catch {}
counter.count++;
fs.writeFileSync(COUNTER_FILE, JSON.stringify(counter));

if (counter.count >= 50 && counter.count % 25 === 0) {
  process.stderr.write(
    `[Context Monitor] 已执行 ${counter.count} 次工具调用。\n` +
    '→ 建议在下一个逻辑阶段边界执行 /compact。\n' +
    '→ 这能防止上下文过长导致规则遵从度下降。\n'
  );
}
```

## settings.json 模板

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "node scripts/hooks/safety-guard.js" }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "node scripts/hooks/verification-gate.js" }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "node scripts/hooks/delivery-review.js" }
        ]
      },
      {
        "matcher": "Agent",
        "hooks": [
          { "type": "command", "command": "node scripts/hooks/agent-check.js" }
        ]
      },
      {
        "matcher": "Edit",
        "hooks": [
          { "type": "command", "command": "node scripts/hooks/context-monitor.js" }
        ]
      },
      {
        "matcher": "Write",
        "hooks": [
          { "type": "command", "command": "node scripts/hooks/context-monitor.js" }
        ]
      }
    ]
  }
}
```

## Hook 设计原则

### 1. 阻止 vs 警告

| 严重性 | 行为 | 例子 |
|--------|------|------|
| **阻止**（exit 2） | 危险操作，不可恢复 | rm -rf /, force push, DROP TABLE |
| **强警告**（stderr） | 流程违规，但可继续 | 修复 Agent 未引用 Constraint ID |
| **轻提醒**（stderr） | 建议性改进 | 工具调用过多，建议 compact |

### 2. Hook 不应该做什么

- **不修改 Agent 的输出** — Hook 是守门人，不是干预者
- **不做复杂的业务逻辑** — Hook 应该快速、确定性
- **不产生副作用** — 除了计数器等轻量记录
- **不阻止读操作** — Read/Grep/Glob 永远放行

### 3. 项目定制

每个项目的 Hook 应该根据实际情况定制：
- **Pipeline 项目**：加 pipeline-gate（阶段前置条件检查）
- **PM 模式**：加 role-guard（角色越权拦截）
- **高安全项目**：加 file-scope-guard（限制可编辑目录）
- **长时任务**：加 context-monitor（提醒 compact）

## 与 Rules 的配合

```
Rules（.claude/rules/）        Hooks（.claude/settings.json）
  "应该做什么"                    "不做什么就拦住"
  ↓                              ↓
  引导 Agent 的行为方向            强制执行不可违反的约束
  ↓                              ↓
  可能被遗忘                      100% 执行
```

最佳实践：**关键约束写 Hook + Rule 双保险。** Rule 告诉 Agent 为什么这么做，Hook 确保它真的做了。
