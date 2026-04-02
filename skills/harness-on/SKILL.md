---
name: harness-on
description: 重新启用 Harness 模式。Use when you want to resume Harness 6-stage loop after /harness-off.
---

# Harness On

重新启用 Harness 6 阶段 Loop。

## 执行

将 `.harness/current-stage.json` 更新为:

```json
{"stage":"PLAN","since":"<当前时间 ISO8601>","task":"待用户说明"}
```

完成后输出:

```
[Harness ON] Harness 模式已启用，当前阶段: PLAN。
请描述你要做的任务，我将按 6 阶段 Loop 执行:
  PLAN → SETUP → EXECUTE → VERIFY → REVIEW → FEEDBACK
关闭: /harness-off
```
