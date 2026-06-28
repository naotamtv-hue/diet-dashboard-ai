// MYPERSOL の「根拠ある算出」エンジン。
// 実データ（直近7日の平均摂取・PFC・運動消費・体重トレンド・目標/目標日）と
// エネルギー収支(体脂肪1kg≒7200kcal)・安全ルールから、予測と推奨ペースを決定論的に出す。
// ここはAIを使わない（数字の根拠を常に明確にするため）。AIはこの数字を解釈するだけ。

import * as db from "./db";

const KCAL_PER_KG = 7200; // 体脂肪1kgあたりの概算kcal

export type TrainerPersona = {
  id: string;
  name: string;
  gender: "male" | "female";
  purpose: string; // 目的（表示・AI用）
  style: string; // AIに渡す人格・口調・専門性
};

// 6名（3目的 × 男女）。idはDB/クライアントと共通。
export const TRAINERS: TrainerPersona[] = [
  {
    id: "jeff",
    name: "ジェフ",
    gender: "male",
    purpose: "大会・コンテストレベルの仕上げ（最大限の引き締め）",
    style: "コンテストビルダー出身の上級コーチ。精密で妥協がなく、数字に厳密。厳しくも筋肉を守る減量を徹底する。論理的で簡潔な口調。",
  },
  {
    id: "gina",
    name: "ジーナ",
    gender: "female",
    purpose: "大会・コンテストレベルの仕上げ（最大限の引き締め）",
    style: "女子フィジーク出身の上級コーチ。凛として精密、PFCと停滞対策に強い。妥協しないが前向きに背中を押す口調。",
  },
  {
    id: "michael",
    name: "マイケル",
    gender: "male",
    purpose: "引き締まった健康体（バランス重視・継続できる減量）",
    style: "健康的な体づくりが専門のバランス型コーチ。無理のない継続を最優先し、習慣化と満腹感の作り方を丁寧に教える。爽やかで親しみやすい口調。",
  },
  {
    id: "mia",
    name: "ミア",
    gender: "female",
    purpose: "引き締まった健康体（バランス重視・継続できる減量）",
    style: "女性向けの健康的ダイエットが専門。リバウンドさせない緩やかな減量と心の負担を減らす声かけが得意。明るく寄り添う口調。",
  },
  {
    id: "jerry",
    name: "ジェリー",
    gender: "male",
    purpose: "増量・筋肥大（脂肪を増やしすぎないリーンバルク）",
    style: "増量・筋肥大が専門のコーチ。余分な脂肪を増やさないリーンバルク（小さめの黒字）と高タンパク・トレ前後の炭水化物配分を重視。頼れる力強い口調。",
  },
  {
    id: "gemma",
    name: "ジェマ",
    gender: "female",
    purpose: "増量・筋肥大（脂肪を増やしすぎないリーンバルク）",
    style: "女性の筋肉づくり・健康的な増量が専門。タンパク質と栄養の質で締まった体を作る。元気で頼もしい口調。",
  },
];

export function getTrainer(id: string | null | undefined): TrainerPersona {
  return TRAINERS.find((t) => t.id === id) ?? TRAINERS[2]; // 既定はマイケル
}

