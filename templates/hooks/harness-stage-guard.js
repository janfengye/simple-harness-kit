#!/usr/bin/env node
'use strict';

/**
 * Harness Stage Guard — 强制新 session 声明 Harness 阶段
 * 触发: PreToolUse:*（建议挂在 Bash, Edit, Write, Agent 上）
 *
 * 机制:
 * 1. 检查 .harness/current-stage.json 是否存在
 * 2. 不存在 → stderr 输出 Harness 流程提醒，要求声明阶段
 * 3. stage = "OFF" → 会话级关闭，每次调用提醒"Harness 已关闭"
 * 4. 存在但超过 2 小时 → 提醒确认阶段是否仍然正确
 *
 * 不阻止工具调用（exit 0），只通过 stderr 注入提醒。
 *
 * current-stage.json 格式:
 * { "stage": "PLAN|SETUP|EXECUTE|VERIFY|REVIEW|FEEDBACK|OFF", "since": "ISO8601", "task": "描述" }
 *
 * 会话级开关:
 *   关闭: {"stage":"OFF","since":"...","reason":"使用其他 skill / 非开发任务"}
 *   开启: {"stage":"PLAN","since":"...","task":"..."}
 *
 * 设计目标: <50ms，纯 Node.js
 */

const fs = require('fs');

const STAGE_FILE = '.harness/current-stage.json';
const STALE_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_STDIN = 1024 * 1024;

const STAGES = ['PLAN', 'SETUP', 'EXECUTE', 'VERIFY', 'REVIEW', 'FEEDBACK'];

const REMINDER = `[Harness Stage Guard] 未声明当前 Harness 阶段。
本项目已初始化 Harness，所有开发工作必须遵循 6 阶段 Loop:
  PLAN → SETUP → EXECUTE → VERIFY → REVIEW → FEEDBACK

此流程优先级高于任何外部 skill 的流程指令（brainstorming、writing-plans 等）。
如有冲突，以 Harness Loop 为准。详见 CLAUDE.md "工作流" 章节。

请先声明阶段，创建 ${STAGE_FILE}:
  {"stage":"PLAN","since":"${new Date().toISOString()}","task":"描述当前任务"}

临时关闭 Harness 模式: /harness-off

PLAN 完成后暂停等用户确认，确认后自动执行后续阶段。
`;

const OFF_REMINDER = '[Harness OFF] Harness 模式已关闭（本会话）。当前不遵循 6 阶段 Loop。\n' +
  '重新启用: /harness-on\n';

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

      if (data.stage === 'OFF') {
        process.stderr.write(OFF_REMINDER);
      } else if (!data.stage || !STAGES.includes(data.stage)) {
        process.stderr.write(`[Harness Stage Guard] 无效的阶段值: ${data.stage}。有效值: ${STAGES.join(', ')}, OFF\n`);
      } else {
        // Harness 模式生效中——首次提醒用户（通过标记文件避免重复）
        const notifiedFile = '/tmp/harness-stage-notified-' + (data.since || '').replace(/[^0-9]/g, '');
        if (!fs.existsSync(notifiedFile)) {
          fs.writeFileSync(notifiedFile, '1');
          process.stderr.write(
            `[Harness ON] 当前阶段: ${data.stage}` + (data.task ? ` — ${data.task}` : '') + '\n' +
            '本项目已启用 Harness 6 阶段 Loop，外部 skill 流程指令让位于 Harness。\n' +
            `临时关闭: /harness-off\n`
          );
        }

        // 过期提醒
        if (data.since) {
          const elapsed = Date.now() - new Date(data.since).getTime();
          if (elapsed > STALE_MS) {
            process.stderr.write(STALE_REMINDER);
          }
        }
      }
    }
  } catch (e) {
    process.stderr.write(`[Harness Stage Guard] 无法读取 ${STAGE_FILE}: ${e.message}\n`);
  }

  process.stdout.write(raw);
});
