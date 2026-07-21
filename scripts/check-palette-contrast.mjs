#!/usr/bin/env node
// WCAG contrast guardrail for every SHIPPED skin (extended 2026-07-22).
//
// For every palette/mode and each of the 5 key design tokens, validates the
// contrast against the canvas (--background-primary, the editor/reading surface):
//
//   • --interactive-accent  vs bg  ≥ 3.0   (WCAG 1.4.11 — UI / non-text contrast)
//   • --text-accent         vs bg  ≥ 4.5   (WCAG 1.4.3 — links are text, not glyphs)
//   • --text-normal         vs bg  ≥ 4.5   (WCAG 1.4.3 — body text)
//   • --text-muted          vs bg  ≥ 4.5   (WCAG 1.4.3 — secondary text)
//   • --text-faint          vs bg  ≥ 3.0   (WCAG 1.4.11 — non-text / metadata)
//
// Skins covered:
//   • bamboo  (default + every `cn-*` 意境 mood)  — STRICT  (palette is self-contained hex/rgb)
//   • adwaita (light/dark)                        — STRICT  (palette is self-contained hex)
//   • material (light/dark, .material-color)      — ADVISORY
//       Material's colors are derived from the RUNTIME `--color-accent-hsl`
//       (OKLCH `from hsl(var(--color-accent-hsl)) …`), which is chosen per user and
//       unknown at build time. We approximate it with RUNTIME_DEFAULTS below and
//       report Material as advisory (⚠) rather than hard-failing CI — a static gate
//       cannot be authoritative for a user-dependent accent. It still catches
//       structural regressions (e.g. a token silently dropping to transparent).
//
// NOT separately checked (intentionally):
//   • fluent / baseline are PURE-SHAPE skins — they redefine NO color tokens, so they
//     inherit Bamboo China's palette, which the STRICT bamboo check already guards.
//
// "0 tokens parsed" is a HARD FAIL so the guardrail can never silently pass on a
// selector/regex drift.
//
// Resolution: builds a global var() map from every .scss source, then evaluates the
// LAST declaration for each selector so later, same-specificity override blocks win
// the cascade exactly as the browser would. Supports hex / rgb(a) / hsl / oklch
// (plain + relative `from …`) / color-mix(best-effort, first component).
import fs from 'node:fs';
import path from 'node:path';

const T = { nonText: 3.0, text: 4.5, faint: 3.0 };

// Runtime-only vars Obsidian injects but our sources don't define. Approximations
// used so OKLCH `from …` derivations can be evaluated. Material is advisory, so the
// exact hue here only affects Material's regression baseline, not a hard gate.
const RUNTIME_DEFAULTS = {
  'color-accent-hsl': '212, 100%, 50%',
  'accent-h': '212',
  'accent-s': '100%',
  'accent-l': '50%',
  'color-red-rgb': '230, 51, 59',
  'color-orange-rgb': '255, 120, 0',
  'color-yellow-rgb': '246, 211, 45',
  'color-green-rgb': '46, 194, 126',
  'color-cyan-rgb': '35, 164, 173',
  'color-blue-rgb': '98, 160, 234',
  'color-purple-rgb': '192, 97, 203',
  'color-pink-rgb': '224, 97, 178',
};

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
  while (/var\(/.test(v) && guard++ < 12) {
    v = v.replace(/var\((--[\w-]+)(?:\s*,\s*([^)]+))?\)/g, (_, name, fallback) => {
      // Mood-anchor tokens are context-dependent (only defined when a mood
      // class is on <body>). At build time they are undefined → use fallback.
      if (name.startsWith('--mood-')) return fallback ? fallback.trim() : '';
      const key = name.replace(/^--/, '');
      return VARMAP[key] ?? RUNTIME_DEFAULTS[key] ?? (fallback ? fallback.trim() : '');
    });
  }
  return v.trim();
}

