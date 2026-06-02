import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { scrypt as scryptCb, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";
import { BODY_PARTS } from "../drizzle/schema";
import * as db from "./db";
import { storagePut } from "./storage";
import { analyzeMealImage, analyzePackageImage, estimateMealByName, buildTrainerPlan, buildDailyAdvice, buildMealPlan, estimateWorkoutCalories, suggestConvenienceCombo } from "./ai";
import { buildPlan, suggestPfcTargets } from "./nutrition";
import { searchBasicFoods } from "./basic-foods";

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD形式で指定してください");

const mealTypeSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);
const chainSchema = z.enum(["seven", "familymart", "lawson"]);
const categorySchema = z.enum([
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
]);

function uploadDataUrl(userId: number, dataUrl: string, prefix: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "画像データ形式が不正です" });
  const mime = match[1];
  const b64 = match[2];
  const buffer = Buffer.from(b64, "base64");
  if (buffer.length > 12 * 1024 * 1024) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "画像サイズは12MBまでです" });
  }
  const ext = mime.split("/")[1]?.replace("+xml", "") || "jpg";
  const key = `${userId}-${prefix}/${Date.now()}.${ext}`;
  return storagePut(key, buffer, mime);
}

/* ============================== auth helpers ============================== */
const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number
) => Promise<Buffer>;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const derived = await scrypt(password, salt, 64);
  const keyBuf = Buffer.from(key, "hex");
  return keyBuf.length === derived.length && timingSafeEqual(keyBuf, derived);
}

/** Sign a session JWT (JWT_SECRET, HS256) and set it as the session cookie. */
async function issueSession(ctx: TrpcContext, user: { openId: string; name: string | null }) {
  const token = await sdk.createSessionToken(user.openId, {
    name: user.name ?? "",
    expiresInMs: ONE_YEAR_MS,
  });
  const cookieOptions = getSessionCookieOptions(ctx.req);
  ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
}

