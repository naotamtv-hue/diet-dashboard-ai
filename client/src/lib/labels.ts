export const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "朝食",
  lunch: "昼食",
  dinner: "夕食",
  snack: "間食",
};

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const CHAIN_LABELS: Record<string, string> = {
  seven: "セブン-イレブン",
  familymart: "ファミリーマート",
  lawson: "ローソン",
};

export const CATEGORY_LABELS: Record<string, string> = {
  bento: "弁当",
  onigiri: "おにぎり",
  bread: "パン",
  salad: "サラダ",
  noodle: "麺類",
  hotsnack: "ホットスナック",
  drink: "ドリンク",
  dessert: "デザート",
  sideDish: "惣菜",
  proteinSnack: "プロテイン系",
};

export const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: "ほぼ運動なし",
  light: "週1〜2回 軽い運動",
  moderate: "週3〜5回 中強度",
  active: "ほぼ毎日 強い運動",
  veryActive: "毎日激しい運動・肉体労働",
};

export const INTENSITY_LABELS: Record<string, string> = {
  low: "低強度",
  medium: "中強度",
  high: "高強度",
};

export function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d + "T00:00:00") : d;
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}/${m}/${day}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * 画像ファイルをデータURLに変換する。スマホの高解像度写真はそのままだと
 * 数MB〜十数MBになりAI解析が遅延・失敗したりDB保存が肥大化するため、
 * 長辺を maxSize まで縮小しJPEG圧縮してから返す（画像以外はそのまま読み込む）。
 */
export async function fileToDataUrl(file: File, maxSize = 1280, quality = 0.82): Promise<string> {
  const raw = await readFileAsDataUrl(file);
  if (!file.type.startsWith("image/")) return raw;

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
      el.src = raw;
    });

    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    // 縮小不要かつ十分小さい場合は再エンコードせずそのまま返す。
    if (scale === 1 && raw.length < 1_500_000) return raw;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return raw;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    // 圧縮に失敗しても元データで続行する。
    return raw;
  }
}
