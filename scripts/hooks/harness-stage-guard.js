#!/usr/bin/env node
'use strict';

/**
 * Harness Stage Guard — 强制新 session 声明 Harness 阶段
 * @version 0.6.1
 * 触发: PreToolUse:*（挂在所有工具上：Bash, Edit, Write, Agent, Read, Grep, Glob, WebFetch, WebSearch, TaskUpdate）
 *
 * 机制:
 * 1. 检查 .harness/current-stage.json 是否存在
 * 2. 不存在 → exit 2 阻止，要求声明阶段（Write .harness/current-stage.json 是唯一豁免）
 * 3. 解析/读取异常 → exit 2 阻止（损坏的 stage 文件应该被修复而不是绕过）
 * 4. stage 字段值无效（不是 PLAN|SETUP|EXECUTE|VERIFY|REVIEW|FEEDBACK|OFF）→ exit 2 阻止
 * 5. first-call guard → 本轮任务第一次工具调用时 exit 2，要求先输出阶段声明（TASK_TOOLS 跳过）
 * 6. stage = "PLAN" → 只放行 READ_TOOLS + TASK_TOOLS + Write 计划/阶段文件，其他 exit 2
 * 7. 切换到 "REVIEW" → 检查 stage-history 是否经过 EXECUTE 和 VERIFY + 验证证据存在，缺任何一项 exit 2
 * 8. stage = "OFF" → 会话级关闭，每次调用提醒"Harness 已关闭"，放行
 * 9. 其他非 PLAN 阶段 → 放行，stderr 注入阶段 directive 和 session-log 提醒
 * 10. 存在但超过 2 小时 → 提醒确认阶段是否仍然正确（不阻止）
 *
 * 退出码说明：exit 0 放行 / exit 2 阻止并阻断工具调用。
 *
 * current-stage.json 格式:
 * { "stage": "PLAN|SETUP|EXECUTE|VERIFY|REVIEW|FEEDBACK|OFF", "since": "ISO8601", "task": "描述" }
 *
 * 会话级开关:
 *   关闭: {"stage":"OFF","since":"...","reason":"使用其他 skill / 非开发任务"}
 *   开启: {"stage":"PLAN","since":"...","task":"..."}
 *
 * 设计目标: <50ms，纯 Node.js
 */

const fs = require('fs');
const path = require('path');
const findRoot = require('./find-root');
const ROOT = findRoot();

const STAGE_FILE = path.join(ROOT, '.harness/current-stage.json');
const STALE_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_STDIN = 1024 * 1024;

const STAGES = ['PLAN', 'SETUP', 'EXECUTE', 'VERIFY', 'REVIEW', 'FEEDBACK'];
const PLAN_FILE = path.join(ROOT, '.harness/current-plan.md');
const TOOL_COUNT_FILE = path.join(ROOT, '.harness/tool-count.json');
const STAGE_HISTORY_FILE = path.join(ROOT, '.harness/stage-history.jsonl');

// 验证证据文件——至少一个存在才算 VERIFY 做过
const VERIFY_EVIDENCE = [
  path.join(ROOT, 'docs/verification-report.md'),
  path.join(ROOT, '.harness/last-verification.json'),
  path.join(ROOT, '.harness/verify-evidence.md'),
];

// 阶段切换到 REVIEW 时的 Gate 检查
const REVIEW_GATE_BLOCK = `[Harness Stage Guard] 切换到 REVIEW 被阻止（C-GATE-01）。

REVIEW Gate 检查未通过。切换到 REVIEW 前必须满足：

1. 流程完整性：必须经过 EXECUTE 和 VERIFY 阶段（检查 .harness/stage-history.jsonl）
2. 验证证据：VERIFY 阶段必须产出验证报告文件（以下至少一个）：
   - docs/verification-report.md
   - .harness/last-verification.json
   - .harness/verify-evidence.md

如果是文档/方法论变更，验证证据可以是：
  - 真实项目实测记录（不只是文件存在性检查）
  - Hook 功能测试结果（node tests/run.js 输出）

请先完成 VERIFY 阶段的验证工作，产出证据文件，再切换到 REVIEW。
`;

