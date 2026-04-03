#!/bin/bash
# Simple Harness Kit — 更新 Skills + 同步 Hook 脚本
#
# 用法:
#   bash update.sh                          # 只更新 Skills
#   bash update.sh --hooks /path/to/project # 同时更新目标项目的 Hook 脚本
#
# Skills 更新后需要新 session 生效。

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_SRC="$SCRIPT_DIR/skills"
TEMPLATES_HOOKS="$SCRIPT_DIR/templates/hooks"

echo ""
echo "Simple Harness Kit — 更新"
echo "========================="
echo ""

# 解析参数
PROJECT_DIR=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --hooks)
      PROJECT_DIR="$2"
      shift 2
      ;;
    --help|-h)
      echo "用法: bash update.sh [--hooks /path/to/project]"
      echo ""
      echo "  不带参数: 只更新 ~/.claude/skills/ 中的 Skills"
      echo "  --hooks <path>: 同时更新目标项目的 Hook 脚本到最新模板版本"
      exit 0
      ;;
    *)
      echo "未知参数: $1"
      exit 1
      ;;
  esac
done

# ── 1. 更新 Skills ──

# 检查两个可能的安装位置
updated=0
for dest in "$HOME/.claude/skills" "$(pwd)/.claude/skills"; do
  if [ -d "$dest" ]; then
    echo "更新 Skills: $dest"
    for skill_dir in "$SKILLS_SRC"/*/; do
      if [ -f "$skill_dir/SKILL.md" ]; then
        skill_name=$(basename "$skill_dir")
        if [ -d "$dest/$skill_name" ]; then
          cp -r "$skill_dir" "$dest/$skill_name"
          echo "  更新: $skill_name"
          updated=$((updated + 1))
        fi
      fi
    done
  fi
done

if [ $updated -eq 0 ]; then
  echo "未找到已安装的 Skills。先运行 install.sh 安装。"
fi

# ── 2. 更新目标项目的 Hook 脚本 ──

if [ -n "$PROJECT_DIR" ]; then
  echo ""
  echo "更新 Hook 脚本: $PROJECT_DIR/scripts/hooks/"

  if [ ! -d "$PROJECT_DIR/scripts/hooks" ]; then
    echo "  目标目录不存在: $PROJECT_DIR/scripts/hooks/"
    echo "  请先运行 /harness-init 初始化项目。"
    exit 1
  fi

  synced=0
  for hook in "$TEMPLATES_HOOKS"/*.js; do
    if [ -f "$hook" ]; then
      name=$(basename "$hook")
      target="$PROJECT_DIR/scripts/hooks/$name"
      if [ -f "$target" ]; then
        if ! diff -q "$hook" "$target" &>/dev/null; then
          cp "$hook" "$target"
          echo "  更新: $name"
          synced=$((synced + 1))
        fi
      fi
    fi
  done

  if [ $synced -eq 0 ]; then
    echo "  所有 Hook 已是最新版。"
  else
    echo "  更新了 $synced 个 Hook。新 session 生效。"
  fi
fi

echo ""
echo "完成。新 session 生效。"
echo ""
