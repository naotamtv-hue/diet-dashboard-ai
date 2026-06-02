import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MEAL_TYPES, MEAL_TYPE_LABELS, fileToDataUrl, todayDateString } from "@/lib/labels";
import FoodSearch from "@/components/FoodSearch";
import { trpc } from "@/lib/trpc";
import { mealMotivation } from "@/lib/motivation";
import { Bookmark, Camera, ChevronLeft, ChevronRight, Copy, Droplet, Loader2, Minus, Pencil, Plus, Search, ShoppingBag, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const CARD = {
  background: "oklch(1 0 0)",
  border: "1px solid oklch(0.92 0.006 250)",
} as const;

const INNER = {
  background: "oklch(0.965 0.004 250)",
  border: "1px solid oklch(0.92 0.006 250)",
} as const;

function shiftDate(d: string, days: number): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day + days)).toISOString().slice(0, 10);
}

function formatDateLabel(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  const wd = ["日", "月", "火", "水", "木", "金", "土"][dt.getUTCDay()];
  const today = todayDateString();
  const prefix = d === today ? "今日 · " : d === shiftDate(today, -1) ? "昨日 · " : "";
  return `${prefix}${m}月${day}日(${wd})`;
}

type Analysis = {
  description: string;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  confidence: "low" | "medium" | "high";
};

type MealRow = {
  id: number;
  mealType: (typeof MEAL_TYPES)[number];
  description: string | null;
  imageUrl: string | null;
  calories: string;
  proteinG: string;
  fatG: string;
  carbsG: string;
};

