// 级联碎片化审计：解析编译后的 theme.css，对「每个皮肤作用域 vs 全局 base 层」
// 统计：
//   - 各皮肤作用域规则数 / base 层规则数
//   - 在两者都有样式的「分裂组件」清单
//   - 「跨层同属性覆盖」：同一组件在皮肤层与 base 层都声明了同一 CSS 属性但取值不同
//     ——这是契约 §2 的核心风险：在 base 改了某属性，皮肤层命中更具体的覆盖值，
//       表现为「改了不生效」。本检测把每个皮肤的点精准列成审查清单（非硬性失败）。
//
// 皮肤作用域由编译后选择器中的激活标记识别：
//   bamboo  : :is(.mod-macos, .adaptive-mode-off)   （mac 布局 / 自适应关闭 → 旗舰 Bamboo China）
//   material: is-android:not(.adaptive-mode-off)    （Android + 自适应开启）
//   fluent  : mod-windows:not(.adaptive-mode-off)   （Windows + 自适应开启）
//   adwaita : mod-linux:not(.is-android):not(.adaptive-mode-off) （Linux + 自适应开启）
//   base    : 不含上述任何标记的规则（默认基底，由 baseline.scss 的 body{} 提供）
//
// Fluent / Baseline 是「纯形状」皮肤（不重定义任何颜色 token，继承 Bamboo China 调色板），
// 因此它们命中 base 层的颜色声明与 Bamboo 一致；其分裂/覆盖清单同样在此审计，便于发现
// 形状层对 base 层属性的意外覆盖。
//
// 用法：node scripts/audit_cascade.mjs
//
// 解析器正确性说明（v4 重写：从「仅旗舰层」扩展到「每个皮肤层」）：
//   逐括号扫描（正则 /([^{}]+)([{}])/g），对每个 { 单独入栈、每个 } 单独出栈，
//   正确处理嵌套与一行多括号，层归属（是否处于某皮肤激活标记的祖先作用域内）因此准确。
//   同一遍括号扫描上叠加「声明体解析」：叶子（非 @）规则的闭合 token 的 prelude 即其
//   声明体，用 /([\w-]+)\s*:\s*([^;{}]+);/g 提取 属性:值，按组件归集，再与「两层都出现的
//   组件」求交，得到跨层同属性覆盖清单。
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(__dir, '..', 'theme.css');
const css = readFileSync(cssPath, 'utf8');

// 皮肤激活标记（编译后选择器）。顺序即输出顺序。
const SKINS = [
  { name: 'bamboo', re: /:is\(\.mod-macos,\s*\.adaptive-mode-off\)/ },
  { name: 'material', re: /is-android:not\(\.adaptive-mode-off\)/ },
  { name: 'fluent', re: /mod-windows:not\(\.adaptive-mode-off\)/ },
  { name: 'adwaita', re: /mod-linux:not\(\.is-android\):not\(\.adaptive-mode-off\)/ },
];
const SKIN_NAMES = [...SKINS.map((s) => s.name), 'base'];

// 纯作用域 / 状态类，不视为「组件」，从分裂清单中剔除以避免噪声
const DENY = new Set([
  'is-mobile', 'is-phone', 'mod-macos', 'adaptive-mode-off', 'mod-sidedock',
  'mod-left-split', 'mod-right-split', 'mod-top-left-space', 'mod-top-right-space',
  'mod-root', 'is-hidden', 'is-active', 'is-phone', 'is-touch-support', 'mod-rtl',
  'is-popout-window', 'mod-windows', 'mod-linux', 'show-view-header',
  'is-tablet', 'is-fullscreen', 'mod-translucency', 'mod-fade', 'workspace',
  'theme-dark', 'theme-light', 'dynamic-type-off', 'mode-switcher-off', 'has-active-menu'
]);

// 组件计数 / 规则计数，按皮肤分层
const compsBySkin = {};
const rulesBySkin = {};
for (const n of SKIN_NAMES) { compsBySkin[n] = new Map(); rulesBySkin[n] = 0; }

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

function skinOf(prelude) {
  for (const s of SKINS) if (s.re.test(prelude)) return s.name;
  return null;
}

// ---- 第一遍：层归属 + 组件计数 -------------------------------------------
const stack = []; // 每项: { skin:string|null, isAt:boolean, comps:Set }
const tokenRe = /([^{}]+)([{}])/g;
let mt;
while ((mt = tokenRe.exec(css)) !== null) {
  const preludeRaw = mt[1];
  const brace = mt[2];
  if (brace === '}') {
    if (stack.length) stack.pop();
    continue;
  }
  const prelude = preludeRaw.trim();
  const isAt = prelude.startsWith('@');
  const parentSkin = stack.length ? stack[stack.length - 1].skin : null;
  // @规则透传父作用域；选择器块则：自身含皮肤标记，或处于皮肤祖先内 → 归该皮肤层。
  const skin = isAt ? parentSkin : (skinOf(prelude) || parentSkin);

  let comps = new Set();
  if (!isAt) {
    comps = compsOf(prelude);
    const target = skin || 'base';
    for (const c of comps) compsBySkin[target].set(c, (compsBySkin[target].get(c) || 0) + 1);
    rulesBySkin[target]++;
  }
  stack.push({ skin, isAt, comps });
}

