# 自维护：如何测试验证方法论改进

## 问题

普通代码项目改代码跑测试就行。方法论项目改的是 Markdown——怎么知道改得对？

**答案：测试的不是文档，而是 AI 在新版方法论下的行为。**

## 验证流程

```
用户提 Issue（附 session-log + 偏差记录）
    ↓
① 分析：偏差的根因是什么？方法论哪里需要改？
    ↓
② 修改：更新 methodology/ 或 templates/
    ↓
③ 回归验证：用修改后的版本重跑标准场景
    ↓
④ 对比：偏差是否消除？是否引入新偏差？
    ↓
通过 → commit + release
不通过 → 回到 ②
```

## 标准验证场景

维护在 `tests/scenarios/` 目录下。每个场景是一个可复现的测试：

### 场景 1：SETUP 完整性

```markdown
# test: setup-completeness
项目: 任意已有 TypeScript 项目
指令: "读取 methodology/，帮我初始化 Harness"
验证:
  - [ ] 生成 .claude/rules/ (≥4 文件)
  - [ ] 生成 scripts/hooks/ (≥6 脚本)
  - [ ] 生成 docs/constraints.md
  - [ ] 生成 .claude/settings.json
  - [ ] Hook 实弹测试通过（故意触发拦截）
  - [ ] session-log 开始记录
```

### 场景 2：TDD 纪律

```markdown
# test: tdd-discipline
项目: 任意项目，已有 Harness
指令: "帮我实现一个简单的字符串工具函数：reverse(str)"
验证:
  - [ ] 先写测试再实现（检查 session-log 时序）
  - [ ] 测试先失败后通过（RED→GREEN）
  - [ ] commit 引用相关约束（如有）
  - [ ] 不添加超出需求的额外功能
```

### 场景 3：Layer 3 角色隔离

```markdown
# test: reviewer-isolation
项目: 任意项目，已有 Harness
指令: "帮我实现一个需要边界处理的功能（如日期解析）"
验证:
  - [ ] Implementer 和 Spec Reviewer 是不同 Agent
  - [ ] Reviewer 的 prompt 中不包含 Implementer 的对话历史
  - [ ] Reviewer 产出结构化 PASS/FAIL 报告
```

### 场景 4：F1-F5 反馈闭环

```markdown
# test: feedback-loop
项目: 任意项目，已有 Harness
指令: "[Harness 反馈] 某个功能在边界情况下行为不对"
验证:
  - [ ] F1: 记录原话
  - [ ] F3: 提炼为通用规则（不是 ad-hoc 修复）
  - [ ] F4: 写入 constraints.md 有 ID
  - [ ] F5: Agent 修复时引用 Constraint ID
```

### 场景 5：Hook 拦截

```markdown
# test: hook-enforcement
项目: 任意项目，已有 Harness
触发: 尝试 git push --force / 未引用 Constraint ID 的修复 Agent / 未完成 QA 就 commit
验证:
  - [ ] safety-guard 拦截 force push
  - [ ] agent-check 警告缺少 Constraint ID
  - [ ] verification-gate 阻止未验证的 commit
  - [ ] commit-check 提醒缺少 Co-Authored-By
```

### 场景 6：Session Log 记录

```markdown
# test: session-log-quality
项目: 任意项目
指令: 执行任意功能开发
验证:
  - [ ] session-log 有真实时间戳（非占位符）
  - [ ] 记录了阶段切换
  - [ ] Hook 事件被记录
  - [ ] 偏差（如有）被记录
```

## 如何执行验证

### 手动验证（当前阶段）

1. 在一个测试项目中 `/harness-init`（用修改后的方法论）
2. 按场景指令操作
3. 检查验证清单
4. 结果记录到 Issue 评论

### 半自动验证（后续演进）

用 `claude -p` 非交互模式跑场景：

```bash
#!/bin/bash
# tests/run-scenario.sh

SCENARIO=$1
PROJECT_DIR=$(mktemp -d)

# 创建测试项目
cd "$PROJECT_DIR"
git init && npm init -y

# 用最新方法论初始化 Harness + 执行场景
claude -p "$(cat tests/scenarios/$SCENARIO.md)"

# 检查产出
# ... 用脚本检查 session-log、文件存在性、Hook 配置等
```

### 自动化验证（目标）

类似 ECC 的 `skill-comply`——自动生成场景、跑 AI、检查行为是否符合预期。这是 v0.2+ 的目标。

## Issue 处理流程

### 用户提 Issue

```markdown
## Session Log 反馈
项目: [名] | 日期: [日期] | 模式: [轻量/标准/完整] | Harness 版本: [tag]

### 偏差
1. 方法论要求: [X] → 实际: [Y] → 原因: [为什么] → 建议: [改什么]

### 附件
- session-log.md
```

### 维护者处理

1. **分类** — 方法论问题 / 模板问题 / Hook 问题 / 文档问题
2. **复现** — 用对应版本和场景尝试复现偏差
3. **修改** — 更新 methodology/ 或 templates/
4. **回归** — 用修改后的版本重跑标准场景 + 该 Issue 的场景
5. **确认** — 偏差消除且不引入新偏差
6. **Release** — commit + 打 tag + 更新 release notes

### 标签体系

| 标签 | 含义 |
|------|------|
| `methodology` | 方法论文档需要修改 |
| `template` | 模板/Hook 脚本需要修改 |
| `skill` | Skill 定义需要修改 |
| `experiment` | 需要新的实验验证 |
| `verified` | 修改已通过回归验证 |
| `wontfix` | 分析后认为不需要修改（附理由） |

## 本项目自身的 Harness

simple-harness-kit 自身也应用 Harness 方法论进行维护：

- **Rules**: 在 `.claude/rules/` 中定义项目维护规范
- **Constraints**: `docs/constraints.md` 记录方法论自身的约束（如"场景实例不包含用户自己的操作步骤"）
- **Session Log**: 每次重大修改记录 session-log
- **Feedback Loop**: 用户 Issue → 分析 → 修改 → 验证 → release

方法论用自己来管理自己——dogfooding。
