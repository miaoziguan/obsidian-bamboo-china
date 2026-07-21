#!/usr/bin/env node
// Phase 3 — emit an idempotent `@media (prefers-contrast: more)` block that
// boosts contrast for users who request it: darker metadata/muted text,
// stronger borders/dividers, and a thicker keyboard focus ring.
//
// Appended at the END of bamboo-china-palettes.scss (imported after
// bamboo-china.scss) so it wins the cascade over every cn-X scheme block, plus
// a matching base-cn block in bamboo-china.scss for the fallback `body.cn`.
import fs from 'node:fs';

const PAL = 'src/color-schemes/bamboo-china-palettes.scss';
const BASE = 'src/color-schemes/bamboo-china.scss';
const MARK = '/* Phase 3 prefers-contrast';

const LIGHT_BOOST = `    --text-faint: #595959;
    --text-muted: #595959;
    --background-modifier-border: #b3b3b3;
    --divider-color: #b3b3b3;
    --bc-focus-ring-width: 3px;`;
const DARK_BOOST = `    --text-faint: #a6a6a6;
    --text-muted: #c4c4c4;
    --background-modifier-border: #5c5c5c;
    --divider-color: #5c5c5c;
    --bc-focus-ring-width: 3px;`;

function strip(t) {
  const i = t.indexOf(MARK);
  return i >= 0 ? t.slice(0, i).replace(/\s+$/, '\n') : t;
}
const indent = (sels) => sels.map((s) => '  ' + s).join(',\n  ');

// ── palettes.scss: default + every cn-X ──────────────────────────────────
let pText = fs.readFileSync(PAL, 'utf8');
const cnNames = [...new Set([...pText.matchAll(/body\.cn-([\w-]+)\.theme-light\s*\{/g)].map((m) => m[1]))];
const lightSels = ['body.theme-light', ...cnNames.map((n) => `body.cn-${n}.theme-light`)];
const darkSels = ['body.theme-dark', ...cnNames.map((n) => `body.cn-${n}.theme-dark`)];
const palBlock = `\n${MARK} (palettes) — boost contrast for prefers-contrast: more. Appended ${new Date().toISOString().slice(0, 10)} */
@media (prefers-contrast: more) {
  ${indent(lightSels)} {
${LIGHT_BOOST}
  }
  ${indent(darkSels)} {
${DARK_BOOST}
  }
}
`;
fs.writeFileSync(PAL, strip(pText) + palBlock);

// ── bamboo-china.scss: fallback base cn ──────────────────────────────────
let bText = fs.readFileSync(BASE, 'utf8');
const baseBlock = `\n${MARK} (base cn) — boost contrast for prefers-contrast: more. Appended ${new Date().toISOString().slice(0, 10)} */
@media (prefers-contrast: more) {
  body#{mx.$bc}.theme-light {
${LIGHT_BOOST}
  }
  body#{mx.$bc}.theme-dark {
${DARK_BOOST}
  }
}
`;
fs.writeFileSync(BASE, strip(bText) + baseBlock);
console.log('fix-prefers-contrast: done');
