#!/bin/bash
# 维度 5: Bug 注入反测 (mutation testing)
#
# 目标: 证明维度 1-4 真的能 catch 对应 bug (元层守门, 防止"假 PASS").
#
# 方法:
# - 在 $TMP_MUTANT_KIT 里拷一份 kit 副本 (**绝对不改原始 kit**)
# - 在副本上注入已知 bug
# - 用 HARNESS_TEST_KIT_SRC=$TMP_MUTANT_KIT 运行对应维度脚本
# - 期望 FAIL (exit != 0); 若 PASS 说明该维度失效
# - 然后移除注入, 再跑一次, 期望 PASS (证明 FAIL 是因为注入, 不是环境)
#
# 注入矩阵:
#   M1: install.sh 的 `rm -rf "$DEST/$skill_name"` 那行改注释 → 01, 04 FAIL
#   M2: SKILL.md 插入 `simple-harness-kit/foo.md` 引用 → 02 FAIL
#   M3: 删一个 resources/init-prompt.md → 03 FAIL (会让 validate.sh 某处 FAIL)

set -uo pipefail

EXPECTED_ASSERTIONS=21
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

TMP_MUTANT_KIT="$(mktemp -d "${TMPDIR:-/tmp}/harness-mut-kit-XXXXXX")"
cleanup() { rm -rf "$TMP_MUTANT_KIT"; }
trap cleanup EXIT

# 用于跑子维度的 helper
# 参数: $1=维度脚本名 (e.g. 01-script-idempotency.sh)
# 环境: HARNESS_TEST_KIT_SRC=$TMP_MUTANT_KIT 传入, 让子脚本用 mutant kit
# 注意: 不能调用同目录的 .sh, 因为子脚本通过 SCRIPT_DIR/../.. 推导 KIT_SRC,
# 所以必须用 env 覆盖
run_dim() {
  local dim_name="$1"
  HARNESS_TEST_KIT_SRC="$TMP_MUTANT_KIT" bash "$SCRIPT_DIR/$dim_name" >/dev/null 2>&1
  return $?
}

# ── 函数: 准备一个干净的 mutant kit 拷贝 ──
prep_mutant() {
  rm -rf "$TMP_MUTANT_KIT"
  mkdir -p "$TMP_MUTANT_KIT"
  cp -R "$KIT_SRC/." "$TMP_MUTANT_KIT/"
}

# ═══ M1: install.sh 幂等性破坏 ═══
echo "  [mutation M1] 注入: install.sh 的 rm -rf 改注释"
prep_mutant
# macOS/BSD sed 和 GNU sed 的 -i 语法不同. 用 sed -e 读+写 tmpfile 方式
sed -e 's|^    rm -rf "\$DEST/\$skill_name"|    # rm -rf "\$DEST/\$skill_name"|' \
  "$TMP_MUTANT_KIT/install.sh" > "$TMP_MUTANT_KIT/install.sh.new"
mv "$TMP_MUTANT_KIT/install.sh.new" "$TMP_MUTANT_KIT/install.sh"

# 验证注入生效 (行被注释掉)
if grep -q '^    # rm -rf "\$DEST/\$skill_name"' "$TMP_MUTANT_KIT/install.sh"; then
  echo "    注入已生效"
else
  echo "    ERR: 注入未生效 — install.sh 结构变了? 请检查 sed 模式"
  exit 99
fi

# 维度 1 应 FAIL (二次 install 会 nest)
# 注意: 第一次 install 不会嵌套, 第二次才会. 维度 1 的 step2 assertion 会 catch
set +e
run_dim "01-script-idempotency.sh"
rc1=$?
set -e
assert "M1 注入后 维度 01 FAIL" "[ $rc1 -ne 0 ]"

