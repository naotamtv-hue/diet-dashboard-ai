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
import { Camera, Loader2, Plus, Search, ShoppingBag, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const GLASS = {
  background: "oklch(1 0 0 / 0.72)",
  border: "1px solid oklch(1 0 0 / 0.78)",
  backdropFilter: "blur(20px) saturate(1.4)",
  WebkitBackdropFilter: "blur(20px) saturate(1.4)",
  boxShadow: "0 1px 2px oklch(0.35 0.08 290 / 0.04), 0 4px 12px oklch(0.35 0.08 290 / 0.06), inset 0 1px 0 oklch(1 0 0 / 0.9)",
} as const;

type Analysis = {
  description: string;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  confidence: "low" | "medium" | "high";
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
      <DialogContent className="max-w-lg w-full max-h-[85vh] flex flex-col gap-0 p-0 rounded-2xl overflow-hidden"
        style={{ background: "oklch(0.98 0.01 290)", border: "1px solid oklch(0.9 0.02 290 / 0.5)" }}>
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/30 flex-shrink-0">
          <DialogTitle className="font-display text-lg" style={{ color: "oklch(0.32 0.09 290)" }}>
            コンビニ商品から選ぶ
          </DialogTitle>
        </DialogHeader>

        {/* 検索フィルター */}
        <div className="px-5 py-3 space-y-2.5 flex-shrink-0 border-b border-border/20">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="商品名で検索..."
                className="pl-8 h-9 text-sm"
                autoFocus
              />
            </div>
            <Select value={chain} onValueChange={(v) => setChain(v as typeof chain)}>
              <SelectTrigger className="w-36 h-9 text-sm flex-shrink-0">
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
          <div className="page-label">{items.length} 件</div>
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
                  className="w-full text-left rounded-xl px-4 py-3 transition-all hover:shadow-sm active:scale-[0.99]"
                  style={{
                    background: "oklch(1 0 0 / 0.75)",
                    border: "1px solid oklch(0.9 0.02 290 / 0.4)",
                  }}
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
                    <ShoppingBag className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "oklch(0.55 0.1 290)" }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground leading-snug">{item.name}</div>
                      <div className="text-[10px] tracking-wider-jp text-muted-foreground mt-0.5">
                        {item.chain === "seven" ? "セブン-イレブン" : item.chain === "familymart" ? "ファミリーマート" : "ローソン"}
                        {item.priceYen ? ` · ¥${item.priceYen}` : ""}
                      </div>
                      <div className="text-xs mt-1 font-semibold" style={{ color: "oklch(0.35 0.08 290)" }}>
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
  const fileRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const listQ = trpc.meals.listByDate.useQuery({ date });
  const summaryQ = trpc.meals.summary.useQuery({ date });

  const analyzeM = trpc.meals.analyzePhoto.useMutation();
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
    toast.success("記録しました");
  };

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Page Header — mb-6 でフォームとの余白を確保 */}
      <div className="pt-1 mb-6">
        <div className="page-label mb-1.5">MEALS</div>
        <h1 className="font-display" style={{ fontSize: "clamp(1.75rem,5vw,2.5rem)", color: "oklch(0.32 0.09 290)" }}>
          食事を記録
        </h1>
      </div>

      {/* 入力フォーム */}
      <div className="rounded-2xl px-5 py-5 space-y-4" style={GLASS}>
        {/* 日付・区分 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="page-label">日付</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="page-label">区分</Label>
            <Select value={mealType} onValueChange={(v) => setMealType(v as typeof mealType)}>
              <SelectTrigger className="w-full">
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

        {/* 入力方法ボタン群 */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* 写真AI解析 */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
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
              className="w-full rounded-xl h-12 gap-2 font-medium text-xs"
              disabled={analyzing}
              onClick={() => fileRef.current?.click()}
            >
              {analyzing ? (
                <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
              ) : (
                <Camera className="h-4 w-4 flex-shrink-0" />
              )}
              <span className="truncate">{analyzing ? "AI解析中..." : "写真からAI解析"}</span>
            </Button>
          </div>

          {/* コンビニ商品から入力 */}
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl h-12 gap-2 font-medium text-xs"
            onClick={() => setConvenienceOpen(true)}
          >
            <ShoppingBag className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">コンビニ商品から入力</span>
          </Button>
        </div>

        {imageUrl && (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid oklch(0.9 0.02 290 / 0.4)" }}>
            <img src={imageUrl} alt="食事" className="w-full max-h-56 object-cover" />
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="page-label">内容（任意）</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例：鶏むね肉のサラダと玄米ごはん"
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumField label="カロリー (kcal)" value={calories} onChange={setCalories} />
          <NumField label="タンパク質 (g)" value={proteinG} onChange={setProteinG} />
          <NumField label="脂質 (g)" value={fatG} onChange={setFatG} />
          <NumField label="炭水化物 (g)" value={carbsG} onChange={setCarbsG} />
        </div>

        <Button onClick={submit} disabled={addM.isPending} className="w-full rounded-xl h-11 font-medium">
          {addM.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          記録する
        </Button>

        <div className="text-[10px] tracking-wider-jp text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          写真から推定される値は目安です。必要に応じて編集してください。
        </div>
      </div>

      {/* 選択日の合計 */}
      <div className="rounded-2xl px-5 py-4" style={GLASS}>
        <div className="page-label mb-2">選択日の合計</div>
        <div className="flex items-end gap-4">
          <div>
            <div className="font-display leading-none" style={{ fontSize: "2.5rem", color: "oklch(0.35 0.08 290)" }}>
              {Math.round(summaryQ.data?.calories ?? 0)}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">kcal</div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs flex-1 pb-1">
            <div className="space-y-0.5">
              <div className="page-label">タンパク質</div>
              <div className="font-semibold" style={{ color: "oklch(0.35 0.08 290)" }}>{Math.round(summaryQ.data?.proteinG ?? 0)}g</div>
            </div>
            <div className="space-y-0.5">
              <div className="page-label">脂質</div>
              <div className="font-semibold" style={{ color: "oklch(0.35 0.08 290)" }}>{Math.round(summaryQ.data?.fatG ?? 0)}g</div>
            </div>
            <div className="space-y-0.5">
              <div className="page-label">炭水化物</div>
              <div className="font-semibold" style={{ color: "oklch(0.35 0.08 290)" }}>{Math.round(summaryQ.data?.carbsG ?? 0)}g</div>
            </div>
          </div>
        </div>
      </div>

      {/* 区分別リスト */}
      {MEAL_TYPES.map((t) => {
        const list = (listQ.data ?? []).filter((m) => m.mealType === t);
        const kcal = list.reduce((a, m) => a + Number(m.calories), 0);
        return (
          <div key={t} className="rounded-2xl px-5 py-4" style={GLASS}>
            <div className="flex items-center justify-between mb-3">
              <div className="font-display text-lg" style={{ color: "oklch(0.35 0.08 290)" }}>
                {MEAL_TYPE_LABELS[t]}
              </div>
              <div className="page-label">{Math.round(kcal)} kcal · {list.length}件</div>
            </div>
            {list.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2">記録なし</div>
            ) : (
              <div className="space-y-2">
                {list.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                    style={{
                      background: "oklch(0.97 0.015 290 / 0.55)",
                      border: "1px solid oklch(0.9 0.02 290 / 0.4)",
                    }}
                  >
                    {m.imageUrl && (
                      <img src={m.imageUrl} alt="" className="w-11 h-11 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground truncate font-medium">
                        {m.description || "（内容未入力）"}
                      </div>
                      <div className="text-[10px] tracking-wider-jp text-muted-foreground mt-0.5">
                        {Math.round(Number(m.calories))}kcal · P{Math.round(Number(m.proteinG))} /
                        F{Math.round(Number(m.fatG))} / C{Math.round(Number(m.carbsG))}
                      </div>
                    </div>
                    <button
                      className="text-muted-foreground hover:text-destructive p-1.5 rounded-lg hover:bg-destructive/8 transition-colors flex-shrink-0"
                      onClick={() => removeM.mutate({ id: m.id })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="page-label">{label}</Label>
      <Input inputMode="decimal" type="number" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