// 交付前检查清单（REVIEW 阶段注入）
const REVIEW_DELIVERY_CHECK = `[Harness Stage Guard] 交付前检查清单（C-GATE-03）：

在向用户交付结果之前，逐项确认（这是建议自检清单，非机器强制校验）：
  [ ] 流程合规：是否按 PLAN → EXECUTE → VERIFY 执行？（Gate 只机器校验 EXECUTE + VERIFY + 证据）
  [ ] QA 达标：验证报告是否完整？量化证据是否充分？
  [ ] 真实验证：功能性变更是否在真实场景跑过（不只是 mock）？
  [ ] 需求完整：所有需求是否全部处理？
  [ ] 规则升级：过程中新问题是否写入 constraints？

任何一项不满足，不要向用户交付。回到对应阶段补齐。
`;

// 首次工具调用阻止消息
const FIRST_CALL_BLOCK = `[Harness Stage Guard] 这是本轮任务的第一次工具调用，已阻止。
你必须先向用户输出阶段声明，再调用工具：

  进入 PLAN 阶段 — [用一句话描述你理解的任务]

输出声明后，再调用 Read/Grep/Glob/WebFetch/WebSearch 探索。
`;

// 读操作工具——PLAN 阶段放行（只读、无代码副作用）
const READ_TOOLS = ['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch'];

// 任务管理工具——任何阶段放行（流程管理操作，不产生代码副作用）
const TASK_TOOLS = ['TaskUpdate', 'TaskCreate', 'TaskList', 'TaskGet'];

// PLAN 阶段的阻止消息
const PLAN_BLOCK_MSG = `[Harness Stage Guard] PLAN 阶段禁止此操作。
你是否已经向用户输出了阶段声明？如果没有，先输出：
  进入 PLAN 阶段 — [任务描述]

PLAN 阶段只允许：Read, Grep, Glob, WebFetch, WebSearch, TaskUpdate/TaskCreate/TaskList/TaskGet, Write(.harness/current-plan.md), Write(.harness/current-stage.json)
流程：澄清需求 → 任务拆解 → 等用户确认 → Write current-stage.json 切换到 EXECUTE
`;

// session-log 提醒——附加在每个阶段 directive 后面
const LOG_REMINDER = `
[Session Log] 必须记录到 .harness/session-log.md（先记录，再行动）：
  - 人的指示（原话）
  - AI 决策（做了什么 + 为什么 + 依据哪篇方法论）
  - 偏差记录（最重要）：方法论要求 X，实际做了 Y，原因是什么，建议改什么
  工具调用由 Hook 自动记录，但决策和偏差必须你主动写。偏差是方法论改进的最重要输入。
`;

