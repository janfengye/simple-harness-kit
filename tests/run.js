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
 *       ".harness/observations.jsonl": { "contains": "tool" },
 *       // contains 可以是 string（单项）或 string[]（多项，全部必须命中）
 *       // containsNot 同样支持 string | string[]，要求文件中"不应"出现这些字符串
 *       ".harness/session-log.md": {
 *         "contains": ["关键词 A", "关键词 B"],
 *         "containsNot": ["禁词 X"]
 *       }
 *     },
 *     "dirs": {                            // 可选：检查目录中是否存在符合命名的文件
 *       ".harness/observations.archive": {
 *         "matches": "^observations-[a-z0-9]+-.*\\.jsonl$",  // 文件名正则
 *         "minCount": 1,                                       // 至少匹配数
 *         "contains": ["tool"]                                 // 至少一个匹配文件需包含所有 needles
 *       }
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

// 生成最新动态时间戳（1 分钟前，距离当前足够新可通过 since 校验）
function recentTimestamp() {
  return new Date(Date.now() - 60 * 1000).toISOString();
}

function setupTempDir(scenario) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-test-'));

  if (scenario.setup) {
    const recentTs = recentTimestamp();
    for (const [filePath, rawContent] of Object.entries(scenario.setup)) {
      const fullPath = path.join(tmpDir, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      // Object form: support symlink_to (for symlink bypass tests, #30)
      if (rawContent && typeof rawContent === 'object' && rawContent.symlink_to) {
        // Resolve target relative to tmpDir if not absolute
        const target = path.isAbsolute(rawContent.symlink_to)
          ? rawContent.symlink_to
          : path.join(tmpDir, rawContent.symlink_to);
        // Optionally create the target file with given content first
        if (rawContent.target_content !== undefined) {
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, String(rawContent.target_content).replace(/RECENT_TIMESTAMP/g, recentTs));
        }
        fs.symlinkSync(target, fullPath);
      } else {
        // String form: write file with placeholder substitution
        const content = String(rawContent).replace(/RECENT_TIMESTAMP/g, recentTs);
        fs.writeFileSync(fullPath, content);
      }
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
  // stdin 也支持 RECENT_TIMESTAMP 占位符替换（测试场景可在 tool_input.content 等字段用此占位符）
  const stdinData = scenario.stdin
    ? JSON.stringify(scenario.stdin).replace(/RECENT_TIMESTAMP/g, recentTimestamp())
    : '';
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

    // 检查目录中匹配文件名的项（用于 archive 等动态文件名场景）
    if (expect.dirs) {
      for (const [dirPath, check] of Object.entries(expect.dirs)) {
        const fullDir = path.join(tmpDir, dirPath);
        if (!fs.existsSync(fullDir)) {
          if (check.exists !== false) errors.push(`目录不存在: ${dirPath}`);
          continue;
        }
        if (check.exists === false) {
          errors.push(`目录不应存在: ${dirPath}`);
          continue;
        }
        let entries;
        try {
          entries = fs.readdirSync(fullDir);
        } catch (e) {
          errors.push(`无法读取目录 ${dirPath}: ${e.message}`);
          continue;
        }
        let matched = entries;
        if (check.matches) {
          const re = new RegExp(check.matches);
          matched = entries.filter(e => re.test(e));
        }
        const minCount = check.minCount !== undefined ? check.minCount : 1;
        if (matched.length < minCount) {
          errors.push(`目录 ${dirPath} 匹配 ${check.matches || '*'} 数量 ${matched.length} < ${minCount}`);
        }
        if (check.contains !== undefined && matched.length > 0) {
          const needles = Array.isArray(check.contains) ? check.contains : [check.contains];
          const ok = matched.some(name => {
            try {
              const c = fs.readFileSync(path.join(fullDir, name), 'utf8');
              return needles.every(n => c.includes(n));
            } catch { return false; }
          });
          if (!ok) {
            errors.push(`目录 ${dirPath} 中没有匹配文件包含 ${JSON.stringify(needles)}`);
          }
        }
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
          } else {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (check.contains !== undefined) {
              const needles = Array.isArray(check.contains) ? check.contains : [check.contains];
              for (const needle of needles) {
                if (!content.includes(needle)) {
                  errors.push(`文件 ${filePath} 未包含: "${needle}"`);
                }
              }
            }
            if (check.containsNot !== undefined) {
              const forbidden = Array.isArray(check.containsNot) ? check.containsNot : [check.containsNot];
              for (const f of forbidden) {
                if (content.includes(f)) {
                  errors.push(`文件 ${filePath} 不应包含: "${f}"`);
                }
              }
            }
            // 精确出现次数断言：containsCount: { "needle": N }
            //   N 的语义: 该 substring 在文件内容中必须出现恰好 N 次
            //   用于检测重复/缺失（如 append 操作不应该让某个 sentinel 多出来）
            if (check.containsCount !== undefined) {
              for (const [needle, expectedCount] of Object.entries(check.containsCount)) {
                // 全局非重叠次数计数
                let count = 0;
                let idx = 0;
                while ((idx = content.indexOf(needle, idx)) !== -1) {
                  count++;
                  idx += needle.length;
                }
                if (count !== expectedCount) {
                  errors.push(`文件 ${filePath} 子串 "${needle}" 出现 ${count} 次, 期望 ${expectedCount} 次`);
                }
              }
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

// ── Template Integrity Tests ──
// 校验 templates/settings-json.tmpl 等 kit 模板文件的结构完整性，
// 防止模板层漂移潜伏到 E2E 才被发现。详见 tests/template-integrity.js。
const { runTemplateIntegrityTests } = require('./template-integrity');
const tpl = runTemplateIntegrityTests();
console.log('  Template Integrity Tests\n');
for (const r of tpl.results) {
  if (r.ok) {
    console.log(`  PASS  ${r.name}`);
  } else {
    console.log(`  FAIL  ${r.name}`);
    console.log(`        ${r.reason}`);
  }
}
console.log(`\n  ${tpl.pass} passed, ${tpl.fail} failed, ${tpl.results.length} total\n`);

// ── Scripted Test Matrix (tests/scripts/run-all.sh) ──
// 维度 1-7 install/update/skill-path/e2e/invariant/mutation/pathstyle/scope
// 纯 shell 测试, 不依赖 Node 测试框架. 结果作为 run.js 总 exit code 的一部分.
//
// 本块用于 catch 的问题: install.sh / update.sh / skill 安装结构 / SKILL.md 路径
// 层面的 bug (VH-10 问题 A + B). hook scenarios 和 template-integrity 都在静态
// + hook runtime 层, 但不会实际跑 install.sh, 所以这一层是必要补充.
let scriptedFailed = 0;
let scriptedTotal = 0;
try {
  const scriptsRunner = path.resolve(__dirname, 'scripts', 'run-all.sh');
  if (fs.existsSync(scriptsRunner)) {
    console.log('  Scripted Test Matrix (tests/scripts/run-all.sh)\n');
    const res = require('child_process').spawnSync('bash', [scriptsRunner], {
      stdio: 'inherit',
      timeout: 10 * 60 * 1000, // 10 分钟上限
    });
    scriptedTotal = 1; // 作为一个整体 section
    if (res.status !== 0) {
      scriptedFailed = 1;
      console.log(`\n  Scripted Matrix FAIL (exit ${res.status})\n`);
    } else {
      console.log(`\n  Scripted Matrix PASS\n`);
    }
  } else {
    console.log(`  Scripted Matrix SKIP (runner 不存在: ${scriptsRunner})\n`);
  }
} catch (e) {
  scriptedFailed = 1;
  console.log(`  Scripted Matrix FAIL: ${e.message}\n`);
}

const totalFailed = failed + tpl.fail + scriptedFailed;
const totalTests = scenarios.length + tpl.results.length + scriptedTotal;
console.log(`  ══════════════════════════════`);
console.log(`  总计: ${passed + tpl.pass + (scriptedTotal - scriptedFailed)} passed, ${totalFailed} failed, ${totalTests} total\n`);

process.exit(totalFailed > 0 ? 1 : 0);
