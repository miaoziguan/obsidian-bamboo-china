# Motion Design System

Date: 2026-07-22
Status: 已盘点归档（2026-07-24）。Roadmap 处置如下；§1.2/§3 的
Material/Fluent/Adwaita/Baseline 内容因单皮肤重构失效，仅存历史参考。

> **Roadmap 处置（2026-07-24）**
> - P1 `--anim-motion-brand` ✅ 已落地（`root.scss:72`），并已用于
>   `modalInBambooChina`（`bamboo-china-dialog.scss`）。
> - P1 mood-switch crossfade ✅ 已落地（`root.scss` body 的
>   background-color/color transition，走 brand 曲线）。
> - P2 硬编码 200ms/220ms → **决策：保留，关闭**。`settings.scss` 现存的
>   200/220ms 带有"softer ease-in for the focus ring (小动效)"注释，是介于
>   fast(160) 与 moderate(320) 之间的有意微调，非欠账。
> - P3 per-skin 曲线覆盖 → **废弃**（平台皮肤已全部删除）。
> - P3 modal dismiss 退场动画 → **搁置**（纯 polish，无用户反馈不做）。

## 1. Current Inventory

### 1.1 Global tokens (`src/app/root.scss:61–70`)

| Token | Value | Role |
|-------|-------|------|
| `--anim-speed-modifier` | `1` | Runtime multiplier; set to `0` by `prefers-reduced-motion` / `.reduce-motion` |
| `--anim-motion-baseline` | `cubic-bezier(0.32, 0.72, 0, 1)` | Default ease-out — used for 90% of transitions |
| `--anim-motion-emphasized` | `cubic-bezier(0.16, 1, 0.3, 1)` | Snappier ease-out — hover-ribbon, community cards, larger enter/exit |
| `--anim-duration-superfast` | `80ms` | Instant feedback (hover, active states) |
| `--anim-duration-fast` | `160ms` | Small transitions (color, border, subtle size changes) |
| `--anim-duration-moderate` | `320ms` | Default — panels, tabs, reveals |
| `--anim-duration-slow` | `480ms` | Full-page transitions, drawer opens |

### 1.2 Per-skin keyframes

| Skin | Keyframe | Selector | Purpose |
|------|----------|----------|---------|
| **Baseline** | `menuIn` | `.modal, .popover, .suggestion-container` | Popover/menu slide-in |
| | `modalIn` | `.modal-container .modal` | Modal scale-in |
| | `workspaceLeafIn` | `.workspace-tabs .workspace-leaf` | New tab slide-in |
| **Bamboo China** | `modalInBambooChina` | `body:not(.adaptive-mode-off):not(.is-android):not(.mod-windows) .modal` | Brand modal — squash-and-stretch |
| | `bounceInScale` | `body:not(.adaptive-mode-off) .suggestion-container.is-bamboo-china-mobile` | Mobile prompt bounce |
| **Material** | `menuInMaterial` | `body.is-android .modal, .suggestion-container` | Android M3 menu slide-up |
| **Fluent** | `workspaceLeafInFluent` | `body.mod-windows .workspace-leaf` | WinUI 3 leaf expand |

### 1.3 Usage distribution (~80 call sites)

| Pattern | Count | Examples |
|---------|-------|----------|
| `var(--anim-duration-moderate) var(--anim-motion-baseline)` | ~50 | Tabs, settings, status-bar, sidedock, callouts |
| `var(--anim-duration-fast) var(--anim-motion-baseline)` | ~15 | Frontmatter, color transitions |
| `var(--anim-duration-fast)` (no curve) | ~8 | Simple opacity/color toggles |
| `var(--anim-duration-moderate) var(--anim-motion-emphasized)` | ~4 | Hover-ribbon, settings panel |
| `var(--anim-duration-slow) var(--anim-motion-baseline)` | ~2 | mobile drawer |
| Hardcoded `220ms` / `200ms` | ~3 | Settings focus ring (pre-dates tokenisation) |

### 1.4 Accessibility

- `prefers-reduced-motion: reduce` → `--anim-speed-modifier: 0 !important` (all durations collapse to 0)
- `.reduce-motion` class toggle (Style Settings) does the same
- `prefers-reduced-transparency: reduce` → blur tokens neutralised (added P2)

## 2. Design Principles

### 2.1 Duration semantics

