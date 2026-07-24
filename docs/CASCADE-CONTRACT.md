# 级联契约（Cascade Contract）

> 状态：草案 · 创建于 2026-07-21 · 修订于 2026-07-21（修正审计数据，见 §2）· **现状修订 2026-07（单皮肤重构，见 §0.1）**
> 目的：把「为什么总在修一个又坏一个 / 改了不生效」的根因固化成可查、可守的契约。
> 关联事件：2026-07-21 统一左右栏 tab header 交互，连续 3 轮才在正确层修好（base 层改动在 mac 上零效果）。

---

## 0.1 现状修订（2026-07 单皮肤重构后 · 先读这条）

本文档下面的 §1–§6 记录的是**五皮肤时代**的调试与契约。3.x 已把主题收敛为**单皮肤 Bamboo China**，请按以下要点理解现状（历史内容保留供追溯，未逐条重写）：

1. **其它设计语言皮肤已删除**：`elements/{material,fluent,adwaita,baseline}.scss` 与对应色板已从 `src/` 移除；`theme.scss` 只导入 Bamboo China 一套。§1 表格最后一行「其它设计语言（可选）」**已不复存在**。
2. **`mx.$bc` mixin 已退役**：旧的 `:is(.mod-macos, .adaptive-mode-off)` 复合作用域不再由 mixin 统一提供，改为在各文件内直接写 `body.mod-macos …` / `body:not(.mod-macos) …`（少数规则仍保留 `:is(.mod-macos, .adaptive-mode-off)` 以维持「关闭自适应＝走 mac 外观」）。部分源码注释仍写着 `mx.$bc`，属历史遗留。
3. **双层模型已弱化为「base 为主 + 少量 mac 分支」**：编译产物中 base ≈ 1342 条规则，mac 分支约 71 处 `mod-macos` / 10 处 `adaptive-mode-off`；Android/Windows 各 1–2 处零星适配。核心铁律仍成立：**改 mac 外观 → `elements/bamboo-china*` 的 mac 分支；改全平台 → `app/*`**。
4. **审计脚本口径过时**：`audit_cascade.mjs` 仍用正则找 `:is(.mod-macos, .adaptive-mode-off)`，与新写法 `body.mod-macos` 不匹配，故 `bamboo split` 现报 0（并非真的无 mac 覆盖）；`material/fluent/adwaita` 分层也只解析到 0–2 条残留。脚本待更新为按 `mod-macos` 直接匹配。

---

## 0. TL;DR（给维护者的铁律）

1. **本主题的 macOS / 自适应关闭外观 = Cupertino 旗舰层（`bamboo-china` 族）**。凡影响 mac 视觉的改动，**默认改 `src/elements/bamboo-china*.scss`，不要改 `src/app/*.scss`**。
2. `src/app/*.scss` 是 **Windows / Linux（自适应开启）的回退层**，也是所有平台的样式底座。
3. 改任何一个组件，**必须同时确认「mac 旗舰层」与「base 回退层」是否都覆盖到了**，否则会出现「mac 正常、Win 裂开」或反之。
4. 任何组件**禁止在 >1 个文件里写会相互冲突的同属性规则**，除非显式用 `body#{mx.$bc}` 标注为变体分支。
5. `audit_cascade.mjs` 的「分裂组件数」度量的是**作用域重叠**（组件类在 base 与旗舰作用域各定义一次），是两层设计的**固有结果**，**不是文件碎片化**；它**不能**用作「归并 KPI」。真正的修复目标是「文件单一归属」+ 杜绝同属性跨层静默覆盖（详见 §2.1）。

---

## 1. 层所有权（Layer Ownership）

导入顺序见 `src/theme.scss`：`app/*` 等 base 文件最先（第 1–13 行），`elements/bamboo-china.scss` 在**第 29 行最后**导入，因此 mac/自适应关闭时它压过一切更早的层。

