# Harness Kit TODO

## 近期

- [x] ~~**Hook 检查更新机制**~~ — 所有 Hook 添加 @version 注释，update.sh 支持版本比对 + --dry-run (v0.6.1)
- [x] ~~**Skill 便捷分发**~~ — install.sh 已实现一键安装全部 Skills
- [ ] **低测试覆盖项目 TDD 策略 (M-12)** — 方向：先用框架帮项目搭建测试基础设施（以 Planka 为实战），再基于实战经验更新方法论
- [ ] **e2e 环境搭建指南 (M-13)** — init 时检测 docker-compose 等配置，生成快速启动指南
- [x] ~~**Release 时同步模板到本项目**~~ — 已通过删除 templates/hooks/ 解决，scripts/hooks/ 为唯一源 (v0.6.1)
- [x] ~~**Codex init AGENTS.md 未落盘**~~ — init-prompt.md 补注 codex 必须使用 `--full-auto` 或 `-s workspace-write` (v0.6.1)
- [x] ~~**E2E 验收 agent 的 CWD 清理**~~ — 工作区 (ths-harness) 的 .claude/settings.json Hook 命令添加 find-root 前置脚本，从任意 CWD 自动定位项目根 (v0.6.1)

## 持续学习改进（设计文档: docs/design/continuous-learning-improvements.md）

- [ ] 三级 instinct 粒度（用户→项目→组织）— 需要多用户场景验证
- [x] 周期性分析报告 — `--periodic N` 已实现 (v0.3.x)
- [x] 稳定 instinct → Rule 自动晋升 — `--promote` 已实现 (v0.3.x)

## 远期

- [ ] Instinct → Constraint 打通