/** Never leak the password hash to the client. */
function publicUser(user: User) {
  const { passwordHash: _omit, ...safe } = user;
  return safe;
}

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => (opts.ctx.user ? publicUser(opts.ctx.user) : null)),
    register: publicProcedure
      .input(
        z.object({
          email: z.string().email("メールアドレスの形式が正しくありません"),
          password: z.string().min(6, "パスワードは6文字以上にしてください"),
          name: z.string().trim().max(40).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const email = input.email.trim().toLowerCase();
        const openId = `local:${email}`;
        // メールで検索（移行ユーザーはopenIdがManus形式のため、emailで突き合わせる）
        const existing = await db.getUserByEmail(email);
        if (existing) {
          // Manus移行ユーザー(passwordHash未設定)は、同じメールでの登録を「claim」として扱い
          // パスワードを後付けして既存データへログインさせる。
          if (!existing.passwordHash) {
            const claimed = await db.setUserPassword(
              existing.id,
              await hashPassword(input.password),
              input.name?.trim() || existing.name || email.split("@")[0]
            );
            const user = claimed ?? existing;
            await issueSession(ctx, user);
            return publicUser(user);
          }
          throw new TRPCError({
            code: "CONFLICT",
            message: "このメールアドレスは既に登録されています",
          });
        }
        const passwordHash = await hashPassword(input.password);
        const user = await db.createUserWithPassword({
          openId,
          email,
          name: input.name?.trim() || email.split("@")[0],
          passwordHash,
        });
        if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "登録に失敗しました" });
        await issueSession(ctx, user);
        return publicUser(user);
      }),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const email = input.email.trim().toLowerCase();
        const user = await db.getUserByEmail(email);
        if (!user || !user.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "メールアドレスまたはパスワードが違います",
          });
        }
        await issueSession(ctx, user);
        return publicUser(user);
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  /* ============================== meals ============================== */
  meals: router({
    listByDate: protectedProcedure
      .input(z.object({ date: dateStringSchema }))
      .query(({ ctx, input }) => db.listMealsByDate(ctx.user.id, input.date)),

    summary: protectedProcedure
      .input(z.object({ date: dateStringSchema }))
      .query(({ ctx, input }) => db.sumMealsByDate(ctx.user.id, input.date)),

    monthlySummary: protectedProcedure
      .input(z.object({ yearMonth: z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM形式で指定してください") }))
      .query(({ ctx, input }) => db.listMealSummariesByMonth(ctx.user.id, input.yearMonth)),

    analyzePhoto: protectedProcedure
      .input(
        z.object({
          imageDataUrl: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { url } = await uploadDataUrl(ctx.user.id, input.imageDataUrl, "meals");
        const origin = `${ctx.req.protocol}://${ctx.req.headers.host}`;
        const absolute = url.startsWith("http") ? url : `${origin}${url}`;
        const result = await analyzeMealImage(absolute);
        return { imageUrl: url, analysis: result };
      }),

    analyzePackage: protectedProcedure
      .input(z.object({ imageDataUrl: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const { url } = await uploadDataUrl(ctx.user.id, input.imageDataUrl, "meals");
        const origin = `${ctx.req.protocol}://${ctx.req.headers.host}`;
        const absolute = url.startsWith("http") ? url : `${origin}${url}`;
        const result = await analyzePackageImage(absolute);
        return { imageUrl: url, analysis: result };
      }),

    estimateByName: protectedProcedure
      .input(z.object({ query: z.string().trim().min(1).max(100) }))
      .mutation(async ({ input }) => {
        const analysis = await estimateMealByName(input.query);
        return { analysis };
      }),

    add: protectedProcedure
      .input(
        z.object({
          date: dateStringSchema,
          mealType: mealTypeSchema,
          description: z.string().max(500).optional().nullable(),
          imageUrl: z.string().optional().nullable(),
          calories: z.number().min(0).max(5000),
          proteinG: z.number().min(0).max(500),
          fatG: z.number().min(0).max(500),
          carbsG: z.number().min(0).max(1000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.insertMeal({
          userId: ctx.user.id,
          mealDate: input.date,
          mealType: input.mealType,
          description: input.description ?? null,
          imageUrl: input.imageUrl ?? null,
          calories: String(input.calories),
          proteinG: String(input.proteinG),
          fatG: String(input.fatG),
          carbsG: String(input.carbsG),
        });
        return { success: true } as const;
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          mealType: mealTypeSchema,
          description: z.string().max(500).optional().nullable(),
          calories: z.number().min(0).max(5000),
          proteinG: z.number().min(0).max(500),
          fatG: z.number().min(0).max(500),
          carbsG: z.number().min(0).max(1000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.updateMeal(ctx.user.id, input.id, {
          mealType: input.mealType,
          description: input.description ?? null,
          calories: String(input.calories),
          proteinG: String(input.proteinG),
          fatG: String(input.fatG),
          carbsG: String(input.carbsG),
        });
        return { success: true } as const;
      }),

    remove: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteMeal(ctx.user.id, input.id);
        return { success: true } as const;
      }),

    frequentItems: protectedProcedure.query(({ ctx }) => db.frequentMeals(ctx.user.id, 8)),

    history: protectedProcedure.query(({ ctx }) => db.foodHistory(ctx.user.id, 100)),

    copyFromDate: protectedProcedure
      .input(z.object({ fromDate: dateStringSchema, toDate: dateStringSchema }))
      .mutation(async ({ ctx, input }) => {
        const count = await db.copyMealsFromDate(ctx.user.id, input.fromDate, input.toDate);
        return { count };
      }),
  }),

  /* ============================== stats ============================== */
  stats: router({
    streak: protectedProcedure
      .input(z.object({ today: dateStringSchema }))
      .query(async ({ ctx, input }) => {
        const dates = new Set(await db.getActivityDates(ctx.user.id));
        const prev = (d: string) => {
          const [y, m, day] = d.split("-").map(Number);
          const dt = new Date(Date.UTC(y, m - 1, day - 1));
          return dt.toISOString().slice(0, 10);
        };
        // 今日が未記録でも、昨日まで続いていれば「継続中」とみなす（猶予）。
        let cursor = input.today;
        if (!dates.has(cursor)) cursor = prev(cursor);
        let streak = 0;
        while (dates.has(cursor)) {
          streak += 1;
          cursor = prev(cursor);
        }
        const recordedToday = dates.has(input.today);
        return { streak, recordedToday, totalDays: dates.size };
      }),

    weeklyReview: protectedProcedure
      .input(z.object({ today: dateStringSchema }))
      .query(async ({ ctx, input }) => {
        const prevN = (d: string, n: number) => {
          const [y, m, day] = d.split("-").map(Number);
          const dt = new Date(Date.UTC(y, m - 1, day - n));
          return dt.toISOString().slice(0, 10);
        };
        const start = prevN(input.today, 6); // 直近7日
        const [dailyTotals, goal, weightsAll] = await Promise.all([
          db.listMealDailyTotals(ctx.user.id, start, input.today),
          db.getGoal(ctx.user.id),
          db.listWeights(ctx.user.id),
        ]);
        const daysWithMeals = dailyTotals.length;
        const avgCalories =
          daysWithMeals > 0
            ? Math.round(dailyTotals.reduce((a, b) => a + b.calories, 0) / daysWithMeals)
            : 0;
        const target = goal ? Number(goal.targetCalories) : null;
        const goalMetDays = target
          ? dailyTotals.filter((d) => d.calories > 0 && d.calories <= target).length
          : 0;
        // 期間内の体重変化
        const inRange = weightsAll.filter((w) => w.recordDate >= start && w.recordDate <= input.today);
        const weightChange =
          inRange.length >= 2
            ? Number(inRange[inRange.length - 1].weightKg) - Number(inRange[0].weightKg)
            : null;
        return { avgCalories, daysWithMeals, goalMetDays, target, weightChange };
      }),
  }),

  /* ============================== weights ============================== */
  weights: router({
    list: protectedProcedure.query(({ ctx }) => db.listWeights(ctx.user.id)),
    latest: protectedProcedure.query(({ ctx }) => db.getLatestWeight(ctx.user.id)),
    first: protectedProcedure.query(({ ctx }) => db.getFirstWeight(ctx.user.id)),
    add: protectedProcedure
      .input(
        z.object({
          date: dateStringSchema,
          weightKg: z.number().min(20).max(300),
          note: z.string().max(500).optional().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.upsertWeight(ctx.user.id, input.date, input.weightKg.toFixed(2), input.note);
        return { success: true } as const;
      }),
    remove: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteWeight(ctx.user.id, input.id);
        return { success: true } as const;
      }),
  }),

  /* ============================== workouts ============================== */
  workouts: router({
    listByDate: protectedProcedure
      .input(z.object({ date: dateStringSchema }))
      .query(({ ctx, input }) => db.listWorkoutsByDate(ctx.user.id, input.date)),
    recent: protectedProcedure.query(({ ctx }) => db.listRecentWorkouts(ctx.user.id, 60)),
    add: protectedProcedure
      .input(
        z.object({
          date: dateStringSchema,
          activity: z.string().min(1).max(120),
          durationMin: z.number().int().min(0).max(600).default(0),
          intensity: z.enum(["low", "medium", "high"]).default("medium"),
          weightKg: z.number().min(0).max(500).optional().nullable(),
          reps: z.number().int().min(0).max(200).optional().nullable(),
          sets: z.number().int().min(0).max(50).optional().nullable(),
          caloriesBurned: z.number().min(0).max(5000).optional().nullable(),
          incline: z.boolean().optional().nullable(),
          note: z.string().max(500).optional().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // 消費kcalが未指定なら、AIで概算する
        let calories = input.caloriesBurned;
        // 重量×回数×セットからの仮の運動時間（休憩込み）を補完
        let duration = input.durationMin;
        if (!duration && input.sets && input.reps) {
          duration = Math.max(1, input.sets * 2); // 1セットあたり約2分(休憩込み)
        }
        if ((calories === undefined || calories === null) && (duration > 0 || (input.sets && input.reps))) {
          try {
            const goal = await db.getGoal(ctx.user.id);
            const latestWeight = await db.getLatestWeight(ctx.user.id);
            const bodyWeight = goal ? Number(goal.currentWeightKg) : latestWeight ? Number(latestWeight.weightKg) : null;
            const est = await estimateWorkoutCalories({
              activity: input.activity,
              durationMin: duration || (input.sets ?? 0) * 2,
              intensity: input.intensity,
              weightKg: input.weightKg ?? null,
              reps: input.reps ?? null,
              sets: input.sets ?? null,
              bodyWeightKg: bodyWeight,
              incline: input.incline ?? null,
            });
            calories = est.caloriesBurned;
          } catch (e) {
            console.warn("[workouts.add] AI estimate failed", e);
          }
        }
        await db.insertWorkout({
          userId: ctx.user.id,
          recordDate: input.date,
          activity: input.activity,
          durationMin: duration ?? 0,
          intensity: input.intensity,
          weightKg: typeof input.weightKg === "number" ? input.weightKg.toFixed(2) : null,
          reps: input.reps ?? null,
          sets: input.sets ?? null,
          caloriesBurned:
            typeof calories === "number" ? String(calories) : null,
          note: input.note ?? null,
        });
        return { success: true, estimatedCalories: typeof calories === "number" ? calories : null } as const;
      }),

    estimateCalories: protectedProcedure
      .input(
        z.object({
          activity: z.string().min(1).max(120),
          durationMin: z.number().int().min(0).max(600).default(0),
          intensity: z.enum(["low", "medium", "high"]).default("medium"),
          weightKg: z.number().min(0).max(500).optional().nullable(),
          reps: z.number().int().min(0).max(200).optional().nullable(),
          sets: z.number().int().min(0).max(50).optional().nullable(),
          incline: z.boolean().optional().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const goal = await db.getGoal(ctx.user.id);
        const latestWeight = await db.getLatestWeight(ctx.user.id);
        const bodyWeight = goal ? Number(goal.currentWeightKg) : latestWeight ? Number(latestWeight.weightKg) : null;
        const duration = input.durationMin || (input.sets ? input.sets * 2 : 10);
        return estimateWorkoutCalories({
          ...input,
          durationMin: duration,
          bodyWeightKg: bodyWeight,
        });
      }),
    remove: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteWorkout(ctx.user.id, input.id);
        return { success: true } as const;
      }),
  }),

  /* ============================== strength (筋トレ) ============================== */
  strength: router({
    exercises: protectedProcedure.query(({ ctx }) => db.listExercises(ctx.user.id)),
    addExercise: protectedProcedure
      .input(z.object({ bodyPart: z.enum(BODY_PARTS), name: z.string().trim().min(1).max(60) }))
      .mutation(({ ctx, input }) => db.addExercise(ctx.user.id, input.bodyPart, input.name)),
    setsByDate: protectedProcedure
      .input(z.object({ date: dateStringSchema }))
      .query(({ ctx, input }) => db.listWorkoutSetsByDate(ctx.user.id, input.date)),
    lastSets: protectedProcedure
      .input(z.object({ exerciseName: z.string().min(1), beforeDate: dateStringSchema }))
      .query(({ ctx, input }) => db.lastSetsForExercise(ctx.user.id, input.exerciseName, input.beforeDate)),
    saveSets: protectedProcedure
      .input(
        z.object({
          date: dateStringSchema,
          bodyPart: z.enum(BODY_PARTS),
          exerciseName: z.string().min(1).max(60),
          sets: z
            .array(
              z.object({
                weightKg: z.string().max(10).nullable(),
                reps: z.number().int().min(0).max(1000).nullable(),
                memo: z.string().max(200).nullable(),
              })
            )
            .max(30),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const count = await db.saveWorkoutSets(
          ctx.user.id,
          input.date,
          input.bodyPart,
          input.exerciseName,
          input.sets
        );
        return { count };
      }),
    dayVolume: protectedProcedure
      .input(z.object({ date: dateStringSchema }))
      .query(({ ctx, input }) => db.getVolumeByDate(ctx.user.id, input.date)),
    history: protectedProcedure
      .input(z.object({ days: z.number().int().min(1).max(120).optional() }).optional())
      .query(({ ctx, input }) => db.listVolumeHistory(ctx.user.id, input?.days ?? 30)),
  }),

  /* ============================== goals ============================== */
  goals: router({
    get: protectedProcedure.query(({ ctx }) => db.getGoal(ctx.user.id)),

    save: protectedProcedure
      .input(
        z.object({
          gender: z.enum(["male", "female"]),
          age: z.number().int().min(10).max(100),
          heightCm: z.number().min(100).max(230),
          currentWeightKg: z.number().min(20).max(300),
          targetWeightKg: z.number().min(20).max(300),
          targetWeeks: z.number().int().min(1).max(104),
          activityLevel: z.enum(["sedentary", "light", "moderate", "active", "veryActive"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const plan = buildPlan(input);
        await db.upsertGoal({
          userId: ctx.user.id,
          gender: input.gender,
          age: input.age,
          heightCm: String(input.heightCm),
          currentWeightKg: String(input.currentWeightKg),
          targetWeightKg: String(input.targetWeightKg),
          targetWeeks: input.targetWeeks,
          activityLevel: input.activityLevel,
          bmr: String(plan.bmr),
          tdee: String(plan.tdee),
          targetCalories: String(plan.targetCalories),
          weeklyLossKg: String(plan.weeklyLossKg),
        });
        const pfc = suggestPfcTargets(plan.targetCalories, input.currentWeightKg);
        return { ...plan, pfc };
      }),

    preview: publicProcedure
      .input(
        z.object({
          gender: z.enum(["male", "female"]),
          age: z.number().int().min(10).max(100),
          heightCm: z.number().min(100).max(230),
          currentWeightKg: z.number().min(20).max(300),
          targetWeightKg: z.number().min(20).max(300),
          targetWeeks: z.number().int().min(1).max(104),
          activityLevel: z.enum(["sedentary", "light", "moderate", "active", "veryActive"]),
        })
      )
      .query(({ input }) => {
        const plan = buildPlan(input);
        const pfc = suggestPfcTargets(plan.targetCalories, input.currentWeightKg);
        return { ...plan, pfc };
      }),
  }),

  /* ============================== basic foods ============================== */
  foods: router({
    search: protectedProcedure
      .input(z.object({ keyword: z.string().max(60).optional(), limit: z.number().int().min(1).max(50).optional() }))
      .query(({ input }) =>
        searchBasicFoods(input.keyword, input.limit ?? 30).map((f) => ({
          name: f.name,
          category: f.category,
          per100: f.per100,
          defaultGrams: f.defaultGrams,
        }))
      ),

    /* ── My Foods（自分で作成した食品） ── */
    myFoods: protectedProcedure
      .input(z.object({ keyword: z.string().max(60).optional() }).optional())
      .query(({ ctx, input }) => db.listCustomFoods(ctx.user.id, input?.keyword)),

    createCustom: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(80),
          brand: z.string().max(60).optional(),
          servingLabel: z.string().min(1).max(40).default("1食"),
          calories: z.number().min(0).max(9000),
          proteinG: z.number().min(0).max(2000),
          fatG: z.number().min(0).max(2000),
          carbsG: z.number().min(0).max(2000),
        })
      )
      .mutation(({ ctx, input }) => db.addCustomFood({ userId: ctx.user.id, ...input })),

    updateCustom: protectedProcedure
      .input(
        z.object({
          id: z.number().int(),
          name: z.string().min(1).max(80),
          servingLabel: z.string().min(1).max(40).default("1食"),
          calories: z.number().min(0).max(9000),
          proteinG: z.number().min(0).max(2000),
          fatG: z.number().min(0).max(2000),
          carbsG: z.number().min(0).max(2000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateCustomFood(ctx.user.id, id, data);
        return { ok: true };
      }),

    deleteCustom: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteCustomFood(ctx.user.id, input.id);
        return { ok: true };
      }),

    /* ── My Meals（自分の食事セット） ── */
    myMeals: protectedProcedure.query(async ({ ctx }) => {
      const rows = await db.listCustomMeals(ctx.user.id);
      return rows.map((r) => {
        let items: { name: string; calories: number; proteinG: number; fatG: number; carbsG: number }[] = [];
        try {
          items = JSON.parse(r.itemsJson);
        } catch {
          items = [];
        }
        return { id: r.id, name: r.name, items };
      });
    }),

    saveMeal: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(60),
          items: z
            .array(
              z.object({
                name: z.string().max(120),
                calories: z.number(),
                proteinG: z.number(),
                fatG: z.number(),
                carbsG: z.number(),
              })
            )
            .min(1),
        })
      )
      .mutation(({ ctx, input }) => db.addCustomMeal(ctx.user.id, input.name, input.items)),

    updateMeal: protectedProcedure
      .input(
        z.object({
          id: z.number().int(),
          name: z.string().min(1).max(60),
          items: z
            .array(
              z.object({
                name: z.string().max(120),
                calories: z.number(),
                proteinG: z.number(),
                fatG: z.number(),
                carbsG: z.number(),
              })
            )
            .min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.updateCustomMeal(ctx.user.id, input.id, input.name, input.items);
        return { ok: true };
      }),

    deleteMeal: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteCustomMeal(ctx.user.id, input.id);
        return { ok: true };
      }),
  }),

  /* ============================== water ============================== */
  water: router({
    get: protectedProcedure
      .input(z.object({ date: dateStringSchema }))
      .query(({ ctx, input }) => db.getWaterCups(ctx.user.id, input.date)),
    set: protectedProcedure
      .input(z.object({ date: dateStringSchema, cups: z.number().int().min(0).max(30) }))
      .mutation(({ ctx, input }) => db.setWaterCups(ctx.user.id, input.date, input.cups)),
  }),

  /* ============================== convenience ============================== */
  convenience: router({
    search: protectedProcedure
      .input(
        z.object({
          chain: chainSchema.optional(),
          category: categorySchema.optional(),
          keyword: z.string().max(60).optional(),
          maxKcal: z.number().int().min(0).max(2000).optional(),
          limit: z.number().int().min(1).max(100).optional(),
        })
      )
      .query(({ input }) => db.searchConvenienceItems(input)),

    suggestCombo: protectedProcedure
      .input(
        z.object({
          remainingCalories: z.number().int().min(100).max(2500),
          proteinFocus: z.boolean().default(true),
          preferredChain: z.enum(["seven", "familymart", "lawson", "any"]).default("any"),
          note: z.string().max(200).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const all = await db.searchConvenienceItems({
          chain: input.preferredChain === "any" ? undefined : input.preferredChain,
          maxKcal: input.remainingCalories,
          limit: 80,
        });
        const candidates = all.map((c) => ({
          id: c.id,
          chain: c.chain,
          category: c.category,
          name: c.name,
          calories: Number(c.calories),
          proteinG: Number(c.proteinG),
          fatG: Number(c.fatG),
          carbsG: Number(c.carbsG),
          priceYen: c.priceYen,
        }));
        const result = await suggestConvenienceCombo({
          remainingCalories: input.remainingCalories,
          proteinFocus: input.proteinFocus,
          preferredChain: input.preferredChain,
          note: input.note,
          candidates,
        });
        return result;
      }),
  }),

  /* ============================== AI食事トレーナー ============================== */
  trainer: router({
    mealPlan: protectedProcedure
      .input(z.object({ preference: z.string().max(300).optional() }))
      .mutation(async ({ ctx, input }) => {
        const goal = await db.getGoal(ctx.user.id);
        if (!goal) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "先に目標を設定してください" });
        }
        // 実在のコンビニ商品を候補として渡し、conveniencePlanのハルシネーションを防ぐ。
        // 低脂質・高タンパク優先で並べ、上限80件まで。
        const items = await db.searchConvenienceItems({ limit: 200 });
        const convenienceCandidates = items
          .map((c) => ({
            name: c.name,
            kcal: Number(c.calories),
            proteinG: Number(c.proteinG),
            fatG: Number(c.fatG),
          }))
          .sort((a, b) => b.proteinG / Math.max(b.kcal, 1) - a.proteinG / Math.max(a.kcal, 1))
          .slice(0, 80);
        return buildMealPlan({
          gender: goal.gender,
          age: goal.age,
          heightCm: Number(goal.heightCm),
          currentWeightKg: Number(goal.currentWeightKg),
          targetWeightKg: Number(goal.targetWeightKg),
          targetWeeks: goal.targetWeeks,
          weeklyLossKg: Number(goal.weeklyLossKg),
          tdee: Number(goal.tdee),
          targetCalories: Number(goal.targetCalories),
          activityLevel: goal.activityLevel,
          preference: input.preference,
          convenienceCandidates,
        });
      }),
  }),

  /* ============================== coach (AI trainer) ============================== */
  coach: router({
    dailyAdvice: protectedProcedure
      .input(z.object({ today: dateStringSchema }))
      .query(async ({ ctx, input }) => {
        const [goal, summary, weightsAll] = await Promise.all([
          db.getGoal(ctx.user.id),
          db.sumMealsByDate(ctx.user.id, input.today),
          db.listWeights(ctx.user.id),
        ]);
        // 直近21日の体重から週あたりの増減ペースを概算
        const prevN = (d: string, n: number) => {
          const [y, m, day] = d.split("-").map(Number);
          return new Date(Date.UTC(y, m - 1, day - n)).toISOString().slice(0, 10);
        };
        const since = prevN(input.today, 21);
        const recent = weightsAll.filter((w) => w.recordDate >= since);
        let trend: number | null = null;
        if (recent.length >= 2) {
          const first = recent[0];
          const last = recent[recent.length - 1];
          const days =
            (Date.parse(last.recordDate) - Date.parse(first.recordDate)) / 86400000 || 1;
          trend = ((Number(last.weightKg) - Number(first.weightKg)) / days) * 7;
        }
        const target = goal ? Number(goal.targetCalories) : null;
        const targetProtein = goal ? Math.round(Number(goal.currentWeightKg) * 2) : null;
        const advice = await buildDailyAdvice({
          targetCalories: target,
          consumedCalories: Math.round(summary.calories),
          proteinG: Math.round(summary.proteinG),
          fatG: Math.round(summary.fatG),
          carbsG: Math.round(summary.carbsG),
          targetProteinG: targetProtein,
          currentWeightKg: weightsAll.length ? Number(weightsAll[weightsAll.length - 1].weightKg) : null,
          targetWeightKg: goal ? Number(goal.targetWeightKg) : null,
          recentWeightTrendKgPerWeek: trend === null ? null : Number(trend.toFixed(2)),
          streakDays: 0,
        });
        return { advice };
      }),

    suggestPlan: protectedProcedure
      .input(
        z.object({
          experience: z.enum(["beginner", "intermediate", "advanced"]),
          daysPerWeek: z.number().int().min(1).max(7),
          environment: z.enum(["gym", "home", "both"]),
          focusArea: z.string().max(120).optional(),
          hasInjury: z.string().max(200).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const goal = await db.getGoal(ctx.user.id);
        if (!goal) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "先に目標を設定してください",
          });
        }
        return buildTrainerPlan({
          gender: goal.gender,
          age: goal.age,
          heightCm: Number(goal.heightCm),
          currentWeightKg: Number(goal.currentWeightKg),
          targetWeightKg: Number(goal.targetWeightKg),
          experience: input.experience,
          daysPerWeek: input.daysPerWeek,
          environment: input.environment,
          focusArea: input.focusArea,
          hasInjury: input.hasInjury,
        });
      }),
  }),

  /* ============================== bodyPhotos ============================== */
  bodyPhotos: router({
    list: protectedProcedure.query(({ ctx }) => db.listBodyPhotos(ctx.user.id)),

    upload: protectedProcedure
      .input(
        z.object({
          date: dateStringSchema,
          imageDataUrl: z.string().min(1),
          weightKg: z.number().min(20).max(300).optional().nullable(),
          note: z.string().max(500).optional().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { url } = await uploadDataUrl(ctx.user.id, input.imageDataUrl, "body");
        await db.insertBodyPhoto({
          userId: ctx.user.id,
          recordDate: input.date,
          imageUrl: url,
          weightKg:
            typeof input.weightKg === "number" ? input.weightKg.toFixed(2) : null,
          note: input.note ?? null,
        });
        return { success: true, imageUrl: url } as const;
      }),

    remove: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteBodyPhoto(ctx.user.id, input.id);
        return { success: true } as const;
      }),
  }),

  /* ============================== reminders ============================== */
  reminders: router({
    get: protectedProcedure.query(({ ctx }) => db.getReminderSettings(ctx.user.id)),
    checkStatus: protectedProcedure
      .input(z.object({ date: dateStringSchema }))
      .query(async ({ ctx, input }) => {
        const [meals, weight] = await Promise.all([
          db.listMealsByDate(ctx.user.id, input.date),
          db.getWeightByDate(ctx.user.id, input.date),
        ]);
        return {
          hasMealToday: meals.length > 0,
          hasWeightToday: Boolean(weight),
        };
      }),
    update: protectedProcedure
      .input(
        z.object({
          mealEnabled: z.boolean(),
          mealReminderTime: z.string().regex(/^\d{2}:\d{2}$/),
          weightEnabled: z.boolean(),
          weightReminderTime: z.string().regex(/^\d{2}:\d{2}$/),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.upsertReminderSettings({
          userId: ctx.user.id,
          mealEnabled: input.mealEnabled ? 1 : 0,
          mealReminderTime: input.mealReminderTime,
          weightEnabled: input.weightEnabled ? 1 : 0,
          weightReminderTime: input.weightReminderTime,
        });
        return { success: true } as const;
      }),
  }),
});

export type AppRouter = typeof appRouter;
