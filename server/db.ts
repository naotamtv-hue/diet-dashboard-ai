import { and, asc, between, desc, eq, gte, like, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import {
  bodyPhotos,
  convenienceItems,
  goals,
  InsertBodyPhoto,
  InsertConvenienceItem,
  InsertGoal,
  InsertMeal,
  InsertReminderSettings,
  InsertUser,
  InsertWeight,
  InsertWorkout,
  meals,
  reminderSettings,
  users,
  weights,
  workouts,
  exercises,
  workoutSets,
  InsertExercise,
  InsertWorkoutSet,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const client = createClient({ url: process.env.DATABASE_URL });
      _db = drizzle(client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

/* ============================== users ============================== */

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db
    .insert(users)
    .values(values)
    .onConflictDoUpdate({ target: users.openId, set: updateSet });
}

export async function createUserWithPassword(params: {
  openId: string;
  email: string;
  name: string | null;
  passwordHash: string;
}) {
  const db = await requireDb();
  const r = await db
    .insert(users)
    .values({
      openId: params.openId,
      email: params.email,
      name: params.name,
      passwordHash: params.passwordHash,
      loginMethod: "password",
      lastSignedIn: new Date(),
    })
    .returning();
  return r[0] ?? null;
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0] ?? null;
}

/* ============================== meals ============================== */

export async function insertMeal(data: InsertMeal) {
  const db = await requireDb();
  const result = await db.insert(meals).values(data);
  return result;
}

export async function listMealsByDate(userId: number, mealDate: string) {
  const db = await requireDb();
  return db
    .select()
    .from(meals)
    .where(and(eq(meals.userId, userId), eq(meals.mealDate, mealDate)))
    .orderBy(asc(meals.mealType), asc(meals.id));
}

export async function deleteMeal(userId: number, id: number) {
  const db = await requireDb();
  await db.delete(meals).where(and(eq(meals.userId, userId), eq(meals.id, id)));
}

export async function updateMeal(
  userId: number,
  id: number,
  data: Partial<Pick<InsertMeal, "mealType" | "description" | "calories" | "proteinG" | "fatG" | "carbsG">>
) {
  const db = await requireDb();
  await db.update(meals).set(data).where(and(eq(meals.userId, userId), eq(meals.id, id)));
}

export async function sumMealsByDate(userId: number, mealDate: string) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(meals)
    .where(and(eq(meals.userId, userId), eq(meals.mealDate, mealDate)));

  let calories = 0,
    proteinG = 0,
    fatG = 0,
    carbsG = 0;
  for (const r of rows) {
    calories += Number(r.calories);
    proteinG += Number(r.proteinG);
    fatG += Number(r.fatG);
    carbsG += Number(r.carbsG);
  }
  return { calories, proteinG, fatG, carbsG, items: rows };
}

export async function listMealSummariesByMonth(userId: number, yearMonth: string) {
  // yearMonth: "YYYY-MM"
  const start = `${yearMonth}-01`;
  // compute last day by going to next month and subtracting
  const [y, m] = yearMonth.split("-").map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const db = await requireDb();
  const rows = await db
    .select()
    .from(meals)
    .where(
      and(
        eq(meals.userId, userId),
        gte(meals.mealDate, start),
        lte(meals.mealDate, nextMonth.slice(0, 10))
      )
    );

  // group by date
  const map = new Map<string, { calories: number; proteinG: number; fatG: number; carbsG: number; count: number }>();
  for (const r of rows) {
    const d = r.mealDate as string;
    const cur = map.get(d) ?? { calories: 0, proteinG: 0, fatG: 0, carbsG: 0, count: 0 };
    cur.calories += Number(r.calories);
    cur.proteinG += Number(r.proteinG);
    cur.fatG += Number(r.fatG);
    cur.carbsG += Number(r.carbsG);
    cur.count += 1;
    map.set(d, cur);
  }

  return Array.from(map.entries()).map(([date, totals]) => ({ date, ...totals }));
}

/* ============================== weights ============================== */

export async function upsertWeight(userId: number, recordDate: string, weightKg: string, note?: string | null) {
  const db = await requireDb();
  const existing = await db
    .select()
    .from(weights)
    .where(and(eq(weights.userId, userId), eq(weights.recordDate, recordDate)))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(weights)
      .set({ weightKg, note: note ?? null })
      .where(eq(weights.id, existing[0].id));
    return existing[0].id;
  }
  const insert: InsertWeight = { userId, recordDate, weightKg, note: note ?? null };
  const r = await db.insert(weights).values(insert).returning({ id: weights.id });
  return r[0]?.id ?? null;
}

