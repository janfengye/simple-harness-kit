# Changelog

本仓库的所有版本变更记录在此。

格式遵循 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

> 这些变更已 commit 但未打 tag。下次发版时整理到具体版本号下。版本号由 release 任务决定（参考 [docs/release-process.md](docs/release-process.md)）。

（暂无新条目）

## [0.7.0] - 2026-04-08

### Migration Notes for VH-08

**🚨 P0 Fix — 受影响用户必读**

#### 故障表现

- 通过 `/harness-init` slash command 初始化项目后，新开 Claude Code session 立即报错 `Invalid key in record`
- 6 阶段 Loop 完全失效，hook 链路加载失败
- 绕过 skill（直接喂 init-prompt.md 内容）则正常

#### 根因摘要

旧版 `skills/harness-init/SKILL.md` 没有要求 AI 读取 `templates/settings-json.tmpl` 真实源，AI 凭训练记忆拼出 schema 错误的 `.claude/settings.json`：`SessionStart` 是字符串而不是数组、`command` 平铺在 matcher 同级而没有 `hooks: [{type, command}]` 包装层、`matcher` 用 `"Write|Edit"` 这样的 regex 或 `"*"` 通配符。完整复盘见 [docs/decisions/2026-04-08-skill-entry-blindspot.md](docs/decisions/2026-04-08-skill-entry-blindspot.md)。

#### 何时不需要升级

- 你**没有**用过 `/harness-init` slash command（直接读 init-prompt.md 喂给 AI 的，不受影响）
- 你的 `.claude/settings.json` 是你手工写的或从 templates/settings-json.tmpl 直接复制的
- 你的 Claude Code session 启动正常、6 阶段 Loop 工作正常

如果以上**全部成立**，可以跳过升级，但仍建议拉最新代码以获得 SessionEnd hook、StopFailure 等新 lifecycle event 支持。

#### 何时需要升级

如果以下**任一项**成立，你必须升级：

- 启动新 session 报 `Invalid key in record`
- `.claude/settings.json` 里出现 `"matcher": "Write|Edit"` 或 `"matcher": "*"` 或 `SessionStart` 是字符串
- `bash <kit-path>/tests/e2e-acceptance-validate.sh` 在你的项目里报 FAIL

#### 升级步骤

**Step 1: 拉取最新 kit 代码**

```bash
cd ~/path/to/your/simple-harness-kit
git fetch origin
git checkout master
git pull origin master
git describe --tags  # 应当看到 v0.7.0
```

**Step 2: 删除损坏的 settings.json 和受影响的 hook 脚本**

```bash
cd <受影响的项目根目录>
rm -f .claude/settings.json
# Hook 脚本也要重新生成 (旧版可能也是凭记忆生成的 stub)
rm -rf scripts/hooks/
```

**Step 3: 重新跑 /harness-init**

在 Claude Code 里输入：

```
/harness-init
```

新版 SKILL.md 会强制 Claude 先 Read templates/settings-json.tmpl / init-prompt.md / required-wiring.json 三个真实源，再派生产物。完成后会自动跑 `e2e-acceptance-validate.sh`。

**Step 4: 验证修复生效**

```bash
cd <项目根目录>
bash ~/path/to/simple-harness-kit/tests/e2e-acceptance-validate.sh
# 期望: PASS xx / xx, FAIL 0 / xx, 退出码 0
```

然后新开一个 Claude Code session，确认：
- 不再报 `Invalid key in record`
- SessionStart hook 输出 `HARNESS MODE ACTIVE` banner
- 6 阶段 Loop 可以正常进入

#### 如果升级后还有问题

- 检查 `.claude/settings.json` 的内容是否符合 `templates/settings-json.tmpl` 的格式（用 `diff` 对比）
- 检查 `scripts/hooks/` 下是否包含所有必选 hook，**特别是 `find-root.js`**（hook 之间的共享依赖，漏复制会导致 `Cannot find module './find-root'`）
- 跑 `bash tests/e2e-acceptance-validate.sh` 看具体哪个 section FAIL
- 如以上仍无法解决，开 issue 附 validate.sh 完整输出

#### 防退化保证

新加 4 个层次的可执行守门，未来不会再退化到这个失效模式：

1. `tests/template-integrity.js` 新增 T8 检查：SKILL.md 必须引用真实源、禁止内嵌 settings.json 代码块、禁止硬编码 hook 路径清单
2. `tests/e2e-acceptance-validate.sh` 新增 E2 section：检查所有 wired script 文件必须存在
3. `docs/constraints.md` (使用方工作区) 新约束 C-INIT-04：Skill 不得复述工程真实源；C-GATE-06：E2E 验收必须覆盖双入口（init-prompt.md 直接 + /harness-init slash command）
4. Sub-agent BEFORE/AFTER 量化对照实验作为修复证据：BEFORE 21/57 PASS → AFTER 64/64 PASS

### Added

