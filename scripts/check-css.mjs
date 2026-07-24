#!/usr/bin/env node
// Lightweight static checks for the Bamboo China theme stylesheet.
//
// These act as the project's "tests": they fail the build when a known class
// of regression is reintroduced, and document the invariants we care about.
//
// Usage: node scripts/check-css.mjs
//
// Checks:
//   1. No committed personal absolute paths (e.g. /Users/...) leak into the
//      source or deploy scripts. (Catches the leak previously in deploy.mjs.)
//   2. If theme.css has been built, it must honour the OS-level
//      `prefers-reduced-motion` setting (a11y requirement).

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

let failures = 0;
function fail(msg) {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`);
  failures++;
}
function ok(msg) {
  console.log(`\x1b[32m✓ ${msg}\x1b[0m`);
}

// --- 1. No personal absolute paths in source / scripts ---
const SCAN_DIRS = ["scripts", "src"];
const PERSONAL_PATH = /\/Users\/[A-Za-z0-9_-]+\//;
let scanned = 0;
for (const dir of SCAN_DIRS) {
  const abs = join(root, dir);
  if (!existsSync(abs)) continue;
  const walk = (d) => {
    for (const entry of readdirSync(d)) {
      const p = join(d, entry);
      const st = statSync(p);
      if (st.isDirectory()) {
        if (entry === "node_modules" || entry.startsWith(".codebuddy")) continue;
        walk(p);
      } else if (/\.(scss|mjs|js|css)$/.test(entry)) {
        scanned++;
        const text = readFileSync(p, "utf8");
        if (PERSONAL_PATH.test(text)) {
          fail(`${p} 包含个人绝对路径（如 /Users/...），请勿提交机器相关路径`);
        }
      }
    }
  };
  walk(abs);
}
if (failures === 0) ok(`源码与脚本中未发现个人绝对路径（扫描 ${scanned} 个文件）`);

// --- 2. Built theme honours OS reduced-motion ---
const themeCss = join(root, "theme.css");
if (existsSync(themeCss)) {
  const css = readFileSync(themeCss, "utf8");
  if (/@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(css)) {
    ok("theme.css 已响应系统级 prefers-reduced-motion");
  } else {
    fail("theme.css 未包含 @media (prefers-reduced-motion: reduce)，动画不尊重系统减弱动效设置");
  }

  // --- 3. No NEW !important hacks ---
  // Obsidian's theme guidelines explicitly forbid `!important` (it blocks user
  // CSS snippets from overriding the theme). On 2026-07-20 we aggressively
  // reduced the count from 213 → 10. The 10 survivors are ALL inside
  // a11y-protective contexts (prefers-reduced-motion / .reduce-motion toggle /
  // @supports version warning) and must stay. This guard fails the build if the
  // count rises above the recorded baseline, forcing any new usage to be a
  // conscious decision (bump BASELINE_IMPORTANT and explain why).
  const importantCount = (css.match(/!important/g) || []).length;
  const BASELINE_IMPORTANT = 14;
  if (importantCount > BASELINE_IMPORTANT) {
    fail(
      `theme.css 中 !important 数量为 ${importantCount}，超过基线 ${BASELINE_IMPORTANT}。` +
        " 若确属必要，请先在 check-css.mjs 中上调 BASELINE_IMPORTANT 并说明原因。"
    );
  } else {
    ok(`theme.css 中 !important 数量为 ${importantCount}（基线 ${BASELINE_IMPORTANT}，未新增 hack）`);
  }
} else {
  console.log("ℹ 未找到 theme.css，跳过构建产物检查（请先运行 npm run build）");
}

if (failures > 0) {
  console.error(`\n\x1b[31m有 ${failures} 项检查未通过\x1b[0m`);
  process.exit(1);
}
console.log("\n所有检查通过 ✓");
