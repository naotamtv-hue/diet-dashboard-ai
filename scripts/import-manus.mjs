// Manusからエクスポートした CSV (~/dev/manus-export/*.csv) を新DBへ取り込む。
// 既存のユーザーデータ（テスト含む）は一旦クリアしてから投入する。convenience_itemsは温存。
// 使い方: node scripts/import-manus.mjs
import { createClient } from "@libsql/client";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import "dotenv/config";

const EXPORT_DIR = join(homedir(), "dev", "manus-export");
const url = process.env.DATABASE_URL || "file:local.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;
const client = createClient({ url, ...(authToken ? { authToken } : {}) });

/** RFC4180準拠の簡易CSVパーサ（引用符・カンマ・改行・""エスケープ対応）。 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\r") { /* skip */ }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""));
}

function loadTable(name) {
  const path = join(EXPORT_DIR, `${name}.csv`);
  if (!existsSync(path)) return [];
  const rows = parseCsv(readFileSync(path, "utf8"));
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((r) => {
    const o = {};
    header.forEach((h, i) => (o[h] = r[i] ?? ""));
    return o;
  });
}

const nz = (v) => (v === undefined || v === null || v === "" ? null : v);
const dateOnly = (v) => (nz(v) ? String(v).slice(0, 10) : null);
const toEpoch = (v) => {
  if (!nz(v)) return Math.floor(Date.now() / 1000);
  const t = Date.parse(String(v).replace(" ", "T") + "Z");
  return Number.isNaN(t) ? Math.floor(Date.now() / 1000) : Math.floor(t / 1000);
};
const intOrNull = (v) => (nz(v) === null ? null : parseInt(v, 10));

async function run() {
  const wipe = [
    "meals", "weights", "workouts", "goals",
    "body_photos", "reminder_settings", "workout_sets", "exercises", "users",
  ];
  for (const t of wipe) {
    try { await client.execute(`DELETE FROM ${t}`); }
    catch (e) { console.warn(`[wipe] ${t}: ${e.message}`); }
  }
  console.log("[wipe] cleared user data tables");

  const users = loadTable("users");
  for (const u of users) {
    await client.execute({
      sql: `INSERT INTO users (id, openId, name, email, passwordHash, loginMethod, role, createdAt, updatedAt, lastSignedIn)
            VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
      args: [
        intOrNull(u.id), u.openId, nz(u.name), nz(u.email), nz(u.loginMethod),
        u.role === "admin" ? "admin" : "user",
        toEpoch(u.createdAt), toEpoch(u.updatedAt), toEpoch(u.lastSignedIn),
      ],
    });
  }
  console.log(`[users] inserted ${users.length}`);

  const goals = loadTable("goals");
  for (const g of goals) {
    await client.execute({
      sql: `INSERT INTO goals (id, userId, gender, age, heightCm, currentWeightKg, targetWeightKg, targetWeeks, activityLevel, bmr, tdee, targetCalories, weeklyLossKg, createdAt, updatedAt)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        intOrNull(g.id), intOrNull(g.userId), g.gender, intOrNull(g.age),
        nz(g.heightCm), nz(g.currentWeightKg), nz(g.targetWeightKg), intOrNull(g.targetWeeks),
        g.activityLevel, nz(g.bmr), nz(g.tdee), nz(g.targetCalories), nz(g.weeklyLossKg),
        toEpoch(g.createdAt), toEpoch(g.updatedAt),
      ],
    });
  }
  console.log(`[goals] inserted ${goals.length}`);

  const meals = loadTable("meals");
  for (const m of meals) {
    await client.execute({
      sql: `INSERT INTO meals (id, userId, mealDate, mealType, description, imageUrl, calories, proteinG, fatG, carbsG, createdAt)
            VALUES (?,?,?,?,?,NULL,?,?,?,?,?)`,
      args: [
        intOrNull(m.id), intOrNull(m.userId), dateOnly(m.mealDate), m.mealType,
        nz(m.description), nz(m.calories) ?? "0", nz(m.proteinG) ?? "0", nz(m.fatG) ?? "0", nz(m.carbsG) ?? "0",
        toEpoch(m.createdAt),
      ],
    });
  }
  console.log(`[meals] inserted ${meals.length}`);

  const weights = loadTable("weights");
  for (const w of weights) {
    await client.execute({
      sql: `INSERT INTO weights (id, userId, recordDate, weightKg, note, createdAt) VALUES (?,?,?,?,?,?)`,
      args: [intOrNull(w.id), intOrNull(w.userId), dateOnly(w.recordDate), nz(w.weightKg), nz(w.note), toEpoch(w.createdAt)],
    });
  }
  console.log(`[weights] inserted ${weights.length}`);

  const workouts = loadTable("workouts");
  for (const w of workouts) {
    await client.execute({
      sql: `INSERT INTO workouts (id, userId, recordDate, activity, durationMin, intensity, weightKg, reps, sets, caloriesBurned, note, createdAt)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        intOrNull(w.id), intOrNull(w.userId), dateOnly(w.recordDate), w.activity,
        intOrNull(w.durationMin) ?? 0, w.intensity || "medium",
        nz(w.weightKg), intOrNull(w.reps), intOrNull(w.sets), nz(w.caloriesBurned), nz(w.note),
        toEpoch(w.createdAt),
      ],
    });
  }
  console.log(`[workouts] inserted ${workouts.length}`);

  const photos = loadTable("body_photos");
  for (const p of photos) {
    await client.execute({
      sql: `INSERT INTO body_photos (id, userId, recordDate, imageUrl, weightKg, note, createdAt) VALUES (?,?,?,?,?,?,?)`,
      args: [intOrNull(p.id), intOrNull(p.userId), dateOnly(p.recordDate), "", nz(p.weightKg), nz(p.note), toEpoch(p.createdAt)],
    });
  }
  console.log(`[body_photos] inserted ${photos.length}`);

  const reminders = loadTable("reminder_settings");
  for (const r of reminders) {
    await client.execute({
      sql: `INSERT INTO reminder_settings (id, userId, mealEnabled, mealReminderTime, weightEnabled, weightReminderTime, updatedAt) VALUES (?,?,?,?,?,?,?)`,
      args: [
        intOrNull(r.id), intOrNull(r.userId), intOrNull(r.mealEnabled) ?? 0, r.mealReminderTime || "20:00",
        intOrNull(r.weightEnabled) ?? 0, r.weightReminderTime || "08:00", toEpoch(r.updatedAt),
      ],
    });
  }
  console.log(`[reminder_settings] inserted ${reminders.length}`);

  console.log("\n[done] Manus data import complete →", url);
}

run().catch((e) => {
  console.error("[error]", e);
  process.exit(1);
});
