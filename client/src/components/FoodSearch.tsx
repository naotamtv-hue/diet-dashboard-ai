import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { MEAL_TYPES, MEAL_TYPE_LABELS, fileToDataUrl } from "@/lib/labels";
import { Camera, ChevronLeft, Pencil, Plus, PlusCircle, ScanLine, Search, Sparkles, Star, Loader2, Minus, Trash2, UtensilsCrossed } from "lucide-react";
import { useRef, useState } from "react";
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
  onPick,
  pickTitle,
}: {
  date: string;
  initialMealType: MealType;
  onClose: () => void;
  // 指定すると「選んで返す」ピックモードになる（日記には記録せず、選んだ食品を返す）。
  onPick?: (f: Food) => void;
  pickTitle?: string;
}) {
  const pickMode = !!onPick;
  const utils = trpc.useUtils();
  const [mealType, setMealType] = useState<MealType>(initialMealType);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<Food | null>(null);
  const [creating, setCreating] = useState(false);
  const [editFood, setEditFood] = useState<{ id: number; name: string; servingLabel: string; calories: number; proteinG: number; fatG: number; carbsG: number } | null>(null);
  const [building, setBuilding] = useState<{ id?: number; name: string; items: Food[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const packageRef = useRef<HTMLInputElement>(null);
  const analyzeM = trpc.meals.analyzePhoto.useMutation();
  const packageM = trpc.meals.analyzePackage.useMutation();

  const myFoodsQ = trpc.foods.myFoods.useQuery(
    { keyword: query.trim() || undefined },
    { staleTime: 20_000 }
  );
  const myMealsQ = trpc.foods.myMeals.useQuery(undefined, { staleTime: 20_000 });
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
  const createM = trpc.foods.createCustom.useMutation({
    onSuccess: () => utils.foods.myFoods.invalidate(),
  });
  const updateCustomM = trpc.foods.updateCustom.useMutation({ onSuccess: () => utils.foods.myFoods.invalidate() });
  const deleteCustomM = trpc.foods.deleteCustom.useMutation({ onSuccess: () => utils.foods.myFoods.invalidate() });
  const saveMealM = trpc.foods.saveMeal.useMutation({ onSuccess: () => utils.foods.myMeals.invalidate() });
  const updateMealM = trpc.foods.updateMeal.useMutation({ onSuccess: () => utils.foods.myMeals.invalidate() });
  const deleteMealM = trpc.foods.deleteMeal.useMutation({ onSuccess: () => utils.foods.myMeals.invalidate() });
  const addM = trpc.meals.add.useMutation({
    onSuccess: () => {
      utils.meals.listByDate.invalidate({ date });
      utils.meals.summary.invalidate({ date });
      utils.meals.history.invalidate();
    },
  });

  const quickAdd = async (f: Food) => {
    if (pickMode) {
      onPick!({
        name: f.name,
        calories: Math.round(f.calories),
        proteinG: Math.round(f.proteinG),
        fatG: Math.round(f.fatG),
        carbsG: Math.round(f.carbsG),
      });
      onClose();
      return;
    }
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

  const logMealItems = async (name: string, items: Food[]) => {
    for (const f of items) {
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
    }
    toast.success(`「${name}」（${items.length}品）を${MEAL_TYPE_LABELS[mealType]}に追加`);
    onClose();
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

  const analyzePhoto = async (file: File) => {
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await analyzeM.mutateAsync({ imageDataUrl: dataUrl });
      const a = res.analysis as { description: string; calories: number; proteinG: number; fatG: number; carbsG: number };
      if (!a.calories) {
        toast.error(a.description || "解析できませんでした");
        return;
      }
      setDetail({ name: a.description, calories: a.calories, proteinG: a.proteinG, fatG: a.fatG, carbsG: a.carbsG });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "解析に失敗しました");
    }
  };

  const analyzePackage = async (file: File) => {
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await packageM.mutateAsync({ imageDataUrl: dataUrl });
      const a = res.analysis as { description: string; calories: number; proteinG: number; fatG: number; carbsG: number };
      if (!a.calories) {
        toast.error(a.description || "成分表示を読み取れませんでした");
        return;
      }
      setDetail({ name: a.description, calories: a.calories, proteinG: a.proteinG, fatG: a.fatG, carbsG: a.carbsG });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "読み取りに失敗しました");
    }
  };

  const favoriteFood = async (f: Food) => {
    // 表示中の食品を「自分の食品(お気に入り)」として保存。
    // グラム食品は基準グラムを、それ以外は1食を単位にする。
    const servingLabel = f.per100 ? `${f.defaultGrams ?? 100}g` : "1食";
    await createM.mutateAsync({
      name: f.name,
      servingLabel,
      calories: Math.round(f.calories),
      proteinG: Math.round(f.proteinG),
      fatG: Math.round(f.fatG),
      carbsG: Math.round(f.carbsG),
    });
    toast.success(`「${f.name}」をお気に入りに登録しました`);
  };

  if (detail) {
    return (
      <FoodDetail
        food={detail}
        mealType={mealType}
        onMealType={setMealType}
        onBack={() => setDetail(null)}
        saving={addM.isPending}
        favoriting={createM.isPending}
        onFavorite={pickMode ? undefined : favoriteFood}
        confirmLabel={pickMode ? "追加" : undefined}
        onSave={async (f) => {
          await quickAdd(f);
          onClose();
        }}
      />
    );
  }

  if (creating) {
    return (
      <CreateFoodForm
        initialName={query.trim()}
        saving={createM.isPending}
        onBack={() => setCreating(false)}
        onCreate={async (vals) => {
          const created = await createM.mutateAsync(vals);
          setCreating(false);
          setDetail({
            name: created.name,
            calories: Number(created.calories),
            proteinG: Number(created.proteinG),
            fatG: Number(created.fatG),
            carbsG: Number(created.carbsG),
          });
          toast.success(`「${created.name}」を作成しました`);
        }}
      />
    );
  }

  if (editFood && !pickMode) {
    return (
      <CreateFoodForm
        initialName=""
        initial={editFood}
        saving={updateCustomM.isPending || deleteCustomM.isPending}
        onBack={() => setEditFood(null)}
        onCreate={async (vals) => {
          await updateCustomM.mutateAsync({ id: editFood.id, ...vals });
          setEditFood(null);
          toast.success("食品を更新しました");
        }}
        onDelete={async () => {
          await deleteCustomM.mutateAsync({ id: editFood.id });
          setEditFood(null);
          toast.success("削除しました");
        }}
      />
    );
  }

  if (building && !pickMode) {
    return (
      <MealBuilder
        date={date}
        initialMealType={mealType}
        initial={building}
        saving={saveMealM.isPending || updateMealM.isPending}
        onClose={() => setBuilding(null)}
        onSave={async (name, items, id) => {
          if (id) {
            await updateMealM.mutateAsync({ id, name, items });
            toast.success(`「${name}」を更新しました`);
          } else {
            await saveMealM.mutateAsync({ name, items });
            toast.success(`「${name}」をMyミールに保存しました`);
          }
          setBuilding(null);
        }}
        onDelete={
          building.id
            ? async () => {
                await deleteMealM.mutateAsync({ id: building.id! });
                toast.success("削除しました");
                setBuilding(null);
              }
            : undefined
        }
      />
    );
  }

  // My Foods（自分で作成した食品）＝1食(servingLabel)あたり。人前で記録。
  const myFoodResults: Food[] = (myFoodsQ.data ?? []).map((f) => ({
    name: f.name,
    calories: Number(f.calories),
    proteinG: Number(f.proteinG),
    fatG: Number(f.fatG),
    carbsG: Number(f.carbsG),
  }));
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
    ? [...myFoodResults, ...basicResults, ...convResults]
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
        {pickMode ? (
          <div className="flex-1 text-center font-bold text-base text-foreground">{pickTitle ?? "食品を選ぶ"}</div>
        ) : (
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
        )}
        <div className="w-6" />
      </div>

      {/* Search */}
      <div className="px-4 py-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="フードを検索（例：白米／サラダチキン）"
            className="h-12 pl-10 rounded-full"
            autoFocus
          />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) analyzePhoto(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={analyzeM.isPending}
          className="h-12 w-12 flex-shrink-0 rounded-full flex items-center justify-center border"
          style={{ borderColor: BLUE, color: BLUE }}
          aria-label="写真で解析"
        >
          {analyzeM.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
        </button>
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

        {/* パッケージ/栄養成分表示から登録（ピックモードでは非表示） */}
        {!pickMode && (
          <>
            <input
              ref={packageRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) analyzePackage(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => packageRef.current?.click()}
              disabled={packageM.isPending}
              className="w-full flex items-center gap-3 rounded-xl px-4 py-3 mb-2 bg-card border"
              style={{ borderColor: "oklch(0.72 0.18 155)" }}
            >
              {packageM.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin flex-shrink-0" style={{ color: "oklch(0.6 0.16 155)" }} />
              ) : (
                <ScanLine className="h-5 w-5 flex-shrink-0" style={{ color: "oklch(0.6 0.16 155)" }} />
              )}
              <div className="flex-1 text-left">
                <div className="text-sm font-semibold" style={{ color: "oklch(0.5 0.14 155)" }}>
                  {packageM.isPending ? "成分表示を読み取り中..." : "パッケージの栄養成分表示から登録"}
                </div>
                <div className="text-[11px] text-muted-foreground">商品の成分表示を撮影 → 自動で栄養を入力</div>
              </div>
            </button>

            {/* 自分で食品を作成 */}
            <button
              onClick={() => setCreating(true)}
              className="w-full flex items-center gap-3 rounded-xl px-4 py-3 mb-2 bg-card border border-dashed"
              style={{ borderColor: "oklch(0.8 0.02 254)" }}
            >
              <PlusCircle className="h-5 w-5 flex-shrink-0" style={{ color: BLUE }} />
              <div className="flex-1 text-left">
                <div className="text-sm font-semibold text-foreground">
                  {query.trim() ? `「${query.trim()}」を自分の食品として作成` : "自分で食品を作成"}
                </div>
                <div className="text-[11px] text-muted-foreground">栄養成分を入力して、次から検索に出せます</div>
              </div>
            </button>

            {/* Myミール/パッケージを作成 */}
            <button
              onClick={() => setBuilding({ name: "", items: [] })}
              className="w-full flex items-center gap-3 rounded-xl px-4 py-3 mb-2 bg-card border border-dashed"
              style={{ borderColor: "oklch(0.78 0.1 75)" }}
            >
              <UtensilsCrossed className="h-5 w-5 flex-shrink-0" style={{ color: "oklch(0.66 0.15 60)" }} />
              <div className="flex-1 text-left">
                <div className="text-sm font-semibold text-foreground">Myミール（パッケージ）を作成</div>
                <div className="text-[11px] text-muted-foreground">卵・納豆・白米など複数をまとめて1つに。分量調整・編集OK</div>
              </div>
            </button>

            {/* Myミール（保存した食事セット）— 検索していない時 */}
            {!query.trim() && (myMealsQ.data?.length ?? 0) > 0 && (
              <div className="mb-3">
                <div className="text-xs font-bold text-foreground mb-2 mt-1">Myミール</div>
                <div className="space-y-2">
                  {myMealsQ.data!.map((m) => {
                    const total = m.items.reduce((a, it) => a + it.calories, 0);
                    return (
                      <div
                        key={m.id}
                        className="w-full flex items-center gap-2 rounded-xl px-4 py-3 bg-card border border-border"
                      >
                        <button onClick={() => logMealItems(m.name, m.items)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                          <UtensilsCrossed className="h-5 w-5 flex-shrink-0" style={{ color: BLUE }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-foreground truncate">{m.name}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {m.items.length}品 · 合計{Math.round(total)}kcal
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={() => setBuilding({ id: m.id, name: m.name, items: m.items })}
                          className="tap-target text-muted-foreground flex-shrink-0"
                          aria-label="編集"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => logMealItems(m.name, m.items)}
                          className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                          style={{ background: "oklch(0.95 0.02 254)", color: BLUE }}
                          aria-label="追加"
                        >
                          <Plus className="h-5 w-5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 自分の食品（登録済み）— 検索していない時。編集・削除可 */}
            {!query.trim() && (myFoodsQ.data?.length ?? 0) > 0 && (
              <div className="mb-3">
                <div className="text-xs font-bold text-foreground mb-2 mt-1">自分の食品</div>
                <div className="space-y-2">
                  {myFoodsQ.data!.map((cf) => (
                    <div key={cf.id} className="w-full flex items-center gap-2 rounded-xl px-4 py-3 bg-card border border-border">
                      <button
                        onClick={() =>
                          setDetail({
                            name: cf.name,
                            calories: Number(cf.calories),
                            proteinG: Number(cf.proteinG),
                            fatG: Number(cf.fatG),
                            carbsG: Number(cf.carbsG),
                          })
                        }
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="text-sm font-semibold text-foreground truncate">{cf.name}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {Math.round(Number(cf.calories))}kcal · P{Math.round(Number(cf.proteinG))} / F{Math.round(Number(cf.fatG))} / C{Math.round(Number(cf.carbsG))} ・ {cf.servingLabel}
                        </div>
                      </button>
                      <button
                        onClick={() =>
                          setEditFood({
                            id: cf.id,
                            name: cf.name,
                            servingLabel: cf.servingLabel,
                            calories: Math.round(Number(cf.calories)),
                            proteinG: Math.round(Number(cf.proteinG)),
                            fatG: Math.round(Number(cf.fatG)),
                            carbsG: Math.round(Number(cf.carbsG)),
                          })
                        }
                        className="tap-target text-muted-foreground flex-shrink-0"
                        aria-label="編集"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
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
  favoriting,
  onFavorite,
  confirmLabel,
}: {
  food: Food;
  mealType: MealType;
  onMealType: (m: MealType) => void;
  onBack: () => void;
  saving: boolean;
  onSave: (f: Food) => void;
  favoriting?: boolean;
  onFavorite?: (f: Food) => void;
  confirmLabel?: string;
}) {
  const [faved, setFaved] = useState(false);
  const gramMode = !!food.per100;
  const [mult, setMult] = useState(1);
  const [grams, setGrams] = useState(food.defaultGrams ?? 100);
  // PFC手動修正: override が入っている間は分量計算より優先する。
  const [override, setOverride] = useState<{ calories: number; proteinG: number; fatG: number; carbsG: number } | null>(null);
  const [editingNut, setEditingNut] = useState(false);

  const portionScaled: Food = gramMode
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
  const scaled: Food = override ? { name: food.name, ...override } : portionScaled;
  const setM = (v: number) => { setOverride(null); setMult(Math.max(0.25, Math.round(v * 4) / 4)); };
  const setG = (v: number) => { setOverride(null); setGrams(Math.max(5, Math.min(2000, Math.round(v / 5) * 5))); };
  const startEditNut = () => {
    setOverride({
      calories: Math.round(portionScaled.calories),
      proteinG: Math.round(portionScaled.proteinG),
      fatG: Math.round(portionScaled.fatG),
      carbsG: Math.round(portionScaled.carbsG),
    });
    setEditingNut(true);
  };
  const setNut = (k: "calories" | "proteinG" | "fatG" | "carbsG", v: number) =>
    setOverride((o) => ({ ...(o ?? { calories: 0, proteinG: 0, fatG: 0, carbsG: 0 }), [k]: Math.max(0, v) }));

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border bg-card">
        <button onClick={onBack} className="tap-target -ml-1 text-muted-foreground">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="flex-1 text-center font-bold text-base text-foreground">フードを追加</div>
        {onFavorite && (
          <button
            onClick={async () => {
              if (faved || favoriting) return;
              await onFavorite(food);
              setFaved(true);
            }}
            disabled={favoriting || faved}
            className="tap-target px-1"
            aria-label="お気に入り登録"
            title="お気に入り（自分の食品）に登録"
          >
            <Star className="h-5 w-5" style={{ color: faved ? "oklch(0.78 0.16 75)" : "oklch(0.7 0.02 252)" }} fill={faved ? "oklch(0.78 0.16 75)" : "none"} />
          </button>
        )}
        <button onClick={() => onSave(scaled)} disabled={saving} className="text-sm font-bold px-2" style={{ color: BLUE }}>
          {saving ? "..." : confirmLabel ?? "記録"}
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

        {/* カロリー＆PFC（栄養を編集可能） */}
        <div className="rounded-xl px-4 py-5 bg-card border border-border text-center relative">
          <button
            onClick={() => (editingNut ? setEditingNut(false) : startEditNut())}
            className="absolute top-3 right-3 text-[11px] font-semibold flex items-center gap-1"
            style={{ color: BLUE }}
          >
            <Pencil className="h-3.5 w-3.5" /> {editingNut ? "完了" : "栄養を修正"}
          </button>
          {editingNut ? (
            <div className="space-y-3 pt-2">
              <div className="flex items-end justify-center gap-1">
                <input
                  type="number"
                  inputMode="numeric"
                  value={override?.calories ?? 0}
                  onChange={(e) => setNut("calories", Number(e.target.value) || 0)}
                  className="text-4xl font-bold text-foreground text-center bg-transparent outline-none w-28 border-b"
                  style={{ borderColor: "oklch(0.9 0.02 254)" }}
                />
                <span className="text-xs text-muted-foreground pb-1">kcal</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { l: "タンパク質", k: "proteinG", c: BLUE },
                  { l: "脂質", k: "fatG", c: "oklch(0.75 0.15 55)" },
                  { l: "炭水化物", k: "carbsG", c: "oklch(0.62 0.16 155)" },
                ] as const).map((x) => (
                  <div key={x.l}>
                    <div className="flex items-end justify-center gap-0.5">
                      <input
                        type="number"
                        inputMode="decimal"
                        value={override?.[x.k] ?? 0}
                        onChange={(e) => setNut(x.k, Number(e.target.value) || 0)}
                        className="text-lg font-bold text-center bg-transparent outline-none w-12 border-b"
                        style={{ color: x.c, borderColor: "oklch(0.9 0.02 254)" }}
                      />
                      <span className="text-xs text-muted-foreground">g</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{x.l}</div>
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-muted-foreground">数値を直接修正できます（分量を変えると元の計算に戻ります）</div>
            </div>
          ) : (
            <>
              <div className="text-4xl font-bold text-foreground">{Math.round(scaled.calories)}</div>
              <div className="text-xs text-muted-foreground mb-4">kcal{override ? "（修正済み）" : ""}</div>
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
            </>
          )}
        </div>

        <Button onClick={() => onSave(scaled)} disabled={saving} className="w-full h-12 font-bold rounded-xl" style={{ background: BLUE }}>
          {saving ? "..." : confirmLabel ? `Myミールに${confirmLabel}` : `${MEAL_TYPE_LABELS[mealType]}に記録する`}
        </Button>
      </div>
    </div>
  );
}

/* ── 自分で食品を作成／編集（My Foods） ── */
function CreateFoodForm({
  initialName,
  initial,
  saving,
  onBack,
  onCreate,
  onDelete,
}: {
  initialName: string;
  initial?: { name: string; servingLabel: string; calories: number; proteinG: number; fatG: number; carbsG: number };
  saving: boolean;
  onBack: () => void;
  onCreate: (vals: {
    name: string;
    servingLabel: string;
    calories: number;
    proteinG: number;
    fatG: number;
    carbsG: number;
  }) => void;
  onDelete?: () => void;
}) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? initialName);
  const [serving, setServing] = useState(initial?.servingLabel ?? "1食");
  const [kcal, setKcal] = useState(initial ? String(initial.calories) : "");
  const [p, setP] = useState(initial ? String(initial.proteinG) : "");
  const [f, setF] = useState(initial ? String(initial.fatG) : "");
  const [c, setC] = useState(initial ? String(initial.carbsG) : "");

  const canSave = name.trim().length > 0 && Number(kcal) >= 0 && kcal !== "";

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border bg-card">
        <button onClick={onBack} className="tap-target -ml-1 text-muted-foreground">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="flex-1 text-center font-bold text-base text-foreground">{isEdit ? "食品を編集" : "食品を作成"}</div>
        <button
          onClick={() =>
            onCreate({
              name: name.trim(),
              servingLabel: serving.trim() || "1食",
              calories: Number(kcal) || 0,
              proteinG: Number(p) || 0,
              fatG: Number(f) || 0,
              carbsG: Number(c) || 0,
            })
          }
          disabled={!canSave || saving}
          className="text-sm font-bold px-2 disabled:opacity-40"
          style={{ color: BLUE }}
        >
          {saving ? "..." : "保存"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <Field label="食品名">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：自家製プロテインバー" className="h-11" autoFocus />
        </Field>
        <Field label="1食の単位（分量の呼び方）">
          <Input value={serving} onChange={(e) => setServing(e.target.value)} placeholder="例：1個 / 100g / 1杯" className="h-11" />
        </Field>
        <div className="rounded-xl px-4 py-3 bg-card border border-border">
          <div className="text-xs text-muted-foreground mb-2">この1食あたりの栄養成分</div>
          <Field label="カロリー (kcal)">
            <Input inputMode="numeric" type="number" value={kcal} onChange={(e) => setKcal(e.target.value)} className="h-11" />
          </Field>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <Field label="P (g)">
              <Input inputMode="decimal" type="number" value={p} onChange={(e) => setP(e.target.value)} className="h-11" />
            </Field>
            <Field label="F (g)">
              <Input inputMode="decimal" type="number" value={f} onChange={(e) => setF(e.target.value)} className="h-11" />
            </Field>
            <Field label="C (g)">
              <Input inputMode="decimal" type="number" value={c} onChange={(e) => setC(e.target.value)} className="h-11" />
            </Field>
          </div>
        </div>
        <Button
          onClick={() =>
            onCreate({
              name: name.trim(),
              servingLabel: serving.trim() || "1食",
              calories: Number(kcal) || 0,
              proteinG: Number(p) || 0,
              fatG: Number(f) || 0,
              carbsG: Number(c) || 0,
            })
          }
          disabled={!canSave || saving}
          className="w-full h-12 font-bold rounded-xl"
          style={{ background: BLUE }}
        >
          {saving ? "保存中..." : isEdit ? "保存する" : "保存して記録へ"}
        </Button>
        {isEdit && onDelete && (
          <button onClick={onDelete} disabled={saving} className="w-full text-center text-sm text-destructive py-2">
            この食品を削除
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

/* ── Myミール（パッケージ）ビルダー：複数食品を分量調整して1つに保存・編集 ── */
function MealBuilder({
  date,
  initialMealType,
  initial,
  saving,
  onClose,
  onSave,
  onDelete,
}: {
  date: string;
  initialMealType: MealType;
  initial: { id?: number; name: string; items: Food[] };
  saving: boolean;
  onClose: () => void;
  onSave: (name: string, items: Food[], id?: number) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial.name);
  // 各要素は base(基準値) × qty(数量) で調整可能にする。
  const [items, setItems] = useState<{ base: Food; qty: number }[]>(
    initial.items.map((f) => ({ base: f, qty: 1 }))
  );
  const [picking, setPicking] = useState(false);

  const scaledItems: Food[] = items.map(({ base, qty }) => ({
    name: base.name,
    calories: base.calories * qty,
    proteinG: base.proteinG * qty,
    fatG: base.fatG * qty,
    carbsG: base.carbsG * qty,
  }));
  const total = scaledItems.reduce(
    (a, f) => ({ kcal: a.kcal + f.calories, p: a.p + f.proteinG, fat: a.fat + f.fatG, c: a.c + f.carbsG }),
    { kcal: 0, p: 0, fat: 0, c: 0 }
  );
  const setQty = (i: number, q: number) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, qty: Math.max(0.5, Math.round(q * 2) / 2) } : it)));
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  if (picking) {
    return (
      <FoodSearch
        date={date}
        initialMealType={initialMealType}
        pickTitle="ミールに追加する食品"
        onClose={() => setPicking(false)}
        onPick={(f) => {
          setItems((prev) => [...prev, { base: f, qty: 1 }]);
          setPicking(false);
        }}
      />
    );
  }

  const canSave = name.trim().length > 0 && items.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border bg-card">
        <button onClick={onClose} className="tap-target -ml-1 text-muted-foreground">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="flex-1 text-center font-bold text-base text-foreground">
          {initial.id ? "Myミールを編集" : "Myミールを作成"}
        </div>
        <button
          onClick={() => onSave(name.trim(), scaledItems.map((f) => ({
            name: f.name,
            calories: Math.round(f.calories),
            proteinG: Math.round(f.proteinG),
            fatG: Math.round(f.fatG),
            carbsG: Math.round(f.carbsG),
          })), initial.id)}
          disabled={!canSave || saving}
          className="text-sm font-bold px-2 disabled:opacity-40"
          style={{ color: BLUE }}
        >
          {saving ? "..." : "保存"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* ミール名 */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">ミール名</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：いつもの朝ごはん" className="h-11" autoFocus={!initial.id} />
        </div>

        {/* 合計 */}
        <div className="rounded-xl px-4 py-3 bg-card border border-border flex items-center justify-between">
          <span className="text-sm text-muted-foreground">合計</span>
          <span className="text-sm font-bold text-foreground">
            {Math.round(total.kcal)}kcal
            <span className="text-muted-foreground font-normal ml-2">P{Math.round(total.p)} / F{Math.round(total.fat)} / C{Math.round(total.c)}</span>
          </span>
        </div>

        {/* 中身 */}
        <div className="space-y-2">
          {items.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">「食品を追加」で中身を組み立てます</div>
          ) : (
            items.map((it, i) => (
              <div key={i} className="rounded-xl px-3 py-3 bg-card border border-border">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{it.base.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {Math.round(it.base.calories * it.qty)}kcal · P{Math.round(it.base.proteinG * it.qty)} / F{Math.round(it.base.fatG * it.qty)} / C{Math.round(it.base.carbsG * it.qty)}
                    </div>
                  </div>
                  <button onClick={() => removeItem(i)} className="tap-target text-muted-foreground flex-shrink-0" aria-label="削除">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[11px] text-muted-foreground">数量</span>
                  <button onClick={() => setQty(i, it.qty - 0.5)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "oklch(0.95 0.01 254)", color: BLUE }}>
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-sm font-bold text-foreground w-8 text-center tabular-nums">{it.qty}</span>
                  <button onClick={() => setQty(i, it.qty + 0.5)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "oklch(0.95 0.01 254)", color: BLUE }}>
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 食品を追加 */}
        <button
          onClick={() => setPicking(true)}
          className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
          style={{ background: "oklch(0.95 0.02 254)", color: BLUE }}
        >
          <Plus className="h-4 w-4" /> 食品を追加
        </button>

        {initial.id && onDelete && (
          <button onClick={onDelete} disabled={saving} className="w-full text-center text-sm text-destructive py-2">
            このMyミールを削除
          </button>
        )}
      </div>
    </div>
  );
}
