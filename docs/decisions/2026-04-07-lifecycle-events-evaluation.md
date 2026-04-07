# Lifecycle Events 评估报告 — #17

## 评估说明

按 #16 矩阵中的 gap 列表，逐项评估 9 项 lifecycle events / 能力（含 8 个独立 events 和 PostToolUseFailure 的 AI 反馈进阶用法）是否值得引入。

**优先级定义**:
- **P0** — 解决真实痛点且风险低，立即迁移
- **P1** — 有价值但需要下次重构窗口处理
- **P2** — 有价值但收益有限，观察使用情况后再决定
- **P3** — 不引入

## 评估总览

| Event | 支持 exit 2? | 当前替代方案 | 痛点解决? | 优先级 | 后续任务 |
|-------|:---:|------|:---:|:---:|------|
| TaskCreated | ✓ | 无注册（模板不监听 TaskCreate；脚本 TASK_TOOLS 数组是死代码） | 边缘 | **P3** | — |
| TaskCompleted | ✓ | TaskUpdate matcher 检测 status==completed | 部分 | **P1** | 迁移 TaskUpdate→TaskCompleted |
| CwdChanged | ✗ (observability only) | find-root.js 被动定位 | 无 | **P3** | — |
| StopFailure | ✗ | 无（错误未记录到 session-log） | 显著 | **P1** | session-logger 监听 StopFailure |
| PreCompact | ✗ | 无（context-monitor 仅提醒） | 边缘 | **P2** | 观察 |
| PostCompact | ✗ | 无 | 边缘 | **P2** | 观察 |
| SessionEnd | ✗ | 无 | 显著 | **P1** | session 结束自动 archive observations |
| ConfigChange | ✓ | 无（settings.json 被改后无审计） | 中等 | **P2** | 观察是否真有需求 |
| PostToolUseFailure→AI 反馈 | n/a (additionalContext) | session-logger 只记录 | 边缘 | **P2** | 观察 AI 处理失败的反应 |

## 逐项评估

### 1. TaskCreated → P3 不引入

**当前部署状态**:
- 模板和 init-prompt 都**没有注册** TaskCreate matcher（[settings-json.tmpl](../../templates/settings-json.tmpl) 只注册了 TaskUpdate）
- stage-guard.js 的 TASK_TOOLS 数组里有 TaskCreate，但因为模板没注册 matcher，这部分逻辑实际不会运行
- 也就是说"PLAN 阶段对 TaskCreate 的放行"是脚本设计意图，**不是当前运行的替代方案**

**Codex 之前建议**: 创建任务可产生未经审批的计划外工作，应考虑覆盖。

**评估**:
- 既然现状是"完全不监听 TaskCreate"，引入 TaskCreated event 实际上是从 0 到 1 的覆盖增加
- 但用 exit 2 阻止建任务弊大于利：AI 探索阶段需要灵活建任务，强行阻止会破坏任务管理工具的可用性
- 真正的风险是"建了任务后偷偷绕过 PLAN 审批就开始执行"。当前 stage-guard 在 PLAN 阶段会阻止 Bash/Edit/Write 等执行类工具，这是一道闸门。但**注意**：stage-guard 不阻止 AI 直接 Write `.harness/current-stage.json` 把 stage 切到 EXECUTE 跳过用户确认（这是 #20 跟踪的相关问题）。所以"PLAN→EXECUTE 控制"只是部分有效，TaskCreated 阻止不会显著强化它
- 一个轻量替代：如果以后想加可观测性，可以让 TaskCreated 触发 session-logger 记录任务创建到 session-log，**不阻止**

**结论**: 不引入阻止式覆盖。可观测性记录留作可选改进，不进 P1 队列。"PLAN→EXECUTE 控制不严"是另一个独立问题，由 #20 跟踪。

### 2. TaskCompleted → P1 下次重构（建议完全替换）

**当前实现**: TaskUpdate matcher 检测 `tool_input.status === 'completed'` 在 EXECUTE/VERIFY 阶段提醒。

