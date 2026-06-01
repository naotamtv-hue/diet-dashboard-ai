import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CATEGORY_LABELS, CHAIN_LABELS, todayDateString } from "@/lib/labels";
import { trpc } from "@/lib/trpc";
import { Loader2, Search, ShoppingBag, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Chain = "seven" | "familymart" | "lawson";
type Category =
  | "bento"
  | "onigiri"
  | "bread"
  | "salad"
  | "noodle"
  | "hotsnack"
  | "drink"
  | "dessert"
  | "sideDish"
  | "proteinSnack";

const CARD = {
  background: "oklch(1 0 0)",
  border: "1px solid oklch(0.92 0.006 250)",
} as const;

const INNER = {
  background: "oklch(0.965 0.004 250)",
  border: "1px solid oklch(0.92 0.006 250)",
} as const;

export default function Convenience() {
  const [chain, setChain] = useState<Chain | "all">("all");
  const [category, setCategory] = useState<Category | "all">("all");
  const [keyword, setKeyword] = useState("");
  const [maxKcal, setMaxKcal] = useState("");

  const searchInput = useMemo(
    () => ({
      chain: chain === "all" ? undefined : chain,
      category: category === "all" ? undefined : category,
      keyword: keyword.trim() || undefined,
      maxKcal: maxKcal ? Number(maxKcal) : undefined,
    }),
    [chain, category, keyword, maxKcal]
  );

  const searchQ = trpc.convenience.search.useQuery(searchInput);

  const [today] = useState(todayDateString());
  const goalQ = trpc.goals.get.useQuery();
  const summaryQ = trpc.meals.summary.useQuery({ date: today });
  const target = Number(goalQ.data?.targetCalories ?? 0);
  const consumed = Number(summaryQ.data?.calories ?? 0);
  const defaultRemain = Math.max(200, Math.round(target - consumed));

  const [remainKcal, setRemainKcal] = useState("");
  const [proteinFocus, setProteinFocus] = useState(true);
  const [preferredChain, setPreferredChain] = useState<Chain | "any">("any");

  const suggestM = trpc.convenience.suggestCombo.useMutation();

  const onSuggest = async () => {
    const v = Number(remainKcal) || defaultRemain;
    if (v < 100) {
      toast.error("100kcal以上で指定してください");
      return;
    }
    try {
      await suggestM.mutateAsync({
        remainingCalories: v,
        proteinFocus,
        preferredChain,
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "提案に失敗しました");
    }
  };

  const combo = suggestM.data;

  return (
    <div className="space-y-4 pb-4">
      {/* Page Header */}
      <div className="pt-1">
        <div className="section-label mb-1">CONVENIENCE</div>
        <h1 className="text-2xl font-bold text-slate-900">コンビニ提案</h1>
      </div>

      {/* AI提案 */}
      <div className="rounded-xl px-4 py-4 space-y-4" style={CARD}>
        <div className="flex items-center gap-2 section-label">
          <Sparkles className="h-3.5 w-3.5" />
          AIにおすすめの組み合わせを提案してもらう
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="section-label">残り摂取kcal</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={remainKcal}
              onChange={(e) => setRemainKcal(e.target.value)}
              placeholder={`${defaultRemain}`}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label className="section-label">優先コンビニ</Label>
            <Select
              value={preferredChain}
              onValueChange={(v) => setPreferredChain(v as typeof preferredChain)}
            >
              <SelectTrigger className="w-full h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">指定なし</SelectItem>
                <SelectItem value="seven">セブン-イレブン</SelectItem>
                <SelectItem value="familymart">ファミリーマート</SelectItem>
                <SelectItem value="lawson">ローソン</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div
          className="flex items-center justify-between rounded-xl px-4 py-3"
          style={INNER}
        >
          <div>
            <div className="text-sm font-semibold text-slate-900">タンパク質重視</div>
            <div className="section-label mt-0.5">合計タンパク質25g以上を狙う</div>
          </div>
          <Switch checked={proteinFocus} onCheckedChange={setProteinFocus} />
        </div>

        <Button
          onClick={onSuggest}
          disabled={suggestM.isPending}
          className="w-full h-12 font-bold rounded-xl"
        >
          {suggestM.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          AIに提案してもらう
        </Button>

        {combo && (
          <div className="rounded-xl px-4 py-4 space-y-3" style={INNER}>
            <div className="section-label">提案された組み合わせ</div>
            <div className="space-y-2">
              {combo.items.map((it) => (
                <div key={it.id} className="flex items-center gap-2 text-sm text-foreground">
                  <ShoppingBag className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "oklch(0.58 0.19 254)" }} />
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    [{CHAIN_LABELS[it.chain] ?? it.chain}]
                  </span>
                  <span className="text-slate-900">{it.name}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2">
              <MiniStat label="合計" value={`${combo.totals.calories}`} unit="kcal" accent />
              <MiniStat label="P" value={`${combo.totals.proteinG}`} unit="g" />
              <MiniStat label="F" value={`${combo.totals.fatG}`} unit="g" />
              <MiniStat label="C" value={`${combo.totals.carbsG}`} unit="g" />
            </div>
            {combo.comment && (
              <p className="text-xs text-muted-foreground leading-relaxed">{combo.comment}</p>
            )}
          </div>
        )}
      </div>

      {/* 検索 */}
      <div className="rounded-xl px-4 py-4 space-y-4" style={CARD}>
        <div className="flex items-center gap-2 section-label">
          <Search className="h-3.5 w-3.5" />
          コンビニ商品を検索
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="section-label">コンビニ</Label>
            <Select value={chain} onValueChange={(v) => setChain(v as Chain | "all")}>
              <SelectTrigger className="w-full h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="seven">セブン-イレブン</SelectItem>
                <SelectItem value="familymart">ファミリーマート</SelectItem>
                <SelectItem value="lawson">ローソン</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="section-label">カテゴリ</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category | "all")}>
              <SelectTrigger className="w-full h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="section-label">キーワード</Label>
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="サラダチキン など"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label className="section-label">上限kcal</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={maxKcal}
              onChange={(e) => setMaxKcal(e.target.value)}
              className="h-11"
            />
          </div>
        </div>

        <div className="section-label">{(searchQ.data ?? []).length} 件</div>

        <div className="space-y-2">
          {(searchQ.data ?? []).map((it) => (
            <div key={it.id} className="rounded-xl px-4 py-3" style={INNER}>
              <div className="flex items-start gap-2">
                <ShoppingBag className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "oklch(0.58 0.19 254)" }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{it.name}</div>
                  <div className="section-label mt-0.5">
                    [{CHAIN_LABELS[it.chain] ?? it.chain}] · {CATEGORY_LABELS[it.category] ?? it.category}
                  </div>
                  <div className="text-xs mt-1">
                    <strong style={{ color: "oklch(0.58 0.19 254)" }}>{Number(it.calories)}kcal</strong>
                    <span className="text-muted-foreground ml-1.5">
                      P{Number(it.proteinG)} / F{Number(it.fatG)} / C{Number(it.carbsG)}
                      {it.priceYen ? ` · ¥${it.priceYen}` : ""}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: boolean }) {
  return (
    <div
      className="rounded-lg px-2 py-2 text-center"
      style={{
        background: accent ? "oklch(0.58 0.19 254 / 0.1)" : "oklch(0.92 0.006 250)",
        border: `1px solid ${accent ? "oklch(0.58 0.19 254 / 0.14)" : "oklch(0.92 0.006 250)"}`,
      }}
    >
      <div className="text-[10px] font-medium text-muted-foreground">{label}</div>
      <div
        className="text-base font-bold leading-none mt-0.5"
        style={{ color: accent ? "oklch(0.58 0.19 254)" : "oklch(0.24 0.03 252)" }}
      >
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground">{unit}</div>
    </div>
  );
}
