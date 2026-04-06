#!/usr/bin/env node
'use strict';

/**
 * Verification Gate Hook — commit/push 前的阶段和证据检查
 * @version 0.6.1
 * 触发: PreToolUse:Bash
 *
 * 三重检查:
 * 1. commit 阶段检查: 必须在 VERIFY/REVIEW/FEEDBACK 才能 commit
 * 2. 证据时效性: 验证证据文件的 mtime 必须晚于 current-stage.json 的 since
 * 3. push 阶段检查: 必须在 REVIEW 才能 push
 *
 * 环境变量 HARNESS_SKIP_GATE=1 临时跳过（需记录原因）。
 *
 * 设计目标: <50ms
 */

const fs = require('fs');
const path = require('path');
const findRoot = require('./find-root');
const ROOT = findRoot();

const MAX_STDIN = 1024 * 1024;

const STAGE_FILE = path.join(ROOT, '.harness/current-stage.json');
const COMMIT_ALLOWED_STAGES = ['VERIFY', 'REVIEW', 'FEEDBACK'];
const PUSH_ALLOWED_STAGES = ['REVIEW'];
const REPORT_PATHS = [
  path.join(ROOT, 'docs/verification-report.md'),
  path.join(ROOT, '.harness/last-verification.json'),
  path.join(ROOT, '.harness/verify-evidence.md'),
];

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  if (raw.length < MAX_STDIN) raw += chunk.substring(0, MAX_STDIN - raw.length);
});

process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);
    const cmd = String(input.tool_input?.command || '');

    const isCommit = /git\s+(commit|merge)/.test(cmd);
    const isPush = /git\s+push/.test(cmd);

    if (!isCommit && !isPush) {
      // 非 git commit/push 命令，直接透传
      process.stdout.write(raw);
      return;
    }

    // HARNESS_SKIP_GATE 跳过
    if (process.env.HARNESS_SKIP_GATE === '1') {
      process.stderr.write(
        '[Verification Gate] 门控已被 HARNESS_SKIP_GATE=1 跳过，请记录原因。\n'
      );
      process.stdout.write(raw);
      return;
    }

    // 读取当前阶段
    let stage = null;
    let stageSince = null;
    try {
      const data = JSON.parse(fs.readFileSync(STAGE_FILE, 'utf8'));
      stage = data.stage;
      stageSince = data.since ? new Date(data.since) : null;
    } catch {}

    if (!stage) {
      process.stderr.write(
        '[Verification Gate] 无法确定当前阶段（.harness/current-stage.json 不存在或无效）。\n' +
        '→ git commit/push 需要在 Harness 阶段声明后才能执行。\n'
      );
      process.exit(2);
    }

    // ── push 阶段检查 ──
    if (isPush) {
      if (!PUSH_ALLOWED_STAGES.includes(stage)) {
        process.stderr.write(
          `[Verification Gate] push 只允许在 REVIEW 阶段。当前阶段: ${stage}。\n` +
          '→ 完成 VERIFY 和 REVIEW 后再 push。\n'
        );
        process.exit(2);
      }
      // REVIEW 阶段 push 放行
      process.stdout.write(raw);
      return;
    }

    // ── commit 阶段检查 ──
    if (isCommit) {
      if (!COMMIT_ALLOWED_STAGES.includes(stage)) {
        process.stderr.write(
          `[Verification Gate] 当前阶段 ${stage} 不允许 commit。\n` +
          `→ commit 只允许在: ${COMMIT_ALLOWED_STAGES.join(', ')}。\n` +
          '→ 先完成 EXECUTE，进入 VERIFY 产出验证证据后再 commit。\n'
        );
        process.exit(2);
      }

      // ── 验证证据检查 ──
      let freshReport = null;
      for (const p of REPORT_PATHS) {
        try {
          const stat = fs.statSync(p);
          if (stat.isFile()) {
            freshReport = { path: p, mtime: stat.mtime };
            break;
          }
        } catch {}
      }

      if (!freshReport) {
        process.stderr.write(
          '[Verification Gate] 未找到验证报告。\n' +
          '→ 请先完成 QA 验证，产出证据文件。\n' +
          '→ 验证报告应在: ' + REPORT_PATHS.join(' 或 ') + '\n'
        );
        process.exit(2);
      }

      // ── 证据时效性检查 ──
      if (stageSince && freshReport.mtime < stageSince) {
        process.stderr.write(
          `[Verification Gate] 验证证据早于当前任务开始时间，可能是上一轮残留。\n` +
          `→ 证据文件: ${freshReport.path}（修改于 ${freshReport.mtime.toISOString()}）\n` +
          `→ 当前任务开始: ${stageSince.toISOString()}\n` +
          '→ 请重新运行验证，产出新的证据文件。\n'
        );
        process.exit(2);
      }
    }
  } catch {}
  process.stdout.write(raw);
});
