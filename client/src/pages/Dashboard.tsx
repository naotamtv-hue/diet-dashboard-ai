import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { useMemo, useState } from "react";
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

  // 体重進捗
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
    <div className="space-y-6">
      <Header date={today} />

      {!goal && (
        <Card className="p-5 bg-white/70 border-white/70 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <Target className="h-5 w-5 mt-0.5 text-primary" />
            <div className="flex-1">
              <div className="font-display text-lg text-primary">
                まずは目標を設定しましょう
              </div>
              <div className="text-xs text-muted-foreground tracking-wide mt-1">
                目標体重・期間・活動量から、1日の目安カロリーを自動で計算します。
              </div>
            </div>
            <Link href="/goal">
              <Button size="sm" className="rounded-full">
                設定する
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* 目標と進捗のサマリー */}
      {goal && (
        <Card className="p-5 bg-white/70 border-white/70 backdrop-blur-sm overflow-hidden relative">
          <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-secondary/40 blur-2xl pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs tracking-wider-jp text-muted-foreground">
              <Target className="h-3.5 w-3.5" />
              現在の目標
            </div>
            <div className="mt-3 flex items-end gap-3">
              <div className="font-display text-4xl text-primary leading-none">
                {currentW.toFixed(1)}
              </div>
              <div className="text-sm text-muted-foreground mb-1">kg</div>
              <ArrowRight className="h-4 w-4 text-muted-foreground mb-1.5" />
              <div className="font-display text-2xl text-primary leading-none">
                {targetW.toFixed(1)}
              </div>
              <div className="text-sm text-muted-foreground mb-1">kg</div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-xs tracking-wider-jp text-muted-foreground">
                <span>達成率</span>
                <span>{lossPct}%</span>
              </div>
              <Progress value={lossPct} className="h-2" />
              <div className="flex justify-between text-[11px] tracking-wider-jp text-muted-foreground">
                <span>
                  開始 {startW.toFixed(1)}kg →
                </span>
                <span>
                  あと <strong className="text-primary">{remainKg.toFixed(1)}kg</strong>
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-5">
              <Stat label="BMR" value={`${Math.round(Number(goal.bmr))}`} unit="kcal" />
              <Stat label="TDEE" value={`${Math.round(Number(goal.tdee))}`} unit="kcal" />
              <Stat
                label="1日の目安"
                value={`${Math.round(Number(goal.targetCalories))}`}
                unit="kcal"
                highlight
              />
            </div>
          </div>
        </Card>
      )}

      {/* 今日の摂取 */}
      <Card className="p-5 bg-white/70 border-white/70 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs tracking-wider-jp text-muted-foreground">
            <Apple className="h-3.5 w-3.5" />
            今日の摂取
          </div>
          <Link href="/meals">
            <button className="text-xs tracking-wider-jp text-primary hover:underline">
              記録する →
            </button>
          </Link>
        </div>
        <div className="mt-3 flex items-end gap-3">
          <div className="font-display text-4xl text-primary leading-none">
            {Math.round(summary?.calories ?? 0)}
          </div>
          <div className="text-sm text-muted-foreground mb-1">/ {targetCal || "—"} kcal</div>
        </div>
        <Progress
          value={targetCal ? pct(summary?.calories ?? 0, targetCal) : 0}
          className="h-2 mt-3"
        />
        <div className="mt-2 text-[11px] tracking-wider-jp text-muted-foreground">
          残り <strong className="text-primary">{remainingKcal}</strong> kcal
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <Macro
            label="タンパク質"
            value={Math.round(summary?.proteinG ?? 0)}
            target={pfcTarget.p}
            color="oklch(0.72 0.12 320)"
          />
          <Macro
            label="脂質"
            value={Math.round(summary?.fatG ?? 0)}
            target={pfcTarget.f}
            color="oklch(0.8 0.09 80)"
          />
          <Macro
            label="炭水化物"
            value={Math.round(summary?.carbsG ?? 0)}
            target={pfcTarget.c}
            color="oklch(0.78 0.11 160)"
          />
        </div>
      </Card>

      {/* 食事区分 */}
      <Card className="p-5 bg-white/70 border-white/70 backdrop-blur-sm">
        <div className="text-xs tracking-wider-jp text-muted-foreground mb-3">
          食事区分の集計
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(["breakfast", "lunch", "dinner", "snack"] as const).map((t) => {
            const list = (mealsQ.data ?? []).filter((m) => m.mealType === t);
            const kcal = list.reduce((acc, m) => acc + Number(m.calories), 0);
            return (
              <div
                key={t}
                className="border border-white/70 bg-white/40 rounded-2xl px-4 py-3"
              >
                <div className="text-[11px] tracking-wider-jp text-muted-foreground">
                  {MEAL_TYPE_LABELS[t]}
                </div>
                <div className="mt-1 font-display text-xl text-primary leading-none">
                  {Math.round(kcal)} <span className="text-xs text-muted-foreground">kcal</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">{list.length}件</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* クイックアクション */}
      <div className="grid grid-cols-2 gap-3">
        <QuickLink
          to="/meals"
          icon={<Apple className="h-4 w-4" />}
          title="食事を記録"
          subtitle="写真からAI解析"
        />
        <QuickLink
          to="/weight"
          icon={<CalendarHeart className="h-4 w-4" />}
          title="体重を記録"
          subtitle={`最新 ${currentW ? currentW.toFixed(1) + " kg" : "未記録"}`}
        />
        <QuickLink
          to="/workouts"
          icon={<Dumbbell className="h-4 w-4" />}
          title="運動を記録"
          subtitle={`今日 ${Math.round(workoutsKcal)} kcal 消費`}
        />
        <QuickLink
          to="/coach"
          icon={<Sparkles className="h-4 w-4" />}
          title="AIコーチ"
          subtitle="週次メニュー提案"
        />
        <QuickLink
          to="/convenience"
          icon={<TrendingDown className="h-4 w-4" />}
          title="コンビニ提案"
          subtitle={`残${remainingKcal} kcalで提案`}
        />
        <QuickLink
          to="/photos"
          icon={<Camera className="h-4 w-4" />}
          title="体型写真"
          subtitle={`${photosQ.data?.length ?? 0}枚 記録中`}
        />
      </div>
    </div>
  );
}

function Header({ date }: { date: string }) {
  return (
    <div>
      <div className="text-[11px] tracking-wider-jp text-muted-foreground">
        TODAY · {formatDate(date)}
      </div>
      <h1 className="font-display text-3xl text-primary mt-1">今日の歩み</h1>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value: string;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl px-3 py-2.5 ${
        highlight
          ? "bg-primary/10 border border-primary/20"
          : "bg-white/50 border border-white/70"
      }`}
    >
      <div className="text-[10px] tracking-wider-jp text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-end gap-1">
        <div className="font-display text-lg text-primary leading-none">{value}</div>
        <div className="text-[10px] text-muted-foreground mb-0.5">{unit}</div>
      </div>
    </div>
  );
}

function Macro({
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
      <div className="text-[10px] tracking-wider-jp text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <div className="font-display text-lg text-primary leading-none">{value}</div>
        <div className="text-[10px] text-muted-foreground">/ {target || "—"} g</div>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-white/70 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${p}%`, background: color }} />
      </div>
    </div>
  );
}

function QuickLink({
  to,
  icon,
  title,
  subtitle,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link href={to}>
      <button className="w-full text-left bg-white/60 hover:bg-white/80 transition-colors border border-white/70 backdrop-blur-sm rounded-2xl px-4 py-4">
        <div className="flex items-center gap-2 text-primary">
          {icon}
          <span className="font-display text-base">{title}</span>
        </div>
        <div className="text-[11px] tracking-wider-jp text-muted-foreground mt-1.5">
          {subtitle}
        </div>
      </button>
    </Link>
  );
}