```
superfast (80ms)  →  "I saw my click"       — hover, active, toggle
fast (160ms)      →  "Something changed"     — colour, border, icon swap
moderate (320ms)  →  "Something moved"       — panel, tab, reveal (DEFAULT)
slow (480ms)      →  "A new surface appeared" — drawer, full-page transition
```

### 2.2 Curve semantics

| Curve | Visual character | Use when… |
|-------|-----------------|-----------|
| `baseline` | Gentle deceleration, no bounce | Default — panels, tabs, standard reveals |
| `emphasized` | Crisp deceleration, subtle snap | Larger surfaces (ribbon, cards), enter/exit where user attention is drawn |

### 2.3 When NOT to animate

- `prefers-reduced-motion` is respected → all durations collapse
- Micro-interactions that fire on every keystroke (no animation on input)
- Scroll-driven animations (Obsidian doesn't expose scroll position → not viable)
- `display: none` ↔ `block` toggles (not animatable; use opacity + pointer-events instead)

## 3. Per-Skin Motion Strategy

| Skin | Philosophy | What it owns |
|------|-----------|-------------|
| **Bamboo China** (default) | "竹影水墨" — organic, deliberate. Modal uses squash-and-stretch (`modalInBambooChina`). Transitions should feel like ink spreading, not UI sliding. | `modalInBambooChina`, `bounceInScale` |
| **Material** | M3 motion — enter = fade + slide-up from bottom edge. Exits are instant. | `menuInMaterial` |
| **Fluent** | WinUI 3 — enter = scale from origin. Subtle, no overshoot. | `workspaceLeafInFluent` |
| **Adwaita** | GNOME HIG — minimal motion. No custom keyframes; relies entirely on the baseline tokens. | (none) |

**Rule**: Per-skin keyframes replace the *entrance* curve and distance for brand-recognisable moments (modal open, new tab, menu popover). All other transitions (hover, toggle, colour change, tab switch) use the shared tokens and feel consistent across skins.

## 4. Gaps

### 4.1 Missing: mood-switch transition
When the user switches 意境 (e.g. from 竹影 to 墨夜), the colour palette changes instantly. A crossfade (`200ms opacity transition` on `body`) would make the switch feel intentional — like "ink washes over the canvas" — reinforcing the Bamboo China brand. Requires a new token.

**Proposed**: `--anim-duration-mood-switch: calc(300ms * var(--anim-speed-modifier))` in `root.scss`, applied as a CSS transition on `body` via `transition: background-color, color var(--anim-duration-mood-switch) var(--anim-motion-brand)`.

### 4.2 Missing: brand motion curve
The baseline and emphasised curves are Apple-HIG-inspired (system-feel). A brand curve for Bamboo China would be slightly more organic:

```scss
// 卷轴舒展 — gentle overshoot returns, like unrolling a scroll
--anim-motion-brand: cubic-bezier(0.34, 1.56, 0.64, 1);
```

This curve has a ~5% overshoot and settles faster than `emphasized`, giving a "zen snap" feel. It should be reserved for the 2–3 most brand-visible moments (mood switch, modal entrance on Bamboo China).

### 4.3 Missing: exit animations
All enter keyframes are defined; exits are mostly instant (display none). For mood switching and modal dismiss, a matching exit animation would polish the brand feel. CSS can't chain enter-then-exit easily, but `animation: ... reverse` or a second class-triggered exit can work.

### 4.4 Hardcoded durations
Three call sites in `settings.scss` use bare `220ms` / `200ms`. These predate the token system and should be migrated to `var(--anim-duration-fast)` for consistency.

### 4.5 No curve variation by skin
Material uses Google's standard deceleration curve (`cubic-bezier(0.05, 0.7, 0.1, 1)`) on Android; Fluent uses `cubic-bezier(0.33, 0, 0.67, 1)`. Currently both inherit the Apple-HIG baseline curve. Overriding `--anim-motion-baseline` per skin would be a one-line change but needs testing.

## 5. Roadmap

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| **P1** | Add `--anim-motion-brand` curve token | 1 line in `root.scss` | Enables brand motion everywhere |
| **P1** | Mood-switch crossfade | ~5 lines of CSS | Makes 意境切换 feel deliberate |
| **P2** | Migrate hardcoded 200ms/220ms to tokens | 3 line replacements | Consistency |
| **P3** | Per-skin curve override (Material/Fluent/Adwaita) | 3 lines per skin | Platform-accurate motion feel |
| **P3** | Modal dismiss exit animation | Reversible keyframe tweak | Polish |
