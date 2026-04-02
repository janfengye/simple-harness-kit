#!/usr/bin/env node
'use strict';

/**
 * Harness Stage Guard — 强制新 session 声明 Harness 阶段
 * 触发: PreToolUse:*（建议挂在 Bash, Edit, Write, Agent 上）
 *
 * 机制:
 * 1. 检查 .harness/current-stage.json 是否存在
 * 2. 不存在 → stderr 输出 Harness 流程提醒，要求声明阶段
 * 3. 存在但超过 2 小时 → 提醒确认阶段是否仍然正确
 *
 * 不阻止工具调用（exit 0），只通过 stderr 注入提醒。
 * Agent 应在收到提醒后创建 .harness/current-stage.json。
 *
 * current-stage.json 格式:
 * { "stage": "PLAN|SETUP|EXECUTE|VERIFY|REVIEW|FEEDBACK", "since": "ISO8601", "task": "描述" }
 *
 * 设计目标: <50ms，纯 Node.js
 */

const fs = require('fs');
const path = require('path');

const STAGE_FILE = '.harness/current-stage.json';
const STALE_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_STDIN = 1024 * 1024;

const STAGES = ['PLAN', 'SETUP', 'EXECUTE', 'VERIFY', 'REVIEW', 'FEEDBACK'];

const REMINDER = `[Harness Stage Guard] 未声明当前 Harness 阶段。
按 Harness 6 阶段 Loop 执行:
  PLAN → SETUP → EXECUTE → VERIFY → REVIEW → FEEDBACK

请先声明阶段，创建 ${STAGE_FILE}:
  {"stage":"PLAN","since":"${new Date().toISOString()}","task":"描述当前任务"}

PLAN 完成后暂停等用户确认，确认后自动执行后续阶段。
`;

const STALE_REMINDER = `[Harness Stage Guard] 当前阶段声明已超过 2 小时，请确认是否仍在该阶段。
如已进入下一阶段，请更新 ${STAGE_FILE}。
`;

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  if (raw.length < MAX_STDIN) raw += chunk.substring(0, MAX_STDIN - raw.length);
});

process.stdin.on('end', () => {
  try {
    if (!fs.existsSync(STAGE_FILE)) {
      process.stderr.write(REMINDER);
    } else {
      const data = JSON.parse(fs.readFileSync(STAGE_FILE, 'utf8'));

      if (!data.stage || !STAGES.includes(data.stage)) {
        process.stderr.write(`[Harness Stage Guard] 无效的阶段值: ${data.stage}。有效值: ${STAGES.join(', ')}\n`);
      } else if (data.since) {
        const elapsed = Date.now() - new Date(data.since).getTime();
        if (elapsed > STALE_MS) {
          process.stderr.write(STALE_REMINDER);
        }
      }
    }
  } catch (e) {
    // 读取/解析失败时也提醒
    process.stderr.write(`[Harness Stage Guard] 无法读取 ${STAGE_FILE}: ${e.message}\n`);
  }

  process.stdout.write(raw);
});