export async function listWeights(userId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(weights)
    .where(eq(weights.userId, userId))
    .orderBy(asc(weights.recordDate));
}

export async function getLatestWeight(userId: number) {
  const db = await requireDb();
  const r = await db
    .select()
    .from(weights)
    .where(eq(weights.userId, userId))
    .orderBy(desc(weights.recordDate))
    .limit(1);
  return r[0] ?? null;
}

export async function getFirstWeight(userId: number) {
  const db = await requireDb();
  const r = await db
    .select()
    .from(weights)
    .where(eq(weights.userId, userId))
    .orderBy(asc(weights.recordDate))
    .limit(1);
  return r[0] ?? null;
}

export async function deleteWeight(userId: number, id: number) {
  const db = await requireDb();
  await db.delete(weights).where(and(eq(weights.userId, userId), eq(weights.id, id)));
}

export async function getWeightByDate(userId: number, recordDate: string) {
  const db = await requireDb();
  const r = await db
    .select()
    .from(weights)
    .where(and(eq(weights.userId, userId), eq(weights.recordDate, recordDate)))
    .limit(1);
  return r[0] ?? null;
}

/* ============================== workouts ============================== */

export async function insertWorkout(data: InsertWorkout) {
  const db = await requireDb();
  return db.insert(workouts).values(data);
}

export async function listWorkoutsByDate(userId: number, recordDate: string) {
  const db = await requireDb();
  return db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, userId), eq(workouts.recordDate, recordDate)))
    .orderBy(asc(workouts.id));
}

export async function listRecentWorkouts(userId: number, limit = 30) {
  const db = await requireDb();
  return db
    .select()
    .from(workouts)
    .where(eq(workouts.userId, userId))
    .orderBy(desc(workouts.recordDate), desc(workouts.id))
    .limit(limit);
}

export async function deleteWorkout(userId: number, id: number) {
  const db = await requireDb();
  await db.delete(workouts).where(and(eq(workouts.userId, userId), eq(workouts.id, id)));
}

/* ============================== goals ============================== */

export async function upsertGoal(data: InsertGoal) {
  const db = await requireDb();
  const existing = await db
    .select()
    .from(goals)
    .where(eq(goals.userId, data.userId!))
    .limit(1);
  if (existing.length > 0) {
    await db.update(goals).set(data).where(eq(goals.id, existing[0].id));
    return existing[0].id;
  }
  const r = await db.insert(goals).values(data).returning({ id: goals.id });
  return r[0]?.id ?? null;
}

export async function getGoal(userId: number) {
  const db = await requireDb();
  const r = await db.select().from(goals).where(eq(goals.userId, userId)).limit(1);
  return r[0] ?? null;
}

/* ========================= convenience items ========================= */

export async function searchConvenienceItems(params: {
  chain?: "seven" | "familymart" | "lawson";
  category?:
    | "bento"
    | "onigiri"
    | "bread"
    | "salad"
    | "noodle"
    | "hotsnack"
    | "drink"
    | "dessert"
    | "sideDish"
    | "proteinSnack";
  keyword?: string;
  maxKcal?: number;
  limit?: number;
}) {
  const db = await requireDb();
  const where = [];
  if (params.chain) where.push(eq(convenienceItems.chain, params.chain));
  if (params.category) where.push(eq(convenienceItems.category, params.category));
  if (params.keyword && params.keyword.trim().length > 0) {
    const kw = `%${params.keyword.trim()}%`;
    where.push(or(like(convenienceItems.name, kw), like(convenienceItems.description, kw))!);
  }
  if (typeof params.maxKcal === "number") {
    where.push(lte(convenienceItems.calories, String(params.maxKcal)));
  }

  const limit = Math.min(params.limit ?? 80, 200);
  if (where.length === 0) {
    return db.select().from(convenienceItems).limit(limit);
  }
  return db.select().from(convenienceItems).where(and(...where)).limit(limit);
}

export async function listAllConvenienceItems() {
  const db = await requireDb();
  return db.select().from(convenienceItems);
}

/* ============================== body photos ============================== */

export async function insertBodyPhoto(data: InsertBodyPhoto) {
  const db = await requireDb();
  return db.insert(bodyPhotos).values(data);
}

