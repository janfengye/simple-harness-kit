#!/usr/bin/env node
'use strict';

/**
 * Harness Learn — 从 observations.jsonl 分析模式，生成 instinct
 *
 * 纯本地分析，不调 AI，不启动后台进程。
 * 用法: node scripts/hooks/harness-learn.js [--report] [--promote]
 *
 * 分析维度:
 * 1. 工具序列模式（相同序列出现 3+ 次）
 * 2. 高频工具对（A 之后总是 B）
 * 3. 高频文件（经常被编辑的文件 = 高风险，可能需要测试）
 * 4. 稳定 instinct 提炼建议（置信度 ≥ 0.9 → 建议写入 Rule）
 */

const fs = require('fs');
const path = require('path');
const findRoot = require('./find-root');
const ROOT = findRoot();

const OBS_FILE = path.join(ROOT, '.harness/observations.jsonl');
const INSTINCTS_DIR = path.join(ROOT, '.harness/instincts');
const REPORT_FILE = path.join(ROOT, '.harness/learn-report.md');

// ── 读取 observations ──

function loadObservations() {
  if (!fs.existsSync(OBS_FILE)) return [];
  return fs.readFileSync(OBS_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);
}

// ── 读取已有 instincts ──

function loadInstincts() {
  if (!fs.existsSync(INSTINCTS_DIR)) return [];
  return fs.readdirSync(INSTINCTS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(INSTINCTS_DIR, f), 'utf8')); }
      catch { return null; }
    })
    .filter(Boolean);
}

// ── 分析 1: 工具序列模式 ──

function analyzeToolSequences(obs) {
  const windowSize = 3;
  const sequences = {};

  for (let i = 0; i <= obs.length - windowSize; i++) {
    const seq = obs.slice(i, i + windowSize).map(o => o.tool).join(' → ');
    sequences[seq] = (sequences[seq] || 0) + 1;
  }

  return Object.entries(sequences)
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([seq, count]) => ({ pattern: seq, count, type: 'tool-sequence' }));
}

// ── 分析 2: 工具对（A 之后跟 B）──

function analyzeToolPairs(obs) {
  const pairs = {};
  for (let i = 0; i < obs.length - 1; i++) {
    const pair = `${obs[i].tool} → ${obs[i + 1].tool}`;
    pairs[pair] = (pairs[pair] || 0) + 1;
  }

  return Object.entries(pairs)
    .filter(([, count]) => count >= 5)
    .sort((a, b) => b[1] - a[1])
    .map(([pair, count]) => ({ pattern: pair, count, type: 'tool-pair' }));
}

// ── 分析 3: 高频文件 ──

function analyzeHotFiles(obs) {
  const files = {};
  for (const o of obs) {
    if (['Edit', 'Write'].includes(o.tool) && o.input) {
      const filePath = o.input.split(' | ')[0].split('|')[0].trim();
      if (filePath) files[filePath] = (files[filePath] || 0) + 1;
    }
  }

  return Object.entries(files)
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([file, count]) => ({ file, count, type: 'hot-file' }));
}

// ── 分析 4: 时间分布 ──

function analyzeTimeDistribution(obs) {
  const hours = {};
  for (const o of obs) {
    const h = new Date(o.t).getHours();
    hours[h] = (hours[h] || 0) + 1;
  }
  return hours;
}

// ── 生成/更新 instinct ──

