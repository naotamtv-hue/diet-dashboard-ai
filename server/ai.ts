/**
 * AI（Google Gemini / OpenAI互換エンドポイント）による食事写真解析・
 * 食べ物/商品名からの栄養推定・コンビニ商品の組み合わせ提案。
 */
import { ENV } from "./_core/env";
import { TRAINER_NUTRITION_KNOWLEDGE, TRAINER_KNOWLEDGE_BRIEF } from "./trainer-knowledge";

// OpenAI互換のベースURL。Geminiの場合は .../v1beta/openai を指す。
const FORGE_URL = (ENV.forgeApiUrl || "https://generativelanguage.googleapis.com/v1beta/openai").replace(
  /\/+$/,
  ""
);
const FORGE_KEY = ENV.forgeApiKey;
// 使用モデル（環境変数で差し替え可能）。
export const AI_MODEL = process.env.AI_MODEL || "gemini-2.5-flash";

// MYPERSOL（メインのAI食事コーチ）専用のプロバイダ。
// COACH_API_KEY を設定すると MYPERSOL だけ Claude(Anthropic OpenAI互換) を使う。
// 未設定なら従来どおり Gemini を使う（無料運用）。他のAI機能は常に Gemini。
const COACH_URL = (process.env.COACH_API_URL || "https://api.anthropic.com/v1").replace(/\/+$/, "");
const COACH_KEY = process.env.COACH_API_KEY || "";
const COACH_MODEL = process.env.COACH_MODEL || "claude-sonnet-4-6";
export const MYPERSOL_USES_CLAUDE = Boolean(COACH_KEY);

type ChatOpts = { baseUrl?: string; apiKey?: string; provider?: "gemini" | "anthropic" };

