import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Loader2, ShoppingBag, Sparkles, Search } from "lucide-react";
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

  // AI提案
  const [today] = useState(todayDateString);
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
    <div className="space-y-5">
      <div>
        <div className="text-[11px] tracking-wider-jp text-muted-foreground">CONVENIENCE</div>
        <h1 className="font-display text-3xl text-primary mt-1">コンビニ提案</h1>
      </div>

      {/* AI提案 */}
      <Card className="p-4 bg-white/70 border-white/70 backdrop-blur-sm space-y-3">
        <div className="flex items-center gap-2 text-[11px] tracking-wider-jp text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          AIにおすすめの組み合わせを提案してもらう
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[11px] tracking-wider-jp">
              残り摂取kcal
            </Label>
            <Input
              type="number"
              inputMode="numeric"
              value={remainKcal}
              onChange={(e) => setRemainKcal(e.target.value)}
              placeholder={`${defaultRemain}`}
              className="bg-white/70"
            />
          </div>
          <div>
            <Label className="text-[11px] tracking-wider-jp">優先コンビニ</Label>
            <Select
              value={preferredChain}
              onValueChange={(v) => setPreferredChain(v as typeof preferredChain)}
            >
              <SelectTrigger className="bg-white/70">
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
        <div className="flex items-center justify-between rounded-2xl bg-white/50 border border-white/70 px-3 py-2.5">
          <div>
            <div className="text-sm text-foreground">タンパク質重視</div>
            <div className="text-[10px] tracking-wider-jp text-muted-foreground">
              合計タンパク質25g以上を狙う
            </div>
          </div>
          <Switch checked={proteinFocus} onCheckedChange={setProteinFocus} />
        </div>
        <Button onClick={onSuggest} disabled={suggestM.isPending} className="w-full rounded-full">
          {suggestM.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          AIに提案してもらう
        </Button>

        {combo && (
          <div className="mt-2 rounded-2xl bg-secondary/30 border border-white/70 p-3">
            <div className="text-[11px] tracking-wider-jp text-muted-foreground">
              提案された組み合わせ
            </div>
            <div className="mt-2 space-y-1">
              {combo.items.map((it) => (
                <div key={it.id} className="text-sm text-foreground">
                  ・[{CHAIN_LABELS[it.chain] ?? it.chain}] {it.name}
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
              <Stat label="合計" value={`${combo.totals.calories}`} unit="kcal" />
              <Stat label="P" value={`${combo.totals.proteinG}`} unit="g" />
              <Stat label="F" value={`${combo.totals.fatG}`} unit="g" />
              <Stat label="C" value={`${combo.totals.carbsG}`} unit="g" />
            </div>
            {combo.comment && (
              <div className="mt-3 text-[12px] text-foreground/80 leading-relaxed">
                {combo.comment}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 検索 */}
      <Card className="p-4 bg-white/70 border-white/70 backdrop-blur-sm space-y-3">
        <div className="flex items-center gap-2 text-[11px] tracking-wider-jp text-muted-foreground">
          <Search className="h-3.5 w-3.5" />
          コンビニ商品を検索
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[11px] tracking-wider-jp">コンビニ</Label>
            <Select value={chain} onValueChange={(v) => setChain(v as Chain | "all")}>
              <SelectTrigger className="bg-white/70">
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
          <div>
            <Label className="text-[11px] tracking-wider-jp">カテゴリ</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category | "all")}>
              <SelectTrigger className="bg-white/70">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[11px] tracking-wider-jp">キーワード</Label>
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="サラダチキン など"
              className="bg-white/70"
            />
          </div>
          <div>
            <Label className="text-[11px] tracking-wider-jp">上限kcal</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={maxKcal}
              onChange={(e) => setMaxKcal(e.target.value)}
              className="bg-white/70"
            />
          </div>
        </div>

        <div className="text-[11px] tracking-wider-jp text-muted-foreground">
          {(searchQ.data ?? []).length} 件
        </div>
        <div className="space-y-2">
          {(searchQ.data ?? []).map((it) => (
            <div
              key={it.id}
              className="bg-white/50 border border-white/70 rounded-2xl px-3 py-2.5"
            >
              <div className="flex items-start gap-2">
                <ShoppingBag className="h-4 w-4 text-primary mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground">{it.name}</div>
                  <div className="text-[10px] tracking-wider-jp text-muted-foreground mt-1">
                    [{CHAIN_LABELS[it.chain] ?? it.chain}] · {CATEGORY_LABELS[it.category] ?? it.category}
                  </div>
                  <div className="text-[11px] mt-1 text-foreground/90">
                    <strong>{Number(it.calories)}kcal</strong> · P{Number(it.proteinG)} / F
                    {Number(it.fatG)} / C{Number(it.carbsG)}
                    {it.priceYen ? ` · ¥${it.priceYen}` : ""}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl bg-white/60 border border-white/70 px-2 py-1.5">
      <div className="text-[10px] tracking-wider-jp text-muted-foreground">{label}</div>
      <div className="font-display text-base text-primary leading-none mt-0.5">
        {value}
        <span className="text-[10px] text-muted-foreground ml-0.5">{unit}</span>
      </div>
    </div>
  );
}
