// 既存の食事description（AIの冗長な説明文）を、料理名・商品名だけに要約する一回限りのスクリプト。
// 「。」以降の説明を落とし、末尾の「です/でした」等を除去。コンビニ正式名称はそのまま残る。
// 使い方: node scripts/clean-meal-names.mjs
import { createClient } from "@libsql/client";
import "dotenv/config";

const url = process.env.DATABASE_URL || "file:local.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;
const client = createClient({ url, ...(authToken ? { authToken } : {}) });

function clean(desc) {
  if (!desc) return desc;
  let s = String(desc).trim();
  // 「。」で区切り、最初の文（=料理名）だけ残す
  if (s.includes("。")) s = s.split("。")[0];
  // 末尾の説明的な語尾を除去
  s = s.replace(/(です|でした|だと思われます|と思われます|になります)$/u, "");
  s = s.replace(/[。、,\s]+$/u, "").trim();
  return s || desc;
}

async function run() {
  const rows = (await client.execute("SELECT id, description FROM meals")).rows;
  let changed = 0;
  for (const r of rows) {
    const before = r.description;
    const after = clean(before);
    if (after !== before) {
      await client.execute({ sql: "UPDATE meals SET description = ? WHERE id = ?", args: [after, r.id] });
      changed += 1;
      console.log(`  "${before}" → "${after}"`);
    }
  }
  console.log(`\n[done] ${changed}/${rows.length} 件を要約しました`);
}

run().catch((e) => {
  console.error("[error]", e);
  process.exit(1);
});
