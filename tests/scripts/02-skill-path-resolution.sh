#!/bin/bash
# 维度 2: SKILL.md 中所有路径引用在真实用户 cwd 下可解析
#
# 目标 bug: VH-10 问题 B — SKILL.md 写 `simple-harness-kit/xxx` 这类 cwd-relative
# 路径. 60+ 用户的 cwd 不是 kit 父目录, 这样写直接失败.
#
# 扫描策略:
# 1. install 到 $TMP_HOME/.claude/skills/harness-init/
# 2. 从 SKILL.md 提取所有 backtick 包住的 .md/.tmpl/.json/.sh 路径引用
# 3. 分类 + 校验:
#    - ./xxx       → skill-relative → 必须在 $SKILL_DIR 下存在
#    - /xxx 或 $x  → 绝对/变量 → 只校验不含 'simple-harness-kit/'
#    - xxx/yyy     → 含有 / 但不以上述开头 → **反模式 FAIL**
#    - 纯文件名    → 叙述性, skip
# 4. 白名单: 同一行含有 "反模式" / "禁止" / "向上查找" / "子目录" 等词的行跳过

set -uo pipefail

EXPECTED_ASSERTIONS=6
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

TMP_KIT="$(mktemp -d "${TMPDIR:-/tmp}/harness-path-kit-XXXXXX")"
TMP_HOME="$(mktemp -d "${TMPDIR:-/tmp}/harness-path-home-XXXXXX")"
TMP_CWD="$(mktemp -d "${TMPDIR:-/tmp}/harness-path-cwd-XXXXXX")"

cleanup() { rm -rf "$TMP_KIT" "$TMP_HOME" "$TMP_CWD"; }
trap cleanup EXIT

cp -R "$KIT_SRC/." "$TMP_KIT/"
export HOME="$TMP_HOME"
cd "$TMP_CWD"

# 真实用户场景: cwd 没有任何 kit 内容, 不能找到 kit-relative 路径
# install 完后 SKILL.md 位于 HOME 下
bash "$TMP_KIT/install.sh" >/dev/null 2>&1

SKILL_DIR="$TMP_HOME/.claude/skills/harness-init"
SKILL_MD="$SKILL_DIR/SKILL.md"

assert "SKILL.md 已安装到 HOME 下" "[ -f \"$SKILL_MD\" ]"

# ── 提取所有 backtick 包住的疑似路径 ──
# 匹配: `path/with/slashes.ext` 或 `./path.ext`
# 文件扩展白名单: .md .tmpl .json .sh .js

