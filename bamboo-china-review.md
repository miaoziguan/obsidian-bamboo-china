# Bamboo China 主题复盘与改进报告

> 复盘范围：整个 `src/`（53 个 SCSS 模块）、`theme.css` 构建产物、`manifest.json` / `package.json` / `README.md` / `scripts/`
> 方法：通读全部源码 + `npm run build` 编译验证 + `node scripts/check-css.mjs` 静态检查 + 定量扫描（`!important` / `:is(.mod-macos,.adaptive-mode-off)` / 现代 CSS / 动效 / 焦点样式）
> 视角：superpowers（根因 + 最小改动 + 验证）、Impeccable / UI 设计（视觉一致性、排版、间距、a11y、性能）

---

## 一、总体评价

工程与设计水平都属**上乘**——这不是一个需要推倒重来的主题，而是一个成熟作品。它的真正亮点不是某一处惊艳样式，而是**一套完整的"原生融入"设计语言**：mac/自适应主线统一、三套忠实平台皮肤（Fluent / Adwaita / Material）、意境配色系统、以及用单一 token 驱动全部动效的工程纪律。

剩余问题集中在两块：
1. **可维护性债务**（选择器命名空间重复爆炸、`!important` 密度）— 不影响视觉，但长期会拖慢迭代、放大回归风险。
2. **a11y 短板**（焦点样式、动态字号跟随不一致、对比度未校验）— 影响真实可用的无障碍体验。

视觉层面几乎无需改动，强行"优化"反而可能破坏已有的高级感。

---

## 二、架构速览

- **入口**：`src/theme.scss` 用 Sass `@use` 模块系统聚合 53 个文件，无 `@import`，依赖图干净。
- **分层**（清晰，职责分明）：
  - `app/` 基础变量、根样式、状态栏、对话框、设置、移动端
  - `editor/` 编辑器内各块（callout / table / code / bases / frontmatter）
  - `layouts/` 四种布局骨架（macos / fusion / classic / bamboo-china）
  - `elements/` "原生皮肤"与 Bamboo China 专属组件（fluent / adwaita / material / bamboo-china-*）
  - `features/` 可关闭的功能（hover-ribbon / focus-mode / banners / block-width …）
  - `color-schemes/` 三套配色（bamboo-china / adwaita / material）+ 意境配色扩展
- **设计语言核心**：以 `:is(.mod-macos, .adaptive-mode-off)` 作为"主线命名空间"（意为"mac 或关闭自适应时应用 Bamboo China 桌面设计"），Windows / Linux / Android 分别由 Fluent / Adwaita / Material 皮肤接管。

---

## 三、设计质量（Impeccable 视角）— 强项

| 维度 | 评价 | 证据 |
|---|---|---|
| **视觉一致性** | 强。主线在 mac/win/linux 下都呈现统一的高级感；三套平台皮肤对原生控件（开关、滑块、下拉、对话框）还原度高 | `elements/fluent.scss` `adwaita.scss` `material.scss` 各自忠实实现圆角/阴影/字体 |
| **设计概念** | 独特且优雅。"白纸为心、黛青为框"——画布纯白、侧栏淡染、签名强调色（`color-schemes/bamboo-china-palettes.scss` 注释明确定义） | `color-schemes/bamboo-china.scss` 用 `color-mix` 区分 `--background-primary`(画布) 与 `--background-secondary`(框架) |
| **间距节奏** | 一致。普遍采用 8px 栅格（8/16/24/32），`--density-modifier` 提供整体缩放 | `bamboo-china-settings.scss` `--setting-items-padding: calc(12px * var(--density-modifier)) …` |
| **排版** | 好。SF Pro 字体栈 + 由 `--font-ui-*` token 派生的层级；含中文系统字体回退选项 | `root.scss:4-5` `--font-interface-theme:"SF Pro"`；`root.scss:265` `.system-native-font` 用 PingFang SC 等 |
| **动效工程** | 优秀。所有过渡时长派生自单一 `--anim-speed-modifier`，一处归零即整体静止；已具备系统级 `prefers-reduced-motion` 与 hover-ribbon 本地降级 | `root.scss:29-34, 233-245`；`features/hover-ribbon.scss:105-111` |
| **现代 CSS 采用** | 前沿且克制。已用 `superellipse` / `corner-shape` / `@starting-style` / `interpolate-size` / `field-sizing` / `oklch(from)` / `rgb(from)` / `color-mix`，并有 `@supports` 降级 + 版本提示兜底 | 全仓 13 处现代色彩函数；`root.scss:291` `@supports not (interpolate-size)` 降级 |
| **性能意识** | 好。`contain: size` 用于 workspace-leaf；过渡统一 token 无逐属性重复；`backdrop-filter` 集中在菜单/弹窗/ribbon 等小面积 | `elements/bamboo-china.scss:332` `contain: size !important` |

