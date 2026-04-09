#!/bin/bash
# 维度 7: install.sh --scope personal vs --scope project
#
# 目标 bug: 两种 scope 分支行为不一致. personal 写到 $HOME/.claude/skills,
# project 写到 $(pwd)/.claude/skills. 两者都必须:
#   - 幂等
#   - 无嵌套
#   - manifest 匹配

set -uo pipefail

EXPECTED_ASSERTIONS=12
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

TMP_KIT="$(mktemp -d "${TMPDIR:-/tmp}/harness-scope-kit-XXXXXX")"
TMP_HOME="$(mktemp -d "${TMPDIR:-/tmp}/harness-scope-home-XXXXXX")"
TMP_CWD_A="$(mktemp -d "${TMPDIR:-/tmp}/harness-scope-cwdA-XXXXXX")"
TMP_CWD_B="$(mktemp -d "${TMPDIR:-/tmp}/harness-scope-cwdB-XXXXXX")"
cleanup() { rm -rf "$TMP_KIT" "$TMP_HOME" "$TMP_CWD_A" "$TMP_CWD_B"; }
trap cleanup EXIT

cp -R "$KIT_SRC/." "$TMP_KIT/"
export HOME="$TMP_HOME"

expected_count=$(find "$KIT_SRC/skills" -maxdepth 2 -name SKILL.md | wc -l | tr -d ' ')

# ── personal scope ──
cd "$TMP_CWD_A"
bash "$TMP_KIT/install.sh" --scope personal >/dev/null 2>&1
assert "personal: \$HOME/.claude/skills/harness-init/SKILL.md 存在" "[ -f \"$TMP_HOME/.claude/skills/harness-init/SKILL.md\" ]"
assert "personal: cwd 下不应写入 .claude/skills" "[ ! -d \"$TMP_CWD_A/.claude/skills\" ]"

# 幂等
bash "$TMP_KIT/install.sh" --scope personal >/dev/null 2>&1
assert "personal: 二次 install 无嵌套" "[ ! -d \"$TMP_HOME/.claude/skills/harness-init/harness-init\" ]"
pc=$(find "$TMP_HOME/.claude/skills" -maxdepth 2 -name SKILL.md | wc -l | tr -d ' ')
assert "personal: SKILL.md 数量匹配 ($pc == $expected_count)" "[ $pc -eq $expected_count ]"
pres_count=$(find "$TMP_HOME/.claude/skills/harness-init/resources" -maxdepth 1 -type f 2>/dev/null | wc -l | tr -d ' ')
assert "personal: resources/ 恰好 4 个" "[ $pres_count -eq 4 ]"
# 无深度 3+ SKILL.md
deep_p=$(find "$TMP_HOME/.claude/skills" -mindepth 3 -name SKILL.md 2>/dev/null | head -1)
assert "personal: 无深度 >=3 的 SKILL.md" "[ -z \"$deep_p\" ]"

# ── project scope ──
# 全新 cwd; HOME 里已有东西但 project scope 应隔离
cd "$TMP_CWD_B"
bash "$TMP_KIT/install.sh" --scope project >/dev/null 2>&1
assert "project: cwd/.claude/skills/harness-init/SKILL.md 存在" "[ -f \"$TMP_CWD_B/.claude/skills/harness-init/SKILL.md\" ]"
# 幂等
bash "$TMP_KIT/install.sh" --scope project >/dev/null 2>&1
assert "project: 二次 install 无嵌套" "[ ! -d \"$TMP_CWD_B/.claude/skills/harness-init/harness-init\" ]"
prc=$(find "$TMP_CWD_B/.claude/skills" -maxdepth 2 -name SKILL.md | wc -l | tr -d ' ')
assert "project: SKILL.md 数量匹配 ($prc == $expected_count)" "[ $prc -eq $expected_count ]"
prres_count=$(find "$TMP_CWD_B/.claude/skills/harness-init/resources" -maxdepth 1 -type f 2>/dev/null | wc -l | tr -d ' ')
assert "project: resources/ 恰好 4 个" "[ $prres_count -eq 4 ]"
deep_pr=$(find "$TMP_CWD_B/.claude/skills" -mindepth 3 -name SKILL.md 2>/dev/null | head -1)
assert "project: 无深度 >=3 的 SKILL.md" "[ -z \"$deep_pr\" ]"

# ── 两种 scope 安装的内容 byte-identical ──
cmp -s "$TMP_HOME/.claude/skills/harness-init/SKILL.md" "$TMP_CWD_B/.claude/skills/harness-init/SKILL.md"
bic=$?
assert "personal/project 两种 scope 的 SKILL.md byte-identical" "[ $bic -eq 0 ]"

[ "$ASSERTIONS_RUN" -eq "$EXPECTED_ASSERTIONS" ] || {
  echo "  ERR: EXPECTED=$EXPECTED_ASSERTIONS 实际 $ASSERTIONS_RUN"
  exit 99
}

if [ "$ASSERTIONS_FAIL" -gt 0 ]; then
  echo "  [07-scope] FAIL: $ASSERTIONS_FAIL / $ASSERTIONS_RUN"
  exit 1
fi
echo "  [07-scope] PASS: $ASSERTIONS_RUN / $ASSERTIONS_RUN"
exit 0
