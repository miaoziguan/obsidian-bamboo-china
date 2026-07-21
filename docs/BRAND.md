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

## Relationship to platform skins

Bamboo China is the **default**. The platform skins (Material, Fluent, Adwaita) are
deferential — they override shape, density, and font, but they **do not own colour**:

| Skin | Owns | Inherits from Bamboo China |
|------|------|---------------------------|
| Material | Shape, density, font-family, component sizing | **All colour tokens** (routed through `var(--mood-accent, …)` since S1) |
| Fluent | Shape, font-family | **All colour tokens** |
| Adwaita | Shape, font-family, some component layout | **All colour tokens** (with `var(--mood-accent, …)` since S1) |
| Baseline | (universal base layer) | Brings its own shape tokens; colour wholly from Bamboo China |

When **Adaptive Mode** is ON (default), the platform skin picks the shape, and the
selected 意境 mood picks the colour. When Adaptive Mode is OFF, both shape and colour
fall back to Bamboo China — the full brand experience.

## Tone of voice (for UX copy)

- **Calm, not clinical.** Use natural-sounding Chinese/English, not robotic "please select an option".
- **Seasonal, not arbitrary.** Mood names are poetic but grounded（墨夜 = ink night，胭脂 = rouge）. A new mood must earn its name.
- **Respectful of platform.** On macOS the UI speaks mac-ish; on Android it speaks Material-ish. Bamboo China wraps them, never fights them.

## What this theme is NOT

- **Not a "dark mode only" theme.** The default is light (宣纸/base). Dark is a mode, not the personality.
- **Not a "Chinese only" theme.** The 东方意境 system is the heritage, but the theme works equally well in English, Japanese, Korean, and any other script.
- **Not a "one-off" theme.** The architecture (5 skins × 16 moods × 2 modes × 4 layouts) is designed for sustainable contribution — the single-source `$moods` map added in S2 means adding a new mood is a data change, not a code change.
