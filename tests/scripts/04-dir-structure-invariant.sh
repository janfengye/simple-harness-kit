#!/bin/bash
# 维度 4: install 后目录结构不变式
#
# 目标 bug: 隐形副作用 — 多余文件 / 嵌套 / 缺失 / 错误符号链接.
# 方法: install 后 dump find listing, 对比预期 manifest.
#
# 预期 manifest 从 kit 源动态派生 (而非硬编码) — kit 新增 skill 自动适配:
#   $HOME/.claude/skills/<skill_name>/SKILL.md
#   $HOME/.claude/skills/harness-init/resources/{init-prompt.md,settings-json.tmpl,required-wiring.json,hook-coverage-matrix.md}
#
# 反不变式:
# - 没有 skill/skill 嵌套目录
# - 没有 SKILL.md 深度 > 2 (<skill>/SKILL.md)
# - 没有 resources/ 深度 > 3 (harness-init/resources/file)
# - 没有意料之外的非 skill 顶层目录
# - 没有 "symlink 到外面" 的软链

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

TMP_KIT="$(mktemp -d "${TMPDIR:-/tmp}/harness-inv-kit-XXXXXX")"
TMP_HOME="$(mktemp -d "${TMPDIR:-/tmp}/harness-inv-home-XXXXXX")"
TMP_CWD="$(mktemp -d "${TMPDIR:-/tmp}/harness-inv-cwd-XXXXXX")"
cleanup() { rm -rf "$TMP_KIT" "$TMP_HOME" "$TMP_CWD"; }
trap cleanup EXIT

cp -R "$KIT_SRC/." "$TMP_KIT/"
export HOME="$TMP_HOME"
cd "$TMP_CWD"

bash "$TMP_KIT/install.sh" >/dev/null 2>&1

SKILLS_DIR="$TMP_HOME/.claude/skills"

# ── 动态派生预期 manifest ──
# 每个 skill 必须有 SKILL.md; harness-init 额外要求 resources/ 4 个文件
EXPECTED_FILE="$TMP_CWD/.expected.txt"
ACTUAL_FILE="$TMP_CWD/.actual.txt"

(
  cd "$SKILLS_DIR" && find . -type f | sort
) > "$ACTUAL_FILE"

# 期望清单生成
{
  for skill_dir in "$KIT_SRC/skills"/*/; do
    name=$(basename "$skill_dir")
    # 列出源 skill 目录下所有文件, 转成相对 skill 根的路径
    (
      cd "$skill_dir" && find . -type f
    ) | while read -r f; do
      # f 形如 ./SKILL.md 或 ./resources/foo.md
      rel=${f#./}
      echo "./$name/$rel"
    done
  done
} | sort > "$EXPECTED_FILE"

# 对比
assert "actual 清单非空" "[ -s \"$ACTUAL_FILE\" ]"
assert "expected 清单非空" "[ -s \"$EXPECTED_FILE\" ]"

if ! diff -q "$EXPECTED_FILE" "$ACTUAL_FILE" >/dev/null 2>&1; then
  echo "  [DEBUG] manifest diff (- expected  + actual):"
  diff "$EXPECTED_FILE" "$ACTUAL_FILE" | sed 's/^/    /' | head -50
fi
manifest_match=0
if diff -q "$EXPECTED_FILE" "$ACTUAL_FILE" >/dev/null 2>&1; then
  manifest_match=1
fi
assert "安装 manifest 与源 skill 目录精确一致" "[ $manifest_match -eq 1 ]"

# ── 反不变式 ──

# 无 foo/foo 嵌套
nested=$(find "$SKILLS_DIR" -type d | awk -F/ '{for(i=2;i<=NF;i++) if($i==$(i-1)) {print; exit}}')
assert "无 foo/foo 嵌套目录" "[ -z \"$nested\" ]"

# SKILL.md 只能在深度 2 (skills/<name>/SKILL.md)
bad_depth=$(find "$SKILLS_DIR" -name "SKILL.md" -mindepth 3 2>/dev/null | head -1)
assert "SKILL.md 深度恰好 2" "[ -z \"$bad_depth\" ]"

# resources/ 深度恰好 3 — resources 下不能再有子目录
bad_res=$(find "$SKILLS_DIR/harness-init/resources" -mindepth 2 -type f 2>/dev/null | head -1)
assert "resources/ 下无子目录嵌套" "[ -z \"$bad_res\" ]"

# 无 broken symlink
broken=$(find "$SKILLS_DIR" -type l ! -exec test -e {} \; -print 2>/dev/null | head -1)
assert "无 broken symlink" "[ -z \"$broken\" ]"

# resources 文件数恰好 4
res_count=$(find "$SKILLS_DIR/harness-init/resources" -maxdepth 1 -type f 2>/dev/null | wc -l | tr -d ' ')
assert "harness-init/resources 恰好 4 个文件 (实际 $res_count)" "[ $res_count -eq 4 ]"

[ "$ASSERTIONS_RUN" -eq "$EXPECTED_ASSERTIONS" ] || {
  echo "  ERR: EXPECTED=$EXPECTED_ASSERTIONS 实际 $ASSERTIONS_RUN"
  exit 99
}

if [ "$ASSERTIONS_FAIL" -gt 0 ]; then
  echo "  [04-invariant] FAIL: $ASSERTIONS_FAIL / $ASSERTIONS_RUN"
  exit 1
fi
echo "  [04-invariant] PASS: $ASSERTIONS_RUN / $ASSERTIONS_RUN"
exit 0
