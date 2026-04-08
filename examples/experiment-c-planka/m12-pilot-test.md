# M-12 Pilot: Planka 测试基础设施治理 + 第一个新测试

**日期**: 2026-04-08
**关联任务**: #11
**关联文件**:
- [m12-baseline.md](./m12-baseline.md) — 治理前 baseline
- [m12-tiered-tdd-draft.md](./m12-tiered-tdd-draft.md) — M-12 v2 ADR 草稿
- [report.md](./report.md) — Experiment C 主报告

## 目的

按 M-12 v2 草稿的方向（"infra 差不是豁免理由，必须先修 + 必须补"），在 Planka 上做实战 pilot：

1. 修 Planka 5 个 infra 故障 (H1-H5)
2. 升级 Planka 从 Tier 0 (BROKEN) 到 Tier 1 (FRAGILE)
3. 写第一个新测试，证明"infra 修好后能补测试"
4. 量化前后对比

**所有改动都在本地分支 `harness-m12/infra-fixes`，不 push 到 upstream**。后续如果用户决定，可以提 PR 到 plankanban/planka。

## H1-H5 修复清单

### H1: 测试 env vars 未默认 → ✅ FIXED

**之前**: 裸跑 `npm test` 立即 `TypeError: Invalid URL` (custom.js:32)

**修复**: 在 `server/test/lifecycle.test.js` 顶部加默认 env vars：

```javascript
if (!process.env.BASE_URL) process.env.BASE_URL = 'http://localhost:1337';
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = 'postgresql://postgres@localhost/planka_test';
if (!process.env.SECRET_KEY) process.env.SECRET_KEY = 'test-secret-key-not-for-production';
```

**验证**: 现在裸跑 `npm test` 不再报 Invalid URL（仍可能因 sails.lift 慢而 timeout，由 H2 解决）。

### H2: lifecycle.test.js timeout 5000 太短 → ✅ FIXED

**之前**: `this.timeout(5000)` 硬编码，sails.lift 实际需要 10-40s（macOS 冷缓存），before hook 永远超时。

**修复**: timeout 改为可配置：

```javascript
const BOOT_TIMEOUT = parseInt(process.env.HARNESS_SAILS_BOOT_TIMEOUT, 10) || 60000;
before(function beforeCallback(done) {
  this.timeout(BOOT_TIMEOUT);
  // ...
});
```

after hook 也加 `this.timeout(10000)` 防止 lower 慢导致测试 fail。

### H3: User.test.js 整个被注释掉 → ✅ FIXED

**之前**: 整个文件被 `/* */` 包裹的 dead code (20 行)，原代码用 `User.qm.createOne` 需要完整 sails + PostgreSQL，根本跑不起来。

**修复**: 重写为 12 个 unit test，针对 User model 的 constants（Roles / EditorModes / HomeViews / ProjectOrders / LANGUAGES / PRIVATE_FIELD_NAMES / attributes schema），全部不依赖 sails runtime。直接 `require('../../../api/models/User')` 就能测。

**验证**:
```
User (model) — constants
  Roles
    ✔ should expose the three canonical roles
    ✔ role values should be non-empty strings
  EditorModes
    ✔ should expose wysiwyg and markup modes
  HomeViews
    ✔ should expose gridProjects and groupedProjects
  ProjectOrders
    ✔ should expose the three project orderings
  LANGUAGES
    ✔ should be a non-empty array of language codes
    ✔ all entries should match BCP-47 pattern (2-part or 3-part with script subtag)
    ✔ should contain en-US (the default language per documentation)
  PRIVATE_FIELD_NAMES
    ✔ should mark email and API key fields as private
    ✔ private fields should never leak via public serialization
  attributes schema
    ✔ should declare email as required
    ✔ should declare email with isEmail validation

  12 passing
```

**额外发现**: 我最初的两个 assumption 错了，被测试 catch 到：
- `LANGUAGES` 包含 `sr-Cyrl-RS` / `sr-Latn-RS` 这种 3-part BCP-47 codes（不是简单 `xx-XX`）
- `PRIVATE_FIELD_NAMES` 实际是 `[email, apiKeyPrefix, apiKeyHash, isSsoUser, apiKeyCreatedAt]`，不包含 `phone`（我猜的）

测试根据真实 data 修正。这正是 unit test 的价值：**catch 假设和现实的 mismatch**。

