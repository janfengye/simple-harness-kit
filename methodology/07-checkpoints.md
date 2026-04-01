# Gate 条件清单

## 概述

每个阶段都有 Gate 条件，不满足则不进入下一阶段。Gate 是硬性的，不允许"先过了再说"。

## 阶段 Gate 汇总

### ① PLAN Gate

| 检查项 | 条件 | 检查方式 |
|--------|------|---------|
| 任务粒度 | 每个任务 ≤15 分钟可独立验证 | Director 判断 |
| 验收标准 | 每个任务有明确的 done 条件 | 文本检查 |
| 单一风险 | 每个任务有且只有一个主要风险 | Director 判断 |
| 依赖标注 | 任务间依赖关系已标注 | 文本检查 |

### ② SETUP Gate

| 检查项 | 条件 | 检查方式 |
|--------|------|---------|
| Rules 存在 | .claude/rules/ 下有规则文件 | 文件检查 |
| Hooks 配置 | .claude/settings.json 中有 hooks | 文件检查 |
| **Hook 实弹测试** | **故意触发一次拦截，验证 Hook 真的生效** | **实际执行危险命令（如 echo "rm -rf /" 通过 stdin 传给 safety-guard.js）** |
| Constraints 存在 | docs/constraints.md 已创建 | 文件检查 |

> **实战经验（Experiment A）：** SETUP 阶段只检查了文件是否存在，没有实际测试 Hook 拦截效果。后来发现 session-logger.js 的 PostToolUse Hook 可能未正确触发。如果 SETUP 阶段做了实弹测试，就能更早发现问题。

### ③ EXECUTE Gate（每个任务）

| 检查项 | 条件 | 检查方式 |
|--------|------|---------|
| TDD | 测试先于实现被编写 | Git diff 时序 |
| 测试通过 | 所有相关测试 PASS | 运行测试 |
| 无新 warning | 不引入新的 warning/error | 构建输出 |
| Constraint 引用 | 修复类 commit 引用 ID | Hook 检查 |

### ④ VERIFY Gate

| 检查项 | 条件 | 检查方式 |
|--------|------|---------|
| Build | 构建成功 | exit code 0 |
| Type Check | 无类型错误 | 编译器输出 |
| Lint | 无 lint 错误 | linter 输出 |
| Test | 全部通过，覆盖率 ≥80% | 测试报告 |
| Security | 无硬编码密钥 | grep 扫描 |
| Diff 合理 | 改动范围符合预期 | git diff --stat |
| Spec 合规 | Reviewer verdict = PASS | Review 报告 |
| Santa（可选） | 双 Reviewer verdict = NICE | Santa 报告 |

### ⑤ REVIEW Gate

| 检查项 | 条件 | 检查方式 |
|--------|------|---------|
| 流程合规 | 按 6 阶段执行 | Director 自查 |
| QA 达标 | 各层报告完整 | 报告检查 |
| 需求完整 | 全部需求处理 | 逐项对照 |
| 规则升级 | 新问题写入 constraints | 文件检查 |
| **代码已提交** | **变更已 commit，commit message 引用 Constraint ID（如适用）** | **git status 无未提交变更** |
| 改进记录 | 改进机会已记录 | 文本检查 |

> **实战经验（Experiment A）：** REVIEW 通过但代码未 commit，所有变更停留在 working tree。加入"代码已提交"检查项防止此问题。

## 铁律（Iron Laws）

跨阶段的绝对约束，任何阶段都不可违反：

| 铁律 | 含义 | 来源 |
|------|------|------|
| NO CODE WITHOUT FAILING TEST | 不写失败测试就不写实现代码 | TDD |
| NO FIX WITHOUT ROOT CAUSE | 不找到根因就不动手修 | Systematic Debugging |
| NO CLAIM WITHOUT EVIDENCE | 不跑验证就不声称完成 | Verification Before Completion |
| NO RULE WITHOUT VIOLATION | 不是凭空想规则，而是从违规中提炼 | Feedback Loop |

## Red Flags（正在合理化违规的信号）

当 Agent（或人）出现以下思维模式时，说明正在试图绕过 Gate：

- "这个很简单，不需要走流程"
- "先提交，测试下次再补"
- "这种情况应该例外"
- "时间紧，先过了再说"
- "我手动验证过了"（没有证据）
- "测试应该能通过"（没有运行）
- "只是小改动，不需要 review"

**出现任何 Red Flag → 停下来，回到流程。**
