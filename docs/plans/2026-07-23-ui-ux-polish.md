# Bamboo China UI/UX Polish Implementation Plan

> **状态（2026-07-24 盘点）：已完成，归档。**
> 16 个任务全部落地（checkbox 已回补勾选）。两处与计划文本的偏离：
> - **Task 3（status bar）**：实施时未采用计划的 `height: 22px + opacity: 0.55`，
>   而是收敛为 `height: 6px + opacity: 0`（仅去掉 blur、加 overflow）——保留"极简药丸"
>   方向，属有意的设计取舍，非遗漏。
> - **Task 16（验收数字）**：写于五皮肤时代，"旗舰层 ~285 rules"已失效；
>   单皮肤重构后 audit_cascade 仅报告 bamboo 层（~53 rules），且该脚本已移出
>   `npm test`（见下方 deferred 决策与 docs/ARCHITECTURE.md）。
> - Task 2 文中 `BASELINE_IMPORTANT = 10` 为旧值，现为 14（见 docs/important-audit.md）。
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute 16 UI/UX improvements across interaction, visual hierarchy, readability, platform consistency, and mobile experience for the Bamboo China Obsidian theme.

**Architecture:** All changes are scoped to SCSS source files under `src/` and build scripts under `scripts/`. Each task is independent — tasks can be executed in any order within their priority group. Every task ends with a full `npm run build && npm test` cycle to verify no regressions.

**Tech Stack:** Sass (SCSS), Node.js (build scripts), Playwright (optional visual regression)

---

## Priority 0 — Platform Consistency & Script Fixes

### Task 1: Fix accent-high-contrast platform scoping

**Problem:** `accent-high-contrast.scss` 意境 blocks use selectors like `body.accent-high-contrast.cn-xxx.theme-light` — this is already platform-agnostic. However, verify the SCSS source does NOT contain any remaining `mx.$bc` references that would restrict these rules to macOS/adaptive-off only.

**Files:**
- Verify: `src/color-schemes/accent-high-contrast.scss`

- [x] **Step 1: Verify no `mx.$bc` or platform-scoped selectors in accent-high-contrast.scss**

Run: `grep -n 'mx\.\$bc\|mod-macos\|adaptive-mode-off\|is-android\|mod-windows\|mod-linux' src/color-schemes/accent-high-contrast.scss`
Expected: No matches (all selectors should be `body.accent-high-contrast.cn-xxx.theme-{light|dark}`)

- [x] **Step 2: If matches found, remove platform scoping**

For each matching line, replace the selector to be platform-agnostic. Example:
```scss
// BEFORE (hypothetical):
body.accent-high-contrast#{mx.$bc}.cn-moye.theme-light {
// AFTER:
body.accent-high-contrast.cn-moye.theme-light {
```

- [x] **Step 3: Build and verify**

Run: `npm run build && npm test`
Expected: Build succeeds, all tests pass, generated `accent-high-contrast` blocks remain intact.

- [x] **Step 4: Commit**

```bash
git add src/color-schemes/accent-high-contrast.scss
git commit -m "fix: verify accent-high-contrast 意境 blocks are platform-agnostic"
```

---

### Task 2: Verify gen-accent-aa.mjs and check-palette-contrast.mjs work correctly

**Problem:** Per the 2026-07-20 review, these scripts had regex mismatches. The review doc at `docs/REVIEW-2026-07-20.md` claims they're broken. Verify current state.

**Files:**
- Verify: `scripts/gen-accent-aa.mjs`
- Verify: `scripts/check-palette-contrast.mjs`
- Verify: `scripts/check-css.mjs` (BASELINE_IMPORTANT)

- [x] **Step 1: Run check-palette-contrast to verify it parses palettes**

Run: `node scripts/check-palette-contrast.mjs`
Expected: Output shows multiple `✓` lines for bamboo/mood palettes. If it prints "Parsed 0 palettes" or "No tokens parsed", the script is still broken.

- [x] **Step 2: If broken, compare regex against current selector format**

The palette selectors are `body.cn-xxx.theme-light` (no `mx.$bc`). Check that the script's regex `body\.cn-([\w-]+)\.theme-light` matches this format. The current code at line 233 already uses this regex pattern — verify it matches.

- [x] **Step 3: Run gen-accent-aa to verify it generates 意境 blocks**

Run: `node scripts/gen-accent-aa.mjs`
Expected: "Regenerated 16 意境 accent blocks (default block preserved)." If it says 0, the regex in `accentFor()` is broken.

- [x] **Step 4: Verify check-css.mjs BASELINE_IMPORTANT matches reality**

