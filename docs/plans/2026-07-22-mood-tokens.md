# Plan: 意境 Mood 单一来源 + 跨皮肤注入

> **状态（2026-07-24 盘点）：S2 已完成；S1 因单皮肤重构而失去意义。归档。**
> - T1/T2/T3/T5/T6 ✅：`_mood-tokens.scss` 单一来源已落地，`verify-mood-parity.mjs`
>   已挂入 `npm run build`（每次构建强制 parity，96 rules）。实现与设计有一处偏离：
>   实际引入了 `scripts/gen-mood-tokens.mjs` 生成步骤（设计原定纯 Sass `@each`），
>   属实现细节替换，验收等价。
> - T4（Material/Adwaita 注入 `--mood-accent`）❌ **废弃**：这两套皮肤已在
>   2026-07-24 单皮肤重构中整体删除，"mood 统御所有皮肤"命题自动成立
>   （只剩 Bamboo China 一套，mood 天然生效）。

Date: 2026-07-22
Design: ./2026-07-22-mood-tokens-design.md (Approved)
Workflow: superpowers — Manual TDD (环境无 sessions_spawn，手动遵循 Red→Green→Commit)

## Tasks

### T1 · parity 校验脚本（TDD 基线）
- 新建 `scripts/verify-mood-parity.mjs`：
  - 读 `theme.css`，去换行归一化；正则提取所有 `body.cn-*` 选择器块
    （含 `.theme-light/-dark` × `:not(.is-mobile)`/`.is-mobile` 变体）。
  - 每个块 → 规范化键（`cn-name.theme-X[.mobile]`）+ 声明集合（去空格/逗号、排序）。
  - 支持 `--update`：从当前 `theme.css` 生成 `scripts/mood-parity-baseline.json`。
  - 不带 `--update`：与 baseline 比对，不一致则列出 diff 并 exit 1。
- 运行 `--update` 生成 baseline（锁定重构前 golden）。

### T2 · map 骨架 + moye 示范迁移（验证机制）
- 新建 `src/color-schemes/_mood-tokens.scss`：定义共享常量
  （中性 interactive、light 画布 `#fff`、`--mood-accent*` 语义锚点占位）
  + `$moods` map（先仅 `moye` 全套值，按 design 第 4 节 schema）。
- 改写 `bamboo-china-palettes.scss`：用 `@use "color-schemes/mood-tokens"` +
  `@each` 生成 `body.cn-moye.*` 六块；其余 15 套保留手写（临时）。
- `npm run build` → `node scripts/verify-mood-parity.mjs`（应仅验证 moye，
  但脚本比对全部；因其余仍手写故需先全迁才能整体 pass，见 T3）。
- 折中：T2 先全迁但仅以 moye 验证脚本正确性——直接进 T3 全量迁移，parity 验证。

### T3 · 批量迁移其余 15 套
- 把 bamboo-china / qinglu / yanzhi … 共 16 套全部迁入 `$moods` map。
- `npm run build` → `node scripts/verify-mood-parity.mjs` 必须全绿
  （逐 mood × 模式声明与 baseline 一致）。
- 失败则按 diff 定位遗漏 token，修正后重跑。

### T4 · S1 跨皮肤注入
- `src/color-schemes/material.scss`：light/dark 的 `--interactive-accent` /
  `-hover` / `--text-accent*` 改为 `var(--mood-accent, <原平台默认>)` 等。
- `src/color-schemes/adwaita.scss`：同理改 `--interactive-accent` / `--text-accent`。
- Fluent / Baseline 不改（继承 Bamboo，mood 已生效）。
- parity 复验（mood 声明不变）+ 确认 `--mood-accent` 锚点在 `body.cn-*` 生成。

### T5 · 全量门禁
- `npm test`（check-css / contrast / a11y / audit_cascade / check-size）全绿；
  `theme.css` 体积变化 < 1%。
- 必要时重跑 `verify-mood-parity.mjs --update`（若 intentionally 调整了值）。

### T6 · 提交
- 每个 green 里程碑频繁 commit；最终提交设计文档 + 计划 + 代码。
- 不自动 push（用户未要求）。

## 验收（同 design §9）
1. parity 全绿；2. npm test 全绿；3. theme.css 体积持平；4. mood accent 统御所有皮肤。
