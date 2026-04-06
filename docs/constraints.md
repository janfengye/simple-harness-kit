# Project Constraints

**SINGLE SOURCE OF TRUTH** — 所有规则的唯一权威来源。

## 约束区域

- `DOC` — 文档规范
- `HOOK` — Hook 脚本
- `SKILL` — Skill 定义
- `META` — 方法论自身的约束
- `TEST` — 测试相关
- `INIT` — 初始化流程
- `GATE` — 交付门控

---

## [JC-01: 文档质量]

| ID | 约束 | WHY | 违反后果 |
|---|---|---|---|
| C-DOC-01 | 场景实例只展示 Harness 相关步骤 | 用户不需要被教 npm init | 场景臃肿，信息噪声 |
| C-DOC-02 | AI 能自动扫出的信息不要求用户提供 | 减少用户负担 | 初始化指令过长 |
| C-DOC-03 | 方法论修改必须有实验依据或 Issue 支撑 | 防止凭空想象 | 方法论脱离实际 |

## [JC-02: 方法论一致性]

| ID | 约束 | WHY | 违反后果 |
|---|---|---|---|
| C-META-01 | 本项目自身必须使用 Harness（dogfooding） | 如果自己都不用，怎么说服别人 | 信任度为零 |
| C-META-02 | Hook 脚本修改后必须通过 node -c 语法检查 | JS Hook 语法错误会阻断所有工具调用 | 用户项目瘫痪 |
| C-META-03 | Hook 脚本修改后必须通过功能测试（node tests/run.js） | 语法正确不等于功能正确 | Hook 行为偏离预期 |

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
| C-HOOK-05 | Hook 脚本必须用项目根目录定位来解析 .harness/ 等相对路径，不依赖 process.cwd() | CWD 可能在子目录，导致路径错误 | Hook 报错或读错文件 |

## [JC-05: 交付 Gate 强制]

| ID | 约束 | WHY | 违反后果 |
|---|---|---|---|
| C-GATE-01 | 切换到 REVIEW 时必须检查：经过 PLAN->EXECUTE->VERIFY 且 VERIFY 有量化证据 | AI 会跳过验证直接宣称 READY | 质量不达标的变更交付 |
| C-GATE-02 | 功能性变更的 VERIFY 必须有真实场景验证记录 | mock 通过不代表真实生效 | 文档改了但流程没改善 |
| C-GATE-03 | 向用户交付结果前必须注入交付检查清单提醒 | 大部分交付不经过 open 命令 | 交付时没有复盘 |

## [JC-06: 初始化流程]

| ID | 约束 | WHY | 违反后果 |
|---|---|---|---|
| C-INIT-01 | init 必须生成 4 个基础设施 Hook: session-logger、harness-stage-guard、harness-session-start、safety-guard | 缺少任何一个都会导致流程失控或无记录 | Harness 残缺 |
| C-INIT-02 | init 文档必须显式标注必选组件和可选组件，不允许 AI 自行删减必选项 | AI 会以"轻量适配"为由跳过基础设施 | 用户项目 Harness 残缺 |
| C-INIT-03 | init 完成后必须输出组件完整性检查清单 | 当场发现缺失，不要等新 session 才暴露 | 用户不知道少了什么 |

---

## Violation History

> 记录格式：VH-{序号} | 日期 | 发生了什么 | 根因 | 对应约束
>
> 在此追加本项目的违规记录。

| ID | 日期 | 发生了什么 | 根因 | 对应约束 |
|---|---|---|---|---|