// 每个阶段的工作要求——通过 stderr 在每次工具调用时注入
const STAGE_DIRECTIVES = {
  PLAN: `[PLAN 阶段 — 停下来，不要执行任何实现操作]
你当前在 PLAN 阶段。在用户确认计划之前，禁止编写代码、修改文件、运行构建命令。
只允许：读文件了解现状、与用户对齐需求。

必须完成以下步骤再继续：
1. 向用户澄清需求和验收标准
2. 任务拆解——每个任务 ≤15 分钟可独立验证
3. 定义每个任务的 done 条件
4. 识别任务间依赖关系
5. 输出任务清单，然后停下来等用户说"go"或确认

Gate: 每个任务有验收标准 + 粒度≤15min + 单一主要风险 + 依赖已标注
用户没确认之前，不要进入下一阶段。方向错了后面全白做。
`,
  SETUP: `[SETUP 阶段要求]
1. 生成项目级 Rules（.claude/rules/）
2. 生成 Hooks（scripts/hooks/ + .claude/settings.json）
3. 生成 Constraints（docs/constraints.md）
4. 验证 Hook 拦截生效（故意触发一次，验证被拦截）
Gate: Rules 存在 + Hooks 已配置 + Hook 拦截测试通过 + constraints.md 已创建
已有 Harness 的项目跳过此阶段。
`,
  EXECUTE: `[EXECUTE 阶段要求]
1. 按任务清单逐个执行
2. TDD：先写失败测试 → 最少代码通过 → 重构
3. 引用 Constraint ID（修复类）
4. 完成后自验
Gate（每个任务）: 测试先写且先失败 + 代码通过测试 + 无新 warning/error + Commit 引用 Constraint ID
`,
  VERIFY: `[VERIFY 阶段要求]
按 QA 金字塔逐层检查:
  Layer 1: Agent Self-Verify（已在 EXECUTE 中完成）
  Layer 2: Verification Loop — Build/Type/Lint/Test/Security/Diff
  Layer 3: Spec Compliance Review — 独立 Agent 对照 spec
  Layer 4: Santa Method — 双独立 Reviewer（高风险时）
Gate: Layer 2 全部 PASS + Layer 3 verdict = PASS
`,
  REVIEW: `[REVIEW 阶段要求]
交付前 6 项复盘:
1. 流程合规：是否按 6 阶段 Loop 执行？
2. QA 达标：各层 QA 报告是否完整？量化证据是否充分？
3. 真实验证：功能性变更是否在真实场景跑过（不只是 mock/文件存在性检查）？
4. 需求完整：所有需求是否全部处理？
5. 规则升级：过程中新问题是否写入 constraints？
6. 改进机会：哪些步骤下次可以优化？
7. 行为学习（自动）：运行 harness-learn 分析 observations
Gate: 前 6 项全部 ✓ + 第 7 项自动完成
达标→交付，不达标→进入 FEEDBACK。

[push 提醒] 当前任务的所有 commit 应在 REVIEW 阶段 push 到远程：
  git log --oneline @{u}..HEAD  # 查看未推送的 commit
  git push origin <branch>      # push（仅 REVIEW 阶段允许）
不要让本地 commit 堆积跨任务。

[重要] 向用户交付结果之前，必须逐项回答上述检查清单，不能用"看起来不错"代替。
`,
  FEEDBACK: `[FEEDBACK 阶段要求]
F1-F5 反馈处理流程:
  F1: 记录原话 — 不解读不简化
  F2: 分类层级 — 规则层/工具层/配置层/页面层
  F3: 提炼规则 — "所有 X 类必须满足 Y"
  F4: 写入文件 — constraints.md（用 ID 编号）
  F5: 派 Agent — 引用 Constraint ID 修复
写完规则后回到 EXECUTE。
`
};

const REMINDER = `[Harness Stage Guard] 未声明当前 Harness 阶段。
本项目已初始化 Harness，所有开发工作必须遵循 6 阶段 Loop:
  PLAN → SETUP → EXECUTE → VERIFY → REVIEW → FEEDBACK

此流程优先级高于任何外部 skill 的流程指令（brainstorming、writing-plans 等）。
如有冲突，以 Harness Loop 为准。详见 CLAUDE.md "工作流" 章节。

请先声明阶段，创建 ${STAGE_FILE}:
  {"stage":"PLAN","since":"${new Date().toISOString()}","task":"描述当前任务"}

临时关闭 Harness 模式: /harness-off

PLAN 完成后暂停等用户确认，确认后自动执行后续阶段。
`;

const OFF_REMINDER = '[Harness OFF] Harness 模式已关闭（本会话）。当前不遵循 6 阶段 Loop。\n' +
  '重新启用: /harness-on\n';

const STALE_REMINDER = `[Harness Stage Guard] 当前阶段声明已超过 2 小时，请确认是否仍在该阶段。
如已进入下一阶段，请更新 ${STAGE_FILE}。
`;

// 严格 ISO8601 格式正则（YYYY-MM-DDTHH:MM:SS[.sss]Z 或带时区偏移）
// 拒绝 RFC2822 等宽松格式，强制 AI 用 `date -u +%Y-%m-%dT%H:%M:%S.000Z` 生成
const ISO8601_STRICT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;
const SINCE_DRIFT_LIMIT = 5 * 60 * 1000; // 5 分钟

