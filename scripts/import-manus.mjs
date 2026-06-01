#!/usr/bin/env node
/**
 * Manus版ユーザーデータ取込スクリプト（土台）
 * ------------------------------------------------------------------
 * 使い方:
 *   node scripts/import-manus.mjs <export.json>            # dry-run（既定・書込なし）
 *   node scripts/import-manus.mjs <export.json> --commit   # 実際に書き込む
 *   node scripts/import-manus.mjs <export.json> --commit --replace
 *                                  # 各ユーザーの既存メ/体重/運動/目標を消してから入れ直す（再取込向け）
 *
 * 接続先は .env の DATABASE_URL（ローカルなら file:local.db、本番は Turso の libsql://）。
 * DATABASE_AUTH_TOKEN があればリモートにも流せる。
 *
 * 想定エクスポート形式（scripts/manus-export.sample.json 参照）:
 *   { "users": [ { email, name, goal?, meals[], weights[], workouts[] }, ... ] }
 *   ※トップレベルが配列 [ {..} ] でも受ける。
 *
 * 実際のManusエクスポートのキー名が違っても、下の normalize* 関数の別名(alias)を
 * 足すだけで対応できるようにしてある。各レコードのキーは大文字小文字を無視して探す。
 */
import "dotenv/config";
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/* ----------------------------- CLI ----------------------------- */
const argv = process.argv.slice(2);
const filePath = argv.find((a) => !a.startsWith("--"));
const COMMIT = argv.includes("--commit");
const REPLACE = argv.includes("--replace");
const DRY = !COMMIT;

if (!filePath) {
  console.error("使い方: node scripts/import-manus.mjs <export.json> [--commit] [--replace]");
  process.exit(1);
}