| 层 | 源文件 | 作用域（选择器前缀） | 何时生效 |
|---|---|---|---|
| **Base / 回退层** | `app/*.scss`、`editor/*.scss` | 无作用域，或 `body:not(.is-phone)` 等弱限定 | 所有平台的基础样式；Windows/Linux（自适应开启）下的实际外观 |
| **Cupertino 旗舰层（mac 默认）** | `elements/bamboo-china.scss`、`elements/bamboo-china-dialog.scss`、`-settings.scss`、`-prompt.scss`、`-mobile.scss`、`layouts/bamboo-china.scss`、`color-schemes/bamboo-china*.scss` | `body:is(.mod-macos, .adaptive-mode-off):not(.is-mobile)`（由 `mx.$bc` 定义，见 `src/_mixins.scss:$bc`） | **macOS 或自适应关闭**时生效，且在 mac 上整体压过 base 层 |
| ~~其它设计语言（可选）~~ | ~~`elements/fluent.scss`、`material.scss`、`adwaita.scss`~~ | — | **已于 3.x 移除**（见 §0.1），此行仅存档 |

> 关键事实：`mx.$bc` 的真实值是 `:is(.mod-macos, .adaptive-mode-off)`（非「仅 mac」）。所以「旗舰层」在 **mac 与自适应关闭** 两种情形下都会命中；在 Windows/Linux + 自适应开启时整体不命中，此时 base 才是活动样式。

---

## 2. 量化与关键认知修正（2026-07-21 修订）

本契约初版引用的「1172 / 445 / 82」数据**有误**——审计脚本 v1 存在括号栈下溢
bug（一行内多个 `{` 只 `push` 1 次却 `pop` 多次，导致后续所有规则的层归属错乱）。
`scripts/audit_cascade.mjs` 已重写为逐括号扫描（v2），修正后真实数据如下：

- 旗舰层（mac / 自适应关闭）规则：**285 条**
- base / 回退层规则：**1336 条**
- 在两层作用域都出现过的组件类：**100 个**

> 关键认知反转：**base 才是大头（1336 条），Cupertino 旗舰层只是 285 条的小覆盖层。**
> 这看似与「旗舰层压过一切」的直觉相反，但符合事实——base 提供全平台完整样式，
> 旗舰层只在 mac / 自适应关闭时做差异化微调。初版把数字反了，会严重误导维护判断。

### 2.1 「分裂」是作用域重叠，不是文件碎片化（重要）

`audit_cascade.mjs` 解析的是**编译后选择器**是否含
`:is(.mod-macos, .adaptive-mode-off)`。因此「分裂组件」度量的是
**作用域重叠**——同一组件类在 base 作用域与旗舰作用域各被定义一次。这是
**两层设计的固有结果**，会且应该长期存在（base 回退 + 旗舰覆盖）。

它**不能**度量「文件碎片化」——即某组件的样式是否散落在 >1 个**源文件**。本契约
真正的修复目标是后者（见 §5 的「组件单一归属」），以及更致命的
「同一属性在两层都被定义、导致静默覆盖」。

> 印证：首轮 `workspace-tab-*` 归并把旗舰块从 `bamboo-china.scss` 迁到 `tabs.scss`，
> 但**保留了 `body#{mx.$bc}` 作用域**，编译产物全量 diff 零差异；然而审计里
> `workspace-tab-*` 仍显示为分裂（作用域没变）。这说明归并修复的是**文件归属**，
> 审计的 split 计数不会因此下降——**切勿把「降低 split 数」当作归并的 KPI**。

---

## 3. 作用域重叠清单（修正后，v2 审计）

> **修正（2026-07-21）**：下表数字已用 v2 审计脚本重算。格式为 `组件  旗舰层 / base层`，
> 合计降序。**这仅是「作用域重叠清单」（见 §2.1），是两层设计的固有结果，
> 不是缺陷计数，也不是归并 KPI。** 真正的风险是「文件碎片化」与「同属性跨层静默覆盖」，
> 需结合源文件归属逐组件判断（见 §5）。