function jstDateStr(ms: number): string {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

function round(n: number, d = 1): number {
  const p = Math.pow(10, d);
  return Math.round(n * p) / p;
}

export type MypersolAnalysis = ReturnType<typeof shapeAnalysis>;

function shapeAnalysis(input: {
  dataReady: boolean;
  reason: string;
  windowDays: number;
  daysWithMeals: number;
  avgIntake: number | null;
  avgProteinG: number | null;
  avgFatG: number | null;
  avgCarbsG: number | null;
  tdee: number | null;
  avgBurn: number;
  dailyDeficit: number | null;
  perWeekBalance: number | null;
  perWeekMeasured: number | null;
  perWeekBlended: number | null;
  currentWeight: number | null;
  targetWeight: number | null;
  targetDate: string | null;
  proj30: number | null;
  proj90: number | null;
  projAtTarget: number | null;
  daysToTarget: number | null;
  requiredWeeklyRate: number | null;
  maxWeeklyLossKg: number;
  calorieFloor: number;
  targetProteinG: number | null;
  onTrack: boolean | null;
}) {
  return input;
}

export async function computeMypersolAnalysis(userId: number) {
  const goal = await db.getGoal(userId);
  const weightsAsc = await db.listWeights(userId);

  const todayMs = Date.now();
  const today = jstDateStr(todayMs);
  const start = jstDateStr(todayMs - 6 * 86400000); // 直近7日
  const windowDays = 7;

  const mealsDaily = await db.listMealDailyBetween(userId, start, today);
  const burn = await db.sumWorkoutBurnBetween(userId, start, today);

  const daysWithMeals = mealsDaily.length;
  const sum = mealsDaily.reduce(
    (a, d) => ({ c: a.c + d.calories, p: a.p + d.proteinG, f: a.f + d.fatG, cb: a.cb + d.carbsG }),
    { c: 0, p: 0, f: 0, cb: 0 }
  );
  const avgIntake = daysWithMeals ? sum.c / daysWithMeals : null;
  const avgProteinG = daysWithMeals ? sum.p / daysWithMeals : null;
  const avgFatG = daysWithMeals ? sum.f / daysWithMeals : null;
  const avgCarbsG = daysWithMeals ? sum.cb / daysWithMeals : null;
  const avgBurn = burn.total / windowDays;

  const tdee = goal ? Number(goal.tdee) : null;

  // 体重トレンド（線形回帰, kg/日）
  let perWeekMeasured: number | null = null;
  let lastKg: number | null = null;
  const pts = weightsAsc
    .map((w) => ({ t: Date.parse(w.recordDate), kg: Number(w.weightKg) }))
    .filter((p) => !Number.isNaN(p.t) && !Number.isNaN(p.kg));
  if (pts.length >= 2) {
    const t0 = pts[0].t;
    const xs = pts.map((p) => (p.t - t0) / 86400000);
    const ys = pts.map((p) => p.kg);
    const n = xs.length;
    const sx = xs.reduce((a, b) => a + b, 0);
    const sy = ys.reduce((a, b) => a + b, 0);
    const sxx = xs.reduce((a, b) => a + b * b, 0);
    const sxy = xs.reduce((a, b, i) => a + b * ys[i], 0);
    const denom = n * sxx - sx * sx;
    if (denom !== 0) perWeekMeasured = ((n * sxy - sx * sy) / denom) * 7;
    lastKg = ys[ys.length - 1];
  } else if (pts.length === 1) {
    lastKg = pts[0].kg;
  }

  const currentWeight = lastKg ?? (goal ? Number(goal.currentWeightKg) : null);
  const targetWeight = goal ? Number(goal.targetWeightKg) : null;
  const targetDate = goal?.targetDate ?? null;

  // エネルギー収支モデル（TDEEは活動量込みの維持カロリー。運動の二重計上を避け基準はTDEE）
  let dailyDeficit: number | null = null;
  let perWeekBalance: number | null = null;
  if (avgIntake != null && tdee != null) {
    dailyDeficit = tdee - avgIntake; // 正=減量方向
    perWeekBalance = -(dailyDeficit * 7) / KCAL_PER_KG; // 体重変化(kg/週), 減量はマイナス
  }

  // 実測と収支のブレンド（両方あれば平均、片方のみならそれ）
  let perWeekBlended: number | null = null;
  if (perWeekMeasured != null && perWeekBalance != null) perWeekBlended = (perWeekMeasured + perWeekBalance) / 2;
  else perWeekBlended = perWeekMeasured ?? perWeekBalance;

  const perDay = perWeekBlended != null ? perWeekBlended / 7 : null;
  const proj30 = currentWeight != null && perDay != null ? currentWeight + perDay * 30 : null;
  const proj90 = currentWeight != null && perDay != null ? currentWeight + perDay * 90 : null;

  let projAtTarget: number | null = null;
  let daysToTarget: number | null = null;
  if (targetDate) {
    const tMs = Date.parse(targetDate);
    if (!Number.isNaN(tMs)) {
      daysToTarget = Math.round((tMs - todayMs) / 86400000);
      if (currentWeight != null && perDay != null) projAtTarget = currentWeight + perDay * Math.max(0, daysToTarget);
    }
  }

  // 安全ルール: 週は体重の1% かつ 月4kg(≒週0.93kg) を上限
  const maxWeeklyLossKg = currentWeight != null ? Math.min(currentWeight * 0.01, (4 * 7) / 30) : (4 * 7) / 30;
  const calorieFloor = goal?.gender === "female" ? 1200 : 1500;
  const targetProteinG = currentWeight != null ? Math.round(currentWeight * 1.8) : null;

  // 目標日に必要な週ペースと、安全範囲内かどうか
  let requiredWeeklyRate: number | null = null;
  let onTrack: boolean | null = null;
  if (currentWeight != null && targetWeight != null && daysToTarget != null && daysToTarget > 0) {
    requiredWeeklyRate = (currentWeight - targetWeight) / (daysToTarget / 7); // 正=減量が必要
    if (projAtTarget != null) {
      // 減量目標: 予測が目標以下ならOK / 増量目標: 予測が目標以上ならOK
      onTrack = currentWeight > targetWeight ? projAtTarget <= targetWeight + 0.1 : projAtTarget >= targetWeight - 0.1;
    }
  }

  const dataReady = avgIntake != null && tdee != null;
  const reason = !goal
    ? "目標が未設定です"
    : avgIntake == null
    ? "直近7日の食事記録がありません"
    : "";

  return shapeAnalysis({
    dataReady,
    reason,
    windowDays,
    daysWithMeals,
    avgIntake: avgIntake != null ? Math.round(avgIntake) : null,
    avgProteinG: avgProteinG != null ? Math.round(avgProteinG) : null,
    avgFatG: avgFatG != null ? Math.round(avgFatG) : null,
    avgCarbsG: avgCarbsG != null ? Math.round(avgCarbsG) : null,
    tdee: tdee != null ? Math.round(tdee) : null,
    avgBurn: Math.round(avgBurn),
    dailyDeficit: dailyDeficit != null ? Math.round(dailyDeficit) : null,
    perWeekBalance: perWeekBalance != null ? round(perWeekBalance, 2) : null,
    perWeekMeasured: perWeekMeasured != null ? round(perWeekMeasured, 2) : null,
    perWeekBlended: perWeekBlended != null ? round(perWeekBlended, 2) : null,
    currentWeight: currentWeight != null ? round(currentWeight, 1) : null,
    targetWeight: targetWeight != null ? round(targetWeight, 1) : null,
    targetDate,
    proj30: proj30 != null ? round(proj30, 1) : null,
    proj90: proj90 != null ? round(proj90, 1) : null,
    projAtTarget: projAtTarget != null ? round(projAtTarget, 1) : null,
    daysToTarget,
    requiredWeeklyRate: requiredWeeklyRate != null ? round(requiredWeeklyRate, 2) : null,
    maxWeeklyLossKg: round(maxWeeklyLossKg, 2),
    calorieFloor,
    targetProteinG,
    onTrack,
  });
}