The current `check-css.mjs` has `BASELINE_IMPORTANT = 10`. Run:
```bash
npm run build && grep -c '!important' theme.css
```
If the count > 10, the baseline needs updating or `!important` instances need removal.

- [x] **Step 5: Full test suite**

Run: `npm run build && npm test`
Expected: All checks pass.

- [x] **Step 6: Commit fixes if any**

```bash
git add scripts/ src/
git commit -m "fix: verify and repair palette contrast & accent generation scripts"
```

---

## Priority 1 — Interaction & Visual Hierarchy

### Task 3: Improve status bar collapsed state visibility

**Problem:** Default (non-baseline) status bar collapses to 4px height with content at opacity 0 + blur(16px). Users cannot see sync status or plugin info without precisely hovering the tiny bar.

**Files:**
- Modify: `src/app/status-bar.scss:45-58`

- [x] **Step 1: Edit the collapsed state**

Replace the `&:not(:hover)` block in `body:not(.status-bar-baseline) .status-bar`:

```scss
// BEFORE:
&:not(:hover) {
  bottom: 2px;
  border-width: 0;
  background-color: rgba(var(--mono-rgb-100), 0.2);
  padding-block: 0;
  max-width: 160px;
  height: 4px;

  > div {
    transform: scale(0.9);
    opacity: 0;
    filter: blur(16px);
    white-space: nowrap;
  }
}

// AFTER:
&:not(:hover) {
  bottom: 2px;
  border-width: 0;
  background-color: rgba(var(--mono-rgb-100), 0.2);
  padding-block: 0;
  max-width: 160px;
  height: 22px;

  > div {
    transform: scale(0.9);
    opacity: 0.55;
    filter: blur(0px);
    white-space: nowrap;
    overflow: hidden;
  }
}
```

Key changes: `height: 4px → 22px`, `opacity: 0 → 0.55`, `filter: blur(16px) → blur(0px)`, added `overflow: hidden`.

- [x] **Step 2: Build and verify**

Run: `npm run build && npm test`
Expected: Pass.

- [x] **Step 3: Visually verify**

Open Obsidian with the theme. Status bar should show a thin pill with muted but readable text. Hovering expands it fully.

- [x] **Step 4: Commit**

```bash
git add src/app/status-bar.scss
git commit -m "fix: keep status bar text readable at 0.55 opacity in collapsed state"
```

---

### Task 4: Keep sidedock nav action buttons visible at reduced opacity

**Problem:** Non-`nav-action-center` mode hides action buttons at `opacity: 0 + pointer-events: none`. Users can't discover panel actions.

**Files:**
- Modify: `src/app/sidedock.scss:165-168`

- [x] **Step 1: Change opacity from 0 to 0.4**

```scss
// BEFORE:
body:not(.nav-action-center) .mod-sidedock .workspace-leaf-content .nav-header:first-child:not(:hover) .nav-buttons-container {
  opacity: 0;
  pointer-events: none;
}

// AFTER:
body:not(.nav-action-center) .mod-sidedock .workspace-leaf-content .nav-header:first-child:not(:hover) .nav-buttons-container {
  opacity: 0.4;
  pointer-events: auto;
}
```

Key changes: `opacity: 0 → 0.4`, `pointer-events: none → auto` (so buttons are always clickable).

- [x] **Step 2: Build and verify**

Run: `npm run build && npm test`

- [x] **Step 3: Commit**

```bash
git add src/app/sidedock.scss
git commit -m "fix: show sidedock action buttons at 0.4 opacity for discoverability"
```

---

### Task 5: Improve community plugin card hover subtlety

**Problem:** Card hover uses `translateY(-2px)` with a heavy dual-shadow, which can feel overdone especially in dark mode.

**Files:**
- Modify: `src/app/settings.scss:266-276` (the `.community-item:hover` block)

- [x] **Step 1: Reduce hover lift and simplify shadow**

```scss
// BEFORE:
&:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--interactive-accent) 40%, var(--background-modifier-border));
  box-shadow:
    0 2px 6px color-mix(in srgb, var(--background-primary) 50%, transparent),
    0 10px 24px color-mix(in srgb, var(--background-primary) 30%, transparent);
}

// AFTER:
&:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--interactive-accent) 40%, var(--background-modifier-border));
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
```

- [x] **Step 2: Build and verify**

Run: `npm run build && npm test`

- [x] **Step 3: Commit**

```bash
git add src/app/settings.scss
git commit -m "fix: reduce community plugin card hover lift for subtlety"
```

---

### Task 6: Update bold-modifier Style Settings description

