import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ChefHat, Loader2, ShoppingBag, Sparkles, UtensilsCrossed } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const PLAN_STORAGE_KEY = "trainer:lastMealPlan";

const BLUE = "oklch(0.58 0.19 254)";
const GREEN = "oklch(0.62 0.16 155)";

type Plan = {
  goalAssessment: string;
  isAggressive: boolean;
  dailyTarget: { calories: number; proteinG: number; fatG: number; carbsG: number };
  homeCookingPlan: { mealType: string; items: { name: string; grams: number; kcal: number }[]; totalKcal: number }[];
  conveniencePlan: { mealType: string; items: { name: string; kcal: number }[]; totalKcal: number }[];
  tips: string[];
};

export default function Trainer() {
  const goalQ = trpc.goals.get.useQuery();
  const [preference, setPreference] = useState("");
  const [tab, setTab] = useState<"home" | "conv">("home");
  // 直近に作成したプランは端末に保存し、再訪問時に復元する（毎回AIを叩かない＝クォータ節約）。
  const [plan, setPlan] = useState<Plan | null>(() => {
    try {
      const raw = localStorage.getItem(PLAN_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Plan) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (plan) localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan));
    } catch {
      /* ignore quota/serialization errors */
    }
  }, [plan]);

  const planM = trpc.trainer.mealPlan.useMutation({
    onSuccess: (res) => setPlan(res as Plan),
    onError: (e) => toast.error(e.message),
  });

  const goal = goalQ.data;

  return (
    <div className="space-y-4 pb-4">
      <div className="pt-1">
        <div className="section-label mb-1">AI TRAINER</div>
        <h1 className="text-2xl font-bold text-foreground">AI食事トレーナー</h1>
        <p className="text-xs text-muted-foreground mt-1">
          目標に合わせて1日の食事量・献立・グラム数を提案します（自炊／コンビニ）。
        </p>
      </div>

      {!goal ? (
        <div className="rounded-xl px-4 py-5 bg-card border border-border text-center">
          <p className="text-sm text-muted-foreground mb-3">まず目標を設定すると、あなた専用のプランを作れます。</p>
          <Link href="/goal">
            <Button className="rounded-xl font-bold">目標を設定する</Button>
          </Link>
        </div>
      ) : (
        <>
          {/* 目標サマリー */}
          <div className="rounded-xl px-4 py-4 bg-card border border-border">
            <div className="flex items-end gap-3">
              <div>
                <div className="text-[10px] text-muted-foreground">現在</div>
                <div className="text-2xl font-bold text-foreground">{Number(goal.currentWeightKg).toFixed(1)}<span className="text-xs font-normal text-muted-foreground ml-0.5">kg</span></div>
              </div>
              <div className="text-muted-foreground mb-1">→</div>
              <div>
                <div className="text-[10px] text-muted-foreground">目標</div>
                <div className="text-xl font-bold" style={{ color: GREEN }}>{Number(goal.targetWeightKg).toFixed(1)}<span className="text-xs font-normal text-muted-foreground ml-0.5">kg</span></div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-[10px] text-muted-foreground">期間 / 目標kcal</div>
                <div className="text-sm font-bold text-foreground">{goal.targetWeeks}週 / {Math.round(Number(goal.targetCalories))}kcal</div>
              </div>
            </div>
          </div>

          {/* 好み入力 */}
          <div className="rounded-xl px-4 py-4 bg-card border border-border space-y-2">
            <Label className="section-label">好み・条件（任意）</Label>
            <Input
              value={preference}
              onChange={(e) => setPreference(e.target.value)}
              placeholder="例：鶏肉と魚が好き／乳製品が苦手／自炊メイン"
              className="h-11"
            />
            <Button
              className="w-full h-12 font-bold rounded-xl mt-1"
              style={{ background: BLUE }}
              disabled={planM.isPending}
              onClick={() => planM.mutate({ preference: preference || undefined })}
            >
              {planM.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />プランを作成中...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" />{plan ? "プランを作り直す" : "AIにプランを作ってもらう"}</>
              )}
            </Button>
          </div>

          {plan && (
            <>
              {/* 目標の現実性 */}
              <div
                className="rounded-xl px-4 py-4 border"
                style={
                  plan.isAggressive
                    ? { background: "oklch(0.97 0.03 60)", borderColor: "oklch(0.85 0.1 60)" }
                    : { background: "oklch(0.97 0.02 155)", borderColor: "oklch(0.85 0.08 155)" }
                }
              >
                <div className="flex items-start gap-2">
                  {plan.isAggressive ? (
                    <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: "oklch(0.6 0.16 50)" }} />
                  ) : (
                    <Sparkles className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: GREEN }} />
                  )}
                  <div>
                    <div className="text-sm font-bold text-foreground mb-1">
                      {plan.isAggressive ? "目標ペースに注意" : "良いペースです"}
                    </div>
                    <p className="text-xs text-foreground/80 leading-relaxed">{plan.goalAssessment}</p>
                  </div>
                </div>
              </div>

              {/* 1日の目標 */}
              <div className="rounded-xl px-4 py-4 bg-card border border-border">
                <div className="section-label mb-3">1日の目標</div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { l: "kcal", v: plan.dailyTarget.calories, c: BLUE },
                    { l: "P (g)", v: plan.dailyTarget.proteinG, c: BLUE },
                    { l: "F (g)", v: plan.dailyTarget.fatG, c: "oklch(0.75 0.15 55)" },
                    { l: "C (g)", v: plan.dailyTarget.carbsG, c: GREEN },
                  ].map((x) => (
                    <div key={x.l} className="rounded-lg py-2.5" style={{ background: "oklch(0.965 0.004 250)" }}>
                      <div className="text-lg font-bold" style={{ color: x.c }}>{Math.round(x.v)}</div>
                      <div className="text-[10px] text-muted-foreground">{x.l}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 自炊 / コンビニ タブ */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl" style={{ background: "oklch(0.96 0.004 250)" }}>
                {([["home", "自炊メニュー", ChefHat], ["conv", "コンビニ", ShoppingBag]] as const).map(([k, label, Icon]) => (
                  <button
                    key={k}
                    onClick={() => setTab(k)}
                    className="py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    style={tab === k ? { background: "white", color: BLUE, boxShadow: "0 1px 3px oklch(0 0 0 / 0.08)" } : { color: "oklch(0.5 0.02 252)" }}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>

              {/* プラン本体 */}
              <div className="space-y-3">
                {(tab === "home" ? plan.homeCookingPlan : []).map((meal, i) => (
                  <MealCard key={`h${i}`} mealType={meal.mealType} total={meal.totalKcal}
                    items={meal.items.map((it) => ({ left: it.name, mid: `${it.grams}g`, kcal: it.kcal }))} />
                ))}
                {(tab === "conv" ? plan.conveniencePlan : []).map((meal, i) => (
                  <MealCard key={`c${i}`} mealType={meal.mealType} total={meal.totalKcal}
                    items={meal.items.map((it) => ({ left: it.name, mid: "", kcal: it.kcal }))} />
                ))}
              </div>

              {/* tips */}
              {plan.tips.length > 0 && (
                <div className="rounded-xl px-4 py-4 bg-card border border-border">
                  <div className="section-label mb-2">続けるコツ</div>
                  <ul className="space-y-1.5">
                    {plan.tips.map((t, i) => (
                      <li key={i} className="text-xs text-foreground/80 flex gap-2">
                        <UtensilsCrossed className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: BLUE }} />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function MealCard({
  mealType,
  total,
  items,
}: {
  mealType: string;
  total: number;
  items: { left: string; mid: string; kcal: number }[];
}) {
  return (
    <div className="rounded-xl px-4 py-3.5 bg-card border border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-foreground">{mealType}</span>
        <span className="text-sm font-bold" style={{ color: "oklch(0.58 0.19 254)" }}>{Math.round(total)} kcal</span>
      </div>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-baseline gap-2 text-xs">
            <span className="text-foreground flex-1">{it.left}</span>
            {it.mid && <span className="text-muted-foreground">{it.mid}</span>}
            <span className="text-muted-foreground tabular-nums">{Math.round(it.kcal)}kcal</span>
          </div>
        ))}
      </div>
    </div>
  );
}
