// Kalonブランド配色へ一括変更: 青(254)→ネイビー、緑(155)→ライム。
// client/src 配下の .tsx / .css を対象に oklch トークンを機械置換する。
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "client/src";
const repls = [
  // 主要アクセント青 → ネイビー
  [/oklch\(0\.58 0\.19 254\)/g, "oklch(0.38 0.14 268)"],
  // 薄い青系チップ背景 → 薄ネイビー
  [/oklch\(0\.95 0\.02 254\)/g, "oklch(0.95 0.03 268)"],
  [/oklch\(0\.96 0\.03 254\)/g, "oklch(0.96 0.03 268)"],
  [/oklch\(0\.95 0\.01 254\)/g, "oklch(0.95 0.02 268)"],
  // 既存グリーン(hue155系) → ライム(hue130)
  [/(oklch\([0-9. ]*?)155\)/g, "$1130)"],
  // FoodSearchの BLUE 定数
  [/const BLUE = "oklch\(0\.58 0\.19 254\)"/g, 'const BLUE = "oklch(0.38 0.14 268)"'],
];

let changed = 0;
function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (/\.(tsx|ts|css)$/.test(f)) {
      let txt = readFileSync(p, "utf8");
      const before = txt;
      for (const [re, to] of repls) txt = txt.replace(re, to);
      if (txt !== before) {
        writeFileSync(p, txt);
        changed++;
        console.log("recolored:", p);
      }
    }
  }
}
walk(ROOT);
console.log(`\n${changed} files recolored.`);