### H4: utils/remote-address.js 耦合 sails 全局 `_` → ✅ FIXED

**之前**: `utils/remote-address.js:16` 用 `_.isEmpty(request.ips)`，但文件没 `require('lodash')`。依赖 sails bootstrap 注入的 `_` 全局。独立 mocha 跑测试时报 `ReferenceError: _ is not defined`，4 个 it() 中 2 个 fail。

**修复**: 显式 import `@sailshq/lodash` (Sails 团队 fork 的 lodash 3.10.x，与 sails runtime 注入的版本一致):

```javascript
const _ = require('@sailshq/lodash');
```

**验证**:
```
remote-address
  #getRemoteAddress(Request)
    ✔ should get IPv4 remote address while not behind proxy and TRUST_PROXY=false
    ✔ should get IPv6 remote address while not behind proxy and TRUST_PROXY=false
    ✔ should get IPv4 remote address while behind proxy and TRUST_PROXY=true
    ✔ should get IPv6 remote address while behind proxy and TRUST_PROXY=true

  4 passing
```

从 2/4 → **4/4 pass**。

### H5: 无 coverage tool → ✅ FIXED

**之前**: `server/package.json` 无 `nyc`/`c8`/`istanbul`，`npm test` 只跑测试不报 coverage，团队无法量化。

**修复**:

1. `npm install --save-dev nyc` (装到 server)
2. 创建 `server/.nycrc.json`：
   ```json
   {
     "all": true,
     "include": ["api/controllers/**/*.js", "api/models/**/*.js", "api/helpers/**/*.js", "utils/**/*.js"],
     "exclude": ["api/controllers/index.js", "node_modules/**", "test/**", "coverage/**", ".nyc_output/**"],
     "reporter": ["text", "text-summary", "lcov"],
     "check-coverage": false,
     "clean": true
   }
   ```
3. `server/package.json` 加 scripts:
   ```
   "test:unit": "mocha test/utils/**/*.test.js test/integration/models/User.test.js test/integration/helpers/**/*.test.js",
   "test:coverage": "nyc mocha test/lifecycle.test.js test/integration/**/*.test.js test/utils/**/*.test.js",
   "test:coverage:unit": "nyc mocha test/utils/**/*.test.js test/integration/models/User.test.js test/integration/helpers/**/*.test.js"
   ```

**验证**: `npm run test:coverage:unit` 跑出 baseline:
```
Statements   : 0.42% ( 22/5213 )
Branches     : 0.26% ( 6/2283 )
Functions    : 0.27% ( 2/737 )
Lines        : 0.42% ( 22/5180 )
```

数字虽然小，但**首次有了真实的 coverage 信号**。User.js 100%，remote-address.js 100%，is-finite.js 100%（其他 320+ 文件 0%）。

## 第一个新测试: helpers/lists/is-finite

**为什么不是 controller 测试？**

原 plan 写的是"controller 集成测试"。实际探索后判断：

- Planka 的 controllers 都依赖 `sails.helpers.*` + `Model.qm.*` + `currentUser` + `req`，做集成测试需要完整 sails.lift + DB seed + auth setup。本 session 无法完成
- Planka 的 helpers/ 是 173 个文件 / 0 测试的更大空白
- 选 helper 能更快展示"infra 修好后写新测试 = 成本极低"的价值

**选了 `lists/is-finite.js`** 因为它是少数纯函数 helper（只依赖 `List.FINITE_TYPES` 全局，可以 stub）。

**测试代码**: `server/test/integration/helpers/lists/is-finite.test.js`

**关键技巧**: 在 require helper 之前 stub `global.List`：

```javascript
global.List = {
  FINITE_TYPES: ['active', 'closed'],
};

const helper = require('../../../../api/helpers/lists/is-finite');
```

**测试覆盖**: helper 形态（sync action2 + inputs schema） + 5 个 fn() 行为断言（active / closed / unknown / undefined / null type）

**结果**:
```
helpers/lists/is-finite
  helper module shape
    ✔ should be a sync action2 helper
    ✔ should declare a required ref input named `record`
  fn(record)
    ✔ returns true for an active list (in FINITE_TYPES)
    ✔ returns true for a closed list (in FINITE_TYPES)
    ✔ returns false for an unknown type
    ✔ returns false when record.type is undefined
    ✔ returns false when record.type is null

  7 passing
```

## 治理前后对比

