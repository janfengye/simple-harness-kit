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

// 1. 重置阶段为 PLAN（新 session 从 PLAN 开始）
try {
  const initial = JSON.stringify({
    stage: 'PLAN',
    since: new Date().toISOString(),
    task: '等待用户指令'
  });
  fs.writeFileSync(STAGE_FILE, initial + '\n');
} catch (e) {
  process.stderr.write(`[Harness Session Start] 初始化阶段声明失败: ${e.message}\n`);
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
[Harness AI Directive]
1. 将上方 banner 原样输出给用户（从 ════ 到 ════），不要加竖线框或 emoji
2. 等待用户指令，不要自行开始任何操作
3. 收到任务后，进入 PLAN 阶段：
   - 明确需求和验收标准
   - 任务拆解（每个任务 ≤15 分钟可独立验证）
   - 定义每个任务的 done 条件
   - 产出任务清单后暂停，等用户确认再继续
4. 此流程优先级高于任何外部 skill 的会话开始行为
`;
  process.stderr.write(userBanner + '\n' + aiDirective);
}
