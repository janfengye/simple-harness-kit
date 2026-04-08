#!/usr/bin/env bash
# E2E 验收完整性校验脚本
#
# 用途: E2E 验收 agent 在跑完 init 后必须运行此脚本，校验生成产物是否完整。
# 设计哲学: 用可执行守门替代 prompt 口头叮嘱（参考 methodology/05-hook-enforcement.md）。
#
# 用法:
#   cd <被测项目根目录>  # 例: planka 干净分支
#   bash <kit-path>/tests/e2e-acceptance-validate.sh
#
# 退出码:
#   0 - 全部 PASS
#   1 - 至少一项 FAIL
#
# E2E agent 必须把整段输出贴到验收报告，FAIL 项必须修复后再交付。

set -uo pipefail

# 真实源: tests/required-wiring.json （相对本脚本）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REQUIRED_WIRING_JSON="$SCRIPT_DIR/required-wiring.json"

if [ ! -f "$REQUIRED_WIRING_JSON" ]; then
  echo "ERROR: $REQUIRED_WIRING_JSON 不存在。这是单一真实源，必须和脚本在同一目录。"
  exit 1
fi

PASS=0
FAIL=0
ERRORS=()

ok() {
  echo "  ✓ $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  ✗ $1"
  FAIL=$((FAIL + 1))
  ERRORS+=("$1")
}

section() {
  echo ""
  echo "── $1 ──"
}

# ── A. 必选文件存在性 ──
# 文件清单从 required-wiring.json 的 required_files 数组派生（不再硬编码副本）。
# 这是 #37 的治理：避免 init-prompt.md 必选清单变化时 validate.sh 不跟。
section "A. 必选文件存在性"

