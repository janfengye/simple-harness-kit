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

## 关闭

设置环境变量 `HARNESS_LEARN=off` 跳过 observe hook。或者直接不安装 continuous-learning-v2。

这是可选能力，不影响 Harness 核心流程。