export async function listBodyPhotos(userId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(bodyPhotos)
    .where(eq(bodyPhotos.userId, userId))
    .orderBy(asc(bodyPhotos.recordDate), asc(bodyPhotos.id));
}

export async function deleteBodyPhoto(userId: number, id: number) {
  const db = await requireDb();
  await db.delete(bodyPhotos).where(and(eq(bodyPhotos.userId, userId), eq(bodyPhotos.id, id)));
}

/* ============================== reminders ============================== */

export async function getReminderSettings(userId: number) {
  const db = await requireDb();
  const r = await db
    .select()
    .from(reminderSettings)
    .where(eq(reminderSettings.userId, userId))
    .limit(1);
  return r[0] ?? null;
}

export async function upsertReminderSettings(data: InsertReminderSettings) {
  const db = await requireDb();
  const existing = await getReminderSettings(data.userId!);
  if (existing) {
    await db.update(reminderSettings).set(data).where(eq(reminderSettings.id, existing.id));
    return existing.id;
  }
  const r = await db
    .insert(reminderSettings)
    .values(data)
    .returning({ id: reminderSettings.id });
  return r[0]?.id ?? null;
}

/* ============================== stats / continuity ============================== */

/** 食事・体重・運動のいずれかの記録がある日付（YYYY-MM-DD）の集合を昇順で返す。 */
export async function getActivityDates(userId: number): Promise<string[]> {
  const db = await requireDb();
  const [m, w, k, s] = await Promise.all([
    db.select({ d: meals.mealDate }).from(meals).where(eq(meals.userId, userId)),
    db.select({ d: weights.recordDate }).from(weights).where(eq(weights.userId, userId)),
    db.select({ d: workouts.recordDate }).from(workouts).where(eq(workouts.userId, userId)),
    db.select({ d: workoutSets.recordDate }).from(workoutSets).where(eq(workoutSets.userId, userId)),
  ]);
  const set = new Set<string>();
  for (const row of [...m, ...w, ...k, ...s]) {
    if (row.d) set.add(String(row.d));
  }
  return Array.from(set).sort();
}

/* ============================== strength (筋トレ) ============================== */

const DEFAULT_EXERCISES: { bodyPart: InsertExercise["bodyPart"]; name: string }[] = [
  { bodyPart: "chest", name: "ベンチプレス" },
  { bodyPart: "chest", name: "ダンベルプレス" },
  { bodyPart: "chest", name: "ディップス" },
  { bodyPart: "back", name: "ラットプルダウン" },
  { bodyPart: "back", name: "ローイング" },
  { bodyPart: "back", name: "デッドリフト" },
  { bodyPart: "legs", name: "スクワット" },
  { bodyPart: "legs", name: "レッグプレス" },
  { bodyPart: "legs", name: "ブルガリアンスクワット" },
  { bodyPart: "shoulders", name: "ショルダープレス" },
  { bodyPart: "shoulders", name: "サイドレイズ" },
  { bodyPart: "arms", name: "ダンベルカール" },
  { bodyPart: "arms", name: "ケーブルプレスダウン" },
  { bodyPart: "abs", name: "アブドミナル" },
  { bodyPart: "abs", name: "プランク" },
];

export async function listExercises(userId: number) {
  const db = await requireDb();
  let rows = await db.select().from(exercises).where(eq(exercises.userId, userId));
  if (rows.length === 0) {
    // 初回は代表的な種目をシード
    await db.insert(exercises).values(DEFAULT_EXERCISES.map((e) => ({ userId, ...e })));
    rows = await db.select().from(exercises).where(eq(exercises.userId, userId));
  }
  return rows;
}

export async function addExercise(userId: number, bodyPart: InsertExercise["bodyPart"], name: string) {
  const db = await requireDb();
  const existing = await db
    .select()
    .from(exercises)
    .where(and(eq(exercises.userId, userId), eq(exercises.bodyPart, bodyPart), eq(exercises.name, name)))
    .limit(1);
  if (existing[0]) return existing[0];
  const r = await db.insert(exercises).values({ userId, bodyPart, name }).returning();
  return r[0];
}

export async function listWorkoutSetsByDate(userId: number, recordDate: string) {
  const db = await requireDb();
  return db
    .select()
    .from(workoutSets)
    .where(and(eq(workoutSets.userId, userId), eq(workoutSets.recordDate, recordDate)))
    .orderBy(asc(workoutSets.exerciseName), asc(workoutSets.setNo));
}

