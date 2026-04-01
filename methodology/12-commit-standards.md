# Commit 规范：AI Co-Authored-By 标注

## 为什么要标注

团队需要统计每个人的 AI 代码提交占比，用于：
- 衡量 AI 工具在团队中的实际渗透率
- 分析不同 AI 工具/模型的产出质量
- 作为 AI 转型效果的量化指标
- 审计和追溯：哪些代码是 AI 写的、用了什么模型

## Co-Authored-By 格式

所有由 AI 工具生成或协助完成的 commit，必须在 commit message 末尾添加：

```
Co-Authored-By: {工具名} {模型型号} <{邮箱}>
```

### 各工具的标准格式

| 工具 | 格式 |
|------|------|
| Claude Code | `Co-Authored-By: Claude Code (claude-opus-4-6)` |
| Claude Code (Sonnet) | `Co-Authored-By: Claude Code (claude-sonnet-4-6)` |
| Claude Code (Haiku) | `Co-Authored-By: Claude Code (claude-haiku-4-5)` |
| Codex CLI | `Co-Authored-By: Codex CLI (gpt-5.3-codex)` |
| Cursor | `Co-Authored-By: Cursor (claude-sonnet-4-6)` |
| Cursor (GPT) | `Co-Authored-By: Cursor (gpt-5.3)` |
| Windsurf | `Co-Authored-By: Windsurf (claude-sonnet-4-6)` |
| GitHub Copilot | `Co-Authored-By: GitHub Copilot (gpt-5.3)` |
| OpenCode | `Co-Authored-By: OpenCode (gemini-3.1-pro)` |

### 格式规则

```
Co-Authored-By: {工具名} ({模型ID})
                 ↑           ↑
             工具品牌名    具体模型ID
```

- **工具名**：用户使用的 AI 工具品牌（Claude Code / Codex CLI / Cursor 等）
- **模型ID**：实际调用的模型标识（claude-opus-4-6 / gpt-5.3-codex 等）

### 多个 AI 工具协作

如果一次 commit 涉及多个 AI 工具（比如 Claude 写代码 + Codex review），每个工具一行：

```
feat: add search functionality to magazine page

Implement real-time article search with a11y support.

Co-Authored-By: Claude Code (claude-opus-4-6)
Co-Authored-By: Codex CLI (gpt-5.3-codex)
```

### 纯人工 commit

如果 commit 完全由人手动编写（没有任何 AI 辅助），不需要 Co-Authored-By。

### 部分 AI 辅助

即使只是 AI 帮忙生成了部分代码（比如用 Copilot 补全了几行），也必须标注。标注的是"有 AI 参与"，不是"AI 写了全部"。

## Commit Message 完整格式

```
{type}: {简短描述}

{详细描述（可选）}

Co-Authored-By: {工具名} ({模型ID})
```

type 遵循 Conventional Commits：feat / fix / refactor / test / docs / chore / perf / ci

## 统计方法

基于 Co-Authored-By 可以统计：

```bash
# 统计某人的 AI 辅助 commit 数
git log --author="Doug Du" --grep="Co-Authored-By:" --oneline | wc -l

# 统计各 AI 工具的 commit 数
git log --grep="Co-Authored-By: Claude Code" --oneline | wc -l
git log --grep="Co-Authored-By: Codex CLI" --oneline | wc -l

# 统计各模型的 commit 数
git log --grep="claude-opus-4-6" --oneline | wc -l
git log --grep="claude-sonnet-4-6" --oneline | wc -l

# AI 辅助 commit 占比
total=$(git log --oneline | wc -l)
ai=$(git log --grep="Co-Authored-By:" --oneline | wc -l)
echo "AI 辅助占比: $ai / $total"
```

## Hook 强制执行

通过 Hook 在 commit 前检查：如果当前 session 是 AI 工具，commit message 必须包含 Co-Authored-By。

详见 `templates/hooks/commit-check.js`。
