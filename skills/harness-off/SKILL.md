---
name: harness-off
description: 临时关闭 Harness 模式（本会话）。Use when you need to use other skills or do non-development tasks without Harness 6-stage loop.
---

# Harness Off

临时关闭 Harness 6 阶段 Loop（本会话生效）。

## 执行

将 `.harness/current-stage.json` 更新为:

```json
{"stage":"OFF","since":"<当前时间 ISO8601>","reason":"用户执行 /harness-off"}
```

完成后输出:

```
[Harness OFF] Harness 模式已关闭。
当前会话不再遵循 6 阶段 Loop，外部 skill 可正常执行。
重新启用: /harness-on
```