**关键事实** (Codex 二轮指出): stage-guard.js 对 TaskUpdate 的**唯一专门逻辑**就是 `status === 'completed'` 时触发 VERIFY 提醒（[harness-stage-guard.js L350 附近](../../scripts/hooks/harness-stage-guard.js)）。代码没有任何 `in_progress` 专属行为。这意味着 TaskCompleted 可以**完全替代**而非补充。

**优势**:
- TaskCompleted 是专门为完成事件设计的，不需要解析 tool_input
- payload 直接包含 task_id/task_subject，更利于精确提醒（"任务 #18 commit #15 变更"而非通用文字）
- agent team 场景：teammate 完成 in-progress task 时也触发，覆盖更全
- 替换后 TaskUpdate matcher 可以删除（包括对应的 first-call guard 跳过、PLAN 放行、3 个测试场景），代码更精简

**劣势**:
- 需要在 settings.json 加新的顶层 event key
- 行为变化：从"工具调用前提醒"变成"任务标记完成时提醒"，用户感受可能不同

**迁移策略**: 两阶段
1. 先并行：保留 TaskUpdate matcher，新增 TaskCompleted 监听，验证两者触发一致性
2. 验证通过后：删除 TaskUpdate matcher 及相关代码

**风险**: 低。

**结论**: 入新任务（#24 已入队），按"先并行再替换"策略推进。

### 3. CwdChanged → P3 不引入

**当前实现**: `find-root.js` 被动从 CWD 向上查找 `.harness/` 或 `simple-harness-kit/` 标记。

**官方文档说明**: CwdChanged 不能 exit 2 阻止，但可以做的事不只是日志：
- 通过 `CLAUDE_ENV_FILE` 持久化环境变量到后续 Bash 命令（类似 SessionStart）
- 动态更新 `watchPaths` 给 `FileChanged` 事件用
- 触发 direnv 等环境管理工具

**评估**:
- 本项目当前没有"按目录切换环境变量"或"按目录监视文件"的需求
- CWD 漂移问题（VH-07 的根因）已被 find-root.js 主动定位解决，每次 hook 调用都重新定位，不依赖任何 cd 事件
- 如果未来引入"切目录加载不同 .env" 或"用 watchPaths 监视特定子项目"的能力，应该重新评估 CwdChanged

**结论**: 不引入。理由不是"它只能做日志"，而是"当前架构不需要它能做的额外事情（环境变量持久化 / watchPaths 更新）"。

### 4. StopFailure → P1 显著价值

**当前实现**: API 错误结束时，Harness 完全不知道。session-log 没有记录，下次 session 不知道上次是怎么挂的。

**优势**:
- 错误类型清晰：rate_limit / authentication_failed / billing_error / invalid_request / server_error / max_output_tokens / unknown
- 可以直接送给 session-logger，加一行 `[StopFailure] error_type` 到 session-log
- 可观测性显著提升

**劣势**:
- observability only，不能修复错误，只能记录
- session-logger 需要扩展处理 hook_event_name === 'StopFailure'

**风险**: 极低。

**结论**: 入新任务。session-logger 加 StopFailure 支持。

### 5. PreCompact → P2 观察

**当前实现**: context-monitor 在 Edit/Write 时提醒"建议 compact"，但不知道用户是否真的 compact 了。

**评估**:
- PreCompact 触发时机晚于 monitor 提醒
- 可用于：在 compact 前快照当前 stage、task、observations 计数
- 但当前没有"compact 后丢失上下文"的实际痛点

**结论**: 入观察列表。如果将来有 compact 相关 bug，再考虑。

### 6. PostCompact → P2 观察

类似 PreCompact。可用于：compact 后重新注入关键上下文（如 current-stage 提醒）。但目前 session-start 已经处理了类似场景。

**结论**: 同 PreCompact，观察。

### 7. SessionEnd → P1 显著价值

**当前实现**: session 结束没有任何收尾动作。observations.jsonl 持续增长直到 10MB 触发归档。

