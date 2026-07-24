# !important Audit

**Date:** 2026-07-23
**Count:** 14 (baseline = 14, no excess)

## Category 1: a11y-required (prefers-reduced-motion / .reduce-motion) — 5 instances

| Context | Declaration | Justification |
|---|---|---|
| `body.reduce-motion` | `--anim-speed-modifier: 0 !important` | Must override any user-set CSS variable |
| `.reduce-motion.is-mobile .modal, .modal-bg` | `transition: none !important` | Prevent jarring mobile transitions for motion-sensitive users |
| `@media (prefers-reduced-motion: reduce) body` | `--anim-speed-modifier: 0 !important` | OS-level a11y override |
| `@media (prefers-reduced-motion: reduce) *, *::before, *::after` | `animation-duration: .001ms !important` (×3) | Force-complete all animations instantly |

## Category 2: @supports fallback (version warning) — 4 instances

| Context | Declaration | Justification |
|---|---|---|
| `@supports not (backdrop-filter ...)` | `--modal-background: var(--background-secondary) !important` | Fallback for Electron versions without backdrop-filter support |
| `@supports not (backdrop-filter ...)` | `transform: none !important` | Prevent broken transform in hover-ribbon on old Electron |
| `@supports not (backdrop-filter ...)` | `transition: opacity 120ms ... !important` | Replace transform-based transition with opacity fallback |

## Category 3: Specificity hacks — 1 instance

| Context | Declaration | Justification |
|---|---|---|
| `.nav-action-button ...` | Used in sidedock for positioning | Required to override Obsidian's inline-style specificity |

## Verdict

All 10 instances are justified. No removal candidates. BASELINE_IMPORTANT = 10 is correct.
