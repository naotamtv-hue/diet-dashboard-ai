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

const GLASS = {
  background: "oklch(1 0 0 / 0.72)",
  border: "1px solid oklch(1 0 0 / 0.78)",
  backdropFilter: "blur(20px) saturate(1.4)",
  WebkitBackdropFilter: "blur(20px) saturate(1.4)",
  boxShadow: "0 1px 2px oklch(0.35 0.08 290 / 0.04), 0 4px 12px oklch(0.35 0.08 290 / 0.06), inset 0 1px 0 oklch(1 0 0 / 0.9)",
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
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Page Header */}
      <div className="pt-1">
        <div className="page-label mb-1.5">CONVENIENCE</div>
        <h1 className="font-display" style={{ fontSize: "clamp(1.75rem,5vw,2.5rem)", color: "oklch(0.32 0.09 290)" }}>
          コンビニ提案
        </h1>
      </div>

      {/* AI提案 */}
      <div className="rounded-2xl px-5 py-5 space-y-4" style={GLASS}>
        <div className="flex items-center gap-1.5 page-label">
          <Sparkles className="h-3 w-3" />
          AIにおすすめの組み合わせを提案してもらう
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="page-label">残り摂取kcal</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={remainKcal}
              onChange={(e) => setRemainKcal(e.target.value)}
              placeholder={`${defaultRemain}`}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="page-label">優先コンビニ</Label>
            <Select
              value={preferredChain}
              onValueChange={(v) => setPreferredChain(v as typeof preferredChain)}
            >
              <SelectTrigger className="w-full">
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
          style={{ background: "oklch(0.97 0.015 290 / 0.55)", border: "1px solid oklch(0.9 0.02 290 / 0.4)" }}
        >
          <div>
            <div className="text-sm font-medium text-foreground">タンパク質重視</div>
            <div className="page-label mt-0.5">合計タンパク質25g以上を狙う</div>
          </div>
          <Switch checked={proteinFocus} onCheckedChange={setProteinFocus} />
        </div>

        <Button
          onClick={onSuggest}
          disabled={suggestM.isPending}
          className="w-full rounded-xl h-11 font-medium"
        >
          {suggestM.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          AIに提案してもらう
        </Button>

        {combo && (
          <div
            className="rounded-xl px-4 py-4 space-y-3"
            style={{ background: "oklch(0.97 0.015 290 / 0.55)", border: "1px solid oklch(0.9 0.02 290 / 0.4)" }}
          >
            <div className="page-label">提案された組み合わせ</div>
            <div className="space-y-1.5">
              {combo.items.map((it) => (
                <div key={it.id} className="flex items-center gap-2 text-sm text-foreground">
                  <ShoppingBag className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "oklch(0.55 0.1 290)" }} />
                  <span className="text-[10px] tracking-wider-jp text-muted-foreground flex-shrink-0">
                    [{CHAIN_LABELS[it.chain] ?? it.chain}]
                  </span>
                  <span>{it.name}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2">
              <MiniStat label="合計" value={`${combo.totals.calories}`} unit="kcal" />
              <MiniStat label="P" value={`${combo.totals.proteinG}`} unit="g" />
              <MiniStat label="F" value={`${combo.totals.fatG}`} unit="g" />
              <MiniStat label="C" value={`${combo.totals.carbsG}`} unit="g" />
            </div>
            {combo.comment && (
              <p className="text-xs text-foreground/80 leading-relaxed">{combo.comment}</p>
            )}
          </div>
        )}
      </div>

      {/* 検索 */}
      <div className="rounded-2xl px-5 py-5 space-y-4" style={GLASS}>
        <div className="flex items-center gap-1.5 page-label">
          <Search className="h-3 w-3" />
          コンビニ商品を検索
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="page-label">コンビニ</Label>
            <Select value={chain} onValueChange={(v) => setChain(v as Chain | "all")}>
              <SelectTrigger className="w-full">
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
          <div className="space-y-1.5">
            <Label className="page-label">カテゴリ</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category | "all")}>
              <SelectTrigger className="w-full">
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
          <div className="space-y-1.5">
            <Label className="page-label">キーワード</Label>
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="サラダチキン など"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="page-label">上限kcal</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={maxKcal}
              onChange={(e) => setMaxKcal(e.target.value)}
            />
          </div>
        </div>

        <div className="page-label">{(searchQ.data ?? []).length} 件</div>

        <div className="space-y-2">
          {(searchQ.data ?? []).map((it) => (
            <div
              key={it.id}
              className="rounded-xl px-4 py-3"
              style={{ background: "oklch(0.97 0.015 290 / 0.55)", border: "1px solid oklch(0.9 0.02 290 / 0.4)" }}
            >
              <div className="flex items-start gap-2">
                <ShoppingBag className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "oklch(0.55 0.1 290)" }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{it.name}</div>
                  <div className="page-label mt-0.5">
                    [{CHAIN_LABELS[it.chain] ?? it.chain}] · {CATEGORY_LABELS[it.category] ?? it.category}
                  </div>
                  <div className="text-xs mt-1 text-foreground/90">
                    <strong>{Number(it.calories)}kcal</strong>
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

function MiniStat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div
      className="rounded-lg px-2 py-2 text-center"
      style={{ background: "oklch(0.93 0.06 290 / 0.25)", border: "1px solid oklch(0.85 0.06 290 / 0.3)" }}
    >
      <div className="text-[10px] tracking-wider-jp text-muted-foreground">{label}</div>
      <div className="font-display text-base leading-none mt-0.5" style={{ color: "oklch(0.35 0.08 290)" }}>
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground">{unit}</div>
    </div>
  );
}
