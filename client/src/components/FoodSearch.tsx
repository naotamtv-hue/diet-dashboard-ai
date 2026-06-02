import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { MEAL_TYPES, MEAL_TYPE_LABELS } from "@/lib/labels";
import { ChevronLeft, Plus, Search, Sparkles, Loader2, Minus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const BLUE = "oklch(0.58 0.19 254)";

type MealType = (typeof MEAL_TYPES)[number];
type Per100 = { kcal: number; p: number; f: number; c: number };
// per100 を持つ食材は「グラム指定」、持たないもの（コンビニ・履歴）は「人前」で記録する。
type Food = {
  name: string;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  per100?: Per100;
  defaultGrams?: number;
};

export default function FoodSearch({
  date,
  initialMealType,
  onClose,
}: {
  date: string;
  initialMealType: MealType;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [mealType, setMealType] = useState<MealType>(initialMealType);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<Food | null>(null);

  const historyQ = trpc.meals.history.useQuery(undefined, { staleTime: 30_000 });
  const foodsQ = trpc.foods.search.useQuery(
    { keyword: query.trim(), limit: 24 },
    { enabled: query.trim().length > 0 }
  );
  const searchQ = trpc.convenience.search.useQuery(
    { keyword: query.trim(), limit: 30 },
    { enabled: query.trim().length > 0 }
  );
  const estimateM = trpc.meals.estimateByName.useMutation();
  const addM = trpc.meals.add.useMutation({
    onSuccess: () => {
      utils.meals.listByDate.invalidate({ date });
      utils.meals.summary.invalidate({ date });
      utils.meals.history.invalidate();
    },
  });

  const quickAdd = async (f: Food) => {
    await addM.mutateAsync({
      date,
      mealType,
      description: f.name,
      imageUrl: null,
      calories: Math.round(f.calories),
      proteinG: Math.round(f.proteinG),
      fatG: Math.round(f.fatG),
      carbsG: Math.round(f.carbsG),
    });
    toast.success(`「${f.name}」を${MEAL_TYPE_LABELS[mealType]}に追加`);
  };

  const aiCalc = async () => {
    const q = query.trim();
    if (!q) return;
    try {
      const res = await estimateM.mutateAsync({ query: q });
      const a = res.analysis;
      if (!a.calories) {
        toast.error(a.description || "推定できませんでした");
        return;
      }
      setDetail({ name: a.description, calories: a.calories, proteinG: a.proteinG, fatG: a.fatG, carbsG: a.carbsG });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "計算に失敗しました");
    }
  };

  if (detail) {
    return (
      <FoodDetail
        food={detail}
        mealType={mealType}
        onMealType={setMealType}
        onBack={() => setDetail(null)}
        saving={addM.isPending}
        onSave={async (f) => {
          await quickAdd(f);
          onClose();
        }}
      />
    );
  }

  // 基本食材（米・さつまいも等）＝グラム指定。代表値は defaultGrams 分で表示。
  const basicResults: Food[] = (foodsQ.data ?? []).map((f) => {
    const g = f.defaultGrams;
    const k = g / 100;
    return {
      name: f.name,
      calories: f.per100.kcal * k,
      proteinG: f.per100.p * k,
      fatG: f.per100.f * k,
      carbsG: f.per100.c * k,
      per100: f.per100,
      defaultGrams: g,
    };
  });
  const convResults: Food[] = (searchQ.data ?? []).map((c) => ({
    name: c.name,
    calories: Number(c.calories),
    proteinG: Number(c.proteinG),
    fatG: Number(c.fatG),
    carbsG: Number(c.carbsG),
  }));
  const list: Food[] = query.trim()
    ? [...basicResults, ...convResults]
    : (historyQ.data ?? []).map((h) => ({
        name: h.name,
        calories: h.calories,
        proteinG: h.proteinG,
        fatG: h.fatG,
        carbsG: h.carbsG,
      }));

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border bg-card">
        <button onClick={onClose} className="tap-target -ml-1 text-muted-foreground">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <select
          value={mealType}
          onChange={(e) => setMealType(e.target.value as MealType)}
          className="flex-1 text-center font-bold text-base bg-transparent outline-none"
          style={{ color: BLUE }}
        >
          {MEAL_TYPES.map((t) => (
            <option key={t} value={t}>{MEAL_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <div className="w-6" />
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="フードを検索（例：白米／サラダチキン）"
            className="h-12 pl-10 rounded-full"
            autoFocus
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {/* AIで計算（検索時） */}
        {query.trim() && (
          <button
            onClick={aiCalc}
            disabled={estimateM.isPending}
            className="w-full flex items-center gap-3 rounded-xl px-4 py-3.5 mb-2 bg-card border"
            style={{ borderColor: BLUE }}
          >
            {estimateM.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin flex-shrink-0" style={{ color: BLUE }} />
            ) : (
              <Sparkles className="h-5 w-5 flex-shrink-0" style={{ color: BLUE }} />
            )}
            <div className="flex-1 text-left">
              <div className="text-sm font-semibold" style={{ color: BLUE }}>「{query.trim()}」をAIで計算</div>
              <div className="text-[11px] text-muted-foreground">リストに無い食べ物もカロリーを推定</div>
            </div>
          </button>
        )}

        <div className="text-xs font-bold text-foreground mb-2 mt-1">
          {query.trim() ? "検索結果" : "履歴"}
        </div>

        {(query.trim() ? searchQ.isLoading : historyQ.isLoading) ? (
          <div className="py-8 text-center text-sm text-muted-foreground">読み込み中...</div>
        ) : list.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {query.trim() ? "該当なし。上の「AIで計算」をお試しください。" : "まだ記録がありません。"}
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((f, i) => (
              <div
                key={`${f.name}-${i}`}
                className="flex items-center gap-3 rounded-xl px-4 py-3 bg-card border border-border"
              >
                <button onClick={() => setDetail(f)} className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-semibold text-foreground truncate">{f.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {Math.round(f.calories)}kcal · P{Math.round(f.proteinG)} / F{Math.round(f.fatG)} / C{Math.round(f.carbsG)}
                  </div>
                </button>
                <button
                  onClick={() => quickAdd(f)}
                  className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: "oklch(0.95 0.02 254)", color: BLUE }}
                  aria-label="追加"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── フード詳細（分量調整→記録） ── */
function FoodDetail({
  food,
  mealType,
  onMealType,
  onBack,
  saving,
  onSave,
}: {
  food: Food;
  mealType: MealType;
  onMealType: (m: MealType) => void;
  onBack: () => void;
  saving: boolean;
  onSave: (f: Food) => void;
}) {
  const gramMode = !!food.per100;
  const [mult, setMult] = useState(1);
  const [grams, setGrams] = useState(food.defaultGrams ?? 100);

  const scaled: Food = gramMode
    ? {
        name: food.name,
        calories: food.per100!.kcal * (grams / 100),
        proteinG: food.per100!.p * (grams / 100),
        fatG: food.per100!.f * (grams / 100),
        carbsG: food.per100!.c * (grams / 100),
      }
    : {
        name: food.name,
        calories: food.calories * mult,
        proteinG: food.proteinG * mult,
        fatG: food.fatG * mult,
        carbsG: food.carbsG * mult,
      };
  const setM = (v: number) => setMult(Math.max(0.25, Math.round(v * 4) / 4));
  const setG = (v: number) => setGrams(Math.max(5, Math.min(2000, Math.round(v / 5) * 5)));

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border bg-card">
        <button onClick={onBack} className="tap-target -ml-1 text-muted-foreground">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="flex-1 text-center font-bold text-base text-foreground">フードを追加</div>
        <button onClick={() => onSave(scaled)} disabled={saving} className="text-sm font-bold px-2" style={{ color: BLUE }}>
          {saving ? "..." : "記録"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">{food.name}</h2>
        </div>

        {/* 区分 */}
        <div className="flex items-center justify-between rounded-xl px-4 py-3 bg-card border border-border">
          <span className="text-sm text-muted-foreground">ミール</span>
          <select value={mealType} onChange={(e) => onMealType(e.target.value as MealType)} className="font-semibold bg-transparent outline-none" style={{ color: BLUE }}>
            {MEAL_TYPES.map((t) => (
              <option key={t} value={t}>{MEAL_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        {/* 分量 */}
        {gramMode ? (
          <div className="rounded-xl px-4 py-3 bg-card border border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">分量（グラム）</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setG(grams - 10)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "oklch(0.95 0.01 254)", color: BLUE }}>
                  <Minus className="h-4 w-4" />
                </button>
                <div className="flex items-baseline gap-0.5 w-[72px] justify-center">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={grams}
                    onChange={(e) => setGrams(Math.max(5, Math.min(2000, Number(e.target.value) || 0)))}
                    className="w-12 text-lg font-bold text-foreground text-right bg-transparent outline-none tabular-nums"
                  />
                  <span className="text-sm text-muted-foreground">g</span>
                </div>
                <button onClick={() => setG(grams + 10)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "oklch(0.95 0.01 254)", color: BLUE }}>
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex gap-1.5">
              {[50, 100, 150, 200].map((g) => (
                <button
                  key={g}
                  onClick={() => setGrams(g)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold border"
                  style={grams === g ? { background: BLUE, color: "white", borderColor: BLUE } : { color: BLUE, borderColor: "oklch(0.9 0.02 254)" }}
                >
                  {g}g
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-xl px-4 py-3 bg-card border border-border">
            <span className="text-sm text-muted-foreground">分量（人前）</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setM(mult - 0.25)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "oklch(0.95 0.01 254)", color: BLUE }}>
                <Minus className="h-4 w-4" />
              </button>
              <span className="text-lg font-bold text-foreground w-10 text-center tabular-nums">{mult}</span>
              <button onClick={() => setM(mult + 0.25)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "oklch(0.95 0.01 254)", color: BLUE }}>
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* カロリー＆PFC */}
        <div className="rounded-xl px-4 py-5 bg-card border border-border text-center">
          <div className="text-4xl font-bold text-foreground">{Math.round(scaled.calories)}</div>
          <div className="text-xs text-muted-foreground mb-4">kcal</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { l: "タンパク質", v: scaled.proteinG, c: BLUE },
              { l: "脂質", v: scaled.fatG, c: "oklch(0.75 0.15 55)" },
              { l: "炭水化物", v: scaled.carbsG, c: "oklch(0.62 0.16 155)" },
            ].map((x) => (
              <div key={x.l}>
                <div className="text-lg font-bold" style={{ color: x.c }}>{Math.round(x.v)}g</div>
                <div className="text-[10px] text-muted-foreground">{x.l}</div>
              </div>
            ))}
          </div>
        </div>

        <Button onClick={() => onSave(scaled)} disabled={saving} className="w-full h-12 font-bold rounded-xl" style={{ background: BLUE }}>
          {saving ? "記録中..." : `${MEAL_TYPE_LABELS[mealType]}に記録する`}
        </Button>
      </div>
    </div>
  );
}
