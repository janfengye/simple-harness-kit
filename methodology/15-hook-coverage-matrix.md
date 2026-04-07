# Hook 覆盖矩阵

## 为什么需要这份矩阵

Hook 的覆盖面就是 Harness 的"执行边界"：没覆盖到的工具和事件就是 AI 可以绕过流程的后门。过去几次 Codex 交叉验收反复发现这类盲区——某个工具没 matcher、某个事件没监听、提示消息和实际逻辑不同步。

这份矩阵把"为什么覆盖 / 为什么不覆盖"的决策持久化，便于：

- 新增工具类型时对照决策流程判断是否需要加 Hook
- 审计已有覆盖是否完整，发现漂移
- 为未来迁移到 lifecycle events 提供基准

矩阵必须同时描述两个维度，避免"文档说有、实际没注册"的隐形漂移：

- **意图 (intent)**: 脚本逻辑（如 `stage-guard.js` 的 READ_TOOLS 数组）希望处理哪些工具
- **注册 (registered)**: 具体的配置文件（templates/settings-json.tmpl / init-prompt.md / 本地 settings.json）实际挂载了哪些 matcher/event

只有 intent 和 registered 同步，行为才真正生效。

这份矩阵是动态文档，随 Claude Code 新增工具/事件、或本项目新增 Hook 时更新。对应约束：C-HOOK-06。

## A. 工具 matcher 覆盖矩阵

符号：`✓` = 已在模板和 stage-guard 内同步注册；`○` = 脚本支持但模板未注册；`—` = 故意不覆盖，有理由；`gap` = 已知 gap，待评估。

矩阵中"意图"指 stage-guard.js 内部数组（READ_TOOLS/TASK_TOOLS）或其他 Hook 脚本逻辑。"模板注册"指 `templates/settings-json.tmpl`（用户 init 时的 source of truth）。

### 写类工具

| 工具 | 意图 | 模板注册 | 额外 Hook | 理由 |
|------|:---:|:---:|---|------|
| Bash | ✓ | ✓ | safety-guard / verification-gate / delivery-review / commit-check / session-logger | 最危险的操作，最多覆盖 |
| Edit | ✓ | ✓ | context-monitor / session-logger | 文件修改 |
| Write | ✓ | ✓ | context-monitor / session-logger | 文件创建 |
| Agent | ✓ | ✓ | agent-check / session-logger | 子 agent 派发，需检查 Constraint ID 引用 |
| NotebookEdit | gap | — | — | 等同 Edit 的写操作。本项目无 notebook，未配置。用户项目如有 notebook 应添加。单独跟踪 |

### 读类工具

stage-guard 对所有匹配的工具都会执行统一流程：

1. **首次调用守门** — 本轮任务第一次工具调用会被阻止 (`exit 2`)，要求 AI 先输出阶段声明。`TASK_TOOLS` 被显式跳过，其余（含 `READ_TOOLS`）都受此约束
2. **PLAN 阶段** — `READ_TOOLS` 放行并注入 PLAN directive；`TASK_TOOLS` 放行不打扰；其他工具被阻止
3. **非 PLAN 阶段** — 全部放行，但在 stderr 注入当前阶段声明和 session-log 提醒

| 工具 | READ_TOOLS | 模板注册 | 理由 |
|------|:---:|:---:|------|
| Read | ✓ | ✓ | PLAN 阶段放行 + PLAN directive，非 PLAN 注入阶段提醒 |
| Grep | ✓ | ✓ | 同 Read |
| Glob | ✓ | ✓ | 同 Read |
| WebFetch | ✓ | ✓ | 官方 PreToolUse 工具，v0.6.2 加入 |
| WebSearch | ✓ | ✓ | 同 WebFetch |

"reminder only" 的表述不准确：即便是读类工具，首次调用依然会被拦截，非 PLAN 阶段也会注入阶段声明，只是不会"阻止工具执行"。

### 任务管理工具

| 工具 | TASK_TOOLS | 模板注册 | 理由 |
|------|:---:|:---:|------|
| TaskUpdate | ✓ | ✓ | EXECUTE/VERIFY 阶段标记 completed 时提醒检查验证证据 |
| TaskCreate | ✓ | ○ | 脚本跳过 first-call guard 并在 PLAN 阶段放行，但模板未注册 matcher，意味着 Claude Code 根本不会调用 hook — 是"意图有，注册无"的状态 |
| TaskList | ✓ | ○ | 同上 |
| TaskGet | ✓ | ○ | 同上 |

**已知状态**: `TASK_TOOLS` 数组里有 4 个工具，但 `templates/settings-json.tmpl` 和 `init-prompt.md` 都只注册了 `TaskUpdate` 的 matcher。这是故意的 — 只有 TaskUpdate 需要 completed 提醒，其他三个注册 matcher 反而增加 hook 调用开销。脚本里把它们放入 `TASK_TOOLS` 是为了假如未来注册时也自动享受"跳过 first-call guard + PLAN 阶段放行"的行为。

### 其他

| 工具 | 覆盖状态 | 理由 |
|------|:---:|------|
| Skill | — | Skill 触发的底层工具调用会被各自 matcher 覆盖，Skill 层不重复守门 |
| SendMessage | — | agent 间通信，不直接产出代码 |

## B. Lifecycle events 覆盖矩阵

事件的"注册"指具体配置文件顶层 key 是否存在。

"本项目" 在本节专指 simple-harness-kit 这个 kit 仓库；"使用方"指任何用此 kit init 出来的项目（如工作区 ths-harness）。symbols：`✓` = 模板和主要 settings.json 都注册；`○` = 某一处注册、其他处未同步；`—` = 故意不覆盖；`gap` = 待评估。

