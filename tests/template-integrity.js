#!/usr/bin/env node
'use strict';

/**
 * Template Integrity Tests
 *
 * 在 kit 仓库级别校验模板文件的结构完整性，防止模板层漂移潜伏到 E2E 才被发现。
 * 这是 #23 的产物，配合 #21 的 e2e-acceptance-validate.sh 形成两层防御：
 *   - 本脚本：kit 仓库 CI 时即时发现模板结构问题
 *   - e2e-acceptance-validate.sh：被测项目 init 后验证生成产物
 *
 * 单一真实源: tests/required-wiring.json
 *   包含必选 hook wiring 集合，本脚本和 e2e-acceptance-validate.sh 都必须消费它。
 *   不允许在脚本里硬编码 wiring 常量（会造成多份真实源漂移）。
 *
 * 由 tests/run.js 调用，失败计入统一的 fail 统计。
 */

const fs = require('fs');
const path = require('path');

const KIT_ROOT = path.resolve(__dirname, '..');
const TMPL_SETTINGS = path.join(KIT_ROOT, 'templates', 'settings-json.tmpl');
const TMPL_RULES_DIR = path.join(KIT_ROOT, 'templates', 'rules');
const SCRIPTS_HOOKS_DIR = path.join(KIT_ROOT, 'scripts', 'hooks');
const INIT_PROMPT = path.join(KIT_ROOT, 'init-prompt.md');
const REQUIRED_WIRING_FILE = path.join(__dirname, 'required-wiring.json');

// 每个 rule 模板的关键内容锚点。
// 原则：每个模板至少 4 个锚点，覆盖核心行为点（不是单个 banner 词），
// 这样即使被 AI 无意改写结构，如果关键行为缺失也会被检测到。
const REQUIRED_RULE_TEMPLATES = {
  'role-constraints.md.tmpl': [
    'Director',
    'Implementer',
    'Reviewer',
    'YAGNI',         // 核心原则
    'NEEDS_CONTEXT', // Implementer 行为准则
  ],
  'qa-standards.md.tmpl': [
    'QA',
    'Verification Loop',  // 核心流程
    'PASS',               // 判定词
    '量化',               // 量化验收原则
  ],
  'feedback-workflow.md.tmpl': [
    'F1',
    'F2',
    'F3',
    'F4',
    'F5',            // 五步完整性
    'Constraint',    // 规则沉淀
  ],
  'harness-entry.md.tmpl': [
    'HARNESS MODE ACTIVE',
    'banner',
    '等待用户指令',  // 关键行为：不自行开始
    'PLAN',          // 进入 PLAN 阶段
    '6 阶段 Loop',  // 核心概念
  ],
};

// 检查 settings 对象中某个 wiring 是否存在
function hasWiring(settings, { event, matcher, script }) {
  const hooks = (settings.hooks && settings.hooks[event]) || [];
  return hooks.some(h => {
    const matcherOk = matcher === null || h.matcher === matcher;
    if (!matcherOk) return false;
    return (h.hooks || []).some(inner => (inner.command || '').includes(script));
  });
}

function findMissingWirings(settings, requiredWirings) {
  return requiredWirings.filter(w => !hasWiring(settings, w));
}

function formatWiring(w) {
  return `${w.event}:${w.matcher || '*'} → ${w.script}`;
}

