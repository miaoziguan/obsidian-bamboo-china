#!/usr/bin/env node
// verify_build.mjs — 源码/产物同步护栏
//
// 把工作区 `theme.css`（由 `npm run build` 从 scss 编译）与已提交 (HEAD) 的
// `theme.css` 逐字节比对。若不一致，说明 scss 源码改动后**没有重新 build 并
// commit 最新 theme.css**，会导致 Obsidian 加载到陈旧产物——这正是「改了不生效」
// 的另一种形态（与级联/层错位是不同根因，但症状相同）。
//
// 用法（CI 串接）：
//   npm run build && node scripts/verify_build.mjs
// 本地自检：先 `npm run build`，再 `node scripts/verify_build.mjs`。
//
// 退出码（用 process.exitCode 而非 process.exit，避免管道下输出未 flush 即丢）：
//   0 = 同步；1 = 不一致（需 rebuild + 提交）；2 = 环境错误（缺文件/无 git）。

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const THEME = 'theme.css';
let exitCode = 0;

function loadBaseline() {
  try {
    return execSync(`git show HEAD:${THEME}`, { encoding: 'utf8' });
  } catch {
    return null; // HEAD 无 theme.css（首次提交前）
  }
}

function main() {
  const baseline = loadBaseline();

  let current;
  try {
    current = readFileSync(THEME, 'utf8');
  } catch {
    console.error(`❌ 找不到 ${THEME}：请先运行 \`npm run build\`。`);
    exitCode = 2;
    return;
  }

  if (baseline === null) {
    console.log(
      `⚠️  HEAD 中无 ${THEME} 基线（首次提交前）。跳过比对；请确保提交时一并纳入 build 产物。`
    );
    return;
  }

  if (current === baseline) {
    console.log(
      `✅ ${THEME} 与 HEAD 基线逐字节一致：源码与已提交产物同步，无遗漏的 build。`
    );
    return;
  }

  // 统计差异行数，便于人工定位（字节级不一致已足以判定失败）。
  const baseLines = baseline.split('\n');
  const curLines = current.split('\n');
  const n = Math.max(baseLines.length, curLines.length);
  let diffCount = 0;
  for (let i = 0; i < n; i++) {
    if (baseLines[i] !== curLines[i]) diffCount++;
  }

  console.error(`❌ ${THEME} 与 HEAD 基线不一致（约 ${diffCount} 行不同）。`);
  console.error(
    '   根因：scss 源码改动后未重新 build，或 build 产物未一并提交。'
  );
  console.error(
    '   修复：运行 `npm run build`，确认 theme.css 已更新，然后 `git add theme.css` 提交。'
  );
  exitCode = 1;
}

main();
process.exitCode = exitCode;
