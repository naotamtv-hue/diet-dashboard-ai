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
import { trpc } from "@/lib/trpc";
import { mealMotivation } from "@/lib/motivation";
import { Camera, Loader2, Pencil, Plus, Search, ShoppingBag, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const CARD = {
  background: "oklch(0.20 0.05 240)",
  border: "1px solid oklch(0.30 0.04 240)",
} as const;

const INNER = {
  background: "oklch(0.24 0.04 240)",
  border: "1px solid oklch(0.30 0.04 240)",
} as const;

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
        style={{ background: "oklch(0.20 0.05 240)", border: "1px solid oklch(0.30 0.04 240)" }}
      >
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border flex-shrink-0">
          <DialogTitle className="text-lg font-bold text-white">
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
                    <ShoppingBag className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "oklch(0.62 0.18 220)" }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white leading-snug">{item.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {item.chain === "seven" ? "セブン-イレブン" : item.chain === "familymart" ? "ファミリーマート" : "ローソン"}
                        {item.priceYen ? ` · ¥${item.priceYen}` : ""}
                      </div>
                      <div className="text-xs mt-1 font-semibold" style={{ color: "oklch(0.62 0.18 220)" }}>
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
  const fileRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const listQ = trpc.meals.listByDate.useQuery({ date });
  const summaryQ = trpc.meals.summary.useQuery({ date });
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
      {/* Page Header */}
      <div className="pt-1">
        <div className="section-label mb-1">MEALS</div>
        <h1 className="text-2xl font-bold text-white">食事を記録</h1>
      </div>

      {/* 入力フォーム */}
      <div className="rounded-xl px-4 py-4 space-y-4" style={CARD}>
        {/* 日付・区分 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="section-label">日付</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11" />
          </div>
          <div className="space-y-2">
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
        </div>

        {/* 入力方法ボタン群（アイコン上・ラベル下で文字切れを防止） */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPickPhoto(f);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full h-auto py-3 flex flex-col items-center gap-1.5 font-semibold text-sm rounded-xl"
              disabled={analyzing}
              onClick={() => fileRef.current?.click()}
            >
              {analyzing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Camera className="h-5 w-5" />
              )}
              <span>{analyzing ? "AI解析中..." : "写真で解析"}</span>
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full h-auto py-3 flex flex-col items-center gap-1.5 font-semibold text-sm rounded-xl"
            onClick={() => setConvenienceOpen(true)}
          >
            <ShoppingBag className="h-5 w-5" />
            <span>コンビニから選ぶ</span>
          </Button>
        </div>

        {/* 食べ物・商品名でAI検索 */}
        <div className="space-y-1.5">
          <Label className="section-label">名前で検索（AI推定）</Label>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="例：唐揚げ3個 / セブンのおにぎり 鮭"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSearchByName();
                }
              }}
              className="h-11 flex-1"
            />
            <Button
              type="button"
              className="h-11 px-4 gap-1.5 font-semibold rounded-xl flex-shrink-0"
              style={{ background: "oklch(0.62 0.18 220)" }}
              disabled={estimateM.isPending || !nameQuery.trim()}
              onClick={onSearchByName}
            >
              {estimateM.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              検索
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            写真がなくても、食べ物やコンビニ商品の名前からおおよそのカロリー・PFCを自動入力します。
          </p>
        </div>

        {/* よく食べる物 ／ 昨日と同じ */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="section-label">よく食べる物</Label>
            <button
              type="button"
              className="text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
              style={{ color: "oklch(0.62 0.18 220)" }}
              disabled={copyM.isPending}
              onClick={() => copyM.mutate({ fromDate: yesterdayStr, toDate: date })}
            >
              <Plus className="h-3.5 w-3.5" /> 昨日と同じ
            </button>
          </div>
          {frequentQ.data && frequentQ.data.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {frequentQ.data.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => onSelectFrequent(item)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                  style={{ background: "oklch(0.24 0.04 240)", border: "1px solid oklch(0.30 0.04 240)" }}
                >
                  <span className="text-white">{item.name}</span>
                  <span className="text-muted-foreground ml-1.5">{item.calories}kcal</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              記録を重ねると、よく食べる物がここに並んでワンタップ入力できます。
            </p>
          )}
        </div>

        {imageUrl && (
          <div className="rounded-xl overflow-hidden border border-border">
            <img src={imageUrl} alt="食事" className="w-full max-h-52 object-cover" />
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="section-label">内容（任意）</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例：鶏むね肉のサラダと玄米ごはん"
            rows={2}
            className="resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumField label="カロリー (kcal)" value={calories} onChange={setCalories} />
          <NumField label="タンパク質 (g)" value={proteinG} onChange={setProteinG} />
          <NumField label="脂質 (g)" value={fatG} onChange={setFatG} />
          <NumField label="炭水化物 (g)" value={carbsG} onChange={setCarbsG} />
        </div>

        <Button
          onClick={submit}
          disabled={addM.isPending}
          className="w-full h-12 font-bold text-sm rounded-xl"
        >
          {addM.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          記録する
        </Button>

        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          写真から推定される値は目安です。必要に応じて編集してください。
        </div>
      </div>

      {/* 選択日の合計 */}
      <div className="rounded-xl px-4 py-4" style={CARD}>
        <div className="section-label mb-3">選択日の合計</div>
        <div className="flex items-end gap-4">
          <div>
            <div className="text-3xl font-bold text-white leading-none">
              {Math.round(summaryQ.data?.calories ?? 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">kcal</div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs flex-1 pb-0.5">
            <MacroStat label="タンパク質" value={Math.round(summaryQ.data?.proteinG ?? 0)} color="oklch(0.62 0.18 220)" />
            <MacroStat label="脂質" value={Math.round(summaryQ.data?.fatG ?? 0)} color="oklch(0.75 0.18 55)" />
            <MacroStat label="炭水化物" value={Math.round(summaryQ.data?.carbsG ?? 0)} color="oklch(0.72 0.18 155)" />
          </div>
        </div>
      </div>

      {/* 区分別リスト */}
      {MEAL_TYPES.map((t) => {
        const list = (listQ.data ?? []).filter((m) => m.mealType === t);
        const kcal = list.reduce((a, m) => a + Number(m.calories), 0);
        return (
          <div key={t} className="rounded-xl px-4 py-4" style={CARD}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-base font-bold text-white">{MEAL_TYPE_LABELS[t]}</div>
              <div className="text-xs font-semibold" style={{ color: "oklch(0.62 0.18 220)" }}>
                {Math.round(kcal)} kcal · {list.length}件
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
                      <div className="text-sm font-semibold text-white truncate">
                        {m.description || "（内容未入力）"}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {Math.round(Number(m.calories))}kcal · P{Math.round(Number(m.proteinG))} /
                        F{Math.round(Number(m.fatG))} / C{Math.round(Number(m.carbsG))}
                      </div>
                    </div>
                    <button
                      className="tap-target text-muted-foreground hover:text-white rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
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
          </div>
        );
      })}

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
            <NumField label="カロリー (KCAL)" value={calories} onChange={setCalories} />
            <NumField label="タンパク質 (G)" value={proteinG} onChange={setProteinG} />
            <NumField label="脂質 (G)" value={fatG} onChange={setFatG} />
            <NumField label="炭水化物 (G)" value={carbsG} onChange={setCarbsG} />
          </div>
          <Button
            className="w-full h-12 font-bold rounded-xl"
            style={{ background: "oklch(0.62 0.18 220)" }}
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

function MacroStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-0.5">
      <div className="section-label">{label}</div>
      <div className="text-sm font-bold" style={{ color }}>{value}g</div>
    </div>
  );
}
