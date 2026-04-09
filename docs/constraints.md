# Kit Constraints (simple-harness-kit 仓库级 meta 约束)

**SINGLE SOURCE OF TRUTH (kit 产品仓库)** — kit 方法论本身的约束。

## 这个文件是什么

本 constraints 是 **kit 维护者**（修改 methodology / templates / hooks / skills 的人）的约束清单，**不是**"新 init 项目应该遵守的约束"。新项目的 constraints 种子模板是 `templates/constraints.md.tmpl`（一个空的脚手架，由 init 流程拷贝后用户自行填充项目特定约束）。

### 与 workspace `ths-harness/docs/constraints.md` 的关系

本 kit 有一个 dogfooding workspace（`ths-harness`），它也维护一份 `docs/constraints.md`。这两份文件**必须保持同步**：

- workspace 是 dogfooding 发生的地方 —— F1-F5 产出新约束首先在那里
- kit 仓库是公共产品 —— 60+ 使用者 clone 这里
- **所有 kit-level meta 约束必须存在于两份之中**（workspace 为了本地 enforcement，kit 为了公共可见）

同步由 `tests/template-integrity.js` 的 T10 自动守门（见下方 C-META-04）。本文件的编辑**必须同时**更新 workspace `docs/constraints.md`，反之亦然。若任一方新增约束，另一方必须在同一 commit 同步更新。

### 与 templates/constraints.md.tmpl 的关系

`templates/constraints.md.tmpl` 是**新项目 init 时拿到的空脚手架**，不是本文件的 subset。它只提供 JC/C/VH ID 格式 + 区域列表 + 空表模板，让用户按项目需要自行填充。本文件的 kit-level meta 约束**不应**出现在 .tmpl 中（那些是 kit 维护者的约束，不是新项目的）。

## 约束 ID 格式

- `C-{area}-{number}` — 单条约束
- `JC-{number}` — 联合约束组（组内必须同时成立）
- `VH-{number}` — 违规历史

## 约束区域

- `DOC` — 文档规范
- `HOOK` — Hook 脚本
- `SKILL` — Skill 定义
- `META` — 方法论自身的约束（含 dogfooding sync）
- `TEST` — 测试相关
- `INIT` — 初始化流程
- `GATE` — 交付门控 + 端到端验收

---

## [JC-01: 文档质量]

| ID | 约束 | WHY | 违反后果 |
|---|---|---|---|
| C-DOC-01 | 场景实例只展示 Harness 相关步骤，不教用户做自己的事 | 用户不需要被教 npm init | 场景臃肿，信息噪声 |
| C-DOC-02 | AI 能自动扫出的信息（技术栈、构建命令等）不要求用户提供 | 减少用户负担 | 初始化指令过长 |
| C-DOC-03 | 方法论修改必须有实验依据（M1-M13 有对应实验）或 Issue 支撑 | 防止凭空想象 | 方法论脱离实际 |

## [JC-02: 方法论一致性]

| ID | 约束 | WHY | 违反后果 |
|---|---|---|---|
| C-META-01 | 本项目自身必须使用 Harness（dogfooding） | 如果自己都不用，怎么说服别人 | 信任度为零 |
| C-META-02 | Hook 脚本修改后必须通过 node -c 语法检查 | JS Hook 语法错误会阻断所有工具调用 | 用户项目瘫痪 |
| C-META-03 | Hook 脚本修改后必须通过功能测试（node tests/run.js） | 语法正确不等于功能正确 | Hook 行为偏离预期 |
| C-META-04 | kit-level 约束和 rules 必须在 workspace (ths-harness) 本地和 kit (simple-harness-kit) 仓库之间保持同步。F1-F5 的 F4 步骤有 sync 义务；release-process 的 Step 0 有 gate 检查；template-integrity 的 T10/T11 有工程层守门 | dogfooding feedback loop 的"最后一公里"必须闭环，否则 workspace 新学习不会进产品仓库，60+ 使用者拉不到 learning（VH-09） | kit 产品仓库长期与 workspace 漂移，新 init 项目拿不到最新 meta 约束；"VH-08 同类的副本漂移"问题持续出现 |

## [JC-03: 测试约束]

| ID | 约束 | WHY | 违反后果 |
|---|---|---|---|
| C-TEST-01 | Hook 功能变更必须先更新/新增测试场景（tests/hook-scenarios/） | TDD 纪律 | 回归风险 |
| C-TEST-02 | 功能性变更不能只用 mock 验证，必须在真实场景中跑过 | mock 通过不代表真实生效 | 上线后发现问题 |
| C-TEST-03 | 新 session 开始时验证 .harness/observations.jsonl 有新数据 | 确认 session-logger hook 生效 | 所有 hooks 可能未加载 |

