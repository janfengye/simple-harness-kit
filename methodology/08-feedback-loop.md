# 反馈闭环：F1-F5

## 核心原则

> 先提炼规则，再派 Agent。不是反过来。

遇到问题时的本能反应是"赶紧修"。但"赶紧修"只解决一个实例，规则沉淀解决一类问题。

## F1-F5 流程

```
用户/测试/Review 发现问题
    ↓
F1: 记录原话 → 不解读，原样记录
    ↓
F2: 分类层级 → 确定修改位置
    ↓
F3: 提炼规则 → 从实例到规则（关键步骤）
    ↓
F4: 写入文件 → constraints.md（有 ID）
    ↓
F5: 派 Agent → 引用 ID，按规则修复
```

**F3 和 F4 不可跳过。** 这是方法论的核心纪律。

## F1: 记录原话

原样记录问题描述，不解读不简化不猜测。

```markdown
## 问题记录
- 来源：用户反馈 / Review 发现 / 测试失败
- 原话："登录页面在手机上按钮被截断了"
- 时间：2026-04-01
```

## F2: 分类问题层级

| 层级 | 典型问题 | 修改位置 |
|------|---------|---------|
| 规则层 | 系统性问题，多处出现 | docs/constraints.md |
| 工具层 | 工具 bug 或配置错误 | src/（通过 Agent） |
| 配置层 | 项目配置不当 | 配置文件 |
| 实例层 | 单点问题 | 具体文件 |

**判断方法：** 这个问题只出现在一个地方，还是可能出现在多个地方？
- 如果可能出现在多处 → 规则层（需要提炼通用规则）
- 如果只在一处 → 实例层（直接修复）

## F3: 提炼深层规则（关键步骤）

**不是**"把 X 改成 Y"。
**而是**"所有 X 类元素必须满足 Y 规范"。

```
❌ 实例描述：
  "登录按钮的 padding 改成 16px"

✅ 规则提炼：
  "所有可交互元素（按钮、链接、输入框）在移动端的
   最小触控区域为 44x44pt，padding ≥ 12px"
```

**提炼技巧：**
1. 问"还有哪些地方可能有同样问题？"
2. 把具体值抽象为规则（"16px" → "≥ 12px"）
3. 把具体对象抽象为类别（"登录按钮" → "所有可交互元素"）
4. 同类问题归一条规则，不要一个实例一条

## F4: 写入正确层级的文件（含 F4-sync 子步骤）

**F4 分为 3 个子步骤**，F4.3 是 2026-04-08 VH-09 后加入的 "dogfooding feedback loop 最后一公里" 强制同步步骤：

### F4.1: 写入本地

全局规则写入项目本地 `docs/constraints.md`，用 ID 编号：

```markdown
## C-UI-03: 移动端触控区域

所有可交互元素在移动端的最小触控区域为 44x44pt，padding ≥ 12px。

- WHY：小触控区域导致用户误触，移动端体验差
- 违反后果：UI 在移动端不可用
- 来源：VH-07（2026-04-01 用户反馈登录按钮被截断）
```

**先写规则，再派 Agent。** 规则是 single source of truth。

### F4.2: 判断约束 scope

新约束属于以下哪类？判断决定 F4.3 是否必须做。

| Scope | 前缀 | 处理 |
|---|---|---|
| **项目特定** | `C-UI-*` / `C-API-*` / `C-DATA-*` / `C-PERF-*` / `C-SEC-*` / `C-ARCH-*` / 等 | 只写项目本地 `docs/constraints.md` |
| **kit-level meta** | `C-DOC-*` / `C-META-*` / `C-HOOK-*` / `C-TEST-*` / `C-GATE-*` / `C-INIT-*` / `C-SKILL-*` | **F4.3 必须做**（kit 维护者场景） |

VH-* 历史记录按同样规则：kit-level 约束的违反记录必须同步，项目特定约束的违反记录只留本地。

### F4.3: 同步到 kit 产品仓库（C-META-04, VH-09 后强制）

**仅适用于 kit 维护者 workspace**。kit 使用者（不是 kit 开发者）不需要执行 F4.3 —— 如果你发现了 kit-level 约束应该改，走 `methodology/13-self-maintenance.md` 的 "用户提 Issue" 流程即可。

