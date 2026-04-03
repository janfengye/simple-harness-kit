#!/usr/bin/env node
'use strict';

/**
 * Verification Gate Hook — 提交前检查 QA 是否完成
 * 触发: PreToolUse:Bash
 *
 * 检测 git commit 命令，如果没有验证报告则阻止提交。
 * 可以通过设置环境变量 HARNESS_SKIP_GATE=1 临时跳过（需记录原因）。
 */

const fs = require('fs');
const MAX_STDIN = 1024 * 1024;
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  if (raw.length < MAX_STDIN) raw += chunk.substring(0, MAX_STDIN - raw.length);
});

process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);
    const cmd = String(input.tool_input?.command || '');

    if (/git\s+(commit|merge)/.test(cmd)) {
      if (process.env.HARNESS_SKIP_GATE === '1') {
        process.stderr.write(
          '[Verification Gate] ⚠ 门控已被 HARNESS_SKIP_GATE=1 跳过，请记录原因。\n'
        );
      } else {
        // === 根据项目定制：验证报告路径 ===
        const reportPaths = [
          'docs/verification-report.md',
          '.harness/last-verification.json',
        ];
        const hasReport = reportPaths.some(p => {
          try { return fs.statSync(p).isFile(); } catch { return false; }
        });

        if (!hasReport) {
          process.stderr.write(
            '[Verification Gate] 未找到验证报告。\n' +
            '→ 请先完成 QA 验证（至少 Layer 2: Verification Loop）。\n' +
            '→ 验证报告应在: ' + reportPaths.join(' 或 ') + '\n'
          );
          process.exit(2);
        }
      }
    }
  } catch {}
  process.stdout.write(raw);
});
