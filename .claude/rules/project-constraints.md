# 项目约束

## 本项目性质

这是一个方法论+模板仓库，不是应用代码项目。主要产出物是 Markdown 文档、JS Hook 脚本和 Skill 定义。

## 阶段流转控制

- PLAN 完成后暂停等用户确认，确认后自动执行后续阶段
- 如果 `HARNESS_AUTO=full`，全程自动
- 如果 `HARNESS_AUTO=off`，每个阶段都暂停

## 写作约束

- 默认中文，技术术语和代码保留英文
- README 中英双语（中文在前，英文在后）
- 场景实例只展示 Harness 相关步骤，不教用户做自己的事
- 用户能让 AI 自动扫出的信息（技术栈、构建命令等），场景中不要求用户提供

## 变更约束

- 方法论文档（methodology/）的修改必须有依据（实验反馈 / Issue / 实际偏差）
- Hook 脚本修改后需要验证基本功能（至少 node -c 语法检查）
- 每次 commit 必须带 Co-Authored-By（如果有 AI 参与）

## Session Log

- 每次工具调用自动记录到 .harness/observations.jsonl
- session-log.md 记录关键决策和偏差
- REVIEW 阶段自动运行 harness-learn 分析