# 维度 4 也应 FAIL (manifest 检查会发现嵌套目录)
# 注意: 维度 4 只跑一次 install, 未必触发嵌套. 所以我们在注入版下先连跑两次 install, 再跑维度 4
# 更简单: 让维度 4 的 setup 预先 install 一次, 然后它自己再跑一次
# 当前 04 只 install 1 次. 为了让 mutation catch 得到, 我们 patch: 在 mutant 上先手动跑一次 install
# 让 $HOME/.claude/skills 存在. 但 04 用独立 TMP_HOME, 这个不生效.
# 更好方案: 维度 1 已经覆盖 install 幂等, 这里只验证维度 1 catch 住即可.
# (维度 4 对 M1 的覆盖是 "第 N 次 install 后 manifest" — 我们的 04 当前只跑 1 次, 故不列入 M1 期望)
#
# 移除注入后, 维度 1 应回 PASS
prep_mutant
set +e
run_dim "01-script-idempotency.sh"
rc1r=$?
set -e
assert "M1 移除后 维度 01 PASS" "[ $rc1r -eq 0 ]"

# ═══ M2: SKILL.md cwd-relative 反模式 ═══
echo "  [mutation M2] 注入: SKILL.md 加 simple-harness-kit/foo.md 引用"
prep_mutant
# 在 SKILL.md 末尾加一行含反模式路径 (不含任何维度 2 的白名单 token)
# 白名单 token 见 02-skill-path-resolution.sh: 反模式/禁止/向上查找/子目录/常见位置/绝对路径/如 /Users
printf '\n调试注入: 读取 `simple-harness-kit/foo.md` 测试守门\n' \
  >> "$TMP_MUTANT_KIT/skills/harness-init/SKILL.md"

set +e
run_dim "02-skill-path-resolution.sh"
rc2=$?
set -e
assert "M2 注入后 维度 02 FAIL" "[ $rc2 -ne 0 ]"

prep_mutant
set +e
run_dim "02-skill-path-resolution.sh"
rc2r=$?
set -e
assert "M2 移除后 维度 02 PASS" "[ $rc2r -eq 0 ]"

# ═══ M3: 删 resources/init-prompt.md ═══
echo "  [mutation M3] 注入: 删 resources/init-prompt.md"
prep_mutant
rm -f "$TMP_MUTANT_KIT/skills/harness-init/resources/init-prompt.md"

# 维度 01 会 FAIL (cmp byte-identical for resources/init-prompt.md — 文件不存在)
# 也就是我们想验证 01 能 catch 这类 "resources 缺失"
set +e
run_dim "01-script-idempotency.sh"
rc3a=$?
set -e
assert "M3 注入后 维度 01 FAIL (resources 缺失检测)" "[ $rc3a -ne 0 ]"

# 维度 04 应 FAIL (manifest 不匹配)
set +e
run_dim "04-dir-structure-invariant.sh"
rc3b=$?
set -e
assert "M3 注入后 维度 04 FAIL (manifest 不匹配)" "[ $rc3b -ne 0 ]"

prep_mutant
set +e
run_dim "04-dir-structure-invariant.sh"
rc3r=$?
set -e
assert "M3 移除后 维度 04 PASS" "[ $rc3r -eq 0 ]"

# ═══ M4: phantom skill-relative ref 塞进反模式叙述行 (regression 守门) ═══
# 背景: VH-10 post-fix 过程中, SKILL.md 含 "禁止" 的叙述行里埋了一个
#       ./resources/kit-ref.md 引用, 指向不存在的文件. 旧版 dim 02 按"整行白名单"
#       跳过, 没 catch. 收紧后白名单只对 cwd-rel 反模式 token 作用,
#       skill-rel 路径无论什么上下文都必须存在. 此 mutation 固化这条守门.
echo "  [mutation M4] 注入: phantom ./resources/ghost.md 到含'禁止'的叙述行"
prep_mutant
# 找含"禁止"的那一行并在其中塞入 phantom ref
python3 -c "
import sys
p='$TMP_MUTANT_KIT/skills/harness-init/SKILL.md'
s=open(p).read()
new = s.replace('cwd-relative 路径（如直接写', '引用 \`./resources/ghost-DOES-NOT-EXIST.md\` 的 cwd-relative 路径（如直接写', 1)
if new == s:
    sys.stderr.write('ERR: M4 注入锚点未找到')
    sys.exit(99)
open(p,'w').write(new)
"

set +e
run_dim "02-skill-path-resolution.sh"
rc4=$?
set -e
assert "M4 注入后 维度 02 FAIL (phantom skill-rel ref 在叙述行)" "[ $rc4 -ne 0 ]"

