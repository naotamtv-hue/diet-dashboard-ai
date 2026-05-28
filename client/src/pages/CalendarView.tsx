import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MEAL_TYPE_LABELS } from "@/lib/labels";

const CARD = {
  background: "oklch(0.20 0.05 240)",
  border: "1px solid oklch(0.30 0.04 240)",
} as const;

const INNER = {
  background: "oklch(0.24 0.04 240)",
  border: "1px solid oklch(0.30 0.04 240)",
} as const;

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function formatYearMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay();
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function calorieColor(kcal: number, target: number | null) {
  if (!target) return "oklch(0.62 0.18 220)";
  const ratio = kcal / target;
  if (ratio < 0.7) return "oklch(0.62 0.18 220)";
  if (ratio <= 1.1) return "oklch(0.72 0.18 155)";
  if (ratio <= 1.3) return "oklch(0.75 0.18 55)";
  return "oklch(0.65 0.22 25)";
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

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const recordedDays = monthlySummary.length;
  const totalCalories = monthlySummary.reduce((s, r) => s + r.calories, 0);
  const avgCalories = recordedDays > 0 ? Math.round(totalCalories / recordedDays) : 0;

  return (
    <div className="space-y-4 pb-4">
      {/* Page Header */}
      <div className="pt-1">
        <div className="section-label mb-1">MEAL CALENDAR</div>
        <h1 className="text-2xl font-bold text-white">食事カレンダー</h1>
      </div>

      {/* Month Summary Stats */}
      <div className="rounded-xl px-4 py-4" style={CARD}>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="section-label mb-1">記録日数</div>
            <div className="text-xl font-bold text-white">
              {recordedDays}<span className="text-xs font-normal text-muted-foreground ml-0.5">日</span>
            </div>
          </div>
          <div>
            <div className="section-label mb-1">平均摂取</div>
            <div className="text-xl font-bold" style={{ color: "oklch(0.62 0.18 220)" }}>
              {avgCalories > 0 ? avgCalories.toLocaleString() : "—"}
              <span className="text-xs font-normal text-muted-foreground ml-0.5">kcal</span>
            </div>
          </div>
          <div>
            <div className="section-label mb-1">月合計</div>
            <div className="text-xl font-bold text-white">
              {totalCalories > 0 ? Math.round(totalCalories / 1000) : "—"}
              <span className="text-xs font-normal text-muted-foreground ml-0.5">k</span>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Card */}
      <div className="rounded-xl px-4 py-4" style={CARD}>
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={prevMonth}
            className="h-9 w-9 rounded-full"
            style={{ color: "oklch(0.75 0.02 220)" }}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-lg font-bold text-white">
            {year}年 {month}月
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={nextMonth}
            className="h-9 w-9 rounded-full"
            style={{ color: "oklch(0.75 0.02 220)" }}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Weekday Header */}
        <div className="grid grid-cols-7 mb-2">
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className="text-center text-[11px] font-semibold py-1"
              style={{
                color: i === 0 ? "oklch(0.65 0.22 25)" : i === 6 ? "oklch(0.62 0.18 220)" : "oklch(0.55 0.03 220)",
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
                className="aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all duration-150 active:scale-95"
                style={{
                  background: isSelected
                    ? "oklch(0.62 0.18 220 / 0.3)"
                    : hasRecord
                    ? "oklch(0.26 0.05 240)"
                    : "transparent",
                  border: isSelected
                    ? "1.5px solid oklch(0.62 0.18 220)"
                    : isToday
                    ? "1.5px solid oklch(0.62 0.18 220 / 0.5)"
                    : hasRecord
                    ? "1px solid oklch(0.32 0.04 240)"
                    : "1px solid transparent",
                }}
              >
                <span
                  className="text-xs font-semibold leading-none"
                  style={{
                    color: isToday
                      ? "oklch(0.62 0.18 220)"
                      : dow === 0
                      ? "oklch(0.65 0.22 25)"
                      : dow === 6
                      ? "oklch(0.62 0.18 220)"
                      : "oklch(0.85 0.02 220)",
                    fontWeight: isToday ? 700 : 500,
                  }}
                >
                  {day}
                </span>
                {hasRecord && summary ? (
                  <span
                    className="text-[8px] leading-none font-bold"
                    style={{ color: calorieColor(summary.calories, targetCalories) }}
                  >
                    {summary.calories >= 1000
                      ? `${(summary.calories / 1000).toFixed(1)}k`
                      : summary.calories}
                  </span>
                ) : (
                  <span
                    className="w-1 h-1 rounded-full"
                    style={{ background: "oklch(0.35 0.03 240)" }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-3" style={{ borderTop: "1px solid oklch(0.28 0.04 240)" }}>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "oklch(0.26 0.05 240)", border: "1px solid oklch(0.32 0.04 240)" }} />
            <span className="text-[10px] text-muted-foreground">記録あり</span>
          </div>
          {targetCalories && (
            <div className="flex items-center gap-3 ml-auto">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: "oklch(0.72 0.18 155)" }} />
                <span className="text-[10px] text-muted-foreground">目標内</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: "oklch(0.65 0.22 25)" }} />
                <span className="text-[10px] text-muted-foreground">超過</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Day Detail Dialog */}
      <Dialog open={!!selectedDate} onOpenChange={(open) => { if (!open) setSelectedDate(null); }}>
        <DialogContent
          className="max-w-sm mx-auto rounded-2xl"
          style={{ background: "oklch(0.18 0.05 240)", border: "1px solid oklch(0.30 0.04 240)" }}
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white">
              {selectedDate
                ? `${Number(selectedDate.split("-")[1])}月${Number(selectedDate.split("-")[2])}日の食事`
                : ""}
            </DialogTitle>
          </DialogHeader>

          {selectedSummary && (
            <div className="space-y-4">
              {/* Day Totals */}
              <div className="rounded-xl px-3 py-3" style={INNER}>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "カロリー", value: `${Math.round(selectedSummary.calories)}`, unit: "kcal", accent: true },
                    { label: "タンパク質", value: `${Math.round(selectedSummary.proteinG)}`, unit: "g" },
                    { label: "脂質", value: `${Math.round(selectedSummary.fatG)}`, unit: "g" },
                    { label: "炭水化物", value: `${Math.round(selectedSummary.carbsG)}`, unit: "g" },
                  ].map(({ label, value, unit, accent }) => (
                    <div key={label}>
                      <div className="text-[9px] text-muted-foreground">{label}</div>
                      <div
                        className="text-base font-bold mt-0.5"
                        style={{ color: accent ? "oklch(0.62 0.18 220)" : "oklch(0.90 0.01 220)" }}
                      >
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
                        <div className="section-label mb-1.5 uppercase">
                          {MEAL_TYPE_LABELS[type]}
                        </div>
                        <div className="space-y-1.5">
                          {items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-start justify-between gap-2 rounded-xl px-3 py-2"
                              style={INNER}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-white truncate">{item.description ?? "食事記録"}</div>
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  P {Math.round(Number(item.proteinG))}g ·
                                  F {Math.round(Number(item.fatG))}g ·
                                  C {Math.round(Number(item.carbsG))}g
                                </div>
                              </div>
                              <div
                                className="text-sm font-bold shrink-0"
                                style={{ color: "oklch(0.62 0.18 220)" }}
                              >
                                {Math.round(Number(item.calories))}
                                <span className="text-[9px] font-normal text-muted-foreground ml-0.5">kcal</span>
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
                  <p className="text-sm">この日の記録はありません</p>
                </div>
              )}
            </div>
          )}

          {!selectedSummary && (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <Utensils className="h-8 w-8 opacity-30" />
              <p className="text-sm">この日の記録はありません</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
