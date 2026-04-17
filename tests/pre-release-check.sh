#!/bin/bash
# pre-release-check.sh — 发版前强制门控 (C-GATE-09)
#
# 在 git tag v* 之前必须运行, 确保:
#   1. tests/run.js 全绿 (0 FAIL)
#   2. 工作树干净 (无 uncommitted / untracked)
#   3. local master 与 origin/master 同步
#
# 任一 FAIL → exit 1, 拒绝 release. 强制约束见 docs/constraints.md C-GATE-09.
#
# 背景: v0.8.6 ship 时带着 2 个 pre-existing tests/run.js FAIL(05-mutation M1 + codex-smoke-selftest),
# 用户发现后追溯才修(v0.8.7). 之前的 release-process.md Step 0 / 0.5 只跑 template-integrity.js 和
# run-all.sh 脚本矩阵, 不覆盖 hook-scenarios / codex-smoke 等路径. 本脚本统一 run.js 作为完整 gate.
#
# 用法:
#   bash tests/pre-release-check.sh                # 完整检查
#   SKIP_SYNC_CHECK=1 bash tests/pre-release-check.sh   # 跳过 git sync 检查 (本地实验用, 不得用于真实 release)
#   CODEX_REQUIRED=1 bash tests/pre-release-check.sh    # 无 codex 也 FAIL (CI 模式)

set -u
set -o pipefail

KIT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$KIT_ROOT"

FAILURES=0
header() { echo ""; echo "── $1 ──"; }

header "1. tests/run.js 全绿"
if node tests/run.js > /tmp/pre-release-runjs.log 2>&1; then
  tail -3 /tmp/pre-release-runjs.log
  echo "  PASS"
else
  rc=$?
  tail -5 /tmp/pre-release-runjs.log
  echo "  FAIL: tests/run.js exit=$rc (详见 /tmp/pre-release-runjs.log)"
  FAILURES=$((FAILURES + 1))
fi

header "2. 工作树干净 (无 uncommitted / untracked)"
if [ -z "$(git status --porcelain 2>/dev/null)" ]; then
  echo "  PASS"
else
  echo "  FAIL: working tree 脏"
  git status --short | head -10
  FAILURES=$((FAILURES + 1))
fi

header "3. local master ≡ origin/master"
if [ "${SKIP_SYNC_CHECK:-0}" = "1" ]; then
  echo "  SKIP (SKIP_SYNC_CHECK=1)"
else
  BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
  if [ "$BRANCH" != "master" ] && [ "$BRANCH" != "main" ]; then
    echo "  FAIL: 当前分支 $BRANCH 不是 master/main"
    FAILURES=$((FAILURES + 1))
  else
    LOCAL="$(git rev-parse HEAD 2>/dev/null)"
    REMOTE="$(git rev-parse "@{u}" 2>/dev/null || echo "")"
    if [ -z "$REMOTE" ]; then
      echo "  FAIL: 无 upstream (git rev-parse @{u} 为空)"
      FAILURES=$((FAILURES + 1))
    elif [ "$LOCAL" != "$REMOTE" ]; then
      AHEAD="$(git rev-list --count "$REMOTE..HEAD")"
      BEHIND="$(git rev-list --count "HEAD..$REMOTE")"
      echo "  FAIL: local ahead=$AHEAD / behind=$BEHIND 条 commit"
      FAILURES=$((FAILURES + 1))
    else
      echo "  PASS (HEAD=$LOCAL)"
    fi
  fi
fi

echo ""
if [ "$FAILURES" -gt 0 ]; then
  echo "══════════════════════════════"
  echo "  Pre-Release Check: $FAILURES 项 FAIL — 拒绝 release (C-GATE-09)"
  echo "══════════════════════════════"
  exit 1
fi

echo "══════════════════════════════"
echo "  Pre-Release Check: 全部 PASS — 可以 tag + push + release"
echo "══════════════════════════════"
exit 0