async function chat(payload: Record<string, unknown>, opts?: ChatOpts) {
  const baseUrl = opts?.baseUrl || FORGE_URL;
  const apiKey = opts?.apiKey || FORGE_KEY;
  if (!apiKey) throw new Error("AI APIキーが未設定です（.env の BUILT_IN_FORGE_API_KEY）");
  const isClaude = opts?.provider === "anthropic" || String(payload.model || "").startsWith("claude");
  let body: Record<string, unknown>;
  if (isClaude) {
    // Anthropic の OpenAI互換は Gemini 固有の reasoning_effort や json_schema を解さないため外す。
    // 構造化はプロンプトの「JSONのみ」指示＋ extractJson で担保する。
    body = { ...payload };
    delete (body as any).reasoning_effort;
    delete (body as any).response_format;
  } else {
    // Gemini 2.5系は「思考」トークンを消費し、max_tokens内で答えが途中で切れることがある。
    // 構造化された短い回答なので思考はオフにし、応答を確実に完結させる。
    body = { reasoning_effort: "none", ...payload };
  }
  let lastErr: Error | null = null;
  // 一時的な混雑(429/500/503)は短い待機をはさんで再試行する。
  for (let attempt = 0; attempt < 3; attempt++) {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
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

/** モデル出力からJSONを安全に取り出す（```json フェンスや前後テキストを除去）。Claude/Gemini両対応。 */
function extractJson(content: unknown): any {
  if (typeof content !== "string") return content;
  let s = content.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  if (!s.startsWith("{") && !s.startsWith("[")) {
    const i = s.indexOf("{");
    const j = s.lastIndexOf("}");
    if (i >= 0 && j > i) s = s.slice(i, j + 1);
  }
  return JSON.parse(s);
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
  const system = `あなたは日本の食事解析の専門家です。送られた食事写真を見て、写っている料理を判定し、1食分の総量を推定して以下を返してください。
- description: 写っている料理名・食材名だけを簡潔に（例：「鶏むね肉のサラダと白米、味噌汁」「サーモン丼と生卵」）。コンビニ等の正式名称はそのまま。「です」「〜と思われます」「推定しました」などの語尾・説明・補足は付けない。20文字程度まで。
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

/**
 * 食品パッケージ／栄養成分表示の写真から、商品名と栄養価を読み取る。
 * MyFitnessPalのバーコード読取に相当（OCR的にラベルを読む）。
 */
export async function analyzePackageImage(imageUrlOrDataUrl: string): Promise<MealAnalysisResult> {
  const system = `あなたは日本の食品パッケージの「栄養成分表示」を正確に読み取る専門家です。送られた写真（商品パッケージや栄養成分表示のラベル）から、以下を読み取って返してください。
- description: 商品名を簡潔に（パッケージに書かれた正式名称。例:「ザバス ミルクプロテイン ココア」「サラダチキン プレーン」）。語尾・説明・補足は付けない。20〜30文字程度まで。
- calories: エネルギー (kcal, 整数)。栄養成分表示の値を読む。
- proteinG: たんぱく質 (g, 小数1桁まで)
- fatG: 脂質 (g, 小数1桁まで)
- carbsG: 炭水化物（または糖質＋食物繊維）(g, 小数1桁まで)
- confidence: 読み取りの確からしさ ("low" | "medium" | "high")
重要: 表示が「100gあたり」ではなく「1袋あたり」「1食(◯g)あたり」「1本あたり」など1包装/1食分の値が書かれていればそれを優先する。"当たり"の単位が複数ある場合は1食/1包装分を選ぶ。ラベルが読み取れない・成分表示が無い場合は calories 等を 0 にして description に理由を書く。`;

  const payload = {
    model: AI_MODEL,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          { type: "text", text: "このパッケージ/栄養成分表示から商品名と栄養価を読み取ってください。" },
          { type: "image_url", image_url: { url: imageUrlOrDataUrl, detail: "high" } },
        ],
      },
    ],
    max_tokens: 1024,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "package_analysis",
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
- description: 料理名・商品名だけを簡潔に書く（例:「親子丼」「サーモン丼と生卵」「ザバスミルクプロテイン ミルク風味」）。コンビニ等の正式名称はそのまま使う。「です」「〜と思われます」「推定しました」「不明です」などの語尾・説明・補足・前置きは一切付けない。15〜20文字程度まで。
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
  incline?: boolean | null;
}): Promise<WorkoutCaloriesEstimate> {
  const system = `あなたはスポーツ栄養と運動生理学の専門家です。
種目・重量(kg)・回数・セット数・時間・強度・体重から、その運動のおおよその消費カロリー(kcal)を整数で概算してください。
無酸素運動の場合はセット間の休憩を含め、運動時間からMET法を組み合わせて推定してください。
有酸素運動で incline=true（傾斜あり：トレッドミルの坂・上り坂・階段など）の場合は、平地より15〜40%多く消費する前提で見積もり、reasoningにも傾斜を考慮した旨を入れてください。
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

export type MealPlanResult = {
  goalAssessment: string;
  isAggressive: boolean;
  dailyTarget: { calories: number; proteinG: number; fatG: number; carbsG: number };
  homeCookingPlan: { mealType: string; items: { name: string; grams: number; kcal: number }[]; totalKcal: number }[];
  conveniencePlan: { mealType: string; items: { name: string; kcal: number }[]; totalKcal: number }[];
  tips: string[];
};

/**
 * 目標(体重/期間/TDEE/目標kcal)から、1日の食事量・献立・グラム数をAIが提案する。
 * 自炊メニュー(レシピ・グラム)とコンビニメニューの両方を返し、無理な目標には警告する。
 */
export async function buildMealPlan(context: {
  gender: "male" | "female";
  age: number;
  heightCm: number;
  currentWeightKg: number;
  targetWeightKg: number;
  targetWeeks: number;
  weeklyLossKg: number;
  tdee: number;
  targetCalories: number;
  activityLevel: string;
  preference?: string;
  /** 実在のコンビニ商品候補（ハルシネーション防止のためconveniencePlanはこの中から選ばせる）。 */
  convenienceCandidates?: { name: string; kcal: number; proteinG: number; fatG: number }[];
}): Promise<MealPlanResult> {
  const system = `あなたは日本人向けのプロのAI食事管理トレーナーです。下記のナレッジに厳密に従い、ユーザーの目標と体組成に合わせて1日の食事プランを提案してください。

${TRAINER_NUTRITION_KNOWLEDGE}

# 出力する各フィールドの作り方
- goalAssessment: 上記「1.減量ペース」に照らして目標の現実性を評価。健康的範囲(体重の0.5〜1%/週)を大きく超える無理な目標は、筋肉減少・代謝低下・リバウンドのリスクを具体的に挙げて警告し、現実的な期間/ペースを提案する。問題なければ前向きに励ます。日本語2〜3文。
- isAggressive: 週減量ペースが健康的範囲(体重の1%/週)を超えるなら true。
- dailyTarget: 1日の目標 calories(kcal,整数)/proteinG/fatG/carbsG(g,整数)。「2.タンパク質(体重×1.6〜2.2g)」「3.脂質(総kcalの20〜25%かつ体重×0.5〜0.8g下限)」「5.PFC比率」を満たすよう設計し、合計がcaloriesと整合させる。
- homeCookingPlan: 自炊中心の献立。朝食/昼食/夕食(必要なら間食)。各mealに items[{name(料理・食材名), grams(g,整数), kcal(整数)}] と totalKcal。一般的で作りやすい和洋メニュー、グラム数を必ず明記。毎食タンパク質源を入れ、野菜・未精製の主食を活用する。
- conveniencePlan: コンビニで同じ目標kcalを満たす献立。提供される【コンビニ商品候補】の中から実在する商品のみを選び、各mealに items[{name(候補の正式名), kcal(候補の値)}] と totalKcal。低脂質・高タンパクを優先。候補に良いものが無いカテゴリは無理に埋めない。
- tips: 上記ナレッジ(満腹感・継続・停滞期など)に基づく続けるコツを2〜3個(短文)。
出力はJSONのみ。`;

  const { convenienceCandidates, ...profile } = context;
  const candidateText =
    convenienceCandidates && convenienceCandidates.length
      ? `\n\n【コンビニ商品候補】(conveniencePlanはこの中の実在商品のみから選ぶ。各値は1商品あたり)\n` +
        convenienceCandidates
          .map((c) => `- ${c.name} / ${Math.round(c.kcal)}kcal P${Math.round(c.proteinG)} F${Math.round(c.fatG)}`)
          .join("\n")
      : "";
  const userContent = JSON.stringify(profile) + candidateText;

  const payload = {
    model: AI_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
    max_tokens: 4000,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "meal_plan",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            goalAssessment: { type: "string" },
            isAggressive: { type: "boolean" },
            dailyTarget: {
              type: "object",
              additionalProperties: false,
              properties: {
                calories: { type: "number" },
                proteinG: { type: "number" },
                fatG: { type: "number" },
                carbsG: { type: "number" },
              },
              required: ["calories", "proteinG", "fatG", "carbsG"],
            },
            homeCookingPlan: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  mealType: { type: "string" },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: { name: { type: "string" }, grams: { type: "number" }, kcal: { type: "number" } },
                      required: ["name", "grams", "kcal"],
                    },
                  },
                  totalKcal: { type: "number" },
                },
                required: ["mealType", "items", "totalKcal"],
              },
            },
            conveniencePlan: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  mealType: { type: "string" },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: { name: { type: "string" }, kcal: { type: "number" } },
                      required: ["name", "kcal"],
                    },
                  },
                  totalKcal: { type: "number" },
                },
                required: ["mealType", "items", "totalKcal"],
              },
            },
            tips: { type: "array", items: { type: "string" } },
          },
          required: ["goalAssessment", "isAggressive", "dailyTarget", "homeCookingPlan", "conveniencePlan", "tips"],
        },
      },
    },
  };

  const data = await chat(payload);
  const content = data?.choices?.[0]?.message?.content ?? "";
  return parseJsonLoose<MealPlanResult>(content);
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
  const system = `あなたは日本人向けの優しく前向きな減量コーチです。次の食事管理ナレッジを踏まえてください。
${TRAINER_KNOWLEDGE_BRIEF}
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

export type MypersolAdvice = {
  summary: string;
  todayAdvice: string;
  foodImprovements: { title: string; detail: string }[];
  paceVerdict: string;
  warning: string;
};

/**
 * MYPERSOL のメインAI食事コーチ。
 * 実データ（摂取・消費・PFC・体重トレンド・カロリー収支）と栄養学の法則、
 * 選択トレーナーの人格に基づいて、根拠あるアドバイスと安全な巻き上げ策を返す。
 * 数値の予測自体はクライアントの決定論計算で出すので、ここは「解釈と具体策」に集中する。
 */
export async function buildMypersolAdvice(context: {
  trainerName: string;
  trainerStyle: string; // 人格・口調・専門性の説明
  goalPurpose: string; // 減量/健康的に絞る/増量 など
  numbers: Record<string, number | string | null>;
  safety: { maxWeeklyLossKg: number; calorieFloor: number };
}): Promise<MypersolAdvice> {
  const system = `あなたは「${context.trainerName}」という名前の一流パーソナルトレーナー兼スポーツ栄養コーチです。
