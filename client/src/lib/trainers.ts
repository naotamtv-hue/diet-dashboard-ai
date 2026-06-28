// MYPERSOL のトレーナー6名（表示用）。idはサーバー(server/mypersol.ts)と共通。
// アバター画像は client/src/assets/trainers/<id>.png を後で差し込む（未配置の間は頭文字＋カラーの仮表示）。

export type TrainerId = "jeff" | "gina" | "michael" | "mia" | "jerry" | "gemma";

export type TrainerInfo = {
  id: TrainerId;
  name: string;
  gender: "male" | "female";
  group: string; // 目的グループ
  tagline: string; // 一言
  accent: string; // テーマ色(oklch)
};

export const TRAINERS: TrainerInfo[] = [
  { id: "jeff", name: "ジェフ", gender: "male", group: "大会・コンテスト仕上げ", tagline: "最大限の引き締め。精密で妥協なし", accent: "oklch(0.55 0.16 255)" },
  { id: "gina", name: "ジーナ", gender: "female", group: "大会・コンテスト仕上げ", tagline: "凛と精密に。停滞も打開する", accent: "oklch(0.6 0.17 12)" },
  { id: "michael", name: "マイケル", gender: "male", group: "引き締まった健康体", tagline: "無理なく継続。習慣で変える", accent: "oklch(0.7 0.15 160)" },
  { id: "mia", name: "ミア", gender: "female", group: "引き締まった健康体", tagline: "リバウンドさせない緩やか減量", accent: "oklch(0.72 0.13 190)" },
  { id: "jerry", name: "ジェリー", gender: "male", group: "増量・筋肥大", tagline: "脂肪を増やさずリーンに増やす", accent: "oklch(0.7 0.16 60)" },
  { id: "gemma", name: "ジェマ", gender: "female", group: "増量・筋肥大", tagline: "栄養の質で締まった体を作る", accent: "oklch(0.62 0.18 30)" },
];

export const TRAINER_GROUPS: { group: string; desc: string }[] = [
  { group: "大会・コンテスト仕上げ", desc: "上級・精密・厳しめ。最大限の引き締め" },
  { group: "引き締まった健康体", desc: "バランス・継続重視。健康的に絞る" },
  { group: "増量・筋肥大", desc: "脂肪を増やしすぎないリーンバルク" },
];

export function getTrainerInfo(id: string | null | undefined): TrainerInfo | null {
  return TRAINERS.find((t) => t.id === id) ?? null;
}
