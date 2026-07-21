#!/usr/bin/env node
// theme.css bundle-size guardrail.
//
// Every shipped skin (5 element skins × 4 layouts × 5 color schemes) is compiled
// into ONE theme.css and delivered to every user, even those who use a single skin.
// This script watches that single bundle so uncontrolled bloat is caught in CI:
//   - reads theme.css bytes
//   - compares against scripts/size-baseline.json
//   - fails if current > baseline * threshold (default 1.15 → +15%)
//
// To re-baseline after an intentional, reviewed size increase, run:
//   node scripts/check-size.mjs --update
//
// Usage: node scripts/check-size.mjs [--update] [--threshold=1.15]
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('.');
const cssPath = path.join(root, 'theme.css');
const basePath = path.join(root, 'scripts', 'size-baseline.json');

function arg(name, dflt) {
  const re = new RegExp(`--${name}=([\\d.]+)`);
  const m = process.argv.slice(2).find((a) => re.test(a));
  return m ? parseFloat(m.match(re)[1]) : dflt;
}
const update = process.argv.includes('--update');
const threshold = arg('threshold', 1.15);

if (!fs.existsSync(cssPath)) {
  console.error('✗ theme.css not found — run `npm run build` first.');
  process.exit(1);
}
const bytes = fs.statSync(cssPath).size;

if (!fs.existsSync(basePath)) {
  fs.writeFileSync(basePath, JSON.stringify({ bytes, threshold, updated: new Date().toISOString().slice(0, 10) }, null, 2) + '\n');
  console.log(`✓ size-baseline.json created at ${bytes} bytes (${(bytes / 1024).toFixed(1)} KB).`);
  process.exit(0);
}

const base = JSON.parse(fs.readFileSync(basePath, 'utf8'));
const limit = Math.round(base.bytes * threshold);
const kb = (n) => (n / 1024).toFixed(1) + ' KB';

if (update) {
  base.bytes = bytes;
  base.threshold = threshold;
  base.updated = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(basePath, JSON.stringify(base, null, 2) + '\n');
  console.log(`✓ baseline updated to ${bytes} bytes (${kb(bytes)}).`);
  process.exit(0);
}

console.log(`theme.css: ${bytes} bytes (${kb(bytes)})  | baseline: ${base.bytes} (${kb(base.bytes)})  | limit (+${Math.round((threshold - 1) * 100)}%): ${limit} (${kb(limit)})`);
if (bytes > limit) {
  console.error(`✗ theme.css grew ${(((bytes / base.bytes) - 1) * 100).toFixed(1)}% over baseline — exceeds +${Math.round((threshold - 1) * 100)}% guard. Review the diff or re-baseline with --update.`);
  process.exit(1);
}
console.log('✓ bundle size within guard.');
