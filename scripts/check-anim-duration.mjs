#!/usr/bin/env node
// Animation-duration guardrail for Bamboo China.
//
// Fluidity goal: animations should feel snappy, not laggy. We cap the longest
// single transition/animation duration so a future edit can't silently
// introduce a multi-second ease that makes the UI feel stuck.
//
// Scans every .scss source for `transition:` / `transition: ... <time>` and
// `animation:` / `animation: ... <time>` declarations, parses the duration
// token(s) (e.g. 320ms, 0.48s, var(--anim-duration-slow)), and flags any
// *literal* duration above ANIM_MAX_MS. var() references are skipped (their
// real value lives in root.scss tokens, already bounded by --anim-duration-*).
//
// Hard gate: any literal duration > ANIM_MAX_MS fails the build.

import fs from 'node:fs';
import path from 'node:path';

const ANIM_MAX_MS = 600;

const walk = (d, out = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.codebuddy')) continue;
      walk(p, out);
    } else if (e.name.endsWith('.scss')) {
      out.push(p);
    }
  }
  return out;
};

// Pull every duration token that appears inside a transition/animation
// shorthand. Matches `320ms`, `0.48s`, `calc(80ms * var(...))` (takes the 80ms),
// but NOT `var(--anim-duration-slow)` (skipped — tokenised, bounded elsewhere).
function durationsIn(decl) {
  const found = [];
  // literal <number>ms or <number>s
  for (const m of decl.matchAll(/(-?\d*\.?\d+)(ms|s)\b/gi)) {
    const v = parseFloat(m[1]);
    const ms = m[2].toLowerCase() === 's' ? v * 1000 : v;
    found.push(ms);
  }
  // calc(<number>ms * ...) — take the literal factor
  for (const m of decl.matchAll(/calc\(\s*(-?\d*\.?\d+)ms/gi)) {
    found.push(parseFloat(m[1]));
  }
  return found;
}

const files = walk('src');
let failures = 0;
const lines = [];

for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  // Only inspect transition / animation property declarations.
  for (const m of text.matchAll(/(transition|animation)\s*:\s*([^;{}]+);/gi)) {
    const prop = m[1].toLowerCase();
    const decl = m[2].trim();
    if (/\bvar\(/.test(decl) && !/-?\d*\.?\d+(ms|s)\b/i.test(decl) && !/calc\(/.test(decl)) {
      // pure var() reference — value bounded by token, skip
      continue;
    }
    for (const ms of durationsIn(decl)) {
      if (ms > ANIM_MAX_MS) {
        failures++;
        lines.push(`✗  ${f}: ${prop} 含 ${ms}ms（> ${ANIM_MAX_MS}ms 上限）— ${decl}`);
      }
    }
  }
}

console.log('— Animation duration guard —');
if (lines.length) console.log(lines.join('\n'));
else console.log(`✓ 所有 transition/animation 字面时长 ≤ ${ANIM_MAX_MS}ms。`);

if (failures > 0) {
  console.error(`\n✗ ${failures} 处动画时长超过 ${ANIM_MAX_MS}ms，会让界面显得卡顿。请缩短或改用 --anim-duration-* token。`);
  process.exit(1);
}
console.log('\n✓ check-anim-duration passed.');
