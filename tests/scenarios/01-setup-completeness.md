# 场景 1：SETUP 完整性

## 前置条件
- 任意已有 TypeScript/Python 项目（有 package.json 或 pyproject.toml）
- 项目无已有 Harness 配置

## 指令

```
读取 ~/path/to/simple-harness-kit/init-prompt.md 和 methodology/ 目录。
帮我初始化 Harness。
```

## 验证清单

- [ ] 生成 `.claude/rules/` 下 ≥4 个规则文件
- [ ] 生成 `scripts/hooks/` 下 ≥6 个 Hook 脚本
- [ ] 生成 `docs/constraints.md`
- [ ] 生成 `.claude/settings.json`，包含 PreToolUse + PostToolUse + PostToolUseFailure 配置
- [ ] Hook 实弹测试通过（AI 主动触发一次拦截并记录结果）
- [ ] `.harness/session-log.md` 已创建并开始记录
- [ ] AI 自动识别了项目技术栈（未要求用户手动提供构建命令）

## 回归风险

如果此场景失败，说明 init 流程或模板有问题——影响所有新用户。