REQUIRED_FILES=$(node -e "
const w = JSON.parse(require('fs').readFileSync('$REQUIRED_WIRING_JSON','utf8'));
if (!Array.isArray(w.required_files)) {
  console.error('required_files missing in $REQUIRED_WIRING_JSON');
  process.exit(1);
}
console.log(w.required_files.join('\n'));
" 2>/dev/null)

if [ -z "$REQUIRED_FILES" ]; then
  fail "无法从 required-wiring.json 加载 required_files 数组"
else
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    if [ -f "$f" ]; then
      ok "exists: $f"
    else
      fail "missing: $f"
    fi
  done <<< "$REQUIRED_FILES"
fi

# ── B. settings.json JSON 格式有效性 ──
section "B. settings.json JSON 有效性"

if [ -f .claude/settings.json ]; then
  if node -e 'JSON.parse(require("fs").readFileSync(".claude/settings.json","utf8"))' 2>/dev/null; then
    ok "settings.json is valid JSON"
  else
    fail "settings.json is not valid JSON"
  fi
fi

# ── C. settings.json 顶层事件完整性 ──
# 事件集从 required-wiring.json 派生（去重的 event 列表）
section "C. settings.json 顶层事件完整性（从 required-wiring.json 派生）"

REQUIRED_EVENTS=$(node -e "
const w = JSON.parse(require('fs').readFileSync('$REQUIRED_WIRING_JSON','utf8')).wirings;
console.log([...new Set(w.map(x => x.event))].join(' '));
" 2>/dev/null)

for ev in $REQUIRED_EVENTS; do
  if [ -f .claude/settings.json ] && grep -q "\"$ev\":" .claude/settings.json; then
    ok "event present: $ev"
  else
    fail "missing event: $ev"
  fi
done

# Stop 属于可选（delivery-gate），存在则补充信息，不存在不算失败
if [ -f .claude/settings.json ] && grep -q '"Stop":' .claude/settings.json; then
  echo "  (optional) Stop event present"
else
  echo "  (optional) Stop event not present — delivery-gate 未启用"
fi

# ── D. 必选 PreToolUse matcher 存在性 ──
# matcher 集从 required-wiring.json 派生（仅 PreToolUse 的非 null matcher）
section "D. 必选 PreToolUse matcher（从 required-wiring.json 派生）"

REQUIRED_MATCHERS=$(node -e "
const w = JSON.parse(require('fs').readFileSync('$REQUIRED_WIRING_JSON','utf8')).wirings;
const set = new Set(w.filter(x => x.event === 'PreToolUse' && x.matcher).map(x => x.matcher));
console.log([...set].join(' '));
" 2>/dev/null)

for m in $REQUIRED_MATCHERS; do
  if [ -f .claude/settings.json ] && grep -q "\"matcher\": \"$m\"" .claude/settings.json; then
    ok "matcher present: $m"
  else
    fail "missing matcher: $m"
  fi
done

# ── D2. matcher command 指向正确脚本（反 noop bypass）──
# wiring 列表从 required-wiring.json 派生，单一真实源，不再硬编码副本
section "D2. matcher command 指向正确脚本"

if [ -f .claude/settings.json ]; then
  # 从真实源读取 wiring，输出 "event:matcher:script" 三元组
  REQUIRED_WIRING_LINES=$(node -e "
const w = JSON.parse(require('fs').readFileSync('$REQUIRED_WIRING_JSON','utf8')).wirings;
for (const x of w) {
  console.log((x.event || '') + ':' + (x.matcher || '*') + ':' + (x.script || ''));
}
" 2>/dev/null)

  while IFS= read -r wiring; do
    [ -z "$wiring" ] && continue
    event=$(echo "$wiring" | cut -d: -f1)
    matcher=$(echo "$wiring" | cut -d: -f2)
    script=$(echo "$wiring" | cut -d: -f3)

    result=$(node -e "
      const s = JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'));
      const hooks = (s.hooks && s.hooks['$event']) || [];
      const found = hooks.some(h => {
        const matchOk = '$matcher' === '*' || h.matcher === '$matcher';
        if (!matchOk) return false;
        return (h.hooks || []).some(inner => (inner.command || '').includes('$script'));
      });
      process.stdout.write(found ? 'OK' : 'MISSING');
    " 2>/dev/null)

    if [ "$result" = "OK" ]; then
      ok "wiring: $event:$matcher → $script"
    else
      fail "wiring missing: $event:$matcher → $script"
    fi
  done <<< "$REQUIRED_WIRING_LINES"
fi

# ── E. Hook 脚本语法 ──
section "E. Hook 脚本语法"

for f in scripts/hooks/*.js; do
  if [ -f "$f" ]; then
    if node -c "$f" 2>/dev/null; then
      ok "syntax OK: $(basename "$f")"
    else
      fail "syntax error: $(basename "$f")"
    fi
  fi
done

# ── E2. 所有 wiring 引用的 hook 脚本必须以文件形式存在 ──
# 反 VH-08-同类回归: settings.json 已注册了 wiring，但 AI 漏复制 hook 脚本，
# 导致 Claude Code 启动时报 MODULE_NOT_FOUND。E. 只对"已存在的脚本"做语法检查，
# 无法 catch 这种"注册了但文件没复制"的缺陷。
section "E2. wiring 引用的 hook 脚本文件必须存在"

if [ -f .claude/settings.json ]; then
  # 从 required-wiring.json 派生需要存在的脚本集合（绝对真实源，不再硬编码）
  REQUIRED_SCRIPTS=$(node -e "
const w = JSON.parse(require('fs').readFileSync('$REQUIRED_WIRING_JSON','utf8')).wirings;
console.log([...new Set(w.map(x => x.script))].join(' '));
" 2>/dev/null)

  for script_name in $REQUIRED_SCRIPTS; do
    # 在被测项目目录搜索脚本（可能在 scripts/hooks/ 或 .claude/hooks/ 等）
    found=""
    for cand in "scripts/hooks/$script_name" ".claude/hooks/$script_name" "hooks/$script_name"; do
      if [ -f "$cand" ]; then
        found="$cand"
        break
      fi
    done
    if [ -n "$found" ]; then
      ok "wired script exists: $script_name → $found"
    else
      fail "wired script missing on disk: $script_name (settings 已注册但文件未复制)"
    fi
  done
fi

# ── E3. Hook 内部 require 依赖（递归扫 require('./xxx') 文件存在性）──
# #40 治理: validate.sh 现在能 catch "wired script 存在但其依赖的本地 module 缺失"
# 例如 harness-stage-guard.js 用 require('./find-root'), 如果 find-root.js 没复制
# 整个 hook 链路会 MODULE_NOT_FOUND. E2 已经覆盖 wired scripts, E3 补这一层。
section "E3. Hook 脚本内部 require('./xxx') 依赖必须存在"

if [ -d scripts/hooks ]; then
  MISSING_DEPS=$(node -e "
const fs = require('fs');
const path = require('path');
const dir = 'scripts/hooks';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
const missing = [];
for (const f of files) {
  const content = fs.readFileSync(path.join(dir, f), 'utf8');
  // 匹配 require('./xxx') 或 require('../xxx')，只检查相对路径
  const re = /require\(\s*['\"](\.[^'\"]+)['\"]\s*\)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const dep = m[1];
    // 解析相对路径，可能省略 .js 扩展
    const candidates = [
      path.resolve(dir, dep),
      path.resolve(dir, dep + '.js'),
      path.resolve(dir, dep, 'index.js'),
    ];
    const exists = candidates.some(c => fs.existsSync(c));
    if (!exists) missing.push(f + ' -> ' + dep);
  }
}
if (missing.length) console.log(missing.join('\n'));
" 2>/dev/null)

  if [ -z "$MISSING_DEPS" ]; then
    ok "所有 hook require('./xxx') 依赖都存在"
  else
    while IFS= read -r line; do
      [ -z "$line" ] && continue
      fail "missing internal dep: $line"
    done <<< "$MISSING_DEPS"
  fi
fi

# ── F. Hook 实弹: stage-guard 拦截 PLAN+Bash ──
section "F. Hook 实弹测试"

if [ -f scripts/hooks/harness-stage-guard.js ]; then
  # 准备测试 stage 文件（PLAN 阶段）
  TMPSTAGE=$(mktemp -d)
  mkdir -p "$TMPSTAGE/.harness"
  RECENT_TS=$(date -u -v-1M +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null || date -u --date='1 minute ago' +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%S.000Z)
  echo "{\"stage\":\"PLAN\",\"since\":\"$RECENT_TS\",\"task\":\"e2e-validate\"}" > "$TMPSTAGE/.harness/current-stage.json"
  echo '{"count":1}' > "$TMPSTAGE/.harness/tool-count.json"

  # PLAN + Bash 应该被阻止 (exit 2)
  output=$(cd "$TMPSTAGE" && echo '{"tool_name":"Bash","tool_input":{"command":"echo test"}}' | node "$OLDPWD/scripts/hooks/harness-stage-guard.js" 2>&1)
  code=$?
  if [ $code -eq 2 ] && echo "$output" | grep -q "PLAN 阶段禁止"; then
    ok "stage-guard blocks PLAN+Bash (exit 2)"
  else
    fail "stage-guard did NOT block PLAN+Bash (exit $code)"
  fi

  # PLAN + Read 应该放行 (exit 0)
  output=$(cd "$TMPSTAGE" && echo '{"tool_name":"Read","tool_input":{"file_path":"foo"}}' | node "$OLDPWD/scripts/hooks/harness-stage-guard.js" 2>&1)
  code=$?
  if [ $code -eq 0 ]; then
    ok "stage-guard allows PLAN+Read (exit 0)"
  else
    fail "stage-guard wrongly blocked PLAN+Read (exit $code)"
  fi

  rm -rf "$TMPSTAGE"
fi

# ── G. session-logger 写入测试 ──
section "G. session-logger 写入测试"

if [ -f scripts/hooks/session-logger.js ]; then
  TMPLOG=$(mktemp -d)
  mkdir -p "$TMPLOG/.harness"
  output=$(cd "$TMPLOG" && echo '{"tool_name":"Bash","tool_input":{"command":"e2e-validate-marker"}}' | node "$OLDPWD/scripts/hooks/session-logger.js" 2>&1)
  if [ -f "$TMPLOG/.harness/session-log.md" ] && grep -q "e2e-validate-marker" "$TMPLOG/.harness/session-log.md"; then
    ok "session-logger writes to .harness/session-log.md"
  else
    fail "session-logger did NOT write session-log.md"
  fi
  rm -rf "$TMPLOG"
fi

# ── G2. session-logger PostToolUseFailure 失败工具调用记录 ──
# #32 治理: 之前 G 段只测了成功工具调用 (PostToolUse), 没测失败的 (PostToolUseFailure).
# 验证 session-logger 在收到 hook_event_name=PostToolUseFailure 时也写入 + 标记失败.
section "G2. session-logger PostToolUseFailure 失败记录"

if [ -f scripts/hooks/session-logger.js ]; then
  TMPLOG=$(mktemp -d)
  mkdir -p "$TMPLOG/.harness"
  cd "$TMPLOG"
  STDIN_JSON='{"hook_event_name":"PostToolUseFailure","tool_name":"Bash","tool_input":{"command":"e2e-fail-marker"},"tool_response":{"error":"e2e-test-error"}}'
  echo "$STDIN_JSON" | node "$OLDPWD/scripts/hooks/session-logger.js" >/dev/null 2>&1
  if [ -f .harness/session-log.md ] && grep -q "e2e-fail-marker" .harness/session-log.md; then
    if grep -qE "失败|fail|error" .harness/session-log.md; then
      ok "session-logger PostToolUseFailure writes + marks failure"
    else
      ok "session-logger PostToolUseFailure writes (failure tag not asserted, but recorded)"
    fi
  else
    fail "session-logger did NOT write PostToolUseFailure marker"
  fi
  cd "$OLDPWD"
  rm -rf "$TMPLOG"
fi

# ── G3. SessionStart hook 输出 banner 实弹 ──
# #32 治理: SessionStart 是新 session 入口, 必须输出 HARNESS MODE ACTIVE banner.
section "G3. SessionStart hook banner 实弹"

if [ -f scripts/hooks/harness-session-start.js ]; then
  TMPSTART=$(mktemp -d)
  mkdir -p "$TMPSTART/.harness"
  cd "$TMPSTART"
  output=$(echo '{"hook_event_name":"SessionStart","session_id":"e2e-validate-test"}' | node "$OLDPWD/scripts/hooks/harness-session-start.js" 2>&1)
  code=$?
  if [ $code -eq 0 ] && echo "$output" | grep -q "HARNESS MODE ACTIVE"; then
    ok "harness-session-start outputs HARNESS MODE ACTIVE banner"
  else
    fail "harness-session-start did NOT output banner (exit $code)"
  fi
  cd "$OLDPWD"
  rm -rf "$TMPSTART"
fi

# ── H. CLAUDE.md 项目定制 (非空且非纯模板) ──
section "H. CLAUDE.md 项目定制度"

if [ -f CLAUDE.md ]; then
  size=$(wc -c < CLAUDE.md | tr -d ' ')
  if [ "$size" -gt 200 ]; then
    ok "CLAUDE.md size > 200 bytes ($size)"
  else
    fail "CLAUDE.md too small ($size bytes), might be unfilled template"
  fi
fi

# ── 汇总 ──
section "汇总"

TOTAL=$((PASS + FAIL))
echo ""
echo "  PASS: $PASS / $TOTAL"
echo "  FAIL: $FAIL / $TOTAL"

if [ $FAIL -gt 0 ]; then
  echo ""
  echo "失败项:"
  for e in "${ERRORS[@]}"; do
    echo "  - $e"
  done
  echo ""
  echo "E2E 验收 NOT READY。修复以上问题后重新运行。"
  exit 1
fi

echo ""
echo "E2E 验收基线检查通过 ✓"
echo "注意：本脚本只覆盖静态 + 基础实弹检查。完整验收还需执行实际开发任务并跑全流程。"
exit 0
