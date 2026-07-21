import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  snapshotDir: './baselines',
  timeout: 30000,
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02 } },
  use: {
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  },
});
