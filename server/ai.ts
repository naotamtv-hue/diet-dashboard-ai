/**
 * AI（Google Gemini / OpenAI互換エンドポイント）による食事写真解析・
 * 食べ物/商品名からの栄養推定・コンビニ商品の組み合わせ提案。
 */
import { ENV } from "./_core/env";

// OpenAI互換のベースURL。Geminiの場合は .../v1beta/openai を指す。
const FORGE_URL = (ENV.forgeApiUrl || "https://generativelanguage.googleapis.com/v1beta/openai").replace(
  /\/+$/,
  ""
);
const FORGE_KEY = ENV.forgeApiKey;
// 使用モデル（環境変数で差し替え可能）。
export const AI_MODEL = process.env.AI_MODEL || "gemini-2.5-flash";

async function chat(payload: Record<string, unknown>) {
  if (!FORGE_KEY) throw new Error("AI APIキーが未設定です（.env の BUILT_IN_FORGE_API_KEY）");
  // Gemini 2.5系は「思考」トークンを消費し、max_tokens内で答えが途中で切れることがある。
  // 構造化された短い回答なので思考はオフにし、応答を確実に完結させる。
  const body: Record<string, unknown> = { reasoning_effort: "none", ...payload };
  let lastErr: Error | null = null;
  // 一時的な混雑(429/500/503)は短い待機をはさんで再試行する。
  for (let attempt = 0; attempt < 3; attempt++) {
    const resp = await fetch(`${FORGE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${FORGE_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (resp.ok) return (await resp.json()) as any;
    const status = resp.status;
    const text = await resp.text();
    lastErr = new Error(`LLM error ${status}: ${text}`);
    if (status === 429 || status === 500 || status === 503) {
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      continue;
    }
    throw lastErr;
  }
  throw lastErr ?? new Error("LLM request failed");
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
    model: AI_MODEL,
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
    max_tokens: 1024,
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

/** AI応答のJSONを頑丈にパースする（```json フェンスや前後の文字を許容）。 */
function parseJsonLoose<T = any>(content: unknown): T {
  if (content && typeof content === "object") return content as T;
  let text = String(content ?? "").trim();
  // ```json ... ``` フェンスを除去
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  try {
    return JSON.parse(text) as T;
  } catch {
    // 最初の { から最後の } までを抜き出して再試行
    const s = text.indexOf("{");
    const e = text.lastIndexOf("}");
    if (s >= 0 && e > s) {
      return JSON.parse(text.slice(s, e + 1)) as T;
    }
    throw new Error("AI応答の解析に失敗しました");
  }
}

/**
 * 食べ物・商品名（例:「セブンのからあげ棒」「唐揚げ3個」「ラーメン1杯」）から
 * おおよそのカロリー・PFCをAIで推定する。写真がなくても記録できるようにする。
 */
export async function estimateMealByName(query: string): Promise<MealAnalysisResult> {
  const system = `あなたは日本の食品栄養の専門家です。ユーザーが入力した食べ物・商品名（コンビニ商品・外食・自炊メニュー等を含む）について、日本で一般的な1人前/1個あたりのおおよその栄養価を推定してください。
- description: 対象の料理・商品名を日本語で簡潔に（例:「セブンイレブン からあげ棒 1本」）。分量が不明なら一般的な1人前を仮定し、その旨を含める。
- calories: カロリー (kcal, 整数)
- proteinG: タンパク質 (g, 小数1桁)
- fatG: 脂質 (g, 小数1桁)
- carbsG: 炭水化物 (g, 小数1桁)
- confidence: 確からしさ。固有商品名で広く知られているものは "medium"、一般料理名は "medium"〜"high"、曖昧・不明なものは "low"。
値はあくまで概算です。食品として解釈できない入力の場合は calories 等を 0 にし、description に理由を書いてください。`;

  const payload = {
    model: AI_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: `次の食べ物のおおよその栄養価を推定してください: ${query}` },
    ],
    max_tokens: 1024,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "meal_estimate",
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
  const parsed = parseJsonLoose<MealAnalysisResult>(content);
  return {
    description: String(parsed.description ?? query),
    calories: Math.max(0, Math.round(Number(parsed.calories) || 0)),
    proteinG: Math.max(0, Number(Number(parsed.proteinG || 0).toFixed(1))),
    fatG: Math.max(0, Number(Number(parsed.fatG || 0).toFixed(1))),
    carbsG: Math.max(0, Number(Number(parsed.carbsG || 0).toFixed(1))),
    confidence: (parsed.confidence as any) || "low",
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
    model: AI_MODEL,
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
    model: AI_MODEL,
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
    model: AI_MODEL,
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

/**
 * 直近の記録データ（目標・今日の摂取・PFC・体重・連続記録）を踏まえた、
 * 今日の短いコーチングアドバイスを生成する（1〜2文・日本語）。
 */
export async function buildDailyAdvice(context: {
  targetCalories: number | null;
  consumedCalories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  targetProteinG: number | null;
  currentWeightKg: number | null;
  targetWeightKg: number | null;
  recentWeightTrendKgPerWeek: number | null;
  streakDays: number;
}): Promise<string> {
  const system = `あなたは日本人向けの優しく前向きな減量コーチです。
渡されたユーザーの今日の数値を見て、励ましつつ具体的な行動を1つ提案する短いアドバイスを返してください。
- 日本語で1〜2文、80文字以内
- 数字を踏まえて具体的に（例:「タンパク質があと30g。鶏むねやプロテインで補うと◎」）
- 否定や罪悪感を煽らない。続けたくなるトーン。語尾に絵文字を1つ
- 出力はアドバイス本文のみ（前置き・記号・引用符なし）`;

  const payload = {
    model: AI_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(context) },
    ],
    max_tokens: 200,
  };
  const data = await chat(payload);
  const content = data?.choices?.[0]?.message?.content ?? "";
  return String(content).trim().replace(/^["「』]+|["」』]+$/g, "");
}
