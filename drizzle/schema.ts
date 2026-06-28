import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Helpers to keep the previous MySQL semantics:
// - decimal / numeric values were stored & read as strings ("0", "12.3"), so we keep them as text.
// - DATE values were kept as "YYYY-MM-DD" strings, so they are plain text columns too.
// - timestamps are stored as integer epoch (seconds) and surfaced as Date objects (mode: "timestamp").
//   A DB-level default keeps raw SQL inserts (e.g. seed data) working without specifying the column.
const ts = (name: string) =>
  integer(name, { mode: "timestamp" }).notNull().default(sql`(unixepoch())`);

/**
 * Core user table backing auth flow.
 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  passwordHash: text("passwordHash"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  // Apple ショートカット等の外部連携用の個人トークン（消費カロリー取り込みURLに含める）
  apiToken: text("apiToken"),
  createdAt: ts("createdAt"),
  updatedAt: ts("updatedAt").$onUpdate(() => new Date()),
  lastSignedIn: ts("lastSignedIn"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 食事記録テーブル
 * mealType: breakfast(朝) / lunch(昼) / dinner(夜) / snack(間食)
 */
export const meals = sqliteTable(
  "meals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId").notNull(),
    mealDate: text("mealDate").notNull(),
    mealType: text("mealType", { enum: ["breakfast", "lunch", "dinner", "snack"] }).notNull(),
    description: text("description"),
    imageUrl: text("imageUrl"),
    calories: text("calories").notNull().default("0"),
    proteinG: text("proteinG").notNull().default("0"),
    fatG: text("fatG").notNull().default("0"),
    carbsG: text("carbsG").notNull().default("0"),
    createdAt: ts("createdAt"),
  },
  (t) => ({
    userDateIdx: index("meals_user_date_idx").on(t.userId, t.mealDate),
  })
);

export type Meal = typeof meals.$inferSelect;
export type InsertMeal = typeof meals.$inferInsert;

/**
 * 体重記録テーブル
 */
export const weights = sqliteTable(
  "weights",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId").notNull(),
    recordDate: text("recordDate").notNull(),
    weightKg: text("weightKg").notNull(),
    note: text("note"),
    createdAt: ts("createdAt"),
  },
  (t) => ({
    userDateIdx: index("weights_user_date_idx").on(t.userId, t.recordDate),
  })
);

export type Weight = typeof weights.$inferSelect;
export type InsertWeight = typeof weights.$inferInsert;

/**
 * 運動・トレーニング記録テーブル
 * intensity: low(軽い) / medium(普通) / high(激しい)
 */
export const workouts = sqliteTable(
  "workouts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId").notNull(),
    recordDate: text("recordDate").notNull(),
    activity: text("activity").notNull(),
    durationMin: integer("durationMin").notNull().default(0),
    intensity: text("intensity", { enum: ["low", "medium", "high"] }).notNull().default("medium"),
    weightKg: text("weightKg"),
    reps: integer("reps"),
    sets: integer("sets"),
    caloriesBurned: text("caloriesBurned"),
    note: text("note"),
    createdAt: ts("createdAt"),
  },
  (t) => ({
    userDateIdx: index("workouts_user_date_idx").on(t.userId, t.recordDate),
  })
);

export type Workout = typeof workouts.$inferSelect;
export type InsertWorkout = typeof workouts.$inferInsert;

/**
 * お気に入りトレーニング（My Workouts）。
 * 「ジム1時間で約450kcal」のように、よく行う運動の組み合わせと
 * 自分でカスタムした消費カロリーを保存し、ワンタップで呼び出し／記録する。
 * caloriesBurned はユーザーがAI推定値から微調整できる値（text列で統一）。
 */
export const favoriteWorkouts = sqliteTable(
  "favorite_workouts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId").notNull(),
    name: text("name").notNull(),
    activity: text("activity").notNull(),
    durationMin: integer("durationMin").notNull().default(0),
    intensity: text("intensity", { enum: ["low", "medium", "high"] }).notNull().default("medium"),
    weightKg: text("weightKg"),
    reps: integer("reps"),
    sets: integer("sets"),
    incline: integer("incline", { mode: "boolean" }).notNull().default(false),
    caloriesBurned: text("caloriesBurned").notNull().default("0"),
    createdAt: ts("createdAt"),
  },
  (t) => ({
    userIdx: index("favorite_workouts_user_idx").on(t.userId),
  })
);