| 事件 | templates/settings-json.tmpl | 使用方 .claude/settings.json（例: ths-harness 工作区） | init-prompt.md (最小集) | 脚本 | 用途 |
|------|:---:|:---:|:---:|---|------|
| SessionStart | ✓ | ✓ | ✓ | harness-session-start.js | 新 session 初始化、重置陈旧 stage、输出 banner |
| PreToolUse | ✓ | ✓ | ✓ | stage-guard / safety-guard / verification-gate / delivery-review / commit-check / agent-check / context-monitor | 核心拦截点 |
| PostToolUse | ✓ | ✓ | ✓ | session-logger | 成功工具调用记录 |
| PostToolUseFailure | ✓ | ✓ | ✓ | session-logger | 失败工具调用记录（v0.6.2 加入） |
| Stop | ✓ | ✓ | — | delivery-gate.js | 交付前拦截 EXECUTE（总是阻止）和 VERIFY（无证据时阻止） |

**init-prompt.md 为什么没有 Stop**: init-prompt 的 settings.json 示例明确定位为"最小配置"（见其第 89-91 行）。delivery-gate 是可选的交付守门，用户可根据需要追加，不属于最小集。不算漂移。

**待评估事件** — 这些事件 Claude Code 支持但本项目未覆盖，评估聚合在任务 #17：

| 事件 | gap 类型 | 备注 |
|------|---|------|
| TaskCreated | 可能替代 TaskUpdate matcher | 更精确的事件，后续迁移 |
| TaskCompleted | 同上 | completed 提醒的正确事件 |
| CwdChanged | 可替代 find-root.js 的被动定位 | 当前 CWD 漂移通过 `scripts/hooks/find-root.js` 解决 |
| PostToolUseFailure + 失败提醒到 AI | — | 当前只记录，未反馈给 AI |
| StopFailure | — | API 错误结束 |
| PreCompact / PostCompact | — | 上下文压缩前后的状态快照 |
| SessionEnd | — | session 结束汇总 |
| ConfigChange | — | 配置变更审计 |

**故意不覆盖的事件**:

| 事件 | 理由 |
|------|------|
| UserPromptSubmit | 无具体守门用例 |
| PermissionRequest / PermissionDenied | 交互式权限，非自动化场景 |
| Notification | Claude Code UI 相关 |
| SubagentStart / SubagentStop | Agent matcher 已覆盖派发动作 |
| TeammateIdle | 多 agent 协作，本项目未用 |
| InstructionsLoaded | CLAUDE.md/rules 重载，无守门用例 |
| FileChanged | 监视外部文件变更，无用例 |
| WorktreeCreate / WorktreeRemove | worktree 生命周期，无用例 |
| Elicitation / ElicitationResult | MCP 交互，无用例 |

## C. gap 分类

| 分类 | 含义 | 处理原则 |
|------|------|----------|
| 故意不覆盖 (—) | 评估后判定无必要，有明确理由 | 无需跟进 |
| 已知 gap | 可能有价值但未评估/未实现 | 入队跟踪 |
| 意图 vs 注册不一致 (○) | 脚本支持但配置未挂载 | 矩阵显式说明状态，由对应任务解决 |
| 隐形漂移 | 代码或配置中未覆盖，文档和审计也未记录 | 矩阵就是消除隐形漂移的工具 |

当前已知 gap 对应任务：

- lifecycle events 相关的所有 `gap` 项 → 任务 #17
- NotebookEdit → 单独跟踪，不属于 #17

## D. 新增工具或事件的决策流程

当 Claude Code 新增工具或本项目考虑新增 Hook 覆盖时，按以下顺序判断：

1. **有无代码副作用？**
   - 修改文件系统 / 执行命令 / 产生输出物 → 强制覆盖 stage-guard + session-logger
   - 只读 / 流程管理 / 内部状态 → 下一步

2. **是否需要阶段约束？**
   - PLAN 阶段应禁止 / EXECUTE 阶段应记录 → 加 stage-guard（阻止或 directive）
   - 无阶段相关性 → 不加

3. **是否需要黑匣子记录？**
   - 出问题后需要追溯 → 加 session-logger
   - 纯读且频率极高 → 不加（避免噪音）

4. **是否需要安全守门？**
   - 命令执行类 → 加 safety-guard
   - 其他 → 不加

5. **是否要同时更新意图和注册？**
   - 先决定是否纳入对应脚本的数组/逻辑（意图）
   - 再决定是否在模板（`templates/settings-json.tmpl`）和使用方 settings.json（例: ths-harness 工作区 `.claude/settings.json`）挂 matcher（注册）
   - 只改其中一处就是漂移

6. **同步更新矩阵** — 本文档是审计工具，任何新增/修改 Hook 覆盖都要同步。

## E. 一致性检查清单

修改 Hook 覆盖时必须同步以下位置。矩阵与这些文件任何一个不一致都算漂移：

**强制同步（所有 Hook 变更）**:
- `simple-harness-kit/templates/settings-json.tmpl`（模板 source of truth）
- `simple-harness-kit/scripts/hooks/*.js` 相关脚本（如 `harness-stage-guard.js` 的 `READ_TOOLS` / `TASK_TOOLS`）
- 对应 Hook 脚本的头部注释"触发"行
- 对应测试场景（`tests/hook-scenarios/*.json`）
- 本矩阵（`methodology/15-hook-coverage-matrix.md`）

**按范围同步**:
- `.claude/settings.json` — 使用方工作区（如 ths-harness）配置，仅当改动对该工作区有效时同步
- `simple-harness-kit/init-prompt.md` — **最小配置示例**，仅同步"必选"级别的 hook；可选 hook 不必出现
- `simple-harness-kit/methodology/05-hook-enforcement.md` — 方法论文档，settings.json 示例建议只保留精简版并显式指向本矩阵和模板，避免三份竞争性真实源