### 3.1 高重叠（合计 ≥ 30，仅供参考）
| 组件 | 旗舰层 | base 层 | 备注 |
|---|---:|---:|---|
| `.modal` | 41 | 146 | 对话框体系；base 散落 dialog/root/settings 等多文件 |
| `.workspace-leaf-content` | 14 | 55 | |
| `.workspace-tabs` | 27 | 41 | tab 系统核心 |
| `.menu` | 21 | 43 | 搜索/命令面板（base 在 dialog.scss）|
| `.markdown-preview-view` | 2 | 57 | |
| `.workspace-drawer` | 17 | 40 | |
| `.view-content` | 3 | 48 | |
| `.suggestion-container` | 16 | 31 | 搜索/命令面板 |
| `.prompt` | 15 | 29 | |
| `.clickable-icon` | 14 | 27 | 旗舰规则合理寄居通用 `bamboo-china.scss`（无专属旗舰文件；其 hover 与 `.modal-close-button` 等合并写在「图标 hover 统一块」，拆分破坏内聚，非真 stray）|
| `.vertical-tab-nav-item` | 9 | 31 | |
| `.workspace-ribbon` | 6 | 27 | |
| `.workspace-tab-header-container-inner` | 5 | 27 | ✅ 已归并→tabs.scss（文件归属，作用域仍重叠）|
| `.setting-item` | 4 | 27 | |
| `.markdown-rendered` | 1 | 29 | |
| `.menu-item` | 15 | 14 | |
| `.sidebar-toggle-button` | 5 | 23 | ✅ 已归并→tabs.scss |
| `.workspace-tab-header` | 14 | 14 | ✅ 已归并→tabs.scss |
| `.vertical-tab-nav-item-icon` | 3 | 23 | |
| `.checkbox-container` | 7 | 17 | |
| `.workspace-tab-header-container` | 6 | 18 | ✅ 已归并→tabs.scss |
| `.markdown-source-view` | 3 | 19 | |
| `.nav-header` | 3 | 19 | |
| `.view-actions` | 5 | 17 | |
| `.nav-buttons-container` | 7 | 14 | |
| `.suggestion-item` | 8 | 13 | |
| `.workspace-split` | 4 | 17 | 旗舰块 `.workspace-split.mod-root` 合理寄居通用 `bamboo-china.scss`（无专属旗舰文件；同组件 `.mod-vertical` 已在 `layouts/bamboo-china.scss`，本即布局语义，非真 stray）|

> 完整 100 个重叠组件由 `node scripts/audit_cascade.mjs` 输出（按合计降序）。

### 3.2 关于「归并」的真相（必读）

初版把 `.modal` 列为「优先归并」是错误的引导。检验结论：

- **`.modal` 不应整体迁移**。其 base 在 `dialog.scss`、旗舰在 `bamboo-china-dialog.scss`
  ——这已是「base + 专属旗舰文件」的正确配对。曾尝试把旗舰块迁入 `dialog.scss`
  以追求「单文件归属」，但 `dialog.scss` 导入极早（:5），迁入后 `bamboo-china.scss`(:29)
  里的 3 条 `.modal*` 规则会反向压过它；且纯位置迁移的 diff 无法证明级联不变，
  **已回退**。`.modal` 当前的跨文件分布（dialog + bamboo-china-dialog）已是正确形态；
  通用文件里残留的 `.modal*` 仅顺带写在 theme-dark 变量块 / 图标 hover 块中，与同块
  上下文强耦合，**不宜**拆出（见 §5.3 侦察结论）。
- **`workspace-tab-*` / `sidebar-toggle-button` 才是真正「错文件」的案例**：其旗舰块
  被埋在**通用** `bamboo-china.scss`（而非专属旗舰文件），与 base `tabs.scss` 分离。
  迁回 `tabs.scss` 后 base 文件导入虽早（:3），但该家族选择器未被任何更晚文件触碰，
  故编译产物全量 diff 零差异、级联不变——这是**安全归并的范式**。

