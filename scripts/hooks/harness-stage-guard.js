#!/usr/bin/env node
'use strict';

/**
 * Harness Stage Guard — 强制新 session 声明 Harness 阶段
 * 触发: PreToolUse:*（建议挂在 Bash, Edit, Write, Agent 上）
 *
 * 机制:
 * 1. 检查 .harness/current-stage.json 是否存在
 * 2. 不存在 → stderr 输出 Harness 流程提醒，要求声明阶段
 * 3. stage = "OFF" → 会话级关闭，每次调用提醒"Harness 已关闭"
 * 4. 存在但超过 2 小时 → 提醒确认阶段是否仍然正确
 *
 * 不阻止工具调用（exit 0），只通过 stderr 注入提醒。
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

const STAGE_FILE = '.harness/current-stage.json';
const STALE_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_STDIN = 1024 * 1024;

const STAGES = ['PLAN', 'SETUP', 'EXECUTE', 'VERIFY', 'REVIEW', 'FEEDBACK'];

// 每个阶段的工作要求——通过 stderr 在每次工具调用时注入
const STAGE_DIRECTIVES = {
  PLAN: `[PLAN 阶段要求]
1. 明确需求和验收标准
2. 任务拆解——每个任务 ≤15 分钟可独立验证
3. 定义每个任务的 done 条件
4. 识别任务间依赖关系
5. 产出任务清单后暂停，等用户确认再继续
Gate: 每个任务有验收标准 + 粒度≤15min + 单一主要风险 + 依赖已标注
PLAN 完成前不要进入 EXECUTE。方向错了后面全白做。
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
2. QA 达标：各层 QA 报告是否完整？
3. 需求完整：所有需求是否全部处理？
4. 规则升级：过程中新问题是否写入 constraints？
5. 改进机会：哪些步骤下次可以优化？
6. 行为学习（自动）：运行 harness-learn 分析 observations
Gate: 前 5 项全部 ✓ + 第 6 项自动完成
达标→交付，不达标→进入 FEEDBACK。
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
      // Bootstrap 口：允许 Write current-stage.json
      const writePath = String(input.tool_input?.file_path || '');
      if (input.tool_name === 'Write' && writePath.endsWith(STAGE_FILE)) {
        process.stderr.write('[Harness Stage Guard] 正在创建阶段声明，放行。\n');
      } else {
        process.stderr.write(REMINDER);
        shouldBlock = true;
      }
    } else {
      const data = JSON.parse(fs.readFileSync(STAGE_FILE, 'utf8'));

      if (data.stage === 'OFF') {
        process.stderr.write(OFF_REMINDER);
      } else if (!data.stage || !STAGES.includes(data.stage)) {
        // 无效 stage 时也允许 Write current-stage.json（修复 deadlock）
        const writePath = String(input.tool_input?.file_path || '');
        if (input.tool_name === 'Write' && writePath.endsWith(STAGE_FILE)) {
          process.stderr.write('[Harness Stage Guard] 阶段无效，允许重写阶段声明。\n');
        } else {
          process.stderr.write(`[Harness Stage Guard] 无效的阶段值: ${data.stage}。有效值: ${STAGES.join(', ')}, OFF\n`);
          shouldBlock = true;
        }
      } else {
        // Harness 模式生效中——通过 stderr 注入阶段工作要求
        process.stderr.write(
          `[Harness ON] 当前阶段: ${data.stage}` + (data.task ? ` — ${data.task}` : '') + '\n'
        );
        if (STAGE_DIRECTIVES[data.stage]) {
          process.stderr.write(STAGE_DIRECTIVES[data.stage]);
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
  }

  if (shouldBlock) {
    process.exit(2);
  } else {
    process.stdout.write(raw);
  }
});
