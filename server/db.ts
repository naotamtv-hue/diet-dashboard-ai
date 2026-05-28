import { and, asc, between, desc, eq, gte, like, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
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
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
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

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
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
  const r = await db.insert(weights).values(insert);
  // drizzle mysql2 returns array; use insertId
  // @ts-ignore
  return (r as any)[0]?.insertId ?? null;
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
  return r[0];
}

export async function getFirstWeight(userId: number) {
  const db = await requireDb();
  const r = await db
    .select()
    .from(weights)
    .where(eq(weights.userId, userId))
    .orderBy(asc(weights.recordDate))
    .limit(1);
  return r[0];
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
  return r[0];
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
  const r = await db.insert(goals).values(data);
  // @ts-ignore
  return (r as any)[0]?.insertId ?? null;
}

export async function getGoal(userId: number) {
  const db = await requireDb();
  const r = await db.select().from(goals).where(eq(goals.userId, userId)).limit(1);
  return r[0];
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
  return r[0];
}

export async function upsertReminderSettings(data: InsertReminderSettings) {
  const db = await requireDb();
  const existing = await getReminderSettings(data.userId!);
  if (existing) {
    await db.update(reminderSettings).set(data).where(eq(reminderSettings.id, existing.id));
    return existing.id;
  }
  const r = await db.insert(reminderSettings).values(data);
  // @ts-ignore
  return (r as any)[0]?.insertId ?? null;
}
