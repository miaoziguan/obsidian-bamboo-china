# Brand

## Name

**Bamboo China（竹林中国）**

The theme's public identity — visible in the Obsidian Community Theme gallery, the
Style Settings panel, and the manifest.

> *Historical note:* The repository was originally named `obsidian-cupertino`,
> reflecting the theme's earliest roots in Apple's Human Interface Guidelines.
> The name survived in the repo URL (`github.com/.../obsidian-cupertino`), the
> local checkout folder (`obsidian-cupertino-main`), and the `macos` layout.
> Those are legacy artefacts; the public-facing identity is and has been
> **Bamboo China** since v3.x.

## Design DNA

Three pillars that make Bamboo China recognisable:

| Pillar | Expresses as |
|--------|-------------|
| **竹影 · 宣纸竹青** | Default palette — white paper + bamboo-green accents. The origin point. |
| **16 东方意境 moods** | A library of named seasonal palettes（墨夜、胭脂、青绿…）accessible via Style Settings. Each mood carries a distinct emotional register while sharing the same structural skeleton. |
| **白纸为心、黛青为框** | Spacial philosophy — the editor canvas stays pure white (the "paper"), while sidebars and panels carry the mood's tint (the "frame"). |

## Visual narrative

Bamboo China speaks in **ink and paper**.

- **Motion**: modelled after "卷轴舒展" (unrolling a scroll) — gentle overshoot, deliberate pacing, never rushed. The brand curve `cubic-bezier(0.34, 1.56, 0.64, 1)` encodes this in a single token.
- **Typography**: `SF Pro` on Apple, falling back through `PingFang SC` / `Hiragino Sans GB` / `Microsoft YaHei` — a font stack that prioritises CJK readability without losing Latin refinement.
- **Radius / density**: modest rounding (radius-modifier at `1`, density at `1`), keeping the UI crisp but not cold — the same restraint as a well-cut brush.

## Relationship to platform nuance

Bamboo China is now the **only** skin, on every platform. The former platform skins
(Material, Fluent, Adwaita, Baseline) have been **removed** — see
[`ARCHITECTURE.md`](./ARCHITECTURE.md) §1. What remains is a small set of
**platform nuance** branches *inside* Bamboo China:

- On **macOS** (or when **Adaptive Mode is OFF** on any platform), Bamboo China shows
  its Cupertino details — traffic-light window controls, tab-header chrome, frameless
  layout.
- On other platforms, the same Bamboo China surface uses a neutral cross-platform
  chrome. Colour never changes by platform — the selected 意境 mood owns colour
  everywhere.

In short: **shape has a tiny mac ↔ non-mac split; colour is 100% mood-driven and
platform-agnostic.**

## Tone of voice (for UX copy)

- **Calm, not clinical.** Use natural-sounding Chinese/English, not robotic "please select an option".
- **Seasonal, not arbitrary.** Mood names are poetic but grounded（墨夜 = ink night，胭脂 = rouge）. A new mood must earn its name.
- **Respectful of platform.** On macOS the UI leans into Cupertino details; elsewhere it stays neutral. Bamboo China adapts its chrome without changing its voice.

## What this theme is NOT

- **Not a "dark mode only" theme.** The default is light (宣纸/base). Dark is a mode, not the personality.
- **Not a "Chinese only" theme.** The 东方意境 system is the heritage, but the theme works equally well in English, Japanese, Korean, and any other script.
- **Not a "one-off" theme.** The architecture (16 moods × 2 modes × 3 layouts, one skin) is designed for sustainable contribution — the single-source mood baseline (`mood-parity-baseline.json`) means adding a new mood is a data change, not a code change.