## [JC-04: Hook 脚本规范]

| ID | 约束 | WHY | 违反后果 |
|---|---|---|---|
| C-HOOK-01 | Hook 执行时间 < 50ms | Hook 在每次工具调用时运行，慢了卡开发体验 | 用户关掉 hooks |
| C-HOOK-02 | Hook 不修改 Agent 输出（stdout 透传 stdin） | Hook 是守门人，不是干预者 | 行为不可预测 |
| C-HOOK-03 | Hook 不产生复杂副作用（轻量计数器/日志除外） | 保持确定性 | 调试困难 |
| C-HOOK-04 | 读操作工具（Read/Grep/Glob）永远不被 Hook 阻止 | 读操作无害，阻止会卡死探索流程 | 用户无法工作 |
| C-HOOK-05 | Hook 脚本必须用项目根目录定位来解析 .harness/ 等相对路径，不依赖 process.cwd() | CWD 可能在子目录（如 git 操作 cd 到子仓库），导致路径翻倍或找不到文件 | Hook 报 MODULE_NOT_FOUND 或读错文件 |
| C-HOOK-06 | 新增工具类型时必须评估是否需要 Hook 覆盖（stage-guard / session-logger 等），不能默认跳过 | TaskUpdate 等工具无 matcher，AI 可绕过阶段控制 | 阶段 Gate 形同虚设 |

## [JC-05: 交付 Gate 强制 + 端到端验收]

| ID | 约束 | WHY | 违反后果 |
|---|---|---|---|
| C-GATE-01 | 切换到 REVIEW 阶段时，stage-guard 必须检查：(a) 经过了 PLAN→EXECUTE→VERIFY 流程 (b) VERIFY 有量化证据文件 | AI 会跳过验证直接宣称 READY | 质量不达标的变更交付给用户 |
| C-GATE-02 | 功能性变更的 VERIFY 阶段，必须有真实场景验证记录，不能只有 mock/文件存在性检查。**涉及"用户任意 cwd / 任意 kit 位置"的功能**（install 脚本 / Skill 入口 / init 流程等）必须用**至少 3 个无父子关系的随机 tmp 目录**作为 `$HOME` / `$KIT` / `$CWD` 跑脚本化测试。**禁止**在 sub-agent 实验 prompt 里手工提供被测组件本应自己 locate 的资源路径（这会绕过被测组件）。参考 C-TEST-04/05/06 | mock 通过不代表真实生效（VH-05）；dogfooding 作者环境特殊性掩盖 cwd-rel bug（VH-10）；sub-agent 实验预置绝对路径产生假 PASS（VH-10） | 文档改了但 init 流程实际没改善 |
| C-GATE-03 | 向用户交付结果前，stage-guard 必须注入交付检查清单提醒（流程合规、QA 达标、需求完整、规则升级、改进机会） | delivery-review 只在 open 命令触发，大部分交付不经过 open | 交付时没有复盘 |
| C-GATE-04 | harness-kit 的结构性/功能性变更，验收必须用 sample 工程（Experiment A/B/C）做端到端验证：从干净分支执行 init → 开发 → 交付全流程，分别用独立 agent、Claude Code、Codex 三种模式跑，分析过程反馈 | 单元测试和局部真实场景不能覆盖 init 生成质量、Hook 运行时行为、跨阶段流转等端到端问题 | 改了模板但 init 流程实际坏了、改了 Hook 但运行时报错 |
| C-GATE-05 | 本项目所有任务的验收，除分级 QA 外，必须引入 Codex 交叉验收。铁律，无例外 | 单一工具验证存在盲区，跨模型交叉验收降低逃逸率 | 问题逃逸到用户手中 |
| C-GATE-05a | Codex 不可用（API 403 / 服务 down / token 耗尽等 infrastructure 原因）时的豁免规则：(1) 必须证明不可用是 infrastructure 而非内容问题（贴错误日志）；(2) 最低替代标准是"2 个独立 Claude sub-agent 交叉验证"，其中至少一个必须是实际产生产物并量化对比（不是纯 review 意见）；(3) 必须入队"待补 Codex round X"任务，Codex 恢复后立即补跑；(4) 仅适用于 infrastructure 层故障，AI 自身理由（如"时间紧"）不属于豁免范围 | 坚持铁律导致工作积压 vs 彻底放弃铁律导致盲区扩大，两害取其轻。sub-agent 实验已经验证比单纯的 review 意见给出更强证据 | 豁免门槛过低会让铁律空洞化 |
| C-GATE-06 | C-GATE-04 三模式 E2E 验收的"入口"必须至少覆盖 2 种：(a) 直接读 init-prompt.md 入口；(b) 通过 /harness-init slash command 触发 skill 入口。两种入口都要走完 validate.sh 全 PASS。三模式（独立 agent / Claude Code / Codex）针对每种入口都要跑一遍 | "三模式"是 runtime 三模式，不是 entry 三模式。历次 E2E 都只测 init-prompt.md 入口，从未测过 /harness-init skill 入口，导致 VH-08 长期未被发现 | skill 路径成为永久测试盲区，类似 bug 持续逃逸 |

