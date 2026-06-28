import { Button } from "@/components/ui/button";
import { MEAL_TYPE_LABELS, formatDate, todayDateString } from "@/lib/labels";
import { trpc } from "@/lib/trpc";
import {
  Apple,
  CalendarHeart,
  Camera,
  Dumbbell,
  Flame,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingDown,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { Link } from "wouter";

/* ── helpers ── */
function pct(v: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.max(0, (v / total) * 100));
}

/* SVG donut ring for calorie summary */
function CalorieRing({
  consumed,
  target,
  burned,
}: {
  consumed: number;
  target: number;
  burned: number;
}) {
  const size = 160;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const remaining = Math.max(0, target - consumed + burned);
  const consumedPct = target > 0 ? Math.min(1, consumed / target) : 0;
  const burnedPct = target > 0 ? Math.min(1 - consumedPct, burned / target) : 0;

  const consumedDash = consumedPct * circ;
  const burnedDash = burnedPct * circ;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="oklch(0.92 0.006 250)"
          strokeWidth={stroke}
        />
        {/* Consumed */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="oklch(0.38 0.14 268)"
          strokeWidth={stroke}
          strokeDasharray={`${consumedDash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.23,1,0.32,1)" }}
        />
        {/* Burned (exercise) */}
        {burned > 0 && (
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke="oklch(0.72 0.18 130)"
            strokeWidth={stroke}
            strokeDasharray={`${burnedDash} ${circ}`}
            strokeDashoffset={-consumedDash}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.23,1,0.32,1)" }}
          />
        )}
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-bold text-slate-900 leading-none">{Math.round(remaining)}</div>
        <div className="text-[10px] text-muted-foreground mt-1 font-medium">残りkcal</div>
      </div>
    </div>
  );
}

/* Macro progress bar row */
function MacroRow({
  label,
  value,
  target,
  color,
}: {
  label: string;
  value: number;
  target: number;
  color: string;
}) {
  const p = pct(value, target || 1);
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-xs font-semibold text-slate-900">
          {value}g <span className="text-muted-foreground font-normal">/ {target || "—"}g</span>
        </span>
      </div>
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${p}%`, background: color }}
        />
      </div>
    </div>
  );
}