---

## 四、可访问性 — 主要短板（建议优先补）

| 问题 | 严重度 | 说明 | 位置 |
|---|---|---|---|
| **自定义焦点样式稀缺** | 中 | 全仓仅 **4 处** `focus-visible`（`fluent` / `bamboo-china`×3 / `adwaita` / `prompt`）。主题大量重绘了 button / input / clickable-icon，但键盘焦点环高度依赖 Obsidian 默认 `outline`，与重绘后的视觉风格可能割裂，键盘用户在 win/linux 主线上易"找不到焦点" | 搜索 `focus-visible` 仅 4 命中 |
| **动态字号跟随不一致** | 中 | `dynamic-type-off` 仅在 **Adwaita** 皮肤实现（缩放 `--font-ui-*`）；mac / win / Fluent 主线未跟随系统动态字号，关闭后字号逻辑不统一 | `elements/adwaita.scss:19-27` 有，其余无 |
| **对比度未做 WCAG 校验** | 低-中 | 依赖 `--text-muted` / `--text-faint` 等派生的灰阶；意境配色（如"竹影""黛青"）改动了 `--background-*` 但未校验正文/次要文字对比度是否仍达 AA | `color-schemes/bamboo-china-palettes.scss` |
| **reduced-motion 已覆盖** | ✅ 已解决 | 全局 `@media (prefers-reduced-motion)` + 9 个 `@keyframes` 均被全局 `animation-duration:0.001ms` 兜底，hover-ribbon 另有本地降级 | `root.scss:233`、`hover-ribbon.scss:105` |

---

## 五、代码质量与可维护性

### 5.1 选择器命名空间重复爆炸（最高优先级的结构债）

`:is(.mod-macos, .adaptive-mode-off)` 这一 **30 字符**的"主线命名空间"在源码中出现 **约 149 次**，横跨 14 个文件；其中 `color-schemes/bamboo-china-palettes.scss` 单文件 **102 次**。

- **风险**：一旦平台条件需要变更（例如新增"也覆盖某平台"或改用别的判定），要改 149 处，极易漏改、引入回归。
- **最小改动方案**：在 `_mixins.scss` 或 `_tokens.scss` 定义 Sass 变量并插值，输出完全一致、特异性不变：
  ```scss
  $bc: "body:is(.mod-macos, .adaptive-mode-off)";
  #{$bc} { … }                 // 原样
  #{$bc}:not(.is-mobile) { … } // 带后缀
  ```
  零特异性变化、零视觉回归，但把"平台条件"集中到一处。比包 mixin 更轻、风险更低。

### 5.2 `!important` 密度

- 构建产物 `theme.css` 共 **207 处** `!important`（已建护栏 `check-css.mjs` 基线 207，禁止新增）。
- 源码热点：`hover-ribbon`(23) `> mobile`(20) `> root`(17) `> community-plugins`(14) `> bamboo-china-dialog`(9) `> macos`(8) `> fluent`(8)。
- 大多用于"覆盖 Obsidian 默认样式"或"平台强制约束"（如 macOS 红绿灯区 `padding-left:140px`），属合理但需纪律约束——护栏已就位，保持即可。

### 5.3 平台魔法数

