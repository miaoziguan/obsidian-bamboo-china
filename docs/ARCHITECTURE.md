# Architecture

How this theme is put together: the skinning model, the token layering, and where to
make a change without breaking the other skins. Companion to
[`CASCADE-CONTRACT.md`](./CASCADE-CONTRACT.md) (which governs cross-layer overrides) and
the `scripts/check-*` guardrails (which enforce this doc at build time).

## 1. Skinning model — one bundle, switched by body class

All skins ship in a **single `theme.css`**. Selection is done at runtime by Obsidian body
classes, never by shipping separate files. There are two independent axes:

### Axis A — element skin (visual language)
| Skin | Activation selector | Source |
|------|--------------------|--------|
| **Baseline** (universal base) | `body { … }` | `elements/baseline.scss` |
| **Bamboo China** (flagship default) | default when no adaptive skin matches | `elements/bamboo-china.scss` |
| **Material** | `body.is-android:not(.adaptive-mode-off)` | `elements/material.scss` |
| **Fluent** | `body.mod-windows:not(.adaptive-mode-off)` | `elements/fluent.scss` |
| **Adwaita** | `body.mod-linux:not(.is-android):not(.adaptive-mode-off)` | `elements/adwaita.scss` |

The `:not(.adaptive-mode-off)` clause is the **adaptive-mode** switch:
- **Adaptive ON** (default): the platform picks the skin — Android→Material, Windows→Fluent,
  Linux→Adwaita, everything else→Bamboo China.
- **Adaptive OFF** (`.adaptive-mode-off`): every platform falls back to **Bamboo China**,
  because Material/Fluent/Adwaita all require `:not(.adaptive-mode-off)`.

### Axis B — layout (structure)
Four layouts (`bamboo-china`, `macos`, `classic`, `fusion`) under `layouts/`, selected by
body class, **orthogonal** to Axis A. A skin and a layout can be combined freely.

### Color schemes
Only Bamboo China, Material, and Adwaita ship their own color palettes
(`color-schemes/*.scss`). **Fluent and Baseline are pure-shape skins** — they redefine
**no color tokens** and inherit Bamboo China's palette. This is intentional, and it means
their contrast is already covered by the Bamboo China contrast guard.

## 2. Token layering (specificity order)

1. **Global / scale tokens** — `src/app/root.scss`, on `body, .theme-light, .theme-dark`:
   radius & density modifiers, shadow scale, motion curves/durations, the unified
   `:focus-visible` ring, and `--radius-modifier` (the single canonical source — do not
   redefine it per skin).
2. **Per-skin element tokens** — `src/elements/<skin>.scss`: shape, sizing, typography.
3. **Per-color-scheme tokens** — `src/color-schemes/<skin>.scss`: color tokens. Bamboo China
   additionally defines `cn-*` 意境 moods (one palette per mood), all under the same
   STRICT contrast guard.
4. **Per-layout tokens** — `src/layouts/*.scss`.

Rule of thumb: **a more specific skin scope beats the base layer**. So a token declared in
`elements/material.scss` wins over the same token in `baseline.scss` on Android. This is the
mechanism behind the cascade contract — see §4.

## 3. Where to make a change

```
Need to change…                      → edit
─────────────────────────────────────────────────────────────────────
universal scale / motion / focus     src/app/root.scss
a value for EVERY skin               baseline.scss  (it is body{})
Bamboo China-specific shape          elements/bamboo-china.scss
Material/Fluent/Adwaita shape only   elements/<skin>.scss
Bamboo/Material/Adwaita color        color-schemes/<skin>.scss
a new 意境 mood                       color-schemes/bamboo-china-palettes.scss
layout / structure                    layouts/<skin>.scss
```

If a change "doesn't take effect", it is almost always a **cross-layer override**: a skin
scope re-declares the same property and wins on that platform. Read the output of
`node scripts/audit_cascade.mjs` — it lists, per skin, every component+property that is
overridden in the skin layer vs the base layer.

## 4. Guardrails (run by `npm test`)

| Script | What it enforces | Scope |
|--------|------------------|-------|
| `check-css.mjs` | `!important` baseline (10) + `color-mix` support fallback | all |
| `check-palette-contrast.mjs` | WCAG 1.4.3 / 1.4.11 on 5 key tokens vs canvas | **bamboo (STRICT, incl. `cn-*`)**, **adwaita (STRICT)**, material (ADVISORY) |
| `check-a11y.mjs` | `:focus-visible` coverage, reduced-motion | all |
| `audit_cascade.mjs` | per-skin cross-layer override watchlist | bamboo / material / fluent / adwaita vs base |
| `check-size.mjs` | `theme.css` bundle ≤ baseline × 1.15 | all |

### Why Material is ADVISORY, not STRICT
Material's colors are derived from the **runtime** `--color-accent-hsl`
(`oklch(from hsl(var(--color-accent-hsl)) …)`), chosen per user — unknown at build time.
The guard approximates it with a default accent and reports Material as advisory (⚠) so a
static check can never falsely hard-fail on a user-dependent palette. Some Material tokens
also surface resolution artifacts under the global `var()` map and must be confirmed in a
real browser — which is exactly what the visual-regression harness (§5) is for.

### Fluent / Baseline need no contrast check
They inherit Bamboo China's palette (they define zero color tokens), so the STRICT Bamboo
China guard already protects them transitively.

## 5. Visual regression (optional, browser required)

`scripts/visual-regression/` ships a Playwright harness (`visual.spec.js`) over a static
fixture (`fixture.html`) that mimics the Obsidian DOM with real class names. Per skin it
captures a screenshot and diffs against a committed baseline. This is the only guard that
catches *rendering* breakage (cascade, z-index, layout) that the text-based guards above
cannot.

```bash
npm i -D @playwright/test && npx playwright install chromium   # one-time
npm run test:visual                                            # capture / diff per skin
```

It is intentionally **not** part of `npm test` (which must stay browser-free for fast CI);
wire it into a browser-enabled CI job when available.