> 结论：归并只应在「目标 base 文件导入足够早、且被迁选择器不被更晚文件反向覆盖」
> 时执行；否则宁可不迁。字节级 diff 零差异 = 安全，但**位置迁移的 diff 零差异 ≠ 级联不变**，
> 必须额外确认「无更晚文件对相同选择器有更高优先级规则」。

---

## 4. 贡献者操作清单（PR 前自检）

- [ ] 我要改的组件属于上表哪个？若出现在表中，说明它**跨两层**。
- [ ] 我的改动目标是 mac/自适应关闭外观吗？是 → 改 `elements/bamboo-china*.scss`；否（Win/Linux 回退）→ 改 `app/*.scss`。
- [ ] 改完后，是否可能让另一层（未改的那层）出现视觉裂开？必要时两侧同步。
- [ ] 是否引入了 `!important`？非 a11y 必需则禁止（参见 7/20 复盘，`!important` 已压到 10 处）。
- [ ] 是否在同一组件上新增了会与旗舰层冲突的 base 规则？若是，移到旗舰层或用 `body#{mx.$bc}` 显式分支。

---

## 5. remediation 计划（S1' 落地）

1. **本契约入档**（本文）+ 在 `README` 加一句指向本文件的链接。✅ 已完成
2. **组件级归并（范式已验证，但范围要收窄）**：
   - ✅ **首轮已完成**（2026-07-21）：`workspace-tab-*` / `sidebar-toggle-button` 家族从通用 `bamboo-china.scss` 迁回 `tabs.scss`，编译产物全量 diff 零差异。这是**安全归并范式**（目标 base 文件导入早、被迁选择器不被更晚文件反向覆盖）。
   - ⚠️ **`.modal` 经检验不应整体迁移**（2026-07-21）：其 base(`dialog.scss`)+旗舰(`bamboo-china-dialog.scss`) 已是正确配对；整体迁入 `dialog.scss` 会因导入过早导致 `bamboo-china.scss`(:29) 的 3 条 `.modal*` 规则反向压过，且位置迁移 diff 无法证明级联不变——**已回退**。
   - 🔸 **真正该修的是「错文件 stray 规则」**（见 §5.2），而非整体迁移成对组件。
3. **「清理通用文件 stray」计划经侦察撤销**（2026-07-21）：逐条核查 `elements/bamboo-china.scss` 中被标为 stray 的旗舰规则后，发现它们**都不是真 stray**，机械迁移收益为零甚至破坏内聚：
   - `.workspace-split.mod-root`（:7-26）：组件无专属旗舰文件，寄居通用旗舰文件合理；同组件 `.mod-vertical` 已在 `layouts/bamboo-china.scss`，本即布局语义。
   - `.modal.mod-sidebar-layout` 的 `--background-modifier-border`（:102）：写在 `&.is-mobile.theme-dark` **变量块**内，与 `bamboo-china-dialog/settings` 的 `:not(.is-mobile)` 作用域**互斥不冲突**；拆出会破坏「theme-dark 变量集中」内聚。
   - `.modal-close-button:hover` / `.modal-header-button:hover`（:157-161）：与 `.clickable-icon:hover` 合并在**图标 hover 统一块**；抽离破坏内聚。
   - `.workspace-ribbon.mod-left ...`（:303-306）：ribbon 图标 hover，无专属文件，合理寄居；`.workspace-leaf-content[data-mode]`（:338-345）/ 模式按钮（:347-351）：编辑器/侧栏语义，无专属旗舰文件。
   - **真 stray 判定标准**：组件**已有专属旗舰文件**（如 modal→dialog、settings→settings、prompt→prompt），但规则却散在通用 `bamboo-china.scss`。经核查，本文件不存在此类独立块——残留的 `.modal*` 均是与通用块强耦合的顺带规则。
   - **结论**：保留这些规则不动。真正该守的纪律是「新增组件才有专属文件时归位」+「防同属性跨层静默覆盖」（见 §5.4）。
