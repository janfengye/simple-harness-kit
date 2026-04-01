#!/usr/bin/env node
'use strict';

/**
 * Session Logger Hook — 自动记录关键动作到 session-log
 * 触发: PostToolUse:Agent, PostToolUse:Bash, PostToolUse:Edit, PostToolUse:Write
 *
 * 在 AI 完成工具调用后，追加一条简要日志。
 * 这确保即使 AI "忘记"手动记录，关键动作也不会丢失。
 */

const fs = require('fs');
const path = require('path');

const LOG_FILE = '.harness/session-log.md';
const MAX_STDIN = 1024 * 1024;

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  if (raw.length < MAX_STDIN) raw += chunk.substring(0, MAX_STDIN - raw.length);
});

process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);
    const tool = input.tool_name || 'unknown';
    const now = new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });

    let entry = '';

    if (tool === 'Agent') {
      const desc = input.tool_input?.description || '';
      const prompt = (input.tool_input?.prompt || '').substring(0, 100);
      entry = `### [${now}] Agent 派发\n- **描述**: ${desc}\n- **Prompt 摘要**: ${prompt}...\n`;
    } else if (tool === 'Bash') {
      const cmd = (input.tool_input?.command || '').substring(0, 150);
      entry = `### [${now}] Bash 执行\n- **命令**: \`${cmd}\`\n`;
    } else if (tool === 'Edit' || tool === 'Write') {
      const filePath = input.tool_input?.file_path || '';
      entry = `### [${now}] ${tool}\n- **文件**: ${filePath}\n`;
    }

    if (entry) {
      // 确保 .harness/ 目录存在
      const dir = path.dirname(LOG_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 如果 session-log 不存在，创建头部
      if (!fs.existsSync(LOG_FILE)) {
        const header =
          '# Harness Session Log\n\n' +
          '## 元信息\n' +
          `- 开始时间: ${new Date().toISOString().slice(0, 16)}\n` +
          '- 工具: Claude Code\n\n' +
          '---\n\n' +
          '## 事件记录\n\n';
        fs.writeFileSync(LOG_FILE, header);
      }

      fs.appendFileSync(LOG_FILE, entry + '\n');
    }
  } catch {}
  // PostToolUse hook 必须输出原始输入
  process.stdout.write(raw);
});
