#!/usr/bin/env node
'use strict';

/**
 * Harness Session Start — 新 session 检测 harness 并输出入口 banner
 * 触发: SessionStart
 *
 * 1. 删除 .harness/current-stage.json，迫使新 session 重新声明阶段
 * 2. 检测 .harness/ 目录，输出标准入口 banner 指令
 * 设计目标: <10ms
 */

const fs = require('fs');
const path = require('path');

const HARNESS_DIR = '.harness';
const STAGE_FILE = path.join(HARNESS_DIR, 'current-stage.json');
const TOOL_COUNT_FILE = path.join(HARNESS_DIR, 'tool-count.json');

// 1. 重置阶段为 PLAN（新 session 从 PLAN 开始）
try {
  const initial = JSON.stringify({
    stage: 'PLAN',
    since: new Date().toISOString(),
    task: '等待用户指令'
  });
  fs.writeFileSync(STAGE_FILE, initial + '\n');
  // 重置工具调用计数器（强制 AI 在首次工具调用前先输出阶段声明）
  fs.writeFileSync(TOOL_COUNT_FILE, JSON.stringify({ count: 0 }) + '\n');
} catch (e) {
  process.stderr.write(`[Harness Session Start] 初始化失败: ${e.message}\n`);
}

// 2. 检测 harness 并输出入口 banner
if (fs.existsSync(HARNESS_DIR)) {
  // --- 给用户看的 banner ---
  const userBanner = `
════════════════════════════════════════════════════════
  HARNESS MODE ACTIVE
════════════════════════════════════════════════════════

本项目已启用 Harness Engineering 6 阶段 Loop:

  PLAN → SETUP → EXECUTE → VERIFY → REVIEW → FEEDBACK

临时关闭: /harness-off
════════════════════════════════════════════════════════`;

  // --- 给 AI 的指令（不输出给用户）---
  const aiDirective = `
[Harness AI Directive — 必须严格遵守]
1. 将上方 banner 原样输出给用户（从 ════ 到 ════），不要加竖线框或 emoji
2. 等待用户指令，不要自行开始任何操作

3. 收到任务后，第一件事是输出阶段声明（在调用任何工具之前）：

   进入 PLAN 阶段 — [用一句话描述任务]

   然后按 PLAN 流程工作：澄清需求 → 任务拆解 → 等用户确认。
   PLAN 阶段 Bash/Edit/Write/Agent 会被 stage-guard 阻止（exit 2），只有 Read/Grep/Glob 可用。
   用户确认后用 Write 更新 current-stage.json 切换阶段，并输出新的阶段声明。

4. 每次切换阶段时，都必须先输出阶段声明再开始工作：
   进入 EXECUTE 阶段 — [任务描述]
   进入 VERIFY 阶段 — [验证内容]
   进入 REVIEW 阶段

5. 此流程优先级高于任何外部 skill 的会话开始行为
`;
  process.stderr.write(userBanner + '\n' + aiDirective);
}