4. **给 bamboo 层加文档头**：在 `elements/bamboo-china.scss` 顶部用注释声明「本文件管辖：mac/自适应关闭的 Cupertino 外观；勿在此写 Win/Linux 专属规则；非 tab/modal/settings/prompt 专属的旗舰块不要塞这里」。
5. **把审计脚本固化进仓库 + 正确的 CI 护栏**：`audit_cascade.mjs` 已在 `scripts/`。CI 护栏应断言：
   - **旗舰层规则数在窄带内**（当前 285，允许 ±30）：防止「误把 base 规则包进 `body#{mx.$bc}` 作用域」——这正是初版 3 轮调试的根因（在 base 改，mac 命中旗舰）。
   - **base 层规则数在窄带内**（当前 1336，允许 ±50）。
   - **重叠组件清单为已知 allowlist**（当前 100），新增需显式说明。
   - ✅ **已落地 `scripts/verify_build.mjs`**（2026-07-21）：build 后将工作区 `theme.css` 与 `git show HEAD:theme.css` 逐字节比对，不一致即非零退出。它专防「scss 改了却忘了重新 build / 提交 theme.css」——Obsidian 加载到陈旧产物，表现为「改了不生效」（与级联错位是不同根因、同症状）。CI 串接：`npm run build && node scripts/verify_build.mjs`。
   - ✅ **已增强 `scripts/audit_cascade.mjs`**（2026-07-21，v3）：除层规则数 / 分裂组件外，新增「**跨层同属性覆盖**」精准检测——解析编译产物每个叶子规则的声明体，对两层都出现的组件（split 集）归集「属性 → {旗舰层取值集, base 层取值集}」，当某属性两层都声明且取值集不同即列入 **REVIEW 审查清单**。这正是契约 §2 核心风险的可量化形态：在 base 改了某属性，mac（旗舰层更具体）命中覆盖值 → 表现为「改了不生效」。当前结果：覆盖清单绝大多数为 `.workspace-tab*` 等有意的 mac 覆盖（设计预期），`redundant`（两层取值完全相同，复制粘贴式重复）为 **0**——后者可作硬性护栏（出现即 bug）。
   > 注意：不要断言「分裂数不增」作为 KPI——归并修复的是文件归属，不会改变作用域重叠计数（见 §2.1）。
6. **后续**：配合视觉回归（Playwright fixture，见 7/20 复盘 S2）防止「改 A 坏 B」。

---

## 6. 审计方法（可复现）

```bash
node scripts/audit_cascade.mjs   # 解析编译后 theme.css，输出两层规则数与分裂组件清单
```

方法：编译后 `theme.css` 为 sass expanded 产物。脚本 v2 为**逐括号扫描**（正则 `/([^{}]+)([{}])/g`，对每个 `{` 单独入栈、`}` 单独出栈，正确穿透嵌套与一行多括号），对每行规则判定其选择器（或祖先作用域）是否含 `:is(.mod-macos, .adaptive-mode-off)`，含则归「旗舰层」，否则归「base 层」；取两层组件类交集为「重叠组件」。已剔除 `theme-dark`/`theme-light`/`*-off`/`has-*` 等纯作用域/状态类以避免噪声。

> ⚠️ 历史坑：脚本 v1 按「行」处理，一行多括号时只 `push` 1 次却 `pop` 多次，造成括号栈下溢、后续所有规则层归属错乱，曾输出完全颠倒的「1172 / 445 / 82」。v2 已修复，当前真实值为 **285 / 1336 / 100**。若再次看到 ~1172/445 这类数字，先怀疑脚本而非主题。
