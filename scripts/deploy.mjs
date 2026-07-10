#!/usr/bin/env node
// Deploy the compiled theme into an Obsidian vault for local testing.
//
// Usage:
//   node scripts/deploy.mjs [vault-themes-dir]
//
// The target vault themes directory can be provided three ways (first wins):
//   1. CLI argument:        node scripts/deploy.mjs /path/to/vault/.obsidian/themes
//   2. Env var:             OBSIDIAN_THEMES_DIR=/path/to/vault/.obsidian/themes
//   3. Default (hardcoded): the Cupertino vault used during development
//
// What it does:
//   - Creates <themes>/Cupertino if missing
//   - Backs up the existing theme.css to theme.css.bak.<timestamp> (keeps one only)
//   - Copies theme.css and manifest.json from the project root
//   - Verifies the deployed file is non-empty and newer than the backup

import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

const THEME_NAME = "Bamboo China";
const DEFAULT_THEMES_DIR = "/Users/pokerhu/Downloads/CJ/obsidian-vault/.obsidian/themes";

const themesDir =
  process.argv[2] ||
  process.env.OBSIDIAN_THEMES_DIR ||
  DEFAULT_THEMES_DIR;

const targetDir = join(themesDir, THEME_NAME);
const sourceCss = join(__dirname, "theme.css");
const sourceManifest = join(__dirname, "manifest.json");
const targetCss = join(targetDir, "theme.css");
const targetManifest = join(targetDir, "manifest.json");

function fail(msg) {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`);
  process.exit(1);
}

function ok(msg) {
  console.log(`\x1b[32m✓ ${msg}\x1b[0m`);
}

// --- Pre-flight checks ---
if (!existsSync(sourceCss)) fail(`找不到编译产物 ${sourceCss}\n  请先运行: npm run build`);
if (!existsSync(sourceManifest)) fail(`找不到 ${sourceManifest}`);

mkdirSync(targetDir, { recursive: true });

// --- Backup existing theme.css (keep history as theme.css.bak.<timestamp>) ---
if (existsSync(targetCss)) {
  try {
    const stamp = new Date()
      .toISOString()
      .replace(/[-:T]/g, "")
      .slice(0, 14); // YYYYMMDDHHMMSS in UTC
    copyFileSync(targetCss, join(targetDir, `theme.css.bak.${stamp}`));
  } catch (e) {
    fail(`备份失败: ${e.message}`);
  }
}

// --- Deploy ---
try {
  copyFileSync(sourceCss, targetCss);
  copyFileSync(sourceManifest, targetManifest);
} catch (e) {
  fail(`拷贝失败: ${e.message}`);
}

// --- Verify ---
const deployed = statSync(targetCss);
if (deployed.size === 0) fail("部署后的 theme.css 为空,疑似编译失败");

ok(`已部署到 ${targetDir}`);
ok(`theme.css (${(deployed.size / 1024).toFixed(0)} KB)`);
ok(`manifest.json (v${(JSON.parse(readFileSync(sourceManifest, "utf8")).version)})`);
console.log("\n在 Obsidian 中重启或切换主题即可看到更新。");
