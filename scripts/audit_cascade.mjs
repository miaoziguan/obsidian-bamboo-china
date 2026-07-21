// 级联碎片化审计：解析编译后的 theme.css，统计
//   - 旗舰层（mac/自适应关闭，选择器含 :is(.mod-macos, .adaptive-mode-off)）规则数
//   - base/回退层规则数
//   - 在两层都有样式的「分裂组件」清单
// 用法：node scripts/audit_cascade.mjs
//
// 解析器正确性说明（v2 重写）：
//   v1 按「行」处理，一行内多个 { 只 push 1 次却 pop 多次，造成括号栈下溢、
//   后续所有规则的层归属错乱，计数完全不可信。
//   v2 改为逐括号扫描（正则 /([^{}]+)([{}])/g），对每个 { 单独入栈、每个 } 单独出栈，
//   正确处理嵌套与一行多括号，层归属（是否处于 :is(.mod-macos, .adaptive-mode-off)
//   祖先作用域内）因此准确。
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(__dir, '..', 'theme.css');
const css = readFileSync(cssPath, 'utf8');

// 旗舰层标记：mac 或 自适应关闭（与 src/_mixins.scss 的 $bc 一致），容忍空格差异
const MARK = /:is\(\.mod-macos,\s*\.adaptive-mode-off\)/;

// 纯作用域 / 状态类，不视为「组件」，从分裂清单中剔除以避免噪声
const DENY = new Set([
  'is-mobile', 'is-phone', 'mod-macos', 'adaptive-mode-off', 'mod-sidedock',
  'mod-left-split', 'mod-right-split', 'mod-top-left-space', 'mod-top-right-space',
  'mod-root', 'is-hidden', 'is-active', 'is-phone', 'is-touch-support', 'mod-rtl',
  'is-popout-window', 'mod-windows', 'mod-linux', 'show-view-header',
  'is-tablet', 'is-fullscreen', 'mod-translucency', 'mod-fade', 'workspace',
  'theme-dark', 'theme-light', 'dynamic-type-off', 'mode-switcher-off', 'has-active-menu'
]);

const bambooComps = new Map();
const baseComps = new Map();

function compsOf(sel) {
  const out = new Set();
  const re = /\.([a-zA-Z][\w-]*)/g;
  let m;
  while ((m = re.exec(sel))) {
    const c = m[1];
    if (DENY.has(c)) continue;
    if (/^(is|mod)-/.test(c)) continue;
    out.add('.' + c);
  }
  return out;
}

// 逐括号扫描，维护作用域栈
const stack = []; // 每项: { isBamboo:boolean, isAt:boolean }
let rulesBamboo = 0;
let rulesBase = 0;

const tokenRe = /([^{}]+)([{}])/g;
let mt;
while ((mt = tokenRe.exec(css)) !== null) {
  const preludeRaw = mt[1];
  const brace = mt[2];
  if (brace === '}') {
    if (stack.length) stack.pop();
    continue;
  }
  // 是 { ：开启一个块
  const prelude = preludeRaw.trim();
  const isAt = prelude.startsWith('@');
  const parentB = stack.length ? stack[stack.length - 1].isBamboo : false;
  // @规则（@media/@keyframes/@supports/@starting-style…）透传父作用域；
  // 选择器块则：自身含 MARK，或处于旗舰层祖先内 → 归旗舰层。
  const isBamboo = isAt ? parentB : (MARK.test(prelude) || parentB);

  if (!isAt) {
    // 仅选择器块计入「规则」与「组件」
    const comps = compsOf(prelude);
    const target = isBamboo ? bambooComps : baseComps;
    for (const c of comps) target.set(c, (target.get(c) || 0) + 1);
    if (isBamboo) rulesBamboo++; else rulesBase++;
  }
  stack.push({ isBamboo, isAt });
}

const split = [...new Set([...bambooComps.keys()].filter(c => baseComps.has(c)))].sort();
console.log('bamboo-scoped rules:', rulesBamboo);
console.log('base-scoped rules  :', rulesBase);
console.log('split components   :', split.length);
console.log('--- split component list (appears in BOTH bamboo & base scopes) ---');
// 合计降序输出，便于定位高风险
const rows = split.map(c => ({ c, b: bambooComps.get(c) || 0, s: baseComps.get(c) || 0 }));
rows.sort((x, y) => (y.b + y.s) - (x.b + x.s));
for (const r of rows) {
  console.log(`${r.c}\tbamboo:${r.b}\tbase:${r.s}`);
}