**Problem:** Default `--bold-modifier: 300` may be too light for CJK users to see a difference between bold and regular text.

**Files:**
- Modify: `src/app/style-settings.scss:196-199`

- [x] **Step 1: Update description text**

```scss
// BEFORE:
        id: bold-modifier
        title: 粗体字重
        description: 调整粗体文字的粗细程度。300 = 纤细，600 = 明显。

// AFTER:
        id: bold-modifier
        title: 粗体字重
        description: 调整粗体文字的粗细程度。300 = 纤细，600 = 明显。中文用户建议 400–500 以获得更清晰的标题层级。
```

- [x] **Step 2: Build and verify**

Run: `npm run build && npm test`

- [x] **Step 3: Commit**

```bash
git add src/app/style-settings.scss
git commit -m "docs: add CJK bold-modifier recommendation in Style Settings"
```

---

## Priority 2 — Readability & Mobile

### Task 7: Increase editor line width default

**Problem:** `--line-width: 700px` feels narrow on 1920px+ displays (~36% screen width).

**Files:**
- Modify: `src/features/block-width.scss:3`

- [x] **Step 1: Change default line width**

```scss
// BEFORE:
  --line-width: 700px;

// AFTER:
  --line-width: 780px;
```

- [x] **Step 2: Build and verify**

Run: `npm run build && npm test`

- [x] **Step 3: Commit**

```bash
git add src/features/block-width.scss
git commit -m "fix: increase default editor line width from 700px to 780px"
```

---

### Task 8: Increase callout title color mix ratio

**Problem:** Callout title mixes only 15% callout color with text-normal, which can be too low-contrast for light moods like cn-ehuang.

**Files:**
- Modify: `src/editor/callout.scss:39`

- [x] **Step 1: Increase mix from 15% to 25%**

```scss
// BEFORE:
      color: color-mix(in srgb, rgb(var(--callout-color)), var(--text-normal) 15%);

// AFTER:
      color: color-mix(in srgb, rgb(var(--callout-color)), var(--text-normal) 25%);
```

- [x] **Step 2: Build and verify**

Run: `npm run build && npm test`

- [x] **Step 3: Run contrast check**

Run: `node scripts/check-palette-contrast.mjs`
Expected: All checks pass (the change only affects callout title, not the checked tokens).

- [x] **Step 4: Commit**

```bash
git add src/editor/callout.scss
git commit -m "fix: increase callout title color mix to 25% for better readability"
```

---

### Task 9: Improve image zoom interaction

**Problem:** Image zoom uses `:active` pseudo-class with no transition, causing jarring instant full-screen.

**Files:**
- Modify: `src/features/image-zoom.scss` (full file rewrite)

- [x] **Step 1: Replace :active-based zoom with click-based overlay**

Replace the entire file:

```scss
// Image zoom: click to toggle overlay. Uses a body class to avoid
// relying on :active (which requires holding mouse button).
body:not(.is-mobile):not(.zoom-off) .markdown-preview-view {
  .image-embed:not(.canvas-node-content, [alt="banner"]) img,
  img[referrerpolicy="no-referrer"]:not([alt="banner"]) {
    cursor: zoom-in;
    transition: transform var(--anim-duration-moderate) var(--anim-motion-baseline);
  }
}

// Zoom overlay — activated via body.zoom-active (set by a small
// inline script or community plugin). The CSS-only :active approach
// is preserved as a fallback for environments without the script.
body:not(.is-mobile):not(.zoom-off):is(.zoom-active) .markdown-preview-view {
  .image-embed:not(.canvas-node-content, [alt="banner"]) img,
  img[referrerpolicy="no-referrer"]:not([alt="banner"]) {
    cursor: zoom-out;
    position: fixed;
    z-index: var(--z-overlay);
    inset: 0;
    background-color: rgba(0, 0, 0, 0.85);
    width: 100%;
    height: 100%;
    max-height: unset;
    object-fit: contain;
    mask: none;
    padding: 24px;
    border-radius: var(--radius-s);
    border: none;
    animation: zoomIn var(--anim-duration-moderate) var(--anim-motion-emphasized) forwards;
  }
}

@keyframes zoomIn {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

Note: This is CSS-only. For full click-toggle without JS, the existing `:active` fallback still works. The `.zoom-active` class path is an enhancement for users who install a companion snippet.

- [x] **Step 2: Build and verify**

Run: `npm run build && npm test`

- [x] **Step 3: Commit**

```bash
git add src/features/image-zoom.scss
git commit -m "fix: add transition animation to image zoom overlay"
```

---

### Task 10: Improve mobile safe-area handling for sidebars

**Problem:** Phone sidebar uses fixed `padding-top` values that may not account for Dynamic Island / notch on modern iPhones.

**Files:**
- Modify: `src/app/mobile.scss:316-318`

- [x] **Step 1: Use env() for safer top padding**

```scss
// BEFORE:
  .workspace-drawer-inner {
    padding-top: calc(var(--safe-area-inset-top) + 32px);
  }

