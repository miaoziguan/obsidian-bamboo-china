#!/usr/bin/env node
// design-loop.mjs — 排版 / 布局细节问题「查找 → 修复 → 循环」
//
// 对 src/**/*.scss 运行一组「排版设计细节」审计器，定位问题；对带安全、确定性
// 修复的问题（auto 类，目前为 flex 子项截断缺 min-width:0 的溢出 bug）在 --apply
// 下自动修复并重建，随后重新审计，循环直到无可自动修复项或达到最大迭代。
//
// 设计原则（契合本主题一贯的审慎风格）：
//   - auto 类：修复是「无害且纠正真实 bug」的确定性变换，可放心自动应用。
//   - review 类：是「风格决策」（裸 px 字号、px 行高、magic 间距、z-index 魔法数、
//     重复声明等），只报告位置与建议，交由人工判断，绝不擅自改写设计意图。
//
// 用法：
//   node scripts/design-loop.mjs            # 仅报告（dry-run），不改动任何源码
//   node scripts/design-loop.mjs --apply    # 自动修复 auto 类问题并重建
//   node scripts/design-loop.mjs --max-iter=6
//   node scripts/design-loop.mjs --apply --no-build   # 应用修复但不重新 build
//
// 扩展：向 AUDITORS 数组追加一个 { id, title, severity, auto, detect(block) }
// 即可加入新的审计维度；detect 返回 Issue[]，auto 项可带 fix 以便 --apply 应用。

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const SRC = join(root, "src");

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const NO_BUILD = args.includes("--no-build");
const maxIter = (() => {
  const m = args.find((a) => a.startsWith("--max-iter="));
  return m ? parseInt(m.split("=")[1], 10) : 5;
})();

const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  grn: (s) => `\x1b[32m${s}\x1b[0m`,
  yel: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

// ── SCSS 块解析 ──────────────────────────────────────────────────────────────
// 用括号扫描把文件解析成规则块树；每个块记录 selector、文件级行号、以及「自身
// 深度（depth 0）」的声明列表（嵌套规则里的声明不计入，避免跨层误判）。

// 在一段「选择器/声明混合文本」中，提取声明（prop: value;）并把尾部剩余文本
// 当作选择器。字符串内的 `;` 与括号（url()/color-mix() 等）内的 `;` 均忽略，
// 避免 content: ";"; 之类误拆。声明归属到「当前打开的块」，尾部文本即嵌套块的选择器。
function extractDeclTexts(pre, startLine) {
  const decls = [];
  let i = 0;
  const n = pre.length;
  let buf = "";
  let quote = null;
  let paren = 0;
  let declStart = startLine;
  let curLine = startLine;
  while (i < n) {
    const ch = pre[i];
    if (quote) {
      if (ch === "\n") curLine++;
      if (ch === quote) quote = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      buf += ch;
      quote = ch;
      i++;
      continue;
    }
    if (ch === "(") {
      buf += ch;
      paren++;
      i++;
      continue;
    }
    if (ch === ")") {
      buf += ch;
      paren--;
      i++;
      continue;
    }
    if (ch === "\n") {
      curLine++;
      buf += ch;
      i++;
      continue;
    }
    if (ch === ";" && paren === 0) {
      const decl = buf.trim();
      if (decl && decl.includes(":")) {
        const ci = decl.indexOf(":");
        decls.push({ prop: decl.slice(0, ci).trim(), value: decl.slice(ci + 1).trim(), line: declStart });
      }
      buf = "";
      declStart = curLine;
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  return { decls, rest: buf.trim() };
}

function parseScss(text) {
  const top = [];
  const stack = []; // 当前打开的块链（栈顶即 current）
  let line = 1;
  const re = /([^{}]+)?([{}])/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const pre = m[1] || "";
    const brace = m[2];
    const newlines = (pre.match(/\n/g) || []).length;
    const startLine = line;
    line += newlines;
    if (brace === "{") {
      const { decls, rest } = extractDeclTexts(pre, startLine);
      const parent = stack[stack.length - 1] || null;
      if (parent) for (const d of decls) parent.decls.push(d);
      const block = { selector: rest, line: startLine, decls: [], children: [] };
      (parent ? parent.children : top).push(block);
      stack.push(block);
    } else {
      const { decls } = extractDeclTexts(pre, startLine);
      const block = stack.pop();
      if (block) for (const d of decls) block.decls.push(d);
    }
  }
  return top;
}

function* walkScss(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".codebuddy")) continue;
      yield* walkScss(p);
    } else if (/\.scss$/.test(entry)) {
      yield p;
    }
  }
}

const SPACING_PROPS = new Set([
  "padding", "margin", "gap",
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin-top", "margin-right", "margin-bottom", "margin-left",
]);

