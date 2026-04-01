# 跨模型对抗 CR

## 为什么需要跨模型

同一个模型审查自己的产出，存在**共同盲区**——模型在生成和审查时可能犯同样的认知错误。

不同模型有不同的训练数据、不同的推理偏好、不同的盲区。交叉审查能捕获单模型无法发现的问题。

```
Claude 生成代码
    ↓
Claude Reviewer → 可能有共同盲区
    ↓
Codex Reviewer  → 不同模型，不同盲区，交叉覆盖
```

## 当前可用方案

### Codex Plugin for Claude Code

OpenAI 已发布 `openai/codex-plugin-cc`，可在 Claude Code 中直接调用 Codex 做 CR：

| 命令 | 能力 |
|------|------|
| `/codex:review` | 对未提交的变更做 CR，只读不改 |
| `/codex:adversarial-review` | 魔鬼代言人模式——挑战设计假设和隐藏依赖 |
| `/codex:setup --enable-review-gate` | 实验性：Codex 自动审查 Claude 产出，不通过则阻止 |

### 在 Santa Method 中使用

Santa Method 的 Phase 2（Check It Twice）天然支持跨模型：

```
Phase 2: Check It Twice

Reviewer A: Claude Agent（独立上下文）
  → 按 rubric 检查

Reviewer B: Codex（通过 /codex:review 或 /codex:adversarial-review）
  → 按相同 rubric 检查

Phase 3: Naughty or Nice
  两个都 PASS → NICE
  任一 FAIL → NAUGHTY → 修复循环
```

## 适用场景

| 场景 | 建议 |
|------|------|
| 日常开发 | Claude self-review 足够 |
| 重要功能上线 | Claude Spec Review + Codex adversarial-review |
| 安全敏感代码 | 强烈建议跨模型 |
| 复杂逻辑/算法 | 跨模型能发现不同类型的逻辑错误 |

## 成本考虑

跨模型 CR 会产生额外的 API 成本（Codex 调用 OpenAI API）。按需使用：
- Layer 3（Spec Review）：Claude 就够
- Layer 4（Santa Method）：高风险时用跨模型，低风险时 Claude 双 Reviewer

## 未来扩展方向

- Gemini 作为第三个 Reviewer（Google 模型的不同视角）
- 本地模型（如 Llama）做初筛，降低成本
- 自动根据变更风险等级决定是否启用跨模型
