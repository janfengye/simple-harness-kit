#!/usr/bin/env node
'use strict';

/**
 * Hook 自动化功能测试 Runner
 *
 * 用法: node tests/run.js [--filter <pattern>]
 *
 * 场景格式 (JSON):
 * {
 *   "name": "场景描述",
 *   "hook": "xxx.js",                     // scripts/hooks/ 下的文件名
 *   "stdin": { ... },                      // 喂给 hook 的 JSON stdin
 *   "env": { "KEY": "val" },              // 可选环境变量
 *   "setup": {                             // 可选：在临时目录中预创建文件
 *     ".harness/current-stage.json": "{\"stage\":\"PLAN\",\"since\":\"...\",\"task\":\"test\"}"
 *   },
 *   "expect": {
 *     "exitCode": 0,                       // 预期 exit code
 *     "stderr": ["关键词1"],               // stderr 必须包含
 *     "stderrNot": ["不应出现"],           // stderr 必须不包含
 *     "stdout": "passthrough",             // "passthrough" = stdout 应等于 stdin
 *     "files": {                           // 可选：检查输出文件
 *       ".harness/observations.jsonl": { "contains": "tool" }
 *     }
 *   }
 * }
 *
 * 每个场景在独立临时目录中运行，互不干扰。
 */

const { execFileSync, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOKS_BASE = path.resolve(__dirname, '..', 'scripts', 'hooks');
const SCENARIOS_DIR = path.join(__dirname, 'hook-scenarios');

// ── 解析参数 ──

const args = process.argv.slice(2);
const filterIdx = args.indexOf('--filter');
const filter = filterIdx !== -1 ? args[filterIdx + 1] : null;

// ── 收集场景文件 ──

function loadScenarios() {
  if (!fs.existsSync(SCENARIOS_DIR)) {
    console.error(`场景目录不存在: ${SCENARIOS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(SCENARIOS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();

  const scenarios = [];
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(SCENARIOS_DIR, f), 'utf8'));
      // 支持单个场景或场景数组
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        item._file = f;
        if (!filter || item.name.includes(filter) || f.includes(filter)) {
          scenarios.push(item);
        }
      }
    } catch (e) {
      console.error(`加载失败 ${f}: ${e.message}`);
    }
  }
  return scenarios;
}

// ── 创建临时目录并预置文件 ──

function setupTempDir(scenario) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-test-'));

  if (scenario.setup) {
    // 支持动态时间戳占位符
    const recentTs = new Date(Date.now() - 60 * 1000).toISOString(); // 1 分钟前
    for (const [filePath, rawContent] of Object.entries(scenario.setup)) {
      const content = rawContent.replace(/RECENT_TIMESTAMP/g, recentTs);
      const fullPath = path.join(tmpDir, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
    }
  }

  return tmpDir;
}

// ── 运行单个场景 ──

function runScenario(scenario) {
  const hookPath = path.join(HOOKS_BASE, scenario.hook);
  if (!fs.existsSync(hookPath)) {
    return { pass: false, reason: `Hook 不存在: ${hookPath}` };
  }

  const tmpDir = setupTempDir(scenario);
  const stdinData = scenario.stdin ? JSON.stringify(scenario.stdin) : '';
  const env = {
    ...process.env,
    ...(scenario.env || {}),
  };

  const errors = [];

  try {
    let stdout = '';
    let stderr = '';
    let exitCode = 0;

    try {
      const result = require('child_process').spawnSync(
        process.execPath, [hookPath],
        {
          input: stdinData,
          cwd: tmpDir,
          env,
          timeout: 5000,
          encoding: 'utf8',
        }
      );
      stdout = result.stdout || '';
      stderr = result.stderr || '';
      exitCode = result.status ?? 1;
    } catch (e) {
      exitCode = e.status ?? 1;
      stderr = e.stderr || '';
      stdout = e.stdout || '';
    }

    const expect = scenario.expect || {};

    // 检查 exit code
    if (expect.exitCode !== undefined && exitCode !== expect.exitCode) {
      errors.push(`exit code: 期望 ${expect.exitCode}, 实际 ${exitCode}`);
    }

    // 检查 stderr 包含
    if (expect.stderr) {
      for (const keyword of expect.stderr) {
        if (!stderr.includes(keyword)) {
          errors.push(`stderr 未包含: "${keyword}"`);
        }
      }
    }

    // 检查 stderr 不包含
    if (expect.stderrNot) {
      for (const keyword of expect.stderrNot) {
        if (stderr.includes(keyword)) {
          errors.push(`stderr 不应包含: "${keyword}"`);
        }
      }
    }

    // 检查 stdout passthrough
    if (expect.stdout === 'passthrough') {
      if (stdout.trim() !== stdinData.trim()) {
        errors.push('stdout 未透传 stdin');
      }
    }

    // 检查输出文件
    if (expect.files) {
      for (const [filePath, check] of Object.entries(expect.files)) {
        const fullPath = path.join(tmpDir, filePath);
        if (check.exists === false) {
          if (fs.existsSync(fullPath)) {
            errors.push(`文件不应存在: ${filePath}`);
          }
        } else {
          if (!fs.existsSync(fullPath)) {
            errors.push(`文件不存在: ${filePath}`);
          } else if (check.contains) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (!content.includes(check.contains)) {
              errors.push(`文件 ${filePath} 未包含: "${check.contains}"`);
            }
          }
        }
      }
    }
  } finally {
    // 清理临时目录
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  return errors.length === 0
    ? { pass: true }
    : { pass: false, reason: errors.join('; ') };
}

// ── 主流程 ──

const scenarios = loadScenarios();
console.log(`\n  Hook 功能测试 — ${scenarios.length} 个场景\n`);

let passed = 0;
let failed = 0;
const failures = [];

for (const s of scenarios) {
  const result = runScenario(s);
  if (result.pass) {
    passed++;
    console.log(`  PASS  ${s.name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${s.name}`);
    console.log(`        ${result.reason}`);
    failures.push({ name: s.name, file: s._file, reason: result.reason });
  }
}

console.log(`\n  ──────────────────────────────`);
console.log(`  ${passed} passed, ${failed} failed, ${scenarios.length} total\n`);

if (failures.length > 0) {
  console.log('  失败详情:');
  for (const f of failures) {
    console.log(`  - [${f.file}] ${f.name}: ${f.reason}`);
  }
  console.log();
}

process.exit(failed > 0 ? 1 : 0);
