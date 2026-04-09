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

约束 **C-INIT-04**（+ **C-SKILL-01** 路径解析约定）：

**路径解析约定**（C-SKILL-01, VH-10 教训）：本 SKILL.md 中所有 `./resources/xxx` 路径均**相对 SKILL.md 文件本身的位置**（通常是 `~/.claude/skills/harness-init/resources/` 或 `<project>/.claude/skills/harness-init/resources/`），这是 skill 安装后的真实路径，与 AI 当前 cwd 无关。kit 仓库相关的文件（hooks、templates/rules、e2e-acceptance-validate.sh）通过 Step 0 定位的 `$KIT_ROOT` 变量访问。cwd-relative 路径（如直接写 `simple-harness-kit/foo`）会直接失败——60+ 用户把 kit 放在任意位置。

1. **`.claude/settings.json` 不能凭记忆生成**。必须先读取 `./resources/settings-json.tmpl`（skill-relative），以模板为唯一真实源，再做项目定制（替换路径、可选 hook 增删）。
2. **Hook 脚本不能凭记忆生成**。必须从 kit 仓库 `scripts/hooks/` 读取对应脚本（定位方式见 Step 0），复制到目标项目，**不修改脚本内容**——它们是 kit 的一部分，会随升级更新。如目标项目用 monorepo，复制策略由项目结构决定，但脚本本体保持不变。
3. **Rules 文件不能凭记忆生成**。必须从 kit 仓库 `templates/rules/` 下的 `*.tmpl` 派生，做项目占位符替换。
4. **必选/可选组件清单以 `./resources/init-prompt.md` 为权威**（skill-relative）。本文件不复述清单——任何看到必选项变化的人，都必须改 init-prompt.md，而不是改这里。
5. **wiring（hook event/matcher 注册）以 `./resources/required-wiring.json` 为权威**（skill-relative）。这是工程层的 single source of truth，validate.sh 和 template-integrity 都从它派生。
6. **生成完毕后必须运行 kit 仓库的 `tests/e2e-acceptance-validate.sh`**（定位方式见 Step 0），把完整输出贴到对话里。任何 FAIL 项必须修复后再宣称 init 完成。

任何"为了简化/适配/AI 觉得这样更好"而违反以上 6 条的行为，都是 bug，不是优化。

---

## 执行流程

### Step 0: 定位 kit 仓库（只为 Step 3 的脚本/rule 拷贝 + Step 4 的 validate.sh）

本 skill 已自包含 4 个关键资源（`./resources/` 下），Step 1 全部从 resources/ 读取。
但 Step 3 需要把 kit 的 `scripts/hooks/*.js` 和 `templates/rules/*.tmpl` 拷贝到目标项目，Step 4 需要跑 `tests/e2e-acceptance-validate.sh`——这两步需要知道 kit 仓库在哪。

**定位顺序**（取第一个命中）：
1. 环境变量 `SIMPLE_HARNESS_KIT_ROOT` 指向的目录（若用户显式设置，最可信）
2. 询问用户 + 4 个常见位置作为建议：`~/simple-harness-kit`、`~/ops/simple-harness-kit`、`~/Projects/simple-harness-kit`、`~/code/simple-harness-kit`

**禁止**（C-SKILL-02, VH-10 后加强的 trust model 规则）：
- **不得**在用户当前 cwd 或其父目录自动"向上查找 `simple-harness-kit/`"然后静默使用。如果用户在 `/tmp/untrusted-project` 下工作，而该目录恰好有 `simple-harness-kit/` 子目录，自动信任这个"子目录" = supply-chain 攻击：恶意 kit 的 `install.sh` / `templates/rules/*.tmpl` / `scripts/hooks/*.js` 会被写入用户项目。必须用户显式确认。
- **不得**假设第一个找到的 `simple-harness-kit/` 目录就是真的。**必须做结构完整性校验**：定位到候选路径 `$CAND` 后，先校验以下所有文件/目录都存在且非空：
  - `$CAND/methodology/00-overview.md`（方法论根文档）
  - `$CAND/templates/settings-json.tmpl`
  - `$CAND/tests/required-wiring.json`
  - `$CAND/tests/template-integrity.js`
  - `$CAND/scripts/hooks/` 下至少 5 个 `.js` 文件
  - `$CAND/CHANGELOG.md` 首行含 `# Changelog`

  任一不满足 → 拒绝使用该候选，回到定位流程 next priority。

