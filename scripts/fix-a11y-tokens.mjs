#!/usr/bin/env node
// Phase 3 token generator (idempotent-append): for every palette + the `cn` base,
// emit override blocks that guarantee WCAG thresholds for *text* tokens:
//   • --text-accent (inline links) ≥ 4.5:1 vs canvas  (light mode only; dark
//     accents already pass). Achieved by darkening the brand accent toward
//     black just enough to clear 4.5:1 — links stay on-hue, simply deeper.
//   • --text-faint (metadata: line numbers, breadcrumbs, frontmatter) ≥ 3:1 vs
//     canvas. Light mode darkens the faint gray; dark mode lightens it. Hue is
//     preserved by blending toward black/white.
// Overrides are appended at the END of each file so they win the cascade over
// any earlier same-specificity declaration (e.g. the 2026-07-20 a11y block).
import fs from 'node:fs';

const PALETTES = 'src/color-schemes/bamboo-china-palettes.scss';

// ── color math ────────────────────────────────────────────────────────────
const hexToRgb = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const lum = ([r, g, b]) => { const a = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; };
const contrast = (c1, c2) => { const l1 = lum(c1), l2 = lum(c2); const [hi, lo] = [Math.max(l1, l2), Math.min(l1, l2)]; return (hi + 0.05) / (lo + 0.05); };
const blend = (c, target, t) => c.map((v, i) => (1 - t) * v + t * target[i]);

function parseColor(v) {
  v = v.trim();
  let m;
  if ((m = v.match(/#([0-9a-f]{6})/i))) return hexToRgb(m[1]);
  if ((m = v.match(/rgba?\(\s*([\d.]+)\s*%?\s*[, ]\s*([\d.]+)\s*%?\s*[, ]\s*([\d.]+)\s*%?/i))) {
    const f = (x) => (x.includes('%') ? Math.round((parseFloat(x) / 100) * 255) : Math.round(parseFloat(x)));
    return [f(m[1]), f(m[2]), f(m[3])];
  }
  return null;
}
// resolve effective last declaration of varName for a selector prefix (handles var() chains)
function lastDecl(text, prefix, varName) {
  const re = new RegExp(prefix + '[^}]*?--' + varName + ':\\s*([^;]+);', 'g');
  let m, last = null;
  while ((m = re.exec(text))) last = m[1].trim();
  return last;
}
function resolveColor(text, prefix, varName) {
  let v = lastDecl(text, prefix, varName);
  if (!v) return null;
  let guard = 0;
  while (/var\(/.test(v) && guard++ < 8) {
    v = v.replace(/var\((--[\w-]+)(?:\s*,\s*[^)]+)?\)/g, (_, n) => lastDecl(text, prefix, n) || '');
  }
  return parseColor(v);
}
// smallest t (keep color closest to original) so contrast(blend(c,toward,t), bg) ≥ target
function minT(c, bg, toward, target, margin = 0.1) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (contrast(blend(c, toward, mid), bg) >= target + margin) hi = mid; else lo = mid;
  }
  return lo;
}

function buildOverrides(text, schemes, label) {
  const BLACK = [0, 0, 0], WHITE = [255, 255, 255];
  const blocks = [];
  for (const s of schemes) {
    for (const mode of ['light', 'dark']) {
      const sel = mode === 'light' ? s.lightSel : s.darkSel;
      const accSel = mode === 'light' ? s.lightAcc : s.darkAcc;
      // Resolve the canvas (--background-primary) from the *:not(.is-mobile)* block,
      // matching the contrast gate exactly. Using accSel alone would wrongly pick the
      // .is-mobile block's (different) background-primary.
      const bgSel = mode === 'light' ? s.lightBg : s.darkBg;
      const bg = resolveColor(text, bgSel, 'background-primary');
      const faint = resolveColor(text, accSel, 'text-faint');
      if (!bg || !faint) continue;
      const lines = [];
      const faintToward = mode === 'light' ? BLACK : WHITE;
      const fT = minT(faint, bg, faintToward, 3.0);
      lines.push(`  --text-faint: ${toHex(blend(faint, faintToward, fT))};`);
      if (mode === 'light') {
        const accent = resolveColor(text, accSel, 'interactive-accent');
        if (accent) {
          const aT = minT(accent, bg, BLACK, 4.5);
          lines.push(`  --text-accent: ${toHex(blend(accent, BLACK, aT))};`);
          lines.push(`  --text-accent-hover: ${toHex(blend(accent, BLACK, Math.min(1, aT * 1.12)))};`);
        }
      }
      if (lines.length) blocks.push(`${sel} {\n${lines.join('\n')}\n}`);
    }
  }
  if (!blocks.length) return '';
  return `\n/* Phase 3 a11y overrides (${label}) — text-faint ≥3:1, text-accent (links) ≥4.5:1 vs canvas. Appended ${new Date().toISOString().slice(0, 10)} */\n` + blocks.join('\n\n') + '\n';
}

// Strip any previously-appended Phase 3 block so inputs (text-faint / accent)
// are always the ORIGINAL values, not the output of a prior run. (The generator
// reads the *last* declaration of each token; without this strip it would feed
// its own prior (possibly still-sub-threshold) output back in as the input.)
function stripPhase3(t) {
  const i = t.indexOf('/* Phase 3 a11y overrides');
  return i >= 0 ? t.slice(0, i).replace(/\s+$/, '\n') : t;
}
let pText = stripPhase3(fs.readFileSync(PALETTES, 'utf8'));
fs.writeFileSync(PALETTES, pText);
const cnNames = [...new Set([...pText.matchAll(/body\.cn-([\w-]+)\.theme-light\s*\{/g)].map((m) => m[1]))];
const pSchemes = [
  { lightSel: 'body.theme-light', darkSel: 'body.theme-dark', lightAcc: 'body\\.theme-light', darkAcc: 'body\\.theme-dark', lightBg: 'body\\.theme-light:not\\(\\.(?:is-mobile)\\)', darkBg: 'body\\.theme-dark:not\\(\\.(?:is-mobile)\\)' },
  ...cnNames.map((n) => ({ lightSel: `body.cn-${n}.theme-light`, darkSel: `body.cn-${n}.theme-dark`, lightAcc: `body\\.cn-${n}\\.theme-light`, darkAcc: `body\\.cn-${n}\\.theme-dark`, lightBg: `body\\.cn-${n}\\.theme-light:not\\(\\.(?:is-mobile)\\)`, darkBg: `body\\.cn-${n}\\.theme-dark:not\\(\\.(?:is-mobile)\\)` })),
];
const pAdd = buildOverrides(pText, pSchemes, 'palettes');
fs.appendFileSync(PALETTES, pAdd);
console.log('fix-a11y-tokens: done');
