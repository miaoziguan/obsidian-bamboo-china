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

// Helper: convert modern space-separated rgb() to comma-separated for plugin parseColorToRgb compat.
function fixRgbFormat(str) {
  return str.replace(/\brgba?\(([\d.\s]+)\)/g, (_, vals) => {
    const parts = vals.trim().split(/\s+/);
    return `rgb(${parts.join(', ')})`;
  });
}

// ── Bamboo palette derivation (S2: 竹杖芒鞋 bridge) ────────────────────────
// Given a mood's --interactive-accent, derive a 4-tier bamboo palette that
// preserves the mood's hue while following the original bamboo lightness rhythm.
function parseRgb(str) {
  const m = str.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return null;
  return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

function deriveBambooPalette(accentStr, isDark) {
  const rgb = parseRgb(accentStr);
  if (!rgb) return null;
  const [h, s, l] = rgbToHsl(...rgb);
  const clampL = (v) => Math.max(isDark ? 15 : 12, Math.min(isDark ? 90 : 92, v));
  if (isDark) {
    return {
      deep: `rgb(${hslToRgb(h, s, clampL(l - 8)).join(', ')})`,
      bamboo: accentStr,
      light: `rgb(${hslToRgb(h, Math.max(30, s - 5), clampL(l + 12)).join(', ')})`,
      pale: `rgba(${rgb.join(', ')}, 0.25)`,
    };
  }
  return {
    deep: `rgb(${hslToRgb(h, Math.min(55, s + 5), clampL(l - 15)).join(', ')})`,
    bamboo: accentStr,
    light: `rgb(${hslToRgb(h, Math.min(45, s), clampL(l + 12)).join(', ')})`,
    pale: `rgb(${hslToRgb(h, Math.max(10, s - 8), clampL(l + 30)).join(', ')})`,
  };
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
    const emitted = new Set();
    for (const d of moods[name][v]) {
      const line = `  ${fixRgbFormat(d)};\n`;
      // Track variable name to skip S1/S2 re-emission.
      const varName = d.match(/^--([\w-]+):/)?.[1];
      if (varName) emitted.add(varName);
      css += line;
    }
    // S1 cross-skin anchors: so Material/Adwaita/Fluent can opt into the mood.
    // Only emit if NOT already in baseline for this block.
    if (v === 'light' || v === 'dark') {
      const accent = tokenVal(moods[name][v], 'interactive-accent');
      const accentHover = tokenVal(moods[name][v], 'interactive-accent-hover');
      const textAccent = tokenVal(moods[name][v], 'text-accent');
      if (accent && !emitted.has('mood-accent')) css += `  --mood-accent:${fixRgbFormat(accent)};\n`;
      if (accentHover && !emitted.has('mood-accent-hover')) css += `  --mood-accent-hover:${fixRgbFormat(accentHover)};\n`;
      if (textAccent && !emitted.has('mood-text-accent')) css += `  --mood-text-accent:${fixRgbFormat(textAccent)};\n`;
      // S2 bamboo palette bridge → 竹杖芒鞋 plugin picks these up via var() fallback.
      const accentFixed = tokenVal(moods[name][v], 'interactive-accent');
      if (accentFixed) {
        const palette = deriveBambooPalette(fixRgbFormat(accentFixed), v === 'dark');
        if (palette) {
          if (!emitted.has('mood-bamboo-deep')) css += `  --mood-bamboo-deep:${palette.deep};\n`;
          if (!emitted.has('mood-bamboo')) css += `  --mood-bamboo:${palette.bamboo};\n`;
          if (!emitted.has('mood-bamboo-light')) css += `  --mood-bamboo-light:${palette.light};\n`;
          if (!emitted.has('mood-bamboo-pale')) css += `  --mood-bamboo-pale:${palette.pale};\n`;
        }
      }
    }
    css += `}\n\n`;
  }
}

// ── Write generated files only when content actually changed ────────────────
// Skipping identical writes keeps file mtimes stable, so the Sass compiler
// does not recompile the whole theme.scss on every incremental build.
function writeIfChanged(file, content) {
  try {
    if (fs.readFileSync(file, 'utf8') === content) return false;
  } catch {
    /* file missing → always write */
  }
  fs.writeFileSync(file, content);
  return true;
}
const tokensChanged = writeIfChanged(TOKENS, css);

// ── Rewrite palettes: keep default 竹影 blocks, drop hand-written cn-* blocks ──
let pal = fs.readFileSync(PALETTES, 'utf8');
const cnIdx = pal.indexOf('body.cn-');
if (cnIdx >= 0) pal = pal.slice(0, cnIdx).replace(/\s+$/, '\n');
if (!pal.includes('@use "mood-tokens"')) pal = '@use "mood-tokens";\n\n' + pal;
const palettesChanged = writeIfChanged(PALETTES, pal);

console.log(`✓ generated _mood-tokens.scss (${names.length} moods) and rewrote palettes.${tokensChanged ? '' : ' (unchanged, skipped write)'}${palettesChanged ? '' : ' (palettes unchanged, skipped write)'}`);
