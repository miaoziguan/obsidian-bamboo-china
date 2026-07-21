// 级联碎片化审计：解析编译后的 theme.css，统计
//   - 旗舰层（mac/自适应关闭，选择器含 :is(.mod-macos, .adaptive-mode-off)）规则数
//   - base/回退层规则数
//   - 在两层都有样式的「分裂组件」清单
//   - 「跨层同属性覆盖」：同一组件在旗舰层与 base 层都声明了同一 CSS 属性但取值不同
//     ——这是契约 §2 的核心风险：在 base 改了某属性，mac（旗舰层）命中更具体的覆盖值，
//     表现为「改了不生效」。本检测把这些点精准列成审查清单（非硬性失败）。
//
// 用法：node scripts/audit_cascade.mjs
//
// 解析器正确性说明（v3 重写）：
//   v1 按「行」处理，一行内多个 { 只 push 1 次却 pop 多次，造成括号栈下溢、
//   后续所有规则的层归属错乱，计数完全不可信。
//   v2 改为逐括号扫描（正则 /([^{}]+)([{}])/g），对每个 { 单独入栈、每个 } 单独出栈，
//   正确处理嵌套与一行多括号，层归属（是否处于 :is(.mod-macos, .adaptive-mode-off)
//   祖先作用域内）因此准确。
//   v3 在同一遍括号扫描上叠加「声明体解析」：叶子（非 @）规则的闭合 token 的
//   prelude 即其声明体，用 /([\w-]+)\s*:\s*([^;{}]+);/g 提取 属性:值，按组件归集，
//   再与「两层都出现的组件」求交，得到跨层同属性覆盖清单。
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

// ---- 第一遍：层归属 + 组件计数 -------------------------------------------
// 逐括号扫描，维护作用域栈
const stack = []; // 每项: { isBamboo:boolean, isAt:boolean, comps:Set }
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

  let comps = new Set();
  if (!isAt) {
    // 仅选择器块计入「规则」与「组件」
    comps = compsOf(prelude);
    const target = isBamboo ? bambooComps : baseComps;
    for (const c of comps) target.set(c, (target.get(c) || 0) + 1);
    if (isBamboo) rulesBamboo++; else rulesBase++;
  }
  stack.push({ isBamboo, isAt, comps });
}

const splitSet = new Set(
  [...bambooComps.keys()].filter(c => baseComps.has(c))
);
const split = [...splitSet].sort();

// ---- 第二遍：声明体解析，归集「跨层同属性覆盖」 ---------------------------
// 仅对两层都出现的组件（splitSet）做声明归集，避免噪声。
const declMap = new Map(); // comp -> Map(prop -> { bamboo:Set, base:Set })

function recordDecl(comp, prop, value, isBamboo) {
  let pm = declMap.get(comp);
  if (!pm) { pm = new Map(); declMap.set(comp, pm); }
  let slot = pm.get(prop);
  if (!slot) { slot = { bamboo: new Set(), base: new Set() }; pm.set(prop, slot); }
  (isBamboo ? slot.bamboo : slot.base).add(value);
}

const declRe = /([\w-]+)\s*:\s*([^;{}]+);/g;
const stack2 = [];
let m2;
const tokenRe2 = /([^{}]+)([{}])/g;
while ((m2 = tokenRe2.exec(css)) !== null) {
  const preludeRaw = m2[1];
  const brace = m2[2];
  if (brace === '}') {
    if (!stack2.length) continue;
    const rule = stack2.pop();
    // 叶子（非 @）规则闭合时，其 prelude 即声明体
    if (!rule.isAt) {
      const body = preludeRaw;
      let d;
      declRe.lastIndex = 0;
      while ((d = declRe.exec(body)) !== null) {
        const prop = d[1].trim();
        const value = d[2].trim();
        if (!value) continue;
        for (const c of rule.comps) {
          if (!splitSet.has(c)) continue; // 只关心两层都出现的组件
          recordDecl(c, prop, value, rule.isBamboo);
        }
      }
    }
    continue;
  }
  const prelude = preludeRaw.trim();
  const isAt = prelude.startsWith('@');
  const parentB = stack2.length ? stack2[stack2.length - 1].isBamboo : false;
  const isBamboo = isAt ? parentB : (MARK.test(prelude) || parentB);
  let comps = new Set();
  if (!isAt) comps = compsOf(prelude);
  stack2.push({ isBamboo, isAt, comps });
}

// 计算跨层同属性覆盖：同一组件、同一属性，两层都声明且取值集合不同
const overrides = [];
for (const comp of split) {
  const pm = declMap.get(comp);
  if (!pm) continue;
  for (const [prop, slot] of pm) {
    if (!slot.bamboo.size || !slot.base.size) continue; // 只在一层声明 → 非覆盖
    const b = slot.bamboo, s = slot.base;
    const differs =
      [...b].some(v => !s.has(v)) || [...s].some(v => !b.has(v));
    if (differs) {
      overrides.push({
        comp,
        prop,
        bamboo: [...b],
        base: [...s]
      });
    }
  }
}
overrides.sort((a, b) => (a.comp < b.comp ? -1 : a.comp > b.comp ? 1 : a.prop < b.prop ? -1 : 1));

// 计算「跨层同属性冗余」：取值集合完全相同（复制粘贴式重复，可作硬性护栏）
const redundant = overrides
  .filter(o => o.bamboo.length === o.base.length &&
    o.bamboo.every(v => o.base.includes(v)))
  .map(o => o.comp + ' { ' + o.prop + ' }');

// ---- 输出 -----------------------------------------------------------------
console.log('bamboo-scoped rules:', rulesBamboo);
console.log('base-scoped rules  :', rulesBase);
console.log('split components   :', split.length);
console.log('--- split component list (appears in BOTH bamboo & base scopes) ---');
const rows = split.map(c => ({ c, b: bambooComps.get(c) || 0, s: baseComps.get(c) || 0 }));
rows.sort((x, y) => (y.b + y.s) - (x.b + x.s));
for (const r of rows) {
  console.log(`${r.c}\tbamboo:${r.b}\tbase:${r.s}`);
}

console.log('\n--- cross-layer same-property overrides (REVIEW watchlist) ---');
console.log('cross-layer overrides:', overrides.length);
console.log('  (同一组件、同一属性在旗舰层与 base 层均声明且取值不同；');
console.log('   在 mac 上旗舰层更具体 → 命中覆盖值，base 改动对该组件此属性不可见)');
for (const o of overrides) {
  console.log(`${o.comp} { ${o.prop} }  bamboo=[${o.bamboo.join(', ')}]  base=[${o.base.join(', ')}]`);
}

console.log('\n--- cross-layer redundant (same value both layers; candidate hard-guard) ---');
console.log('redundant overrides:', redundant.length);
for (const r of redundant) console.log(r);
