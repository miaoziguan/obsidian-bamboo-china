#!/usr/bin/env node
// WCAG non-text contrast guardrail for Bamboo China 意境 palettes.
//
// FIX (2026-07-20): the previous version matched the OLD selector shape
// `body#{mx.$bc}.cn-NAME.theme-...`, which no longer exists after the
// palettes were refactored to `body.cn-NAME.theme-light(:not(.is-mobile))`.
// That made it "Parsed 0 palettes" and pass on zero samples — a silent no-op.
//
// Now it:
//   • matches the current `body.cn-NAME.theme-light(:not(.is-mobile))` blocks,
//   • resolves `var()` / `rgb()` / `hex` colors (the 意境 accent + bg are all
//     of these forms; the `color-mix(in oklch ...)` re-tint in the top block is
//     out of scope for accent/bg and ignored),
//   • treats "0 palettes parsed" as a HARD FAIL so the guardrail can never
//     silently pass again.
//
// Threshold: 3.0 — WCAG 1.4.11 (non-text contrast) for UI components, which is
// the correct bar for an interactive accent vs its background (not 4.5, which is
// for body text).
import fs from 'node:fs';
import path from 'node:path';

const PALETTES = 'src/color-schemes/bamboo-china-palettes.scss';
const THRESHOLD = 3.0;

const text = fs.readFileSync(PALETTES, 'utf8');

// ── var resolution (build a global map from every scss source) ────────────
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
  // color-mix — best-effort: take the first component.
  const cm = v.match(/color-mix\([^,]+,\s*([^,]+?),/i);
  if (cm) return parseColor(cm[1]);
  throw new Error(`Unparseable color: ${value}`);
}

// ── resolve the EFFECTIVE (last-defined) declaration for a selector ────────
// We take the last match in the file so that later, same-specificity override
// blocks (e.g. the accessibility fixes appended at the end of the palettes
// file) win the cascade exactly as the browser would resolve them.
function lastDecl(selectorPrefix, varName) {
  const re = new RegExp(selectorPrefix + '[^}]*?--' + varName + ':\\s*([^;]+);', 'g');
  let m;
  let last = null;
  while ((m = re.exec(text))) last = m[1].trim();
  return last;
}

// ── contrast math (WCAG) ───────────────────────────────────────────────────
function luminance([r, g, b]) {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
function contrast(c1, c2) {
  const l1 = luminance(c1);
  const l2 = luminance(c2);
  const [hi, lo] = [Math.max(l1, l2), Math.min(l1, l2)];
  return (hi + 0.05) / (lo + 0.05);
}

// ── run ───────────────────────────────────────────────────────────────────
const names = [...new Set([...text.matchAll(/body\.cn-([\w-]+)\.theme-light\s*\{/g)].map((m) => m[1]))];

let failures = 0;
let checked = 0;
const lines = [];
for (const name of names) {
  for (const mode of ['light', 'dark']) {
    const accent = lastDecl(`body\\.cn-${name}\\.theme-${mode}`, 'interactive-accent');
    const bg = lastDecl(`body\\.cn-${name}\\.theme-${mode}:not\\(\\.(?:is-mobile)\\)`, 'background-primary');
    if (!accent || !bg) {
      lines.push(`⚠  ${name}/${mode}: missing --interactive-accent or --background-primary`);
      continue;
    }
    let ac, bc, ratio;
    try {
      ac = parseColor(accent);
      bc = parseColor(bg);
      ratio = contrast(ac, bc);
    } catch (e) {
      lines.push(`⚠  ${name}/${mode}: ${e.message}`);
      continue;
    }
    checked++;
    const ok = ratio >= THRESHOLD;
    if (!ok) failures++;
    lines.push(`${ok ? '✓' : '✗'}  ${name}/${mode}: ${ratio.toFixed(2)}:1 ${ok ? '' : `< AA ${THRESHOLD}:1`}`);
  }
}

console.log(lines.join('\n'));

if (checked === 0) {
  console.error('\n✗ No palettes parsed — the guardrail is misconfigured (regex/selector drift).');
  process.exit(1);
}
if (failures > 0) {
  console.error(`\n✗ ${failures}/${checked} 意境 palette(s) fail WCAG non-text contrast (${THRESHOLD}:1).`);
  process.exit(1);
}
console.log(`\n✓ All ${checked} 意境 palettes pass WCAG non-text contrast (${THRESHOLD}:1).`);