// 每个皮肤层 vs base 的分裂组件集
const splitBySkin = {};
for (const s of SKINS) {
  splitBySkin[s.name] = new Set(
    [...compsBySkin[s.name].keys()].filter((c) => compsBySkin.base.has(c))
  );
}

// ---- 第二遍：声明体解析，归集「跨层同属性覆盖」 ---------------------------
const declsBySkin = {}; // skin -> comp -> Map(prop -> Set(value))
for (const n of SKIN_NAMES) declsBySkin[n] = new Map();
const splitAll = new Set();
for (const s of SKINS) for (const c of splitBySkin[s.name]) splitAll.add(c);

function recordDecl(comp, prop, value, skin) {
  let pm = declsBySkin[skin].get(comp);
  if (!pm) { pm = new Map(); declsBySkin[skin].set(comp, pm); }
  let slot = pm.get(prop);
  if (!slot) { slot = new Set(); pm.set(prop, slot); }
  slot.add(value);
}

const declRe = /([\w-]+)\s*:\s*([^;{}]+);/g;
const stack2 = [];
const tokenRe2 = /([^{}]+)([{}])/g;
let m2;
while ((m2 = tokenRe2.exec(css)) !== null) {
  const preludeRaw = m2[1];
  const brace = m2[2];
  if (brace === '}') {
    if (!stack2.length) continue;
    const rule = stack2.pop();
    if (!rule.isAt) {
      const body = preludeRaw;
      let d;
      declRe.lastIndex = 0;
      while ((d = declRe.exec(body)) !== null) {
        const prop = d[1].trim();
        const value = d[2].trim();
        if (!value) continue;
        for (const c of rule.comps) {
          // base 层：仅关心出现在任一皮肤分裂集里的组件
          if (rule.skin === null) {
            if (!splitAll.has(c)) continue;
            recordDecl(c, prop, value, 'base');
          } else {
            // 皮肤层：仅关心该皮肤自身的分裂组件
            if (!splitBySkin[rule.skin].has(c)) continue;
            recordDecl(c, prop, value, rule.skin);
          }
        }
      }
    }
    continue;
  }
  const prelude = preludeRaw.trim();
  const isAt = prelude.startsWith('@');
  const parentSkin = stack2.length ? stack2[stack2.length - 1].skin : null;
  const skin = isAt ? parentSkin : (skinOf(prelude) || parentSkin);
  let comps = new Set();
  if (!isAt) comps = compsOf(prelude);
  stack2.push({ skin, isAt, comps });
}

// 计算某皮肤的跨层同属性覆盖 / 冗余
function analyzeSkin(skinName) {
  const overrides = [];
  const redundant = [];
  for (const comp of splitBySkin[skinName]) {
    const pm = declsBySkin[skinName].get(comp);
    const basePm = declsBySkin.base.get(comp);
    if (!pm || !basePm) continue;
    for (const [prop, skinVals] of pm) {
      const baseVals = basePm.get(prop);
      if (!baseVals) continue; // 只在一层声明 → 非覆盖
      const differs =
        [...skinVals].some((v) => !baseVals.has(v)) || [...baseVals].some((v) => !skinVals.has(v));
      if (differs) {
        overrides.push({ comp, prop, skin: [...skinVals], base: [...baseVals] });
      } else if (skinVals.size === baseVals.size) {
        redundant.push(`${comp} { ${prop} }`);
      }
    }
  }
  overrides.sort((a, b) => (a.comp < b.comp ? -1 : a.comp > b.comp ? 1 : a.prop < b.prop ? -1 : 1));
  return { overrides, redundant };
}

// ---- 输出 -----------------------------------------------------------------
console.log('=== rules per layer ===');
for (const n of SKIN_NAMES) console.log(`${n.padEnd(8)}: ${rulesBySkin[n]}`);

for (const s of SKINS) {
  const split = [...splitBySkin[s.name]].sort();
  const { overrides, redundant } = analyzeSkin(s.name);
  console.log(`\n=== ${s.name} skin (vs base) ===`);
  console.log(`split components : ${split.length}`);
  const rows = split.map((c) => ({ c, k: compsBySkin[s.name].get(c) || 0, b: compsBySkin.base.get(c) || 0 }));
  rows.sort((x, y) => (y.k + y.b) - (x.k + x.b));
  for (const r of rows) console.log(`${r.c}\t${s.name}:${r.k}\tbase:${r.b}`);

  console.log(`\n--- ${s.name}: cross-layer same-property overrides (REVIEW watchlist) ---`);
  console.log(`cross-layer overrides: ${overrides.length}`);
  console.log('  (同一组件、同一属性在皮肤层与 base 层均声明且取值不同；');
  console.log('   在对应平台上皮肤层更具体 → 命中覆盖值，base 改动对该组件此属性不可见)');
  for (const o of overrides) {
    console.log(`${o.comp} { ${o.prop} }  ${s.name}=[${o.skin.join(', ')}]  base=[${o.base.join(', ')}]`);
  }

  console.log(`\n--- ${s.name}: cross-layer redundant (same value both layers; candidate hard-guard) ---`);
  console.log(`redundant overrides: ${redundant.length}`);
  for (const r of redundant) console.log(r);
}
