// Generate AA-compliant "high-contrast accent" overrides for Bamboo China.
// For every 意境 palette + the default green, compute an accent colour that
// meets WCAG AA (>=4.5:1) against --background-primary, and emit a partial
// that activates under `body.accent-high-contrast` (scoped to the main line
// via mx.$bc so Adwaita / Material skins are untouched).

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const palettesPath = join(root, "src/color-schemes/bamboo-china-palettes.scss");

function parseColor(str) {
  str = str.trim();
  const m = str.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (m) return [+m[1], +m[2], +m[3]];
  const h = str.match(/^#([0-9a-f]{6})$/i);
  if (h) {
    const n = parseInt(h[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  return null;
}

function srgbToLin(c) {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function relLum([r, g, b]) {
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
}
function contrast(a, b) {
  const la = relLum(a), lb = relLum(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
function mix(c, target, amt) {
  return [
    Math.round(c[0] * (1 - amt) + target[0] * amt),
    Math.round(c[1] * (1 - amt) + target[1] * amt),
    Math.round(c[2] * (1 - amt) + target[2] * amt),
  ];
}
const rgb = ([r, g, b]) => `rgb(${r}, ${g}, ${b})`;

// Pull per-palette accents + per-variant background-primary from the file.
const src = readFileSync(palettesPath, "utf8");
const blockRe =
  /body#\{mx\.\$bc\}\.(cn-[\w-]+)\.theme-(light|dark)(?::not\(\.is-mobile\)|\.is-mobile)?\s*\{([^}]*)\}/g;
const blocks = {};
let m;
while ((m = blockRe.exec(src))) {
  const [, name, theme, body] = m;
  const get = (v) => {
    const d = body.match(new RegExp(`--${v}\\s*:\\s*([^;]+)`));
    return d ? d[1].trim() : null;
  };
  const key = `${name}.${theme}`;
  blocks[key] ||= {};
  const accent = get("interactive-accent");
  const bg = get("background-primary");
  if (accent) blocks[key].accent = accent;
  if (bg) blocks[key].bg = bg;
}

// Default (non-意境) bamboo-china accent from root.scss (light then dark).
const rootSrc = readFileSync(join(root, "src/app/root.scss"), "utf8");
const greenRgb = rootSrc.match(/--color-green-rgb:\s*(\d+\s*,\s*\d+\s*,\s*\d+)/g);
const defLight = greenRgb[0].match(/(\d+\s*,\s*\d+\s*,\s*\d+)/)[0];
const defDark = greenRgb[1].match(/(\d+\s*,\s*\d+\s*,\s*\d+)/)[0];
const defaultAccents = {
  light: parseColor(`rgb(${defLight})`),
  dark: parseColor(`rgb(${defDark})`),
};
// default backgrounds: root sets --background-primary? use white / near-black fallback.
const defaultBg = { light: [255, 255, 255], dark: [20, 20, 20] };

function toAA(accent, bg) {
  const bgLum = relLum(bg);
  const target = bgLum > 0.5 ? [0, 0, 0] : [255, 255, 255]; // darken on light bg, lighten on dark
  for (let amt = 0; amt <= 1.0001; amt += 0.02) {
    const c = mix(accent, target, Math.min(amt, 1));
    if (contrast(c, bg) >= 4.6) return c;
  }
  return mix(accent, target, 1);
}

const out = [];
out.push('@use "../mixins" as mx;');
out.push("");
out.push("// ── High-contrast accent overrides (opt-in via style-settings) ─────────");
out.push("// Activated by `body.accent-high-contrast`. Darkens the signature accent");
out.push("// (used for links + UI controls) to meet WCAG AA (>=4.5:1) against the");
out.push("// canvas, so even the theme's clean underline-less links stay readable.");
out.push("// Scoped to the main line (mx.$bc) so Adwaita / Material skins are");
out.push("// unaffected. Default (toggle off) keeps the original signature colours.");
out.push("//");
out.push("// Regenerate after editing palette accents: node scripts/gen-accent-aa.mjs");
out.push("");

// Default (non-意境) main line.
console.log("defaultAccents:", defaultAccents);
for (const theme of ["light", "dark"]) {
  if (!defaultAccents[theme]) {
    console.log("SKIP default", theme, "null accent");
    continue;
  }
  const aa = toAA(defaultAccents[theme], defaultBg[theme]);
  const ratio = contrast(aa, defaultBg[theme]).toFixed(2);
  out.push(`body.accent-high-contrast#{mx.$bc}.theme-${theme} {`);
  out.push(`  --interactive-accent: ${rgb(aa)};`);
  out.push(`  --interactive-accent-hover: ${rgb(aa)};`);
  out.push(`  --text-accent: ${rgb(aa)};`);
  out.push(`  --text-accent-hover: ${rgb(aa)};`);
  out.push(`}`);
  console.log(`default ${theme.padEnd(5)} accent -> ${rgb(aa)}  (${ratio}:1 vs canvas)`);
}

// 意境 palettes.
for (const key of Object.keys(blocks).sort()) {
  const { accent, bg } = blocks[key];
  if (!accent) {
    console.log("SKIP (no accent):", key);
    continue;
  }
  const ac = parseColor(accent);
  const bc = parseColor(bg) || [255, 255, 255];
  if (!ac) {
    console.log("SKIP (parse null):", key, "raw=", accent);
    continue;
  }
  const aa = toAA(ac, bc);
  const ratio = contrast(aa, bc).toFixed(2);
  const [name, theme] = key.split(".");
  out.push(`body.accent-high-contrast#{mx.$bc}.${name}.theme-${theme} {`);
  out.push(`  --interactive-accent: ${rgb(aa)};`);
  out.push(`  --interactive-accent-hover: ${rgb(aa)};`);
  out.push(`  --text-accent: ${rgb(aa)};`);
  out.push(`  --text-accent-hover: ${rgb(aa)};`);
  out.push(`}`);
  console.log(`${key.padEnd(22)} accent -> ${rgb(aa)}  (${ratio}:1 vs canvas)`);
}

const dest = join(root, "src/color-schemes/accent-high-contrast.scss");
writeFileSync(dest, out.join("\n") + "\n");
console.log(`\nWrote ${dest}`);