function upsertInstinct(id, data) {
  if (!fs.existsSync(INSTINCTS_DIR)) fs.mkdirSync(INSTINCTS_DIR, { recursive: true });
  const filePath = path.join(INSTINCTS_DIR, `${id}.json`);

  let existing = null;
  try { existing = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch {}

  if (existing) {
    // 更新置信度
    existing.confidence = Math.min(0.95, existing.confidence + 0.05);
    existing.observations = (existing.observations || 0) + data.count;
    existing.lastSeen = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
    return { action: 'updated', instinct: existing };
  } else {
    const instinct = {
      id,
      trigger: data.pattern,
      type: data.type,
      confidence: confidenceFromCount(data.count),
      observations: data.count,
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      scope: 'user',
    };
    fs.writeFileSync(filePath, JSON.stringify(instinct, null, 2));
    return { action: 'created', instinct };
  }
}

function confidenceFromCount(count) {
  if (count >= 20) return 0.85;
  if (count >= 10) return 0.7;
  if (count >= 5) return 0.5;
  return 0.3;
}

// ── 晋升 instinct → Rule ──

const RULES_DIR = path.join(ROOT, '.claude/rules');

function promoteToRule(instinct) {
  if (!fs.existsSync(RULES_DIR)) fs.mkdirSync(RULES_DIR, { recursive: true });

  const ruleFileName = `learned-${instinct.id}.md`;
  const rulePath = path.join(RULES_DIR, ruleFileName);

  // 根据 instinct 类型生成 Rule 内容
  let ruleContent = '';
  if (instinct.type === 'tool-sequence') {
    ruleContent = `# 工具序列模式: ${instinct.trigger}

> 自动从行为数据晋升（instinct ${instinct.id}，置信度 ${instinct.confidence}，${instinct.observations} 次观察）

此模式在开发过程中稳定出现。遵循此序列可以提高效率。

- **模式:** ${instinct.trigger}
- **晋升时间:** ${new Date().toISOString().slice(0, 10)}
`;
  } else if (instinct.type === 'tool-pair') {
    ruleContent = `# 工具对模式: ${instinct.trigger}

> 自动从行为数据晋升（instinct ${instinct.id}，置信度 ${instinct.confidence}，${instinct.observations} 次观察）

此工具调用对在开发过程中稳定出现。

- **模式:** ${instinct.trigger}
- **晋升时间:** ${new Date().toISOString().slice(0, 10)}
`;
  } else {
    ruleContent = `# 行为模式: ${instinct.trigger}

> 自动从行为数据晋升（instinct ${instinct.id}，置信度 ${instinct.confidence}，${instinct.observations} 次观察）

- **模式:** ${instinct.trigger}
- **晋升时间:** ${new Date().toISOString().slice(0, 10)}
`;
  }

  fs.writeFileSync(rulePath, ruleContent);

  // 标记 instinct 为已晋升
  const instinctPath = path.join(INSTINCTS_DIR, `${instinct.id}.json`);
  instinct.promoted = true;
  instinct.promotedAt = new Date().toISOString();
  instinct.rulePath = rulePath;
  fs.writeFileSync(instinctPath, JSON.stringify(instinct, null, 2));

  return { action: 'promoted', rulePath };
}

// ── 生成报告 ──

function generateReport(obs, sequences, pairs, hotFiles, instincts) {
  const lines = [];
  lines.push('# Harness Learn 分析报告');
  lines.push(`\n生成时间: ${new Date().toISOString().slice(0, 16)}`);
  lines.push(`观察数据: ${obs.length} 条`);
  lines.push(`已有 instincts: ${instincts.length} 条`);

  lines.push('\n## 工具使用模式');
  if (sequences.length === 0 && pairs.length === 0) {
    lines.push('\n数据不足，暂无明显模式。（至少需要 20+ 条观察数据）');
  } else {
    if (pairs.length > 0) {
      lines.push('\n### 高频工具对');
      lines.push('| 模式 | 次数 |');
      lines.push('|------|------|');
      for (const p of pairs.slice(0, 10)) {
        lines.push(`| ${p.pattern} | ${p.count} |`);
      }
    }
    if (sequences.length > 0) {
      lines.push('\n### 工具序列（3 步）');
      lines.push('| 序列 | 次数 |');
      lines.push('|------|------|');
      for (const s of sequences.slice(0, 10)) {
        lines.push(`| ${s.pattern} | ${s.count} |`);
      }
    }
  }

  if (hotFiles.length > 0) {
    lines.push('\n## 高频修改文件（可能需要测试覆盖）');
    lines.push('| 文件 | 修改次数 |');
    lines.push('|------|---------|');
    for (const f of hotFiles.slice(0, 10)) {
      lines.push(`| ${f.file} | ${f.count} |`);
    }
  }

  // Token 优化建议
  const stableInstincts = instincts.filter(i => i.confidence >= 0.9);
  if (stableInstincts.length > 0) {
    lines.push('\n## Token 优化建议');
    lines.push('\n以下 instinct 已稳定（置信度 ≥ 0.9），建议提炼为 Rule 以减少 token 消耗：');
    for (const i of stableInstincts) {
      lines.push(`- **${i.id}** (${i.confidence}) — ${i.trigger}`);
    }
    lines.push('\n提炼方法: 将 trigger+action 写入 `.claude/rules/` 中的规则文件。');
  }

  // 改进建议
  lines.push('\n## 改进建议');
  if (hotFiles.length > 0) {
    lines.push(`- ${hotFiles[0].file} 修改了 ${hotFiles[0].count} 次 — 建议确认是否有测试覆盖`);
  }
  if (sequences.some(s => s.pattern.includes('Bash') && s.count > 5)) {
    lines.push('- 频繁使用 Bash 命令 — 考虑是否可以用专用工具替代（如 Grep 替代 grep）');
  }

  return lines.join('\n');
}

// ── 周期性报告 ──

const PERIODIC_DIR = path.join(ROOT, '.harness/reports');

function generatePeriodicReport(allObs, periodObs, periodDays, sequences, pairs, hotFiles, instinctsBefore, instinctsAfter) {
  const now = new Date();
  const since = new Date(now - periodDays * 24 * 60 * 60 * 1000);
  const lines = [];

  lines.push('# 开发效率周期报告');
  lines.push(`\n期间: ${since.toISOString().slice(0, 10)} ~ ${now.toISOString().slice(0, 10)} (${periodDays} 天)`);
  lines.push(`本期观察: ${periodObs.length} 条 | 全量: ${allObs.length} 条`);

  // Instinct 变化
  const beforeIds = new Set(instinctsBefore.map(i => i.id));
  const newInstincts = instinctsAfter.filter(i => !beforeIds.has(i.id));
  const updatedInstincts = instinctsAfter.filter(i => {
    const before = instinctsBefore.find(b => b.id === i.id);
    return before && before.confidence !== i.confidence;
  });
  const promoted = instinctsAfter.filter(i => i.promoted && !instinctsBefore.find(b => b.id === i.id && b.promoted));

  lines.push('\n## Instinct 变化');
  lines.push(`- 新增: ${newInstincts.length}`);
  lines.push(`- 置信度变化: ${updatedInstincts.length}`);
  lines.push(`- 已晋升为 Rule: ${promoted.length}`);

  if (newInstincts.length > 0) {
    lines.push('\n### 新发现的模式');
    for (const i of newInstincts) {
      lines.push(`- **${i.id}** (${i.confidence}) — ${i.trigger}`);
    }
  }

  // 高频模式
  if (pairs.length > 0 || sequences.length > 0) {
    lines.push('\n## 高频模式（本期）');
    for (const p of pairs.slice(0, 5)) {
      lines.push(`- "${p.pattern}" — ${p.count} 次`);
    }
    for (const s of sequences.slice(0, 3)) {
      lines.push(`- "${s.pattern}" — ${s.count} 次`);
    }
  }

  // 高频文件
  if (hotFiles.length > 0) {
    lines.push('\n## 高频修改文件');
    for (const f of hotFiles.slice(0, 5)) {
      lines.push(`- \`${f.file}\` — ${f.count} 次修改`);
    }
  }

  // Token 优化
  const promotable = instinctsAfter.filter(i => i.confidence >= 0.9 && !i.promoted);
  if (promotable.length > 0) {
    lines.push('\n## Token 优化机会');
    lines.push(`${promotable.length} 个 instinct 已稳定（≥0.9），可运行 \`--promote\` 晋升为 Rule:`);
    for (const i of promotable) {
      lines.push(`- **${i.id}** (${i.confidence}) — ${i.trigger}`);
    }
  }

  // 改进建议
  lines.push('\n## 改进建议');
  if (hotFiles.length > 0) {
    lines.push(`- \`${hotFiles[0].file}\` 修改了 ${hotFiles[0].count} 次 — 建议确认测试覆盖`);
  }
  if (sequences.some(s => s.pattern.includes('Bash') && s.count > 5)) {
    lines.push('- 频繁使用 Bash — 考虑是否可以用专用工具替代');
  }
  if (promotable.length > 0) {
    lines.push(`- ${promotable.length} 个 instinct 可晋升 — 运行 \`node scripts/hooks/harness-learn.js --promote\``);
  }
  if (periodObs.length < 20) {
    lines.push('- 本期数据量偏少，模式识别可能不准确');
  }

  return lines.join('\n');
}

// ── 主流程 ──

function main() {
  const args = process.argv.slice(2);
  const isReport = args.includes('--report');
  const isPromote = args.includes('--promote');
  const periodicIdx = args.indexOf('--periodic');
  const periodDays = periodicIdx !== -1 ? parseInt(args[periodicIdx + 1], 10) || 7 : 0;

  const allObs = loadObservations();
  if (allObs.length < 10) {
    console.log(`观察数据仅 ${allObs.length} 条，建议积累 20+ 条后再分析。`);
    if (allObs.length === 0) console.log('提示: 确认 session-logger Hook 已启用且 HARNESS_LEARN !== off');
    return;
  }

  // 周期性报告：只分析时间窗口内的数据
  const cutoff = periodDays > 0 ? new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000) : null;
  const obs = cutoff ? allObs.filter(o => new Date(o.t) >= cutoff) : allObs;

  if (periodDays > 0 && obs.length < 5) {
    console.log(`本期（${periodDays} 天）仅 ${obs.length} 条观察，数据不足。使用全量数据分析。`);
  }

  const instinctsBefore = loadInstincts();
  const sequences = analyzeToolSequences(obs);
  const pairs = analyzeToolPairs(obs);
  const hotFiles = analyzeHotFiles(obs);

  // 生成/更新 instincts（始终用全量数据）
  const allSequences = cutoff ? analyzeToolSequences(allObs) : sequences;
  const allPairs = cutoff ? analyzeToolPairs(allObs) : pairs;

  const changes = [];
  for (const s of allSequences.slice(0, 5)) {
    const id = s.pattern.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    changes.push(upsertInstinct(id, s));
  }
  for (const p of allPairs.slice(0, 5)) {
    const id = p.pattern.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    changes.push(upsertInstinct(id, p));
  }

  const allInstincts = loadInstincts();

  // 周期性报告
  if (periodDays > 0) {
    const periodicReport = generatePeriodicReport(allObs, obs, periodDays, sequences, pairs, hotFiles, instinctsBefore, allInstincts);

    if (!fs.existsSync(PERIODIC_DIR)) fs.mkdirSync(PERIODIC_DIR, { recursive: true });
    const reportFile = path.join(PERIODIC_DIR, `${new Date().toISOString().slice(0, 10)}-${periodDays}d.md`);
    fs.writeFileSync(reportFile, periodicReport);

    if (isReport) {
      console.log(periodicReport);
    } else {
      console.log(`周期报告（${periodDays} 天）: ${reportFile}`);
    }
  } else {
    // 常规报告
    const report = generateReport(allObs, sequences, pairs, hotFiles, allInstincts);
    fs.writeFileSync(REPORT_FILE, report);

    if (isReport) {
      console.log(report);
    } else {
      console.log(`分析完成: ${allObs.length} 条观察 → ${changes.filter(c => c.action === 'created').length} 个新 instinct, ${changes.filter(c => c.action === 'updated').length} 个更新`);
      console.log(`报告: ${REPORT_FILE}`);
      console.log(`Instincts: ${INSTINCTS_DIR}/`);
    }
  }

  if (isPromote) {
    const stable = allInstincts.filter(i => i.confidence >= 0.9 && !i.promoted);
    if (stable.length > 0) {
      console.log(`\n晋升 ${stable.length} 个稳定 instinct 为 Rule:`);
      for (const i of stable) {
        const result = promoteToRule(i);
        console.log(`  ${result.action}: ${i.id} (${i.confidence}) → ${result.rulePath}`);
      }
    } else {
      console.log('\n暂无达到晋升条件（≥0.9 且未晋升）的 instinct。');
    }
  }
}

main();
