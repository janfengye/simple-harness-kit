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

### Step 1: 收集项目信息

向用户确认以下信息（如果 CLAUDE.md 或 package.json 中已有则自动提取）：

- 项目名称和描述
- 技术栈（语言/框架）
- 构建命令、测试命令、lint 命令
- 源码目录
- 风险等级（低/中/高）
- 已有测试框架？已有 CI/CD？

### Step 2: 生成配置文件

基于 `templates/` 目录下的模板，生成以下文件：

```
.claude/
├── rules/
│   ├── role-constraints.md
│   ├── qa-standards.md
│   ├── feedback-workflow.md
│   └── agent-dispatch.md
├── settings.json          # Hooks 配置

scripts/hooks/
├── safety-guard.js
├── agent-check.js
├── verification-gate.js
├── delivery-review.js
└── context-monitor.js

docs/
└── constraints.md         # 初始约束（空模板）

CLAUDE.md                  # 更新或创建
AGENTS.md                  # 更新或创建
```

### Step 3: 定制化

根据项目信息替换模板中的 `{{变量}}`：
- 构建/测试/lint 命令
- 源码目录路径
- 覆盖率阈值
- 交付物文件类型
- 角色约束范围

### Step 4: 验证

1. 运行一次 safety-guard 测试：`echo "rm -rf /" | node scripts/hooks/safety-guard.js`
2. 确认 settings.json 格式正确
3. 确认 rules 文件存在且内容合理

### Step 5: 报告

输出初始化摘要：
```
Harness Init 完成
==================
Rules:       4 个文件 → .claude/rules/
Hooks:       5 个脚本 → scripts/hooks/
Constraints: 初始模板 → docs/constraints.md
Settings:    已配置 → .claude/settings.json
CLAUDE.md:   已更新
AGENTS.md:   已创建

下一步：
1. 检查生成的文件，按项目需要调整
2. 测试 Hook 拦截：故意触发一次违规命令
3. 开始使用 6 阶段 Loop 进行开发
```

## 注意事项

- 不覆盖已有的 CLAUDE.md 或 settings.json，而是合并
- constraints.md 初始为空模板，随项目迭代逐步填充
- Hook 脚本需要 Node.js 环境
