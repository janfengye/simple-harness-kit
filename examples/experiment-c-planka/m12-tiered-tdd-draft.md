# M-12: 测试基础设施治理 + 强制补测试（ADR 草稿 v2）

**状态**: 🟢 DRAFT v2 + Codex review patches —— 已通过 Codex 交叉验收 (PASS-with-notes)，含 emergency hotfix override + blocker-class 标记
**日期**: 2026-04-08
**作者**: Claude Code (claude-opus-4-6) 基于 Experiment C Planka 实测 + 用户反馈方向修正
**关联任务**: #11 (实战 + baseline) + #10 (方法论落地)
**关联文件**:
- [m12-baseline.md](./m12-baseline.md) — Planka 实测基线
- [m12-pilot-test.md](./m12-pilot-test.md) — 第一个补上来的新测试（本轮 #11 产出）
- [report.md](./report.md) — Experiment C 主报告

## v2 与 v1 的方向修正（重要）

**v1 错误方向**: 把 "Planka 测试基础设施差 + 覆盖率低" 理解为 "允许不写测试"。Tier 0 的策略是 "不强制 TDD + 登记债"。Experiment C 被追认为合法。

**v1 为什么错**:
- 给烂 infra 找借口 = 方法论死灰
- "登记债"变成了"永远不还的债"
- Retroactive validation 送错信号：下次遇到 bad infra 的项目，AI 会再次绕过 TDD
- 本质上是把"不能做"偷换成"不应该做"

**v2 正确方向**（按用户反馈）:
- 测试基础设施差 **不是豁免理由**，而是 **必须优先治理的信号**
- 必须补测试（新 feature 必须带测试）+ 必须修 infra（让测试跑得起来才能补）
- Experiment C 的 "没写测试" 是 **反面教材**，M-12 要防止再次发生

**新定义**: M-12 不是"分级 TDD 策略"，而是 **"测试基础设施治理 + 强制补测试 playbook"**。

## 核心原则（铁律层）

1. **任何项目的新代码都必须带测试**。无例外。
2. **测试基础设施不可用，必须先修**。修完才能开始新 feature。不允许"先写 feature 再补测试"的妥协。
3. **debt 只能是 transient**（过渡态），不能变成 permanent。任何登记的 infra 债必须有明确的"修复前截止日期"或"在它修好之前禁止做什么"的硬约束。
4. **Experiment C 风格的"没补测试就交付"是失败**，未来的 6 阶段 Loop 不应该放行这种状态。

## 诊断维度：测试基础设施健康度

**不用覆盖率作为主判据**。覆盖率是结果，不是原因。主判据是 infra 健康度，按 6 个硬标准（H1-H6）打分。**注意：H1/H2/H4 是 blocker-class，单项 fail 即视为 Tier 0**（不能用平均分掩盖）。

| 硬标准 | 类型 | 判断 | Planka 治理前 | Planka 治理后 |
|---|:---:|---|:---:|:---:|
| **H1: 裸跑 `npm test` 无预设能跑**（新贡献者第一次就能跑） | **blocker** | yes / no | ❌ | ✅ |
| **H2: 测试 bootstrap 在 CI 合理时间内完成**（无硬编码 timeout bug） | **blocker** | yes / no | ❌ | ✅ |
| **H3: 测试代码无 dead / skipped**（无 `describe.skip`、无整文件注释） | normal | yes / no | ❌ | ✅ |
| **H4: 测试能独立于 runtime 跑**（源码不耦合 runtime 全局，或测试套能完整 bootstrap runtime） | **blocker** | yes / no | ❌ | ✅ |
| **H5: Coverage tool 存在且 CI 跑**（有动态覆盖率数据） | normal | yes / no | ❌ | ✅ |
| **H6: 测试确定性 / 无 flaky**（CI 重复跑应稳定 PASS, 无外部隐式依赖, hermetic） | normal | yes / no | ⚠️ 待评估（修复后未做多次 CI 重跑） | ⚠️ |

**Blocker-class 规则**: 即使总分 4/6 或 5/6，只要 H1 / H2 / H4 任一 fail，就是 Tier 0 BROKEN，不允许进入新 feature 工作。理由：blocker-class 直接决定"测试能否被执行 + 信号能否被信任"，无法被其他 H 项的得分掩盖。

**Planka 治理前**: 6 项全 ❌ → Tier 0 BROKEN
**Planka 治理后**: H1-H5 全 ✅，H6 待评估 → Tier 1 FRAGILE

## Infra Tier 重定义

按 infra 健康度（H1-H6 + blocker-class 优先级），**不是按覆盖率 %**：