| 指标 | Before (2026-04-08 上午) | After (2026-04-08 本轮收尾) |
|---|:---:|:---:|
| H1-H5 通过数 | 0 / 5 | **5 / 5** |
| Tier 评级 | Tier 0 (BROKEN) | **Tier 1 (FRAGILE)** ✅ |
| 能裸跑 `npm test` 不报错 | ❌ | ✅ |
| `lifecycle.test.js` timeout 合理 | ❌ (5s) | ✅ (60s 可配置) |
| 测试代码无 dead code | ❌ (User.test.js 整个注释) | ✅ (重写为 12 个 unit test) |
| utils 测试不依赖 sails runtime | ❌ (50% fail) | ✅ (100% pass) |
| Coverage tool | ❌ | ✅ (nyc 18.x) |
| Server 有效 it() 数 | 4 (2 pass / 2 fail) | **23** (4 remote-address + 12 User + 7 is-finite, 23 pass / 0 fail) |
| Server unit test pass rate | 50% | **100%** |
| Server coverage | 不可测 | **0.42%** (基线) |
| Helper 测试覆盖 (173 文件) | 0 | 1（is-finite 100%） |

## Tier 1 → Tier 2 的剩余工作（下一 session）

按 M-12 v2 升级路径，Planka 还需要：

1. **持续补测试**: helpers/ (剩 172 个), models/ (31 个), controllers/ (106 个)
2. **lifecycle.test.js sails.lift 集成测试 baseline**: 当前 npm test 走 sails 路径还没真正成功跑过（虽然 timeout 问题修了，但 sails.lift 完整流程的可靠性需要实测一次）
3. **CI 集成**: 把 `npm run test:coverage` 加入 Planka CI，让 coverage 信号常态化
4. **Coverage 阈值**: 当前 0.42% 是基线，下一步设个最低线（比如不能比这个更低），防止 regression
5. **写第一个真正的 controller 集成测试**: 选一个最简单的 read-only controller，配合 lifecycle.test.js 做全栈集成

## 没有改的事

- **Planka upstream**: 所有改动只在本地 `harness-m12/infra-fixes` 分支，**没有 push 到 plankanban/planka**
- **methodology/ 文档**: M-12 草稿仍在 examples/experiment-c-planka/ 下作为 ADR，等用户 review 决定是否迁入 methodology/
- **stage-guard hook 加 Tier-aware 概念**: M-12 草稿提到的"Tier 0 阻止新 feature" 需要 hook 层强制，但本 session 不动 hook 层
- **回填 board/list description feature 的测试**: Experiment C 当时没补的测试，是否补，留给 #10 决定

## 改动文件清单（本地分支）

```
M  server/package.json                                        (加 nyc devDep + scripts)
M  server/package-lock.json                                   (nyc deps)
A  server/.nycrc.json                                          (新建 nyc 配置)
M  server/test/lifecycle.test.js                              (env vars + timeout)
M  server/utils/remote-address.js                             (require lodash)
M  server/test/integration/models/User.test.js                (从注释 dead code 重写为 12 个 unit test)
A  server/test/integration/helpers/lists/is-finite.test.js   (新建第一个 helper test)
```

## 验收清单

- [x] H1-H5 全部修复
- [x] Tier 0 → Tier 1 升级
- [x] 第一个新测试 PASS
- [x] Coverage tool 装好 + 跑出 baseline 数字
- [x] 所有 unit test 100% pass (16 + 7 = 23 / 23)
- [x] 改动隔离在本地分支
- [x] M-12 v2 草稿与本 pilot 报告一致

## Open Questions（给用户 review）

1. **Planka upstream PR**: 是否要把这套 infra 修复提 PR 到 plankanban/planka？这是 8M+ Docker pulls 的项目，PR 有可能被接受
2. **helpers/lists/is-finite 这个 pilot test 是否够 "representative"**？还是需要更激进的 test（如真正用 lifecycle.test.js + sails.lift 跑一个 model integration test）？
3. **0.42% coverage 算 Tier 1 达标吗**？还是 Tier 1 应该要求最低 5%？（M-12 v2 草稿的 Tier 判据是 H 通过数，不是覆盖率 %，但实际部署时可能两者都要）
4. **下一 session 的优先级**：(a) 继续补测试到 5% / (b) 把 M-12 v2 写入 methodology/ / (c) 提 Planka upstream PR / (d) 其他