- **SessionEnd hook (#26)** — 新增 `scripts/hooks/session-end.js`。session 结束时立即归档 `.harness/observations.jsonl` 到 `.harness/observations.archive/observations-<sid8>-<ts>.jsonl`（不等 10MB 阈值），写 session 结束标记到 session-log。HARNESS_LOG=off 完全跳过。observability-only 不阻塞退出。自动触发 harness-learn 放弃（避免阻塞），留给 manual/periodic 模式 (761c5e5)
- **E2E validate.sh E2 section (#34)** — `tests/e2e-acceptance-validate.sh` 新增 E2 检查 "wired script 文件必须存在"：从 required-wiring.json 派生脚本集合，扫 `scripts/hooks/` / `.claude/hooks/` / `hooks/` 三个候选目录。反 VH-08 同类回归（settings 已注册但脚本未复制）(761c5e5)
- **Template integrity T8 (#34)** — `tests/template-integrity.js` 新增 T8 守门 "skill: harness-init/SKILL.md 强制读真实源 + 不复述清单"：检查 SKILL.md 引用 init-prompt.md / settings-json.tmpl / required-wiring.json，禁止凭记忆字面，禁止内嵌 settings.json JSON 代码块和硬编码 hook 清单。实测能 catch 旧版本 SKILL.md (761c5e5)
- **tests/run.js 扩展 `expect.dirs` (#26)** — 支持正则目录文件名匹配 + minCount + contains，用于断言 archive 文件创建/命名/内容 (761c5e5)
- **Post-mortem: skill-entry-blindspot (#34)** — 新增 [docs/decisions/2026-04-08-skill-entry-blindspot.md](docs/decisions/2026-04-08-skill-entry-blindspot.md)。VH-08 根因复盘：4 个失效模式叠加（skill 不读真实源 / 多源副本漂移 / E2E 入口盲区 / 长期未 review），含 BEFORE/AFTER sub-agent 量化实验（BEFORE 21/57 PASS → AFTER 64/64 PASS）(761c5e5)
- **Hook 版本号机制** — 13 个 Hook 脚本头部注释加 `@version` 字段，update.sh 增强版本比对 + `--dry-run` 模式 (66e5fcf)
- **TaskUpdate matcher** — stage-guard 监听 TaskUpdate 工具调用，EXECUTE/VERIFY 阶段标记 completed 时提醒检查验证证据；first-call guard 跳过 TASK_TOOLS (66e5fcf)
- **WebFetch / WebSearch 覆盖** — stage-guard READ_TOOLS 数组扩展，PLAN 阶段放行并注入 directive；模板和本地配置同步 (1c1a09d)
- **PostToolUseFailure 事件支持** — session-logger 监听失败工具调用，写入 [失败] 标记到 session-log，observations.jsonl 增加 status 和 error 字段；methodology/05-hook-enforcement.md Hook 类型表加入此事件 (1c1a09d)
- **StopFailure 事件支持 (#25)** — session-logger 监听 StopFailure，记录 API 错误结束（rate_limit / billing / server_error 等）到 session-log + observations，下次 session 知道上次怎么挂的 (b41deba)
- **TaskCompleted 事件迁移 (#24)** — 旧的 PreToolUse:TaskUpdate completed 提醒迁移到 TaskCompleted lifecycle event；harness-stage-guard.js 直接监听该事件 (5fd0fc1)
- **TASK_TOOLS 任意阶段放行** — TaskUpdate/TaskCreate/TaskList/TaskGet 在 PLAN 阶段不被阻止（流程管理操作无代码副作用）(1c1a09d)
- **stage-guard since 字段校验 (#20)** — 写 current-stage.json 的 since 字段必须是真实 ISO8601 时间，± 5 分钟以内。防止 AI 手写假时间戳导致 verification-gate 假阳 (a5d722e)
- **e2e-acceptance-validate.sh (#21)** — 新增端到端验收可执行守门，从 required-wiring.json 派生事件/matcher/script 集合做静态 + 实弹检查 (fd000cf)
- **template-integrity.js (#23)** — kit 仓库级模板注册完整性自动化测试，防止模板层漂移 (710c4cc)
- **Hook 覆盖矩阵文档** — 新增 [methodology/15-hook-coverage-matrix.md](methodology/15-hook-coverage-matrix.md)，记录工具/事件的 Hook 覆盖决策、intent vs registered 状态、新增工具决策流程、一致性检查清单 (4de0240)
- **Lifecycle events 评估报告** — 新增 [docs/decisions/2026-04-07-lifecycle-events-evaluation.md](docs/decisions/2026-04-07-lifecycle-events-evaluation.md)，评估 9 项 lifecycle events / 能力，决策 P0/P1/P2/P3 优先级 (0e31062)
- **commit/push 阶段策略文档化** — methodology/12-commit-standards.md 新增 'Commit / Push 阶段规则' 章节；stage-guard REVIEW directive 增加 push 提醒 (b63407c)
- **CHANGELOG.md 和 release 流程** — 新增本文件 + [docs/release-process.md](docs/release-process.md) (84acf7a)

### Changed

- **skills/harness-init/SKILL.md 彻底重写 (#34)** — 134 行变 92 行。删除硬编码的文件树、必选清单、完整性 checklist。新增强制"生成原则"段，要求 AI 必须先 Read `templates/settings-json.tmpl` / `init-prompt.md` / `required-wiring.json` 作为真实源，禁止凭记忆生成 `.claude/settings.json` 和 hook 脚本。Step 3 下方新增"两种生成策略"对比段，建议默认从 required-wiring.json 派生最小集（避免 AI 漏删 optional hooks）。反 VH-08 根因修复 (761c5e5)
- **init-prompt.md 清理陈旧表述 (#34)** — (1) "必选 4 个"改为指向 required-wiring.json 真实源；(2) 必选组件表加入 `session-end.js` 和 `find-root.js`（hook 共享依赖，漏复制会导致 MODULE_NOT_FOUND）(761c5e5)
- **SessionEnd wiring 加入 templates/settings-json.tmpl + required-wiring.json + .claude/settings.json (#26)** — 19 个 wiring (从 18 扩到 19) (761c5e5)
- **methodology/05-hook-enforcement.md + 15-hook-coverage-matrix.md 同步 SessionEnd (#26)** — 矩阵从"gap"改为"已覆盖"，添加 Hook 类型表 session-end 行 (761c5e5)
- **tests/scenarios/01-setup-completeness.md 去除硬编码事件清单 (#34)** — 手工"PreToolUse+PostToolUse+PostToolUseFailure"清单改为"运行 validate.sh"引用；显式加入"不要再硬编码副本"禁令。反 VH-08 同类回归 (761c5e5)
- **scripts/hooks/ 为唯一源** — 删除 templates/hooks/（11 个陈旧副本），update.sh 改从 scripts/hooks/ 取源 (66e5fcf)
- **constraints.md 种子扩充** — kit 默认 constraints 从 2 个 JC 组扩到 6 个组 (66e5fcf)
- **methodology/05-hook-enforcement.md 精简 settings.json 示例** — 完整 settings.json 示例替换为指向模板的精简版（避免三份竞争性真实源）；多处行为描述对齐实际代码 (4de0240)
- **harness-stage-guard.js 头部注释** — 重写为完整的 10 条机制说明，覆盖所有 exit 0 / exit 2 路径 (4de0240)

### Fixed

- **P0: VH-08 /harness-init skill 生成错误 settings.json (#34)** — 用户用 `/harness-init` 初始化后新 session 报 `Invalid key in record`。根因：旧 SKILL.md 不要求 AI 读 templates/settings-json.tmpl，AI 默认凭训练记忆拼 JSON，产生 3 个 schema 错误（SessionStart 是字符串不是数组 / command 平铺无 hooks 包装 / matcher 用 regex 或 `*`）。修复：重写 SKILL.md 强制读真实源 + T8 守门 + E2 wired-script 检查 + 双入口 E2E（C-GATE-06）。BEFORE/AFTER sub-agent 实验量化基线：21/57 → 64/64 PASS。详见上方 Migration Notes 段 (761c5e5)
- **P0: templates/settings-json.tmpl 缺少 SessionStart 和 Stop 顶层事件** — 用此模板 init 的项目会丢失 harness-session-start.js 和 delivery-gate.js 触发；本次补齐 (4de0240)
- **update.sh --dry-run 不影响 Skills 复制** — Skills 复制现在受 DRY_RUN 控制 (66e5fcf)
- **update.sh 不安装新增 Hook 文件** — 写循环改为目标不存在时也复制 (66e5fcf)
- **TaskUpdate matcher 未同步到模板** — templates/settings-json.tmpl 和 init-prompt.md 补齐 (66e5fcf)
- **session-logger 不区分成功/失败** — PostToolUseFailure 调用现在在 session-log 加 [失败] 标记，observations.jsonl 加 status='failure' + error 字段 (1c1a09d)
- **methodology/05-hook-enforcement.md 多处文档漂移** — 移除"Read/Grep/Glob 永远放行"等过时表述；REVIEW gate 文案对齐实际代码（只检查 EXECUTE/VERIFY，不检查 PLAN）(4de0240)

### Notes

- 经过多轮 Codex 交叉验收（每个变更 2-5 轮）确保实现与文档一致
- 5 个 commit 的端到端验收发现 P0 模板缺陷，证明矩阵审计的价值
- 13 个 hook `@version` 全部统一 bump 到 0.7.0 (释放本 release)
- VH-08 修复同时引入 4 条新约束（C-INIT-04 / C-GATE-06 / C-GATE-05a 在使用方 ths-harness 工作区，VH-08 在 history）—— 这些是工作区本地配置，不在 kit 仓库内

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
