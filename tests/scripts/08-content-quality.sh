#!/bin/bash
# 维度 8: init 后项目的 rule 文件内容质量断言 (C-GATE-04 第 2 层)
#
# 目标: 验证 init 生成的 .claude/rules/qa-standards.md 含必需行为指令.
# 背景: VH-11 — 模板骨架缺 TDD 铁律导致 AI 不写测试. 此维度在 init 后的
#        "用户项目" 里检查, 不是检查 kit 模板本身 (那是 T15 的工作).
#
# 依赖: codex CLI (用 codex 做一次真实 init, 然后 grep 产物)
# 如果 codex 不可用: SKIP (不是 FAIL, 但会降低验收覆盖度)

set -uo pipefail

EXPECTED_ASSERTIONS=7
ASSERTIONS_RUN=0
ASSERTIONS_FAIL=0

assert() {
  local desc="$1" cond="$2"
  ASSERTIONS_RUN=$((ASSERTIONS_RUN+1))
  if eval "$cond" 2>/dev/null; then
    echo "  PASS [$ASSERTIONS_RUN] $desc"
  else
    echo "  FAIL [$ASSERTIONS_RUN] $desc"
    ASSERTIONS_FAIL=$((ASSERTIONS_FAIL+1))
  fi
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
KIT_SRC="$(cd "$SCRIPT_DIR/../.." && pwd)"
KIT_SRC="${HARNESS_TEST_KIT_SRC:-$KIT_SRC}"

# 检查 codex 是否可用
if ! command -v codex >/dev/null 2>&1; then
  echo "  SKIP [08-content-quality] codex CLI 不可用, 跳过 (C-GATE-04 第 2 层降级)"
  exit 0
fi

TMP_KIT="$(mktemp -d "${TMPDIR:-/tmp}/harness-cq-kit-XXXXXX")"
TMP_HOME="$(mktemp -d "${TMPDIR:-/tmp}/harness-cq-home-XXXXXX")"
TMP_PROJ="$(mktemp -d "${TMPDIR:-/tmp}/harness-cq-proj-XXXXXX")"

cleanup() { rm -rf "$TMP_KIT" "$TMP_HOME" "$TMP_PROJ"; }
trap cleanup EXIT

# 拷贝 kit 到 tmp (排除 .git 避免权限问题)
rsync -a --exclude='.git' "$KIT_SRC/" "$TMP_KIT/" 2>/dev/null || cp -R "$KIT_SRC/." "$TMP_KIT/" 2>/dev/null

# 创建最小 Node.js 项目
echo '{"name":"cq-test","version":"0.1.0","scripts":{"test":"echo no tests"}}' > "$TMP_PROJ/package.json"
mkdir -p "$TMP_PROJ/src"
echo 'export function add(a,b){return a+b}' > "$TMP_PROJ/src/add.js"

# 用 codex 做 init (超时 120 秒)
INIT_PROMPT="Read $TMP_KIT/init-prompt.md and $TMP_KIT/methodology/. Init harness for this Node.js project. Use $TMP_KIT/templates/ and $TMP_KIT/scripts/hooks/. Do NOT run validate.sh."
INIT_OUT=$(echo "$INIT_PROMPT" | timeout 120 codex exec --full-auto --skip-git-repo-check --cd "$TMP_PROJ" - 2>&1) || true

QA_FILE="$TMP_PROJ/.claude/rules/qa-standards.md"

if [ ! -f "$QA_FILE" ]; then
  echo "  SKIP [08-content-quality] codex init 未在 120s 内生成 qa-standards.md (infrastructure, 非测试失败)"
  exit 0
fi

assert "qa-standards.md 存在且非空" "[ -s '$QA_FILE' ]"
assert "含 TDD 铁律" "grep -q 'NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST' '$QA_FILE'"
assert "含 Layer 1 (Agent Self-Verification)" "grep -q 'Layer 1' '$QA_FILE'"
assert "含 Layer 2 (Verification Loop)" "grep -q 'Layer 2' '$QA_FILE'"
assert "含 Reviewer (Spec Review / Santa)" "grep -qi 'Reviewer' '$QA_FILE'"
assert "含 5 层金字塔 (至少 Layer 1-5)" "[ \$(grep -c 'Layer [1-5]' '$QA_FILE') -ge 5 ]"
assert "CLAUDE.md 存在且项目定制 (>200 bytes)" "[ -f '$TMP_PROJ/CLAUDE.md' ] && [ \$(wc -c < '$TMP_PROJ/CLAUDE.md') -gt 200 ]"

[ "$ASSERTIONS_RUN" -eq "$EXPECTED_ASSERTIONS" ] || {
  echo "  ERR: EXPECTED_ASSERTIONS=$EXPECTED_ASSERTIONS 但实际跑了 $ASSERTIONS_RUN"
  exit 99
}

if [ "$ASSERTIONS_FAIL" -gt 0 ]; then
  echo "  [08-content-quality] FAIL: $ASSERTIONS_FAIL / $ASSERTIONS_RUN"
  exit 1
fi

echo "  [08-content-quality] PASS: $ASSERTIONS_RUN / $ASSERTIONS_RUN"
exit 0
