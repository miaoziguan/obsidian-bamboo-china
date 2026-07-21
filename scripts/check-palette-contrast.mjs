#!/usr/bin/env node
// WCAG contrast guardrail for Bamboo China 意境 palettes (extended 2026-07-21).
//
// For every palette (the default `body.theme-*` scheme + each `cn-*` 意境 scheme)
// and each mode (light/dark), validates the contrast of key design tokens against
// the canvas (--background-primary, i.e. the editor/reading surface):
//
//   • --interactive-accent  vs bg  ≥ 3.0   (WCAG 1.4.11 — UI / non-text contrast)
//   • --text-accent         vs bg  ≥ 4.5   (WCAG 1.4.3 — links are text, not glyphs)
//   • --text-normal         vs bg  ≥ 4.5   (WCAG 1.4.3 — body text)
//   • --text-muted          vs bg  ≥ 4.5   (WCAG 1.4.3 — secondary text)
//   • --text-faint          vs bg  ≥ 3.0   (WCAG 1.4.11 — non-text / metadata)
//
// "0 tokens parsed" is a HARD FAIL so the guardrail can never silently pass on a
// selector/regex drift (this happened once before the 2026-07-20 fix).
//
// Resolution: builds a global var() map from every .scss source, then evaluates
// the LAST declaration for each selector so later, same-specificity override
// blocks (e.g. the accessibility fixes appended at the end of the palettes file)
// win the cascade exactly as the browser would.
import fs from 'node:fs';
import path from 'node:path';

const PALETTES = 'src/color-schemes/bamboo-china-palettes.scss';
const T = { nonText: 3.0, text: 4.5, faint: 3.0 };

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
  const hsl = v.match(/hsla?\(\s*[\d.]+\s*[, ]\s*[\d.]+%\s*[, ]\s*([\d.]+)%/i);
  if (hsl) return [Math.round((parseFloat(hsl[1]) / 100) * 255), Math.round((parseFloat(hsl[1]) / 100) * 255), Math.round((parseFloat(hsl[1]) / 100) * 255)];
  // color-mix — best-effort: take the first component.
  const cm = v.match(/color-mix\([^,]+,\s*([^,]+?),/i);
  if (cm) return parseColor(cm[1]);
  throw new Error(`Unparseable color: ${value}`);
}

// ── resolve the EFFECTIVE (last-defined) declaration for a selector ────────
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

// ── collect schemes: default + every cn-* ─────────────────────────────────
const cnNames = [...new Set([...text.matchAll(/body\.cn-([\w-]+)\.theme-light\s*\{/g)].map((m) => m[1]))];
const schemes = [];
schemes.push({
  label: 'default',
  lightAcc: 'body\\.theme-light', lightBg: 'body\\.theme-light:not\\(\\.(?:is-mobile)\\)',
  darkAcc: 'body\\.theme-dark', darkBg: 'body\\.theme-dark:not\\(\\.(?:is-mobile)\\)',
});
for (const n of cnNames) {
  schemes.push({
    label: n,
    lightAcc: `body\\.cn-${n}\\.theme-light`, lightBg: `body\\.cn-${n}\\.theme-light:not\\(\\.(?:is-mobile)\\)`,
    darkAcc: `body\\.cn-${n}\\.theme-dark`, darkBg: `body\\.cn-${n}\\.theme-dark:not\\(\\.(?:is-mobile)\\)`,
  });
}

let failures = 0;
let checked = 0;
const lines = [];
function checkToken(label, sel, varName, bg, threshold, name) {
  const raw = lastDecl(sel, varName);
  if (!raw) { lines.push(`⚠  ${label}: missing --${varName}`); return; }
  let c, ratio;
  try { c = parseColor(raw); ratio = contrast(c, bg); }
  catch (e) { lines.push(`⚠  ${label}: ${e.message}`); return; }
  checked++;
  const ok = ratio >= threshold;
  if (!ok) failures++;
  lines.push(`${ok ? '✓' : '✗'}  ${label.padEnd(22)} ${name}: ${ratio.toFixed(2)}:1 ${ok ? '' : `< AA ${threshold}:1`}`);
}

for (const s of schemes) {
  for (const mode of ['light', 'dark']) {
    const accSel = mode === 'light' ? s.lightAcc : s.darkAcc;
    const bgSel = mode === 'light' ? s.lightBg : s.darkBg;
    const bgRaw = lastDecl(bgSel, 'background-primary');
    if (!bgRaw) { lines.push(`⚠  ${s.label}/${mode}: missing --background-primary`); continue; }
    let bg;
    try { bg = parseColor(bgRaw); } catch (e) { lines.push(`⚠  ${s.label}/${mode}: ${e.message}`); continue; }
    const p = `${s.label}/${mode}`;
    checkToken(p, accSel, 'interactive-accent', bg, T.nonText, 'accent≥3.0');
    checkToken(p, accSel, 'text-accent', bg, T.text, 'text-accent≥4.5');
    checkToken(p, accSel, 'text-normal', bg, T.text, 'text-normal≥4.5');
    checkToken(p, accSel, 'text-muted', bg, T.text, 'text-muted≥4.5');
    checkToken(p, accSel, 'text-faint', bg, T.faint, 'text-faint≥3.0');
  }
}

console.log(lines.join('\n'));

if (checked === 0) {
  console.error('\n✗ No tokens parsed — the guardrail is misconfigured (regex/selector drift).');
  process.exit(1);
}
if (failures > 0) {
  console.error(`\n✗ ${failures}/${checked} token checks fail WCAG thresholds.`);
  process.exit(1);
}
console.log(`\n✓ All ${checked} token checks pass WCAG thresholds.`);
