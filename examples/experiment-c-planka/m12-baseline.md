# M-12 Baseline: Planka 测试基础设施量化报告

**日期**: 2026-04-08
**关联任务**: #11 Planka 测试基础设施搭建（M-12 实战）
**关联报告**: [report.md](./report.md) (Experiment C 主报告)
**关联草稿**: [m12-tiered-tdd-draft.md](./m12-tiered-tdd-draft.md) (M-12 分级 TDD 草稿)

## 背景

Experiment C (2026-04-02) 做 Planka feature #1485 (board/list descriptions) 时发现: "项目本身几乎无测试，写测试的成本和价值不匹配"，产出 M-12 作为 TODO: **"方法论需要对'低测试覆盖项目'给出分级指导"**。

本次 (2026-04-08) 是 #11 任务的 baseline 量化，为 M-12 方法论草稿 ([m12-tiered-tdd-draft.md](./m12-tiered-tdd-draft.md)) 提供实证依据。

## 测试基础设施现状

### Server 端（Node.js / Sails.js / Mocha）

**源码规模**:

| 类别 | 文件数 | 备注 |
|---|:---:|---|
| `api/controllers/` | 106 | 100+ 端点 |
| `api/models/` | 32 | |
| `api/helpers/` | 173 | |
| `utils/` | 9 | |
| **总计** | **320** | |

**源码 LOC**: `server/api/*` 37,311 行

**测试现状（通过 find）**:

```
server/test/
├── lifecycle.test.js        (before/after hook, 不是真正的测试)
├── integration/
│   └── models/
│       └── User.test.js     (整个文件被注释掉！)
└── utils/
    └── remote-address.test.js (唯一真正的 test 文件)
```

**测试执行实测（2026-04-08 本次运行）**:

| 测试文件 | 行为 | Pass | Fail | 备注 |
|---|---|:---:|:---:|---|
| `lifecycle.test.js` | before: sails.lift() → **TIMEOUT (5s 硬编码)** | — | 1 (hook timeout) | 基础设施 broken，see 故障 1 |
| `integration/models/User.test.js` | 整个文件 commented out | 0 | 0 | 有效测试 = 0，see 故障 2 |
| `utils/remote-address.test.js` | 4 个 `it()` 断言 | 2 | 2 | Pass rate 50%，see 故障 3 |

**有效测试断言总数: 4（其中 2 个 pass, 2 个 fail）**

### Client 端（React / Jest）

**源码规模**:

| 类别 | 文件数 |
|---|:---:|
| `client/src/` (非测试) `.js` + `.jsx` | 732 |

**源码 LOC**: `client/src/*` 71,788 行

**测试**:

```
client/src/
└── utils/
    └── local-id.test.js  (唯一 test 文件, 2 个断言)
```

**测试执行**: Jest, `npm run client:test`, **2 / 2 pass**, 1.1s.

## 覆盖率估算

**Server**: 4 个活跃断言 vs ~320 源文件 ≈ **~0%**
**Client**: 2 个活跃断言 vs ~732 源文件 ≈ **~0%**
**整体**: **< 0.1%**

> 注：未装 nyc/c8 跑动态覆盖率工具。理由：能跑的测试已经少到极端，动态测出来也是 < 1%。装工具成本高于获取精确数字的价值。若后续需要精确数据（如 post-Tier 0 转 Tier 1 后），再装 nyc。

## 故障清单（M-12 实证的关键发现）

### 故障 1: Server 测试 bootstrap timeout

**文件**: `server/test/lifecycle.test.js:8`
**代码**: `this.timeout(5000);`
**问题**: sails.lift() 加载 100+ controllers + 32 models + 173 helpers 在 macOS 上 > 5s（实测超时），before hook 在所有测试运行前就失败。
**影响**: **所有依赖 sails runtime 的 server 测试都无法执行**，包括 models 集成测试（即使有）。
**修复方案**: 改为 `this.timeout(60000)` 或从 env var 读。但这需要改 Planka 上游代码 → **未本轮修**，作为 M-12 案例。

### 故障 2: User.test.js 整个被注释掉

**文件**: `server/test/integration/models/User.test.js`
**全文内容**:
```javascript
/* const { expect } = require('chai');

describe('User (model)', () => {
  before(async () => {
    await User.qm.createOne({ ... });
  });
  ...
}); */
```

**问题**: Planka 开发者在某个时间点把整个 User.test.js 注释掉了（大概率因为故障 1 导致 before hook 跑不完，索性注释掉整个文件。git blame 可以追溯但本轮未查）。
**影响**: "3 个 test 文件" 里其实有 1 个是 dead code。Planka README / CI 看不到这个事实。
**修复方案**: 要么恢复代码 + 修 timeout + 跑起来，要么正式删除。

### 故障 3: remote-address.js 耦合 sails 全局 `_`

**源码**: `server/utils/remote-address.js:16` 用 `_.something()` (lodash)
**问题**: 源码没 `require('lodash')`，依赖 sails runtime 把 lodash 注入全局 `_`。**独立 mocha（不走 sails.lift）无法测试**，因为 `_` 未定义。
**测试运行结果**:
```
remote-address
  #getRemoteAddress(Request)
    ✔ should get IPv4 remote address while not behind proxy and TRUST_PROXY=false
    ✔ should get IPv6 remote address while not behind proxy and TRUST_PROXY=false
    1) should get IPv4 remote address while behind proxy and TRUST_PROXY=true
    2) should get IPv6 remote address while behind proxy and TRUST_PROXY=true
    
  ReferenceError: _ is not defined
    at getRemoteAddress (utils/remote-address.js:16:46)
```

