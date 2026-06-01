// ダークネイビーのインライン配色を、明るいMyFitnessPal風（白基調＋ブルー）へ一括置換する。
// client/src 配下の .tsx を対象に、oklch色とtext-white等を機械的に置き換える。
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../client/src", import.meta.url).pathname;

// [from, to] のペア。フルトークン単位なので部分一致の事故は起きない。
const MAP = [
  // 背景（ダーク）→ 白 / 極薄グレー
  ["oklch(0.16 0.04 240)", "oklch(1 0 0)"],
  ["oklch(0.18 0.04 240)", "oklch(1 0 0)"],
  ["oklch(0.18 0.05 240)", "oklch(1 0 0)"],
  ["oklch(0.24 0.05 240)", "oklch(0.965 0.004 250)"],
  ["oklch(0.20 0.05 240)", "oklch(1 0 0)"],
  ["oklch(0.22 0.05 240)", "oklch(1 0 0)"],
  ["oklch(0.17 0.05 240)", "oklch(1 0 0)"],
  ["oklch(0.17 0.04 240)", "oklch(1 0 0)"],
  ["oklch(0.12 0.05 240 / 0.9)", "oklch(0 0 0 / 0.45)"],
  ["oklch(0.14 0.04 240)", "oklch(0.985 0.002 250)"],
  // インナー/入力/チップ（ダーク）→ 薄グレー
  ["oklch(0.24 0.04 240)", "oklch(0.965 0.004 250)"],
  ["oklch(0.26 0.05 240)", "oklch(0.965 0.004 250)"],
  ["oklch(0.28 0.06 240)", "oklch(0.965 0.004 250)"],
  // ボーダー（ダーク）→ 薄グレー
  ["oklch(0.30 0.04 240)", "oklch(0.92 0.006 250)"],
  ["oklch(0.28 0.04 240)", "oklch(0.92 0.006 250)"],
  ["oklch(0.32 0.04 240)", "oklch(0.92 0.006 250)"],
  // 文字（淡色＝ダーク背景前提）→ 濃色
  ["oklch(0.95 0.01 220)", "oklch(0.24 0.03 252)"],
  ["oklch(0.85 0.02 220)", "oklch(0.30 0.03 252)"],
  ["oklch(0.75 0.02 220)", "oklch(0.50 0.02 252)"],
  ["oklch(0.65 0.03 220)", "oklch(0.55 0.02 252)"],
  ["oklch(0.62 0.03 220)", "oklch(0.55 0.02 252)"],
  ["oklch(0.55 0.03 220)", "oklch(0.58 0.02 252)"],
  // アクセント青 → MFPブルー（base + alpha）
  ["oklch(0.62 0.18 220 / 0.4)", "oklch(0.58 0.19 254 / 0.16)"],
  ["oklch(0.62 0.18 220 / 0.3)", "oklch(0.58 0.19 254 / 0.14)"],
  ["oklch(0.62 0.18 220 / 0.2)", "oklch(0.58 0.19 254 / 0.12)"],
  ["oklch(0.62 0.18 220 / 0.18)", "oklch(0.58 0.19 254 / 0.1)"],
  ["oklch(0.62 0.18 220 / 0.15)", "oklch(0.58 0.19 254 / 0.1)"],
  ["oklch(0.62 0.18 220)", "oklch(0.58 0.19 254)"],
  // 黒シャドウは少し弱める
  ["oklch(0 0 0 / 0.4)", "oklch(0 0 0 / 0.08)"],
  ["oklch(0 0 0 / 0.3)", "oklch(0 0 0 / 0.06)"],
];

// text-white は白カード上では見えなくなるため濃色トークンへ（ボタン等は後で視認確認して個別修正）
const CLASS_MAP = [
  [/\btext-white\b/g, "text-slate-900"],
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".tsx") || name.endsWith(".ts")) out.push(p);
  }
  return out;
}

let filesChanged = 0;
let repl = 0;
for (const file of walk(ROOT)) {
  let src = readFileSync(file, "utf8");
  const before = src;
  for (const [from, to] of MAP) {
    if (src.includes(from)) {
      src = src.split(from).join(to);
      repl++;
    }
  }
  for (const [re, to] of CLASS_MAP) {
    src = src.replace(re, to);
  }
  if (src !== before) {
    writeFileSync(file, src);
    filesChanged++;
  }
}
console.log(`[recolor] updated ${filesChanged} files`);