| Infra Tier | 判定 | 含义 | Harness 准入规则 |
|---|---|---|---|
| **Tier 0: BROKEN** | 任一 blocker (H1/H2/H4) fail，或 ≤ 3/6 | Infra 有阻塞性 bug | **禁止开始新 feature**。必须先修 infra 到 Tier 1 才能进 EXECUTE 阶段。或者 explicitly 切到 M-12 修复任务。**唯一例外**：Sev0/security/regulatory hotfix 走 emergency override（见下文） |
| **Tier 1: FRAGILE** | 所有 blocker pass，4-5/6 | 能跑但不完整 | **新代码必须带测试**；H 项缺失的部分必须跟踪修复；允许 "一边补 infra 一边做 feature" |
| **Tier 2: SOLID** | 6 / 6 | 所有硬标准通过 | **常规 TDD**；可以完整跑 methodology/04-qa-pyramid 的 Layer 1-5 |
| **Tier 3: MATURE** | 6/6 + 覆盖率 CI 守门 + mutation testing | Tier 2 + 阈值 | **严格 TDD + mutation testing**（可选） |

**关键区别 vs v1**: 
- Infra Tier 不再是"允许什么"的维度，而是"当前状态 + 升级到下一层必须做什么"
- **所有 Tier 都强制新代码带测试**，Tier 0/1 只是"补测试之前必须先做哪些 infra 修复"
- Tier 0 = **阻塞新 feature**，不是 "放水允许不写测试"
- 命名: **"Infra Tier"** 而非 "Tier"，避免与 methodology 其他地方的 stage/role 概念冲突

## Emergency Hotfix Override（v2 + Codex review 加入）

Tier 0 项目通常禁止 EXECUTE 新 feature。**唯一例外**是必须走 emergency lane 的紧急修复：

### 触发条件（all 必须满足）

- **Sev0** 严重程度（生产 down / 数据丢失 / 大规模用户阻断）
- **Security** 漏洞需立即 patch（CVE 公开 / active exploit）
- **Regulatory** 强制（GDPR / 法律要求 N 天内修复）

### 走 emergency lane 必须做的事

1. **Incident tag**: commit message 必须含 `[emergency-hotfix]` + 引用具体 incident ID（用户工单 / 安全报告 / 法律通知）
2. **Minimal scope**: 改动只能修这一个 incident，**禁止顺手改其他**
3. **Mandatory manual verification**: 由 reviewer/director 在 staging 或 production 验证修复有效，记录到 commit message 或 ops log
4. **Hard deadline for follow-up**: hotfix 后 **N 天内**（建议 7 天）必须：
   - 补对应的 unit/integration test 覆盖修复路径
   - 完成 Tier 0 → Tier 1 升级（如果 hotfix 之前是 Tier 0）
   - 写 incident retrospective（含为什么 emergency 必须存在）
5. **审计登记**: 在 `docs/constraints.md` 的 violation history 区登记这次 emergency 例外

### 不算 emergency 的情况

- "用户着急想要" → no
- "deadline 临近" → no
- "看起来很简单的改动" → no
- "下个 release 才修就晚了" → no

emergency lane **不是** "免测试通道"，而是**例外承认 Tier 0 项目偶尔有必须立刻 ship 的情况**，并强制 follow-up。如果 emergency 频繁触发，说明 Tier 0 治理推不动，应该升级为 P0 task。

## 对 Planka 的具体应用

Planka 当前 Tier 0（H1-H5 全 fail）。按 M-12 v2：

### 立即行动（本轮 #11 要做的）

1. **修 H1**: 在 `server/package.json` 的 test script 里预设最小 env vars，或创建 `server/.env.test` + 测试自动加载
2. **修 H2**: `lifecycle.test.js` 的 `this.timeout(5000)` 改为 60000 或从 env 读
3. **修 H3**: `User.test.js` 恢复代码或删除。本轮先恢复，跑起来看是否真的能工作；若 runtime 问题无法短期解决，退而求其次删除文件（不留 dead code）
4. **修 H4**: `utils/remote-address.js` 显式 `require('lodash')`，不依赖 sails 注入
5. **修 H5**: 装 nyc 到 server，改 test script 为 `nyc mocha ...`，跑出 baseline coverage %

### 完成 H1-H5 后

- 写第一个新 controller 集成测试（本轮 #11 要做 pilot）
- 用这个新测试证明"整个 infra 链路现在可用"
- 写到 `m12-pilot-test.md` 作为 M-12 playbook 的 demo

### Experiment C 的重新定性

- Experiment C 做 feature #1485 时**没补测试** = 方法论违规
- 按 v2 规则：在 Tier 0 状态下不应该开始 feature，应该先修 infra
- 这不是 retroactive punish，是把它**作为反面案例**写入 m12 方法论：**"Tier 0 项目启动 feature 前必须先过 M-12 治理，否则交付的 feature 没有回归保障"**
- Experiment C 的 feature 代码仍然是有效的（UI 层的 smoke test 手动跑过），但它没建立可重复的回归保障 — 这是 methodological failure