// 从 init-prompt.md 里提取 "settings.json 最小配置" 章节中的 JSON 块
// 更精确：必须在包含"最小配置"字样的章节内
function extractMinimumSettingsFromInitPrompt(content) {
  // 查找 "## settings.json 最小配置" 章节
  const sectionRe = /##\s*settings\.json\s*最小配置[\s\S]*?```json\s*\n([\s\S]*?)\n```/;
  const match = content.match(sectionRe);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function runTemplateIntegrityTests() {
  const results = [];

  function check(name, fn) {
    try {
      const err = fn();
      if (err) {
        results.push({ name, ok: false, reason: err });
      } else {
        results.push({ name, ok: true });
      }
    } catch (e) {
      results.push({ name, ok: false, reason: e.message });
    }
  }

  // 加载单一真实源
  let requiredWirings = null;
  check('source: required-wiring.json 存在 + 可解析', () => {
    if (!fs.existsSync(REQUIRED_WIRING_FILE)) {
      return `真实源不存在: ${REQUIRED_WIRING_FILE}`;
    }
    try {
      const data = JSON.parse(fs.readFileSync(REQUIRED_WIRING_FILE, 'utf8'));
      if (!Array.isArray(data.wirings) || data.wirings.length === 0) {
        return 'required-wiring.json 结构无效 (wirings 必须是非空数组)';
      }
      requiredWirings = data.wirings;
    } catch (e) {
      return `解析失败: ${e.message}`;
    }
  });

  // ── T1: settings-json.tmpl 存在 + JSON 有效 ──
  let tmplSettings = null;
  check('template: settings-json.tmpl 存在 + JSON 有效', () => {
    if (!fs.existsSync(TMPL_SETTINGS)) return `文件不存在: ${TMPL_SETTINGS}`;
    try {
      tmplSettings = JSON.parse(fs.readFileSync(TMPL_SETTINGS, 'utf8'));
    } catch (e) {
      return `JSON 解析失败: ${e.message}`;
    }
  });

  // ── T2: 必选顶层事件（从 required-wiring.json 派生）──
  check('template: settings-json.tmpl 包含真实源声明的所有必选顶层事件', () => {
    if (!tmplSettings) return '前置检查失败，跳过';
    if (!requiredWirings) return '前置检查失败，跳过';
    // 从 required-wiring.json 推导 event 集，消除硬编码
    const requiredEvents = [...new Set(requiredWirings.map(w => w.event))];
    const missing = requiredEvents.filter(ev => !tmplSettings.hooks || !tmplSettings.hooks[ev]);
    if (missing.length > 0) return `缺失顶层事件: ${missing.join(', ')}`;
  });

  // ── T3: templates/settings-json.tmpl 包含 required-wiring.json 中所有 wiring（count-based） ──
  // 使用 count-based diff 以捕获 duplicate wiring regression（防止模板重复挂载同一 matcher）
  check('template: settings-json.tmpl 与 required-wiring.json wiring 精确一致（含重复检测）', () => {
    if (!tmplSettings) return '前置检查失败，跳过';
    if (!requiredWirings) return '前置检查失败，跳过';

    // 从 tmplSettings 提取 wiring 列表（保留重复）
    const tmplWirings = [];
    for (const [event, entries] of Object.entries(tmplSettings.hooks || {})) {
      for (const entry of entries) {
        for (const h of (entry.hooks || [])) {
          const cmd = h.command || '';
          const m = cmd.match(/scripts\/hooks\/([\w-]+\.js)/);
          if (m) {
            tmplWirings.push({ event, matcher: entry.matcher || null, script: m[1] });
          }
        }
      }
    }

    // 模板允许有 optional wiring (delivery-gate, context-monitor 等), 所以用"required 是 tmpl 的子集"语义：
    // - required 中每个 wiring 必须在 tmpl 中出现（计数至少相等）
    // - required 中的 wiring 在 tmpl 中不能重复（防止模板注册冗余）
    const expCount = countWirings(requiredWirings);
    const tmplCountMap = countWirings(tmplWirings);
    const missing = [];
    const duplicates = [];
    for (const [key, expN] of expCount.entries()) {
      const actN = tmplCountMap.get(key) || 0;
      if (actN < expN) missing.push(`${key} (缺 ${expN - actN} 次)`);
      if (actN > expN) duplicates.push(`${key} (重复 ${actN - expN} 次)`);
    }
    const problems = [];
    if (missing.length > 0) {
      problems.push(`template 缺少 (${missing.length}):\n      ` + missing.join('\n      '));
    }
    if (duplicates.length > 0) {
      problems.push(`template 重复 (${duplicates.length}):\n      ` + duplicates.join('\n      '));
    }
    if (problems.length > 0) return problems.join('\n    ');
  });

  // ── T4: 所有 command 引用的脚本都在 scripts/hooks/ 存在 ──
  check('template: 所有 command 引用的 hook 脚本真实存在', () => {
    if (!tmplSettings) return '前置检查失败，跳过';
    const referenced = new Set();
    for (const [, entries] of Object.entries(tmplSettings.hooks || {})) {
      for (const entry of entries) {
        for (const h of (entry.hooks || [])) {
          const cmd = h.command || '';
          const m = cmd.match(/scripts\/hooks\/([\w-]+\.js)/);
          if (m) referenced.add(m[1]);
        }
      }
    }
    const missing = [];
    for (const name of referenced) {
      if (!fs.existsSync(path.join(SCRIPTS_HOOKS_DIR, name))) missing.push(name);
    }
    if (missing.length > 0) return `template 引用的脚本不存在: ${missing.join(', ')}`;
  });

  // ── T5: 必选 rule 模板存在 + 含关键内容 ──
  for (const [fileName, keywords] of Object.entries(REQUIRED_RULE_TEMPLATES)) {
    check(`template: rule 模板 ${fileName} 存在且含关键内容`, () => {
      const p = path.join(TMPL_RULES_DIR, fileName);
      if (!fs.existsSync(p)) return `文件不存在: ${fileName}`;
      const content = fs.readFileSync(p, 'utf8');
      const missing = keywords.filter(kw => !content.includes(kw));
      if (missing.length > 0) {
        return `${fileName} 缺失关键字 (${missing.length}): ${missing.join(', ')}`;
      }
    });
  }

  // ── T6: init-prompt.md 最小集与 required-wiring.json 完全一致（count-based） ──
  check('doc: init-prompt.md 最小配置与 required-wiring.json 精确一致（含重复检测）', () => {
    if (!requiredWirings) return '前置检查失败，跳过';
    if (!fs.existsSync(INIT_PROMPT)) return `文件不存在: ${INIT_PROMPT}`;
    const content = fs.readFileSync(INIT_PROMPT, 'utf8');
    const initSettings = extractMinimumSettingsFromInitPrompt(content);
    if (!initSettings) {
      return 'init-prompt.md 中未找到 "## settings.json 最小配置" 章节的 JSON 代码块';
    }

    // 从 init-prompt 提取其 wiring 列表（保留重复）
    const initWirings = [];
    for (const [event, entries] of Object.entries(initSettings.hooks || {})) {
      for (const entry of entries) {
        for (const h of (entry.hooks || [])) {
          const cmd = h.command || '';
          const m = cmd.match(/scripts\/hooks\/([\w-]+\.js)/);
          if (m) {
            initWirings.push({ event, matcher: entry.matcher || null, script: m[1] });
          }
        }
      }
    }

    const diff = compareWiringsExact(requiredWirings, initWirings);
    const problems = [];
    if (diff.missing.length > 0) {
      problems.push(`init-prompt 缺少:\n      ` + diff.missing.join('\n      '));
    }
    if (diff.extra.length > 0) {
      problems.push(`init-prompt 多出:\n      ` + diff.extra.join('\n      '));
    }
    if (diff.duplicates.length > 0) {
      problems.push(`init-prompt 重复:\n      ` + diff.duplicates.join('\n      '));
    }
    if (problems.length > 0) return problems.join('\n    ');
  });

  // ── T7: e2e-acceptance-validate.sh 从 required-wiring.json 派生，不硬编码 wiring ──
  // 反回归检查：
  //   (a) 必须引用 required-wiring.json
  //   (b) 必须实际通过 node 调用读取它（且读取与 required-wiring.json 在同一 node 调用内）
  //   (c) 正文不含任何形如 'Event:Matcher:script.js' 的硬编码三元组字符串（单/双引号均检查）
  //       event 白名单从 required-wiring.json 动态派生，避免 T7 自己漂移
  check('doc: e2e-acceptance-validate.sh 从 required-wiring.json 派生 (非硬编码)', () => {
    if (!requiredWirings) return '前置检查失败，跳过';
    const shPath = path.join(__dirname, 'e2e-acceptance-validate.sh');
    if (!fs.existsSync(shPath)) return `文件不存在: ${shPath}`;
    const shContent = fs.readFileSync(shPath, 'utf8');

    // (a) 必须引用 required-wiring.json
    if (!shContent.includes('required-wiring.json')) {
      return '.sh 脚本未引用 required-wiring.json，可能回退到硬编码';
    }

    // (b) 必须有 node -e 调用，且该调用读取 required-wiring.json
    //     （通过字面串 'required-wiring.json' 或 bash 变量展开 $REQUIRED_WIRING_JSON）
    // 用非贪婪的 `$` 终结（避免吃掉后续内容），匹配 `node -e "..."` 或 `node -e '...'` 块
    const nodeEBlocks = shContent.match(/node\s+-e\s+("[\s\S]*?"|'[\s\S]*?')/g) || [];
    if (nodeEBlocks.length === 0) {
      return '.sh 脚本没有任何 node -e 调用';
    }
    const readsJson = nodeEBlocks.some(
      b => b.includes('required-wiring.json') || b.includes('REQUIRED_WIRING_JSON')
    );
    if (!readsJson) {
      return '.sh 脚本提到了 required-wiring.json，但没有任何 node -e 调用实际读取它';
    }

    // (c) 正文不含硬编码 wiring 三元组字符串
    // event 白名单从 required-wiring.json 动态派生
    const eventAlt = [...new Set(requiredWirings.map(w => w.event))]
      .map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    // 同时匹配双引号 "Event:Matcher:name.js" 和单引号 'Event:Matcher:name.js'
    const tripleRe = new RegExp(`["']\\s*(${eventAlt})\\s*:[^"']*:[\\w-]+\\.js\\s*["']`);
    const lines = shContent.split('\n');
    const hardcodedTriples = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) continue; // 跳过注释
      if (tripleRe.test(line)) {
        hardcodedTriples.push(`L${i + 1}: ${trimmed.substring(0, 100)}`);
      }
    }
    if (hardcodedTriples.length > 0) {
      return '.sh 脚本含硬编码 wiring 三元组 (应从 JSON 派生):\n      ' + hardcodedTriples.join('\n      ');
    }
  });

  const pass = results.filter(r => r.ok).length;
  const fail = results.length - pass;
  return { pass, fail, results };
}