// 校验 Write current-stage.json 时的 since 字段。
// 返回 null = 通过；返回 string = 错误消息（调用方负责 exit 2）。
function validateSince(newData) {
  if (!newData || typeof newData !== 'object') {
    return '[Harness Stage Guard] current-stage.json 内容不是合法 JSON 对象。';
  }
  if (!newData.since) {
    return '[Harness Stage Guard] since 字段缺失，拒绝写入。\n' +
      '→ current-stage.json 必须包含 since 字段（真实当前时间）。\n' +
      '→ 请用 `date -u +%Y-%m-%dT%H:%M:%S.000Z` 获取当前时间写入 since。';
  }
  if (typeof newData.since !== 'string' || !ISO8601_STRICT.test(newData.since)) {
    return `[Harness Stage Guard] since 字段不是合法 ISO8601 时间戳: ${newData.since}\n` +
      '→ 要求严格 ISO8601 格式（YYYY-MM-DDTHH:MM:SS[.sss]Z），拒绝 RFC2822 等宽松格式。\n' +
      '→ 请用 `date -u +%Y-%m-%dT%H:%M:%S.000Z` 获取当前时间写入 since。';
  }
  const sinceTime = Date.parse(newData.since);
  // 防御：正则形状匹配但日期值不合法（如 2026-99-99T99:99:99Z）Date.parse 返回 NaN
  if (Number.isNaN(sinceTime)) {
    return `[Harness Stage Guard] since 字段形状合法但日期值不合法: ${newData.since}\n` +
      '→ 请检查年月日时分秒是否在合理范围内。\n' +
      '→ 请用 `date -u +%Y-%m-%dT%H:%M:%S.000Z` 获取当前时间写入 since。';
  }
  const now = Date.now();
  const drift = sinceTime - now;
  if (drift > SINCE_DRIFT_LIMIT) {
    return `[Harness Stage Guard] since 字段是未来时间，拒绝写入。\n` +
      `→ 你写入的 since: ${newData.since}\n` +
      `→ 当前真实时间: ${new Date(now).toISOString()}\n` +
      `→ 偏差: ${Math.round(drift / 1000)} 秒（上限 ${SINCE_DRIFT_LIMIT / 1000} 秒）\n` +
      `→ AI 倾向于手编递增时间戳，但 verification-gate 用真实 file mtime 比对，会误报"证据早于任务开始"。\n` +
      `→ 请用 \`date -u +%Y-%m-%dT%H:%M:%S.000Z\` 拿真实时间，再重新写入。`;
  }
  if (drift < -SINCE_DRIFT_LIMIT) {
    return `[Harness Stage Guard] since 字段过于陈旧（早于当前时间 > 5 分钟），拒绝写入。\n` +
      `→ 你写入的 since: ${newData.since}\n` +
      `→ 当前真实时间: ${new Date(now).toISOString()}\n` +
      `→ 偏差: ${Math.round(drift / 1000)} 秒（下限 -${SINCE_DRIFT_LIMIT / 1000} 秒）\n` +
      `→ 请用 \`date -u +%Y-%m-%dT%H:%M:%S.000Z\` 拿真实时间，再重新写入。`;
  }
  return null;
}

// 从 Write tool_input 中解析 newData 并校验 since；错误时直接写 stderr + exit 2
function validateStageWrite(input) {
  let newData = null;
  try {
    newData = JSON.parse(String(input.tool_input?.content || ''));
  } catch {
    process.stderr.write('[Harness Stage Guard] current-stage.json 内容不是合法 JSON，拒绝写入。\n');
    process.exit(2);
  }
  const err = validateSince(newData);
  if (err) {
    process.stderr.write(err + '\n');
    process.exit(2);
  }
  return newData;
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  if (raw.length < MAX_STDIN) raw += chunk.substring(0, MAX_STDIN - raw.length);
});

