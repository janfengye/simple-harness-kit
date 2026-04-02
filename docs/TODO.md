# Harness Kit TODO

## 近期

- [ ] **Hook 检查更新机制** — Hook 生成到用户项目后成为本地副本，模板修 bug 后无法同步。方向：版本号比对、harness-update 命令、或 hook 文件头标注 template 版本。
- [ ] **Skill 便捷分发** — 当前逐个 `claude skill install <path>` 太麻烦。方向：`npx harness-kit install` 一键安装，或 skill 市场机制。

## 持续学习改进（设计文档: docs/design/continuous-learning-improvements.md）

- [ ] 三级 instinct 粒度（用户→项目→组织）
- [ ] 周期性分析报告
- [ ] 稳定 instinct → Rule → Hook（token 优化）

## 远期

- [ ] Instinct → Constraint 打通
