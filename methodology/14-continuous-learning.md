# 持续学习：从行为中自动提炼规则

## 两种规则积累方式

```
路径 1: 显式反馈（F1-F5）        路径 2: 隐式学习（continuous-learning）
  人发现问题 → 手动提炼规则         Hook 自动捕获行为 → 分析模式
  ↓                                ↓
  Constraint（强约束，立即生效）     Instinct（弱信号，逐步积累）
  ↓                                ↓
  适合: 明确的质量要求              适合: 渐进的习惯养成
```

路径 1 是核心（F1-F5 反馈闭环），路径 2 是可选补充。

## 安装

基于 ECC 的 [continuous-learning-v2](https://github.com/affaan-m/everything-claude-code)，10 个文件、172K、无外部依赖，单独安装不需要整个 ECC：

```bash
# 从 ECC 仓库复制
cp -r ~/path/to/everything-claude-code/skills/continuous-learning-v2 ~/.claude/skills/

# 或从 GitHub 直接拉取
git clone --depth 1 --filter=blob:none --sparse https://github.com/affaan-m/everything-claude-code.git /tmp/ecc
cd /tmp/ecc && git sparse-checkout set skills/continuous-learning-v2
cp -r skills/continuous-learning-v2 ~/.claude/skills/
rm -rf /tmp/ecc
```

需要 Python 3。

## 工作原理

```
工具调用 → Hook 100% 捕获 → observations.jsonl
    ↓
后台 Observer Agent (Haiku) 分析模式
    ↓
生成 instinct（原子化行为，带置信度 0.3-0.9）
    ↓
/evolve 聚合为 skill/command/agent
```

## 与 Harness 的集成

harness-init 时，如果检测到 `~/.claude/skills/continuous-learning-v2/` 存在，自动在 settings.json 中添加 observe hook。不需要手动配置。

## Instinct → Constraint 打通（规划中）

```
instinct（置信度 ≥ 0.8）→ 自动提议 → 用户确认 → constraints.md 新增 C-XXX-NN
```

隐式学习 → 显式规则 → 强制执行 的完整闭环。

改进设计详见 [docs/design/continuous-learning-improvements.md](../docs/design/continuous-learning-improvements.md)。

## 关闭

`HARNESS_LEARN=off` 或不安装 continuous-learning-v2。不影响 Harness 核心流程。