prep_mutant
set +e
run_dim "02-skill-path-resolution.sh"
rc4r=$?
set -e
assert "M4 移除后 维度 02 PASS" "[ $rc4r -eq 0 ]"

# ═══ M5: 父路径 ../simple-harness-kit/ 逃逸 (Codex H2 发现) ═══
# 背景: 2026-04-09 Codex gpt-oss-120b 交叉验收提出假设 H2:
#       "若在 SKILL.md 中新增相对路径 ../simple-harness-kit/..., 可能绕过
#        dim02 白名单, 在特定 cwd 下失效". 经验证属实 — 旧 dim02 只检查
#       startsWith("simple-harness-kit/"), 忽略 ../ 前缀. 收紧后把 ../ 也当
#       cwd-rel 反模式. 此 mutation 固化此守门.
echo "  [mutation M5] 注入: ../simple-harness-kit/ghost.md 到 SKILL.md"
prep_mutant
printf '\n描述性注入: 读取 `../simple-harness-kit/ghost.md` 扩展配置\n' \
  >> "$TMP_MUTANT_KIT/skills/harness-init/SKILL.md"

set +e
run_dim "02-skill-path-resolution.sh"
rc5=$?
set -e
assert "M5 注入后 维度 02 FAIL (../ 父路径反模式)" "[ $rc5 -ne 0 ]"

prep_mutant
set +e
run_dim "02-skill-path-resolution.sh"
rc5r=$?
set -e
assert "M5 移除后 维度 02 PASS" "[ $rc5r -eq 0 ]"

# ═══ M6: 绝对路径指向不存在文件 (Sub-agent B H1 发现) ═══
# 背景: 2026-04-09 Sub-agent B 在 v0.7.2 交叉验收中发现: 旧 dim02 的绝对路径分支
#       只校验 "不含 simple-harness-kit/", 不校验文件实际存在. 攻击者可以把
#       ./resources/foo 改成 /tmp/phantom/foo.md, 测试仍 PASS 但运行时失效.
#       收紧后绝对路径 (非变量) 必须 fs.existsSync. M6 固化此守门.
echo "  [mutation M6] 注入: 把 ./resources/settings-json.tmpl 改成 /tmp/nope-XYZ/x.tmpl"
prep_mutant
python3 -c "
import sys
p='$TMP_MUTANT_KIT/skills/harness-init/SKILL.md'
s=open(p).read()
new=s.replace('\`./resources/settings-json.tmpl\`', '\`/tmp/nope-XYZ-DOES-NOT-EXIST/settings-json.tmpl\`', 1)
if new == s:
    sys.stderr.write('ERR: M6 注入锚点未找到')
    sys.exit(99)
open(p,'w').write(new)
"

set +e
run_dim "02-skill-path-resolution.sh"
rc6=$?
set -e
assert "M6 注入后 维度 02 FAIL (绝对路径不存在)" "[ $rc6 -ne 0 ]"

prep_mutant
set +e
run_dim "02-skill-path-resolution.sh"
rc6r=$?
set -e
assert "M6 移除后 维度 02 PASS" "[ $rc6r -eq 0 ]"

# ═══ M7: bare "foo/bar.md" 路径 (Sub-agent B H4 发现) ═══
# 背景: 2026-04-09 Sub-agent B 发现旧 dim02 的 bareSkip 兜底分支把"含 / 但不以
#       ./ 或 simple-harness-kit/ 开头"的路径全部 skip. 所以 foo/bar.md,
#       usr/local/y.json 这类 cwd-rel 路径可以静默潜入. 收紧后只允许在目标项目
#       白名单前缀 (.claude/, scripts/, docs/, templates/, tests/, methodology/)
#       内的 bare 路径. M7 固化此守门.
echo "  [mutation M7] 注入: 加 bare foo/bar.md 到 SKILL.md"
prep_mutant
printf '\n描述性注入: 读取 `foo/bar.md` 扩展\n' \
  >> "$TMP_MUTANT_KIT/skills/harness-init/SKILL.md"