/* Quick action card */
function QuickCard({
  to,
  icon,
  title,
  sub,
  accent,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
  accent: string;
}) {
  return (
    <Link href={to}>
      <button
        className="w-full text-left rounded-xl px-4 py-3.5 transition-all duration-150 active:scale-[0.97] hover:brightness-110"
        style={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.92 0.006 250)", minHeight: "72px" }}
      >
        <div className="flex items-start gap-2 mb-1" style={{ color: accent }}>
          <span className="flex-shrink-0 mt-0.5">{icon}</span>
          <span className="text-sm font-semibold text-slate-900 leading-snug">{title}</span>
        </div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </button>
    </Link>
  );
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
  const streakQ = trpc.stats.streak.useQuery({ today });
  const weeklyQ = trpc.stats.weeklyReview.useQuery({ today });
  const weightsListQ = trpc.weights.list.useQuery();
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

  const consumed = Math.round(summary?.calories ?? 0);
  const burned = (workoutsQ.data ?? []).reduce((acc, w) => acc + Number(w.caloriesBurned ?? 0), 0);

  const startW = firstWeight ? Number(firstWeight.weightKg) : Number(goal?.currentWeightKg ?? 0);
  const currentW = latestWeight ? Number(latestWeight.weightKg) : Number(goal?.currentWeightKg ?? 0);
  const targetW = Number(goal?.targetWeightKg ?? 0);
  const lossNeeded = Math.max(0.001, startW - targetW);
  const lossDone = Math.max(0, startW - currentW);
  const lossPct = Math.min(100, Math.round((lossDone / lossNeeded) * 100));
  const remainKg = Math.max(0, currentW - targetW);

  // 運動消費は摂取枠に足さない（目標は活動量込みのTDEEベースのため二重計上を防ぐ）。
  const remainingBudget = Math.max(0, targetCal - consumed);

  // 体重トレンドから「このペースなら、いつ・何kgになるか」を予測（線形回帰）。
  // 記録が少ない時もガイドを返し、ダッシュボードに常時表示できるようにする。
  const eta = useMemo(() => {
    const pts = (weightsListQ.data ?? [])
      .map((w) => ({ t: Date.parse(w.recordDate), kg: Number(w.weightKg) }))
      .filter((p) => !Number.isNaN(p.t) && !Number.isNaN(p.kg))
      .sort((a, b) => a.t - b.t);
    if (pts.length < 2) {
      return { kind: "insufficient" as const, have: pts.length, need: Math.max(1, 2 - pts.length) };
    }
    const t0 = pts[0].t;
    const xs = pts.map((p) => (p.t - t0) / 86400000);
    const ys = pts.map((p) => p.kg);
    const n = xs.length;
    const sx = xs.reduce((a, b) => a + b, 0);
    const sy = ys.reduce((a, b) => a + b, 0);
    const sxx = xs.reduce((a, b) => a + b * b, 0);
    const sxy = xs.reduce((a, b, i) => a + b * ys[i], 0);
    const denom = n * sxx - sx * sx;
    if (denom === 0) return { kind: "insufficient" as const, have: pts.length, need: 1 };
    const slope = (n * sxy - sx * sy) / denom; // kg/日
    const lastKg = ys[ys.length - 1];
    const perWeek = slope * 7;
    // 30日後・90日後の予測体重（このペースが続いた場合）
    const proj30 = lastKg + slope * 30;
    const proj90 = lastKg + slope * 90;
    const flat = Math.abs(slope) < 0.0015; // ほぼ横ばい（約±0.01kg/週未満）

    // 目標体重への到達予測（目標が設定され、目標方向へ動いている時）
    let reach: { days: number; date: Date } | null = null;
    let reached = false;
    if (targetW) {
      const remaining = lastKg - targetW; // 減量なら正、増量なら負
      if (Math.abs(remaining) < 0.05) {
        reached = true;
      } else if (!flat && Math.sign(remaining) === Math.sign(-slope)) {
        // 目標へ近づいている（減量目標で減少中／増量目標で増加中）
        const days = Math.round(remaining / -slope);
        if (days > 0 && days <= 3650) {
          reach = { days, date: new Date(Date.now() + days * 86400000) };
        }
      }
    }
    return { kind: "trend" as const, slope, perWeek, lastKg, proj30, proj90, flat, targetW, reach, reached };
  }, [weightsListQ.data, targetW]);

  return (
    <div className="space-y-4 pb-4">
      {/* Page Header */}
      <div className="pt-1">
        <div className="section-label mb-1">TODAY · {formatDate(today)}</div>
        <h1 className="text-2xl font-bold text-slate-900">今日のサマリー</h1>
      </div>

      {/* 目標未設定バナー */}
      {!goal && (
        <div
          className="rounded-xl px-4 py-4 flex items-center gap-3"
          style={{ background: "oklch(0.58 0.19 254 / 0.1)", border: "1px solid oklch(0.58 0.19 254 / 0.14)" }}
        >
          <Target className="h-5 w-5 flex-shrink-0" style={{ color: "oklch(0.38 0.14 268)" }} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-900">まずは目標を設定しましょう</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              目標体重・期間・活動量から1日の目安カロリーを自動計算します
            </div>
          </div>
          <Link href="/goal">
            <Button size="sm" className="flex-shrink-0 text-xs h-8 px-3 rounded-lg">
              設定する
            </Button>
          </Link>
        </div>
      )}

      {/* ── カロリーリングカード ── */}
      <div
        className="rounded-xl px-5 py-5"
        style={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.92 0.006 250)" }}
      >
        <div className="section-label mb-4">カロリー</div>
        <div className="flex items-center gap-6">
          {/* Ring */}
          <div className="flex-shrink-0">
            <CalorieRing consumed={consumed} target={targetCal} burned={burned} />
          </div>
          {/* Legend */}
          <div className="flex-1 space-y-3">
            <LegendRow
              color="oklch(0.38 0.14 268)"
              label="摂取"
              value={`${consumed} kcal`}
            />
            <LegendRow
              color="oklch(0.72 0.18 130)"
              label="消費（運動）"
              value={`${Math.round(burned)} kcal`}
            />
            <LegendRow
              color="oklch(0.92 0.006 250)"
              label="目標"
              value={`${targetCal || "—"} kcal`}
            />
            <div
              className="mt-2 pt-2 border-t border-border"
            >
              <div className="text-xs text-muted-foreground">あと食べられる</div>
              <div className="text-xl font-bold text-slate-900">
                {remainingBudget} kcal
              </div>
              {burned > 0 && (
                <div className="text-[11px] mt-0.5" style={{ color: "oklch(0.72 0.18 130)" }}>
                  運動でさらに −{Math.round(burned)}kcalの貯金🔥
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PFC Bars */}
        <div className="mt-5 space-y-3">
          <MacroRow
            label="タンパク質"
            value={Math.round(summary?.proteinG ?? 0)}
            target={pfcTarget.p}
            color="oklch(0.38 0.14 268)"
          />
          <MacroRow
            label="脂質"
            value={Math.round(summary?.fatG ?? 0)}
            target={pfcTarget.f}
            color="oklch(0.75 0.18 55)"
          />
          <MacroRow
            label="炭水化物"
            value={Math.round(summary?.carbsG ?? 0)}
            target={pfcTarget.c}
            color="oklch(0.72 0.18 130)"
          />
        </div>
      </div>

      {/* ── 体重予測カード（常時表示）── */}
      <div
        className="rounded-xl px-5 py-5"
        style={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.92 0.006 250)" }}
      >
        <div className="flex items-center gap-2 section-label mb-3">
          <TrendingDown className="h-3.5 w-3.5" />
          体重予測
        </div>

        {eta.kind === "insufficient" ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0 text-sm text-muted-foreground leading-relaxed">
              体重をあと<span className="font-bold text-slate-900">{eta.need}回</span>記録すると、
              このペースで<span className="font-semibold text-slate-900">いつ何kgになるか</span>を予測して表示します。
            </div>
            <Link href="/weight">
              <Button size="sm" className="flex-shrink-0 text-xs h-8 px-3 rounded-lg">記録する</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {/* メイン予測：いつ・何kgか */}
            <div
              className="rounded-lg px-4 py-3"
              style={{ background: "oklch(0.965 0.004 250)" }}
            >
              {eta.reached ? (
                <div className="text-base font-bold text-slate-900">目標体重に到達しています！🎉</div>
              ) : eta.reach ? (
                <>
                  <div className="text-xs text-muted-foreground">このペースで続けると</div>
                  <div className="text-lg font-bold text-slate-900 mt-0.5 leading-snug">
                    {eta.reach.date.getFullYear()}年{eta.reach.date.getMonth() + 1}月{eta.reach.date.getDate()}日頃
                    <span className="text-muted-foreground font-normal text-sm">に</span>
                    <span style={{ color: "oklch(0.72 0.18 130)" }}> {eta.targetW!.toFixed(1)}kg</span>
                    <span className="text-muted-foreground font-normal text-sm"> 達成</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    あと約{eta.reach.days}日 ／ 目標まで {Math.abs(eta.lastKg - eta.targetW!).toFixed(1)}kg
                  </div>
                </>
              ) : eta.flat ? (
                <>
                  <div className="text-base font-bold text-slate-900">最近は横ばいです</div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    このままだと1ヶ月後も約{eta.proj30.toFixed(1)}kg。食事か運動を少し見直すと動き出します
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs text-muted-foreground">このペースで続けると</div>
                  <div className="text-lg font-bold text-slate-900 mt-0.5">
                    1ヶ月後 <span style={{ color: "oklch(0.72 0.18 130)" }}>約{eta.proj30.toFixed(1)}kg</span>
                  </div>
                  {eta.targetW ? (
                    <div className="text-[11px] text-muted-foreground mt-1">
                      ※ 今のペースは目標（{eta.targetW.toFixed(1)}kg）方向に向かっていません
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground mt-1">目標体重を設定すると到達日も予測できます</div>
                  )}
                </>
              )}
            </div>

            {/* 補助：週ペースと将来体重の見込み */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg px-3 py-2" style={{ background: "oklch(0.965 0.004 250)" }}>
                <div className="text-[10px] text-muted-foreground">週ペース</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {eta.perWeek > 0 ? "+" : ""}{eta.perWeek.toFixed(2)}<span className="text-[10px] font-normal text-muted-foreground ml-0.5">kg</span>
                </div>
              </div>
              <div className="rounded-lg px-3 py-2" style={{ background: "oklch(0.965 0.004 250)" }}>
                <div className="text-[10px] text-muted-foreground">1ヶ月後</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  約{eta.proj30.toFixed(1)}<span className="text-[10px] font-normal text-muted-foreground ml-0.5">kg</span>
                </div>
              </div>
              <div className="rounded-lg px-3 py-2" style={{ background: "oklch(0.965 0.004 250)" }}>
                <div className="text-[10px] text-muted-foreground">3ヶ月後</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  約{eta.proj90.toFixed(1)}<span className="text-[10px] font-normal text-muted-foreground ml-0.5">kg</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 目標進捗カード ── */}
      {goal && (
        <div
          className="rounded-xl px-5 py-5"
          style={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.92 0.006 250)" }}
        >
          <div className="section-label mb-3">体重目標</div>
          <div className="flex items-end gap-3 mb-4">
            <div>
              <div className="text-xs text-muted-foreground">現在</div>
              <div className="text-3xl font-bold text-slate-900">{currentW.toFixed(1)}<span className="text-base font-normal text-muted-foreground ml-1">kg</span></div>
            </div>
            <div className="text-muted-foreground mb-1">→</div>
            <div>
              <div className="text-xs text-muted-foreground">目標</div>
              <div className="text-2xl font-bold" style={{ color: "oklch(0.72 0.18 130)" }}>{targetW.toFixed(1)}<span className="text-sm font-normal text-muted-foreground ml-1">kg</span></div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-xs text-muted-foreground">あと</div>
              <div className="text-xl font-bold" style={{ color: "oklch(0.75 0.18 55)" }}>{remainKg.toFixed(1)}<span className="text-sm font-normal text-muted-foreground ml-1">kg</span></div>
            </div>
          </div>
          {/* Progress bar */}
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>達成率</span>
            <span className="font-semibold text-slate-900">{lossPct}%</span>
          </div>
          <div className="progress-track" style={{ height: "8px" }}>
            <div
              className="progress-fill"
              style={{ width: `${lossPct}%`, background: "linear-gradient(90deg, oklch(0.38 0.14 268), oklch(0.72 0.18 130))" }}
            />
          </div>

          {/* BMR / TDEE */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { label: "基礎代謝", value: Math.round(Number(goal.bmr)) },
              { label: "消費カロリー", value: Math.round(Number(goal.tdee)) },
              { label: "目標", value: Math.round(Number(goal.targetCalories)) },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-lg px-3 py-2.5 text-center"
                style={{ background: "oklch(0.965 0.004 250)" }}
              >
                <div className="text-[10px] font-medium text-muted-foreground">{label}</div>
                <div className="text-base font-bold text-slate-900 mt-0.5">{value}</div>
                <div className="text-[10px] text-muted-foreground">kcal</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 食事区分 ── */}
      <div
        className="rounded-xl px-5 py-5"
        style={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.92 0.006 250)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="section-label">食事区分</div>
          <Link href="/meals">
            <button className="text-xs font-medium" style={{ color: "oklch(0.38 0.14 268)" }}>
              記録する →
            </button>
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(["breakfast", "lunch", "dinner", "snack"] as const).map((t) => {
            const list = (mealsQ.data ?? []).filter((m) => m.mealType === t);
            const kcal = list.reduce((acc, m) => acc + Number(m.calories), 0);
            return (
              <div
                key={t}
                className="rounded-lg px-3 py-3"
                style={{ background: "oklch(0.965 0.004 250)" }}
              >
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {MEAL_TYPE_LABELS[t]}
                </div>
                <div className="text-lg font-bold text-slate-900 mt-1">
                  {Math.round(kcal)}<span className="text-xs font-normal text-muted-foreground ml-1">kcal</span>
                </div>
                <div className="text-[10px] text-muted-foreground">{list.length}件</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 今週のふりかえり ── */}
      {weeklyQ.data && weeklyQ.data.daysWithMeals > 0 && (
        <div
          className="rounded-xl px-5 py-5"
          style={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.92 0.006 250)" }}
        >
          <div className="section-label mb-3">今週のふりかえり（直近7日）</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg px-3 py-2.5 text-center" style={{ background: "oklch(0.965 0.004 250)" }}>
              <div className="text-[10px] font-medium text-muted-foreground">平均摂取</div>
              <div className="text-base font-bold text-slate-900 mt-0.5">{weeklyQ.data.avgCalories}</div>
              <div className="text-[10px] text-muted-foreground">kcal/日</div>
            </div>
            <div className="rounded-lg px-3 py-2.5 text-center" style={{ background: "oklch(0.965 0.004 250)" }}>
              <div className="text-[10px] font-medium text-muted-foreground">目標達成</div>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {weeklyQ.data.target ? weeklyQ.data.goalMetDays : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground">{weeklyQ.data.target ? "日" : "目標未設定"}</div>
            </div>
            <div className="rounded-lg px-3 py-2.5 text-center" style={{ background: "oklch(0.965 0.004 250)" }}>
              <div className="text-[10px] font-medium text-muted-foreground">体重変化</div>
              <div
                className="text-base font-bold mt-0.5"
                style={{
                  color:
                    weeklyQ.data.weightChange == null
                      ? "white"
                      : weeklyQ.data.weightChange <= 0
                        ? "oklch(0.72 0.18 130)"
                        : "oklch(0.75 0.18 55)",
                }}
              >
                {weeklyQ.data.weightChange == null
                  ? "—"
                  : `${weeklyQ.data.weightChange > 0 ? "+" : ""}${weeklyQ.data.weightChange.toFixed(1)}`}
              </div>
              <div className="text-[10px] text-muted-foreground">kg</div>
            </div>
          </div>
        </div>
      )}

      {/* ── クイックアクセス ── */}
      <div>
        <div className="section-label mb-3">クイックアクセス</div>
        <div className="grid grid-cols-2 gap-2">
          <QuickCard to="/meals"       icon={<Apple className="h-4 w-4" />}       title="食事を記録"   sub="写真からAI解析"                    accent="oklch(0.38 0.14 268)" />
          <QuickCard to="/weight"      icon={<CalendarHeart className="h-4 w-4" />} title="体重を記録" sub={`最新 ${currentW ? currentW.toFixed(1) + " kg" : "未記録"}`} accent="oklch(0.72 0.18 130)" />
          <QuickCard to="/workouts"    icon={<Dumbbell className="h-4 w-4" />}    title="運動を記録"   sub={`今日 ${Math.round(burned)} kcal 消費`} accent="oklch(0.75 0.18 55)" />
          <QuickCard to="/coach"       icon={<Sparkles className="h-4 w-4" />}    title="AIパーソナルトレーナー" sub="週次メニュー提案"          accent="oklch(0.68 0.14 290)" />
          <QuickCard to="/convenience" icon={<ShoppingBag className="h-4 w-4" />} title="コンビニ提案" sub={`残 ${remainingBudget} kcal`} accent="oklch(0.38 0.14 268)" />
          <QuickCard to="/photos"      icon={<Camera className="h-4 w-4" />}      title="体型写真"     sub={`${photosQ.data?.length ?? 0}枚 記録中`} accent="oklch(0.72 0.18 130)" />
        </div>
      </div>
    </div>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="text-xs text-muted-foreground flex-1">{label}</span>
      <span className="text-xs font-semibold text-slate-900">{value}</span>
    </div>
  );
}
