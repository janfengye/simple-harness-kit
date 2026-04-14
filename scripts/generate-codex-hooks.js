#!/usr/bin/env node
// generate-codex-hooks.js — 从 Claude Code settings.json 生成 Codex hooks.json
//
// 用法:
//   node generate-codex-hooks.js --input .claude/settings.json --output .codex/hooks.json
//   node generate-codex-hooks.js < .claude/settings.json > .codex/hooks.json
//
// Codex 支持的事件: SessionStart, PreToolUse, PostToolUse, Stop, UserPromptSubmit
// 不支持的事件会被静默移除: PostToolUseFailure, StopFailure, TaskCompleted, SessionEnd
//
// Matcher 不做过滤 — Codex 对非 Bash matcher 静默跳过，保留完整 matcher
// 有利于未来 Codex 支持更多 tool_name 时自动生效。

'use strict';

const fs = require('fs');
const path = require('path');

const CODEX_SUPPORTED_EVENTS = new Set([
  'SessionStart',
  'PreToolUse',
  'PostToolUse',
  'Stop',
  'UserPromptSubmit'
]);

function filterForCodex(settingsJson) {
  const settings = JSON.parse(settingsJson);
  if (!settings.hooks) {
    return JSON.stringify(settings, null, 2);
  }

  const filtered = {};
  for (const [event, handlers] of Object.entries(settings.hooks)) {
    if (CODEX_SUPPORTED_EVENTS.has(event)) {
      filtered[event] = handlers;
    }
  }

  return JSON.stringify({ hooks: filtered }, null, 2);
}

// 解析参数
let inputPath = null;
let outputPath = null;

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--input' && args[i + 1]) {
    inputPath = args[++i];
  } else if (args[i] === '--output' && args[i + 1]) {
    outputPath = args[++i];
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log('用法: node generate-codex-hooks.js [--input <path>] [--output <path>]');
    console.log('');
    console.log('从 Claude Code settings.json 生成 Codex hooks.json');
    console.log('过滤掉 Codex 不支持的事件 (PostToolUseFailure/StopFailure/TaskCompleted/SessionEnd)');
    console.log('');
    console.log('  --input <path>   输入文件 (默认: stdin)');
    console.log('  --output <path>  输出文件 (默认: stdout)');
    process.exit(0);
  }
}

// 读入
let input;
try {
  if (inputPath) {
    input = fs.readFileSync(inputPath, 'utf8');
  } else if (!process.stdin.isTTY) {
    input = fs.readFileSync('/dev/stdin', 'utf8');
  } else {
    console.error('错误: 未指定输入。用 --input <path> 或管道输入。');
    process.exit(1);
  }
} catch (err) {
  console.error(`错误: 无法读取输入 — ${err.message}`);
  process.exit(1);
}

// 过滤
let output;
try {
  output = filterForCodex(input);
} catch (err) {
  console.error(`错误: JSON 解析失败 — ${err.message}`);
  process.exit(1);
}

// 写出
try {
  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, output + '\n', 'utf8');
    console.error(`已生成: ${outputPath}`);
  } else {
    process.stdout.write(output + '\n');
  }
} catch (err) {
  console.error(`错误: 无法写入输出 — ${err.message}`);
  process.exit(1);
}
