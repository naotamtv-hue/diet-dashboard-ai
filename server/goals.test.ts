import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function makeCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "sample-openid",
      email: "sample@example.com",
      name: "sample",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: { host: "example.test" } } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

describe("goals.preview", () => {
  it("returns BMR / TDEE / targetCalories / PFC for a typical input", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const out = await caller.goals.preview({
      gender: "male",
      age: 30,
      heightCm: 175,
      currentWeightKg: 80,
      targetWeightKg: 70,
      targetWeeks: 12,
      activityLevel: "moderate",
    });
    expect(out.bmr).toBeGreaterThan(1000);
    expect(out.tdee).toBeGreaterThan(out.bmr);
    expect(out.targetCalories).toBeGreaterThan(0);
    expect(out.targetCalories).toBeLessThan(out.tdee);
    expect(out.pfc.proteinG).toBeGreaterThan(0);
    expect(out.pfc.fatG).toBeGreaterThan(0);
    expect(out.pfc.carbsG).toBeGreaterThan(0);
  });

  it("clamps targetCalories not below BMR*1.1 even for aggressive targets", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const out = await caller.goals.preview({
      gender: "female",
      age: 25,
      heightCm: 160,
      currentWeightKg: 70,
      targetWeightKg: 50,
      targetWeeks: 4,
      activityLevel: "sedentary",
    });
    expect(out.targetCalories).toBeGreaterThanOrEqual(Math.round(out.bmr * 1.1));
  });
});