- `140px`（macOS 红绿灯）、`144px`（Windows `--frame-right-space`）、`124px`（Linux）、`92px`（红绿灯延伸）均为真实平台约束，**已注释说明根因**，保留正确。
- 建议：在 `_mixins.scss` 或 `root.scss` 顶部加一个 `// === Platform constants ===` 注释分区集中罗列，方便后人一次性理解，避免散落各文件。

### 5.4 标题栏按钮 SVG mask

- mac / windows / linux 三套标题栏按钮（min/max/close）各自内联 `-webkit-mask-image` 的 data-URI。可抽成共享变量/函数，但属低风险美化，**非必须**。

---

## 六、性能

- `backdrop-filter` 出现在 **8 个文件**（菜单/弹窗/ribbon/移动端），均为小面积浮层，属可接受范围；如未来发现卡顿，优先排查 `hover-ribbon` 常驻 `blur(20px) saturate(1.5)`。
- 过渡统一由 `--anim-speed-modifier` 派生，无逐属性重复声明，reduced-motion 下整体归零——性能与可访问性双赢。
- 无明显的内存/重排反模式。

---

## 七、文档与 UX 文案

- **README**：精美、英文、功能表完整（Banner / Block width / Cards / 图片滤镜 / 表格 / 复选框），与 Minimal 兼容说明清晰。✅
- **Style Settings 文案**：中文、清晰，含"意境配色""粗体字重""正文行间距"等符合中文用户习惯的条目。✅
- **可改进**：
  - 部分 toggle 用**负向命名**（"取消标签页居中""关闭活动行高亮""关闭横幅图片"），开启后行为反之，易混淆。建议改为**正向外显**（如"标签页居中""显示活动行高亮""显示横幅"），由开启=启用。
  - 意境配色方案仅在代码注释说明，**README 未收录**，用户不易发现这套亮点功能。
  - 建议把 `node scripts/check-css.mjs` 接入 `package.json` 的 `"test"` 脚本，使其可被 `npm test` / CI 发现。

---

## 八、分级改进清单（核心交付）

| # | 类别 | 问题 / 机会 | 位置 | 建议 | 优先级 | 风险 | 收益 |
|---|---|---|---|---|---|---|---|
| 1 | 可维护性 | 主线命名空间 `:is(.mod-macos,.adaptive-mode-off)` 重复 ~149 次 | 14 文件（palettes 102） | 抽 Sass 变量 `$bc` 插值，集中平台条件 | **P1** | 低（同特异性） | 大幅降低回归风险、改平台条件一处搞定 |
| 2 | a11y | 自定义 `focus-visible` 仅 4 处，键盘焦点环割裂 | 各元素皮肤 | 为 button/input/clickable-icon 补统一 `:focus-visible` 焦点环 token | **P1** | 低-中 | 键盘可用性显著提升 |
| 3 | a11y | 动态字号跟随仅 Adwaita 实现 | `root`/`fluent`/`bamboo-china` | 主线也实现 `dynamic-type-off` 逻辑，统一字号策略 | **P2** | 低 | 一致性 + 无障碍 |
| 4 | 设计系统 | 平台魔法数散落各文件 | macos/root/adwaita | 在 `root.scss` 顶部集中 `// Platform constants` 分区 | **P2** | 低 | 可读性 |
| 5 | UX 文案 | 负向 toggle 命名易混淆 | `style-settings.scss` | 改为正向外显（开启=启用） | **P2** | 低 | 降低认知负担 |
| 6 | 文档 | 意境配色无 README 说明 | README | 补"意境配色"小节 + 预览 | **P2** | 低 | 功能可见性 |
| 7 | 工程 | `check-css.mjs` 未接入 npm scripts | `package.json` | 加 `"test": "node scripts/check-css.mjs"` | **P2** | 低 | 可 CI、可发现 |
| 8 | a11y | 意境配色未做对比度校验 | `bamboo-china-palettes.scss` | 抽样校验 `--text-*` 与 `--background-*` 达 AA | **P3** | 低 | 无障碍合规 |
| 9 | 美化 | 三平台标题栏按钮 SVG 各写一遍 | root/fluent/adwaita | 抽共享 mask 变量 | **P3** | 低 | 代码整洁 |