**优势**:
- 可以触发：归档 observations 到 archive 文件、生成 session 摘要、清理 stale stage 文件
- source 字段区分原因 (clear/resume/logout/prompt_input_exit/...) 可用于不同处理
- harness-learn 的"周期性分析"现在靠手动跑，可改为 SessionEnd 自动触发

**劣势**:
- observability only，无法阻止
- 需要新增 session-end.js Hook 脚本

**风险**: 低。如果 session-end 慢会让退出延迟，需要保证 < 100ms。

**结论**: 入新任务。新增 session-end.js Hook，处理归档 + 触发 harness-learn 分析。

### 8. ConfigChange → P2 观察

**当前实现**: settings.json 被改后没有审计，下次 session 才能知道。

**评估**:
- 文档说支持 exit 2 阻止 config change
- 但用例不明：本项目 settings.json 改动一般是开发者主动为之，自己阻止自己意义不大
- 多用户/团队场景才有审计价值，本项目当前是单人

**结论**: 入观察列表。如果 harness-kit 推广到团队场景再考虑。

### 9. PostToolUseFailure 反馈到 AI → P2 观察

**当前实现**: PostToolUseFailure event 已被 session-logger 监听（#15 commit），但只做"记录到 session-log + observations"，没有利用 hook 的 `hookSpecificOutput.additionalContext` 字段把失败信息回填给 AI。

**机会**:
- 文档说 PostToolUseFailure 可以返回 `{"hookSpecificOutput": {"hookEventName": "PostToolUseFailure", "additionalContext": "..."}}` 让 AI 在下一轮看到失败上下文
- 这能提升 AI 的纠错能力——AI 看到失败立即知道发生了什么，不需要从下一次工具调用的输出反推
- 例：`npm test` 失败时反馈"测试 X 失败，错误：Y"给 AI

**劣势**:
- 当前 session-logger 已经能记录失败，缺的是"主动反馈"层
- AI 实际上看到工具调用的 stderr/exit code，本身已经知道失败
- 增加反馈可能引入冗余（重复的失败信息）

**风险**: 如果反馈内容设计不好可能让 AI 上下文噪声增加。

**结论**: 入观察列表。先观察当前记录方案是否够用，AI 是否真的需要额外反馈。如果发现 AI 处理失败时反应迟钝，再考虑实现。

## 总结

| 优先级 | 数量 | Events |
|-------|------|--------|
| P0 立即 | 0 | — |
| P1 下次重构 | 3 | TaskCompleted, StopFailure, SessionEnd |
| P2 观察 | 4 | PreCompact, PostCompact, ConfigChange, PostToolUseFailure→AI 反馈 |
| P3 不引入 | 2 | TaskCreated, CwdChanged |

## P1 后续任务建议

应入队的新任务：

1. **TaskUpdate → TaskCompleted 迁移评估和实施** — 改 stage-guard 监听 TaskCompleted 事件，并行运行一段时间后切换；需要新测试场景；需要更新覆盖矩阵
2. **session-logger 支持 StopFailure** — 监听 API 错误结束，记录错误类型到 session-log；需要新测试场景
3. **新增 session-end.js Hook** — SessionEnd 触发归档 observations + 可选触发 harness-learn 分析

P2 项作为观察列表保留在矩阵中。

## 重要发现

1. **大部分 lifecycle events 是 observability only** — CwdChanged/StopFailure/PreCompact/PostCompact/SessionEnd 都不能 exit 2 阻止。这意味着它们不能替代 PreToolUse/Stop 这样的"守门"用途，只能补充"记录/通知"用途。

2. **TaskCompleted 是唯一能完全替代现有 stage-guard TaskUpdate 实现的 event** — 因为 stage-guard 对 TaskUpdate 的唯一专门逻辑就是 status==completed 检测，没有 in_progress 等其他状态的专属行为。迁移按"先并行验证再删除旧实现"两阶段推进。

3. **架构方向**：lifecycle events 适合做 **可观测性补充层**，不适合做 **执行守门替换层**。Harness 的核心守门仍然依赖 PreToolUse + Stop。
