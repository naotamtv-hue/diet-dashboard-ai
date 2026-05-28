/**
 * 栄養と減量計画の計算ユーティリティ
 */

export type Gender = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "veryActive";

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "ほぼ運動しない（デスクワーク中心）",
  light: "週1〜3回の軽い運動",
  moderate: "週3〜5回の中強度の運動",
  active: "週6〜7回の激しい運動",
  veryActive: "毎日激しい運動／肉体労働",
};

/**
 * Mifflin–St Jeor 式で基礎代謝量(BMR, kcal/日)を計算
 */
export function calcBmr(params: {
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
}): number {
  const { gender, age, heightCm, weightKg } = params;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const bmr = gender === "male" ? base + 5 : base - 161;
  return Math.round(bmr);
}

/** 1日の消費カロリー(TDEE) */
export function calcTdee(bmr: number, activity: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_FACTORS[activity]);
}

/**
 * 減量計画を算出する
 * 体脂肪1kg ≈ 7200kcal とし、目標期間で割って1日の不足カロリーを算出する。
 * 安全のため、摂取カロリーはBMR×1.1以上、TDEE-1000以上にクランプ。
 */
export function buildPlan(params: {
  gender: Gender;
  age: number;
  heightCm: number;
  currentWeightKg: number;
  targetWeightKg: number;
  targetWeeks: number;
  activityLevel: ActivityLevel;
}) {
  const bmr = calcBmr({
    gender: params.gender,
    age: params.age,
    heightCm: params.heightCm,
    weightKg: params.currentWeightKg,
  });
  const tdee = calcTdee(bmr, params.activityLevel);

  const lossKg = Math.max(0, params.currentWeightKg - params.targetWeightKg);
  const totalDeficit = lossKg * 7200;
  const days = Math.max(7, params.targetWeeks * 7);
  const dailyDeficit = totalDeficit / days;

  const floorByBmr = Math.round(bmr * 1.1);
  const floorByTdee = tdee - 1000;
  const rawTarget = tdee - dailyDeficit;
  const targetCalories = Math.round(Math.max(rawTarget, floorByBmr, floorByTdee));

  const weeklyLossKg = ((tdee - targetCalories) * 7) / 7200;

  return {
    bmr,
    tdee,
    targetCalories,
    weeklyLossKg: Math.max(0, Number(weeklyLossKg.toFixed(2))),
    dailyDeficit: Math.round(tdee - targetCalories),
  };
}

/**
 * 目標摂取カロリーから PFC バランス目安を計算
 * - タンパク質: 体重×2.0 g（最低）
 * - 脂質: 総カロリーの25%
 * - 炭水化物: 残り
 */
export function suggestPfcTargets(targetCalories: number, currentWeightKg: number) {
  const proteinG = Math.round(currentWeightKg * 2);
  const fatG = Math.round((targetCalories * 0.25) / 9);
  const carbsKcal = Math.max(0, targetCalories - proteinG * 4 - fatG * 9);
  const carbsG = Math.round(carbsKcal / 4);
  return { proteinG, fatG, carbsG };
}