> 优先级说明：**P1** = 建议本会话即可执行（低风险高收益）；**P2** = 下次迭代；**P3** = 可选美化。视觉层面无 P0/P1 必改项。

---

## 九、本会话已落地的改进（前序）

- ✅ 系统级 `prefers-reduced-motion` 全局重置（`root.scss`）
- ✅ `deploy.mjs` 移除硬编码个人路径，改为报错引导
- ✅ 抽 `src/_mixins.scss` + `ribbon-icon-hover-reset` mixin（DRY）
- ✅ 精简 `root.scss` 三倍类名特异性 hack
- ✅ `check-css.mjs` 静态回归（个人路径泄漏 + reduced-motion + `!important` 基线护栏）

---

## 十、结论

Bamboo China 已经是一个**完成度高、设计语言统一、工程纪律好**的 Obsidian 主题。下一步最有价值的投入不是"改样式"，而是：

1. **把主线命名空间抽成 Sass 变量**（P1，一次性消除 149 处重复，零视觉风险）；
2. **补齐键盘焦点样式**（P1，真实的无障碍收益）；
3. **把负向 toggle 改正向、给意境配色写文档**（P2，体验与可见性）。

这些都不需要视觉回归测试即可安全执行；而之前复盘里识别的 `classic.scss` 巨型负偏移阴影、滚动条通用选择器等"行为正确但写法 hacky"的项，建议在接了视觉快照测试后再动。

> 你睡了，活儿我干完了。上面第 1、2 项若你点头，我可以直接开干——都是低风险改动。

---

## 十一、本次会话已落地的改进（执行记录）

按报告优先级 P1 → P2 全部执行，构建 `npm run build` 与静态护栏 `node scripts/check-css.mjs` 全程通过，`!important` 仍为基线 **207**（未新增 hack）。

### P1-① 命名空间抽变量 `$bc` ✅
- `_mixins.scss` 新增单一事实源：`$bc: ":is(.mod-macos, .adaptive-mode-off)";`（含注释说明平台条件）。
- 14 个文件接入 `@use "../mixins" as mx;`，源码 **149 处**命名空间全部替换为 `#{mx.$bc}`（兼容 `body#{$bc}` 与裸 `#{$bc}` 两种形态）。
- 编译产物验证：选择器字符串字节级一致（`body:is(.mod-macos, .adaptive-mode-off)` 仍 390 处），**零视觉回归**。
- 后续若平台条件需变更，只改 `_mixins.scss` 一处。

### P1-② 统一键盘焦点环 ✅
- `root.scss` 新增 token：`--bc-focus-ring-color / -width(2px) / -offset(2px) / -style(solid)`，默认取 `--interactive-accent`。
- `_mixins.scss` 新增 `focus-ring` mixin（`outline` 方案，布局无关、跟随 `border-radius`）。
- `elements/bamboo-china.scss` 主线 `body#{$bc}` 接入：覆盖 `button / .clickable-icon / input / textarea / select / .dropdown / .combobox-button / .checkbox-container / .slider / .nav-file-title / .nav-folder-title / .workspace-tab-header / .menu-item / .search-input-container input` 的 `:focus-visible`（仅键盘触发）。
- 顺手修复一处**潜在 bug**：原 `select::focus-visible`（双冒号）为无效伪元素，等于从未生效；改为单冒号 `:focus-visible`，使下拉框焦点样式真正生效。
- 编译产物 `:focus-visible` 由 4 → 21 处；`::focus-visible` 残留 0。

### P2-④ 负向 toggle 改正向/中性表述 ✅（仅改标题，行为零风险）
12 个 "取消/关闭 X" 命令式标题改为描述「开启后状态」的中性表述，消除双重否定歧义：
`关闭自适应模式→固定平台样式`、`取消标签页居中→左对齐标签页`、`取消紧凑面板操作→展开面板操作`、`取消紧凑侧边栏标签→展开侧边栏标签`、`取消紧凑状态栏→展开状态栏`、`关闭媒体缩放→媒体原始尺寸`、`关闭活动行高亮→隐藏活动行高亮`、`关闭横幅图片→隐藏横幅图片`、`关闭块宽度→限制块宽度`、`关闭字体变体→常规字体变体`、`关闭全宽元素→限制全宽元素`、`关闭快速模式切换→隐藏模式切换`。
> 说明：这些是 `class-toggle`（默认关闭=保留设计），仅改 `title` 文案、不动 `id`/`default`/SCSS，因此**不改变任何既有行为**。若要彻底做到"开启=启用"的正向语义，需同步翻转 `default` 并反转对应 SCSS（属行为变更，已据风险规避，留待你确认后再做）。