/* ── コンビニ商品検索モーダル ── */
function ConvenienceModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (item: { name: string; calories: number; proteinG: number; fatG: number; carbsG: number }) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [chain, setChain] = useState<"all" | "seven" | "familymart" | "lawson">("all");

  const searchInput = useMemo(
    () => ({
      chain: chain === "all" ? undefined : chain,
      keyword: keyword.trim() || undefined,
    }),
    [chain, keyword]
  );

  const searchQ = trpc.convenience.search.useQuery(searchInput);
  const items = searchQ.data ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-lg w-full max-h-[85vh] flex flex-col gap-0 p-0 rounded-2xl overflow-hidden"
        style={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.92 0.006 250)" }}
      >
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg font-bold text-slate-900">
            コンビニ商品から選ぶ
          </DialogTitle>
        </DialogHeader>

        {/* 検索フィルター */}
        <div className="px-5 py-3 space-y-2.5 flex-shrink-0 border-b border-border">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="商品名で検索..."
                className="pl-8 h-10 text-sm"
                autoFocus
              />
            </div>
            <Select value={chain} onValueChange={(v) => setChain(v as typeof chain)}>
              <SelectTrigger className="w-32 h-10 text-sm flex-shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="seven">セブン</SelectItem>
                <SelectItem value="familymart">ファミマ</SelectItem>
                <SelectItem value="lawson">ローソン</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="section-label">{items.length} 件</div>
        </div>

        {/* 商品リスト */}
        <div className="overflow-y-auto flex-1 px-3 py-2">
          {searchQ.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-8">
              該当する商品が見つかりません
            </div>
          ) : (
            <div className="space-y-1.5 pb-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  className="w-full text-left rounded-xl px-4 py-3 transition-all active:scale-[0.99] hover:brightness-110"
                  style={INNER}
                  onClick={() => {
                    onSelect({
                      name: item.name,
                      calories: Number(item.calories),
                      proteinG: Number(item.proteinG),
                      fatG: Number(item.fatG),
                      carbsG: Number(item.carbsG),
                    });
                    onClose();
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    <ShoppingBag className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "oklch(0.58 0.19 254)" }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900 leading-snug">{item.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {item.chain === "seven" ? "セブン-イレブン" : item.chain === "familymart" ? "ファミリーマート" : "ローソン"}
                        {item.priceYen ? ` · ¥${item.priceYen}` : ""}
                      </div>
                      <div className="text-xs mt-1 font-semibold" style={{ color: "oklch(0.58 0.19 254)" }}>
                        {Number(item.calories)}kcal
                        <span className="text-muted-foreground font-normal ml-1.5">
                          P{Number(item.proteinG)}g / F{Number(item.fatG)}g / C{Number(item.carbsG)}g
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── メインページ ── */
export default function Meals() {
  const [date, setDate] = useState(todayDateString());
  const [mealType, setMealType] = useState<(typeof MEAL_TYPES)[number]>("lunch");
  const [calories, setCalories] = useState("");
  const [proteinG, setProteinG] = useState("");
  const [fatG, setFatG] = useState("");
  const [carbsG, setCarbsG] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [convenienceOpen, setConvenienceOpen] = useState(false);
  const [nameQuery, setNameQuery] = useState("");
  const [editing, setEditing] = useState<MealRow | null>(null);
  const [addMeal, setAddMeal] = useState<(typeof MEAL_TYPES)[number] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const listQ = trpc.meals.listByDate.useQuery({ date });
  const summaryQ = trpc.meals.summary.useQuery({ date });
  const goalQ = trpc.goals.get.useQuery();
  const workoutsQ = trpc.workouts.listByDate.useQuery({ date });
  const frequentQ = trpc.meals.frequentItems.useQuery();
  const copyM = trpc.meals.copyFromDate.useMutation({
    onSuccess: (res) => {
      utils.meals.listByDate.invalidate({ date });
      utils.meals.summary.invalidate({ date });
      if (res.count > 0) toast.success(`前日の食事を${res.count}件コピーしました`);
      else toast.error("前日の記録がありません");
    },
    onError: (e) => toast.error(e.message),
  });

  const yesterdayStr = useMemo(() => {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  }, [date]);

  const analyzeM = trpc.meals.analyzePhoto.useMutation();
  const estimateM = trpc.meals.estimateByName.useMutation();
  const addM = trpc.meals.add.useMutation({
    onSuccess: () => {
      utils.meals.listByDate.invalidate({ date });
      utils.meals.summary.invalidate({ date });
    },
  });
  const saveMealM = trpc.foods.saveMeal.useMutation({
    onSuccess: (_d, vars) => {
      utils.foods.myMeals.invalidate();
      toast.success(`「${vars.name}」をMyミールに保存しました`);
    },
    onError: (e) => toast.error(e.message),
  });
  const removeM = trpc.meals.remove.useMutation({
    onSuccess: () => {
      utils.meals.listByDate.invalidate({ date });
      utils.meals.summary.invalidate({ date });
    },
  });
  const updateM = trpc.meals.update.useMutation({
    onSuccess: () => {
      utils.meals.listByDate.invalidate({ date });
      utils.meals.summary.invalidate({ date });
      setEditing(null);
      toast.success("更新しました");
    },
    onError: (e) => toast.error(e.message),
  });

  const onPickPhoto = async (file: File) => {
    try {
      setAnalyzing(true);
      const dataUrl = await fileToDataUrl(file);
      const res = await analyzeM.mutateAsync({ imageDataUrl: dataUrl });
      const a = res.analysis as Analysis;
      setImageUrl(res.imageUrl);
      setDescription(a.description);
      setCalories(String(a.calories));
      setProteinG(String(a.proteinG));
      setFatG(String(a.fatG));
      setCarbsG(String(a.carbsG));
      toast.success(`AI解析完了（信頼度：${a.confidence}）`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "解析に失敗しました";
      toast.error(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const onSearchByName = async () => {
    const q = nameQuery.trim();
    if (!q) return;
    try {
      const res = await estimateM.mutateAsync({ query: q });
      const a = res.analysis as Analysis;
      if (!a.calories) {
        toast.error(a.description || "推定できませんでした");
        return;
      }
      setDescription(a.description);
      setCalories(String(a.calories));
      setProteinG(String(a.proteinG));
      setFatG(String(a.fatG));
      setCarbsG(String(a.carbsG));
      setImageUrl(null);
      toast.success("AI推定で入力しました（おおよその値です）");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "検索に失敗しました");
    }
  };

  const onSelectFrequent = (item: {
    name: string;
    mealType: (typeof MEAL_TYPES)[number];
    calories: number;
    proteinG: number;
    fatG: number;
    carbsG: number;
  }) => {
    setDescription(item.name);
    setMealType(item.mealType);
    setCalories(String(item.calories));
    setProteinG(String(item.proteinG));
    setFatG(String(item.fatG));
    setCarbsG(String(item.carbsG));
    setImageUrl(null);
    toast.success(`「${item.name}」を入力しました`);
  };

  const onSelectConvenience = (item: {
    name: string;
    calories: number;
    proteinG: number;
    fatG: number;
    carbsG: number;
  }) => {
    setDescription(item.name);
    setCalories(String(item.calories));
    setProteinG(String(item.proteinG));
    setFatG(String(item.fatG));
    setCarbsG(String(item.carbsG));
    setImageUrl(null);
    toast.success(`「${item.name}」の情報を入力しました`);
  };

  const submit = async () => {
    const cal = Number(calories);
    if (!cal || cal < 0) {
      toast.error("カロリーを入力してください");
      return;
    }
    await addM.mutateAsync({
      date,
      mealType,
      description: description || null,
      imageUrl,
      calories: Number(calories) || 0,
      proteinG: Number(proteinG) || 0,
      fatG: Number(fatG) || 0,
      carbsG: Number(carbsG) || 0,
    });
    setDescription("");
    setCalories("");
    setProteinG("");
    setFatG("");
    setCarbsG("");
    setImageUrl(null);
    toast.success(mealMotivation(), { duration: 4500 });
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Page Header + 昨日と同じ */}
      <div className="pt-1 flex items-end justify-between gap-3">
        <div>
          <div className="section-label mb-1">MEALS</div>
          <h1 className="text-2xl font-bold text-slate-900">食事を記録</h1>
        </div>
        <button
          type="button"
          className="text-xs font-semibold flex items-center gap-1 px-3 py-2 rounded-full disabled:opacity-50 flex-shrink-0"
          style={{ background: "oklch(0.95 0.02 254)", color: "oklch(0.58 0.19 254)" }}
          disabled={copyM.isPending}
          onClick={() => copyM.mutate({ fromDate: yesterdayStr, toDate: date })}
        >
          <Copy className="h-3.5 w-3.5" /> 昨日と同じ
        </button>
      </div>

      {/* 日付ナビ */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setDate(shiftDate(date, -1))}
          className="h-11 w-11 flex-shrink-0 rounded-xl flex items-center justify-center"
          style={CARD}
          aria-label="前の日"
        >
          <ChevronLeft className="h-5 w-5 text-slate-700" />
        </button>
        <div className="flex-1 rounded-xl h-11 flex items-center justify-center relative" style={CARD}>
          <span className="text-sm font-bold text-slate-900">{formatDateLabel(date)}</span>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer h-full"
            aria-label="日付を選択"
          />
        </div>
        <button
          type="button"
          onClick={() => setDate(shiftDate(date, 1))}
          className="h-11 w-11 flex-shrink-0 rounded-xl flex items-center justify-center"
          style={CARD}
          aria-label="次の日"
        >
          <ChevronRight className="h-5 w-5 text-slate-700" />
        </button>
      </div>

      {/* 残りカロリー（MyFitnessPal式: 目標 − 食事 ＋ 運動 ＝ 残り） */}
      {(() => {
        const goalCal = Math.round(Number(goalQ.data?.targetCalories ?? 0));
        const food = Math.round(summaryQ.data?.calories ?? 0);
        const exercise = Math.round(
          (workoutsQ.data ?? []).reduce((a, w) => a + Number(w.caloriesBurned ?? 0), 0)
        );
        const remaining = goalCal - food + exercise;
        return (
          <div className="rounded-xl px-4 py-4" style={CARD}>
            {goalCal > 0 ? (
              <div className="flex items-center justify-around text-center mb-3">
                <FormulaItem value={goalCal} label="目標" />
                <span className="text-muted-foreground text-base">−</span>
                <FormulaItem value={food} label="食事" />
                <span className="text-muted-foreground text-base">＋</span>
                <FormulaItem value={exercise} label="運動" />
                <span className="text-muted-foreground text-base">＝</span>
                <FormulaItem value={remaining} label="残り" highlight />
              </div>
            ) : (
              <div className="flex items-end gap-2 mb-3">
                <div className="text-3xl font-bold text-slate-900 leading-none">{food}</div>
                <div className="text-xs text-muted-foreground pb-0.5">kcal 摂取</div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3 text-xs pt-3" style={{ borderTop: "1px solid oklch(0.94 0.005 250)" }}>
              <MacroStat label="タンパク質" value={Math.round(summaryQ.data?.proteinG ?? 0)} color="oklch(0.58 0.19 254)" />
              <MacroStat label="脂質" value={Math.round(summaryQ.data?.fatG ?? 0)} color="oklch(0.75 0.18 55)" />
              <MacroStat label="炭水化物" value={Math.round(summaryQ.data?.carbsG ?? 0)} color="oklch(0.72 0.18 155)" />
            </div>
          </div>
        );
      })()}

      {/* 区分別リスト */}
      {MEAL_TYPES.map((t) => {
        const list = (listQ.data ?? []).filter((m) => m.mealType === t);
        const kcal = list.reduce((a, m) => a + Number(m.calories), 0);
        return (
          <div key={t} className="rounded-xl px-4 py-4" style={CARD}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-base font-bold text-slate-900">{MEAL_TYPE_LABELS[t]}</div>
              <div className="flex items-center gap-2">
                {list.length > 0 && (
                  <button
                    type="button"
                    className="text-[11px] font-semibold flex items-center gap-0.5 disabled:opacity-50"
                    style={{ color: "oklch(0.55 0.02 252)" }}
                    disabled={saveMealM.isPending}
                    onClick={() => {
                      const name = window.prompt("Myミールの名前", `${MEAL_TYPE_LABELS[t]}セット`);
                      if (!name || !name.trim()) return;
                      saveMealM.mutate({
                        name: name.trim(),
                        items: list.map((m) => ({
                          name: m.description || "（内容未入力）",
                          calories: Math.round(Number(m.calories)),
                          proteinG: Math.round(Number(m.proteinG)),
                          fatG: Math.round(Number(m.fatG)),
                          carbsG: Math.round(Number(m.carbsG)),
                        })),
                      });
                    }}
                  >
                    <Bookmark className="h-3.5 w-3.5" /> 保存
                  </button>
                )}
                <div className="text-xs font-semibold" style={{ color: "oklch(0.58 0.19 254)" }}>
                  {Math.round(kcal)} kcal · {list.length}件
                </div>
              </div>
            </div>
            {list.length === 0 ? (
              <div className="text-xs text-muted-foreground py-1">記録なし</div>
            ) : (
              <div className="space-y-2">
                {list.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 rounded-xl px-3 py-3"
                    style={INNER}
                  >
                    {m.imageUrl && (
                      <img src={m.imageUrl} alt="" className="w-11 h-11 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {m.description || "（内容未入力）"}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {Math.round(Number(m.calories))}kcal · P{Math.round(Number(m.proteinG))} /
                        F{Math.round(Number(m.fatG))} / C{Math.round(Number(m.carbsG))}
                      </div>
                    </div>
                    <button
                      className="tap-target text-muted-foreground hover:text-slate-900 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
                      aria-label="編集"
                      onClick={() => setEditing(m as MealRow)}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      className="tap-target text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors flex-shrink-0"
                      aria-label="削除"
                      onClick={() => removeM.mutate({ id: m.id })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* MyFitnessPal風: フードを追加（検索・履歴・AI） */}
            <button
              onClick={() => setAddMeal(t)}
              className="w-full mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors"
              style={{ background: "oklch(0.95 0.02 254)", color: "oklch(0.58 0.19 254)" }}
            >
              <Plus className="h-4 w-4" /> フードを追加
            </button>
          </div>
        );
      })}

      {/* 水分（MyFitnessPal風） */}
      <WaterCard date={date} />

      {/* MyFitnessPal風 フード検索（全画面） */}
      {addMeal && (
        <FoodSearch date={date} initialMealType={addMeal} onClose={() => setAddMeal(null)} />
      )}

      {/* コンビニ商品検索モーダル */}
      <ConvenienceModal
        open={convenienceOpen}
        onClose={() => setConvenienceOpen(false)}
        onSelect={onSelectConvenience}
      />

      {/* 食事編集モーダル */}
      <EditMealModal
        meal={editing}
        saving={updateM.isPending}
        onClose={() => setEditing(null)}
        onSave={(vals) => updateM.mutate({ id: editing!.id, ...vals })}
      />
    </div>
  );
}

/* ── 食事編集モーダル ── */
function EditMealModal({
  meal,
  saving,
  onClose,
  onSave,
}: {
  meal: MealRow | null;
  saving: boolean;
  onClose: () => void;
  onSave: (vals: {
    mealType: (typeof MEAL_TYPES)[number];
    description: string | null;
    calories: number;
    proteinG: number;
    fatG: number;
    carbsG: number;
  }) => void;
}) {
  const [mealType, setMealType] = useState<(typeof MEAL_TYPES)[number]>("lunch");
  const [description, setDescription] = useState("");
  const [calories, setCalories] = useState("");
  const [proteinG, setProteinG] = useState("");
  const [fatG, setFatG] = useState("");
  const [carbsG, setCarbsG] = useState("");

  useEffect(() => {
    if (!meal) return;
    setMealType(meal.mealType);
    setDescription(meal.description ?? "");
    setCalories(String(Number(meal.calories)));
    setProteinG(String(Number(meal.proteinG)));
    setFatG(String(Number(meal.fatG)));
    setCarbsG(String(Number(meal.carbsG)));
  }, [meal]);

  return (
    <Dialog open={!!meal} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>食事を編集</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="section-label">区分</Label>
            <Select value={mealType} onValueChange={(v) => setMealType(v as typeof mealType)}>
              <SelectTrigger className="w-full h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEAL_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{MEAL_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="section-label">内容</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-11" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumField label="カロリー (kcal)" value={calories} onChange={setCalories} />
            <NumField label="タンパク質 (g)" value={proteinG} onChange={setProteinG} />
            <NumField label="脂質 (g)" value={fatG} onChange={setFatG} />
            <NumField label="炭水化物 (g)" value={carbsG} onChange={setCarbsG} />
          </div>
          <Button
            className="w-full h-12 font-bold rounded-xl"
            style={{ background: "oklch(0.58 0.19 254)" }}
            disabled={saving}
            onClick={() =>
              onSave({
                mealType,
                description: description.trim() || null,
                calories: Number(calories) || 0,
                proteinG: Number(proteinG) || 0,
                fatG: Number(fatG) || 0,
                carbsG: Number(carbsG) || 0,
              })
            }
          >
            {saving ? "保存中..." : "保存する"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className="section-label">{label}</Label>
      <Input inputMode="decimal" type="number" value={value} onChange={(e) => onChange(e.target.value)} className="h-11" />
    </div>
  );
}

/* ── 水分カード（1杯=250ml） ── */
function WaterCard({ date }: { date: string }) {
  const CUP_ML = 250;
  const utils = trpc.useUtils();
  const waterQ = trpc.water.get.useQuery({ date });
  const setM = trpc.water.set.useMutation({
    onMutate: async (vars) => {
      await utils.water.get.cancel({ date });
      const prev = utils.water.get.getData({ date });
      utils.water.get.setData({ date }, vars.cups);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) utils.water.get.setData({ date }, ctx.prev);
    },
    onSettled: () => utils.water.get.invalidate({ date }),
  });
  const cups = waterQ.data ?? 0;
  const set = (n: number) => setM.mutate({ date, cups: Math.max(0, Math.min(30, n)) });

  return (
    <div className="rounded-xl px-4 py-4" style={CARD}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Droplet className="h-4 w-4" style={{ color: "oklch(0.6 0.13 230)" }} />
          <span className="text-base font-bold text-slate-900">水分</span>
        </div>
        <div className="text-xs font-semibold" style={{ color: "oklch(0.6 0.13 230)" }}>
          {(cups * CUP_ML).toLocaleString()} ml · {cups}杯
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => set(cups - 1)}
          disabled={cups <= 0}
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40"
          style={{ background: "oklch(0.95 0.03 230)", color: "oklch(0.55 0.13 230)" }}
          aria-label="水分を減らす"
        >
          <Minus className="h-4 w-4" />
        </button>
        <div className="flex-1 flex gap-1 overflow-hidden">
          {Array.from({ length: Math.max(8, cups) }).slice(0, 12).map((_, i) => (
            <div
              key={i}
              onClick={() => set(i + 1)}
              className="flex-1 h-9 rounded-md cursor-pointer transition-colors"
              style={{ background: i < cups ? "oklch(0.7 0.12 230)" : "oklch(0.94 0.01 230)", maxWidth: "28px" }}
            />
          ))}
        </div>
        <button
          onClick={() => set(cups + 1)}
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "oklch(0.6 0.13 230)", color: "white" }}
          aria-label="水分を追加"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="text-[10px] text-muted-foreground mt-2">コップ1杯 = 250ml ・ 目安は1日約2L（8杯）</div>
    </div>
  );
}

function FormulaItem({ value, label, highlight }: { value: number; label: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col items-center min-w-0">
      <div
        className="text-lg font-bold leading-none tabular-nums"
        style={{ color: highlight ? (value < 0 ? "oklch(0.62 0.2 25)" : "oklch(0.58 0.19 254)") : "oklch(0.2 0.02 250)" }}
      >
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function MacroStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-0.5">
      <div className="section-label">{label}</div>
      <div className="text-sm font-bold" style={{ color }}>{value}g</div>
    </div>
  );
}
