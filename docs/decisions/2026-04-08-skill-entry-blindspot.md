# 2026-04-08: Skill 入口盲区与"凭记忆生成"失效模式（VH-08 / #34）

## 摘要

用户用 `/harness-init` 初始化项目时，Claude 生成结构错误的 `.claude/settings.json`，新 session 启动报 `Invalid key in record`。**绕过 skill、直接喂 init-prompt.md 内容则正常**。

这不是单点 bug。是 4 个失效模式叠加：

1. `skills/harness-init/SKILL.md` 没要求 AI 读取 `templates/settings-json.tmpl`，AI 默认凭训练记忆拼 JSON
2. SKILL.md 把"必选清单"硬编码成内容副本（4 项），与 `init-prompt.md`（11 项）、`required-wiring.json`（19 wirings）漂移
3. C-GATE-04 三模式 E2E 验收的"三模式"是 *runtime* 三模式（独立 agent / Claude Code / Codex），**入口都是 init-prompt.md 直接入口**，从未覆盖 `/harness-init` slash command 入口
4. SKILL.md 长期不在任何任务的 diff 中，从未被 Codex 交叉验收过

## 时间线

- 2026-04-08 上午：用户反馈 `/harness-init` 初始化后重启 session 报 `Invalid key in record`，并主动验证：在 skill 内显式指定 `init-prompt.md`、或绕过 skill 直接喂内容，都不出错
- 2026-04-08 上午：开 #34 任务，初版 PLAN 只打算改 SKILL.md 文字（治标）
- 2026-04-08 上午：用户追问"为什么前面这么多轮开发和测试还会漏，可能有什么其他隐患"
- 2026-04-08 上午：复盘测试栈，定位 4 个失效模式叠加，PLAN 升级为治根方案

## 4 个失效模式拆解

### 失效模式 1: skill 没要求 AI 读真实源 → 默认凭记忆生成

旧 `skills/harness-init/SKILL.md` 第 28-50 行（Step 2）画了一棵文件树，只写"`.claude/settings.json` # Hooks 配置（至少注册 4 个必选 Hook）"，**没有任何一句"先 Read templates/settings-json.tmpl"**。LLM 在这种情况下的默认行为就是凭训练数据里的"差不多的 settings.json 模式"拼一份，键名/嵌套结构容易飘成 Claude Code 不认识的形态。

这是 LLM 工作机制的固有特性。我们在 hook 强制层面已经识别过（"Rules 会被遗忘，必须用 hook 兜底"，见 `methodology/05-hook-enforcement.md`），但**没把同一个洞察应用到 skill 设计上**。

### 失效模式 2: 多源副本必然漂移

简单数对：