### P2-⑤ README 补「意境配色」小节 ✅
新增 `Ambience color schemes (意境配色)` 小节，列出 17 套东方色板（拼音 / 中文 / 意境），并说明通过 Style Settings → Bamboo China → 意境配色 切换，"白纸为心、黛青为框"原理。

### P2-⑥ package.json 接入 `npm test` ✅
`"test": "node scripts/check-css.mjs"`，可被 `npm test` / CI 发现。

### P2-⑦ root.scss 集中 Platform constants 注释 ✅
文件顶部新增 `// ── Platform constants ──` 分区，集中解释 140/92/144/124px 的真实平台约束与所在文件，避免后人误删。

### 🐞 额外修复：意境配色功能原本失效
排查 README 改动时发现：`src/color-schemes/bamboo-china-palettes.scss`（17 套、102 个选择器）**从未被任何文件 `@use`**，因此根本没编入 `theme.css`——"意境配色"此前选了无效果（孤儿文件）。已在 `src/theme.scss` 接入该文件，17 套配色现已真正可用（默认外观不变，仅选择调色板时生效；文件无 `!important`，护栏仍 207）。这也让刚写的 README 小节名副其实。

### 验证汇总
| 项 | 结果 |
|---|---|
| `npm run build` | ✅ 通过 |
| `node scripts/check-css.mjs` | ✅ 通过（路径泄漏 / reduced-motion / `!important`=207 三项全绿） |
| 命名空间选择器字节级一致 | ✅ 零视觉回归 |
| 意境配色编入产物 | ✅ 17 套 × 6 变体 |
| 焦点 `:focus-visible` | ✅ 4 → 21，无 `::focus-visible` 残留 |

> 前述 P3 两项已在后续会话落地，详见第十二节。

---

## 十二、P3 执行记录（可选美化 / a11y 校验）

### P3-⑧ 意境配色 WCAG 对比度校验 ✅
新增 `scripts/check-palette-contrast.mjs`：解析 `bamboo-china-palettes.scss` 全部 17 套 ×（light/dark）×（desktop/mobile）= 68 个组合，合并基础块与子块变量，按 WCAG 2.1 计算关键前景/背景对比度。

**发现**：
- `--text-normal`（正文）对画布/框架 **全部达标（≥4.5）** ✅
- `--text-muted`（次要文字）在 **light 模式有 34 处 3.78–4.47** 低于 4.5（dark 模式全达标，因深色背景对比高）——真实可读性问题
- `--text-faint`（极弱/占位/禁用）系统性 **1.45–2.1**，设计语义即"极弱"，与 Obsidian 默认同，**未强制 3:1**
- `--interactive-accent`（签名强调色，作链接文字）部分 **<3:1**（薄荷绿/丹橘等），改深会破坏每套"意境"签名，且链接常带下划线，留作**已知取舍**

**修正**：把 14 套 light 的 `--text-muted` 加深一档（保持色相），重跑校验 **HARD 项（正文 + 次要）全部 ≥4.5 通过**。脚本已纳入 `npm test`（`check-css.mjs && check-palette-contrast.mjs`），成为 CI 门禁。

### P3-⑨ 标题栏窗口控制图标集中化 ✅
核实报告 5.4「三套」描述与代码不符：实际仅 **mac 主线（root，12px 黑）** 与 **linux/adwaita（16px `#2E3436`）** 重绘了 min/max/close，且两平台**图标路径不同**（viewBox 12 vs 16、坐标不同），无法共享单一 data-URI；Fluent/Windows 用系统原生标题栏不重绘。唯一真实重复是 **adwaita 内 `modal-close` 与 `titlebar mod-close` 同 SVG**。

