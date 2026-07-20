# Bamboo China — 官方合规整改计划（2026-07-20）

> 目标：对照 Obsidian 官方三份规则（Submit your theme / Theme guidelines / Developer policies），
> 修复复盘文档 `docs/REVIEW-2026-07-20.md` 中全部剩余问题，使主题达到"可提交、护栏有效、与官方对齐"。
> 用户已决策：(1) 删除 README，暂不重写；(2) `!important` **激进削减到接近 0**；(3) **暂不处理 CI**（无 git remote）。

## 设计决策（已与用户确认）
- **`!important` 策略**：全量移除源文件中的 `!important`，**仅保留 a11y 保护性声明**——位于
  `@media (prefers-reduced-motion: reduce)`、`.reduce-motion` 手动开关、以及 `@supports not (interpolate-size)` 版本提示块内的 `!important`。
  其余全部剥离。最终计数将远低于基线（"接近 0"）。**风险**：剥离后可能暴露 Obsidian 默认样式，需在本机 Obsidian 内做视觉回归（用户已知晓并接受）。
- **CI**：暂不配置（无 remote）。仅修复本地护栏脚本，使其真实生效。

## 任务清单
1. 删除 `README.md`（用户要求，暂不重写）。
2. `LICENSE.txt` → `LICENSE`；补回上游 Cupertino（kepano, MIT）版权声明与衍生说明，与作者声明并列。修复 README 坏链（README 已删，故只需确保 LICENSE 文件名合规）。
3. `versions.json`：删除非法版本号 `"3.2.1.0"`（四段非 semver）。
4. `manifest.json`：补充 `authorUrl: "https://github.com/miaoziguan"`（由 git 作者邮箱推导，真实存在）。
5. `scripts/check-palette-contrast.mjs`：正则改为匹配 `body.cn-NAME.theme-light(:not(.is-mobile))?`；解析器支持 `rgb/var/hex`（意境 accent 与背景均为此类，无需解析 color-mix）；按意境合并 accent+背景算 WCAG 对比度；解析失败报错而非静默通过。
6. `scripts/gen-accent-aa.mjs`：正则同步修正；去除 `mx.$bc` 作用域（平台无关，与调色板重构一致）；**非破坏性**——仅再生"意境"区块，保留手维护的默认区块（用哨兵注释界定）；移除硬编码背景、改用各意境真实背景。
7. `src/color-schemes/accent-high-contrast.scss`：加哨兵注释分区；去除 `mx.$bc`；删除死代码重复默认块（顶部 12–23 行被 216–227 覆盖）。
8. 激进削减 `!important`（保留 a11y 区块），重建。
9. `scripts/check-css.mjs`：基线更新为削减后的计数，并加注释说明"接近 0 为目标，避免回升"。
10. `cupertino.png` → `screenshot.png`（商店展示命名合规）。
11. 重建 + 跑全套测试至全绿。
12. 更新 `docs/REVIEW-2026-07-20.md` 状态；提交（本地 git 作为回滚安全网）。

## 验收（Definition of Done）
- `npm run build` 成功；`npm test` 全绿（对比度脚本解析到 >0 个调色板、强调色生成非破坏性、!important 计数 <= 新基线）。
- `LICENSE` 存在且含 Cupertino 与作者双版权；`versions.json` 全为合法 semver；`manifest.json` 含 authorUrl。
- 源码中 `!important` 仅存 a11y 保护性少数几处。
- 无 `README.md`、无 `LICENSE.txt`、无 `cupertino.png`。
