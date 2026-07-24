// Visual-regression harness (optional — requires a browser).
//
// Renders scripts/visual-regression/fixture.html (a static Obsidian-like DOM using
// real class names) for the single shipped skin (Bamboo China) in every
// platform-variant + theme mode, and diffs a full-page screenshot against a
// committed baseline. This is the ONLY guard that catches *rendering*
// regressions (cascade, z-index, layout) that the text-based `npm test`
// guards cannot.
//
// Baselines are platform-suffixed by Playwright (e.g. `-darwin.png`), so they
// are only comparable on the OS that captured them. Current policy
// (2026-07-24): run locally on macOS before releases; NOT wired into CI until
// a remote exists and linux baselines can be captured by the CI runner itself.
//
// First run captures baselines; subsequent runs fail on pixel diff.
//   npx playwright test --config scripts/visual-regression/playwright.config.mjs --update-snapshots
//
// Run:  npm run test:visual   (after `npm i -D @playwright/test && npx playwright install chromium`)
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const fixture = 'file://' + path.resolve(__dir, 'fixture.html');

// Single skin (Bamboo China). The only remaining platform differences are the
// small `.mod-macos` branches inside the skin, so we exercise both sides.
const VARIANTS = [
  { name: 'mac', bodyClass: 'mod-macos' },   // mac layout branches active
  { name: 'nonmac', bodyClass: '' },         // universal rendering, no mac branches
];
const MODES = [
  { name: 'light', themeClass: 'theme-light' },
  { name: 'dark', themeClass: 'theme-dark' },
];

for (const variant of VARIANTS) {
  for (const mode of MODES) {
    test(`visual: bamboo-${variant.name} / ${mode.name}`, async ({ page }) => {
      await page.goto(fixture);
      await page.evaluate(({ bodyClass, themeClass }) => {
        // fixture.html ships with `theme-light mod-macos`; normalize first.
        document.body.classList.remove('theme-light', 'theme-dark', 'mod-macos');
        if (bodyClass) document.body.classList.add(bodyClass);
        document.body.classList.add(themeClass);
      }, { bodyClass: variant.bodyClass, themeClass: mode.themeClass });
      // let fonts/transitions settle
      await page.waitForTimeout(200);
      await expect(page).toHaveScreenshot(`bamboo-${variant.name}-${mode.name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.02,
      });
    });
  }
}
