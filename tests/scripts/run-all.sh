#!/bin/bash
# tests/scripts/run-all.sh — 脚本化测试矩阵主 runner
#
# 用途: 串联跑 7 个维度脚本 + 元防御检查 (L1 语法 / L6 multi-shell).
# 退出码: 0 = 全 PASS, 非零 = 有 FAIL 或异常.
#
# 用法:
#   bash tests/scripts/run-all.sh
#
# 被 tests/run.js 调用, 作为 kit 总测试的一部分.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "════════════════════════════════════════════════════"
echo "  Scripted Test Matrix (tests/scripts/run-all.sh)"
echo "════════════════════════════════════════════════════"

# ── Precheck: 必要工具存在 ──
echo ""
echo "── Tool precheck ──"

PRECHECK_FAIL=0
check_tool() {
  local name="$1"
  if command -v "$name" >/dev/null 2>&1; then
    echo "  ok   $name"
  else
    echo "  MISS $name"
    PRECHECK_FAIL=$((PRECHECK_FAIL+1))
  fi
}

# 必需
check_tool bash
check_tool node
check_tool diff
check_tool find
check_tool grep
check_tool sed
check_tool cp
check_tool cmp
check_tool mktemp
check_tool wc
check_tool awk

# 可选
HAS_SHELLCHECK=0
if command -v shellcheck >/dev/null 2>&1; then
  HAS_SHELLCHECK=1
  echo "  ok   shellcheck (optional)"
else
  echo "  skip shellcheck (optional, not installed)"
fi

HAS_ZSH=0
if command -v zsh >/dev/null 2>&1; then
  HAS_ZSH=1
  echo "  ok   zsh (optional, for L6 multi-shell)"
else
  echo "  skip zsh (optional)"
fi

if [ $PRECHECK_FAIL -gt 0 ]; then
  echo ""
  echo "  precheck FAIL: $PRECHECK_FAIL 个必需工具缺失"
  exit 2
fi

# ── Meta L1: 语法检查 ──
echo ""
echo "── Meta L1: bash -n 语法检查 ──"

L1_FAIL=0
for f in "$SCRIPT_DIR"/0[1-7]-*.sh "$SCRIPT_DIR/run-all.sh"; do
  if [ -f "$f" ]; then
    if bash -n "$f" 2>/dev/null; then
      echo "  ok   $(basename "$f")"
    else
      echo "  FAIL $(basename "$f")"
      bash -n "$f" 2>&1 | sed 's/^/       /'
      L1_FAIL=$((L1_FAIL+1))
    fi
  fi
done

if [ $HAS_SHELLCHECK -eq 1 ]; then
  echo ""
  echo "── Meta L1+: shellcheck (optional, warning only) ──"
  for f in "$SCRIPT_DIR"/0[1-7]-*.sh "$SCRIPT_DIR/run-all.sh"; do
    if [ -f "$f" ]; then
      # shellcheck 失败只警告, 不阻塞
      if shellcheck -x "$f" >/dev/null 2>&1; then
        echo "  ok   $(basename "$f")"
      else
        echo "  warn $(basename "$f") (shellcheck issues, 非阻塞)"
      fi
    fi
  done
fi

if [ $L1_FAIL -gt 0 ]; then
  echo ""
  echo "  Meta L1 FAIL: 语法错误, 无法继续"
  exit 1
fi

# ── 执行 7 个维度脚本 ──
echo ""
echo "── 维度 01-07 ──"

DIMS=(
  "01-script-idempotency.sh"
  "02-skill-path-resolution.sh"
  "03-full-e2e.sh"
  "04-dir-structure-invariant.sh"
  "05-mutation-test.sh"
  "06-path-style-matrix.sh"
  "07-scope-branches.sh"
)

TOTAL=0
PASS=0
FAIL=0
FAIL_NAMES=()

for dim in "${DIMS[@]}"; do
  TOTAL=$((TOTAL+1))
  echo ""
  echo "▶ $dim"
  set +e
  bash "$SCRIPT_DIR/$dim"
  rc=$?
  set -e
  if [ $rc -eq 0 ]; then
    PASS=$((PASS+1))
  else
    FAIL=$((FAIL+1))
    FAIL_NAMES+=("$dim (exit $rc)")
  fi
done

# ── Meta L6: multi-shell 兼容 (如果有 zsh) ──
# 只对维度 01/04 再跑一次, 用 zsh 解析器验证脚本在 zsh 下也能运行.
# 注意: 本测试脚本 shebang 是 bash, 但许多用户环境默认 shell 是 zsh (macOS).
# 我们用 `zsh -c 'bash scriptname'` 这种方式跑 — 主要是验证 zsh 能正确 spawn bash.
if [ $HAS_ZSH -eq 1 ]; then
  echo ""
  echo "── Meta L6: multi-shell (zsh) 兼容检查 ──"
  for dim in "01-script-idempotency.sh" "04-dir-structure-invariant.sh"; do
    set +e
    zsh -c "bash \"$SCRIPT_DIR/$dim\"" >/dev/null 2>&1
    rc=$?
    set -e
    if [ $rc -eq 0 ]; then
      echo "  ok   zsh→bash $dim"
    else
      echo "  FAIL zsh→bash $dim (exit $rc)"
      FAIL=$((FAIL+1))
      FAIL_NAMES+=("L6: zsh→bash $dim (exit $rc)")
    fi
  done
fi

# ── 汇总 ──
echo ""
echo "════════════════════════════════════════════════════"
echo "  Scripted Test Matrix 汇总"
echo "════════════════════════════════════════════════════"
echo "  维度总数:   $TOTAL"
echo "  PASS:       $PASS"
echo "  FAIL:       $FAIL"

if [ $FAIL -gt 0 ]; then
  echo ""
  echo "  失败项:"
  for n in "${FAIL_NAMES[@]}"; do
    echo "    - $n"
  done
  echo ""
  exit 1
fi

echo ""
echo "  全部维度 PASS ✓"
echo ""
exit 0