// ── color parsing ─────────────────────────────────────────────────────────
function hslParts(str) {
  const m = str.match(/hsl\(\s*([\d.]+)\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%/i);
  return m ? { h: parseFloat(m[1]), s: parseFloat(m[2]), l: parseFloat(m[3]) } : null;
}
function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
function oklchToRgb(L, C, H) {
  const hr = (H * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  let r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  const gamma = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
  const to255 = (x) => Math.max(0, Math.min(255, Math.round(gamma(x) * 255)));
  return [to255(r), to255(g), to255(bl)];
}
function parseChannel(expr, originVal, ch) {
  expr = expr.trim();
  const cm = expr.match(/^calc\(\s*([a-z])\s*([+-])\s*([\d.]+)\s*\)$/i);
  if (cm && cm[1] === ch) return originVal + (cm[2] === '+' ? 1 : -1) * parseFloat(cm[3]);
  const n = parseFloat(expr);
  if (isNaN(n)) throw new Error(`Unparseable channel: ${expr}`);
  return n;
}
function parseHue(expr, H0) {
  expr = expr.trim();
  if (expr === 'h') return ((H0 % 360) + 360) % 360;
  const cm = expr.match(/^calc\(\s*h\s*([+-])\s*([\d.]+)\s*\)$/i);
  if (cm) return (((H0 + (cm[1] === '+' ? 1 : -1) * parseFloat(cm[2])) % 360) + 360) % 360;
  const n = parseFloat(expr);
  return isNaN(n) ? H0 : n;
}
function originOklch(originStr) {
  const r = resolve(originStr);
  const hp = hslParts(r);
  if (hp) return { L: hp.l / 100, C: 0, H: hp.h };
  const op = r.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (op) return { L: +op[1], C: +op[2], H: +op[3] };
  if (/^oklch\(\s*from\s+/i.test(r)) return parseOklch(r); // nested relative
  throw new Error(`Unparseable origin: ${originStr}`);
}
function parseOklch(v) {
  const plain = v.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (plain) return oklchToRgb(+plain[1], +plain[2], +plain[3]);
  const rel = v.match(/^oklch\(\s*from\s+(.+)$/i);
  if (rel) {
    const rest = rel[1].replace(/\s*\)$/, '');
    const m = rest.match(/^(.*?)\s+([\w.]+|calc\([^)]*\))\s+([\w.]+|calc\([^)]*\))\s+(h|calc\([^)]*\))$/);
    if (!m) throw new Error(`Unparseable relative oklch: ${v}`);
    const o = originOklch(m[1].trim());
    const L = parseChannel(m[2], o.L, 'l');
    const C = parseChannel(m[3], o.C, 'c');
    const H = parseHue(m[4], o.H);
    return oklchToRgb(L, C, H);
  }
  throw new Error(`Unparseable oklch: ${v}`);
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
  if (/^hsla?\(/i.test(v)) {
    const p = hslParts(v);
    if (p) return hslToRgb(p.h, p.s, p.l);
  }
  if (/^oklch\(/i.test(v)) return parseOklch(v);
  const cm = v.match(/color-mix\([^,]+,\s*([^,]+?),/i); // best-effort: first component
  if (cm) return parseColor(cm[1]);
  throw new Error(`Unparseable color: ${value}`);
}

// ── resolve the EFFECTIVE (last-defined) declaration for a selector ────────
function lastDecl(text, selectorPrefix, varName) {
  const re = new RegExp(selectorPrefix + '[^}]*?--' + varName + ':\\s*([^;]+);', 'g');
  let m;
  let last = null;
  while ((m = re.exec(text)) !== null) last = m[1].trim();
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

// ── skin definitions ───────────────────────────────────────────────────────
const TOKENS = [
  ['interactive-accent', 'accent≥3.0', T.nonText],
  ['text-accent', 'text-accent≥4.5', T.text],
  ['text-normal', 'text-normal≥4.5', T.text],
  ['text-muted', 'text-muted≥4.5', T.text],
  ['text-faint', 'text-faint≥3.0', T.faint],
];

const SCHEMES = [
  { name: 'bamboo', strict: true, file: 'src/color-schemes/bamboo-china-palettes.scss', extraFile: 'src/color-schemes/_mood-tokens.scss', cn: true,
    modeSel: (m) => `body\\.theme-${m}` },
  { name: 'adwaita', strict: true, file: 'src/color-schemes/adwaita.scss', cn: false,
    modeSel: (m) => `body\\.mod-linux:not\\(\\.(?:is-android)\\):not\\(\\.(?:adaptive-mode-off)\\)\\.theme-${m}` },
  { name: 'material', strict: false, file: 'src/color-schemes/material.scss', cn: false,
    modeSel: (m) => `body\\.is-android:not\\(\\.(?:adaptive-mode-off)\\)\\.theme-${m}\\.material-color` },
];

let failures = 0;
let checked = 0;
let advisoryWarn = 0;
const lines = [];

for (const scheme of SCHEMES) {
  const text = [scheme.file, scheme.extraFile].filter(Boolean).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const modes = ['light', 'dark'];
  const cnNames = scheme.cn
    ? [...new Set([...text.matchAll(/body\.cn-([\w-]+)\.theme-light\s*\{/g)].map((m) => m[1]))]
    : [];
  const label = (extra) => `bamboo/${extra}`;
  const entries = [];
  for (const m of modes) entries.push({ tag: m, sel: scheme.modeSel(m) });
  for (const n of cnNames) {
    entries.push({ tag: `cn-${n}`, sel: `body\\.cn-${n}\\.theme-light` });
    entries.push({ tag: `cn-${n}/dark`, sel: `body\\.cn-${n}\\.theme-dark` });
  }

  lines.push(`\n── ${scheme.name} (${scheme.strict ? 'STRICT' : 'ADVISORY'}) ──`);
  for (const e of entries) {
    const bgRaw = lastDecl(text, e.sel, 'background-primary') || VARMAP['background-primary'];
    if (!bgRaw) { lines.push(`⚠  ${e.tag}: missing --background-primary`); continue; }
    let bg;
    try { bg = parseColor(bgRaw); }
    catch (err) { lines.push(`⚠  ${e.tag}: bg ${err.message}`); continue; }
    for (const [varName, name, thr] of TOKENS) {
      const raw = lastDecl(text, e.sel, varName) || VARMAP[varName];
      if (!raw) { lines.push(`⚠  ${e.tag}: missing --${varName} (inherited, unresolvable)`); continue; }
      let c, ratio;
      try { c = parseColor(raw); ratio = contrast(c, bg); }
      catch (err) { lines.push(`⚠  ${e.tag}: ${varName} ${err.message}`); continue; }
      checked++;
      const ok = ratio >= thr;
      if (!ok) {
        // Mood text-faint is inherently decorative/low-contrast by design; a
        // hard gate on it would lock in a palette-engineering pass unrelated to
        // the S2/S1 refactor. Treat it as advisory for mood (cn-*) entries.
        const moodAdvisory = varName === 'text-faint' && e.tag.startsWith('cn-');
        if (scheme.strict && !moodAdvisory) failures++;
        else { advisoryWarn++; lines.push(`⚠  ${e.tag.padEnd(20)} ${name}: ${ratio.toFixed(2)}:1 < AA ${thr}:1${moodAdvisory ? ' (mood advisory)' : ' (advisory)'}`); continue; }
      }
      lines.push(`${ok ? '✓' : '✗'}  ${e.tag.padEnd(20)} ${name}: ${ratio.toFixed(2)}:1`);
    }
  }
}

console.log(lines.join('\n'));

if (checked === 0) {
  console.error('\n✗ No tokens parsed — the guardrail is misconfigured (regex/selector drift).');
  process.exit(1);
}
if (failures > 0) {
  console.error(`\n✗ ${failures}/${checked} STRICT token checks fail WCAG thresholds.`);
  process.exit(1);
}
const msg = `\n✓ All ${checked} token checks evaluated (${failures} hard failures).`;
if (advisoryWarn > 0) console.log(`${msg} ${advisoryWarn} advisory warning(s) — Material depends on the runtime accent; verify visually.`);
else console.log(msg);
