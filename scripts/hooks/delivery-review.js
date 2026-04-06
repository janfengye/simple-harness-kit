#!/usr/bin/env node
'use strict';

/**
 * Delivery Review Hook — 交付前复盘提醒
 * @version 0.6.1
 * 触发: PreToolUse:Bash
 *
 * 当检测到打开交付物的命令时，提醒进行 5 项复盘检查。
 */

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

    // === 根据项目定制：交付物文件类型 ===
    if (/open\s+.*\.(pptx|pdf|html|zip|apk|ipa|dmg|exe|tar\.gz)/.test(cmd)) {
      process.stderr.write(
        '\n[Delivery Review] 交付前复盘 5 项检查：\n' +
        '  1. 流程合规：是否按 6 阶段 Loop 执行？\n' +
        '  2. QA 达标：各层 QA 报告是否完整？量化指标是否达标？\n' +
        '  3. 需求完整：所有需求是否全部处理？\n' +
        '  4. 规则升级：过程中新问题是否写入 constraints？\n' +
        '  5. 改进机会：哪些步骤下次可以优化？\n\n'
      );
    }
  } catch {}
  process.stdout.write(raw);
});