如果你是 kit 维护者（本仓库 = simple-harness-kit 的 dogfooding workspace），F4.2 判定为 kit-level 时**必须**在**同一 session 内**：

1. 把新 C-ID 写入 `simple-harness-kit/docs/constraints.md`（除了 workspace `docs/constraints.md` 之外，两份都要）
2. 如果涉及新 rule 文件（`.claude/rules/*.md`）→ 同步到 `simple-harness-kit/templates/rules/*.md.tmpl`
3. 跑 `node simple-harness-kit/tests/run.js`，确保 `T10 sync: workspace ↔ kit docs/constraints.md` 和 `T11 sync: workspace ↔ kit templates/rules` PASS
4. 在同一 commit 中包含两份文件的变更，防止 "打算下次同步" 的漂移

**反模式**：只写 workspace，想着"下次 release 统一同步" — 这**正是** VH-09 的根因，**禁止**。

### 为什么 F4.3 存在（VH-09 教训）

2026-04-08 session 中本项目产出了 6 条新 kit-level 约束（C-INIT-04 / C-GATE-04/05/05a/06 / C-HOOK-06）和 VH-01..VH-08，但**全部只写入 workspace**，kit 产品仓库的 `docs/constraints.md` 长期滞后。60+ 使用者上周开始用 v0.7.0，clone 仓库时拿到的 meta 约束是残缺的。

根因是方法论完整、工具不完整：F1-F5 只说"写入 docs/constraints.md"，没说"如果是 kit-level 约束必须同步到 kit 仓库"。`release-process.md` 也没在 Step 0 检查此同步。一次偶然 dogfooding 疏忽就导致长期漂移。

F4.3 + template-integrity T10/T11 + release-process Step 0 三个补丁共同闭合这个 gap。

### VH 记录更新

Violation History 不是一次写入就完事。修复后必须回来更新：
- 补充根因分析
- 标注修复状态（已修复 / 部分修复 / 未修复）
- 关联修复的 commit hash

> **实战经验（Experiment B）：** VH-01 记录了"3 个 E2E 失败，待分析"，但修复后根因已明确（远程 fetch 超时）却未回来更新。VH 记录的价值在于完整的"问题→根因→修复"闭环。

## F5: 派 Agent 按规则修复

Agent prompt 必须：
1. 引用 Constraint ID（如 `C-UI-03`）
2. 指向 constraints.md
3. 不包含具体实现代码（让 Agent 自己决定怎么实现）
4. 要求自验

```markdown
修复 C-UI-03 违规。

读取 docs/constraints.md 中 C-UI-03 的完整描述。
扫描所有 UI 组件，找出不符合 C-UI-03 的元素，全部修复。
修复后运行测试确认通过。
```

## Constraint ID 体系

### ID 格式

| 格式 | 用途 | 示例 |
|------|------|------|
| `C-{area}-{number}` | 单条约束 | C-UI-03, C-SEC-01 |
| `JC-{number}` | 联合约束组（组内必须同时成立） | JC-01 |
| `VH-{number}` | 违规历史记录 | VH-07 |

### 约束区域（area）

根据项目定制，常见的：
- `UI` — 界面相关
- `SEC` — 安全相关
- `PERF` — 性能相关
- `DATA` — 数据相关
- `API` — 接口相关
- `TEST` — 测试相关
- `ARCH` — 架构相关

### constraints.md 结构

```markdown
# Project Constraints

**SINGLE SOURCE OF TRUTH** — 所有规则的唯一权威来源。

## [JC-01: 组名]

| ID | 约束 | WHY | 违反后果 |
|---|---|---|---|
| C-XXX-01 | 约束描述 | 为什么 | 不遵守会怎样 |

## Violation History

| ID | 日期 | 发生了什么 | 根因 | 对应约束 |
|---|---|---|---|---|
| VH-01 | 2026-04-01 | 描述 | 根因 | C-XXX-NN |
```

## 反馈闭环的意义

```
问题 → F1-F5 → 规则 → Agent 修复 → 规则留存
                                         ↓
下次同类问题 → Agent 读规则 → 不会再犯
                                         ↓
Hook 检查 → 确保 Agent 引用规则
```

每次反馈都让系统变得更强。规则是积累的资产。
