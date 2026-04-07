# Changelog

本仓库的所有版本变更记录在此。

格式遵循 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

> 这些变更已 commit 但未打 tag。下次发版时整理到具体版本号下。版本号由 release 任务决定（参考 [docs/release-process.md](docs/release-process.md)）。

### Added

- **Hook 版本号机制** — 12 个 Hook 脚本头部注释加 `@version` 字段，update.sh 增强版本比对 + `--dry-run` 模式（66e5fcf）
- **TaskUpdate matcher** — stage-guard 监听 TaskUpdate 工具调用，EXECUTE/VERIFY 阶段标记 completed 时提醒检查验证证据；first-call guard 跳过 TASK_TOOLS（66e5fcf）
- **WebFetch / WebSearch 覆盖** — stage-guard READ_TOOLS 数组扩展，PLAN 阶段放行并注入 directive；模板和本地配置同步（1c1a09d）
- **PostToolUseFailure 事件支持** — session-logger 监听失败工具调用，写入 [失败] 标记到 session-log，observations.jsonl 增加 status 和 error 字段；methodology/05-hook-enforcement.md Hook 类型表加入此事件（1c1a09d）
- **TASK_TOOLS 任意阶段放行** — TaskUpdate/TaskCreate/TaskList/TaskGet 在 PLAN 阶段不被阻止（流程管理操作无代码副作用）（1c1a09d）
- **Hook 覆盖矩阵文档** — 新增 [methodology/15-hook-coverage-matrix.md](methodology/15-hook-coverage-matrix.md)，记录工具/事件的 Hook 覆盖决策、intent vs registered 状态、新增工具决策流程、一致性检查清单（4de0240）
- **Lifecycle events 评估报告** — 新增 [docs/decisions/2026-04-07-lifecycle-events-evaluation.md](docs/decisions/2026-04-07-lifecycle-events-evaluation.md)，评估 9 项 lifecycle events / 能力（TaskCompleted / StopFailure / SessionEnd 等），决策 P0/P1/P2/P3 优先级（0e31062）
- **commit/push 阶段策略文档化** — methodology/12-commit-standards.md 新增 'Commit / Push 阶段规则' 章节；stage-guard REVIEW directive 增加 push 提醒（b63407c）
- **CHANGELOG.md 和 release 流程** — 新增本文件 + [docs/release-process.md](docs/release-process.md)（本次 commit）

### Changed

- **scripts/hooks/ 为唯一源** — 删除 templates/hooks/（11 个陈旧副本），update.sh 改从 scripts/hooks/ 取源（66e5fcf）
- **constraints.md 种子扩充** — kit 默认 constraints 从 2 个 JC 组扩到 6 个组（66e5fcf）
- **methodology/05-hook-enforcement.md 精简 settings.json 示例** — 完整 settings.json 示例替换为指向模板的精简版（避免三份竞争性真实源）；多处行为描述对齐实际代码（4de0240）
- **harness-stage-guard.js 头部注释** — 重写为完整的 10 条机制说明，覆盖所有 exit 0 / exit 2 路径（4de0240）

### Fixed

- **P0: templates/settings-json.tmpl 缺少 SessionStart 和 Stop 顶层事件** — 用此模板 init 的项目会丢失 harness-session-start.js 和 delivery-gate.js 触发；本次补齐（4de0240）
- **update.sh --dry-run 不影响 Skills 复制** — Skills 复制现在受 DRY_RUN 控制（66e5fcf）
- **update.sh 不安装新增 Hook 文件** — 写循环改为目标不存在时也复制（66e5fcf）
- **TaskUpdate matcher 未同步到模板** — templates/settings-json.tmpl 和 init-prompt.md 补齐（66e5fcf）
- **session-logger 不区分成功/失败** — PostToolUseFailure 调用现在在 session-log 加 [失败] 标记，observations.jsonl 加 status='failure' + error 字段（1c1a09d）
- **methodology/05-hook-enforcement.md 多处文档漂移** — 移除"Read/Grep/Glob 永远放行"等过时表述；REVIEW gate 文案对齐实际代码（只检查 EXECUTE/VERIFY，不检查 PLAN）（4de0240）

### Notes

- 经过多轮 Codex 交叉验收（每个变更 2-5 轮）确保实现与文档一致
- 5 个 commit 的端到端验收发现 P0 模板缺陷，证明矩阵审计的价值
- **遗留待定**: methodology/15-hook-coverage-matrix.md 中 WebFetch/WebSearch/PostToolUseFailure 行有 "v0.6.2 加入" 字样，发版时需要确认是否这确实是 0.6.2（或改写为当前 [Unreleased] 对应的真实版本号）

## [0.6.0] — Hook 路径定位修复

Hook 脚本通过 find-root.js 主动定位项目根，不再依赖 process.cwd()。解决 CWD 漂移导致的 MODULE_NOT_FOUND 问题。

详见 commit 1699b88 和 git tag v0.6.0。

## [0.5.0] — Stop Hook delivery-gate + Skill 命名差异化

详见 git tag v0.5.0。

## [0.4.1]

详见 git tag v0.4.1。

## [0.4.0] — Hook 自动化测试 + init 流程修复 + REVIEW Gate + install/update 脚本

详见 commit d862450 和 git tag v0.4.0。

## [0.3.0]

详见 git tag v0.3.0。

## [0.2.0]

详见 git tag v0.2.0。

## [0.1.0]

最早发布版本。详见 git tag v0.1.0。
