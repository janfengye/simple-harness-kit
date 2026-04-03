#!/usr/bin/env node
'use strict';

/**
 * find-root.js — 从 CWD 向上查找项目根目录（包含 .harness/ 的目录）
 *
 * 解决问题: Hook 脚本用相对路径访问 .harness/ 等文件，但 process.cwd()
 * 可能在子目录（如 cd 到子仓库做 git 操作），导致路径解析错误。
 *
 * 用法:
 *   const findRoot = require('./find-root');
 *   const ROOT = findRoot();
 *   const stageFile = path.join(ROOT, '.harness/current-stage.json');
 *
 * 约束: C-HOOK-05
 */

const fs = require('fs');
const path = require('path');

function findProjectRoot() {
  let dir = process.cwd();
  const root = path.parse(dir).root;

  while (dir !== root) {
    if (fs.existsSync(path.join(dir, '.harness'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // 最后检查根目录
  if (fs.existsSync(path.join(dir, '.harness'))) {
    return dir;
  }

  // fallback: 返回 CWD
  return process.cwd();
}

module.exports = findProjectRoot;