function pxTokens(value) {
  // 返回 value 中所有裸 px 数值（不含 var/calc/rem/%）
  if (/var\(|calc\(|rem|em|%|vh|vw/.test(value)) return [];
  const out = [];
  const re = /(-?\d+(?:\.\d+)?)px/g;
  let m;
  while ((m = re.exec(value)) !== null) out.push(parseFloat(m[1]));
  return out;
}

// ── 审计器注册表 ────────────────────────────────────────────────────────────
// 每个 detect(block) 返回 Issue[]：
//   { line, message, fix? }
// fix（仅 auto 类提供）= { afterLine, text }，--apply 时在该行之后插入 text。
const AUDITORS = [
  {
    id: "flex-truncation",
    title: "Flex/Grid 子项截断缺少 min-width:0（溢出 bug）",
    severity: "bug",
    auto: true,
    detect(block) {
      const ellipsis = block.decls.find((d) => d.prop === "text-overflow" && /ellipsis/.test(d.value));
      const ws = block.decls.find((d) => d.prop === "white-space");
      const overflow = block.decls.find((d) => d.prop === "overflow" && d.value === "hidden");
      const hasMinW = block.decls.find((d) => d.prop === "min-width" && /^0/.test(d.value));
      const truncatable = ws && (ws.value === "nowrap" || ws.value === "pre");
      if (ellipsis && truncatable && overflow && !hasMinW) {
        return [{
          line: overflow.line,
          message: "text-overflow:ellipsis + white-space:nowrap + overflow:hidden 但缺 min-width:0，flex/grid 子项会溢出而非截断",
          fix: { afterLine: overflow.line, text: "  min-width: 0;  /* design-loop: 允许 flex/grid 子项正确截断 */" },
        }];
      }
      return [];
    },
  },
  {
    id: "ellipsis-no-nowrap",
    title: "text-overflow:ellipsis 但缺 white-space:nowrap/pre（不生效）",
    severity: "review",
    auto: false,
    detect(block) {
      const ellipsis = block.decls.find((d) => d.prop === "text-overflow" && /ellipsis/.test(d.value));
      const ws = block.decls.find((d) => d.prop === "white-space");
      const truncatable = ws && (ws.value === "nowrap" || ws.value === "pre");
      if (ellipsis && !truncatable) {
        return [{ line: ellipsis.line, message: "声明了 text-overflow:ellipsis 但 white-space 既非 nowrap 也非 pre，单行截断不会生效（死声明）" }];
      }
      return [];
    },
  },
  {
    id: "font-size-bare",
    title: "裸 px/em 字号（未走类型比例 token）",
    severity: "review",
    auto: false,
    detect(block) {
      const out = [];
      for (const d of block.decls) {
        if (d.prop === "font-size" && /^\d/.test(d.value) && /px$/.test(d.value) && !/var\(/.test(d.value)) {
          out.push({ line: d.line, message: `裸字号 font-size: ${d.value}（建议在类型比例 token / calc() 上表达，便于动态字号与可读性）` });
        }
      }
      return out;
    },
  },
  {
    id: "line-height-px",
    title: "px 行高（应为无单位值）",
    severity: "review",
    auto: false,
    detect(block) {
      const out = [];
      for (const d of block.decls) {
        if (d.prop === "line-height" && /^\d+(\.\d+)?px$/.test(d.value)) {
          out.push({ line: d.line, message: `行高用 px（${d.value}）应为无单位值，否则缩放字号时行距不跟随` });
        }
      }
      return out;
    },
  },
  {
    id: "magic-spacing",
    title: "未落在 4px 栅格上的间距魔法数",
    severity: "review",
    auto: false,
    detect(block) {
      const out = [];
      for (const d of block.decls) {
        if (d.prop.startsWith("--")) continue; // token 定义为设计值来源，非魔法数
        if (!SPACING_PROPS.has(d.prop)) continue;
        for (const v of pxTokens(d.value)) {
          if (v > 2 && v % 4 !== 0) {
            const snap = Math.round(v / 4) * 4 || (v < 4 ? 4 : v);
            out.push({ line: d.line, message: `${d.prop}: ${d.value} — ${v}px 未落在 4px 栅格（就近 ${snap}px？），请确认是否刻意为之` });
          }
        }
      }
      return out;
    },
  },
  {
    id: "z-index-magic",
    title: "z-index 魔法数（建议 token 化）",
    severity: "review",
    auto: false,
    detect(block) {
      const out = [];
      for (const d of block.decls) {
        if (d.prop === "z-index" && /^\d+$/.test(d.value) && !/var\(/.test(d.value)) {
          out.push({ line: d.line, message: `z-index: ${d.value} 为魔法数，建议用层级 token（如 --layer-*) 以便统一管控` });
        }
      }
      return out;
    },
  },
  {
    id: "duplicate-decl",
    title: "同块内重复声明（前者被后者覆盖，死代码）",
    severity: "review",
    auto: false,
    detect(block) {
      const seen = new Map();
      const out = [];
      for (const d of block.decls) {
        if (d.prop.startsWith("--")) continue; // CSS 自定义属性常有意跨上下文重声明
        if (seen.has(d.prop)) {
          out.push({ line: d.line, message: `属性 ${d.prop} 在块内重复声明（首次位于第 ${seen.get(d.prop)} 行），前者为死代码` });
        } else {
          seen.set(d.prop, d.line);
        }
      }
      return out;
    },
  },
];

// ── 审计执行 ────────────────────────────────────────────────────────────────
function auditAll() {
  const issues = [];
  for (const file of walkScss(SRC)) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const rel = file.replace(root + "/", "");
    const blocks = parseScss(text);
    const flat = [];
    const collect = (arr) => {
      for (const b of arr) {
        flat.push(b);
        if (b.children.length) collect(b.children);
      }
    };
    collect(blocks);
    for (const b of flat) {
      if (b.decls.length === 0) continue;
      for (const a of AUDITORS) {
        let found = [];
        try {
          found = a.detect(b) || [];
        } catch {
          continue;
        }
        for (const f of found) {
          issues.push({ file: rel, line: f.line, rule: a.id, severity: a.severity, auto: a.auto, message: f.message, fix: f.fix });
        }
      }
    }
  }
  return issues;
}

// ── 应用修复 ────────────────────────────────────────────────────────────────
function applyFixes(issues) {
  const byFile = new Map();
  for (const i of issues) {
    if (!i.fix) continue;
    if (!byFile.has(i.file)) byFile.set(i.file, []);
    byFile.get(i.file).push(i);
  }
  let applied = 0;
  for (const [file, list] of byFile) {
    const abs = join(root, file);
    const lines = readFileSync(abs, "utf8").split("\n");
    // 同一文件内从大到小插入，避免行号错位
    list.sort((a, b) => b.fix.afterLine - a.fix.afterLine);
    for (const i of list) {
      const at = i.fix.afterLine - 1; // 0-based
      if (at < 0 || at >= lines.length) continue;
      const anchorIndent = (lines[at].match(/^\s*/) || [""])[0];
      const text = i.fix.text.replace(/^\s+/, ""); // 去掉预设缩进，改用锚行缩进
      lines.splice(at + 1, 0, anchorIndent + text);
      applied++;
    }
    writeFileSync(abs, lines.join("\n"));
  }
  return applied;
}

function rebuild() {
  if (NO_BUILD) return true;
  const r = spawnSync("npm", ["run", "build"], { cwd: root, encoding: "utf8" });
  if (r.status !== 0) {
    console.error(c.red("\n✗ 重建失败（npm run build）:"));
    console.error(r.stdout?.split("\n").slice(-20).join("\n"));
    console.error(r.stderr?.split("\n").slice(-20).join("\n"));
    return false;
  }
  return true;
}

// ── 报告 ────────────────────────────────────────────────────────────────────
function printReport(issues, iter) {
  const autoN = issues.filter((i) => i.auto).length;
  const reviewN = issues.length - autoN;
  console.log(c.bold(`\n── 迭代 ${iter} ── 共 ${issues.length} 项（auto ${autoN} / review ${reviewN}）`));
  const order = { bug: 0, review: 1 };
  issues.sort((a, b) => (order[a.severity] - order[b.severity]) || (a.file < b.file ? -1 : 1) || a.line - b.line);
  const byFile = new Map();
  for (const i of issues) {
    if (!byFile.has(i.file)) byFile.set(i.file, []);
    byFile.get(i.file).push(i);
  }
  for (const [file, list] of byFile) {
    console.log(c.bold(`\n${file}`));
    for (const i of list) {
      const tag = i.auto ? c.grn("[auto]") : c.yel("[review]");
      console.log(`  ${tag} ${c.dim(i.line + ":")} ${c.dim(i.rule)} — ${i.message}`);
    }
  }
}

// ── 主循环 ──────────────────────────────────────────────────────────────────
console.log(c.bold("design-loop — 排版/布局细节 查找 → 修复 → 循环"));
console.log(`mode: ${APPLY ? c.grn("apply（自动修复 auto 类）") : c.yel("report（仅报告）")}  max-iter: ${maxIter}`);

let iter = 0;
let totalApplied = 0;
let lastAutoCount = -1;

while (iter < maxIter) {
  const issues = auditAll();
  const auto = issues.filter((i) => i.auto);
  printReport(issues, iter + 1);

  if (!APPLY || auto.length === 0) {
    if (auto.length === 0 && APPLY) console.log(c.grn("\n✓ 无可自动修复项，循环收敛。"));
    else if (!APPLY) console.log(c.dim("\n（report 模式：未改动源码。加 --apply 可自动修复 auto 类问题。）"));
    break;
  }

  const applied = applyFixes(auto);
  totalApplied += applied;
  console.log(c.grn(`\n→ 应用 ${applied} 处 auto 修复，重建中…`));

  if (!rebuild()) {
    console.error(c.red("重建失败，已应用的源码改动保留，请检查后手动 `npm run build`。"));
    process.exit(1);
  }

  if (applied === lastAutoCount) {
    // 防止震荡：本次与上次修复数相同仍继续，但达到 max-iter 自然停止
  }
  lastAutoCount = applied;
  iter++;
}

if (APPLY) console.log(c.bold(`\n完成：共自动修复 ${totalApplied} 处，经历 ${iter} 次迭代。`));