process.stdin.on('end', () => {
  let shouldBlock = false;

  try {
    const input = JSON.parse(raw);

    if (!fs.existsSync(STAGE_FILE)) {
      // Bootstrap 口：允许 Write current-stage.json，但仍要校验 since
      const writePath = String(input.tool_input?.file_path || '');
      if (input.tool_name === 'Write' && path.resolve(writePath) === path.resolve(STAGE_FILE)) {
        const parsed = validateStageWrite(input);  // 缺失/非法/偏差过大 → exit 2
        process.stderr.write('[Harness Stage Guard] 正在创建阶段声明，放行。\n');
        // 记录阶段历史
        try {
          if (parsed.stage) {
            const entry = JSON.stringify({ stage: parsed.stage, t: new Date().toISOString() }) + '\n';
            let prefix = '';
            try {
              const existing = fs.readFileSync(STAGE_HISTORY_FILE, 'utf8');
              if (existing.length > 0 && !existing.endsWith('\n')) prefix = '\n';
            } catch {}
            fs.appendFileSync(STAGE_HISTORY_FILE, prefix + entry);
          }
        } catch {}
      } else {
        process.stderr.write(REMINDER);
        shouldBlock = true;
      }
    } else {
      const data = JSON.parse(fs.readFileSync(STAGE_FILE, 'utf8'));

      if (data.stage === 'OFF') {
        process.stderr.write(OFF_REMINDER);
      } else if (!data.stage || !STAGES.includes(data.stage)) {
        // 无效 stage 时也允许 Write current-stage.json（修复 deadlock），但仍要校验 since
        const writePath = String(input.tool_input?.file_path || '');
        if (input.tool_name === 'Write' && path.resolve(writePath) === path.resolve(STAGE_FILE)) {
          validateStageWrite(input);  // 缺失/非法/偏差过大 → exit 2
          process.stderr.write('[Harness Stage Guard] 阶段无效，允许重写阶段声明。\n');
        } else {
          process.stderr.write(`[Harness Stage Guard] 无效的阶段值: ${data.stage}。有效值: ${STAGES.join(', ')}, OFF\n`);
          shouldBlock = true;
        }
      } else {
        // Harness 模式生效中
        const toolName = input.tool_name || '';
        const writePath = String(input.tool_input?.file_path || '');

        // ── 阶段切换 Gate 检查 ──
        // 如果是 Write current-stage.json，校验 since 然后检查目标阶段
        if (toolName === 'Write' && path.resolve(writePath) === path.resolve(STAGE_FILE)) {
          const newData = validateStageWrite(input);  // 缺失/非法/偏差过大 → exit 2

          try {
            // 记录阶段历史（确保前面有换行，防止和上一行粘连）
            if (newData.stage) {
              const entry = JSON.stringify({ stage: newData.stage, t: new Date().toISOString() }) + '\n';
              let prefix = '';
              try {
                const existing = fs.readFileSync(STAGE_HISTORY_FILE, 'utf8');
                if (existing.length > 0 && !existing.endsWith('\n')) prefix = '\n';
              } catch {}
              fs.appendFileSync(STAGE_HISTORY_FILE, prefix + entry);
            }

            // 切换到 REVIEW 时的 Gate 检查
            if (newData.stage === 'REVIEW') {
              const gateErrors = [];

              // 检查 1: 流程完整性（stage-history 中必须有 EXECUTE 和 VERIFY）
              let history = [];
              try {
                history = fs.readFileSync(STAGE_HISTORY_FILE, 'utf8')
                  .split('\n').filter(Boolean)
                  .map(l => { try { return JSON.parse(l); } catch { return null; } })
                  .filter(Boolean)
                  .map(h => h.stage);
              } catch {}
              if (!history.includes('EXECUTE')) gateErrors.push('未经过 EXECUTE 阶段');
              if (!history.includes('VERIFY')) gateErrors.push('未经过 VERIFY 阶段');

              // 检查 2: 验证证据文件
              const hasEvidence = VERIFY_EVIDENCE.some(p => {
                try { return fs.statSync(p).isFile(); } catch { return false; }
              });
              if (!hasEvidence) gateErrors.push('未找到验证证据文件（' + VERIFY_EVIDENCE.join(' / ') + '）');

              if (gateErrors.length > 0) {
                process.stderr.write(REVIEW_GATE_BLOCK);
                process.stderr.write('\n具体问题:\n' + gateErrors.map(e => '  - ' + e).join('\n') + '\n');
                shouldBlock = true;
                // 输出后直接退出，不继续后续检查
                process.exit(2);
              }
            }
          } catch {}
          // 阶段切换 Write 放行（如果 Gate 检查通过）
          process.stderr.write(`[Harness Stage Guard] 阶段切换：允许写入 ${writePath}\n`);
          process.stdout.write(raw);
          return;
        }

        // 首次工具调用检查：强制 AI 先输出阶段声明
        let toolCount = { count: 999 }; // 默认跳过（文件不存在时不阻止）
        try { toolCount = JSON.parse(fs.readFileSync(TOOL_COUNT_FILE, 'utf8')); } catch {}
        if (toolCount.count === 0 && !TASK_TOOLS.includes(toolName)) {
          // 递增计数器，下次不再阻止
          try { fs.writeFileSync(TOOL_COUNT_FILE, JSON.stringify({ count: 1 }) + '\n'); } catch {}
          process.stderr.write(FIRST_CALL_BLOCK);
          shouldBlock = true;
        } else if (data.stage === 'PLAN') {
        // PLAN 阶段：硬约束——只允许读工具 + 任务管理工具 + Write 计划文件/阶段文件
          const isReadTool = READ_TOOLS.includes(toolName);
          const isTaskTool = TASK_TOOLS.includes(toolName);
          // 精确匹配：resolve 后比对，防止路径绕过
          const resolvedWrite = path.resolve(writePath);
          const isAllowedWrite = toolName === 'Write' &&
            [PLAN_FILE, STAGE_FILE].some(f => resolvedWrite === path.resolve(f));

          if (isReadTool) {
            // 读操作放行，注入 directive
            process.stderr.write(STAGE_DIRECTIVES.PLAN);
            process.stderr.write(LOG_REMINDER);
          } else if (isTaskTool) {
            // 任务管理工具放行，不打扰（流程管理操作）
          } else if (isAllowedWrite) {
            // 写计划文件或阶段声明放行
            process.stderr.write(`[Harness Stage Guard] PLAN 阶段：允许写入 ${writePath}\n`);
          } else {
            // 其他一律阻止
            process.stderr.write(PLAN_BLOCK_MSG);
            shouldBlock = true;
          }
        } else {
          // 非 PLAN 阶段：注入阶段工作要求，不阻止
          process.stderr.write(
            `[Harness ON] 当前阶段: ${data.stage}` + (data.task ? ` — ${data.task}` : '') + '\n'
          );

          // TaskUpdate(completed) 在 EXECUTE/VERIFY 阶段提醒确认 VERIFY
          if (toolName === 'TaskUpdate') {
            const taskStatus = String(input.tool_input?.status || '');
            if (taskStatus === 'completed' && ['EXECUTE', 'VERIFY'].includes(data.stage)) {
              process.stderr.write(
                `[Harness Stage Guard] 在 ${data.stage} 阶段标记任务完成。确认是否已完成 VERIFY 并产出验证证据？\n`
              );
            }
          }

          if (STAGE_DIRECTIVES[data.stage]) {
            process.stderr.write(STAGE_DIRECTIVES[data.stage]);
            process.stderr.write(LOG_REMINDER);
          }
        }

        // 过期提醒
        if (data.since) {
          const elapsed = Date.now() - new Date(data.since).getTime();
          if (elapsed > STALE_MS) {
            process.stderr.write(STALE_REMINDER);
          }
        }
      }
    }
  } catch (e) {
    process.stderr.write(`[Harness Stage Guard] 无法读取 ${STAGE_FILE}: ${e.message}\n`);
    shouldBlock = true; // 异常时阻止，不能失败即放行
  }

  if (shouldBlock) {
    process.exit(2);
  } else {
    process.stdout.write(raw);
  }
});
