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

不要在这份手工清单里复述具体事件/matcher/文件清单（VH-08 教训：副本文案必然漂移）。改为运行可执行守门：

- [ ] 在被测项目根目录运行 `bash <kit-path>/tests/e2e-acceptance-validate.sh`，全 PASS（含 A-H 全部检查项，实际事件/matcher/wiring 集合从 `tests/required-wiring.json` 派生）
- [ ] AI 自动识别了项目技术栈（未要求用户手动提供构建命令）
- [ ] AI 在 init 完成后真的输出了 init-prompt.md 描述的"完整性检查清单"
- [ ] 验收完成后必须用 **两种入口** 各跑一次（C-GATE-06）：
  - [ ] (a) 直接读 init-prompt.md 入口
  - [ ] (b) /harness-init slash command 入口

## 不要做什么

- 不要在本文件硬编码"必选 X 个事件"或"必须有 PreToolUse/PostToolUse 等"的清单 —— 这是 VH-08 的同类失效模式（副本与 required-wiring.json 漂移）。需要新增某事件就改 `tests/required-wiring.json`，让 validate.sh 自动反映。

## 回归风险

如果此场景失败，说明 init 流程或模板有问题——影响所有新用户。
