# 持续学习：从行为中自动提炼规则

## 两种规则积累方式

Harness Kit 有两种规则积累路径：

```
路径 1: 显式反馈（F1-F5）        路径 2: 隐式学习（continuous-learning）
  人发现问题 → 手动提炼规则         Hook 自动捕获行为 → 分析模式
  ↓                                ↓
  Constraint（强约束，立即生效）     Instinct（弱信号，逐步积累）
  ↓                                ↓
  适合: 明确的质量要求              适合: 渐进的习惯养成
```

路径 1 是我们的核心（F1-F5 反馈闭环），路径 2 是补充——通过集成 ECC 的 continuous-learning-v2 实现。

## 什么是 Continuous Learning

来自 [Everything Claude Code](https://github.com/affaan-m/everything-claude-code) 的一个独立 Skill（10 个文件，172K，无外部依赖），可以单独安装不需要装整个 ECC。

核心机制：

```
工具调用 → Hook 100% 捕获 → observations.jsonl
    ↓
后台 Observer Agent (Haiku, 低成本) 分析模式
    ↓
生成 instinct（原子化行为片段）:
  - 用户纠正 → "不要用 class，用 functional"
  - 错误解决 → "这类错误先检查 env"
  - 重复工作流 → "每次都是 grep → read → edit"
    ↓
instinct 带置信度 0.3-0.9，随使用升降
    ↓
/evolve 命令聚合为 skill/command/agent
```

### 关键设计

- **原子化**：每个 instinct 只有一个 trigger + 一个 action
- **置信度**：0.3(试探) → 0.7(自动应用) → 0.9(核心行为)
- **项目隔离**：React 的 instinct 不会污染 Python 项目
- **晋升机制**：同一 instinct 在 2+ 项目出现 + 置信度 ≥0.8 → 自动晋升全局

## 安装方式

只安装这一个 Skill，不需要整个 ECC：

```bash
# 从 ECC 仓库复制（如果本地有）
cp -r ~/path/to/everything-claude-code/skills/continuous-learning-v2 ~/.claude/skills/

# 或从 GitHub 直接下载
git clone --depth 1 --filter=blob:none --sparse https://github.com/affaan-m/everything-claude-code.git /tmp/ecc
cd /tmp/ecc && git sparse-checkout set skills/continuous-learning-v2
cp -r skills/continuous-learning-v2 ~/.claude/skills/
rm -rf /tmp/ecc
```

需要 Python 3 环境（instinct-cli.py 依赖）。

## 与 Harness 的集成

harness-init 时，如果检测到 `~/.claude/skills/continuous-learning-v2/` 存在，自动在 settings.json 中添加 observe hook：

```json
{
  "PreToolUse": [{
    "matcher": "*",
    "hooks": [{
      "type": "command",
      "command": "~/.claude/skills/continuous-learning-v2/hooks/observe.sh"
    }]
  }],
  "PostToolUse": [{
    "matcher": "*",
    "hooks": [{
      "type": "command",
      "command": "~/.claude/skills/continuous-learning-v2/hooks/observe.sh"
    }]
  }]
}
```

## Instinct → Constraint 打通（规划中）

目前两个体系是独立的。后续计划打通：

```
instinct（置信度 ≥ 0.8, 出现在 2+ 项目）
    ↓ 自动提议
"建议将以下 instinct 升级为 Constraint：
 [instinct 内容]
 置信度: 0.85, 出现在 3 个项目"
    ↓ 用户确认
constraints.md 新增 C-XXX-NN
    ↓
正式成为强约束（有 ID，Hook 强制执行）
```

这样就形成了完整闭环：**隐式学习 → 显式规则 → 强制执行**。

## 我们的改进方向（vs ECC 原版）

ECC 的 continuous-learning-v2 是很好的基础，但在团队场景下有几个需要改进的地方：

### 改进 1：三级粒度——用户 → 项目 → 组织

ECC 原版是"个人全局 ↔ 项目级"两级，但在团队场景下不够：

```
ECC 原版:
  用户全局 instinct ←→ 项目级 instinct
                        ↑ 问题：项目级混入了个人习惯

我们的改进:
  用户级 instinct（个人的，跟着人走）
      ↓ 同一项目 N 个人出现相同 instinct（N ≥ 2）
      ↓ 自动提议晋升
  项目级 instinct（团队共识，写入项目 repo）
      ↓ 多个项目出现相同 instinct
      ↓ 自动提议晋升
  组织级 instinct（全公司规范）
```

**关键区别：** 个人习惯不应该污染项目级别。只有当多个开发者在同一个项目上独立形成了相同的 instinct，才说明这是团队共识，值得提升为项目级。

### 改进 2：周期性分析报告

ECC 只有手动 `/evolve` 和 `/instinct-status`，缺少主动的周期性分析。

应该自动生成周期性报告（每周或每月）：

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
  - 你经常在 commit 前忘记跑 lint → 建议启用 verification-gate Hook
  - src/auth/ 修改频率高但测试覆盖低 → 建议用 harness-test-bootstrap

Token 节省机会:
  - 以下 instinct 已稳定(≥0.9)，可提炼为 Rule: [列表]
```

### 改进 3：Token 优化——稳定 instinct 沉淀为 Rule/Hook

Instinct 存在于上下文中，每次推理都消耗 token。但**稳定的行为不需要每次"想一想"——应该沉淀为更紧凑的形式**：

```
Token 消耗递减路径:

instinct (在推理上下文中，占 token，灵活但贵)
    ↓ 置信度稳定 ≥ 0.9，提炼为
Rule (.claude/rules/，session 开头加载一次，更紧凑)
    ↓ 如果可以工具级强制，进一步提炼为
Hook (脚本执行，零 token 占用，100% 可靠)
```

同时，observations.jsonl 应该有归档和摘要机制——不能无限增长。定期归档旧 observation，只保留摘要供 Observer 分析。

### 改进 4：线上化运营（OpenClaw 方向）

以上改进的终极形态是线上化平台，支持：

- **团队仪表盘**：可视化各成员的 instinct 分布和成长
- **审批流**：项目级/组织级 instinct 晋升需要 lead 确认
- **周期性报告自动推送**：邮件/Slack/飞书
- **跨项目最佳实践沉淀**：组织级 instinct 库
- **AI 运营自动化**：自动识别改进机会并推送行动建议

这对应将 Harness Engineering 从"开发者工具"升级为"团队效能平台"。

## 关闭

设置环境变量 `HARNESS_LEARN=off` 跳过 observe hook。或者直接不安装 continuous-learning-v2。

这是可选能力，不影响 Harness 核心流程。
