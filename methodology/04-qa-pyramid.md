# 5 层 QA 金字塔

## 核心原则

> AI 做 4 层，人做 1 层。每层独立拦截问题，纵深防御。

## 金字塔结构

```
┌─────────────────────────────────────────────────────┐
│ Layer 5: Human Final Review（人工最终审查）           │
│   只看报告 + 关键决策，5 项交付前复盘                │
│   投入：最少                                         │
├─────────────────────────────────────────────────────┤
│ Layer 4: Santa Method（AI 对抗验证）                 │
│   两个独立 Reviewer Agent 同时检查                    │
│   都通过 → 提交人工审查                              │
│   任一不通过 → 自动修复循环（max 3 轮）               │
├─────────────────────────────────────────────────────┤
│ Layer 3: Spec Compliance Review（AI 规格审查）        │
│   独立 Agent 对照需求规格逐项检查                     │
│   Reviewer ≠ Author（消除 author-bias）              │
├─────────────────────────────────────────────────────┤
│ Layer 2: Verification Loop（自动化工具检查）           │
│   Build → Type Check → Lint → Test → Security → Diff │
│   全部 PASS 才能进入 Layer 3                         │
├─────────────────────────────────────────────────────┤
│ Layer 1: Agent Self-Verification（Agent 自验）        │
│   TDD 红绿重构 + 实现后立即自验                       │
│   最基础的质量保证                                   │
└─────────────────────────────────────────────────────┘
```

## Layer 1: Agent Self-Verification

**谁执行：** 实现任务的 Agent 自己
**何时执行：** 每个任务完成后立即执行
**怎么执行：**

1. TDD 红绿重构循环：
   - 先写失败测试（RED）
   - 写最少代码通过测试（GREEN）
   - 重构（REFACTOR）
2. 实现完成后运行全部相关测试
3. 检查自己的改动是否引入新的 warning/error

**Gate 条件：** 测试通过 + 无新 warning

**铁律：** NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST

## Layer 2: Verification Loop

**谁执行：** 自动化工具（不依赖 LLM 判断）
**何时执行：** Agent 自验通过后，进入下一层前
**怎么执行：**

```bash
# Phase 1: Build
npm run build  # 或项目对应的构建命令

# Phase 2: Type Check
npx tsc --noEmit  # 或 pyright / mypy

# Phase 3: Lint
npm run lint  # 或 ruff check / golint

# Phase 4: Test Suite
npm test -- --coverage  # 目标覆盖率 ≥ 80%

# Phase 5: Security Scan
grep -rn "sk-\|api_key\|password" src/  # 基础秘钥扫描

# Phase 6: Diff Review
git diff --stat  # 检查改动范围是否合理
```

**Gate 条件：** 6 项全部 PASS

**输出格式：**
```
VERIFICATION REPORT
===================
Build:     [PASS/FAIL]
Types:     [PASS/FAIL] (N errors)
Lint:      [PASS/FAIL] (N warnings)
Tests:     [PASS/FAIL] (X/Y passed, Z% coverage)
Security:  [PASS/FAIL] (N issues)
Diff:      [N files changed, +X/-Y lines]

Overall:   [READY/NOT READY]
```

## Layer 3: Spec Compliance Review

**谁执行：** 独立的 Reviewer Agent（不是写代码的那个 Agent）
**何时执行：** Verification Loop 全部 PASS 后
**怎么执行：**

1. Reviewer 收到：需求规格 + Agent 的代码变更
2. 逐项对照规格检查：
   - 每个需求点是否被实现
   - 实现是否符合规格描述
   - 是否有遗漏的边界条件
3. 输出结构化报告

**关键设计：Reviewer ≠ Author**

写代码的 Agent 和做 review 的 Agent 必须是不同的 Agent 实例（独立上下文）。这消除了 author-bias——作者审查自己的代码时，会不自觉地用"我知道我想做什么"来填补代码中的漏洞。

**Gate 条件：** 所有规格项 PASS

## Layer 4: Santa Method（对抗验证）

