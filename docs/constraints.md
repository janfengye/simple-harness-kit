# Project Constraints

**SINGLE SOURCE OF TRUTH** — 所有规则的唯一权威来源。

## 约束区域

- `DOC` — 文档规范 / `HOOK` — Hook 脚本 / `SKILL` — Skill 定义
- `META` — 方法论自身的约束

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

---

## Violation History

| ID | 日期 | 发生了什么 | 根因 | 对应约束 |
|---|---|---|---|---|
| VH-01 | 2026-04-01 | 本项目全程未使用 Harness（无 .claude/rules、无 hooks、无 constraints） | 初始化时没有 dogfooding 意识 | C-META-01 |
