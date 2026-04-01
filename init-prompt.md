# Harness 初始化 Prompt

> 将此文档 + methodology/ 目录一起发给 Claude / Codex，描述你的项目背景，它即可为你生成完整的 Harness 配置。

## 使用方法

复制以下模板，填写你的项目信息，连同本仓库一起发给 AI：

```
我要为 [项目名] 建立 Harness Engineering 开发体系。

请先读取以下材料：
- init-prompt.md（本文件）
- methodology/ 目录下所有文档（00-10）

然后根据我的项目信息，生成完整的 Harness 配置。

## 项目信息

- **项目名称**: [名称]
- **项目描述**: [一句话描述]
- **技术栈**: [语言/框架/工具]
- **当前阶段**: [新建 / 已有代码 / 重构中]
- **团队规模**: [几人协作]
- **Pipeline 阶段**: [阶段1] → [阶段2] → ... → [交付]
- **每阶段产出物**: [阶段1 输出什么]
- **质量标准**: [可度量的验收指标]
- **测试框架**: [已有 / 无 / 使用什么]
- **风险等级**: [低-日常开发 / 中-重要功能 / 高-生产安全]

## AI 工具环境

- **主力工具**: [Claude Code / Codex CLI / 其他]
- **是否支持 Hook**: [是 / 否]
- **是否支持 Skill**: [是 / 否]
- **是否支持独立 Agent**: [是 / 否]

## 需要生成的内容

请按照 methodology/ 中的方法论，为我生成：

1. `.claude/rules/` 下的规则文件
   - role-constraints.md（角色约束）
   - qa-standards.md（QA 量化标准）
   - feedback-workflow.md（反馈处理流程）
   - agent-dispatch.md（Agent 派发规范）

2. `scripts/hooks/` 下的 Hook 脚本
   - safety-guard.js（安全防护）
   - agent-check.js（Agent prompt 合规）
   - verification-gate.js（验证门控）
   - delivery-review.js（交付前复盘）
   - context-monitor.js（上下文预算监控）

3. `.claude/settings.json`（Hooks 配置）

4. `docs/constraints.md`（初始约束系统）

5. `CLAUDE.md`（项目级，精简版指向 rules）

6. `AGENTS.md`（Codex 兼容版本）

所有内容根据我的项目特点定制，不要照搬模板。
```

## 生成后验证

在新 session 中验证：

1. **Rules 加载**：conversation 开头可见规则
2. **Hook 拦截**：故意触发一次违规操作，验证被拦截
3. **Agent 派发**：派一个修复类 Agent，验证是否提示引用 Constraint ID
4. **QA 流程**：执行一次完整的 Verification Loop，验证报告输出
5. **交付复盘**：打开交付物，验证是否触发复盘提醒

## 已有项目加装

如果项目已有代码，额外说明：

```
补充信息：
- 已有的测试覆盖率：[百分比]
- 已有的 CI/CD：[有 / 无，用什么]
- 已有的代码规范：[有 / 无，在哪个文件]
- 需要重点约束的目录：[src/, lib/, ...]
- 已知的质量问题：[列出]
```
