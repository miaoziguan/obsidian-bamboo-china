# Design: 意境 Mood 单一来源 + 跨皮肤注入

Date: 2026-07-22
Status: Approved (设计决策已通过 ask_followup 确认)

## 1. 目标 / 非目标

**目标（S2）**
- 把 16 套东方意境配色收敛为**单一权威来源**（Sass map），由 `@each` 循环生成现有
  `body.cn-*` 规则集。消除 16 套手写块的重复结构。
- 加一套新意境 = 在 map 加一个条目，而非复制 6 个手写 CSS 块。

**目标（S1）**
- 让意境 mood 的强调色（accent）**统御所有平台皮肤**（含 Material / Adwaita），
  无 mood 时回落平台默认。把"竹林意境"从"非平台匹配用户才看到"提升为全用户品牌核心。

**非目标**
- 不重染色平台皮肤的背景/形状（Material 的 Material 感、Adwaita 的 GNOME 感保留）。
- 不引入外部 JSON / 构建脚本（已确认采用纯 Sass map）。
- 不改 Style Settings 的 16 选项 UI（保持用户可见不变）。

## 2. 背景与关键发现

- 现有 16 套 mood 在 `src/color-schemes/bamboo-china-palettes.scss` 以**逐套手写**的
  `body.cn-xxx.theme-light / .theme-light:not(.is-mobile) / .theme-light.is-mobile /
  .theme-dark / ... / .theme-dark.is-mobile` 共 **6 个块/套** 组织。
- mood 选择器已挂在 `body[class*="cn-"]`（与平台皮肤解耦），故 **Fluent / Baseline
  （纯形状皮肤）选 mood 已天然生效**；S1 的真实堵点只在 **Material / Adwaita**——
  它们的 color-scheme 优先级 (≈0,5,1) 高于 mood (0,1,1)，会覆盖 mood 的 accent。
- 每套 mood 的 `--interactive-normal/hover/active` 是中性灰，**所有 mood 完全相同**，
  属于可从 map 提炼的共享常量。

## 3. 已确认的设计决策

1. **Token 源形式**：纯 Sass map（`$moods`），零新依赖，契合纯 Sass 主题生态。
2. **mood 统御权**：选意境后其 accent 在所有皮肤胜出；平台皮肤用
   `var(--mood-accent, <本平台默认>)` 引用，无 mood 时回落平台默认。

## 4. Token 模型（Sass map schema）

新建 `src/color-schemes/_mood-tokens.scss`，定义：

```scss
// 单一来源：16 套东方意境的语义锚点。
// 每套只声明"与默认竹影不同的锚点"，共享常量（中性 interactive、light 画布 #fff）
// 由生成循环补全，不进 map。
$moods: (
  moye: (
    label: "墨夜 · 墨黑月白",
    accent: (light: rgb(58 112 175), light-hover: rgb(80 134 197),
             dark: rgb(92 150 214), dark-hover: rgb(114 168 226)),
    bg-primary-dark: #121212,
    tint: (light: #f3f3f1, dark: #1e1e1e),          // 侧栏/面板淡染色
    text: (light: (normal:#1c1c1a, muted:#6e6e6a, faint:#bcbcb8),
           dark:  (normal:#e9e9e4, muted:#8c8c86, faint:#44443f)),
    rgb: (light: (red: 198 68 66, green: 96 140 106),
          dark:  (red: 214 84 82, green: 110 160 120)),
  ),
  // ... 其余 15 套，完整迁移现有手写值
);
```

map 覆盖的字段（每套可能不同子集，`rgb` 尤其如此）：
- `accent`: 4 值（light / light-hover / dark / dark-hover）
- `bg-primary-dark`: 墨底色（每套不同）
- `tint`: 侧栏淡染色 light + dark
- `text`: 文本三色 light + dark
- `rgb`: 覆盖的 `--color-*-rgb`（light + dark 各自不定组合）

**共享常量（不进 map，由循环注入）**：
- light 画布 `--background-primary: #ffffff`
- `--interactive-normal/hover/active`: light=`hsl(0 0% 0% / 5%·9%·13%)`、
  dark=`hsl(0 0% 100% / 5%·10%·15%)`（mobile 用 `rgba(118 118 128, 12%·20%)` 等，与现一致）
