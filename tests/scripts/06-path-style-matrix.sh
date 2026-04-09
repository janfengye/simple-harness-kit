#!/bin/bash
# 维度 6: 路径风格矩阵 (plain / 空格 / 中文 / 超长)
#
# 目标 bug: shell 脚本没加引号 / 路径长度 / 字符编码问题.
# 方法: 用 4 种风格路径作为 KIT 安装位置, 对每种跑维度 01 + 04 的核心用例.
#
# 为了节省时间, 每种只跑 2 个最关键的维度 (幂等 + 结构不变式).
# 维度 02/03 也内部用 mktemp 会一并受益, 但不是本维度的主焦点.

set -uo pipefail

EXPECTED_ASSERTIONS=8
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

TMP_BASE="$(mktemp -d "${TMPDIR:-/tmp}/harness-pathstyle-XXXXXX")"
cleanup() { rm -rf "$TMP_BASE"; }
trap cleanup EXIT

# 4 种路径风格目录
DIR_PLAIN="$TMP_BASE/plain-kit"
DIR_SPACES="$TMP_BASE/kit with spaces"
DIR_CJK="$TMP_BASE/kit-中文目录"
DIR_LONG="$TMP_BASE/kit-very-long-path-exceeding-common-assumptions/sub/deep/nest"

mkdir -p "$DIR_PLAIN" "$DIR_SPACES" "$DIR_CJK" "$DIR_LONG"
cp -R "$KIT_SRC/." "$DIR_PLAIN/"
cp -R "$KIT_SRC/." "$DIR_SPACES/"
cp -R "$KIT_SRC/." "$DIR_CJK/"
cp -R "$KIT_SRC/." "$DIR_LONG/"

run_with_kit() {
  local kit_dir="$1"
  local dim_name="$2"
  HARNESS_TEST_KIT_SRC="$kit_dir" bash "$SCRIPT_DIR/$dim_name" >/dev/null 2>&1
  return $?
}

# ── plain ──
set +e
run_with_kit "$DIR_PLAIN" "01-script-idempotency.sh"
rc_plain_01=$?
run_with_kit "$DIR_PLAIN" "04-dir-structure-invariant.sh"
rc_plain_04=$?
set -e
assert "plain 路径 维度 01 PASS" "[ $rc_plain_01 -eq 0 ]"
assert "plain 路径 维度 04 PASS" "[ $rc_plain_04 -eq 0 ]"

# ── spaces ──
set +e
run_with_kit "$DIR_SPACES" "01-script-idempotency.sh"
rc_sp_01=$?
run_with_kit "$DIR_SPACES" "04-dir-structure-invariant.sh"
rc_sp_04=$?
set -e
assert "空格路径 维度 01 PASS" "[ $rc_sp_01 -eq 0 ]"
assert "空格路径 维度 04 PASS" "[ $rc_sp_04 -eq 0 ]"

# ── CJK ──
set +e
run_with_kit "$DIR_CJK" "01-script-idempotency.sh"
rc_cjk_01=$?
run_with_kit "$DIR_CJK" "04-dir-structure-invariant.sh"
rc_cjk_04=$?
set -e
assert "中文路径 维度 01 PASS" "[ $rc_cjk_01 -eq 0 ]"
assert "中文路径 维度 04 PASS" "[ $rc_cjk_04 -eq 0 ]"

# ── long ──
set +e
run_with_kit "$DIR_LONG" "01-script-idempotency.sh"
rc_long_01=$?
run_with_kit "$DIR_LONG" "04-dir-structure-invariant.sh"
rc_long_04=$?
set -e
assert "超长路径 维度 01 PASS" "[ $rc_long_01 -eq 0 ]"
assert "超长路径 维度 04 PASS" "[ $rc_long_04 -eq 0 ]"

[ "$ASSERTIONS_RUN" -eq "$EXPECTED_ASSERTIONS" ] || {
  echo "  ERR: EXPECTED=$EXPECTED_ASSERTIONS 实际 $ASSERTIONS_RUN"
  exit 99
}

if [ "$ASSERTIONS_FAIL" -gt 0 ]; then
  echo "  [06-pathstyle] FAIL: $ASSERTIONS_FAIL / $ASSERTIONS_RUN"
  exit 1
fi
echo "  [06-pathstyle] PASS: $ASSERTIONS_RUN / $ASSERTIONS_RUN"
exit 0
