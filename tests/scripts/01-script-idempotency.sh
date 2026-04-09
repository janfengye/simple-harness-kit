#!/bin/bash
# 维度 1: install.sh / update.sh 幂等性
#
# 目标 bug: VH-10 问题 A — `cp -r src dst/name` 在 dst/name 已存在时产生嵌套
# `.claude/skills/harness-init/harness-init/`. 反复跑 install/update 必须都收敛到同一
# 结构, 不得出现嵌套目录、重复 SKILL.md、孤儿文件.
#
# 真实用户场景铁律:
# - 3 个无父子关系的随机 tmp dir: TMP_KIT (kit 克隆) / TMP_HOME / TMP_CWD
# - kit 用 `cp -r` 真实拷贝 (不 symlink), 模拟 clone
# - HOME 和 cwd 都切到 tmp, 打破 "cwd=kit 父目录" 的隐含假设

set -uo pipefail

EXPECTED_ASSERTIONS=18
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

# ── 测试环境 ──

# KIT_SRC 从脚本位置推导 (tests/scripts/01-*.sh → kit root = 两层上)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
KIT_SRC="$(cd "$SCRIPT_DIR/../.." && pwd)"

# 允许外部覆盖 (用于维度 5 mutation 测试和维度 6 路径风格矩阵)
KIT_SRC="${HARNESS_TEST_KIT_SRC:-$KIT_SRC}"

TMP_KIT="$(mktemp -d "${TMPDIR:-/tmp}/harness-idem-kit-XXXXXX")"
TMP_HOME="$(mktemp -d "${TMPDIR:-/tmp}/harness-idem-home-XXXXXX")"
TMP_CWD="$(mktemp -d "${TMPDIR:-/tmp}/harness-idem-cwd-XXXXXX")"

cleanup() {
  rm -rf "$TMP_KIT" "$TMP_HOME" "$TMP_CWD"
}
trap cleanup EXIT

echo "  [01-idempotency] KIT_SRC=$KIT_SRC"
echo "  [01-idempotency] TMP_KIT=$TMP_KIT"
echo "  [01-idempotency] TMP_HOME=$TMP_HOME"
echo "  [01-idempotency] TMP_CWD=$TMP_CWD"

# 真实 clone 式拷贝: 不 symlink
cp -R "$KIT_SRC/." "$TMP_KIT/"

# 切 HOME + cwd
export HOME="$TMP_HOME"
cd "$TMP_CWD"

# ── 循环序列: install → install → update → update → install ──

run_install() {
  bash "$TMP_KIT/install.sh" >/dev/null 2>&1
}
run_update() {
  bash "$TMP_KIT/update.sh" >/dev/null 2>&1
}

# Step 1: 首次 install
run_install
assert "step1: install 成功" "[ -f \"$TMP_HOME/.claude/skills/harness-init/SKILL.md\" ]"
assert "step1: 不存在嵌套 harness-init/harness-init" "[ ! -d \"$TMP_HOME/.claude/skills/harness-init/harness-init\" ]"

# Step 2: 再次 install (核心幂等检查)
run_install
assert "step2: install 再次成功" "[ -f \"$TMP_HOME/.claude/skills/harness-init/SKILL.md\" ]"
assert "step2: 无嵌套" "[ ! -d \"$TMP_HOME/.claude/skills/harness-init/harness-init\" ]"
# 二次 install 不应产生多余的 resources/resources 嵌套
assert "step2: resources 无嵌套" "[ ! -d \"$TMP_HOME/.claude/skills/harness-init/resources/resources\" ]"
# resources/ 里应该恰好 4 个文件 (方案 C)
count=$(find "$TMP_HOME/.claude/skills/harness-init/resources" -maxdepth 1 -type f 2>/dev/null | wc -l | tr -d ' ')
assert "step2: resources/ 恰好 4 个文件 (实际 $count)" "[ \"$count\" -eq 4 ]"