/* ------------------------ 正規化ヘルパー ------------------------ */
// オブジェクトからキー名(大小無視・別名複数)で最初に見つかった値を返す
function pick(obj, ...keys) {
  if (!obj || typeof obj !== "object") return undefined;
  const lower = {};
  for (const k of Object.keys(obj)) lower[k.toLowerCase()] = obj[k];
  for (const k of keys) {
    const v = lower[k.toLowerCase()];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

// "YYYY-MM-DD" へ正規化（ISO日時・スラッシュ区切り・Date等を吸収）
function toDate(v) {
  if (!v) return null;
  if (typeof v === "string") {
    const m = v.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  const d = new Date(v);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return null;
}

const MEAL_TYPE = {
  breakfast: "breakfast", lunch: "lunch", dinner: "dinner", snack: "snack",
  朝: "breakfast", 朝食: "breakfast", 昼: "lunch", 昼食: "lunch",
  夜: "dinner", 夕: "dinner", 夕食: "dinner", 晩: "dinner", 間食: "snack", おやつ: "snack",
};
function mealType(v) {
  if (!v) return "snack";
  return MEAL_TYPE[String(v).trim()] ?? "snack";
}

const INTENSITY = {
  low: "low", medium: "medium", high: "high",
  軽い: "low", 普通: "medium", ふつう: "medium", 激しい: "high", きつい: "high",
};
function intensity(v) {
  if (!v) return "medium";
  return INTENSITY[String(v).trim()] ?? "medium";
}

// 数値→文字列(text列用)。未定義は既定値。
function numStr(v, def = "0") {
  if (v === undefined || v === null || v === "") return def;
  const n = Number(String(v).replace(/[^\d.\-]/g, ""));
  return isNaN(n) ? def : String(n);
}
// 整数 or null
function intOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = parseInt(String(v).replace(/[^\d\-]/g, ""), 10);
  return isNaN(n) ? null : n;
}

/* ----------------- アダプタ: 生データ→正規化 ------------------ */
// ★ 実際のエクスポートのキー名が判明したら、各 pick(...) に別名を足すだけ。
function normalizeUser(raw) {
  const email = String(pick(raw, "email", "mail", "メール", "メールアドレス") ?? "").trim().toLowerCase();
  const name = pick(raw, "name", "displayName", "username", "名前", "ニックネーム") ?? null;

  const meals = (pick(raw, "meals", "meal", "食事", "records") ?? []).map((m) => ({
    date: toDate(pick(m, "mealDate", "date", "day", "日付", "記録日")),
    type: mealType(pick(m, "mealType", "type", "種別", "区分")),
    description: pick(m, "description", "name", "food", "内容", "メニュー", "説明") ?? null,
    calories: numStr(pick(m, "calories", "kcal", "cal", "カロリー")),
    proteinG: numStr(pick(m, "proteinG", "protein", "p", "たんぱく質", "タンパク質")),
    fatG: numStr(pick(m, "fatG", "fat", "f", "脂質")),
    carbsG: numStr(pick(m, "carbsG", "carbs", "carb", "c", "炭水化物", "糖質")),
  }));

  const weights = (pick(raw, "weights", "weight", "体重", "weightRecords") ?? []).map((w) => ({
    date: toDate(pick(w, "recordDate", "date", "day", "日付")),
    weightKg: numStr(pick(w, "weightKg", "weight", "kg", "体重"), ""),
    note: pick(w, "note", "memo", "メモ", "備考") ?? null,
  }));

  const workouts = (pick(raw, "workouts", "workout", "運動", "exercises", "training") ?? []).map((wk) => ({
    date: toDate(pick(wk, "recordDate", "date", "day", "日付")),
    activity: pick(wk, "activity", "name", "種目", "内容", "運動") ?? "運動",
    durationMin: intOrNull(pick(wk, "durationMin", "duration", "minutes", "min", "分", "時間")) ?? 0,
    intensity: intensity(pick(wk, "intensity", "強度")),
    weightKg: numStr(pick(wk, "weightKg", "weight", "重量"), "") || null,
    reps: intOrNull(pick(wk, "reps", "rep", "回数")),
    sets: intOrNull(pick(wk, "sets", "set", "セット")),
    caloriesBurned: numStr(pick(wk, "caloriesBurned", "burned", "kcal", "消費カロリー"), "") || null,
    note: pick(wk, "note", "memo", "メモ") ?? null,
  }));

  const g = pick(raw, "goal", "goals", "目標", "target");
  let goal = null;
  if (g) {
    goal = {
      gender: pick(g, "gender", "sex", "性別") === "female" || pick(g, "gender", "性別") === "女性" ? "female" : "male",
      age: intOrNull(pick(g, "age", "年齢")),
      heightCm: numStr(pick(g, "heightCm", "height", "身長"), ""),
      currentWeightKg: numStr(pick(g, "currentWeightKg", "currentWeight", "現在体重"), ""),
      targetWeightKg: numStr(pick(g, "targetWeightKg", "targetWeight", "目標体重"), ""),
      targetWeeks: intOrNull(pick(g, "targetWeeks", "weeks", "週数", "期間")),
      activityLevel: pick(g, "activityLevel", "activity", "活動レベル") ?? "moderate",
      bmr: numStr(pick(g, "bmr", "基礎代謝"), ""),
      tdee: numStr(pick(g, "tdee", "消費"), ""),
      targetCalories: numStr(pick(g, "targetCalories", "targetCal", "目標カロリー"), ""),
      weeklyLossKg: numStr(pick(g, "weeklyLossKg", "weeklyLoss", "週減量"), ""),
    };
  }

  return { email, name, meals, weights, workouts, goal };
}

/* ------------------------------ DB ------------------------------ */
const url = process.env.DATABASE_URL || "file:local.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;
const client = createClient({ url, ...(authToken ? { authToken } : {}) });

async function ensureUser(u) {
  const openId = `local:${u.email}`;
  // passwordHash は NULL のまま作る → 本人が同じメールで「登録」した時にパスワード後付け(claim)
  await client.execute({
    sql: `INSERT INTO users (openId, email, name, passwordHash, loginMethod, role)
          VALUES (?, ?, ?, NULL, 'imported', 'user')
          ON CONFLICT(openId) DO NOTHING`,
    args: [openId, u.email, u.name],
  });
  const r = await client.execute({ sql: `SELECT id FROM users WHERE openId = ?`, args: [openId] });
  return r.rows[0]?.id;
}

async function replaceUserData(userId) {
  for (const t of ["meals", "weights", "workouts"]) {
    await client.execute({ sql: `DELETE FROM ${t} WHERE userId = ?`, args: [userId] });
  }
  await client.execute({ sql: `DELETE FROM goals WHERE userId = ?`, args: [userId] });
}

async function importUser(u) {
  const userId = await ensureUser(u);
  if (REPLACE) await replaceUserData(userId);

  let m = 0, w = 0, wk = 0, hasGoal = 0;

  for (const x of u.meals) {
    if (!x.date) continue;
    await client.execute({
      sql: `INSERT INTO meals (userId, mealDate, mealType, description, calories, proteinG, fatG, carbsG)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [userId, x.date, x.type, x.description, x.calories, x.proteinG, x.fatG, x.carbsG],
    });
    m++;
  }
  for (const x of u.weights) {
    if (!x.date || !x.weightKg) continue;
    await client.execute({
      sql: `INSERT INTO weights (userId, recordDate, weightKg, note) VALUES (?, ?, ?, ?)`,
      args: [userId, x.date, x.weightKg, x.note],
    });
    w++;
  }
  for (const x of u.workouts) {
    if (!x.date) continue;
    await client.execute({
      sql: `INSERT INTO workouts (userId, recordDate, activity, durationMin, intensity, weightKg, reps, sets, caloriesBurned, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [userId, x.date, x.activity, x.durationMin, x.intensity, x.weightKg, x.reps, x.sets, x.caloriesBurned, x.note],
    });
    wk++;
  }
  // 目標は NOT NULL 列が多いので、必須が揃っている時だけ入れる
  const g = u.goal;
  if (g && g.age && g.heightCm && g.currentWeightKg && g.targetWeightKg && g.targetWeeks) {
    await client.execute({
      sql: `INSERT INTO goals (userId, gender, age, heightCm, currentWeightKg, targetWeightKg, targetWeeks,
              activityLevel, bmr, tdee, targetCalories, weeklyLossKg)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(userId) DO UPDATE SET
              gender=excluded.gender, age=excluded.age, heightCm=excluded.heightCm,
              currentWeightKg=excluded.currentWeightKg, targetWeightKg=excluded.targetWeightKg,
              targetWeeks=excluded.targetWeeks, activityLevel=excluded.activityLevel,
              bmr=excluded.bmr, tdee=excluded.tdee, targetCalories=excluded.targetCalories,
              weeklyLossKg=excluded.weeklyLossKg`,
      args: [userId, g.gender, g.age, g.heightCm, g.currentWeightKg, g.targetWeightKg, g.targetWeeks,
        g.activityLevel, g.bmr || "0", g.tdee || "0", g.targetCalories || "0", g.weeklyLossKg || "0"],
    });
    hasGoal = 1;
  }
  return { userId, m, w, wk, hasGoal };
}

/* ----------------------------- main ----------------------------- */
async function main() {
  const json = JSON.parse(readFileSync(resolve(filePath), "utf8"));
  const rawUsers = Array.isArray(json) ? json : json.users ?? json.data ?? [];
  if (!Array.isArray(rawUsers) || rawUsers.length === 0) {
    console.error("ユーザー配列が見つかりません。{ \"users\": [...] } 形式か配列で渡してください。");
    process.exit(1);
  }

  const users = rawUsers.map(normalizeUser);
  const invalid = users.filter((u) => !u.email || !u.email.includes("@"));

  console.log(`\n=== Manus取込 ${DRY ? "[DRY-RUN・書込なし]" : "[COMMIT]"}${REPLACE ? " [REPLACE]" : ""} ===`);
  console.log(`接続先: ${url}`);
  console.log(`対象ユーザー: ${users.length}件${invalid.length ? `（うちメール不正 ${invalid.length}件はスキップ）` : ""}\n`);

  for (const u of users) {
    const ok = u.email && u.email.includes("@");
    const head = ok ? u.email : "(メール無し→スキップ)";
    console.log(`- ${head} ${u.name ? `(${u.name})` : ""}`);
    console.log(`    食事 ${u.meals.filter((x) => x.date).length} / 体重 ${u.weights.filter((x) => x.date && x.weightKg).length} / 運動 ${u.workouts.filter((x) => x.date).length} / 目標 ${u.goal ? "有" : "無"}`);
  }

  if (DRY) {
    console.log(`\ndry-run のため書き込みは行っていません。問題なければ --commit を付けて実行してください。`);
    console.log(`再取込で重複させたくない場合は --commit --replace（各ユーザーの既存データを消してから入れ直し）。\n`);
    return;
  }

  let totals = { users: 0, m: 0, w: 0, wk: 0, goals: 0 };
  for (const u of users) {
    if (!u.email || !u.email.includes("@")) continue;
    const r = await importUser(u);
    totals.users++; totals.m += r.m; totals.w += r.w; totals.wk += r.wk; totals.goals += r.hasGoal;
    console.log(`  ✓ ${u.email} (userId=${r.userId}) 食事${r.m} 体重${r.w} 運動${r.wk} 目標${r.hasGoal}`);
  }
  console.log(`\n=== 完了: ユーザー${totals.users} / 食事${totals.m} / 体重${totals.w} / 運動${totals.wk} / 目標${totals.goals} ===`);
  console.log(`各ユーザーは passwordHash 未設定。本人が同じメールで「新規登録」するとパスワードが後付けされ、データが見られる。\n`);
}

main().catch((e) => {
  console.error("取込エラー:", e);
  process.exit(1);
});