人格と方針: ${context.trainerStyle}
担当の目的: ${context.goalPurpose}

次の食事管理ナレッジに厳密に従ってください。
${TRAINER_NUTRITION_KNOWLEDGE}

【安全の絶対ルール】
- 減量ペースは週 ${context.safety.maxWeeklyLossKg}kg を超える提案を絶対にしない（1ヶ月-10kgのような無理は厳禁。リバウンドと筋肉減・代謝低下の元）。
- 摂取カロリーは1日 ${context.safety.calorieFloor}kcal を下回る提案をしない。
- 「もっと速く」を求められても、安全枠を超える分は出さず「ここまでが健康的な上限」と明示する。
- 提案は実在する一般的な食材・市販/コンビニ商品で具体的に（架空の商品名は使わない）。

渡されたユーザーの実数値（直近の平均摂取・消費(TDEE+運動)・カロリー収支・PFCの過不足・体重トレンド・目標と目標日・予測体重）を読み、
あなたの人格と口調で、根拠（数字）に触れながら具体的に指導してください。テキトーな精神論は禁止、必ず数字と栄養法則に紐づけること。

出力はJSONのみ:
{
 "summary": "現状を数字根拠つきで1〜2文（例: 1日約1180kcalの赤字で週1.0kg減ペース。Pが不足気味）",
 "todayAdvice": "今日の具体行動を人格の口調で1〜2文（何をどう食べる/替えるか）",
 "foodImprovements": [{"title":"短い見出し","detail":"具体策。食材/量/PFCへの効果を数字で"}],
 "paceVerdict": "目標日に間に合うかの判定＋安全範囲での巻き上げ一手（例: 今のペースでOK。あと-150kcal/日で◯日前倒し可。安全枠内）",
 "warning": "無理なペースや栄養の偏りがある時だけ注意を書く。問題なければ空文字"
}
foodImprovements は2〜4個。日本語。`;

  // COACH_API_KEY があれば MYPERSOL だけ Claude(Sonnet) を使う。無ければ Gemini。
  const useClaude = MYPERSOL_USES_CLAUDE;
  const payload: Record<string, unknown> = {
    model: useClaude ? COACH_MODEL : AI_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(context.numbers) },
    ],
    max_tokens: 1100,
  };
  if (!useClaude) {
    // Gemini は json_schema strict が使えるので利用（確実な構造化）。
    payload.response_format = {
      type: "json_schema",
      json_schema: {
        name: "mypersol_advice",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            summary: { type: "string" },
            todayAdvice: { type: "string" },
            foodImprovements: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: { title: { type: "string" }, detail: { type: "string" } },
                required: ["title", "detail"],
              },
            },
            paceVerdict: { type: "string" },
            warning: { type: "string" },
          },
          required: ["summary", "todayAdvice", "foodImprovements", "paceVerdict", "warning"],
        },
      },
    };
  }
  const data = await chat(payload, useClaude ? { baseUrl: COACH_URL, apiKey: COACH_KEY, provider: "anthropic" } : undefined);
  const content = data?.choices?.[0]?.message?.content ?? "";
  try {
    const parsed = extractJson(content);
    return {
      summary: String(parsed.summary ?? ""),
      todayAdvice: String(parsed.todayAdvice ?? ""),
      foodImprovements: Array.isArray(parsed.foodImprovements)
        ? parsed.foodImprovements.slice(0, 4).map((f: any) => ({ title: String(f.title ?? ""), detail: String(f.detail ?? "") }))
        : [],
      paceVerdict: String(parsed.paceVerdict ?? ""),
      warning: String(parsed.warning ?? ""),
    };
  } catch {
    throw new Error("MYPERSOLアドバイスの生成に失敗しました");
  }
}