- `--background-secondary-alt` light-mobile = `#ffffff`（与现一致）

## 5. 生成策略（@each）

`bamboo-china-palettes.scss` 改为：

```scss
@use "color-schemes/mood-tokens" as mt;

@each $name, $m in mt.$moods {
  body.cn-#{$name}.theme-light {
    // 注入 $m.rgb.light → --color-*-rgb
    // 注入 $m.accent.light / light-hover → --interactive-accent / -hover / --text-accent / -hover
    // --text-on-accent: #fff
  }
  body.cn-#{$name}.theme-light:not(.is-mobile) {
    --background-primary: #fff;
    // 注入 $m.tint.light → --background-primary-alt / --background-secondary / --background-secondary-alt
    // 注入共享 interactive-normal/hover/active (light)
    // 注入 $m.text.light
  }
  body.cn-#{$name}.theme-light.is-mobile { /* 同上，secondary-alt=#fff, interactive 用 mobile 值 */ }
  // dark 三块同理（bg-primary-dark 来自 $m.bg-primary-dark，配 color-mix 派生 alt/secondary）
}
```

等价性要求：生成输出必须**逐 token 复现**现有手写值（含 `color-mix` 兜底写法）。

## 6. S1 跨皮肤注入机制

- mood 生成时额外挂语义锚点：`--mood-accent` / `--mood-accent-hover` /
  `--mood-text-accent` / `--mood-text-accent-hover`（值即该 mood 的 accent）。
- `src/color-schemes/material.scss`：
  - light 块 `--interactive-accent: var(--mood-accent, var(--tertiary-40))`、
    `--interactive-accent-hover: var(--mood-accent-hover, ...)`、同理 `--text-accent*`。
  - dark 块对应改为 `var(--mood-accent, var(--tertiary-60))` 等。
- `src/color-schemes/adwaita.scss`：其 `--interactive-accent` / `--text-accent`
  改为 `var(--mood-accent, #3584e4)` / `var(--mood-text-accent, #1c71d8)`。
- Fluent / Baseline 不改（继承 Bamboo，mood 已生效）。

**优先级技巧**：平台皮肤**主动引用** `--mood-accent`（而非硬编码），故只要
`body.cn-xxx` 定义了它（哪怕优先级低），平台块即取 mood 值；无 mood 时回落平台默认。
这实现"意境统御"且零特异性冲突。

## 7. 校验策略（TDD）

新增 `scripts/verify-mood-parity.mjs`：
- 重构前 baseline：解析现有 `theme.css`，提取所有 `body[class*="cn-"]` 及其
  `.theme-light/-dark` / `:not(.is-mobile)` / `.is-mobile` 变体的**声明集合**，存 golden。
- 重构后：重新 build，提取同样集合，逐 mood × 模式对比声明是否一致（忽略顺序/格式）。
- 任一不一致 → 测试失败，禁止合并。

既有门禁继续生效：`check-palette-contrast.mjs`（bamboo/cn-* STRICT）、
`audit_cascade.mjs`、`check-size.mjs`（`theme.css` 应**字节不增**，因只是结构重组）。

## 8. 风险与缓解

| 风险 | 缓解 |
|------|------|
| `@each` 生成的 `color-mix` 兜底写法与手写不一致 → 视觉回归 | parity 测试逐 token 比对；build 后 `theme.css` 体积应持平 |
| Sass map 语法错（引号/空格 rgb）| 先迁 1 套（moye）跑通 parity，再批量迁其余 |
| Material `var(--mood-accent,...)` 在某些组合下对比度劣化 | 既有 bamboo STRICT 门禁覆盖 mood accent；Material 段为 ADVISORY，已注明需浏览器验证 |
| `rgb()` 用空格语法 `rgb(58 112 175)` 与现逗号语法不等价 | parity 测试会抓到；统一用空格语法（现代 Sass 等价）或保留逗号，以 parity 为准 |

## 9. 验收标准

1. `node scripts/verify-mood-parity.mjs` 通过（重构前后 mood 声明逐 token 一致）。
2. `npm test` 全绿（含扩展后的对比度 / 级联 / 体积门禁）。
3. `theme.css` 体积变化 < 1%（纯结构重组，无新增规则）。
4. 选任意 mood + 任意平台皮肤，accent 跟随 mood（手动/视觉回归验证）。
