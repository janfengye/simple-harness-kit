#!/usr/bin/env bash
#
# baseline-scan.sh — 长期未改文件主动 review 工具
#
# 解决 #39 "长期未改文件长期未 review" 失效模式 (Codex round 1 #34 反馈):
# - SKILL.md / 文档 / hook 脚本 长期不变
# - 长期不进入任何 commit diff
# - 长期不被 Codex 交叉验收
# - 隐形漂移潜伏
#
# 用法:
#   bash scripts/baseline-scan.sh                # 默认 30 天
#   bash scripts/baseline-scan.sh --threshold 60 # 60 天
#   bash scripts/baseline-scan.sh --paths "skills/ methodology/ scripts/hooks/"
#
# 输出: stdout 列出"距离最后一次 commit > 阈值天" 的文件 + 建议 review 类型
# 退出码:
#   0 - 总有 cold files (需要 review) 或一切都新
#   1 - 不在 git 仓库 / 参数错误
#
# 设计原则:
# - 只读, 不修改任何文件
# - 不发起 review (review 由 user 手动触发)
# - 输出可被 grep / wc 进一步处理 (e.g. 接 Codex 派发)

set -uo pipefail

# ── 参数解析 ──

THRESHOLD_DAYS=30
PATHS=""

while [ $# -gt 0 ]; do
  case "$1" in
    --threshold)
      THRESHOLD_DAYS="$2"
      shift 2
      ;;
    --paths)
      PATHS="$2"
      shift 2
      ;;
    -h|--help)
      head -n 30 "$0" | grep '^#' | sed 's/^# //'
      exit 0
      ;;
    *)
      echo "ERROR: 未知参数 $1" >&2
      exit 1
      ;;
  esac
done

# ── 检查 git ──

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: 不在 git 仓库内" >&2
  exit 1
fi

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

# ── 默认扫描路径 (如未指定) ──

if [ -z "$PATHS" ]; then
  PATHS="skills methodology scripts/hooks docs init-prompt.md"
fi

# ── 计算阈值时间戳 ──

# 跨平台 (mac BSD date 与 linux GNU date 不同)
if date -u -v-${THRESHOLD_DAYS}d +%s >/dev/null 2>&1; then
  # macOS BSD date
  CUTOFF_EPOCH=$(date -u -v-${THRESHOLD_DAYS}d +%s)
else
  # Linux GNU date
  CUTOFF_EPOCH=$(date -u -d "${THRESHOLD_DAYS} days ago" +%s)
fi

# ── 扫描 ──

echo "── Baseline Scan ──"
echo "阈值: 距离最后 commit > ${THRESHOLD_DAYS} 天"
echo "扫描路径: ${PATHS}"
echo "切分点: $(date -u -r ${CUTOFF_EPOCH} +%Y-%m-%d 2>/dev/null || date -u --date="@${CUTOFF_EPOCH}" +%Y-%m-%d) (UTC)"
echo ""

COLD_COUNT=0
TOTAL_COUNT=0

# 获取所有路径下的 tracked 文件 (排除 node_modules / .git / .nyc_output / coverage)
for p in $PATHS; do
  if [ ! -e "$p" ]; then
    continue
  fi

  while IFS= read -r file; do
    [ -z "$file" ] && continue
    # 排除噪音
    case "$file" in
      *node_modules*|*.git/*|*coverage/*|*.nyc_output/*) continue ;;
    esac

    TOTAL_COUNT=$((TOTAL_COUNT + 1))

    # 文件最后一次 commit 的时间戳
    last_commit_epoch=$(git log -1 --format=%ct -- "$file" 2>/dev/null)
    if [ -z "$last_commit_epoch" ]; then
      continue  # 未 tracked 或没有 history
    fi

    if [ "$last_commit_epoch" -lt "$CUTOFF_EPOCH" ]; then
      days_old=$(( ($(date +%s) - last_commit_epoch) / 86400 ))
      printf "  [%3d days old] %s\n" "$days_old" "$file"
      COLD_COUNT=$((COLD_COUNT + 1))
    fi
  done < <(git ls-files "$p" 2>/dev/null)
done

# ── 汇总 ──

echo ""
echo "── 汇总 ──"
echo "扫描文件总数: ${TOTAL_COUNT}"
echo "cold 文件数 (> ${THRESHOLD_DAYS} 天): ${COLD_COUNT}"
echo ""

if [ "$COLD_COUNT" -gt 0 ]; then
  echo "建议:"
  echo "  - 选其中 1-3 个文件做主题性 review (派 Codex 或 sub-agent)"
  echo "  - review 焦点: '相比仓库其他更新过的文件, 这个还对吗？是否有隐形漂移？'"
  echo "  - 重点关注 skills/*/SKILL.md 和 init-prompt.md (历史教训 VH-08)"
  echo ""
  echo "下一步: 把 review 任务入队 #X (新建 task), 不要在本脚本里直接派 review"
fi
