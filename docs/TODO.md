# Harness Kit TODO

## 近期

- [ ] **Hook 检查更新机制** — Hook 生成到用户项目后成为本地副本，模板修 bug 后无法同步。方向：版本号比对、harness-update 命令、或 hook 文件头标注 template 版本。
- [ ] **Skill 便捷分发** — 当前逐个 `claude skill install <path>` 太麻烦。方向：`npx harness-kit install` 一键安装，或 skill 市场机制。
- [ ] **低测试覆盖项目 TDD 策略 (M-12)** — 方法论需要对测试基础设施弱的项目给出分级指导
- [ ] **e2e 环境搭建指南 (M-13)** — init 时检测 docker-compose 等配置，生成快速启动指南

## 持续学习改进（设计文档: docs/design/continuous-learning-improvements.md）

- [ ] 三级 instinct 粒度（用户→项目→组织）— 需要多用户场景验证
- [x] 周期性分析报告 — `--periodic N` 已实现 (v0.3.x)
- [x] 稳定 instinct → Rule 自动晋升 — `--promote` 已实现 (v0.3.x)

## 远期

- [ ] Instinct → Constraint 打通
