# Release Process

simple-harness-kit 的发版流程。配合 Harness commit/push 阶段规则使用，详见 [methodology/12-commit-standards.md](../methodology/12-commit-standards.md)。

## 何时发版

不是所有 commit 都需要发版。发版的合理触发条件：

| 触发 | 说明 |
|------|------|
| 完成一个里程碑任务 | 例如新增一类 Hook、引入新 lifecycle event 支持、重大重构 |
| 累积足够的小变更 | 例如 5+ 个文档同步、bug 修复、小功能增量 |
| 修复关键 bug | 例如 P0 安全/可用性问题，无需累积 |
| 用户请求 | 上游用户需要拉取特定改动 |

**反例**: 不要为了"刷 release 数"而发版。一次 commit 立即 release 通常是过度的。

## 版本号选择 (Semver)

遵循 [Semantic Versioning 2.0.0](https://semver.org/lang/zh-CN/) — `MAJOR.MINOR.PATCH`：

| 改动 | bump |
|------|------|
| 不兼容的 API 变更（template 格式破坏 / Hook 接口断裂 / 删除可选 Hook） | MAJOR |
| 向后兼容的功能新增（新 Hook / 新 matcher / 新 event 支持 / 新方法论文档） | MINOR |
| 向后兼容的 bug 修复（文档纠错 / 行为对齐 / 边界条件） | PATCH |

**当前版本**: 0.x.y。1.0 之前 MINOR 也可以包含小破坏（按行业惯例）。

**特例**: kit 的 templates/settings-json.tmpl 是 source of truth，对它的破坏性修改即使 kit 内部测试通过，也算 MAJOR（因为下游 init 出来的项目会受影响）。

## 完整发版步骤

```
PLAN → 决定发什么版本号、收集变更
EXECUTE → 更新文件
VERIFY → 测试通过 + Codex 交叉验收
REVIEW → push commit + push tag
```

### Step 1: 决定版本号

查看自上次 tag 以来的变更：

```bash
git log $(git describe --tags --abbrev=0)..HEAD --oneline
```

按 Semver 决定 bump 类型，得到目标版本号 vX.Y.Z。

### Step 2: 更新 CHANGELOG.md

把 `[Unreleased]` 章节内容移到新版本章节，加日期：

```markdown
## [Unreleased]

（清空或保留新条目）

## [X.Y.Z] - YYYY-MM-DD

### Added
...
### Changed
...
### Fixed
...
```

每个条目末尾用 `(commit-sha)` 引用源 commit，便于追溯。

### Step 3: Bump @version 注释（如有 Hook 改动）

如果本次发版包含 Hook 脚本改动，更新 12 个 Hook 文件头部的 `@version` 字段：

```bash
# 例: 0.6.1 → 0.6.2
sed -i '' 's/@version 0.6.1/@version 0.6.2/' scripts/hooks/*.js
```

注意：仅当 Hook 脚本本身有改动时才 bump。纯文档/template 改动可以不动 @version。

### Step 4: Commit release

按 commit/push 规则，在 VERIFY 阶段产出 verify-evidence.md 后 commit：

```
chore(release): vX.Y.Z

简短描述本次 release 的重点。

Co-Authored-By: ...
```

### Step 5: 进入 REVIEW 阶段，打 tag

打 annotated tag（不要用 lightweight tag）：

```bash
git tag -a vX.Y.Z -m "vX.Y.Z: 一句话摘要

详细变更见 CHANGELOG.md"
```

### Step 6: Push commit + tag

```bash
git push origin master
git push origin vX.Y.Z
```

或一次推所有 tag:

```bash
git push origin master --follow-tags
```

### Step 7: GitHub Release（可选）

如果发版包含资产（screenshots / 二进制 / patch 文件），在 GitHub 上创建 Release，附带 CHANGELOG 中本版本的内容。

## CHANGELOG 维护原则

- **追加而不重写** — 历史版本章节一旦发版就不再修改（除非纠错），新变更只加到 [Unreleased]
- **commit 即追加** — 每个有用户感知影响的 commit 都应该在同一次 commit 中更新 CHANGELOG 的 [Unreleased] 章节，避免发版时遗漏
- **粒度** — 用户视角描述变更，不是开发者视角。"修复 X 工具在 Y 场景下的 Z bug" 比 "重构 X 函数" 更有用
- **链接 commit** — 每条变更末尾用 `(sha)` 引用源 commit

## 与 Harness commit/push 规则的协同

- commit 频率: 每个任务一次主 commit（VERIFY 阶段）+ 修复 commit
- push 频率: 每个任务进入 REVIEW 后 push 一次
- release 频率: 远低于 push，按"何时发版"的触发条件决定

发版本身就是一个完整的 Harness 任务，遵循 PLAN→EXECUTE→VERIFY→REVIEW 流程。release commit 在 VERIFY 阶段产生，tag 和 push 在 REVIEW 阶段执行。

## 历史 release

CHANGELOG.md 为 source of truth。git tag 列表可通过 `git tag -l` 查看。
