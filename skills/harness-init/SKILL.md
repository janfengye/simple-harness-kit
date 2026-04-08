---
name: harness-init
description: 为当前项目初始化完整的 Harness Engineering 配置（Rules、Hooks、Constraints、QA 标准）。Use when bootstrapping a new project or adding harness to an existing project.
---

# Harness Init

为当前项目生成完整的 Harness Engineering 配置。

## 何时使用

- 新建项目，需要搭建开发 Harness
- 已有项目，需要加装约束和 QA 体系
- 用户说"初始化 harness"或"搭建开发流程"

---

## 生成原则（不可违反，违反即视为 bug）

> 历史教训 VH-08（2026-04-08）：本 skill 的旧版本只画了文件树和必选清单，没有要求 AI 读取真实源。AI 走到这里时凭训练记忆拼 `.claude/settings.json`，结果生成了 Claude Code 不认识的 key 结构（`Invalid key in record`），用户重启 session 即报错。同一个失败模式在 templates ⇌ required-wiring.json 这一对上已经被 #16 / #23 修复过，但当时没意识到 SKILL.md 也是一份会"凭记忆生成"的入口。

约束 **C-INIT-04**：

1. **`.claude/settings.json` 不能凭记忆生成**。必须先读取 `simple-harness-kit/templates/settings-json.tmpl`，以模板为唯一真实源，再做项目定制（替换路径、可选 hook 增删）。
2. **Hook 脚本不能凭记忆生成**。必须从 `simple-harness-kit/scripts/hooks/` 读取对应脚本，复制到目标项目，**不修改脚本内容**——它们是 kit 的一部分，会随升级更新。如目标项目用 monorepo，复制策略由项目结构决定，但脚本本体保持不变。
3. **Rules 文件不能凭记忆生成**。必须从 `simple-harness-kit/templates/rules/` 下的 `*.tmpl` 派生，做项目占位符替换。
4. **必选/可选组件清单以 `simple-harness-kit/init-prompt.md` 为权威**。本文件不复述清单——任何看到必选项变化的人，都必须改 init-prompt.md，而不是改这里。
5. **wiring（hook event/matcher 注册）以 `simple-harness-kit/tests/required-wiring.json` 为权威**。这是工程层的 single source of truth，validate.sh 和 template-integrity 都从它派生。
6. **生成完毕后必须运行 `simple-harness-kit/tests/e2e-acceptance-validate.sh`**，把完整输出贴到对话里。任何 FAIL 项必须修复后再宣称 init 完成。

任何"为了简化/适配/AI 觉得这样更好"而违反以上 6 条的行为，都是 bug，不是优化。

---

## 执行流程

### Step 1: 读取真实源

依次 Read 以下文件，作为本次 init 的全部依据：

1. `simple-harness-kit/init-prompt.md` —— 流程总纲、必选/可选组件清单、定制说明
2. `simple-harness-kit/templates/settings-json.tmpl` —— settings.json 唯一真实源
3. `simple-harness-kit/tests/required-wiring.json` —— hook wiring 唯一真实源
4. `simple-harness-kit/methodology/15-hook-coverage-matrix.md` —— hook 覆盖矩阵，理解每个 wiring 的来由

不要跳过这一步。不要"我已经知道大概结构"。

### Step 2: 自动扫描项目信息

按 init-prompt.md 描述的方式扫描：`package.json` / `pyproject.toml` / `go.mod` / 目录结构 / 已有 `CLAUDE.md` / 已有 `.claude/`。

### Step 3: 按 init-prompt.md 生成产物

完全遵循 init-prompt.md 的"必选 / 可选 / 定制"段落。`.claude/settings.json` 必须从 `templates/settings-json.tmpl` 派生（**不是从记忆里写**）。

> **生成 settings.json 的两种策略 — 默认走更安全的那条**：
>
> - **(推荐) 从 `tests/required-wiring.json` 直接派生最小集** — 这是工程层的 single source of truth，只包含必选 wiring，不含 optional hooks。一行一行翻译成 `{event, matcher, hooks: [{type, command}]}` 即可。**优点**：默认安全，AI 不会"忘记删 optional"
> - **(高级) 从 `templates/settings-json.tmpl` 复制后删 optional 条目** — template 包含 optional hooks (verification-gate / delivery-review / commit-check / agent-check / context-monitor / delivery-gate) 的预设 wiring。如果项目需要这些 hooks，按 init-prompt.md 的"可选组件"表判断保留哪些；其余必须删除。**风险**：AI 容易漏删，结果是 settings 引用了不存在的 hook 脚本（被 validate.sh E2 检查 catch，但多一次 round trip）
>
> 默认走第一种。只有当用户明确要求启用某个 optional hook 时，才走第二种并精确取舍。

### Step 4: 运行可执行守门

```bash
bash simple-harness-kit/tests/e2e-acceptance-validate.sh
```

把完整输出（含每行 ✓ / ✗）贴到对话。任何 FAIL 项立刻修复后重新跑。

### Step 5: 输出 init-prompt.md 中定义的完整性检查清单

清单以 init-prompt.md 中的 "C-INIT-03" 段为准。本文件不复述清单。

---

## 注意事项

- 不覆盖已有的 `CLAUDE.md` 或 `.claude/settings.json`，而是合并
- `docs/constraints.md` 初始为空模板，随项目迭代逐步填充
- Hook 脚本需要 Node.js 环境
- Hook 配置写入后**当前 session 不生效，必须新 session**

## Codex 用户

按 init-prompt.md 中"Codex 用户注意"段执行（必须 `--full-auto`）。

## Attribution

如果项目已有 `README.md`，默认在底部追加：

```markdown
---
Harnessed by [Simple Harness Kit](https://github.com/duoglas/simple-harness-kit)
```

- 已有此标注则不重复
- 没有 README 不创建
- `HARNESS_ATTRIBUTION=off` 跳过