set +e
run_dim "02-skill-path-resolution.sh"
rc7=$?
set -e
assert "M7 注入后 维度 02 FAIL (bare 非白名单前缀)" "[ $rc7 -ne 0 ]"

prep_mutant
set +e
run_dim "02-skill-path-resolution.sh"
rc7r=$?
set -e
assert "M7 移除后 维度 02 PASS" "[ $rc7r -eq 0 ]"

# ═══ M8: kit-internal 前缀无 $KIT_ROOT 上下文 (Codex gpt-5.4 F1 发现) ═══
# 背景: 2026-04-09 Codex gpt-5.4 round 3 发现 dim02 白名单把 templates/ / tests/
#       / methodology/ 当 target-project 前缀直接放过. 但这些是 kit-internal,
#       合法引用必须带 $KIT_ROOT 或叙述上下文. 注入 `templates/evil.md` 无上下文
#       就应 FAIL. 收紧后 KIT_INTERNAL_PREFIXES 分支要求 hasKitContext. M8 固化.
echo '  [mutation M8] 注入: 加 bare templates/evil.md 无 $KIT_ROOT 上下文'
prep_mutant
printf '\n裸注入: 看 `templates/evil.md` 扩展\n' \
  >> "$TMP_MUTANT_KIT/skills/harness-init/SKILL.md"

set +e
run_dim "02-skill-path-resolution.sh"
rc8=$?
set -e
assert "M8 注入后 维度 02 FAIL (kit-internal 无 KIT_ROOT 上下文)" "[ $rc8 -ne 0 ]"

prep_mutant
set +e
run_dim "02-skill-path-resolution.sh"
rc8r=$?
set -e
assert "M8 移除后 维度 02 PASS" "[ $rc8r -eq 0 ]"

# ═══ M9: 路径穿越 .claude/../../../ (Codex gpt-5.4 F2 发现) ═══
# 背景: 2026-04-09 Codex gpt-5.4 round 3 发现 .claude/../../../../tmp/pwn.md
#       startsWith(".claude/") 命中白名单, 但 .. 段跳出目标项目. 收紧后任何
#       路径含 .. 段立即判反模式 (hasEscapingDotDot). M9 固化.
echo "  [mutation M9] 注入: .claude/../../../tmp/pwn.md 路径穿越"
prep_mutant
printf '\n裸注入: 看 `.claude/../../../tmp/pwn.md` 配置\n' \
  >> "$TMP_MUTANT_KIT/skills/harness-init/SKILL.md"

set +e
run_dim "02-skill-path-resolution.sh"
rc9=$?
set -e
assert "M9 注入后 维度 02 FAIL (路径穿越 .. 段)" "[ $rc9 -ne 0 ]"

prep_mutant
set +e
run_dim "02-skill-path-resolution.sh"
rc9r=$?
set -e
assert "M9 移除后 维度 02 PASS" "[ $rc9r -eq 0 ]"

# ═══ Baseline: 未注入时所有维度均应 PASS (sanity) ═══
# (用干净 mutant = KIT_SRC 的副本)
prep_mutant
set +e
run_dim "03-full-e2e.sh"
rcbe=$?
set -e
assert "baseline: 维度 03 在干净 mutant 上 PASS" "[ $rcbe -eq 0 ]"

prep_mutant
# 在 baseline 上还要证明 02 不会误报 — 用干净 mutant
set +e
run_dim "02-skill-path-resolution.sh"
rc02b=$?
set -e
assert "baseline: 维度 02 在干净 mutant 上 PASS" "[ $rc02b -eq 0 ]"

[ "$ASSERTIONS_RUN" -eq "$EXPECTED_ASSERTIONS" ] || {
  echo "  ERR: EXPECTED=$EXPECTED_ASSERTIONS 实际 $ASSERTIONS_RUN"
  exit 99
}

if [ "$ASSERTIONS_FAIL" -gt 0 ]; then
  echo "  [05-mutation] FAIL: $ASSERTIONS_FAIL / $ASSERTIONS_RUN"
  exit 1
fi
echo "  [05-mutation] PASS: $ASSERTIONS_RUN / $ASSERTIONS_RUN"
exit 0
