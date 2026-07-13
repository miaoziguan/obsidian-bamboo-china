#!/usr/bin/env node
// One-off + repeatable WCAG 2.x contrast audit for the 意境配色 (ambience)
// palettes in src/color-schemes/bamboo-china-palettes.scss.
//
// The palette file re-tints --text-* and --background-* but was never checked
// against WCAG AA. This script parses every palette variant (17 palettes ×
// light/dark × desktop/mobile = 68 combinations), merges the base block with
// the matching sub-block, and reports the contrast ratio of the key text/
// background pairs so we can see at a glance whether any fall below AA.
//
// Thresholds (WCAG 2.1):
//   --text-normal : 4.5:1  (body text)                       — HARD
//   --text-muted  : 4.5:1  (secondary text still counts)     — HARD
//   --text-faint  : informational only — by design "极弱",
//                    used for placeholders / disabled / decorative. Mirrors
//                    Obsidian's own default, so not forced to 3:1.
//   --interactive-accent : informational only — the signature accent of each
//                    palette; also used as link text. Left to a deliberate
//                    visual decision (links carry an underline as extra
//                    differentiation), not auto-corrected here.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, "..", "src", "color-schemes", "bamboo-china-palettes.scss");
const src = readFileSync(file, "utf8");

// ── colour parsing ─────────────────────────────────────────────────────────
function parseColor(str, vars, depth = 0) {
  if (depth > 4) return null;
  str = str.trim();
  if (!str) return null;
  if (str.startsWith("var(")) {
    const name = str.slice(4, -1).trim();
    return parseColor(vars[name] || "", vars, depth + 1);
  }
  if (str.startsWith("color-mix(")) {
    // color-mix(in srgb, A, B p%)
    const m = str.match(/color-mix\(in srgb,\s*([^,]+?),\s*([^)]+?)\s+(\d+(?:\.\d+)?)%\)/);
    if (!m) return null;
    const base = parseColor(m[1].trim(), vars, depth + 1);
    const pct = parseFloat(m[3]);
    const bRaw = m[2].trim();
    const bc = bRaw === "white" ? [255, 255, 255] : parseColor(bRaw, vars, depth + 1);
    if (!base || !bc) return null;
    const t = pct / 100;
    return base.map((c, i) => Math.round(c * (1 - t) + bc[i] * t));
  }
  if (str.startsWith("#")) {
    let h = str.slice(1);
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    if (h.length !== 6) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  if (str.startsWith("rgb")) {
    const nums = (str.match(/-?\d+\.?\d*/g) || []).map(Number);
    if (nums.length >= 3) return [nums[0], nums[1], nums[2]];
    return null;
  }
  return null;
}

function lin(c) {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function luminance([r, g, b]) {
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(a, b) {
  if (!a || !b) return null;
  const L1 = luminance(a), L2 = luminance(b);
  const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

// ── block extraction ─────────────────────────────────────────────────────────
const re =
  /body#\{mx\.\$bc\}\.(cn-\w+)\.(theme-(?:light|dark))(:not\(\.is-mobile\)|\.is-mobile)?\s*\{([^}]*)\}/g;
const palettes = {}; // name -> { light: {base, desktop, mobile}, dark: {...} }

let m;
while ((m = re.exec(src))) {
  const [, name, themeRaw, variantRaw, body] = m;
  const theme = themeRaw.replace(/^theme-/, "");
  const variant = variantRaw === ":not(.is-mobile)" ? "desktop" : variantRaw === ".is-mobile" ? "mobile" : "base";
  const vars = {};
  for (const line of body.split(";")) {
    const decl = line.match(/(--[\w-]+)\s*:\s*([^;]+)$/);
    if (decl) vars[decl[1].trim()] = decl[2].trim();
  }
  palettes[name] ||= {
    light: { base: {}, desktop: {}, mobile: {} },
    dark: { base: {}, desktop: {}, mobile: {} },
  };
  palettes[name][theme][variant] = vars;
}

// ── audit ────────────────────────────────────────────────────────────────────
const pairs = [
  ["--text-normal", "--background-primary", 4.5, "正文/画布", true],
  ["--text-muted", "--background-primary", 4.5, "次要/画布", true],
  ["--text-faint", "--background-primary", 3.0, "极弱/画布", false],
  ["--text-normal", "--background-secondary", 4.5, "正文/框架", true],
  ["--text-muted", "--background-secondary", 4.5, "次要/框架", true],
  ["--text-faint", "--background-secondary", 3.0, "极弱/框架", false],
  ["--interactive-accent", "--background-primary", 3.0, "强调/画布", false],
  ["--interactive-accent", "--background-secondary", 3.0, "强调/框架", false],
];

const fails = [];
const info = [];
let checked = 0;
let infoChecked = 0;
const names = Object.keys(palettes).sort();

console.log(`Parsed ${names.length} palettes.\n`);
for (const name of names) {
  for (const theme of ["light", "dark"]) {
    const base = palettes[name][theme].base || {};
    for (const variant of ["desktop", "mobile"]) {
      const sub = palettes[name][theme][variant];
      if (!sub) continue;
      const vars = { ...base, ...sub };
      const label = `${name.padEnd(11)} ${theme.padEnd(5)} ${variant}`;
      for (const [fg, bg, min, desc, hard] of pairs) {
        const fgc = parseColor(vars[fg] || "", vars);
        const bgc = parseColor(vars[bg] || "", vars);
        const ratio = contrast(fgc, bgc);
        if (ratio == null) continue;
        if (hard) {
          checked++;
          if (ratio < min) fails.push({ label, desc, fg, bg, ratio: ratio.toFixed(2), min });
        } else {
          infoChecked++;
          if (ratio < min) info.push({ label, desc, fg, bg, ratio: ratio.toFixed(2), min });
        }
      }
    }
  }
}

console.log(`Hard checks (正文/次要 vs 画布/框架): ${checked} pairs, ${fails.length} below AA.\n`);
if (fails.length === 0) {
  console.log("✅ All HARD pairs (text-normal / text-muted) meet WCAG AA.");
} else {
  console.log(`❌ ${fails.length} HARD pair(s) below AA:\n`);
  console.log("  palette       theme  variant  check             ratio  need");
  for (const f of fails) {
    console.log(
      `  ${f.label.padEnd(26)} ${f.desc.padEnd(10)} ${String(f.ratio).padStart(5)}  ≥${f.min}`
    );
  }
}

const faintMin = info
  .filter((i) => i.fg === "--text-faint")
  .reduce((a, i) => Math.min(a, parseFloat(i.ratio)), Infinity);
const accentMin = info
  .filter((i) => i.fg === "--interactive-accent")
  .reduce((a, i) => Math.min(a, parseFloat(i.ratio)), Infinity);
console.log(
  `\nInformational (not auto-fixed): --text-faint min ratio ≈ ${isFinite(faintMin) ? faintMin.toFixed(2) : "n/a"} ` +
    `(design-faint, mirrors Obsidian default); --interactive-accent min ratio ≈ ${isFinite(accentMin) ? accentMin.toFixed(2) : "n/a"} (signature link colour).`
);
process.exit(fails.length ? 1 : 0);