## [JC-06: 初始化流程]

| ID | 约束 | WHY | 违反后果 |
|---|---|---|---|
| C-INIT-01 | init 必须生成 3 个基础设施 Hook: session-logger、harness-stage-guard、harness-session-start | 这三个是 Harness 运行时的基座，缺少任何一个都会导致流程失控或无记录 | session-log 无数据、新 session 不走 6 阶段 Loop、阶段可被绕过 |
| C-INIT-02 | init 文档必须显式标注必选组件和可选组件，不允许 AI 自行判断删减必选项 | AI 会以"轻量适配"为由跳过基础设施 | 用户项目 Harness 残缺，出问题后无法排查 |
| C-INIT-03 | init 完成后必须输出组件完整性检查清单，列出每个必选组件的存在状态 | 当场发现缺失，不要等新 session 才暴露 | 用户不知道少了什么，直到出问题 |
| C-INIT-04 | Skill / 文档不得复述工程真实源（required-wiring.json / templates/*.tmpl / scripts/hooks/*.js / init-prompt.md 必选清单）。任何要列必选清单/wiring/文件结构/json 配置的地方，必须以"先 Read 真实源"的指针形式引用，不得硬编码副本。settings.json 与 hook 脚本不得"凭记忆生成"，必须先读取对应模板/源文件后派生 | 多源副本必然漂移；LLM 默认行为是凭记忆拼 JSON，不强制读模板就一定出错（VH-08） | 用户走 skill 入口生成的产物结构错误，新 session 启动即报 Invalid key in record |

## [JC-07: Skill 路径解析 + 测试反假 PASS（VH-10）]

| ID | 约束 | WHY | 违反后果 |
|---|---|---|---|
| C-SKILL-01 | Skill 内所有操作性路径引用必须是**绝对路径**或 **skill-relative (`./resources/...` 相对 SKILL.md 本身)**，**禁止**使用 cwd-relative 形式（如 `simple-harness-kit/foo`）。kit 内部资源需要在 Skill 中引用时，必须先 bundle 到 `skills/<name>/resources/` 下再 skill-relative 引用，或在 SKILL.md 里定义 `$KIT_ROOT` 定位步骤后再用 `$KIT_ROOT/...` | Skill 安装后 AI 当前 cwd 不一定是 kit 父目录；60+ 用户把 kit 放在任意位置（D 盘 / `~/ops/` / 任意 clone 位置），cwd-relative 路径在真实用户环境下必然 Read tool "File does not exist" | Skill 入口功能直接坏掉，用户报 "无法找到 simple-harness-kit"（VH-10 问题 B） |
| C-SKILL-02 | Skill 中涉及"自动定位外部资源仓库"的逻辑，**禁止**在 cwd 或其祖先目录"自动搜索 + 静默信任"。必须满足: (a) 优先信任用户显式设置的环境变量 (如 `SIMPLE_HARNESS_KIT_ROOT`); (b) 定位到候选路径后**必须做结构完整性校验** (验证一组已知文件存在且非空, 例如 kit 的 `methodology/00-overview.md` / `templates/settings-json.tmpl` / `tests/required-wiring.json` / `scripts/hooks/*.js`); (c) 除非是环境变量指定, 所有自动定位结果**必须显式询问用户确认**后才使用. **禁止**假设"第一个找到的同名目录就是真的". | cwd 向上搜索 + 静默信任 = 经典 supply-chain 攻击面: 用户 `cd /tmp/untrusted-project` 工作, 恶意行为者在该位置种一个伪 kit, skill 自动使用伪 kit 的 hooks/templates/rules, 把恶意代码写入用户项目. (VH-10 Codex gpt-5.4 round 3 F3 发现) | 用户被诱导运行恶意 hook 脚本 / 恶意 rule 模板 / 恶意 validate.sh |
| C-TEST-04 | Sub-agent 实验 / 测试用 agent dispatch 时，**禁止**在 prompt 里手工提供被测组件"本应自己 locate 的资源"的绝对路径。测试 SKILL.md 路径解析能力时不能在 sub-agent prompt 里先说 "kit 在 /abs/path/to/kit"——这会绕过 SKILL.md 的路径解析机制，使实验结果变成"sub-agent 按我给的路径读文件"而不是"SKILL.md 的路径解析是否 work"。正确做法：模拟真实用户环境（随机 cwd、kit 在未知位置），让 sub-agent 完全按被测组件的指令 locate | VH-10 根因的 meta 失效：本 session 早期的 dogfooding 实验全部在 prompt 里提供了 kit 绝对路径，sub-agent 成功读到文件 ≠ SKILL.md 写得对 | 假 PASS 逃逸到 release，用户交付后报同类 bug |
| C-TEST-05 | 任何"AI 遵循 SKILL.md / rule / 模板文档"的功能测试，必须**同时**验证"真实 cwd 下路径能解析"（`[ -f "$cwd/<path>" ]` 或等价），不能只做"文档内容存在且格式对"的静态检查 | 静态内容检查告诉你文档里写了什么，不告诉你文档里写的路径在用户环境下能不能打开 | 文档层面 PASS 但运行时 FAIL，CI 绿灯交付后爆炸 |
| C-TEST-06 | 涉及"用户在任意目录"的功能（install 脚本、Skill 入口、init 流程等），脚本化测试必须使用**至少 3 个无父子关系的随机 tmp 目录**作为 `$HOME` / `$KIT` / `$CWD`，`cp -r` 真实拷贝 kit（不用 symlink），然后在 `$CWD` 下跑被测功能 | dogfooding workspace (ths-harness 有 simple-harness-kit 作为子目录) 是一个特殊 case，cwd-relative 路径在这里恰好能 work——这正是 bug 长期隐藏的原因。测试必须打破这个特殊环境 | 测试在作者机器上永远 PASS，用户机器上永远 FAIL |
| C-HOOK-07 | Shell 脚本中所有 `cp -r <src> <dst>` 当 `<dst>` 可能已存在时，必须使用幂等模式 `rm -rf "<dst>" && cp -r "<src>" "<dst>"`。直接 `cp -r` 在 dst 存在时 GNU/BSD 行为都是"把 src 作为 subdir 放进 dst"，产生嵌套 | 不幂等导致第二次 install/update 产生 `.claude/skills/harness-init/harness-init/` 嵌套（VH-10 问题 A） | 二次安装/更新损坏 skill 结构 |

---

## Violation History

| ID | 日期 | 发生了什么 | 根因 | 对应约束 |
|---|---|---|---|---|
| VH-01 | 2026-04-01 | 本项目全程未使用 Harness（无 rules、无 hooks、无 constraints） | 初始化时没有 dogfooding 意识 | C-META-01 |
| VH-02 | 2026-04-02 | 新 session 不遵守 Harness 流程，被外部 skill 覆盖 | Rule 级别不够，需要 Hook 强制 | C-META-01 |
| VH-03 | 2026-04-03 | safety-guard.js 误拦 --force-with-lease（合法操作） | 正则 /--force\b/ 匹配到了 --force-with-lease 中的 --force | C-HOOK-02, C-TEST-01 |
| VH-04 | 2026-04-03 | mind-palace 项目 init 跳过了 session-logger、stage-guard、session-start | init-prompt.md 未列出这 3 个 Hook，AI 以"轻量适配"为由删减 | C-INIT-01, C-INIT-02 |
| VH-05 | 2026-04-03 | init 流程修改后只做了文件存在性检查就宣称 READY，没有在真实项目跑 init | 无 Hook 强制 VERIFY 阶段必须有真实验证，完全靠 AI 自觉 | C-GATE-01, C-GATE-02 |
| VH-06 | 2026-04-03 | `claude skill install` 启动新进程触发 session-start，重置了当前 session 的 stage/tool-count，导致 deadlock | session-start 无条件重写状态文件，不区分是否有活跃 session | C-HOOK-03 |
| VH-07 | 2026-04-06 | #9 CWD 修复在 EXECUTE 阶段直接 TaskUpdate completed 跳过 VERIFY，向用户宣称交付 | TaskUpdate 不在 stage-guard matcher 覆盖范围，delivery-gate 只检测语言模式无法拦截 | C-HOOK-06, C-GATE-01 |
| VH-08 | 2026-04-08 | 用户用 /harness-init 初始化时 Claude 生成结构错误的 .claude/settings.json，重启 session 立即报 "Invalid key in record"。绕开 skill 直接喂 init-prompt.md 内容则正常 | 4 个并存的失效模式：(1) skills/harness-init/SKILL.md 没要求 AI 读取 templates/settings-json.tmpl，AI 凭记忆拼 JSON；(2) SKILL.md 把必选清单硬编码成副本，与 init-prompt.md 漂移（4 vs 11 项）；(3) C-GATE-04 三模式 E2E 入口只覆盖 init-prompt.md 直接入口，从未覆盖 /harness-init skill 入口；(4) Skill 文件长期不在任何任务的 diff 中，从未被 Codex 交叉验收过 | C-INIT-04, C-GATE-06 |
| VH-09 | 2026-04-08 | 本 session F1-F5 产出的 6 条 meta 约束（C-INIT-04 / C-HOOK-06 / C-GATE-04 / C-GATE-05 / C-GATE-05a / C-GATE-06）和 VH-01..VH-08 全部只写入 workspace `docs/constraints.md`，**未同步到 kit 产品仓库 `docs/constraints.md`**。v0.7.0 release 时也没有任何人/工具检查此同步，带着 gap 发布。60+ 使用者上周开始用 kit，clone 仓库拿到的 meta 约束残缺 | Dogfooding feedback loop 最后一公里彻底缺失：(1) `.claude/rules/feedback-workflow.md` F4 步骤只说"写入 docs/constraints.md"，没说"如果是 kit-level 必须同步到 kit 仓库对应文件"；(2) `docs/release-process.md` 7 步流程没有 Step 0 检查 workspace↔kit 同步；(3) `tests/template-integrity.js` 13 个 T 检查全守 kit 内部自洽，没一个守"workspace vs kit 仓库"的 constraints 副本；(4) VH-08 的 C-INIT-04 教训只覆盖"kit 内部副本"（templates ↔ required-wiring ↔ SKILL.md），没扩展到"workspace vs kit 仓库"这对副本；(5) 本 session 作者（Claude）早期把 "T1 同步 constraints" 定性为"纯文档同步 20 分钟"的治标思维，忽略了机制化治根 | C-META-04 |
| VH-10 | 2026-04-08 | v0.7.0 交付后用户连续反馈 2 个 P0 低级 bug：**问题 A** — `update.sh` / `install.sh` 第 63 行 `cp -r "$skill_dir" "$dst/$skill_name"` 在 dst 已存在时产生嵌套 `.claude/skills/harness-init/harness-init/`；**问题 B** — `skills/harness-init/SKILL.md` 硬编码 `simple-harness-kit/templates/settings-json.tmpl` 这类 cwd-relative 路径，60+ 用户 cwd 不是 kit 父目录（例如 kit 在 D 盘），AI 报"无法找到 simple-harness-kit"，skill 入口直接坏 | 五层失效叠加：(1) **Shell 幂等性盲区**：`cp -r` 在 dst 存在时的"嵌套"行为是 BSD/GNU 共有意料外行为，install.sh 从来没测过二次执行，测试体系只覆盖"从零状态"；(2) **Skill 路径解析盲区**：没有测试验证"skill 中写的路径在真实用户 cwd 下能不能解析"，只有静态文件存在性检查；(3) **dogfooding 环境假象**：ths-harness workspace 碰巧把 simple-harness-kit 作为子目录，cwd-relative 路径在作者机器上恰好能 work，完美掩盖 bug；(4) **sub-agent 实验假 PASS**：本 session 早期跑 dogfooding 实验时在 sub-agent prompt 里手工提供了 kit 绝对路径，sub-agent 据此成功读文件，实验"全 PASS" ≠ SKILL.md 写得对——这是 VH-05 "mock 通过不代表真实"在 sub-agent 层的重演；(5) **E2E 入口盲区延续**：VH-08 虽然登记了 C-GATE-06 要求 skill 入口也测 E2E，但测的是"三模式 runtime"不是"真实用户 cwd"，仍然在作者机器上跑，没打破 dogfooding 环境特殊性 | C-SKILL-01, C-TEST-04, C-TEST-05, C-TEST-06, C-HOOK-07 |