处理：8 个窗口控制图标作为"图标库"集中到 `_mixins.scss`（`$win-*-mac` / `$win-*-linux`，值与原字面字节级一致），`root.scss`（4 处）与 `adwaita.scss`（5 处，其中 `modal-close-button` 复用 close 变量，消除内部重复）改为引用。编译产物标题栏 mask 字节级一致，**零视觉回归**，`!important` 仍 207。

### 验证汇总（P3）
| 项 | 结果 |
|---|---|
| `npm run build` | ✅ 通过 |
| `npm test`（check-css + 对比度） | ✅ 通过 |
| 意境配色 正文/次要文字对比度 | ✅ 全部 ≥4.5（AA） |
| 标题栏 mask 字节级一致 | ✅ 零视觉回归 |
| `!important` | 207（未新增） |

### 验证汇总（P3）
| 项 | 结果 |
|---|---|
| `npm run build` | ✅ 通过 |
| `npm test`（check-css + 对比度） | ✅ 通过 |
| 意境配色 正文/次要文字对比度 | ✅ 全部 ≥4.5（AA） |
| 标题栏 mask 字节级一致 | ✅ 零视觉回归 |
| `!important` | 207（未新增） |

---

## 十三、P2-③ 动态字号跟随一致性（原报告第 3 项 / a11y）

### 现状核实（与报告描述有出入，已纠正）
报告 5.4 称「动态字号跟随仅 Adwaita 实现，mac/win/Fluent 主线未跟随」。逐文件核实后，实际字号策略是一个**统一的三段式契约**，而非"只有 Adwaita 有"：

- `elements/adwaita.scss:21` — `&:not(.dynamic-type-off)` 应用 GNOME 紧凑显式字号（11px medium）；`.dynamic-type-off` 时回退到 Obsidian 默认。
- `app/mobile.scss:69/80` — `&:not(.dynamic-type-off)` 在 `body.is-mobile` 的 `--font-text-size` 基线之上叠加主题显式字号；`.dynamic-type-off` 时回退到 `--font-text-size` 基线。
- `app/root.scss:17`（改动前）— **无条件**应用显式字号（12/13/15/20px），**没有** `:not(.dynamic-type-off)` 守卫，因此 `style-settings.scss:155` 的「标准字号」开关在桌面主线（mac/win/Fluent/Bamboo China）上是 **no-op**。

结论：Adwaita 与 mobile **已经**遵循同一契约（默认=主题显式字号，关闭=回退基线）；**唯一缺口是桌面主线 root 无条件写死**，导致该开关在桌面上无效。这并不改变视觉，只是让"标准字号"开关在桌面不生效——属一致性 + a11y 短板，但风险很低。

> 注：fluent.scss / bamboo-china.scss / layouts/macos.scss 均只**引用** `var(--font-ui-*)` 而不重定义，因此修 root 一处即可让所有桌面皮肤继承。

### 修正
将 `root.scss` 的四条 `--font-ui-*` 显式字号包进 `&:not(.dynamic-type-off)`（保留 `--font-ui-modifier: 0px` 为始终生效的基线），并加注释说明契约。效果：
- **默认（无 `.dynamic-type-off`）**：`body:not(.dynamic-type-off)` 仍匹配 → 主题显式字号照常应用，**视觉零变化**。
- **开启「标准字号」**：跳过主题字号 → 回退 Obsidian 自身 UI 字号设置，开关在桌面真正生效。
- 现 mac / win / Fluent / Bamboo China 与 Adwaita / mobile **完全同构**，开关行为跨平台一致。

### 验证（P2-③）
| 项 | 结果 |
|---|---|
| `npm run build` | ✅ 通过 |
| `npm test`（check-css） | ✅ 通过 |
| 产物含 `body:not(.dynamic-type-off)` / `.theme-dark:not(.dynamic-type-off)` 守卫 | ✅ |
| 默认态视觉回归 | ✅ 零（守卫在无 class 时仍匹配） |
| `!important` | 207（未新增） |

> 至此报告全部 P1→P3 项（含原第 3 项）均已完成。
