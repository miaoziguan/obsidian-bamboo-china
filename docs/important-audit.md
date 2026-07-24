# !important Audit

**Date:** 2026-07-24
**Count:** 14 (baseline `BASELINE_IMPORTANT = 14` in `scripts/check-css.mjs`, no excess)

Every instance lives in source (12 in `src/app/root.scss`, 2 in
`src/features/hover-ribbon.scss`) and compiles 1:1 into `theme.css`.

## Category 1: a11y — `.reduce-motion` class toggle (Style Settings) — 4 instances

| Location | Declaration | Justification |
|---|---|---|
| `root.scss` `body.reduce-motion` | `--anim-speed-modifier: 0 !important` | Must beat any user-set CSS variable so all derived durations collapse |
| `root.scss` `body.reduce-motion` | `--anim-speed-entrance: 0 !important` | Same — entrance durations derive from this token |
| `root.scss` `body.reduce-motion` | `--anim-speed-exit: 0 !important` | Same — exit durations derive from this token |
| `root.scss` `.reduce-motion.is-mobile` (tab-switcher/menu/suggestion/modal) | `transition: none !important` | Kill hardcoded mobile transitions for motion-sensitive users |

## Category 2: a11y — OS-level `prefers-reduced-motion` — 9 instances

| Location | Declaration | Justification |
|---|---|---|
| `root.scss` `@media (prefers-reduced-motion) body` | `--anim-speed-modifier: 0 !important` | OS-level override, same rationale as Category 1 |
| `root.scss` same block | `--anim-speed-entrance: 0 !important` | Same |
| `root.scss` same block | `--anim-speed-exit: 0 !important` | Same |
| `root.scss` `*, *::before, *::after` | `animation-duration: 0.001ms !important` | Force-complete any animation not built on the tokens |
| `root.scss` same block | `animation-iteration-count: 1 !important` | Stop infinite/looping animations |
| `root.scss` same block | `transition-duration: 0.001ms !important` | Catch hardcoded transitions |
| `root.scss` same block | `scroll-behavior: auto !important` | Disable smooth scrolling |
| `hover-ribbon.scss` `.workspace-ribbon.mod-left(:hover)` | `transform: none !important` | Drop the slide-in motion; ribbon must not translate under reduced motion |
| `hover-ribbon.scss` same block | `transition: opacity 120ms ... !important` | Replace transform-based reveal with a plain crossfade |

## Category 3: `@supports` fallback — version warning — 1 instance

| Location | Declaration | Justification |
|---|---|---|
| `root.scss` `@supports not (interpolate-size: allow-keywords)` | `--modal-background: var(--background-secondary) !important` | On old installers force modals opaque; `!important` beats Obsidian's own `--modal-background` without specificity stacking |

## Verdict

All 14 instances are justified (13 accessibility, 1 old-installer fallback).
No removal candidates. `BASELINE_IMPORTANT = 14` is correct.

> History: an earlier revision of this file counted 10 and cited a
> backdrop-filter `@supports` block plus a `.nav-action-button` specificity
> hack — both are gone from the codebase; the hover-ribbon pair moved under
> `prefers-reduced-motion`. This revision re-enumerates from source.