export type FavoriteWorkout = typeof favoriteWorkouts.$inferSelect;
export type InsertFavoriteWorkout = typeof favoriteWorkouts.$inferInsert;

/**
 * 目標設定テーブル（ユーザーごとに最新1件のみ運用）
 * gender: male / female
 * activityLevel:
 *   sedentary(1.2) / light(1.375) / moderate(1.55) / active(1.725) / veryActive(1.9)
 */
export const goals = sqliteTable("goals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().unique(),
  gender: text("gender", { enum: ["male", "female"] }).notNull(),
  age: integer("age").notNull(),
  heightCm: text("heightCm").notNull(),
  currentWeightKg: text("currentWeightKg").notNull(),
  targetWeightKg: text("targetWeightKg").notNull(),
  targetWeeks: integer("targetWeeks").notNull(),
  activityLevel: text("activityLevel", {
    enum: ["sedentary", "light", "moderate", "active", "veryActive"],
  }).notNull(),
  bmr: text("bmr").notNull(),
  tdee: text("tdee").notNull(),
  targetCalories: text("targetCalories").notNull(),
  weeklyLossKg: text("weeklyLossKg").notNull(),
  createdAt: ts("createdAt"),
  updatedAt: ts("updatedAt").$onUpdate(() => new Date()),
});

export type Goal = typeof goals.$inferSelect;
export type InsertGoal = typeof goals.$inferInsert;

/**
 * コンビニ商品マスタ
 * chain: seven(セブンイレブン) / familymart(ファミリーマート) / lawson(ローソン)
 * category: bento(弁当) / onigiri(おにぎり) / bread(パン) / salad(サラダ) /
 *           noodle(麺類) / hotsnack(ホットスナック) / drink(ドリンク) /
 *           dessert(デザート) / sideDish(惣菜) / proteinSnack(プロテイン系)
 */
export const convenienceItems = sqliteTable(
  "convenience_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    chain: text("chain", { enum: ["seven", "familymart", "lawson"] }).notNull(),
    category: text("category", {
      enum: [
        "bento",
        "onigiri",
        "bread",
        "salad",
        "noodle",
        "hotsnack",
        "drink",
        "dessert",
        "sideDish",
        "proteinSnack",
      ],
    }).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    calories: text("calories").notNull(),
    proteinG: text("proteinG").notNull(),
    fatG: text("fatG").notNull(),
    carbsG: text("carbsG").notNull(),
    priceYen: integer("priceYen"),
    createdAt: ts("createdAt"),
  },
  (t) => ({
    chainCategoryIdx: index("conv_chain_category_idx").on(t.chain, t.category),
  })
);

export type ConvenienceItem = typeof convenienceItems.$inferSelect;
export type InsertConvenienceItem = typeof convenienceItems.$inferInsert;

/**
 * 体型写真記録テーブル
 */
export const bodyPhotos = sqliteTable(
  "body_photos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId").notNull(),
    recordDate: text("recordDate").notNull(),
    imageUrl: text("imageUrl").notNull(),
    weightKg: text("weightKg"),
    note: text("note"),
    createdAt: ts("createdAt"),
  },
  (t) => ({
    userDateIdx: index("body_photos_user_date_idx").on(t.userId, t.recordDate),
  })
);

export type BodyPhoto = typeof bodyPhotos.$inferSelect;
export type InsertBodyPhoto = typeof bodyPhotos.$inferInsert;

/**
 * リマインダー設定テーブル（ユーザーごとに1件）
 * mealReminderTime / weightReminderTime: HH:mm 形式
 */
export const reminderSettings = sqliteTable("reminder_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().unique(),
  mealEnabled: integer("mealEnabled").notNull().default(0),
  mealReminderTime: text("mealReminderTime").notNull().default("20:00"),
  weightEnabled: integer("weightEnabled").notNull().default(0),
  weightReminderTime: text("weightReminderTime").notNull().default("08:00"),
  updatedAt: ts("updatedAt").$onUpdate(() => new Date()),
});

export type ReminderSettings = typeof reminderSettings.$inferSelect;
export type InsertReminderSettings = typeof reminderSettings.$inferInsert;

/* ===== 筋トレ（種目マスタ＋セット記録） ===== */

export const BODY_PARTS = ["chest", "back", "legs", "shoulders", "arms", "abs", "cardio", "other"] as const;

