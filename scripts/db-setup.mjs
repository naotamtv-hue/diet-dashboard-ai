// ローカルSQLite(libSQL)のテーブル作成とシード投入を行うセットアップスクリプト。
// 使い方: node scripts/db-setup.mjs
import { createClient } from "@libsql/client";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const drizzleDir = join(root, "drizzle");

const url = process.env.DATABASE_URL || "file:local.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;
const client = createClient({ url, ...(authToken ? { authToken } : {}) });

function splitStatements(sql) {
  // drizzle-kit は "--> statement-breakpoint" で文を区切る
  return sql
    .split(/-->\s*statement-breakpoint/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function run() {
  // 1) マイグレーション(CREATE TABLE 等)を適用
  const migrationFiles = readdirSync(drizzleDir)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort();

  for (const file of migrationFiles) {
    const sql = readFileSync(join(drizzleDir, file), "utf8");
    const statements = splitStatements(sql);
    let applied = 0;
    let skipped = 0;
    for (const stmt of statements) {
      try {
        await client.execute(stmt);
        applied += 1;
      } catch (e) {
        // 既に存在するテーブル/インデックス/カラムは冪等にスキップ
        const msg = String(e?.message);
        if (/already exists/i.test(msg) || /duplicate column name/i.test(msg)) {
          skipped += 1;
          continue;
        }
        throw e;
      }
    }
    console.log(`[migrate] ${file}: applied ${applied}, skipped ${skipped}`);
  }

  // 2) コンビニ商品シード投入（既に入っていればスキップ）
  const existing = await client.execute("SELECT COUNT(*) AS c FROM convenience_items");
  const count = Number(existing.rows[0].c);
  if (count > 0) {
    console.log(`[seed] convenience_items already has ${count} rows. skip.`);
  } else {
    let seedSql = readFileSync(join(drizzleDir, "seed_convenience.sql"), "utf8");
    // MySQLのバッククォート識別子をSQLite向けに除去
    seedSql = seedSql.replace(/`/g, "");
    await client.execute(seedSql);
    const after = await client.execute("SELECT COUNT(*) AS c FROM convenience_items");
    console.log(`[seed] inserted convenience_items -> ${Number(after.rows[0].c)} rows`);
  }

  console.log("[done] database setup complete:", url);
}

run().catch((err) => {
  console.error("[error] db setup failed:", err);
  process.exit(1);
});
