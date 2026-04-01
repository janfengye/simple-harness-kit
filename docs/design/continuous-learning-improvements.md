# 持续学习改进设计

> 基于 ECC continuous-learning-v2 的分析，针对团队场景的改进方向。

## 改进 1：三级 Instinct 粒度

ECC 原版是"个人全局 ↔ 项目级"两级。团队场景下个人习惯会污染项目级。

```
用户级 instinct（个人的，跟着人走）
    ↓ 同一项目 N 个人出现相同 instinct（N ≥ 2）
    ↓ 自动提议晋升
项目级 instinct（团队共识，写入项目 repo）
    ↓ 多个项目出现相同 instinct
    ↓ 自动提议晋升
组织级 instinct（全公司规范）
```

晋升条件：多个下级实体独立出现相同模式。

## 改进 2：周期性分析报告

自动生成周期性报告（每周或每月）：

```
开发效率报告
============
期间: 2026-03-25 ~ 2026-04-01

Instinct 变化:
  新增: 5 | 置信度提升: 3 | 衰减: 1

高频模式:
  "测试先行" (0.87) — 本周应用 12 次
  "grep-before-edit" (0.92) — 稳定

团队共识候选（多人出现）:
  "API 返回统一格式" — 3/5 开发者出现，建议提升为项目级

改进建议:
  - commit 前忘记跑 lint → 建议启用 verification-gate Hook
  - src/auth/ 修改频率高但覆盖低 → 建议用 harness-test-bootstrap

Token 节省机会:
  - 以下 instinct 已稳定(≥0.9)，可提炼为 Rule: [列表]
```

## 改进 3：Token 优化

稳定的行为不需要每次推理——应该沉淀为更紧凑的形式：

```
instinct (上下文中，占 token，灵活但贵)
    ↓ 置信度稳定 ≥ 0.9
Rule (.claude/rules/，session 开头加载一次，更紧凑)
    ↓ 可以工具级强制
Hook (脚本执行，零 token 占用，100% 可靠)
```

observations.jsonl 归档机制：定期归档旧 observation，只保留摘要。

## 实现优先级

1. **先用 ECC 原版** — 单独安装 continuous-learning-v2，验证基础能力
2. **三级粒度** — 改造 instinct 存储和晋升逻辑
3. **Token 优化** — instinct → Rule 自动提炼
4. **周期性报告** — 后台脚本定期生成
