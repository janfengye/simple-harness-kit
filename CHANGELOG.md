# Changelog

本仓库的所有版本变更记录在此。

格式遵循 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

> 这些变更已 commit 但未打 tag。下次发版时整理到具体版本号下。版本号由 release 任务决定（参考 [docs/release-process.md](docs/release-process.md)）。

### Added

- **SessionEnd hook (#26)** — 新增 `scripts/hooks/session-end.js`。session 结束时立即归档 `.harness/observations.jsonl` 到 `.harness/observations.archive/observations-<sid8>-<ts>.jsonl`（不等 10MB 阈值），写 session 结束标记到 session-log。HARNESS_LOG=off 完全跳过。observability-only 不阻塞退出。自动触发 harness-learn 放弃（避免阻塞），留给 manual/periodic 模式
- **E2E validate.sh E2 section (#34)** — `tests/e2e-acceptance-validate.sh` 新增 E2 检查 "wired script 文件必须存在"：从 required-wiring.json 派生脚本集合，扫 `scripts/hooks/` / `.claude/hooks/` / `hooks/` 三个候选目录。反 VH-08 同类回归（settings 已注册但脚本未复制）
- **Template integrity T8 (#34)** — `tests/template-integrity.js` 新增 T8 守门 "skill: harness-init/SKILL.md 强制读真实源 + 不复述清单"：检查 SKILL.md 引用 init-prompt.md / settings-json.tmpl / required-wiring.json，禁止凭记忆字面，禁止内嵌 settings.json JSON 代码块和硬编码 hook 清单。实测能 catch 旧版本 SKILL.md
- **tests/run.js 扩展 `expect.dirs` (#26)** — 支持正则目录文件名匹配 + minCount + contains，用于断言 archive 文件创建/命名/内容
- **Post-mortem: skill-entry-blindspot (#34)** — 新增 [docs/decisions/2026-04-08-skill-entry-blindspot.md](docs/decisions/2026-04-08-skill-entry-blindspot.md)。VH-08 根因复盘：4 个失效模式叠加（skill 不读真实源 / 多源副本漂移 / E2E 入口盲区 / 长期未 review），含 BEFORE/AFTER sub-agent 量化实验（BEFORE 21/57 PASS → AFTER 64/64 PASS）
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

- **skills/harness-init/SKILL.md 彻底重写 (#34)** — 134 行变 92 行。删除硬编码的文件树、必选清单、完整性 checklist。新增强制"生成原则"段，要求 AI 必须先 Read `templates/settings-json.tmpl` / `init-prompt.md` / `required-wiring.json` 作为真实源，禁止凭记忆生成 `.claude/settings.json` 和 hook 脚本。反 VH-08 根因修复
- **init-prompt.md 清理陈旧表述 (#34)** — (1) "必选 4 个"改为指向 required-wiring.json 真实源；(2) 必选组件表加入 `session-end.js` 和 `find-root.js`（hook 共享依赖，漏复制会导致 MODULE_NOT_FOUND）
- **SessionEnd wiring 加入 templates/settings-json.tmpl + required-wiring.json + .claude/settings.json (#26)** — 19 个 wiring (从 18 扩到 19)
- **methodology/05-hook-enforcement.md + 15-hook-coverage-matrix.md 同步 SessionEnd (#26)** — 矩阵从"gap"改为"已覆盖"，添加 Hook 类型表 session-end 行
- **tests/scenarios/01-setup-completeness.md 去除硬编码事件清单 (#34)** — 手工"PreToolUse+PostToolUse+PostToolUseFailure"清单改为"运行 validate.sh"引用；显式加入"不要再硬编码副本"禁令。反 VH-08 同类回归
- **scripts/hooks/ 为唯一源** — 删除 templates/hooks/（11 个陈旧副本），update.sh 改从 scripts/hooks/ 取源（66e5fcf）
- **constraints.md 种子扩充** — kit 默认 constraints 从 2 个 JC 组扩到 6 个组（66e5fcf）
- **methodology/05-hook-enforcement.md 精简 settings.json 示例** — 完整 settings.json 示例替换为指向模板的精简版（避免三份竞争性真实源）；多处行为描述对齐实际代码（4de0240）
- **harness-stage-guard.js 头部注释** — 重写为完整的 10 条机制说明，覆盖所有 exit 0 / exit 2 路径（4de0240）

### Fixed

- **P0: VH-08 /harness-init skill 生成错误 settings.json (#34)** — 用户用 `/harness-init` 初始化后新 session 报 `Invalid key in record`。根因：旧 SKILL.md 不要求 AI 读 templates/settings-json.tmpl，AI 默认凭训练记忆拼 JSON，产生 3 个 schema 错误（SessionStart 是字符串不是数组 / command 平铺无 hooks 包装 / matcher 用 regex 或 `*`）。修复：重写 SKILL.md 强制读真实源 + T8 守门 + E2 wired-script 检查 + 双入口 E2E（C-GATE-06）。BEFORE/AFTER sub-agent 实验量化基线：21/57 → 64/64 PASS
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