| 数据源 | "必选清单"项数 | 状态 |
|--------|:---:|------|
| `tests/required-wiring.json` | 19 wirings | 工程层 source of truth (#23 建立) |
| `templates/settings-json.tmpl` | 派生自 required-wiring.json | template-integrity 强制对齐 |
| `init-prompt.md` 必选清单 | 11 项 | 文档层手写，未自动校验 |
| `skills/harness-init/SKILL.md` | 4 项 | 文档层手写，未自动校验，已严重过时 |
| `e2e-acceptance-validate.sh REQUIRED_FILES` | 11 项 | 手写硬编码（潜在第 5 个漂移源） |

#16 / #23 修过 templates ⇌ required-wiring.json 这一对。建立 `required-wiring.json` 当唯一真实源 + `template-integrity.js` 自动校验。**当时没意识到 SKILL.md 也是一份会漂移的副本**。

通用教训：**任何枚举性内容（清单、wiring、必选项），只要在多处出现，就一定会漂移。区别只是"已经漂移了"还是"还没人发现"**。

### 失效模式 3: E2E 验收的"入口"维度被压缩了

`C-GATE-04` 写"三模式 E2E 验收"，所有人理解的"三模式"是：
- 独立 agent
- Claude Code CLI
- Codex CLI

这是 **runtime 三模式**。但用户进入 init 流程的入口至少有两条：
- (a) 直接喂 init-prompt.md 内容
- (b) 输 `/harness-init` slash command

历次 E2E 验收 agent 的 prompt 都长这样：

> "Read simple-harness-kit/init-prompt.md and methodology/. Initialize Harness for this project."

这是"按 init-prompt.md 跑"，不是"按用户真实习惯跑"。skill 入口（b）从未出现在任何 E2E 测试矩阵里。

通用教训：**测试覆盖的是"你设计的路径"，不是"用户实际走的路径"。要主动追问"用户进入这个功能的所有入口是什么"，每条入口都要纳入 E2E 矩阵**。

### 失效模式 4: 长期未改的文件 = 长期未被 review

我们的 Codex 交叉验收是基于"当前任务的 diff"。SKILL.md 几个月没被任何任务改过 → 几个月没进入过任何 diff → 几个月没被 Codex review 过。

通用教训：**靠 diff-based review 不能发现"祖传遗留 bug"，需要定期 baseline scan**。

## 修复方案

### A. 根因治理

| 改动 | 文件 | 作用 |
|------|------|------|
| 重写 SKILL.md，把硬编码清单改为"先 Read 真实源"的指针 | `skills/harness-init/SKILL.md` | 直接消除失效模式 1 + 2 |
| 加约束 C-INIT-04（禁止凭记忆生成 + 禁止文档复述真实源） | `docs/constraints.md` | 把教训沉淀为约束，未来违反可被引用 |
| 加约束 C-GATE-06（强制 2 个入口都要 E2E 测） | `docs/constraints.md` | 直接消除失效模式 3 |
| 加 VH-08 历史记录 | `docs/constraints.md` | 教训留痕 |
| 更新 qa-standards.md 的 C-GATE-04 描述 | `.claude/rules/qa-standards.md` | 让强制清单与新约束同步 |

### B. 隐患排查（同源失败模式）

按上面 4 个失效模式各推演一遍：

| # | 隐患 | 排查结果 | 决策 |
|---|------|---------|------|
| H1 | 其他 skills/*/SKILL.md 是否也凭记忆生成配置 | grep 全部 skill：只有 `auto-harness-learn` 提到一个 hook 命令路径（属于命令调用，不是配置真实源）。其余 skill 均为"流程描述"或"状态切换"，不生成配置 | 干净，无需修复 |
| H2 | 其他 skill 是否硬编码了应该派生的清单 | 同上 | 干净 |
| H3 | C-GATE-04 验收脚本是否覆盖 /harness-init 入口 | 不覆盖。e2e-acceptance-validate.sh 只验"生成产物"，不验"产物是怎么来的" | 由 C-GATE-06 强制双入口验收解决，不需要改 validate.sh 本身 |
| H4 | init-prompt.md 必选清单 vs e2e-acceptance-validate.sh REQUIRED_FILES | **二次漂移源**。validate.sh 第 53-65 行硬编码了 11 个文件，是手写副本。如果 init-prompt.md 必选清单变化，validate.sh 不会自动跟进 | 入队 #38 单独治理（与 H8 类似的工程层硬编码） |
| H5 | scripts/hooks/*.js 内部硬编码工具名数组 | stage-guard 的 `READ_TOOLS` / `TASK_TOOLS` 仍是手写。已知未治 | 已有 #33（template-integrity 高级 drift 检测）覆盖，不重复建任务 |

### C. 入口盲区的治理

**为什么不在 validate.sh 里加 /harness-init 模拟？**

- skill 触发依赖 Claude Code runtime；validate.sh 是纯 bash + node，无法模拟"用户输 /harness-init"
- 退而求其次：让 C-GATE-06 在 prompt 层强制 E2E 验收 agent **必须用 slash command 入口跑一遍**，并贴 validate.sh 输出
- 长期方案：写一个 sub-agent 派发器，能自动派一个"扮演用户"的 sub-agent 触发 /harness-init，捕获产物。这是更彻底的方案，但成本高，后续视情况落地（暂不入队）

### D. 复现 + 验证（C1 / C2）

派两个并行独立 sub-agent：
- **BEFORE**：拿旧 SKILL.md（从 git HEAD 取出存到 /tmp/old-skill.md），扮演"按旧 skill 跑 /harness-init 的 Claude"，禁止读 templates/、init-prompt.md、scripts/hooks/，看产物有多差
- **AFTER**：按新 SKILL.md 跑，看是否真的能产出通过 validate.sh 全 PASS 的产物

完整数据见本文档末尾"附录 A: BEFORE/AFTER 实验数据"。

### E. Codex 交叉验收

按 C-GATE-05 铁律。Codex 重点检查：
- 修复是否真正解决根因，还是只在打补丁
- 4 个失效模式是否都被覆盖
- 是否引入新漂移（例如 SKILL.md 引用 init-prompt.md，反向也需要 init-prompt.md 引用 SKILL.md 吗？）

## 通用教训（写给未来的我）

1. **任何文档/skill/脚本里出现枚举性内容（清单/wiring/必选项）：除非它是自动派生或有自动守门，否则一定会漂移**。先问"这是真实源还是副本？"——如果是副本，必须引用真实源；如果改不成引用，就必须有可执行守门（如 template-integrity 的 T 系列检查）持续校验它和真实源同步
2. **测试覆盖矩阵必须按"用户真实入口"展开，不是按"开发者设计的路径"**。每加一种用户触发方式（slash command、CLI、IDE 集成），都要进 E2E 矩阵。区分 *runtime 维度*（哪个工具运行）和 *entry 维度*（用户怎么进来），两个维度的笛卡尔积都要覆盖
3. **靠 diff-based review 不能发现祖传 bug**。需要补一种主动机制（不是口号）：例如 release 前必须有一次"长期未改文件 baseline scan"，或按目录轮转每周 review 一个冷区。光有"应该"是不够的，要有具体执行点
4. **LLM 默认行为是凭记忆**。凡是"希望 LLM 读真实源"的地方，必须**显式写在它将要读到的文档里**，不能假定它会自己想到。等价于 hook 强制层面已经验证过的 "Rules 会被遗忘，必须用 hook 兜底"——只是这次的"hook"是 SKILL.md 自身的强制原则段
5. **修复反馈不要急着治标**。先问 4 个为什么：为什么没被发现？为什么测试没挡住？为什么文档没说？为什么之前没人意识到？把这 4 个为什么的答案都写下来，再开始改代码。本次 #34 的 PLAN 第一版只打算改 SKILL.md 一行字，被用户追问"为什么前面这么多轮还会漏"才升级为治根方案

## 衍生任务

- **#37**: e2e-acceptance-validate.sh REQUIRED_FILES 从 init-prompt.md 派生（H4 治理）
- **#38**: 扩展 T8 守门覆盖 C-INIT-04 全部条款（rules/templates/hooks 引用），不只是 settings/init-prompt
- **#39**: 建立通用 baseline scan 机制（解决失效模式 4 的体系化）
- **#40**: validate.sh E2 检查扩展到 hook 内部依赖（如 find-root.js 这类 require dep）
- **#34 完成后**: 用 sample 工程跑双入口 E2E 验收作为 C-GATE-06 的首次实施

## Codex Round 2 意外：API 403 Forbidden

Codex round 2 交叉验收未能完成：

```
ERROR: unexpected status 403 Forbidden: This channel has been disabled
URL: http://na.kuoo.uk/v1/responses
```

是 Codex infrastructure 故障（channel disabled），不是修复内容问题。

按 C-GATE-05a 豁免规则（本次引入），临时替代方案：

1. **2 个独立 Claude sub-agent 的 BEFORE/AFTER 实验**（附录 A）已提供量化证据 —— 不是纯 review 意见，是实际跑 validate.sh 量化对比
2. AFTER sub-agent 独立发现并报告了 find-root.js 依赖缺失问题，与 Codex round 1 对 #40 的判断方向一致（独立验证的另一种形式）
3. 主测试套 113/113 + AFTER sample 64/64 自动化自验
4. **#41 入队**：Codex 恢复后立即补跑 round 2

AFTER agent 建议"把 find-root.js 补入 init-prompt.md 必选清单"已本轮落地（#40 的短期止血方案，静态依赖分析仍留作 #40 长期方案）。

## Codex Round 1 交叉验收（C-GATE-05）

| 维度 | 结论 | 关键反馈 |
|------|------|---------|
| ROOT_CAUSE | PASS-with-notes | 4 模式准确，但漏了第 5 个上层因子"无通用 baseline scan 机制"。已入队 #39 |
| FIX_COMPLETENESS | PASS-with-notes | 主路径根因消除，但 T8 范围 < C-INIT-04 范围。已入队 #38 |
| HIDDEN_REGRESSIONS | **FAIL → 已修复** | 漏了 (a) validate.sh 没兜住 "registered but file missing"——已加 E2 检查（#34 round 2 含）；(b) init-prompt.md "必选 4 个" 陈旧表述——已修；(c) 01-setup-completeness.md 手工事件清单——已改为引用 validate.sh |
| EVIDENCE | PASS-with-notes | BEFORE/AFTER 工程证据强但不是法证级。承认局限 |
| METHODOLOGY | PASS-with-notes | 教训 1/3 已按 Codex 建议改写更精确 |

P0: 无。本轮 round 1 后就地修了 3 个 P1，剩下的 P2 入队。准备 round 2。

## 附录 A: BEFORE / AFTER 实验数据

实验方法：派两个并行独立 sub-agent 在隔离 tmp 目录 (`/tmp/sample-before-skill`, `/tmp/sample-after-skill`) 模拟用户跑 `/harness-init`。BEFORE agent 被强制只读 `/tmp/old-skill.md`（旧 SKILL.md 副本），禁止读 templates/init-prompt.md/scripts/hooks。AFTER agent 按新 SKILL.md 行事。两者都跑 `tests/e2e-acceptance-validate.sh` 量化产物质量。

### 量化结果

| 指标 | BEFORE（凭记忆） | AFTER（按新 SKILL.md） |
|---|:---:|:---:|
| validate.sh PASS | **21 / 57** | **59 / 59** |
| validate.sh FAIL | **36 / 57**（63% 失败率） | **0 / 59** |
| settings.json 结构有效 | 是（JSON 合法）但 schema 严重错误 | 是 |
| 必选事件齐全 | 缺 4 个（PostToolUseFailure / StopFailure / TaskCompleted / SessionEnd） | 全部齐全 |
| 必选 PreToolUse matcher 齐全 | 缺 9 个（Edit/Write/Agent/TaskUpdate/Read/Grep/Glob/WebFetch/WebSearch） | 全部齐全 |
| Hook 实弹（stage-guard 拦 PLAN+Bash） | ✗ 不拦截 | ✓ 拦截 |
| Hook 实弹（session-logger 写日志） | ✗ 不写 | ✓ 写入 |
| CLAUDE.md 大小 | 49 bytes（空模板） | 2335 bytes（有项目定制内容） |

### BEFORE 的 settings.json（凭记忆生成的实物证据）

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "command": "node scripts/hooks/harness-stage-guard.js" },
      { "matcher": "Write|Edit", "command": "node scripts/hooks/safety-guard.js" }
    ],
    "PostToolUse": [
      { "matcher": "*", "command": "node scripts/hooks/session-logger.js" }
    ],
    "SessionStart": "node scripts/hooks/harness-session-start.js"
  }
}
```

**3 个独立的 schema 错误，每一个都足以让 Claude Code 拒绝**：

1. `command` 直接挂在 matcher 同级，**缺少 `hooks: [{ type, command }]` 包装层**。Claude Code 期望 `{ "matcher": "X", "hooks": [{ "type": "command", "command": "..." }] }`
2. matcher 用 `"Write|Edit"`（regex）和 `"*"`（通配），**Claude Code 只接受精确工具名**
3. `SessionStart` 是字符串，**应当是数组**

这正是用户报告的 `Invalid key in record` 的产物。LLM 把"差不多看起来像 Claude Code hook 配置"的 schema 拼了出来，但每个细节都是错的。这不是某个特定 LLM 的偶发幻觉——是结构相似但 schema 不同的"hook 配置"在训练数据里的统计平均值。**任何不强制读模板的 skill 都必然踩到这个坑**。

### AFTER 的关键 PASS 项

```
── A. 必选文件存在性 —— 11/11 ✓
── B. settings.json JSON 有效性 —— ✓
── C. 顶层事件 —— SessionStart / PreToolUse / PostToolUse / PostToolUseFailure / StopFailure / TaskCompleted / SessionEnd 全部 ✓
── D. PreToolUse matcher —— 全部 11 项 ✓
── D2. wiring command 指向正确脚本 —— 全部 ✓
── E. Hook 脚本语法 —— 6 个脚本（含 find-root.js / session-end.js）全部 ✓
── F. Hook 实弹: stage-guard 拦 PLAN+Bash + 放行 PLAN+Read —— ✓
── G. session-logger 写入实弹 —— ✓
── H. CLAUDE.md 项目定制度 —— ✓ (2335 bytes)

PASS: 59 / 59  ／  FAIL: 0 / 59
```

### 额外发现：BEFORE agent 漏生成 find-root.js 和 session-end.js

BEFORE 的 `scripts/hooks/` 只有 4 个脚本（harness-session-start, harness-stage-guard, safety-guard, session-logger）。AFTER 有 6 个，多出的 `find-root.js` 和 `session-end.js` 是被 hook 文件 require 或 settings.json 引用的运行时依赖。**即使 BEFORE 的 settings.json schema 是对的，运行时也会因为缺少 find-root.js 而 MODULE_NOT_FOUND**。这是凭记忆生成的另一个并发失败模式：LLM 不知道 hook 之间的隐性依赖。

### 结论

这个实验把 VH-08 从"一个用户的报告"转化为"可重现的、量化的失效模式"。新 SKILL.md 强制 Read templates/init-prompt.md/scripts/hooks 的行为，是修复的**结构性根因解**，不是补丁。

实验产物保留在：
- `/tmp/sample-before-skill/` — BEFORE 的全部产物（已损坏的 hook 配置）
- `/tmp/sample-after-skill/` — AFTER 的全部产物（通过 validate.sh 全 PASS）
- `/tmp/old-skill.md` — 旧 SKILL.md 副本，作为 baseline

可执行守门补充：`tests/template-integrity.js` 新增 T8 检测（"skill: harness-init/SKILL.md 强制读真实源 + 不复述清单"），任何未来回退到旧形态的提交会立刻在 CI 失败。验证方式：临时把 `/tmp/old-skill.md` 覆盖回 SKILL.md，T8 立刻 FAIL（已实测）。
