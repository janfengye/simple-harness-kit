#!/bin/bash
# Simple Harness Kit — 一键安装全部 Skills
#
# 用法:
#   bash install.sh                    # 安装到 ~/.claude/skills/（个人全局）
#   bash install.sh --scope project    # 安装到当前项目 .claude/skills/
#
# Skills 在新 session 启动时自动发现，无需额外配置。

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_SRC="$SCRIPT_DIR/skills"

# 解析参数
SCOPE="personal"
while [[ $# -gt 0 ]]; do
  case $1 in
    --scope)
      SCOPE="$2"
      shift 2
      ;;
    --help|-h)
      echo "用法: bash install.sh [--scope personal|project]"
      echo ""
      echo "  personal (默认)  安装到 ~/.claude/skills/，所有项目可用"
      echo "  project          安装到当前目录 .claude/skills/，仅当前项目可用"
      exit 0
      ;;
    *)
      echo "未知参数: $1 (用 --help 查看用法)"
      exit 1
      ;;
  esac
done

case "$SCOPE" in
  personal)
    DEST="$HOME/.claude/skills"
    ;;
  project)
    DEST="$(pwd)/.claude/skills"
    ;;
  *)
    echo "无效 scope: $SCOPE (可选: personal, project)"
    exit 1
    ;;
esac

echo ""
echo "Simple Harness Kit — Skill 安装"
echo "================================"
echo "来源: $SKILLS_SRC"
echo "目标: $DEST"
echo ""

mkdir -p "$DEST"

installed=0
for skill_dir in "$SKILLS_SRC"/*/; do
  if [ -f "$skill_dir/SKILL.md" ]; then
    skill_name=$(basename "$skill_dir")
    cp -r "$skill_dir" "$DEST/$skill_name"
    echo "  OK  $skill_name"
    installed=$((installed + 1))
  fi
done

echo ""
echo "安装完成: $installed 个 Skills"
echo ""
echo "已安装:"
echo "  /harness-init     为项目初始化 Harness（第一次用）"
echo "  /harness-on       启用 Harness 模式"
echo "  /harness-off      临时关闭 Harness 模式"
echo "  /harness-qa       执行 QA 验证流程"
echo "  /harness-santa    执行 Santa Method 对抗验证"
echo "  /harness-feedback 执行 F1-F5 反馈流程"
echo "  /harness-review   执行交付前复盘"
echo "  /harness-learn    分析行为数据"
echo "  /harness-test-bootstrap  为项目建立测试体系"
echo ""
echo "下一步:"
echo "  1. 进入你的项目目录"
echo "  2. 启动新 session: claude"
echo "  3. 输入: /harness-init"
echo "  4. init 完成后开新 session（Hook 在新 session 生效）"
echo ""
echo "更新: bash $SCRIPT_DIR/update.sh"
echo ""
