#!/usr/bin/env node
'use strict';

/**
 * Context Monitor Hook — 上下文预算监控
 * @version 0.6.1
 * 触发: PreToolUse:Edit, PreToolUse:Write
 *
 * 跟踪工具调用次数，超过阈值时提醒 compact。
 * 防止上下文过长导致规则遵从度下降。
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const COUNTER_FILE = path.join(os.tmpdir(), 'harness-tool-counter.json');
const THRESHOLD = 50;    // 首次提醒阈值
const INTERVAL = 25;     // 后续每隔多少次提醒

const MAX_STDIN = 1024 * 1024;
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  if (raw.length < MAX_STDIN) raw += chunk.substring(0, MAX_STDIN - raw.length);
});

process.stdin.on('end', () => {
  try {
    let counter = { count: 0, session: '' };
    try { counter = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8')); } catch {}

    // 简易 session 检测（基于 PID 的父进程）
    const currentSession = String(process.ppid || '');
    if (counter.session !== currentSession) {
      counter = { count: 0, session: currentSession };
    }

    counter.count++;
    fs.writeFileSync(COUNTER_FILE, JSON.stringify(counter));

    if (counter.count >= THRESHOLD && (counter.count - THRESHOLD) % INTERVAL === 0) {
      process.stderr.write(
        `[Context Monitor] 本 session 已执行 ${counter.count} 次编辑操作。\n` +
        '→ 建议在下一个逻辑阶段边界执行 /compact，防止规则遵从度下降。\n' +
        '→ compact 前确保重要信息已写入文件或 memory。\n'
      );
    }
  } catch {}
  process.stdout.write(raw);
});
