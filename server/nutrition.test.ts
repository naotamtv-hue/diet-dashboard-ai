import { describe, expect, it } from "vitest";
import { buildPlan, calcBmr, calcTdee, suggestPfcTargets } from "./nutrition";

describe("nutrition", () => {
  it("calcBmr Mifflin-St Jeor for male", () => {
    // 男性 30歳 175cm 70kg → 10*70 + 6.25*175 - 5*30 + 5 = 1648.75 → 1649
    const bmr = calcBmr({ gender: "male", age: 30, heightCm: 175, weightKg: 70 });
    expect(bmr).toBe(1649);
  });

  it("calcBmr Mifflin-St Jeor for female", () => {
    // 女性 30歳 160cm 55kg → 10*55 + 6.25*160 - 5*30 - 161 = 1239
    const bmr = calcBmr({ gender: "female", age: 30, heightCm: 160, weightKg: 55 });
    expect(bmr).toBe(1239);
  });

  it("calcTdee applies activity factor", () => {
    expect(calcTdee(1600, "sedentary")).toBe(Math.round(1600 * 1.2));
    expect(calcTdee(1600, "moderate")).toBe(Math.round(1600 * 1.55));
  });

  it("buildPlan returns positive plan and clamps not below BMR*1.1", () => {
    const plan = buildPlan({
      gender: "male",
      age: 30,
      heightCm: 175,
      currentWeightKg: 80,
      targetWeightKg: 70,
      targetWeeks: 12,
      activityLevel: "moderate",
    });
    expect(plan.bmr).toBeGreaterThan(0);
    expect(plan.tdee).toBeGreaterThan(plan.bmr);
    expect(plan.targetCalories).toBeGreaterThanOrEqual(Math.round(plan.bmr * 1.1));
    expect(plan.targetCalories).toBeLessThan(plan.tdee);
    expect(plan.weeklyLossKg).toBeGreaterThan(0);
  });

  it("buildPlan with same target/current produces no deficit", () => {
    const plan = buildPlan({
      gender: "female",
      age: 28,
      heightCm: 160,
      currentWeightKg: 55,
      targetWeightKg: 55,
      targetWeeks: 8,
      activityLevel: "light",
    });
    expect(plan.dailyDeficit).toBeLessThanOrEqual(1);
    expect(plan.weeklyLossKg).toBe(0);
  });

  it("suggestPfcTargets returns macros that sum near target calories", () => {
    const target = 1800;
    const { proteinG, fatG, carbsG } = suggestPfcTargets(target, 70);
    const sum = proteinG * 4 + fatG * 9 + carbsG * 4;
    expect(Math.abs(sum - target)).toBeLessThanOrEqual(5);
    expect(proteinG).toBe(140);
  });
});