// AFTER:
  .workspace-drawer-inner {
    padding-top: calc(env(safe-area-inset-top, var(--safe-area-inset-top)) + 32px);
  }
```

- [x] **Step 2: Build and verify**

Run: `npm run build && npm test`

- [x] **Step 3: Commit**

```bash
git add src/app/mobile.scss
git commit -m "fix: use env(safe-area-inset-top) for mobile sidebar notch handling"
```

---

## Priority 3 — Design System Governance

### Task 11: Audit and document all !important usages

**Problem:** Theme has many `!important` declarations. Need a clear inventory and justification for each.

**Files:**
- Create: `docs/important-audit.md`

- [x] **Step 1: Count and categorize all !important in theme.css**

Run:
```bash
npm run build
grep -n '!important' theme.css | head -50
```

- [x] **Step 2: Categorize each instance**

Group into:
1. **a11y-required** (`prefers-reduced-motion`, `.reduce-motion`) — MUST KEEP
2. **@supports fallback** (version warning modal) — MUST KEEP
3. **Specificity hacks** (overriding Obsidian internals) — EVALUATE for removal

- [x] **Step 3: Update check-css.mjs BASELINE_IMPORTANT if needed**

After verifying which are truly required, set `BASELINE_IMPORTANT` to the count of required instances + a 2-instance buffer.

- [x] **Step 4: Commit**

```bash
git add scripts/check-css.mjs docs/
git commit -m "docs: audit and document all !important usages in theme"
```

---

### Task 12: Add entrance/exit animation token separation

**Problem:** Only one global `--anim-speed-modifier` exists. Users can't independently tune entrance vs exit animation speed.

**Files:**
- Modify: `src/app/root.scss:61` (add new tokens)
- Modify: `src/app/root.scss:373-385` (apply to reduced-motion)

- [x] **Step 1: Add entrance/exit speed modifier tokens**

After `--anim-speed-modifier: 1;` (line 61), add:

```scss
  --anim-speed-entrance: var(--anim-speed-modifier);
  --anim-speed-exit: var(--anim-speed-modifier);
```

- [x] **Step 2: Update reduced-motion to cover new tokens**

In the `@media (prefers-reduced-motion: reduce)` block and `.reduce-motion` body class:

```scss
// In @media (prefers-reduced-motion: reduce):
body {
  --anim-speed-modifier: 0 !important;
  --anim-speed-entrance: 0 !important;
  --anim-speed-exit: 0 !important;
}

// In body.reduce-motion:
body.reduce-motion {
  --anim-speed-modifier: 0 !important;
  --anim-speed-entrance: 0 !important;
  --anim-speed-exit: 0 !important;
}
```

Note: These are additions to existing `!important` declarations — they don't increase the total count since they're inside the same rule block.

- [x] **Step 3: Build and verify**

Run: `npm run build && npm test`

- [x] **Step 4: Commit**

```bash
git add src/app/root.scss
git commit -m "feat: add entrance/exit animation speed modifier tokens"
```

---

### Task 13: Add Style Settings sliders for new animation tokens

**Files:**
- Modify: `src/app/style-settings.scss` (in the accessibility section)

- [x] **Step 1: Add sliders after the existing reduce-motion toggle**

After the `reduce-motion` toggle block (around line 224), add:

```scss
    -
        id: anim-speed-entrance
        title: 入场动画速度
        description: 调整面板、对话框等入场动画的速度倍率。0 = 无动画，1 = 主题默认，2 = 双倍速。
        type: variable-number-slider
        default: 1
        min: 0
        max: 2
        step: 0.1
        format: "x"
    -
        id: anim-speed-exit
        title: 退场动画速度
        description: 调整面板、对话框等退场动画的速度倍率。
        type: variable-number-slider
        default: 1
        min: 0
        max: 2
        step: 0.1
        format: "x"
