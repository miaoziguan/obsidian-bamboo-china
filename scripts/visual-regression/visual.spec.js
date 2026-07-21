// Visual-regression harness (optional — requires a browser).
//
// Renders scripts/visual-regression/fixture.html (a static Obsidian-like DOM using
// real class names) for every shipped skin + theme mode, and diffs a full-page
// screenshot against a committed baseline. This is the ONLY guard that catches
// *rendering* regressions (cascade, z-index, layout) that the text-based
// `npm test` guards cannot.
//
// First run captures baselines; subsequent runs fail on pixel diff.
//   npx playwright test --update-snapshots   # (re)capture after an intended change
//
// Run:  npm run test:visual   (after `npm i -D @playwright/test && npx playwright install chromium`)
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const fixture = 'file://' + path.resolve(__dir, 'fixture.html');

// Each skin is activated by the same body class the real theme keys off of.
const SKINS = [
  { name: 'bamboo', bodyClass: 'mod-macos' },        // flagship default (mac layout)
  { name: 'material', bodyClass: 'is-android' },
  { name: 'fluent', bodyClass: 'mod-windows' },
  { name: 'adwaita', bodyClass: 'mod-linux' },
  { name: 'baseline', bodyClass: '' },               // universal base, no extra class
];
const MODES = [
  { name: 'light', themeClass: 'theme-light' },
  { name: 'dark', themeClass: 'theme-dark' },
];

for (const skin of SKINS) {
  for (const mode of MODES) {
    test(`visual: ${skin.name} / ${mode.name}`, async ({ page }) => {
      await page.goto(fixture);
      await page.evaluate(({ skinClass, themeClass }) => {
        if (skinClass) document.body.classList.add(skinClass);
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(themeClass);
      }, { skinClass: skin.bodyClass, themeClass: mode.themeClass });
      // let fonts/transitions settle
      await page.waitForTimeout(200);
      await expect(page).toHaveScreenshot(`${skin.name}-${mode.name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.02,
      });
    });
  }
}
