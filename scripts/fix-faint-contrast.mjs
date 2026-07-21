#!/usr/bin/env node
// fix-faint-contrast.mjs
//
// Bumps every mood (cn-*) --text-faint to ≥3.0:1 against its canvas so the
// STRICT contrast guard can drop the "mood advisory" workaround and treat
// text-faint the same as the other 4 tokens.
//
// Approach: blend the current faint colour toward black (light mode) or white
// (dark mode) with binary search until the contrast barely clears a 3.05
// threshold (0.05 guard above the 3.0 WCAG 1.4.11 floor).
//
// Modifies scripts/mood-parity-baseline.json in-place. After running this you
// MUST re-run `node scripts/gen-mood-tokens.mjs && npm run build &&
// node scripts/verify-mood-parity.mjs --update`.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const BASELINE = path.join(ROOT, 'scripts', 'mood-parity-baseline.json');
const TARGET = 3.05;

// ── Color primitives (mirrors check-palette-contrast.mjs) ──────────────────
function parseColor(v) {
  const s = String(v).trim();
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const rgb = s.match(/rgba?\(\s*([\d.]+)\s*[,/ ]\s*([\d.]+)\s*[,/ ]\s*([\d.]+)/i);
  if (rgb) return [Math.round(+rgb[1]), Math.round(+rgb[2]), Math.round(+rgb[3])];
  throw new Error(`Unparseable: ${v}`);
}

function luminance([r, g, b]) {
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function contrast(c1, c2) {
  const [l1, l2] = [luminance(c1), luminance(c2)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

// ── Adjustment: binary-search blend toward black (light) or white (dark) ──
function adjust([fr, fg, fb], bg, mode) {
  const blend = mode === 'light' ? [0, 0, 0] : [255, 255, 255];
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    const adj = [fr, fg, fb].map((c, j) => Math.round(c * (1 - m) + blend[j] * m));
    if (contrast(adj, bg) >= TARGET) hi = m;
    else lo = m;
  }
  return [fr, fg, fb].map((c, j) => Math.round(c * (1 - hi) + blend[j] * hi));
}

// ── Main ───────────────────────────────────────────────────────────────────
const data = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
let fixed = 0, total = 0;

for (const [sel, decls] of Object.entries(data)) {
  if (!sel.startsWith('body.cn-')) continue;

  // Desktop variant — carries the canvas (--background-primary).
  const dk = sel.match(/^body\.cn-([\w-]+)\.theme-(light|dark):not\(\.is-mobile\)$/);
  if (!dk) continue;
  const [ , mood, mode] = dk;

  const bgDecl = decls.find(d => d.startsWith('--background-primary:'));
  if (!bgDecl) continue;
  let bg;
  try { bg = parseColor(bgDecl.replace(/^--background-primary:/, '').trim()); }
  catch { continue; }

  // Parent mood block — carries --text-faint.
  const faintSel = `body.cn-${mood}.theme-${mode}`;
  const faintBlock = data[faintSel];
  if (!faintBlock) continue;
  const fIdx = faintBlock.findIndex(d => d.startsWith('--text-faint:'));
  if (fIdx < 0) continue;
  const fVal = faintBlock[fIdx].replace(/^--text-faint:/, '').trim();

  let fc;
  try { fc = parseColor(fVal); } catch { continue; }
  total++;

  const cr = contrast(fc, bg);
  if (cr >= TARGET) continue;

  const adj = adjust(fc, bg, mode);
  const hex = rgbToHex(adj);
  faintBlock[fIdx] = `--text-faint:${hex}`;

  // Also fix desktop sub-blocks that carry their own text-faint.
  for (const sub of [`body.cn-${mood}.theme-${mode}:not(.is-mobile)`, `body.cn-${mood}.theme-${mode}.is-mobile`]) {
    const b = data[sub];
    if (!b) continue;
    const si = b.findIndex(d => d.startsWith('--text-faint:'));
    if (si >= 0) b[si] = `--text-faint:${hex}`;
  }

  console.log(`  ${mood}/${mode}: ${cr.toFixed(2)}:1 → ${hex}`);
  fixed++;
}

fs.writeFileSync(BASELINE, JSON.stringify(data, null, 2) + '\n');
console.log(`\nFixed ${fixed}/${total} mood text-faint entries.`);
if (fixed > 0) console.log(`Re-run: node scripts/gen-mood-tokens.mjs && npm run build && node scripts/verify-mood-parity.mjs --update`);