/** 種目マスタ（ユーザーごと・部位別）。 */
export const exercises = sqliteTable(
  "exercises",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId").notNull(),
    bodyPart: text("bodyPart", { enum: BODY_PARTS }).notNull(),
    name: text("name").notNull(),
    createdAt: ts("createdAt"),
  },
  (t) => ({
    userIdx: index("exercises_user_idx").on(t.userId, t.bodyPart),
  })
);

export type Exercise = typeof exercises.$inferSelect;
export type InsertExercise = typeof exercises.$inferInsert;

/** 1セットの記録（重量×回数）。合計負荷量 = Σ weightKg×reps。 */
export const workoutSets = sqliteTable(
  "workout_sets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId").notNull(),
    recordDate: text("recordDate").notNull(),
    bodyPart: text("bodyPart", { enum: BODY_PARTS }).notNull(),
    exerciseName: text("exerciseName").notNull(),
    setNo: integer("setNo").notNull(),
    weightKg: text("weightKg"),
    reps: integer("reps"),
    memo: text("memo"),
    createdAt: ts("createdAt"),
  },
  (t) => ({
    userDateIdx: index("workout_sets_user_date_idx").on(t.userId, t.recordDate),
  })
);

export type WorkoutSet = typeof workoutSets.$inferSelect;
export type InsertWorkoutSet = typeof workoutSets.$inferInsert;

/**
 * ユーザー独自の食品（My Foods）。MyFitnessPalの「自分で食品を作成」に相当。
 * 値は1食分（servingLabelで表す1単位）あたり。検索でヒットし人前(servings)で記録する。
 */
export const customFoods = sqliteTable(
  "custom_foods",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId").notNull(),
    name: text("name").notNull(),
    brand: text("brand"),
    servingLabel: text("servingLabel").notNull().default("1食"),
    calories: text("calories").notNull().default("0"),
    proteinG: text("proteinG").notNull().default("0"),
    fatG: text("fatG").notNull().default("0"),
    carbsG: text("carbsG").notNull().default("0"),
    createdAt: ts("createdAt"),
  },
  (t) => ({
    userIdx: index("custom_foods_user_idx").on(t.userId),
  })
);

export type CustomFood = typeof customFoods.$inferSelect;
export type InsertCustomFood = typeof customFoods.$inferInsert;

/**
 * ユーザー独自の「食事セット」（My Meals）。MyFitnessPalの「My Meals」に相当。
 * 複数の食品をまとめて1つの名前で保存し、ワンタップで全部記録する。
 * itemsJson は [{name, calories, proteinG, fatG, carbsG}] のJSON配列。
 */
export const customMeals = sqliteTable(
  "custom_meals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId").notNull(),
    name: text("name").notNull(),
    itemsJson: text("itemsJson").notNull().default("[]"),
    createdAt: ts("createdAt"),
  },
  (t) => ({
    userIdx: index("custom_meals_user_idx").on(t.userId),
  })
);

export type CustomMeal = typeof customMeals.$inferSelect;
export type InsertCustomMeal = typeof customMeals.$inferInsert;

/**
 * 水分記録（MyFitnessPalの水ログ）。1日1行、cups は杯数(1杯=250ml)。
 */
export const waterLogs = sqliteTable(
  "water_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId").notNull(),
    logDate: text("logDate").notNull(),
    cups: integer("cups").notNull().default(0),
    createdAt: ts("createdAt"),
  },
  (t) => ({
    userDateIdx: index("water_logs_user_date_idx").on(t.userId, t.logDate),
  })
);

export type WaterLog = typeof waterLogs.$inferSelect;

/**
 * AI利用量カウンタ（無料枠を守るため、ユーザー×日ごとのAI呼び出し回数を記録）。
 */
export const aiUsage = sqliteTable(
  "ai_usage",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId").notNull(),
    usageDate: text("usageDate").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => ({
    userDateIdx: index("ai_usage_user_date_idx").on(t.userId, t.usageDate),
  })
);

/**
 * AI結果キャッシュ（同じ問い合わせ＝食品名などは結果を全ユーザーで使い回し、重複呼び出しを防ぐ）。
 */
export const aiCache = sqliteTable(
  "ai_cache",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    cacheKey: text("cacheKey").notNull().unique(),
    resultJson: text("resultJson").notNull(),
    createdAt: ts("createdAt"),
  }
);
