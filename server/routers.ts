import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { storagePut } from "./storage";
import { analyzeMealImage, buildTrainerPlan, estimateWorkoutCalories, suggestConvenienceCombo } from "./ai";
import { buildPlan, suggestPfcTargets } from "./nutrition";

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

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
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

    remove: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteMeal(ctx.user.id, input.id);
        return { success: true } as const;
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

  /* ============================== convenience ============================== */
  convenience: router({
    search: protectedProcedure
      .input(
        z.object({
          chain: chainSchema.optional(),
          category: categorySchema.optional(),
          keyword: z.string().max(60).optional(),
          maxKcal: z.number().int().min(0).max(2000).optional(),
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

  /* ============================== coach (AI trainer) ============================== */
  coach: router({
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
