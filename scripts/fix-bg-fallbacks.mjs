#!/usr/bin/env node
// Idempotent generator: add a static fallback BEFORE every
//   --background-*: color-mix(in srgb, var(--background-primary), <white|black> N%)
// so pre-color-mix Electron/WebView builds keep a solid panel background instead
// of going transparent. The static value is the exact sRGB blend (color-mix in
// srgb interpolates in sRGB space), so modern browsers render identically and
// only the redundant static line is ignored.
//
// Scoped to panel background tokens whose base is --background-primary (the
// catastrophic-transparency risk). --background-modifier-border (base is
// --background-secondary) is intentionally left to Obsidian's default fallback.
import fs from 'node:fs';
const FILES = [
  'src/color-schemes/bamboo-china-palettes.scss',
  'src/color-schemes/bamboo-china.scss',
];
const hexToRgb = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
for (const F of FILES) {
  const lines = fs.readFileSync(F, 'utf8').split('\n');
  let cur = null;
  const out = [];
  for (const line of lines) {
    if (/^body[.{:][^}]*\{\s*$/.test(line)) cur = null; // new rule resets context
    const bgp = line.match(/--background-primary:\s*(#[0-9a-f]{3,6})/i);
    if (bgp) cur = hexToRgb(bgp[1]);
    const cm = line.match(/^\s*(--background-[\w-]+):\s*color-mix\(in srgb, var\(--background-primary\), (white|black) (\d+(?:\.\d+)?)%\);\s*$/);
    if (cm && cur) {
      const name = cm[1];
      const blend = cm[2] === 'white' ? 255 : 0;
      const p = parseFloat(cm[3]) / 100;
      const rgb = cur.map((c) => (1 - p) * c + p * blend);
      const prev = out[out.length - 1] || '';
      if (!prev.includes(`static fallback for ${name}`)) {
        out.push(`  ${name}: ${toHex(rgb)};  /* static fallback for ${name} (pre-color-mix browsers) */`);
      }
    }
    out.push(line);
  }
  fs.writeFileSync(F, out.join('\n'));
}
console.log('fix-bg-fallbacks: done');
