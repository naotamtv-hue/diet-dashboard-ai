import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MEAL_TYPE_LABELS, formatDate, todayDateString } from "@/lib/labels";
import { trpc } from "@/lib/trpc";
import {
  Apple,
  ArrowRight,
  CalendarHeart,
  Camera,
  Dumbbell,
  Sparkles,
  Target,
  TrendingDown,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { Link } from "wouter";

function pct(v: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.max(0, Math.round((v / total) * 100)));
}

export default function Dashboard() {
  const [today] = useState(todayDateString);

  const goalQ = trpc.goals.get.useQuery();
  const summaryQ = trpc.meals.summary.useQuery({ date: today });
  const mealsQ = trpc.meals.listByDate.useQuery({ date: today });
  const weightLatestQ = trpc.weights.latest.useQuery();
  const weightFirstQ = trpc.weights.first.useQuery();
  const workoutsQ = trpc.workouts.listByDate.useQuery({ date: today });
  const photosQ = trpc.bodyPhotos.list.useQuery();

  const goal = goalQ.data;
  const summary = summaryQ.data;
  const latestWeight = weightLatestQ.data;
  const firstWeight = weightFirstQ.data;

  const targetCal = Number(goal?.targetCalories ?? 0);
  const pfcTarget = useMemo(() => {
    if (!goal) return { p: 0, f: 0, c: 0 };
    const tc = Number(goal.targetCalories);
    const currentW = Number(goal.currentWeightKg);
    const p = Math.round(currentW * 2);
    const f = Math.round((tc * 0.25) / 9);
    const c = Math.max(0, Math.round((tc - p * 4 - f * 9) / 4));
    return { p, f, c };
  }, [goal]);

  const remainingKcal = Math.max(0, targetCal - (summary?.calories ?? 0));

  const startW = firstWeight ? Number(firstWeight.weightKg) : Number(goal?.currentWeightKg ?? 0);
  const currentW = latestWeight ? Number(latestWeight.weightKg) : Number(goal?.currentWeightKg ?? 0);
  const targetW = Number(goal?.targetWeightKg ?? 0);
  const lossNeeded = Math.max(0.001, startW - targetW);
  const lossDone = Math.max(0, startW - currentW);
  const lossPct = Math.min(100, Math.round((lossDone / lossNeeded) * 100));
  const remainKg = Math.max(0, currentW - targetW);

  const workoutsKcal = (workoutsQ.data ?? []).reduce(
    (acc, w) => acc + Number(w.caloriesBurned ?? 0),
    0
  );

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Page Header */}
      <div className="pt-1">
        <div className="page-label mb-1.5">TODAY · {formatDate(today)}</div>
        <h1 className="font-display" style={{ fontSize: "clamp(1.75rem,5vw,2.5rem)", color: "oklch(0.32 0.09 290)" }}>
          今日の歩み
        </h1>
      </div>

      {/* 目標未設定バナー */}
      {!goal && (
        <div
          className="rounded-2xl px-5 py-4 flex items-center gap-4"
          style={{
            background: "oklch(0.97 0.03 290 / 0.7)",
            border: "1px solid oklch(0.85 0.05 290 / 0.4)",
            backdropFilter: "blur(16px)",
          }}
        >
          <Target className="h-5 w-5 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-display text-base" style={{ color: "oklch(0.35 0.08 290)" }}>
              まずは目標を設定しましょう
            </div>
            <div className="text-xs text-muted-foreground tracking-wide mt-0.5">
              目標体重・期間・活動量から、1日の目安カロリーを自動計算します。
            </div>
          </div>
          <Link href="/goal">
            <Button size="sm" className="flex-shrink-0 rounded-full text-xs px-4">
              設定する
            </Button>
          </Link>
        </div>
      )}

      {/* 目標進捗カード */}
      {goal && (
        <div
          className="rounded-2xl px-5 py-5 overflow-hidden relative"
          style={{
            background: "oklch(1 0 0 / 0.78)",
            border: "1px solid oklch(1 0 0 / 0.82)",
            backdropFilter: "blur(24px) saturate(1.5)",
            WebkitBackdropFilter: "blur(24px) saturate(1.5)",
            boxShadow: "0 2px 4px oklch(0.35 0.08 290 / 0.06), 0 8px 24px oklch(0.35 0.08 290 / 0.08), inset 0 1px 0 oklch(1 0 0 / 0.95)",
          }}
        >
          {/* Decorative glow */}
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
            style={{ background: "oklch(0.93 0.06 320 / 0.35)", filter: "blur(40px)" }} />
          <div className="relative">
            <div className="flex items-center gap-1.5 page-label">
              <Target className="h-3 w-3" />
              目標進捗
            </div>

            {/* Weight display */}
            <div className="mt-3 flex items-end gap-2 flex-wrap">
              <div className="font-display leading-none" style={{ fontSize: "3rem", color: "oklch(0.35 0.08 290)" }}>
                {currentW.toFixed(1)}
              </div>
              <div className="text-sm text-muted-foreground mb-1.5">kg</div>
              <ArrowRight className="h-4 w-4 text-muted-foreground mb-2" />
              <div className="font-display leading-none" style={{ fontSize: "2rem", color: "oklch(0.45 0.08 290)" }}>
                {targetW.toFixed(1)}
              </div>
              <div className="text-sm text-muted-foreground mb-1.5">kg</div>
            </div>

            {/* Progress bar */}
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-xs tracking-wider-jp text-muted-foreground">
                <span>達成率</span>
                <span className="font-semibold" style={{ color: "oklch(0.45 0.1 290)" }}>{lossPct}%</span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "oklch(0.93 0.03 290 / 0.5)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${lossPct}%`,
                    background: "linear-gradient(90deg, oklch(0.65 0.12 320) 0%, oklch(0.55 0.12 290) 100%)",
                  }}
                />
              </div>
              <div className="flex justify-between text-[11px] tracking-wider-jp text-muted-foreground">
                <span>開始 {startW.toFixed(1)} kg</span>
                <span>あと <strong style={{ color: "oklch(0.45 0.1 290)" }}>{remainKg.toFixed(1)} kg</strong></span>
              </div>
            </div>

            {/* BMR / TDEE / 目安 */}
            <div className="grid grid-cols-3 gap-2.5 mt-5">
              <StatPill label="BMR" value={`${Math.round(Number(goal.bmr))}`} unit="kcal" />
              <StatPill label="TDEE" value={`${Math.round(Number(goal.tdee))}`} unit="kcal" />
              <StatPill label="1日の目安" value={`${Math.round(Number(goal.targetCalories))}`} unit="kcal" highlight />
            </div>
          </div>
        </div>
      )}

      {/* 今日の摂取カロリー */}
      <div
        className="rounded-2xl px-5 py-5"
        style={{
          background: "oklch(1 0 0 / 0.72)",
          border: "1px solid oklch(1 0 0 / 0.78)",
          backdropFilter: "blur(20px) saturate(1.4)",
          WebkitBackdropFilter: "blur(20px) saturate(1.4)",
          boxShadow: "0 1px 2px oklch(0.35 0.08 290 / 0.04), 0 4px 12px oklch(0.35 0.08 290 / 0.06), inset 0 1px 0 oklch(1 0 0 / 0.9)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 page-label">
            <Apple className="h-3 w-3" />
            今日の摂取
          </div>
          <Link href="/meals">
            <button className="text-xs tracking-wider-jp hover:underline" style={{ color: "oklch(0.45 0.1 290)" }}>
              記録する →
            </button>
          </Link>
        </div>

        <div className="mt-3 flex items-end gap-2">
          <div className="font-display leading-none" style={{ fontSize: "3rem", color: "oklch(0.35 0.08 290)" }}>
            {Math.round(summary?.calories ?? 0)}
          </div>
          <div className="text-sm text-muted-foreground mb-1.5">
            / {targetCal || "—"} kcal
          </div>
        </div>

        <div className="mt-3 h-2.5 rounded-full overflow-hidden" style={{ background: "oklch(0.93 0.03 290 / 0.5)" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${targetCal ? pct(summary?.calories ?? 0, targetCal) : 0}%`,
              background: "linear-gradient(90deg, oklch(0.72 0.12 165) 0%, oklch(0.62 0.12 290) 100%)",
            }}
          />
        </div>
        <div className="mt-1.5 text-[11px] tracking-wider-jp text-muted-foreground">
          残り <strong style={{ color: "oklch(0.45 0.1 290)" }}>{remainingKcal}</strong> kcal
        </div>

        {/* PFC */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <MacroBar label="タンパク質" value={Math.round(summary?.proteinG ?? 0)} target={pfcTarget.p} color="oklch(0.68 0.14 320)" />
          <MacroBar label="脂質" value={Math.round(summary?.fatG ?? 0)} target={pfcTarget.f} color="oklch(0.78 0.1 75)" />
          <MacroBar label="炭水化物" value={Math.round(summary?.carbsG ?? 0)} target={pfcTarget.c} color="oklch(0.72 0.13 165)" />
        </div>
      </div>

      {/* 食事区分 */}
      <div
        className="rounded-2xl px-5 py-5"
        style={{
          background: "oklch(1 0 0 / 0.72)",
          border: "1px solid oklch(1 0 0 / 0.78)",
          backdropFilter: "blur(20px) saturate(1.4)",
          WebkitBackdropFilter: "blur(20px) saturate(1.4)",
          boxShadow: "0 1px 2px oklch(0.35 0.08 290 / 0.04), 0 4px 12px oklch(0.35 0.08 290 / 0.06), inset 0 1px 0 oklch(1 0 0 / 0.9)",
        }}
      >
        <div className="page-label mb-3">食事区分の集計</div>
        <div className="grid grid-cols-2 gap-2.5">
          {(["breakfast", "lunch", "dinner", "snack"] as const).map((t) => {
            const list = (mealsQ.data ?? []).filter((m) => m.mealType === t);
            const kcal = list.reduce((acc, m) => acc + Number(m.calories), 0);
            return (
              <div
                key={t}
                className="rounded-xl px-4 py-3"
                style={{
                  background: "oklch(0.97 0.015 290 / 0.55)",
                  border: "1px solid oklch(0.9 0.02 290 / 0.4)",
                }}
              >
                <div className="text-[10px] tracking-wider-jp text-muted-foreground">{MEAL_TYPE_LABELS[t]}</div>
                <div className="mt-1 font-display text-xl leading-none" style={{ color: "oklch(0.35 0.08 290)" }}>
                  {Math.round(kcal)} <span className="text-xs text-muted-foreground font-sans">kcal</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{list.length}件</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* クイックアクション */}
      <div>
        <div className="page-label mb-3">クイックアクセス</div>
        <div className="grid grid-cols-2 gap-2.5">
          <QuickLink to="/meals" icon={<Apple className="h-4 w-4" />} title="食事を記録" subtitle="写真からAI解析" />
          <QuickLink to="/weight" icon={<CalendarHeart className="h-4 w-4" />} title="体重を記録" subtitle={`最新 ${currentW ? currentW.toFixed(1) + " kg" : "未記録"}`} />
          <QuickLink to="/workouts" icon={<Dumbbell className="h-4 w-4" />} title="運動を記録" subtitle={`今日 ${Math.round(workoutsKcal)} kcal 消費`} />
          <QuickLink to="/coach" icon={<Sparkles className="h-4 w-4" />} title="AIコーチ" subtitle="週次メニュー提案" />
          <QuickLink to="/convenience" icon={<TrendingDown className="h-4 w-4" />} title="コンビニ提案" subtitle={`残 ${remainingKcal} kcal で提案`} />
          <QuickLink to="/photos" icon={<Camera className="h-4 w-4" />} title="体型写真" subtitle={`${photosQ.data?.length ?? 0}枚 記録中`} />
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value, unit, highlight }: { label: string; value: string; unit: string; highlight?: boolean }) {
  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{
        background: highlight ? "oklch(0.93 0.06 290 / 0.35)" : "oklch(0.97 0.015 290 / 0.55)",
        border: `1px solid ${highlight ? "oklch(0.75 0.1 290 / 0.3)" : "oklch(0.9 0.02 290 / 0.4)"}`,
      }}
    >
      <div className="text-[9.5px] tracking-wider-jp text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-end gap-0.5">
        <div className="font-display text-lg leading-none" style={{ color: "oklch(0.35 0.08 290)" }}>{value}</div>
        <div className="text-[9px] text-muted-foreground mb-0.5">{unit}</div>
      </div>
    </div>
  );
}

function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const p = pct(value, target || 1);
  return (
    <div>
      <div className="text-[10px] tracking-wider-jp text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <div className="font-display text-lg leading-none" style={{ color: "oklch(0.35 0.08 290)" }}>{value}</div>
        <div className="text-[10px] text-muted-foreground">/ {target || "—"} g</div>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(0.93 0.03 290 / 0.4)" }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${p}%`, background: color }} />
      </div>
    </div>
  );
}

function QuickLink({ to, icon, title, subtitle }: { to: string; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <Link href={to}>
      <button
        className="w-full text-left rounded-2xl px-4 py-4 transition-all duration-150 active:scale-[0.97]"
        style={{
          background: "oklch(1 0 0 / 0.6)",
          border: "1px solid oklch(1 0 0 / 0.75)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          boxShadow: "0 1px 2px oklch(0.35 0.08 290 / 0.04), 0 3px 8px oklch(0.35 0.08 290 / 0.04), inset 0 1px 0 oklch(1 0 0 / 0.9)",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "oklch(1 0 0 / 0.82)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "oklch(1 0 0 / 0.6)"; }}
      >
        <div className="flex items-center gap-2" style={{ color: "oklch(0.45 0.1 290)" }}>
          {icon}
          <span className="font-display text-base">{title}</span>
        </div>
        <div className="text-[11px] tracking-wider-jp text-muted-foreground mt-1.5">{subtitle}</div>
      </button>
    </Link>
  );
}
