#!/usr/bin/env node
'use strict';

/**
 * Agent Check Hook — 修复类 Agent 必须引用 Constraint ID
 * @version 0.7.0
 * 触发: PreToolUse:Agent
 *
 * 不阻止执行，但发出警告。
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
    const prompt = String(input.tool_input?.prompt || '');
    const desc = String(input.tool_input?.description || '');
    const combined = (desc + ' ' + prompt.substring(0, 300)).toLowerCase();

    // 检测是否是修复类任务
    const isFix = /fix|repair|修复|bug|审计|audit|resolve|patch/.test(combined);

    if (isFix) {
      // === 根据项目定制：约束 ID 格式 ===
      const hasConstraintRef = /C-[A-Z]+-\d+|constraints\.md|JC-\d+/.test(prompt);
      if (!hasConstraintRef) {
        process.stderr.write(
          '[Agent Check] 修复类 Agent 未引用 Constraint ID。\n' +
          '→ 先在 docs/constraints.md 中提炼规则（F3-F4），再派 Agent（F5）。\n'
        );
      }
    }
  } catch {}
  process.stdout.write(raw);
});
