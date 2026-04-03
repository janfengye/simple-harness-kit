#!/usr/bin/env node
'use strict';

/**
 * Session Logger Hook — 记录关键动作 + 结构化观察数据
 * 触发: PostToolUse:*
 *
 * 两个输出:
 * 1. .harness/session-log.md — 人可读的 Markdown 日志
 * 2. .harness/observations.jsonl — 机器可读的结构化数据（供 harness-learn 分析）
 *
 * 关闭: HARNESS_LOG=off（两个都关）
 * 只关学习数据: HARNESS_LEARN=off（只关 observations.jsonl）
 *
 * 设计目标: <50ms 执行时间，零 fork（纯 Node.js）
 */

const fs = require('fs');
const path = require('path');
const findRoot = require('./find-root');
const ROOT = findRoot();

const LOG_FILE = path.join(ROOT, '.harness/session-log.md');
const OBS_FILE = path.join(ROOT, '.harness/observations.jsonl');
const MAX_STDIN = 1024 * 1024;
const MAX_OBS_SIZE = 10 * 1024 * 1024; // 10MB 归档阈值

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  if (raw.length < MAX_STDIN) raw += chunk.substring(0, MAX_STDIN - raw.length);
});

process.stdin.on('end', () => {
  // 完全关闭
  if (process.env.HARNESS_LOG === 'off') {
    process.stdout.write(raw);
    return;
  }

  try {
    const input = JSON.parse(raw);
    const tool = input.tool_name || 'unknown';
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });

    const dir = path.dirname(LOG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // ── 1. Markdown 日志 ──
    let entry = '';
    if (tool === 'Agent') {
      const desc = input.tool_input?.description || '';
      const prompt = (input.tool_input?.prompt || '').substring(0, 100);
      entry = `### [${timeStr}] Agent 派发\n- **描述**: ${desc}\n- **Prompt 摘要**: ${prompt}...\n`;
    } else if (tool === 'Bash') {
      const cmd = (input.tool_input?.command || '').substring(0, 150);
      entry = `### [${timeStr}] Bash 执行\n- **命令**: \`${cmd}\`\n`;
    } else if (tool === 'Edit' || tool === 'Write') {
      const filePath = input.tool_input?.file_path || '';
      entry = `### [${timeStr}] ${tool}\n- **文件**: ${filePath}\n`;
    }

    if (entry) {
      if (!fs.existsSync(LOG_FILE)) {
        fs.writeFileSync(LOG_FILE,
          '# Harness Session Log\n\n## 元信息\n' +
          `- 开始时间: ${now.toISOString().slice(0, 16)}\n` +
          '- 工具: Claude Code\n\n---\n\n## 事件记录\n\n');
      }
      fs.appendFileSync(LOG_FILE, entry + '\n');
    }

    // ── 2. 结构化观察数据（供 harness-learn 分析）──
    if (process.env.HARNESS_LEARN !== 'off') {
      // 归档过大的文件
      try {
        const stat = fs.statSync(OBS_FILE);
        if (stat.size >= MAX_OBS_SIZE) {
          const archiveDir = path.join(dir, 'observations.archive');
          if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
          fs.renameSync(OBS_FILE, path.join(archiveDir, `observations-${Date.now()}.jsonl`));
        }
      } catch {}

      // 构造观察记录
      const toolInput = input.tool_input || {};
      let inputSummary = '';
      if (tool === 'Bash') inputSummary = (toolInput.command || '').substring(0, 500);
      else if (tool === 'Edit') inputSummary = `${toolInput.file_path || ''} | ${(toolInput.old_string || '').substring(0, 100)}→${(toolInput.new_string || '').substring(0, 100)}`;
      else if (tool === 'Write') inputSummary = toolInput.file_path || '';
      else if (tool === 'Agent') inputSummary = `${toolInput.description || ''} | ${(toolInput.prompt || '').substring(0, 200)}`;
      else if (tool === 'Read') inputSummary = toolInput.file_path || '';
      else if (tool === 'Grep') inputSummary = `${toolInput.pattern || ''} @ ${toolInput.path || '.'}`;

      // 简单脱敏
      inputSummary = inputSummary.replace(/(?:api[_-]?key|token|secret|password|auth)[=:]\s*\S+/gi, '[REDACTED]');

      const observation = {
        t: now.toISOString(),
        tool: tool,
        input: inputSummary,
        session: input.session_id || '',
      };

      fs.appendFileSync(OBS_FILE, JSON.stringify(observation) + '\n');
    }
  } catch {}

  process.stdout.write(raw);
});