**谁执行：** 两个独立的 Reviewer Agent（互相不知道对方的存在）
**何时执行：** 高风险产出物、生产部署前、复杂逻辑变更
**怎么执行：**

```
Phase 1: Make a List
  Generator Agent 完成实现

Phase 2: Check It Twice
  ┌───────────┐  ┌───────────┐
  │ Reviewer A │  │ Reviewer B │  ← 独立上下文，相同 rubric
  └─────┬─────┘  └─────┬─────┘
        │              │
        ↓              ↓
Phase 3: Naughty or Nice
  A passes AND B passes → NICE → 进入 Layer 5
  否则 → NAUGHTY → 进入 Fix Cycle

Phase 4: Fix Until Nice
  收集所有 issue → Fix Agent 修复 → 重新双 Review
  最多 3 轮。超过 3 轮 → 升级给人工处理
```

**关键不变量：**
- 上下文隔离：两个 Reviewer 互不可见
- 相同 rubric：评审标准一致
- 都必须通过：一个发现问题就算 NAUGHTY
- Fresh Agent per round：每轮修复后用新 Agent 重审，防止锚定偏差

**Rubric 设计原则：**
每个检查项必须有客观的 PASS/FAIL 条件，不接受"看起来不错"。

| 检查项 | PASS 条件 | FAIL 信号 |
|--------|----------|----------|
| 功能正确性 | 所有 spec 需求被覆盖 | 遗漏需求项 |
| 无幻觉 | 无虚构的 API/函数/URL | 引用不存在的东西 |
| 安全性 | 无硬编码密钥，输入有验证 | 发现敏感信息 |
| 一致性 | 无自相矛盾 | A 处说 X，B 处说 non-X |
| 技术正确性 | 代码可编译运行，逻辑正确 | 语法错误、逻辑 bug |

**跨模型对抗（扩展）：**
可以用 Codex 做 Reviewer A，Claude 做 Reviewer B。不同模型有不同的盲区，交叉审查进一步降低逃逸率。

**指标：**
- First-pass rate：第一轮通过率（目标 >70%）
- Mean iterations：平均修复轮数（目标 <1.5）
- Escape rate：上线后发现的问题（目标 0）

**何时跳过 Layer 4：**
- 低风险改动（文档、配置、格式化）
- 已有充分的自动化测试覆盖
- 时间压力下可降级为 Layer 3 only，但需要记录降级决策

## Layer 5: Human Final Review

**谁执行：** 人
**何时执行：** Layer 4 通过后（或 Layer 3 通过后如果跳过了 Layer 4）
**怎么执行：**

交付前 5 项复盘清单：

1. **流程合规**：是否按 6 阶段 Loop 执行？是否有跳过的阶段？
2. **QA 达标**：各层 QA 报告是否完整？量化指标是否达标？
3. **需求完整**：用户/产品的所有需求点是否全部处理？
4. **规则升级**：过程中发现的新问题是否已写入 constraints.md？
5. **改进机会**：哪些步骤下次可以优化？

**人只需要看报告和做判断，不需要逐行审查代码。** 逐行审查是 Layer 3 和 Layer 4 的工作。

## 量化指标体系

来自 eval-harness 的度量框架：

| 指标 | 含义 | 目标 |
|------|------|------|
| pass@1 | 一次就通过的比例 | >70% |
| pass@3 | 三次内通过的比例 | >90% |
| First-pass rate | Santa 第一轮通过率 | >70% |
| Mean iterations | 平均修复轮数 | <1.5 |
| Escape rate | 上线后发现问题 | 0 |
| Coverage | 测试覆盖率 | ≥80% |

## 层级之间的关系

```
Layer 1 失败 → 不进入 Layer 2（Agent 自己先修）
Layer 2 失败 → 不进入 Layer 3（工具检查先修）
Layer 3 失败 → 不进入 Layer 4（规格不符先修）
Layer 4 失败 → 自动修复循环，不进入 Layer 5
Layer 4 通过 → 进入 Layer 5（人工最终审查）
```

每层都是门控，不允许"先过了再说"。这保证了到达人工审查时，大部分问题已经被解决。
