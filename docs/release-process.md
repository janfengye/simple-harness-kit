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
EXECUTE → Step 0 sync → Step 1-3 更新文件
VERIFY → 测试通过 (含 T10/T11) + Codex 交叉验收
REVIEW → push commit + push tag
```

### Step 0: Dogfooding Feedback Sync（强制, 2026-04-08 VH-09 后加入）

**必须先做**。这一步确保 dogfooding workspace (`ths-harness`) 产生的 meta learning 已经反哺到 kit 产品仓库。

```bash
# 检查 workspace 和 kit constraints 同步
node tests/template-integrity.js

# 必须看到:
#   PASS  sync: workspace ↔ kit docs/constraints.md meta 约束同步 (C-META-04)
#   PASS  sync: workspace ↔ kit templates/rules 同步 (C-META-04)
```

T10/T11 任一 FAIL → 本 release **禁止进 Step 1**。必须先：

1. 把 workspace `docs/constraints.md` 中缺失的 kit-level 约束 (C-DOC/C-META/C-HOOK/C-TEST/C-GATE/C-INIT/C-SKILL) 和 VH-* 同步到 kit `docs/constraints.md`
2. 把 workspace `.claude/rules/*.md` 缺失的对应 `templates/rules/*.md.tmpl` 补上
3. 在**同一 release commit** 中两份一起变更（防止再漂移）

**为什么在这一步**: VH-09 暴露了之前所有 release 都带着 workspace → kit 未同步的 gap。这个 gap 让 60+ 使用者 clone kit 时拿到残缺的 meta 约束。Step 0 是"出 release 前的最后一次 sync 机会"，必须挡住未同步的 release。

**关联约束**: C-META-04

---

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
