# Architecture

How this theme is put together: the (now single-skin) visual model, the token
layering, and where to make a change safely. Companion to
[`CASCADE-CONTRACT.md`](./CASCADE-CONTRACT.md) (which governs cross-layer overrides) and
the `scripts/check-*` guardrails (which enforce this doc at build time).

> **Status (3.x, 2026-07):** This theme has converged from a five-skin model to a
> **single skin — Bamboo China**. The former platform skins (Baseline / Material /
> Fluent / Adwaita) and their color palettes have been **removed** from `src/`.
> `theme.scss` now imports only the Bamboo China surface. Platform *nuance* still
> exists, but as a handful of `body.mod-macos` / `body:not(.mod-macos)` branches
> **inside** Bamboo China — not as separate skins. See §1.

## 1. Visual model — one skin, one bundle

Everything ships in a **single `theme.css`** compiled from `src/theme.scss`. There is
exactly one visual language: **Bamboo China** (Cupertino-derived), applied on every
platform by default.

### Platform nuance (not skins)
A small number of rules still differentiate by platform, all within the Bamboo China
surface:

| Branch | Selector | Purpose | Rough footprint in `theme.css` |
|--------|----------|---------|-------------------------------|
| **macOS / adaptive-off** | `body.mod-macos …`, and a few `body:is(.mod-macos, .adaptive-mode-off) …` | title-bar window controls, tab-header chrome, frameless layout — the Cupertino details | ~71 × `mod-macos`, ~10 × `adaptive-mode-off` |
| **non-macOS fallback** | `body:not(.mod-macos) …` | the cross-platform baseline chrome | — |
| **Android / Windows touch-ups** | `is-android` / `mod-windows` | 1–2 isolated tweaks each (not a skin) | 1 × `is-android`, 2 × `mod-windows` |

The `adaptive-mode-off` clause preserves the old semantics for the few rules that keep
it: **turning Adaptive Mode off forces the mac (Cupertino) appearance on every
platform**. Most branches now key on `mod-macos` directly.

> Historical note: earlier versions scoped the flagship layer via a shared mixin
> `mx.$bc = :is(.mod-macos, .adaptive-mode-off)`. That mixin has been retired; branches
> are now written inline. Some source comments still reference the old `mx.$bc` scope —
> treat them as historical.

### Layouts (orthogonal to the skin)
Three layouts under `layouts/`, selected by body class, independent of the visual skin:
`bamboo-china`, `macos` (legacy Cupertino artefact), `fusion`.

### Color schemes
Color lives entirely in Bamboo China:

- `color-schemes/bamboo-china.scss` — the default 宣纸竹青 palette (light + dark).
- `color-schemes/bamboo-china-palettes.scss` — the 16 `cn-*` 意境 moods. **Generated**
  from `mood-parity-baseline.json` by `scripts/gen-mood-tokens.mjs` together with
  `_mood-tokens.scss`; **do not hand-edit** either file — change the baseline JSON and
  rebuild. Mood palettes attach directly to `body` (no platform scope), so a mood looks
  identical on every OS.
- `color-schemes/accent-high-contrast.scss` — high-contrast accent overrides.

## 2. Token layering (specificity order)

1. **Global / scale tokens** — `src/app/root.scss`, on `body, .theme-light, .theme-dark`:
   radius & density modifiers, shadow scale, motion curves/durations, the unified
   `:focus-visible` ring, and `--radius-modifier` (the single canonical source — do not
   redefine it elsewhere).
2. **Base component styles** — `src/app/*.scss` + `src/editor/*.scss`: the full,
   all-platform chrome (~1342 rules — the bulk of the theme).
3. **Bamboo China surface refinements** — `src/elements/bamboo-china*.scss`
   (`-`, `-dialog`, `-settings`, `-prompt`, `-mobile`): shape, sizing, typography, and
   the `body.mod-macos` nuance branches. Imported **after** the base layer, so on macOS
   these win where they overlap.
4. **Color-scheme tokens** — `src/color-schemes/*.scss`: default palette + `cn-*` moods,
   all under the STRICT contrast guard.
5. **Layout tokens** — `src/layouts/*.scss`.

## 3. Where to make a change

```
Need to change…                      → edit
─────────────────────────────────────────────────────────────────────
universal scale / motion / focus     src/app/root.scss
all-platform component chrome         src/app/<component>.scss  or  src/editor/*
macOS-only shape / chrome            src/elements/bamboo-china*.scss (mod-macos branch)
default colour (宣纸竹青)             src/color-schemes/bamboo-china.scss
a 意境 mood value                     mood-parity-baseline.json  → then `npm run build`
layout / structure                    src/layouts/<layout>.scss
```

If a change "doesn't take effect", it is almost always a **cross-layer override**: a
later import (e.g. an `elements/bamboo-china*` refinement or a `body.mod-macos` branch)
re-declares the same property and wins. Read the output of
`node scripts/audit_cascade.mjs`.

## 4. Guardrails (run by `npm test`)

| Script | What it enforces |
|--------|------------------|
| `check-css.mjs` | `!important` baseline (10) + `color-mix` support fallback |
| `check-palette-contrast.mjs` | WCAG 1.4.3 / 1.4.11 on 5 key tokens vs canvas — **STRICT** for the default palette and every `cn-*` mood (light + dark) |
| `check-a11y.mjs` | `:focus-visible` coverage, reduced-motion, background `color-mix` fallback gate |
| `check-size.mjs` | `theme.css` bundle ≤ baseline × 1.15 (currently ~344 KB) |
| `audit_cascade.mjs` | cross-layer same-property override watchlist (base vs mac branch) |
| `verify_build.mjs` | asserts committed `theme.css` matches a fresh build — catches "edited scss, forgot to rebuild" |

> Legacy note: `check-palette-contrast.mjs` and `audit_cascade.mjs` still contain
> skin tables/regexes for the removed Material / Fluent / Adwaita / Baseline skins.
> With those skins gone, those branches simply parse **zero** rules — the guards
> effectively run against **bamboo + base** only. The stale skin lists are harmless but
> pending cleanup; the numbers that matter (`bamboo`/`base` rule counts, `cn-*`
> contrast) are accurate.

## 5. Build & the mood single-source

```
mood-parity-baseline.json
      │  scripts/gen-mood-tokens.mjs
      ▼
_mood-tokens.scss  +  (rewritten) bamboo-china-palettes.scss   ← generated, do not edit
      │  sass src/theme.scss  (compressed)
      ▼
theme.css
      │  scripts/verify-mood-parity.mjs   (96 mood rules match baseline token-for-token)
      ▼
shipped
```

`npm run build` runs all three steps. Adding or tuning a mood is a **data change** to
`mood-parity-baseline.json` followed by a rebuild — never a hand-edit of the generated
SCSS.

## 6. Visual regression (optional, browser required)

`scripts/visual-regression/` ships a Playwright harness over a static `fixture.html`
that mimics the Obsidian DOM. It is intentionally **not** part of `npm test` (which
stays browser-free for fast CI); wire it into a browser-enabled CI job when available.

```bash
npm i -D @playwright/test && npx playwright install chromium   # one-time
npm run test:visual
```