// 集合 A 中不在集合 B 中的 wiring（set-based, 忽略重复）
function findMissingWiringSet(a, b) {
  return a.filter(x => !b.some(y =>
    y.event === x.event &&
    (y.matcher || null) === (x.matcher || null) &&
    y.script === x.script
  ));
}

// 生成 wiring 的规范化 key
function wiringKey(w) {
  return `${w.event}:${w.matcher || '*'}:${w.script}`;
}

// 计数 map: key → 出现次数
function countWirings(list) {
  const m = new Map();
  for (const w of list) {
    const k = wiringKey(w);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

// 两份 wiring 列表的 count-based 精确对比：
//   returns { missing: [...], extra: [...], duplicates: [...] }
//   - missing: actual 比 expected 少的条目（含因重复不够的情况）
//   - extra: actual 比 expected 多的条目
//   - duplicates: actual 中重复出现（expected 只要求 1 次）的条目
function compareWiringsExact(expected, actual) {
  const expCount = countWirings(expected);
  const actCount = countWirings(actual);
  const missing = [];
  const extra = [];
  const duplicates = [];
  const allKeys = new Set([...expCount.keys(), ...actCount.keys()]);
  for (const k of allKeys) {
    const e = expCount.get(k) || 0;
    const a = actCount.get(k) || 0;
    if (a < e) missing.push(`${k} (缺 ${e - a} 次)`);
    if (a > e) {
      if (e === 0) extra.push(k);
      else duplicates.push(`${k} (重复 ${a - e} 次)`);
    }
  }
  return { missing, extra, duplicates };
}

module.exports = { runTemplateIntegrityTests };

if (require.main === module) {
  const { pass, fail, results } = runTemplateIntegrityTests();
  console.log('\n  Template Integrity Tests\n');
  for (const r of results) {
    if (r.ok) {
      console.log(`  PASS  ${r.name}`);
    } else {
      console.log(`  FAIL  ${r.name}`);
      console.log(`        ${r.reason}`);
    }
  }
  console.log(`\n  ${pass} passed, ${fail} failed, ${results.length} total\n`);
  process.exit(fail > 0 ? 1 : 0);
}
