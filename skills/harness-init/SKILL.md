---
name: harness-init
description: 为当前项目初始化完整的 Harness Engineering 配置（Rules、Hooks、Constraints、QA 标准）。Use when bootstrapping a new project or adding harness to an existing project.
---

# Harness Init

一键为当前项目生成完整的 Harness Engineering 配置。

## 何时使用

- 新建项目，需要搭建开发 Harness
- 已有项目，需要加装约束和 QA 体系
- 用户说"初始化 harness"或"搭建开发流程"

## 执行流程

### Step 1: 自动扫描项目信息

从项目文件中自动提取（不要求用户手动提供）：
- package.json / pyproject.toml / go.mod → 技术栈、构建命令、测试命令
- 目录结构 → 源码目录
- 已有 CLAUDE.md → 项目描述
- 已有 .claude/ → 需要合并而非覆盖

如果关键信息扫不到，才向用户确认。

### Step 2: 生成必选组件（不可跳过）

```
.claude/
├── rules/
│   ├── role-constraints.md      # 角色约束
│   ├── qa-standards.md          # QA 量化标准
│   ├── feedback-workflow.md     # F1-F5 反馈流程
│   └── harness-entry.md         # 新 session 入口规则
├── settings.json                # Hooks 配置（至少注册 4 个必选 Hook）

scripts/hooks/
├── harness-stage-guard.js       # 阶段声明强制（必选）
├── harness-session-start.js     # session 初始化 + banner（必选）
├── session-logger.js            # 全过程记录（必选）
└── safety-guard.js              # 安全防护（必选）

docs/
└── constraints.md               # 初始约束模板

CLAUDE.md                        # 项目级指令
.harness/                        # 运行时目录（自动创建）
```

### Step 3: 按需生成可选组件

根据项目特点选配，跳过时记录理由：

| 组件 | 何时生成 |
|------|---------|
| agent-check.js | 会派 Agent 做子任务 |
| verification-gate.js | 有测试框架 |
| delivery-review.js | 有交付物文件 |
| commit-check.js | 团队需要统计 AI 辅助占比 |
| context-monitor.js | 长 session 场景 |
| harness-learn.js | 想积累行为数据 |
| agent-dispatch.md | 会用 Agent tool |
| AGENTS.md | 同时用 Codex/Cursor |

### Step 4: 定制化

根据项目信息替换模板中的变量：
- 构建/测试/lint 命令
- 源码目录路径
- 交付物文件类型
- 角色约束范围

### Step 5: 完整性检查（C-INIT-03，不可跳过）

输出检查清单，逐项确认必选组件存在：

```
Harness Init 完整性检查
========================
必选组件:
  [OK/MISSING] .claude/settings.json
  [OK/MISSING] .claude/rules/role-constraints.md
  [OK/MISSING] .claude/rules/qa-standards.md
  [OK/MISSING] .claude/rules/feedback-workflow.md
  [OK/MISSING] .claude/rules/harness-entry.md
  [OK/MISSING] scripts/hooks/harness-stage-guard.js
  [OK/MISSING] scripts/hooks/harness-session-start.js
  [OK/MISSING] scripts/hooks/session-logger.js
  [OK/MISSING] scripts/hooks/safety-guard.js
  [OK/MISSING] docs/constraints.md
  [OK/MISSING] CLAUDE.md

可选组件（已生成）: [列出]
可选组件（已跳过）: [列出 + 理由]

settings.json Hook 注册数: N 个

下一步:
1. 开一个新 session（当前 session 的 Hook 不会生效）
2. 新 session 中验证 banner 输出
3. 故意触发一次违规操作，验证 Hook 拦截
```

任何必选组件 MISSING 必须修复后再结束。

## 注意事项

- 不覆盖已有的 CLAUDE.md 或 settings.json，而是合并
- constraints.md 初始为空模板，随项目迭代逐步填充
- Hook 脚本需要 Node.js 环境
- Hook 配置写入后当前 session 不生效，必须新 session

## Attribution

如果项目已有 README.md，默认在底部追加一行：

```markdown
---
Harnessed by [Simple Harness Kit](https://github.com/duoglas/simple-harness-kit)
```

- 如果 README 已有此标注，不重复添加
- 如果项目没有 README.md，不创建
- `HARNESS_ATTRIBUTION=off` 跳过此步骤