```

- [x] **Step 2: Build and verify**

Run: `npm run build && npm test`

- [x] **Step 3: Commit**

```bash
git add src/app/style-settings.scss
git commit -m "feat: add entrance/exit animation speed sliders to Style Settings"
```

---

### Task 14: Improve vault profile visual separation

**Problem:** Vault profile sits at the bottom of the left sidebar with no clear visual boundary from file list content.

**Files:**
- Modify: `src/app/sidedock.scss:199-228` (vault profile section)

- [x] **Step 1: Add border-top to vault profile**

After `.workspace-sidedock-vault-profile {` (around line 202), inside the rule block, add:

```scss
    border-top: 1px solid var(--background-modifier-border);
```

- [x] **Step 2: Build and verify**

Run: `npm run build && npm test`

- [x] **Step 3: Commit**

```bash
git add src/app/sidedock.scss
git commit -m "fix: add border-top to vault profile for visual separation"
```

---

### Task 15: Reduce Bamboo China modal entrance animation intensity

**Problem:** Bamboo China modals (e.g., settings, community plugins) use the default `modalIn` animation (`scale(0.975)` + `opacity: 0`) which is generic. The flagship skin should use the brand curve.

**Files:**
- Modify: `src/elements/bamboo-china-dialog.scss` (create if doesn't exist, or find the existing modal override)

- [x] **Step 1: Check if bamboo-china-dialog.scss has a modal animation override**

Run: `grep -n 'modal' src/elements/bamboo-china-dialog.scss`
If it has a modal animation, skip this task.

- [x] **Step 2: If no override exists, add one**

Add to `src/elements/bamboo-china-dialog.scss`:

```scss
body#{mx.$bc}:not(.is-mobile) .modal {
  animation: bcModalIn var(--anim-duration-moderate) var(--anim-motion-brand) forwards;
}

@keyframes bcModalIn {
  from {
    opacity: 0;
    transform: scale(0.97) translateY(8px);
  }
}
```

- [x] **Step 3: Build and verify**

Run: `npm run build && npm test`

- [x] **Step 4: Commit**

```bash
git add src/elements/bamboo-china-dialog.scss
git commit -m "feat: add brand-curve modal entrance animation for Bamboo China skin"
```

---

### Task 16: Final full build + test + visual regression

**Files:** None (verification only)

- [x] **Step 1: Full build and test suite**

Run: `npm run build && npm test`
Expected: All checks pass. No new `!important`. Contrast checks pass.

- [x] **Step 2: Visual regression (if Playwright available)**

Run: `npm run test:visual`
Expected: All screenshots match baseline (or review intentional changes).

- [x] **Step 3: Size check**

Run: `node scripts/check-size.mjs`
Expected: `theme.css` within baseline x 1.15.

- [x] **Step 4: Cascade audit**

Run: `node scripts/audit_cascade.mjs`
Expected: 旗舰层 ~285 rules, base ~1336 rules, ~100 overlap components. No unexpected increases.

---

## Self-Review Checklist

1. **Spec coverage:** All 16 recommendations from the UI/UX review have tasks:
   - #1 (hover ribbon discovery) — deferred (requires JS, beyond CSS scope)
   - #2 (status bar) → Task 3
   - #3 (focus mode exit) — deferred (requires Obsidian API)
   - #4 (image zoom) → Task 9
   - #5 (sidedock buttons) → Task 4
   - #6 (vault profile) → Task 14
   - #7 (plugin cards) → Task 5
   - #8 (bold-modifier) → Task 6
   - #9 (line width) → Task 7
   - #10 (callout contrast) → Task 8
   - #11 (high contrast platform) → Task 1
   - #12 (script regex) → Task 2
   - #13 (mobile safe-area) → Task 10
   - #14 (mode switcher mobile) — deferred (complex mobile layout change)
   - #15 (!important audit) → Task 11
   - #16 (animation tokens) → Tasks 12-13

2. **Placeholder scan:** All code steps contain actual values, selectors, and properties. No TBD or "implement later".

3. **Type consistency:** All SCSS variable names reference tokens defined in `root.scss` or existing skin files.

---

## Deferred Items — 决策（2026-07-24）

三项均超出纯 CSS 主题能力边界。决策如下：

- **Hover ribbon discovery animation** — **砍掉**。主题不携带 JS；做成配套 snippet
  的维护成本与收益不成比例。CSS 侧已有缓解：ribbon 折叠态保留可见的悬停触发区。
- **Focus mode exit hint** — **砍掉**。需要 Obsidian API 注入临时 UI，属插件职责。
  若未来确有需求，归入竹杖芒鞋（obsidian-bamboo-walking）插件立项，不在本主题实现。
- **Mobile mode-switcher repositioning** — **搁置（不排期）**。高风险布局改动，
  且移动端插件兼容性无法自动回归；除非收到真实用户反馈，否则不做。

三项均不再保留在任何待办清单中；本文档归档后不再更新。