/** ある種目の直近の記録（前回値の引き継ぎ用）。最新日のセット一覧を返す。 */
export async function lastSetsForExercise(userId: number, exerciseName: string, beforeDate: string) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(workoutSets)
    .where(
      and(
        eq(workoutSets.userId, userId),
        eq(workoutSets.exerciseName, exerciseName),
        lte(workoutSets.recordDate, beforeDate)
      )
    )
    .orderBy(desc(workoutSets.recordDate), asc(workoutSets.setNo));
  if (rows.length === 0) return { date: null as string | null, sets: [] as typeof rows };
  // beforeDate と同じ日は除き、その前で最も新しい日
  const prior = rows.find((r) => r.recordDate < beforeDate);
  const targetDate = prior ? prior.recordDate : null;
  if (!targetDate) return { date: null, sets: [] };
  return { date: targetDate, sets: rows.filter((r) => r.recordDate === targetDate) };
}

/** その日のその種目のセットを丸ごと置き換える。 */
export async function saveWorkoutSets(
  userId: number,
  recordDate: string,
  bodyPart: InsertExercise["bodyPart"],
  exerciseName: string,
  sets: { weightKg: string | null; reps: number | null; memo: string | null }[]
) {
  const db = await requireDb();
  await db
    .delete(workoutSets)
    .where(
      and(
        eq(workoutSets.userId, userId),
        eq(workoutSets.recordDate, recordDate),
        eq(workoutSets.exerciseName, exerciseName)
      )
    );
  const rows: InsertWorkoutSet[] = sets
    .filter((s) => s.weightKg !== null || s.reps !== null)
    .map((s, i) => ({
      userId,
      recordDate,
      bodyPart,
      exerciseName,
      setNo: i + 1,
      weightKg: s.weightKg,
      reps: s.reps,
      memo: s.memo,
    }));
  if (rows.length > 0) await db.insert(workoutSets).values(rows);
  return rows.length;
}

/** 期間内の合計負荷量(重量×回数)を返す。 */
export async function getVolumeByDate(userId: number, recordDate: string) {
  const rows = await listWorkoutSetsByDate(userId, recordDate);
  let volume = 0;
  for (const r of rows) volume += (Number(r.weightKg) || 0) * (Number(r.reps) || 0);
  return volume;
}

/** 指定期間の食事を日別カロリー合計にして返す（週次ふりかえり用）。 */
export async function listMealDailyTotals(userId: number, start: string, end: string) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(meals)
    .where(and(eq(meals.userId, userId), gte(meals.mealDate, start), lte(meals.mealDate, end)));
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.mealDate, (map.get(r.mealDate) ?? 0) + Number(r.calories));
  }
  return Array.from(map.entries()).map(([date, calories]) => ({ date, calories }));
}

/** よく記録する食事（description単位）を頻度順に返す。代表PFCは最新の値を採用。 */
export async function frequentMeals(userId: number, limit = 8) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(meals)
    .where(eq(meals.userId, userId))
    .orderBy(desc(meals.id))
    .limit(400);
  type Agg = {
    name: string;
    count: number;
    mealType: (typeof rows)[number]["mealType"];
    calories: number;
    proteinG: number;
    fatG: number;
    carbsG: number;
  };
  const map = new Map<string, Agg>();
  for (const r of rows) {
    const name = (r.description ?? "").trim();
    if (!name) continue;
    const cur = map.get(name);
    if (cur) {
      cur.count += 1;
    } else {
      map.set(name, {
        name,
        count: 1,
        mealType: r.mealType,
        calories: Number(r.calories),
        proteinG: Number(r.proteinG),
        fatG: Number(r.fatG),
        carbsG: Number(r.carbsG),
      });
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** ある日付の食事を別の日付へ複製する（「昨日と同じ」用）。複製件数を返す。 */
export async function copyMealsFromDate(userId: number, fromDate: string, toDate: string) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(meals)
    .where(and(eq(meals.userId, userId), eq(meals.mealDate, fromDate)));
  if (rows.length === 0) return 0;
  await db.insert(meals).values(
    rows.map((r) => ({
      userId,
      mealDate: toDate,
      mealType: r.mealType,
      description: r.description,
      imageUrl: r.imageUrl,
      calories: r.calories,
      proteinG: r.proteinG,
      fatG: r.fatG,
      carbsG: r.carbsG,
    }))
  );
  return rows.length;
}
