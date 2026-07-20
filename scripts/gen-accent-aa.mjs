#!/usr/bin/env node
// Regenerate the per-意境 high-contrast accent overrides in
// src/color-schemes/accent-high-contrast.scss.
//
// FIX (2026-07-20):
//   • selector regex now matches `body.cn-NAME.theme-light(:not(.is-mobile))`
//     (was `body#{mx.$bc}.cn-NAME...`, which parsed 0 → on the next run the
//     generator wrote only the default block and SILENTLY DELETED every 意境
//     override);
//   • scoping dropped to platform-agnostic `body.accent-high-contrast.cn-NAME`
//     (the palettes themselves are no longer scoped to mx.$bc);
//   • NON-DESTRUCTIVE: the hand-maintained DEFAULT block (between the sentinels
//     in the target file) is preserved verbatim; only the GENERATED 意境
//     section is rewritten;
//   • each 意境's background is read from its real --background-primary (the
//     :not(.is-mobile) block) instead of a hardcoded [20,20,20]/[255,255,255].
import fs from 'node:fs';
import path from 'node:path';

const PALETTES = 'src/color-schemes/bamboo-china-palettes.scss';
const ACCENT = 'src/color-schemes/accent-high-contrast.scss';
const DEF_START = '/* === DEFAULT (hand-maintained, do not regenerate) === */';
const DEF_END = '/* === END DEFAULT === */';
const GEN_START = '/* === GENERATED 意境 BLOCKS (auto — do not edit by hand) === */';
const GEN_END = '/* === END GENERATED === */';
const TARGET = 3.0; // WCAG non-text contrast

const palettes = fs.readFileSync(PALETTES, 'utf8');

// ── var resolution ─────────────────────────────────────────────────────────
function buildVarMap() {
  const map = {};
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.scss')) {
        const t = fs.readFileSync(p, 'utf8');
        for (const m of t.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) map[m[1]] = m[2].trim();
      }
    }
  };
  walk('src');
  return map;
}
const VARMAP = buildVarMap();
function resolve(value) {
  let v = String(value).trim();
  let guard = 0;
  while (/var\(/.test(v) && guard++ < 10) {
    v = v.replace(/var\((--[\w-]+)(?:\s*,\s*[^)]+)?\)/g, (_, name) => VARMAP[name] ?? '');
  }
  return v.trim();
}
function parseColor(value) {
  const v = resolve(value);
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const rgb = v.match(/rgba?\(\s*([\d.]+)\s*%?\s*[, ]\s*([\d.]+)\s*%?\s*[, ]\s*([\d.]+)\s*%?/i);
  if (rgb) {
    const to255 = (x) => (x.includes('%') ? Math.round((parseFloat(x) / 100) * 255) : Math.round(parseFloat(x)));
    return [to255(rgb[1]), to255(rgb[2]), to255(rgb[3])];
  }
  const cm = v.match(/color-mix\([^,]+,\s*([^,]+?),/i);
  if (cm) return parseColor(cm[1]);
  throw new Error(`Unparseable color: ${value}`);
}

// ── block extraction ────────────────────────────────────────────────────────
function blockBody(selectorRe) {
  const m = selectorRe.exec(palettes);
  if (!m) return null;
  const open = palettes.indexOf('{', m.index);
  let depth = 0;
  for (let i = open; i < palettes.length; i++) {
    if (palettes[i] === '{') depth++;
    else if (palettes[i] === '}') {
      depth--;
      if (depth === 0) return palettes.slice(open + 1, i);
    }
  }
  return null;
}
function getVar(body, name) {
  const m = body?.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
}
function accentFor(name, mode) {
  const accent = getVar(blockBody(new RegExp(`body\\.cn-${name}\\.theme-${mode}\\s*\\{`)), 'interactive-accent');
  const bg = getVar(
    blockBody(new RegExp(`body\\.cn-${name}\\.theme-${mode}:not\\(\\.(?:is-mobile)\\)\\s*\\{`)),
    'background-primary'
  );
  return aaAccent(parseColor(accent), parseColor(bg));
}

// ── AA computation ──────────────────────────────────────────────────────────
function luminance([r, g, b]) {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = [Math.max(l1, l2), Math.min(l1, l2)];
  return (hi + 0.05) / (lo + 0.05);
}
function aaAccent(accent, bg) {
  let [r, g, b] = accent;
  let best = ratio(accent, bg);
  if (best >= TARGET) return [r, g, b];
  // Nudge along the grey axis toward the opposite luminance of the background
  // until the non-text contrast target is met.
  const step = luminance(bg) > 0.5 ? -1 : 1;
  let tries = 0;
  while (best < TARGET && tries++ < 255) {
    r = Math.max(0, Math.min(255, r + step));
    g = Math.max(0, Math.min(255, g + step));
    b = Math.max(0, Math.min(255, b + step));
    best = ratio([r, g, b], bg);
  }
  return [r, g, b];
}

// ── generate ────────────────────────────────────────────────────────────────
const names = [...new Set([...palettes.matchAll(/body\.cn-([\w-]+)\.theme-light\s*\{/g)].map((m) => m[1]))];

let gen = GEN_START + '\n';
for (const name of names) {
  const [lr, lg, lb] = accentFor(name, 'light');
  const [dr, dg, db] = accentFor(name, 'dark');
  gen += `body.accent-high-contrast.cn-${name}.theme-light {\n`;
  gen += `  --interactive-accent: rgb(${lr}, ${lg}, ${lb});\n`;
  gen += `  --interactive-accent-hover: rgb(${lr}, ${lg}, ${lb});\n`;
  gen += `  --text-accent: rgb(${lr}, ${lg}, ${lb});\n`;
  gen += `  --accent-aa-rgb: ${lr}, ${lg}, ${lb};\n`;
  gen += `}\n`;
  gen += `body.accent-high-contrast.cn-${name}.theme-dark {\n`;
  gen += `  --interactive-accent: rgb(${dr}, ${dg}, ${db});\n`;
  gen += `  --interactive-accent-hover: rgb(${dr}, ${dg}, ${db});\n`;
  gen += `  --text-accent: rgb(${dr}, ${dg}, ${db});\n`;
  gen += `  --accent-aa-rgb: ${dr}, ${dg}, ${db};\n`;
  gen += `}\n`;
}
gen += GEN_END + '\n';

// preserve the hand-maintained default block
const cur = fs.readFileSync(ACCENT, 'utf8');
let defaultBlock;
if (cur.includes(DEF_START) && cur.includes(DEF_END)) {
  defaultBlock = cur.slice(cur.indexOf(DEF_START), cur.indexOf(DEF_END) + DEF_END.length);
} else {
  defaultBlock = `${DEF_START}\n// (default block was missing)\n${DEF_END}`;
}
fs.writeFileSync(ACCENT, defaultBlock + '\n' + gen);
console.log(`Regenerated ${names.length} 意境 accent blocks (default block preserved).`);
