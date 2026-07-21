#!/usr/bin/env node
// A11y / compatibility metrics + fallback gate for Bamboo China.
//
// Hard gate (exit 1 if violated):
//   Every `--background-*: color-mix(...)` declaration MUST be preceded, within
//   the same rule, by a static (non color-mix) declaration of the same variable.
//   This provides graceful degradation on old Electron/WebView builds where
//   `color-mix()` is unsupported: the static value wins, so sidebars/panels keep
//   a solid background instead of going transparent.
//
// Soft metrics (informational, printed for KPI tracking):
//   color-mix / :has() / @container usage, :focus-visible coverage,
//   prefers-contrast and prefers-reduced-motion presence.
import fs from 'node:fs';
import path from 'node:path';

const PALETTE_FILES = [
  'src/color-schemes/bamboo-china-palettes.scss',
  'src/color-schemes/bamboo-china.scss',
];

// ── 1) Background color-mix fallback gate ─────────────────────────────────
let fbFailures = 0;
const fbLines = [];
for (const PALETTES of PALETTE_FILES) {
  const text = fs.readFileSync(PALETTES, 'utf8');
  const blocks = text.split('}');
  for (const block of blocks) {
    const decls = [...block.matchAll(/--(background-[\w-]+)\s*:\s*([^;]+);/g)];
    const seen = {};
    for (const m of decls) {
      const name = m[1];
      const val = m[2].trim();
      (seen[name] ||= []).push({ val, isMix: /color-mix\(/i.test(val) });
    }
    for (const [name, arr] of Object.entries(seen)) {
      const last = arr[arr.length - 1];
      if (last.isMix) {
        const hasStaticBefore = arr.slice(0, -1).some((d) => !d.isMix);
        if (!hasStaticBefore) {
          fbFailures++;
          fbLines.push(`✗  ${PALETTES}: --${name} uses color-mix without a static fallback in the same rule`);
        }
      }
    }
  }
}

// ── 2) Aggregate metrics across src ──────────────────────────────────────
let has = 0, container = 0, mix = 0, focus = 0, prefContrast = 0, prefMotion = 0;
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.scss')) {
      const t = fs.readFileSync(p, 'utf8');
      has += (t.match(/:has\(/g) || []).length;
      container += (t.match(/@container/g) || []).length;
      mix += (t.match(/color-mix\(/g) || []).length;
      focus += (t.match(/focus-visible/g) || []).length;
      prefContrast += (t.match(/prefers-contrast/g) || []).length;
      prefMotion += (t.match(/prefers-reduced-motion/g) || []).length;
    }
  }
};
walk('src');

console.log('— A11y / compatibility metrics —');
console.log(`color-mix usages:        ${mix}`);
console.log(`:has() usages:           ${has}`);
console.log(`@container usages:       ${container}`);
console.log(`:focus-visible usages:   ${focus}`);
console.log(`prefers-contrast blocks: ${prefContrast}`);
console.log(`prefers-reduced-motion:  ${prefMotion}`);
console.log('— Background color-mix fallback gate —');
if (fbLines.length) console.log(fbLines.join('\n'));
else console.log('✓ All background color-mix tokens have a static fallback.');

if (fbFailures > 0) {
  console.error(`\n✗ ${fbFailures} background color-mix token(s) lack a static fallback (old Electron risk).`);
  process.exit(1);
}
if (prefContrast === 0) {
  console.error('\n✗ No @media (prefers-contrast) support — high-contrast users are unsupported.');
  process.exit(1);
}
console.log('\n✓ check-a11y passed (fallback gate + prefers-contrast present).');
