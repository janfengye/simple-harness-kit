# 场景 5：Hook 拦截

## 前置条件
- 项目已初始化 Harness

## 触发

依次尝试以下操作，验证 Hook 是否拦截：

1. `git push --force origin main` → safety-guard 应拦截
2. 派发修复类 Agent 但不引用 Constraint ID → agent-check 应警告
3. 未完成 QA 就 git commit → verification-gate 应阻止
4. AI commit 不带 Co-Authored-By → commit-check 应警告

## 验证清单

- [ ] safety-guard: exit 2 阻止了 force push
- [ ] agent-check: stderr 输出了警告
- [ ] verification-gate: exit 2 阻止了未验证的 commit
- [ ] commit-check: stderr 提醒了缺少 Co-Authored-By
- [ ] 以上事件均记录到 session-log

## 回归风险

Hook 是唯一 100% 可靠的约束机制。如果 Hook 不生效，整个 Harness 的强制执行能力丧失。
