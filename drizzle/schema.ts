import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, date, index, customType } from "drizzle-orm/mysql-core";

// MySQL DATE returns ISO YYYY-MM-DD strings; declare a string-mode variant to keep typings consistent.
const dateStr = (name: string) =>
  customType<{ data: string; driverData: string }>({
    dataType() {
      return "date";
    },
    fromDriver(value: any) {
      if (value instanceof Date) {
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, "0");
        const d = String(value.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
      }
      return String(value);
    },
  })(name);

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 食事記録テーブル
 * mealType: breakfast(朝) / lunch(昼) / dinner(夜) / snack(間食)
 */
export const meals = mysqlTable(
  "meals",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    mealDate: dateStr("mealDate").notNull(),
    mealType: mysqlEnum("mealType", ["breakfast", "lunch", "dinner", "snack"]).notNull(),
    description: text("description"),
    imageUrl: text("imageUrl"),
    calories: decimal("calories", { precision: 7, scale: 1 }).notNull().default("0"),
    proteinG: decimal("proteinG", { precision: 6, scale: 1 }).notNull().default("0"),
    fatG: decimal("fatG", { precision: 6, scale: 1 }).notNull().default("0"),
    carbsG: decimal("carbsG", { precision: 6, scale: 1 }).notNull().default("0"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
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
export const weights = mysqlTable(
  "weights",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    recordDate: dateStr("recordDate").notNull(),
    weightKg: decimal("weightKg", { precision: 5, scale: 2 }).notNull(),
    note: text("note"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
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
export const workouts = mysqlTable(
  "workouts",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    recordDate: dateStr("recordDate").notNull(),
    activity: varchar("activity", { length: 120 }).notNull(),
    durationMin: int("durationMin").notNull().default(0),
    intensity: mysqlEnum("intensity", ["low", "medium", "high"]).notNull().default("medium"),
    weightKg: decimal("weightKg", { precision: 6, scale: 2 }),
    reps: int("reps"),
    sets: int("sets"),
    caloriesBurned: decimal("caloriesBurned", { precision: 7, scale: 1 }),
    note: text("note"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    userDateIdx: index("workouts_user_date_idx").on(t.userId, t.recordDate),
  })
);

export type Workout = typeof workouts.$inferSelect;
export type InsertWorkout = typeof workouts.$inferInsert;

/**
 * 目標設定テーブル（ユーザーごとに最新1件のみ運用）
 * gender: male / female
 * activityLevel:
 *   sedentary(1.2) / light(1.375) / moderate(1.55) / active(1.725) / veryActive(1.9)
 */
export const goals = mysqlTable("goals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  gender: mysqlEnum("gender", ["male", "female"]).notNull(),
  age: int("age").notNull(),
  heightCm: decimal("heightCm", { precision: 5, scale: 1 }).notNull(),
  currentWeightKg: decimal("currentWeightKg", { precision: 5, scale: 2 }).notNull(),
  targetWeightKg: decimal("targetWeightKg", { precision: 5, scale: 2 }).notNull(),
  targetWeeks: int("targetWeeks").notNull(),
  activityLevel: mysqlEnum("activityLevel", [
    "sedentary",
    "light",
    "moderate",
    "active",
    "veryActive",
  ]).notNull(),
  bmr: decimal("bmr", { precision: 7, scale: 1 }).notNull(),
  tdee: decimal("tdee", { precision: 7, scale: 1 }).notNull(),
  targetCalories: decimal("targetCalories", { precision: 7, scale: 1 }).notNull(),
  weeklyLossKg: decimal("weeklyLossKg", { precision: 4, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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
export const convenienceItems = mysqlTable(
  "convenience_items",
  {
    id: int("id").autoincrement().primaryKey(),
    chain: mysqlEnum("chain", ["seven", "familymart", "lawson"]).notNull(),
    category: mysqlEnum("category", [
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
    ]).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    calories: decimal("calories", { precision: 7, scale: 1 }).notNull(),
    proteinG: decimal("proteinG", { precision: 6, scale: 1 }).notNull(),
    fatG: decimal("fatG", { precision: 6, scale: 1 }).notNull(),
    carbsG: decimal("carbsG", { precision: 6, scale: 1 }).notNull(),
    priceYen: int("priceYen"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
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
export const bodyPhotos = mysqlTable(
  "body_photos",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    recordDate: dateStr("recordDate").notNull(),
    imageUrl: text("imageUrl").notNull(),
    weightKg: decimal("weightKg", { precision: 5, scale: 2 }),
    note: text("note"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
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
export const reminderSettings = mysqlTable("reminder_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  mealEnabled: int("mealEnabled").notNull().default(0),
  mealReminderTime: varchar("mealReminderTime", { length: 5 }).notNull().default("20:00"),
  weightEnabled: int("weightEnabled").notNull().default(0),
  weightReminderTime: varchar("weightReminderTime", { length: 5 }).notNull().default("08:00"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReminderSettings = typeof reminderSettings.$inferSelect;
export type InsertReminderSettings = typeof reminderSettings.$inferInsert;
