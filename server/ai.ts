/**
 * gpt-4.1-mini Vision を用いた食事写真解析と、コンビニ商品の組み合わせ提案
 */
import { ENV } from "./_core/env";

const FORGE_URL = (ENV.forgeApiUrl || "https://forge.manus.im").replace(/\/+$/, "");
const FORGE_KEY = ENV.forgeApiKey;

async function chat(payload: Record<string, unknown>) {
  if (!FORGE_KEY) throw new Error("OPENAI_API_KEY (forge) is not configured");
  const resp = await fetch(`${FORGE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${FORGE_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`LLM error ${resp.status}: ${text}`);
  }
  return (await resp.json()) as any;
}

export type MealAnalysisResult = {
  description: string;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  confidence: "low" | "medium" | "high";
};

/**
 * 食事画像を gpt-4.1-mini ビジョンで解析し、料理内容と PFC・カロリーを推定する。
 * @param imageUrlOrDataUrl 公開URL もしくは data:image/...;base64,... 形式
 */
export async function analyzeMealImage(imageUrlOrDataUrl: string): Promise<MealAnalysisResult> {
  const system = `あなたは日本の食事解析の専門家です。送られた食事写真を見て、写っている料理を日本語で簡潔に説明し、1食分の総量を推定して以下を返してください。
- description: 写っている料理を日本語で1〜2文（例：「鶏むね肉のサラダと白米、味噌汁」）
- calories: 総摂取カロリー (kcal, 整数)
- proteinG: タンパク質 (g, 小数1桁まで)
- fatG: 脂質 (g, 小数1桁まで)
- carbsG: 炭水化物 (g, 小数1桁まで)
- confidence: 推定の確からしさ ("low" | "medium" | "high")
画像が食事でない、または推定不能な場合は calories などを 0 にして description に理由を書いてください。`;

  const payload = {
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          { type: "text", text: "この食事写真の内容と栄養素を推定してください。" },
          { type: "image_url", image_url: { url: imageUrlOrDataUrl, detail: "low" } },
        ],
      },
    ],
    max_tokens: 600,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "meal_analysis",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            description: { type: "string" },
            calories: { type: "number" },
            proteinG: { type: "number" },
            fatG: { type: "number" },
            carbsG: { type: "number" },
            confidence: { type: "string", enum: ["low", "medium", "high"] },
          },
          required: ["description", "calories", "proteinG", "fatG", "carbsG", "confidence"],
        },
      },
    },
  };

  const data = await chat(payload);
  const content = data?.choices?.[0]?.message?.content ?? "";
  let parsed: MealAnalysisResult;
  try {
    parsed = typeof content === "string" ? JSON.parse(content) : content;
  } catch {
    throw new Error("AI応答の解析に失敗しました");
  }
  return {
    description: String(parsed.description ?? ""),
    calories: Math.max(0, Math.round(Number(parsed.calories) || 0)),
    proteinG: Math.max(0, Number(Number(parsed.proteinG || 0).toFixed(1))),
    fatG: Math.max(0, Number(Number(parsed.fatG || 0).toFixed(1))),
    carbsG: Math.max(0, Number(Number(parsed.carbsG || 0).toFixed(1))),
    confidence: (parsed.confidence as any) || "medium",
  };
}

export type ConvenienceCandidate = {
  id: number;
  chain: string;
  name: string;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  priceYen: number | null;
  category: string;
};

export type ConvenienceSuggestion = {
  items: { id: number; name: string; chain: string }[];
  totals: { calories: number; proteinG: number; fatG: number; carbsG: number };
  comment: string;
};

/**
 * 残カロリーとユーザーの好みから、コンビニ商品の組み合わせを AI が提案する。
 */
export async function suggestConvenienceCombo(params: {
  remainingCalories: number;
  proteinFocus: boolean;
  preferredChain?: "seven" | "familymart" | "lawson" | "any";
  note?: string;
  candidates: ConvenienceCandidate[];
}): Promise<ConvenienceSuggestion> {
  const { remainingCalories, proteinFocus, preferredChain, note, candidates } = params;

  const trimmed = candidates.slice(0, 80).map((c) => ({
    id: c.id,
    chain: c.chain,
    category: c.category,
    name: c.name,
    kcal: c.calories,
    p: c.proteinG,
    f: c.fatG,
    c: c.carbsG,
  }));

  const system = `あなたは日本の管理栄養士で、コンビニ商品から1食分の組み合わせを提案します。
ユーザーの「残り摂取カロリー」を超えないように、合計カロリーが目標カロリーの80〜100%に収まる組み合わせを2〜4品で提案してください。
タンパク質重視が指定されている場合は合計タンパク質が25g以上になるようにしてください。
必ず提供された候補リストの id のみを使ってください。`;

  const user = {
    remainingCalories,
    proteinFocus,
    preferredChain: preferredChain ?? "any",
    note: note ?? "",
    candidates: trimmed,
  };

  const payload = {
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(user) },
    ],
    max_tokens: 800,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "combo_suggestion",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            itemIds: { type: "array", items: { type: "integer" } },
            comment: { type: "string" },
          },
          required: ["itemIds", "comment"],
        },
      },
    },
  };

  const data = await chat(payload);
  const content = data?.choices?.[0]?.message?.content ?? "";
  let parsed: { itemIds: number[]; comment: string };
  try {
    parsed = typeof content === "string" ? JSON.parse(content) : content;
  } catch {
    throw new Error("AI応答の解析に失敗しました");
  }

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const picked = parsed.itemIds.map((id) => byId.get(id)).filter(Boolean) as ConvenienceCandidate[];

  const totals = picked.reduce(
    (acc, c) => ({
      calories: acc.calories + Number(c.calories),
      proteinG: acc.proteinG + Number(c.proteinG),
      fatG: acc.fatG + Number(c.fatG),
      carbsG: acc.carbsG + Number(c.carbsG),
    }),
    { calories: 0, proteinG: 0, fatG: 0, carbsG: 0 }
  );

  return {
    items: picked.map((c) => ({ id: c.id, name: c.name, chain: c.chain })),
    totals: {
      calories: Math.round(totals.calories),
      proteinG: Number(totals.proteinG.toFixed(1)),
      fatG: Number(totals.fatG.toFixed(1)),
      carbsG: Number(totals.carbsG.toFixed(1)),
    },
    comment: parsed.comment ?? "",
  };
}


export type WorkoutCaloriesEstimate = {
  caloriesBurned: number;
  reasoning: string;
};

/**
 * 種目・重量・回数・セット数・時間と体重から、消費カロリーをAIで概算する。
 */
export async function estimateWorkoutCalories(params: {
  activity: string;
  durationMin: number;
  intensity: "low" | "medium" | "high";
  weightKg?: number | null;
  reps?: number | null;
  sets?: number | null;
  bodyWeightKg?: number | null;
}): Promise<WorkoutCaloriesEstimate> {
  const system = `あなたはスポーツ栄養と運動生理学の専門家です。
種目・重量(kg)・回数・セット数・時間・強度・体重から、その運動のおおよその消費カロリー(kcal)を整数で概算してください。
無酸素運動の場合はセット間の休憩を含め、運動時間からMET法を組み合わせて推定してください。
出力は JSON のみで {"caloriesBurned": number, "reasoning": "日本語の根拠1文"} を返してください。`;

  const payload = {
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(params) },
    ],
    max_tokens: 300,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "calories_estimate",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            caloriesBurned: { type: "number" },
            reasoning: { type: "string" },
          },
          required: ["caloriesBurned", "reasoning"],
        },
      },
    },
  };

  const data = await chat(payload);
  const content = data?.choices?.[0]?.message?.content ?? "";
  try {
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    return {
      caloriesBurned: Math.max(0, Math.round(Number(parsed.caloriesBurned) || 0)),
      reasoning: String(parsed.reasoning ?? ""),
    };
  } catch {
    return { caloriesBurned: 0, reasoning: "推定に失敗しました" };
  }
}

export type TrainerExerciseSuggestion = {
  name: string;
  targetMuscle: string;
  sets: number;
  reps: string;
  weightGuide: string;
  note: string;
};

export type TrainerDaySuggestion = {
  day: string;
  focus: string;
  exercises: TrainerExerciseSuggestion[];
};

export type TrainerPlan = {
  summary: string;
  cautions: string;
  weeklyPlan: TrainerDaySuggestion[];
};

/**
 * AIパーソナルトレーナー：目標・体組成・経験・利用環境から週次トレーニングメニューを提案する。
 */
export async function buildTrainerPlan(params: {
  gender: "male" | "female";
  age: number;
  heightCm: number;
  currentWeightKg: number;
  targetWeightKg: number;
  experience: "beginner" | "intermediate" | "advanced";
  daysPerWeek: number;
  environment: "gym" | "home" | "both";
  focusArea?: string;
  hasInjury?: string;
}): Promise<TrainerPlan> {
  const system = `あなたは日本人向けのオンラインパーソナルトレーナーです。
ユーザーの目標・体組成・経験・利用環境を踏まえ、週単位のトレーニングメニューを提案してください。
- 1週間分の構成（休養日を含む）
- 各日のフォーカス（例：胸・三頭、脚、有酸素+体幹 など）
- 各日3〜5種目、種目ごとに sets / reps / weightGuide（自重なら「自重」と書く）/ note（フォームや注意点を日本語1文）
- 安全性に配慮し、初心者には可動域や呼吸の注意も含める
- 怪我の申告があれば代替種目を選ぶ
出力は厳密に JSON のみ。`;

  const payload = {
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(params) },
    ],
    max_tokens: 1800,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "trainer_plan",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            summary: { type: "string" },
            cautions: { type: "string" },
            weeklyPlan: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  day: { type: "string" },
                  focus: { type: "string" },
                  exercises: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        name: { type: "string" },
                        targetMuscle: { type: "string" },
                        sets: { type: "integer" },
                        reps: { type: "string" },
                        weightGuide: { type: "string" },
                        note: { type: "string" },
                      },
                      required: ["name", "targetMuscle", "sets", "reps", "weightGuide", "note"],
                    },
                  },
                },
                required: ["day", "focus", "exercises"],
              },
            },
          },
          required: ["summary", "cautions", "weeklyPlan"],
        },
      },
    },
  };

  const data = await chat(payload);
  const content = data?.choices?.[0]?.message?.content ?? "";
  try {
    return typeof content === "string" ? JSON.parse(content) : content;
  } catch {
    throw new Error("AI応答の解析に失敗しました");
  }
}