# 用 node 解析 (避免 sed/awk 在 Unicode 上的兼容问题)
EXTRACT_OUT=$(SKILL_MD="$SKILL_MD" SKILL_DIR="$SKILL_DIR" TMP_CWD="$TMP_CWD" node -e '
const fs = require("fs");
const path = require("path");
const skillMd = process.env.SKILL_MD;
const skillDir = process.env.SKILL_DIR;
const cwdDir = process.env.TMP_CWD;
const content = fs.readFileSync(skillMd, "utf8");
const lines = content.split("\n");
const re = /`([^`\n]+\.(?:md|tmpl|json|sh|js))`/g;

const WHITELIST_TOKENS = ["反模式", "禁止", "向上查找", "子目录", "常见位置", "绝对路径", "如 /Users"];

const results = { skillRelOk: [], skillRelBad: [], absOk: [], absBad: [], cwdRelBad: [], bareSkip: [], whitelistSkip: [], suspiciousBareBad: [] };

// 目标项目相对路径白名单 (Sub-agent B H4 修复 + Codex gpt-5.4 F1 收窄, 2026-04-09):
// 这些前缀代表 "init 后 AI 在目标项目 cwd 下写入/读取的文件", 不是 kit 内部资源.
// **严格**: 只包含真正属于目标项目本地结构的前缀. 不包含 templates/ / tests/ /
// methodology/ — 这些是 kit-internal, 必须带 $KIT_ROOT 或 kit-rel 上下文才合法.
const TARGET_PROJECT_PREFIXES = [
  ".claude/",       // 目标项目的 .claude/rules/, .claude/settings.json
  "scripts/",       // 目标项目的 scripts/hooks/*.js (init 后复制到项目)
  "docs/",          // 目标项目的 docs/constraints.md
];

// Kit-internal 前缀: 必须在含 $KIT_ROOT 或 kit-internal 叙述词的上下文中出现
// (F1 Codex gpt-5.4 发现: 旧版把 templates/tests/methodology 直接白名单放过,
// 允许 `templates/evil.md` 类注入逃逸)
const KIT_INTERNAL_PREFIXES = [
  "templates/",
  "tests/",
  "methodology/",
];
const KIT_INTERNAL_CONTEXT_TOKENS = ["$KIT_ROOT", "kit 仓库", "kit 的", "kit-ref", "kit 根", "kit root"];

// F2 Codex gpt-5.4 发现: 路径穿越 — .claude/../../../../tmp/pwn.md 起始匹配 .claude/
// 但 .. 段逃逸. 任何含 .. 段的路径都禁止 (skill 内任何合法 path 都不需要 ..).
function hasEscapingDotDot(p) {
  // 规范化后检查: 任何 .. 段都算可疑, 因为 skill 安装后的所有合法引用都不需要向上跳
  const segments = p.split("/");
  return segments.some(s => s === "..");
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const isAntiPatternNarrative = WHITELIST_TOKENS.some(t => line.includes(t));
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(line)) !== null) {
    const p = m[1];
    // 跳过 SKILL.md 字面 (前几行 "本 SKILL.md" 类)
    if (p === "SKILL.md") { results.bareSkip.push({line: i+1, p}); continue; }

    // **关键**: 白名单仅作用于"cwd-rel 反模式检测"。
    // skill-relative (./xxx) 路径无论在什么行都必须存在 — 这是本 skill 的运行前提,
    // 不能因为同一行有"禁止"这种叙述词就跳过。
    // (原 bug: VH-10 post-fix 引入的 ./resources/kit-ref.md 在含"禁止"的叙述行里,
    //  被整行白名单跳过, phantom 文件未被 catch)

    // F2: 任何路径含 .. 段直接判可疑 (路径穿越防御, 任何合法 skill 引用都不需要 ..)
    if (hasEscapingDotDot(p)) {
      if (isAntiPatternNarrative) { results.whitelistSkip.push({line: i+1, p}); continue; }
      results.cwdRelBad.push({line: i+1, p, reason: ".. 段不允许 (路径穿越防御)"});
      continue;
    }

    if (p.startsWith("./")) {
      // skill-relative — 在 SKILL_DIR 下找
      const target = path.join(skillDir, p);
      if (fs.existsSync(target)) results.skillRelOk.push({line: i+1, p, resolved: target});
      else results.skillRelBad.push({line: i+1, p, expected: target});
    } else if (p.startsWith("/")) {
      // 绝对路径 (非变量) — 必须不含 simple-harness-kit/ **且** 文件实际存在
      // Sub-agent B H1 修复: 防止把 ./resources/foo 替换成 /tmp/phantom/foo 的假 PASS.
      // 但只对"含路径分隔的文件引用"要求存在; 像 /Users 这种纯路径示例在叙述行会走白名单.
      if (p.includes("simple-harness-kit/")) { results.absBad.push({line: i+1, p}); continue; }
      if (isAntiPatternNarrative) { results.whitelistSkip.push({line: i+1, p}); continue; }
      if (fs.existsSync(p)) results.absOk.push({line: i+1, p});
      else results.absBad.push({line: i+1, p, reason: "absolute path does not exist"});
    } else if (p.startsWith("$")) {
      // 变量前缀 (如 $KIT_ROOT/..., $HOME/...) — 无法静态解析, 只校验不含反模式
      if (p.includes("simple-harness-kit/")) results.absBad.push({line: i+1, p});
      else results.absOk.push({line: i+1, p});
    } else if (p.startsWith("simple-harness-kit/")) {
      // 精确反模式: 直接写 simple-harness-kit/xxx (VH-10 问题 B)
      // 白名单 (反模式叙述行) 在此生效 — 允许文档里说"禁止 simple-harness-kit/..."
      if (isAntiPatternNarrative) { results.whitelistSkip.push({line: i+1, p}); continue; }
      results.cwdRelBad.push({line: i+1, p});
    } else if (p.startsWith("../")) {
      // 相对父路径反模式 (Codex H2 发现, 2026-04-09):
      // 从 ~/.claude/skills/harness-init/ 出发, ../ 解析到 ~/.claude/skills/,
      // 任何 ../simple-harness-kit/... 或 ../../xxx 这类路径在真实用户环境下
      // 都指向不存在的位置, 等同 cwd-rel 失效. 白名单允许叙述性提及.
      if (isAntiPatternNarrative) { results.whitelistSkip.push({line: i+1, p}); continue; }
      results.cwdRelBad.push({line: i+1, p});
    } else if (p.includes("/")) {
      // Sub-agent B H4 + Codex gpt-5.4 F1 修复:
      // 必须是 (a) 目标项目前缀白名单, 或 (b) kit-internal 前缀但同一行有 $KIT_ROOT 上下文.
      if (isAntiPatternNarrative) { results.whitelistSkip.push({line: i+1, p}); continue; }

      const matchesTargetPrefix = TARGET_PROJECT_PREFIXES.some(pref => p.startsWith(pref));
      if (matchesTargetPrefix) { results.bareSkip.push({line: i+1, p}); continue; }

      const matchesKitInternal = KIT_INTERNAL_PREFIXES.some(pref => p.startsWith(pref));
      if (matchesKitInternal) {
        const hasKitContext = KIT_INTERNAL_CONTEXT_TOKENS.some(t => line.includes(t));
        if (hasKitContext) { results.bareSkip.push({line: i+1, p}); continue; }
        results.suspiciousBareBad.push({line: i+1, p, reason: "kit-internal 前缀但缺 $KIT_ROOT 上下文"});
        continue;
      }

      results.suspiciousBareBad.push({line: i+1, p, reason: "不匹配任何已知目标项目前缀"});
    } else {
      // 纯文件名 (无 /): 只允许在白名单里 (CLAUDE.md / README.md / ...)
      // 其他的是叙述性文件名提及, skip
      results.bareSkip.push({line: i+1, p});
    }
  }
}
console.log(JSON.stringify(results, null, 2));
')

echo "$EXTRACT_OUT" > "$TMP_CWD/.extract.json"

# 解析结果
skill_rel_ok_count=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TMP_CWD/.extract.json','utf8')).skillRelOk.length)")
skill_rel_bad_count=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TMP_CWD/.extract.json','utf8')).skillRelBad.length)")
abs_bad_count=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TMP_CWD/.extract.json','utf8')).absBad.length)")
cwd_rel_bad_count=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TMP_CWD/.extract.json','utf8')).cwdRelBad.length)")
suspicious_bare_count=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TMP_CWD/.extract.json','utf8')).suspiciousBareBad.length)")

# 打印 bad 明细供调试
if [ "$skill_rel_bad_count" -gt 0 ] || [ "$abs_bad_count" -gt 0 ] || [ "$cwd_rel_bad_count" -gt 0 ] || [ "$suspicious_bare_count" -gt 0 ]; then
  echo "  [DEBUG] extract details:"
  node -e "
    const j = JSON.parse(require('fs').readFileSync('$TMP_CWD/.extract.json','utf8'));
    for (const [k,v] of Object.entries(j)) {
      if (k.endsWith('Bad') && v.length) {
        console.log('    '+k+':');
        for (const it of v) console.log('      L'+it.line+': '+it.p);
      }
    }
  "
fi

assert "至少 1 个 skill-relative 路径 (./resources/...)" "[ \"$skill_rel_ok_count\" -ge 1 ]"
assert "skill-relative 路径全部在 SKILL_DIR 下可解析 (bad=$skill_rel_bad_count)" "[ \"$skill_rel_bad_count\" -eq 0 ]"
assert "绝对路径不含 simple-harness-kit/ 且存在 (bad=$abs_bad_count)" "[ \"$abs_bad_count\" -eq 0 ]"
assert "无 cwd-relative 反模式路径 (bad=$cwd_rel_bad_count)" "[ \"$cwd_rel_bad_count\" -eq 0 ]"
assert "无可疑 bare 路径 (非已知目标项目前缀, bad=$suspicious_bare_count)" "[ \"$suspicious_bare_count\" -eq 0 ]"

[ "$ASSERTIONS_RUN" -eq "$EXPECTED_ASSERTIONS" ] || {
  echo "  ERR: EXPECTED_ASSERTIONS=$EXPECTED_ASSERTIONS 但实际跑了 $ASSERTIONS_RUN"
  exit 99
}

if [ "$ASSERTIONS_FAIL" -gt 0 ]; then
  echo "  [02-path] FAIL: $ASSERTIONS_FAIL / $ASSERTIONS_RUN"
  exit 1
fi

echo "  [02-path] PASS: $ASSERTIONS_RUN / $ASSERTIONS_RUN"
exit 0