# Step 3: update
run_update
assert "step3: update 后 SKILL.md 还在" "[ -f \"$TMP_HOME/.claude/skills/harness-init/SKILL.md\" ]"
assert "step3: update 后无嵌套" "[ ! -d \"$TMP_HOME/.claude/skills/harness-init/harness-init\" ]"

# Step 4: update again
run_update
assert "step4: 二次 update 后 SKILL.md 还在" "[ -f \"$TMP_HOME/.claude/skills/harness-init/SKILL.md\" ]"
assert "step4: 二次 update 后无嵌套" "[ ! -d \"$TMP_HOME/.claude/skills/harness-init/harness-init\" ]"

# Step 5: install 再来一次 (交替)
run_install
assert "step5: 三次 install 后 SKILL.md 还在" "[ -f \"$TMP_HOME/.claude/skills/harness-init/SKILL.md\" ]"
assert "step5: 三次 install 后无嵌套" "[ ! -d \"$TMP_HOME/.claude/skills/harness-init/harness-init\" ]"

# ── 全 skill 维度幂等检查 ──
# 每个 skill 目录下必须只有一个 SKILL.md, 不能因为反复 cp 多出嵌套副本
dup_nest=$(find "$TMP_HOME/.claude/skills" -type d -name "*" | awk -F/ '{for(i=2;i<=NF;i++) if($i==$(i-1)) print}' | head -1)
assert "不存在 foo/foo 型嵌套目录" "[ -z \"$dup_nest\" ]"

# 每个 skill 必须且只能有一个 SKILL.md
skill_count=$(find "$TMP_HOME/.claude/skills" -maxdepth 2 -name "SKILL.md" | wc -l | tr -d ' ')
src_skill_count=$(find "$KIT_SRC/skills" -maxdepth 2 -name "SKILL.md" | wc -l | tr -d ' ')
assert "安装 SKILL.md 数量 ($skill_count) == 源 ($src_skill_count)" "[ \"$skill_count\" -eq \"$src_skill_count\" ]"

# 不得有 SKILL.md 在深度 3+ (即嵌套)
deep_skill=$(find "$TMP_HOME/.claude/skills" -mindepth 3 -name "SKILL.md" | head -1)
assert "无深度 >=3 的 SKILL.md" "[ -z \"$deep_skill\" ]"

# ── 内容一致性: 安装后关键文件与源逐字节一致 ──
if cmp -s "$KIT_SRC/skills/harness-init/SKILL.md" "$TMP_HOME/.claude/skills/harness-init/SKILL.md"; then skill_ok=1; else skill_ok=0; fi
assert "harness-init SKILL.md byte-identical with source" "[ $skill_ok -eq 1 ]"

if cmp -s "$KIT_SRC/skills/harness-init/resources/init-prompt.md" "$TMP_HOME/.claude/skills/harness-init/resources/init-prompt.md"; then ip_ok=1; else ip_ok=0; fi
assert "resources/init-prompt.md byte-identical" "[ $ip_ok -eq 1 ]"

if cmp -s "$KIT_SRC/skills/harness-init/resources/settings-json.tmpl" "$TMP_HOME/.claude/skills/harness-init/resources/settings-json.tmpl"; then sj_ok=1; else sj_ok=0; fi
assert "resources/settings-json.tmpl byte-identical" "[ $sj_ok -eq 1 ]"

# ── 收尾 ──

[ "$ASSERTIONS_RUN" -eq "$EXPECTED_ASSERTIONS" ] || {
  echo "  ERR: EXPECTED_ASSERTIONS=$EXPECTED_ASSERTIONS 但实际跑了 $ASSERTIONS_RUN"
  exit 99
}

if [ "$ASSERTIONS_FAIL" -gt 0 ]; then
  echo "  [01-idempotency] FAIL: $ASSERTIONS_FAIL / $ASSERTIONS_RUN"
  exit 1
fi

echo "  [01-idempotency] PASS: $ASSERTIONS_RUN / $ASSERTIONS_RUN"
exit 0
