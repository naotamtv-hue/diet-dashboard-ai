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

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