- **必须**：除非 `SIMPLE_HARNESS_KIT_ROOT` 环境变量明确设置，否则**任何**自动定位的 kit 路径在使用前都要**显式告诉用户**："我打算用 `$CAND` 作为 kit 仓库，这是你的安装位置吗？(确认/否)"。得到用户确认后才继续 Step 3/4。如果用户不确认 → 询问绝对路径。

**反模式**（禁止）：
- 直接写 `simple-harness-kit/...` 这样的 cwd-relative 路径（VH-10 问题 B）
- 自动信任 cwd 向上搜索到的 `simple-harness-kit/`（VH-10 Codex gpt-5.4 round 3 F3 发现的 supply-chain 风险）

### Step 1: 读取真实源（全部 skill-relative，cwd 无关）

依次 Read 以下文件，作为本次 init 的全部依据：

1. `./resources/init-prompt.md` —— 流程总纲、必选/可选组件清单、定制说明
2. `./resources/settings-json.tmpl` —— settings.json 唯一真实源
3. `./resources/required-wiring.json` —— hook wiring 唯一真实源
4. `./resources/hook-coverage-matrix.md` —— hook 覆盖矩阵，理解每个 wiring 的来由

这些路径相对 SKILL.md 文件本身，skill 安装到任何位置都能解析。
不要跳过这一步。不要"我已经知道大概结构"。

### Step 2: 自动扫描项目信息

按 init-prompt.md 描述的方式扫描：`package.json` / `pyproject.toml` / `go.mod` / 目录结构 / 已有 `CLAUDE.md` / 已有 `.claude/`。

### Step 3: 按 init-prompt.md 生成产物

完全遵循 `./resources/init-prompt.md` 的"必选 / 可选 / 定制"段落。`.claude/settings.json` 必须从 `./resources/settings-json.tmpl` 派生（**不是从记忆里写**）。

拷贝 kit 脚本和 rule 模板到目标项目时，用 Step 0 定位到的 kit 根目录 `$KIT_ROOT`：
- Hook 脚本源: `$KIT_ROOT/scripts/hooks/*.js`
- Rule 模板源: `$KIT_ROOT/templates/rules/*.tmpl`
- e2e 守门脚本: `$KIT_ROOT/tests/e2e-acceptance-validate.sh`

> **生成 settings.json 的两种策略 — 默认走更安全的那条**：
>
> - **(推荐) 从 `./resources/required-wiring.json` 直接派生最小集** — 这是工程层的 single source of truth，只包含必选 wiring，不含 optional hooks。一行一行翻译成 `{event, matcher, hooks: [{type, command}]}` 即可。**优点**：默认安全，AI 不会"忘记删 optional"
> - **(高级) 从 `./resources/settings-json.tmpl` 复制后删 optional 条目** — template 包含 optional hooks (verification-gate / delivery-review / commit-check / agent-check / context-monitor / delivery-gate) 的预设 wiring。如果项目需要这些 hooks，按 init-prompt.md 的"可选组件"表判断保留哪些；其余必须删除。**风险**：AI 容易漏删，结果是 settings 引用了不存在的 hook 脚本（被 validate.sh E2 检查 catch，但多一次 round trip）
>
> 默认走第一种。只有当用户明确要求启用某个 optional hook 时，才走第二种并精确取舍。

### Step 4: 运行可执行守门

```bash
bash "$KIT_ROOT/tests/e2e-acceptance-validate.sh"
```

其中 `$KIT_ROOT` 来自 Step 0 定位结果。把完整输出（含每行 ✓ / ✗）贴到对话。任何 FAIL 项立刻修复后重新跑。

### Step 5: 输出 init-prompt.md 中定义的完整性检查清单

清单以 `./resources/init-prompt.md` 中的 "C-INIT-03" 段为准。本文件不复述清单。

---

## 注意事项

- 不覆盖已有的 `CLAUDE.md` 或 `.claude/settings.json`，而是合并
- `docs/constraints.md` 初始为空模板，随项目迭代逐步填充
- Hook 脚本需要 Node.js 环境
- Hook 配置写入后**当前 session 不生效，必须新 session**

## Codex 用户

按 `./resources/init-prompt.md` 中"Codex 用户注意"段执行（必须 `--full-auto`）。

## Attribution

如果项目已有 `README.md`，默认在底部追加：

```markdown
---
Harnessed by [Simple Harness Kit](https://github.com/duoglas/simple-harness-kit)
```

- 已有此标注则不重复
- 没有 README 不创建
- `HARNESS_ATTRIBUTION=off` 跳过
