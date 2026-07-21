#!/usr/bin/env node
// gen-mood-tokens.mjs
//
// Single-source generator for the 16 东方意境 moods.
// Reads scripts/mood-parity-baseline.json (captured from theme.css, the golden
// pre-refactor CSS) and emits:
//   1. src/color-schemes/_mood-tokens.scss — the regenerated `body.cn-*` rules,
//      emitted as plain CSS (the Sass compiler cannot interpolate a whole
//      declaration string, so we emit CSS directly; the $moods data lives here
//      in the generator for a future @each refactor).
//   2. rewrites src/color-schemes/bamboo-china-palettes.scss — drops the hand-written
//      `body.cn-*` blocks and `@use "mood-tokens"` instead.
//
// Run after `node scripts/verify-mood-parity.mjs --update` to re-baseline, or to
// regenerate. NEVER edit _mood-tokens.scss by hand.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BASELINE = path.join(ROOT, 'scripts', 'mood-parity-baseline.json');
const TOKENS = path.join(ROOT, 'src', 'color-schemes', '_mood-tokens.scss');
const PALETTES = path.join(ROOT, 'src', 'color-schemes', 'bamboo-china-palettes.scss');

const data = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
const VARIANTS = ['light', 'light-desktop', 'light-mobile', 'dark', 'dark-desktop', 'dark-mobile'];
const moods = {};

for (const [sel, decls] of Object.entries(data)) {
  const m = sel.match(/^body\.cn-([\w-]+)\.theme-(light|dark)(?::not\(\.is-mobile\)|\.is-mobile)?$/);
  if (!m) continue;
  const name = m[1];
  let variant = m[2];
  if (sel.includes(':not(.is-mobile)')) variant += '-desktop';
  else if (sel.includes('.is-mobile')) variant += '-mobile';
  moods[name] ??= {};
  moods[name][variant] = decls
    .map((d) => d.replace(/^\s*\/\*.*?\*\/\s*/, '').trim()) // strip leading /* comment */
    .filter((d) => d.includes(':'));
}

function variantSelector(name, variant) {
  if (variant === 'light') return `body.cn-${name}.theme-light`;
  if (variant === 'light-desktop') return `body.cn-${name}.theme-light:not(.is-mobile)`;
  if (variant === 'light-mobile') return `body.cn-${name}.theme-light.is-mobile`;
  if (variant === 'dark') return `body.cn-${name}.theme-dark`;
  if (variant === 'dark-desktop') return `body.cn-${name}.theme-dark:not(.is-mobile)`;
  if (variant === 'dark-mobile') return `body.cn-${name}.theme-dark.is-mobile`;
  return null;
}

function tokenVal(decls, tokenName) {
  const d = decls.find((d) => d.startsWith(`--${tokenName}:`));
  if (!d) return null;
  return d.slice(d.indexOf(':') + 1).trim();
}

const names = Object.keys(moods).sort();
let css =
  '// AUTO-GENERATED from scripts/mood-parity-baseline.json by scripts/gen-mood-tokens.mjs.\n' +
  '// Single source of truth = the baseline JSON + this generator. Do NOT hand-edit.\n' +
  '// (The Sass compiler cannot interpolate a whole declaration string, so rules are\n' +
  '// emitted as plain CSS; the $moods data lives in this generator for a future refactor.)\n\n';

for (const name of names) {
  for (const v of VARIANTS) {
    if (!moods[name][v]) continue;
    const sel = variantSelector(name, v);
    if (!sel) continue;
    css += `${sel} {\n`;
    for (const d of moods[name][v]) css += `  ${d};\n`;
    // S1 cross-skin anchors: so Material/Adwaita/Fluent can opt into the mood.
    if (v === 'light' || v === 'dark') {
      const accent = tokenVal(moods[name][v], 'interactive-accent');
      const accentHover = tokenVal(moods[name][v], 'interactive-accent-hover');
      const textAccent = tokenVal(moods[name][v], 'text-accent');
      if (accent) css += `  --mood-accent:${accent};\n`;
      if (accentHover) css += `  --mood-accent-hover:${accentHover};\n`;
      if (textAccent) css += `  --mood-text-accent:${textAccent};\n`;
    }
    css += `}\n\n`;
  }
}
fs.writeFileSync(TOKENS, css);

// ── Rewrite palettes: keep default 竹影 blocks, drop hand-written cn-* blocks ──
let pal = fs.readFileSync(PALETTES, 'utf8');
const cnIdx = pal.indexOf('body.cn-');
if (cnIdx >= 0) pal = pal.slice(0, cnIdx).replace(/\s+$/, '\n');
if (!pal.includes('@use "mood-tokens"')) pal = '@use "mood-tokens";\n\n' + pal;
fs.writeFileSync(PALETTES, pal);

console.log(`✓ generated _mood-tokens.scss (${names.length} moods) and rewrote palettes.`);