## 对其他 methodology 文档的影响

### `methodology/04-qa-pyramid.md` 要改

- Layer 1 铁律保留 "NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST"
- 新增 pre-Layer 1 gate：**"基础设施必须 ≥ Tier 1 才能进 Layer 1"**
- 指向本文件

### `methodology/03-workflow.md` 要改

- EXECUTE 阶段 gate 加：**"target 项目是否 ≥ Tier 1？ 若否，EXECUTE 仅允许 infra 修复任务"**
- 这改变了 6 阶段 Loop 的准入：Tier 0 项目不能跑常规 feature Loop，只能跑 M-12 修复 Loop

### `init-prompt.md` 要改

- Init 时 AI 必须做 H1-H5 诊断并判定 Tier
- 生成的 `CLAUDE.md` 记录当前 Tier
- 生成的 `docs/constraints.md` 若 Tier 0 自动加 TECH_DEBT 区域 + 对应的 infra 修复任务

### `templates/rules/qa-standards.md.tmpl` 要改

- 加 pre-Layer 1 gate 描述
- 指向 methodology/12

### 新 constraint: C-INFRA-01

- "Tier 0 项目禁止开启新 feature EXECUTE 阶段，必须先通过 M-12 治理升级到 Tier 1"
- 这可能需要 stage-guard hook 加 Tier 检测（独立 hook 或扩展现有 stage-guard）

## Open Questions（v2 + Codex review 后的状态）

| # | 问题 | Codex review 给出的答案 | 状态 |
|---|---|---|:---:|
| 1 | Tier 判定在 init 时 vs 持续？ | **Init 时一次初始化 + 每次 EXECUTE gate 重算** | ✅ 解决 |
| 2 | 如何检测 infra tier 的自动化 hook？ | **H1/H2/H3/H5 可脚本化, H4 hybrid/manual, H6 hybrid（多次重跑统计）** | ✅ 解决 |
| 3 | Tier 0 "禁止新 feature" 是否太严？ | **正常情况是对的；唯一例外 = emergency hotfix override（已加专段）** | ✅ 解决 |
| 4 | Experiment C 的追溯处理 | **不算 acceptance-blocking；可作为 follow-up case study, 不必本轮处理** | ✅ 推迟 |
| 5 | "Tier" 与 methodology 其他 stage/role 语义冲突？ | **重命名为 "Infra Tier"** | ✅ 解决（已应用） |
| 6 | "Tier 0 阻止新 feature" 是否要做 hook 层强制？ | **rule 层先落地, hook enforcement 后续做（为 follow-up task）** | ✅ 推迟 |

**结论**: Codex round 1 给的 PASS-with-notes 已无 acceptance-blocking 项。两个 must-fix patches（hotfix override + blocker-class 标记）已应用。可以进入 #10 (写 methodology/) 阶段。

## 本轮 #11 的接续工作

本草稿锁定方向后，本 session 还要做：

1. 把 Planka 5 个 infra 故障全部修掉（H1-H5 都通过）
2. 写 **第一个新 controller 集成测试**（demonstration: tier 0 → tier 1 的升级演示）
3. 更新 [m12-baseline.md](./m12-baseline.md) 记录 "修复后" 的状态
4. 写 [m12-pilot-test.md](./m12-pilot-test.md) 作为 pilot 报告
5. 把 Planka 改动 commit 到 `harness-m12/infra-fixes` 本地分支，**不 push 到 upstream**

## 与 v1 草稿的 diff 总结

| 维度 | v1 | v2 |
|---|---|---|
| 核心论点 | "低 tier 允许跳过 TDD" | "任何 tier 都不允许跳过 TDD；tier 决定 infra 修复的优先级" |
| Tier 主判据 | 覆盖率 % + infra 混合 | infra 健康度 (H1-H5) |
| Tier 0 策略 | "不强制 TDD + 登记债" | "阻止新 feature + 强制修 infra" |
| Experiment C 定性 | Retroactive validation ✅ | 反面教材 ❌ |
| 对 Layer 1 铁律 | 条件化（Tier 0 可豁免） | 保留铁律，加 pre-Layer 1 gate |
| "允许跳测试" 的情况 | 有（Tier 0） | 没有 |

---

**下一步（用户 review 后）**:
- Review PASS → #10 把此 ADR 精简后写入 `methodology/12-tiered-tdd.md` 或 `methodology/12-infra-governance.md`（用户决定命名）
- Review FAIL → 根据反馈继续修改本草稿
- 并行：本 session 继续执行"修 5 个故障 + 写第一个新测试"的实战部分
