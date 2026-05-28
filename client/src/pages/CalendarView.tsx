import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight, X, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MEAL_TYPE_LABELS } from "@/lib/labels";

const GLASS = "rounded-2xl border border-white/60 bg-white/55 backdrop-blur-md shadow-[0_2px_16px_oklch(0.35_0.08_290/0.07)]";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function formatYearMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay(); // 0=Sun
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function calorieColor(kcal: number, target: number | null) {
  if (!target) return "oklch(0.55 0.12 290)";
  const ratio = kcal / target;
  if (ratio < 0.7) return "oklch(0.55 0.14 200)"; // 青 — 少なめ
  if (ratio <= 1.1) return "oklch(0.48 0.14 150)"; // 緑 — 良好
  if (ratio <= 1.3) return "oklch(0.6 0.16 60)";   // 黄 — 注意
  return "oklch(0.55 0.18 25)";                     // 赤 — 超過
}

export default function CalendarView() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const yearMonth = formatYearMonth(year, month);

  const { data: monthlySummary = [] } = trpc.meals.monthlySummary.useQuery({ yearMonth });
  const { data: goalData } = trpc.goals.get.useQuery();
  const { data: selectedMeals } = trpc.meals.listByDate.useQuery(
    { date: selectedDate ?? "" },
    { enabled: !!selectedDate }
  );
  const { data: selectedSummary } = trpc.meals.summary.useQuery(
    { date: selectedDate ?? "" },
    { enabled: !!selectedDate }
  );

  const targetCalories = goalData?.targetCalories ? Number(goalData.targetCalories) : null;

  // date → summary map
  const summaryMap = useMemo(() => {
    const m = new Map<string, { calories: number; count: number }>();
    for (const s of monthlySummary) {
      m.set(s.date, { calories: s.calories, count: s.count });
    }
    return m;
  }, [monthlySummary]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDow = getFirstDayOfWeek(year, month);
  const today = formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate());

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  // Build calendar grid cells (null = empty padding)
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const recordedDays = monthlySummary.length;
  const totalCalories = monthlySummary.reduce((s, r) => s + r.calories, 0);
  const avgCalories = recordedDays > 0 ? Math.round(totalCalories / recordedDays) : 0;

  return (
    <div className="space-y-5">
      {/* Page Title */}
      <div className="pt-1 mb-6">
        <p className="page-label mb-1">MEAL CALENDAR</p>
        <h1 className="font-display text-2xl md:text-3xl" style={{ color: "oklch(0.35 0.08 290)" }}>
          食事カレンダー
        </h1>
      </div>

      {/* Month Summary Stats */}
      <div className={`${GLASS} p-4`}>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xs text-muted-foreground tracking-wider-jp mb-1">記録日数</div>
            <div className="font-display text-xl" style={{ color: "oklch(0.35 0.08 290)" }}>
              {recordedDays}<span className="text-xs font-sans ml-0.5">日</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground tracking-wider-jp mb-1">平均摂取</div>
            <div className="font-display text-xl" style={{ color: "oklch(0.35 0.08 290)" }}>
              {avgCalories > 0 ? avgCalories.toLocaleString() : "—"}
              <span className="text-xs font-sans ml-0.5">kcal</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground tracking-wider-jp mb-1">月合計</div>
            <div className="font-display text-xl" style={{ color: "oklch(0.35 0.08 290)" }}>
              {totalCalories > 0 ? Math.round(totalCalories / 1000) : "—"}
              <span className="text-xs font-sans ml-0.5">kcal</span>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Card */}
      <div className={`${GLASS} p-4`}>
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8 rounded-full">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="font-display text-lg" style={{ color: "oklch(0.35 0.08 290)" }}>
            {year}年 {month}月
          </div>
          <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8 rounded-full">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Weekday Header */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className="text-center text-[10px] font-medium tracking-wider-jp py-1"
              style={{
                color: i === 0 ? "oklch(0.55 0.18 25)" : i === 6 ? "oklch(0.45 0.15 250)" : "oklch(0.5 0.04 290)",
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="aspect-square" />;
            }
            const dateStr = formatDate(year, month, day);
            const summary = summaryMap.get(dateStr);
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;
            const hasRecord = !!summary;
            const dow = (firstDow + day - 1) % 7;

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`
                  aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5
                  transition-all duration-150 active:scale-95
                  ${isSelected ? "ring-2 ring-primary shadow-md" : ""}
                  ${hasRecord ? "bg-white/70 shadow-sm" : "hover:bg-white/40"}
                  ${isToday && !isSelected ? "ring-1 ring-primary/40" : ""}
                `}
                style={{
                  background: isSelected
                    ? "oklch(0.93 0.05 290)"
                    : hasRecord
                    ? "oklch(1 0 0 / 0.65)"
                    : undefined,
                }}
              >
                <span
                  className="text-xs font-semibold leading-none"
                  style={{
                    color: isToday
                      ? "oklch(0.38 0.12 290)"
                      : dow === 0
                      ? "oklch(0.55 0.18 25)"
                      : dow === 6
                      ? "oklch(0.45 0.15 250)"
                      : "oklch(0.35 0.04 290)",
                    fontWeight: isToday ? 700 : 500,
                  }}
                >
                  {day}
                </span>
                {hasRecord && summary ? (
                  <span
                    className="text-[8px] leading-none font-medium"
                    style={{ color: calorieColor(summary.calories, targetCalories) }}
                  >
                    {summary.calories >= 1000
                      ? `${(summary.calories / 1000).toFixed(1)}k`
                      : summary.calories}
                  </span>
                ) : (
                  <span className="w-1 h-1 rounded-full bg-border/40" />
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/30">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-white/70 border border-border/40 shadow-sm" />
            <span className="text-[10px] text-muted-foreground tracking-wider-jp">記録あり</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-border/30" />
            <span className="text-[10px] text-muted-foreground tracking-wider-jp">記録なし</span>
          </div>
          {targetCalories && (
            <div className="flex items-center gap-1.5 ml-auto">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "oklch(0.48 0.14 150)" }} />
              <span className="text-[10px] text-muted-foreground tracking-wider-jp">目標内</span>
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "oklch(0.55 0.18 25)" }} />
              <span className="text-[10px] text-muted-foreground tracking-wider-jp">超過</span>
            </div>
          )}
        </div>
      </div>

      {/* Day Detail Dialog */}
      <Dialog open={!!selectedDate} onOpenChange={(open) => { if (!open) setSelectedDate(null); }}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl border-white/60 bg-white/90 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg" style={{ color: "oklch(0.35 0.08 290)" }}>
              {selectedDate
                ? `${Number(selectedDate.split("-")[1])}月${Number(selectedDate.split("-")[2])}日の食事`
                : ""}
            </DialogTitle>
          </DialogHeader>

          {selectedSummary && (
            <div className="space-y-4">
              {/* Day Totals */}
              <div className="rounded-xl bg-white/60 border border-white/70 p-3">
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "カロリー", value: `${Math.round(selectedSummary.calories)}`, unit: "kcal" },
                    { label: "タンパク質", value: `${Math.round(selectedSummary.proteinG)}`, unit: "g" },
                    { label: "脂質", value: `${Math.round(selectedSummary.fatG)}`, unit: "g" },
                    { label: "炭水化物", value: `${Math.round(selectedSummary.carbsG)}`, unit: "g" },
                  ].map(({ label, value, unit }) => (
                    <div key={label}>
                      <div className="text-[9px] text-muted-foreground tracking-wider-jp">{label}</div>
                      <div className="font-display text-base mt-0.5" style={{ color: "oklch(0.35 0.08 290)" }}>
                        {value}
                      </div>
                      <div className="text-[9px] text-muted-foreground">{unit}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Meal Items */}
              {selectedMeals && selectedMeals.length > 0 ? (
                <div className="space-y-2">
                  {(["breakfast", "lunch", "dinner", "snack"] as const).map((type) => {
                    const items = selectedMeals.filter((m) => m.mealType === type);
                    if (items.length === 0) return null;
                    return (
                      <div key={type}>
                        <div className="text-[10px] text-muted-foreground tracking-wider-jp font-medium mb-1.5 uppercase">
                          {MEAL_TYPE_LABELS[type]}
                        </div>
                        <div className="space-y-1.5">
                          {items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-start justify-between gap-2 rounded-xl bg-white/50 border border-white/60 px-3 py-2"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-foreground truncate">{item.description ?? "食事記録"}</div>
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  P {Math.round(Number(item.proteinG))}g ·
                                  F {Math.round(Number(item.fatG))}g ·
                                  C {Math.round(Number(item.carbsG))}g
                                </div>
                              </div>
                              <div className="text-sm font-semibold shrink-0" style={{ color: "oklch(0.45 0.1 290)" }}>
                                {Math.round(Number(item.calories))}
                                <span className="text-[9px] font-normal ml-0.5">kcal</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                  <Utensils className="h-8 w-8 opacity-30" />
                  <p className="text-sm tracking-wider-jp">この日の記録はありません</p>
                </div>
              )}
            </div>
          )}

          {!selectedSummary && (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <Utensils className="h-8 w-8 opacity-30" />
              <p className="text-sm tracking-wider-jp">この日の記録はありません</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
