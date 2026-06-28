import { TRAINERS, type TrainerId } from "@/lib/trainers";

// トレーナーの親しみやすいイラストアバター（フラットなSVG・外部画像なし）。
// image2.0などの本格イラストが用意できたら client/src/assets/trainers/<id>.png に置いて差し替え可能。

type Face = {
  skin: string;
  hair: string;
  long?: boolean; // 長め（女性）
  bun?: boolean; // お団子
  beard?: boolean; // ひげ
  band?: boolean; // ヘッドバンド（コンテスト系）
};

const FACES: Record<TrainerId, Face> = {
  jeff: { skin: "#f1c9a0", hair: "#2b2b2b", band: true },
  gina: { skin: "#f4cea8", hair: "#37261a", long: true, band: true },
  michael: { skin: "#f1c9a0", hair: "#6b4a2b" },
  mia: { skin: "#f4cea8", hair: "#4a3422", long: true },
  jerry: { skin: "#e7b88a", hair: "#1f1f1f", beard: true },
  gemma: { skin: "#e9bb8f", hair: "#2c1c12", bun: true },
};

function accentOf(id: TrainerId): string {
  return TRAINERS.find((t) => t.id === id)?.accent ?? "oklch(0.6 0.05 250)";
}
function tint(accent: string, a: number): string {
  return accent.replace(/\)\s*$/, ` / ${a})`);
}

export function TrainerAvatar({ id, size = 56 }: { id: TrainerId; size?: number }) {
  const f = FACES[id];
  const accent = accentOf(id);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ flexShrink: 0, borderRadius: "9999px", background: tint(accent, 0.16) }}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={`clip-${id}`}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
      </defs>
      <g clipPath={`url(#clip-${id})`}>
        {/* 長め髪（後ろ） */}
        {f.long && <rect x="25" y="34" width="50" height="50" rx="22" fill={f.hair} />}
        {/* 肩・服 */}
        <path d="M18 96 Q18 70 50 70 Q82 70 82 96 Z" fill={accent} />
        {/* 顔 */}
        <circle cx="50" cy="47" r="21" fill={f.skin} />
        {/* 耳 */}
        <circle cx="29" cy="48" r="4" fill={f.skin} />
        <circle cx="71" cy="48" r="4" fill={f.skin} />
        {/* ひげ */}
        {f.beard && (
          <path d="M31 50 Q33 67 50 67 Q67 67 69 50 Q60 59 50 59 Q40 59 31 50 Z" fill={f.hair} />
        )}
        {/* 前髪 */}
        <path d="M29 47 Q29 23 50 23 Q71 23 71 47 Q65 35 50 35 Q35 35 29 47 Z" fill={f.hair} />
        {/* お団子 */}
        {f.bun && <circle cx="50" cy="21" r="7.5" fill={f.hair} />}
        {/* ヘッドバンド */}
        {f.band && <rect x="29" y="33" width="42" height="5.5" rx="2.75" fill={accent} />}
        {/* 目 */}
        <circle cx="42" cy="47" r="2.6" fill="#3a2e22" />
        <circle cx="58" cy="47" r="2.6" fill="#3a2e22" />
        {/* ほっぺ */}
        <circle cx="38" cy="53" r="3" fill="#f7a98c" opacity="0.55" />
        <circle cx="62" cy="53" r="3" fill="#f7a98c" opacity="0.55" />
        {/* 笑顔 */}
        <path d="M43 55 Q50 61 57 55" stroke="#9c5b34" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}