**影响**: 即使绕开故障 1 用 `./node_modules/.bin/mocha test/utils/remote-address.test.js` 单独跑，也只有前 2 个断言能过，后 2 个立即 fail。**50% failure rate**。
**修复方案**: 在 utils/remote-address.js 顶部加 `const _ = require('lodash')`。需要改 Planka 上游代码。

### 故障 4: 没有 coverage tool

**现状**: `server/package.json` 无 nyc / c8 / istanbul 依赖。`npm test` 脚本不报 coverage。Planka CI 如果有也没暴露到 README。
**影响**: 团队无法量化"测试到底覆盖多少代码"，提交代码的信心完全依赖手动验证。
**修复方案**: 装 nyc + 配置 `.nycrc` + 改 `npm test` script。本轮未做。

### 故障 5: Env vars 未文档化为测试必选

**现象**: 跑 `npm run server:test` 必须预设 `BASE_URL` / `DATABASE_URL` / `SECRET_KEY`，否则 `server/config/custom.js:32` 的 `new URL(baseUrl)` 立即 throw `TypeError: Invalid URL`。
**问题**: 新贡献者 clone 仓库后第一次跑测试，会撞到这个坑。`.env.sample` 里有这些 vars 但测试没有 `.env.test` 或类似预设。
**修复方案**: 提供 `server/.env.test.sample` 或在 `npm test` script 里预设最小 env。

## 基础设施成熟度评分（按 M-12 v2+Codex review 的 H1-H6 判据）

按 [m12-tiered-tdd-draft.md](./m12-tiered-tdd-draft.md) v2 + Codex review 后的 6 个硬标准（H1/H2/H4 是 blocker-class）：

| 硬标准 | 类型 | Planka 治理前 |
|---|:---:|:---:|
| H1: 裸跑 `npm test` 无预设能跑 | **blocker** | ❌ (故障 5: BASE_URL 等必须预设) |
| H2: 测试 bootstrap 无硬编码 timeout bug | **blocker** | ❌ (故障 1: lifecycle.test.js 5s) |
| H3: 测试代码无 dead / skipped | normal | ❌ (故障 2: User.test.js 整个注释) |
| H4: 测试能独立于 runtime 跑（或能完整 bootstrap） | **blocker** | ❌ (故障 3: remote-address.js 依赖 sails 注入的 `_`) |
| H5: Coverage tool 存在且 CI 跑 | normal | ❌ (故障 4: 无 nyc/c8) |
| H6: 测试确定性 / 无 flaky | normal | ⚠️ 未评估（需多次重跑统计） |

**Planka 当前 0 / 6 pass，且全部 3 个 blocker (H1/H2/H4) 都 fail → Tier 0 (BROKEN)**

按 M-12 v2 的规则，Tier 0 意味着 **Planka 禁止开启新 feature 的 EXECUTE 阶段，必须先修 infra 到 Tier 1**。

这与 v1 草稿的 "Tier 0 允许不强制 TDD" **相反**。v1 的方向被用户明确否决：**基础设施差不是豁免理由，而是必须优先治理的信号**。

### Planka 的 Tier 0 → Tier 1 升级动作（本轮 #11 要做的）

按 M-12 v2 playbook：

1. **修 H1**: 创建 `.env.test` 或在 test script 里预设最小 env vars
2. **修 H2**: `lifecycle.test.js` timeout 5000 → 60000
3. **修 H3**: `User.test.js` 恢复代码（若跑不通再删除）
4. **修 H4**: `utils/remote-address.js` 显式 `require('lodash')`
5. **修 H5**: 装 nyc + 改 test script + 跑 baseline coverage
6. **写第一个新 controller 集成测试**作为 "Tier 1 已达到" 的证明
7. **修复后重跑 H1-H5 打分** → 期望全 pass

## Experiment C 时的对比

Experiment C 报告（2026-04-02）写：

> **server 仅 4 个测试，client 仅 2 个，无 controller 测试** —— 写测试的成本和价值不匹配。

本次 (2026-04-08) 实测后更新这个描述：

> - Server **名义** 3 个测试文件；**真实能跑的** 1 个；**真实通过的 it() 断言** 2 个（共 4 个 it() 里 2 pass / 2 fail）；**基础设施 bug** 5 项
> - Client 1 个测试文件，2/2 pass，基础设施正常
> - 总有效 pass 断言 = 4 个，对 ~100,000 LOC 代码库

M-12 真正的痛点不只是"没测试"，还包括：**"仅剩的测试也半数 fail，基础设施本身阻塞新测试的添加"**。

## 本轮（更新后）实际要做的事

（按 v2 方向大改后本 session 的 scope）：

1. ✅ baseline 量化（本文件）
2. 🔄 修 H1-H5 全部 5 个 infra 故障（本 session 执行中）
3. 🔄 装 nyc 到 server + 跑 coverage baseline
4. 🔄 写第一个新 controller 集成测试（pilot）
5. 🔄 commit 到本地 `harness-m12/infra-fixes` 分支（不 push upstream）

修复后重跑 baseline 的结果写到 `m12-baseline-after.md`。

## 产出物

- 本文件：`m12-baseline.md`（量化基线）
- 后续：`m12-tiered-tdd-draft.md`（分级 TDD 策略草稿）

## 重要声明

本报告仅描述 Planka 2026-04-08 当时 HEAD 的测试基础设施状态，不代表对 Planka 项目质量的整体评判。Planka 是一个生产级的看板工具，有 8M+ Docker pulls，实际可靠性主要靠手动 QA 和集成 e2e 保障，而不是 unit tests 覆盖率。**M-12 方法论要解决的问题正是：像 Planka 这样的"实际工作良好但单元测试覆盖率低"的项目，AI 协作开发时应该用什么策略，而不是简单套 "TDD 铁律"**。
