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
import { ACTIVITY_LABELS } from "@/lib/labels";
import { trpc } from "@/lib/trpc";
import { Loader2, Sparkles, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "veryActive";

const GLASS = {
  background: "oklch(1 0 0 / 0.72)",
  border: "1px solid oklch(1 0 0 / 0.78)",
  backdropFilter: "blur(20px) saturate(1.4)",
  WebkitBackdropFilter: "blur(20px) saturate(1.4)",
  boxShadow: "0 1px 2px oklch(0.35 0.08 290 / 0.04), 0 4px 12px oklch(0.35 0.08 290 / 0.06), inset 0 1px 0 oklch(1 0 0 / 0.9)",
} as const;

export default function Goal() {
  const goalQ = trpc.goals.get.useQuery();
  const utils = trpc.useUtils();

  const [gender, setGender] = useState<"male" | "female">("male");
  const [age, setAge] = useState("30");
  const [heightCm, setHeightCm] = useState("170");
  const [currentWeight, setCurrentWeight] = useState("70");
  const [targetWeight, setTargetWeight] = useState("65");
  const [targetWeeks, setTargetWeeks] = useState("12");
  const [activity, setActivity] = useState<ActivityLevel>("light");

  useEffect(() => {
    const g = goalQ.data;
    if (g) {
      setGender(g.gender as "male" | "female");
      setAge(String(g.age));
      setHeightCm(String(g.heightCm));
      setCurrentWeight(String(g.currentWeightKg));
      setTargetWeight(String(g.targetWeightKg));
      setTargetWeeks(String(g.targetWeeks));
      setActivity(g.activityLevel as ActivityLevel);
    }
  }, [goalQ.data]);

  const previewInput = useMemo(
    () => ({
      gender,
      age: Number(age) || 30,
      heightCm: Number(heightCm) || 170,
      currentWeightKg: Number(currentWeight) || 70,
      targetWeightKg: Number(targetWeight) || 65,
      targetWeeks: Number(targetWeeks) || 12,
      activityLevel: activity,
    }),
    [gender, age, heightCm, currentWeight, targetWeight, targetWeeks, activity]
  );

  const previewQ = trpc.goals.preview.useQuery(previewInput, {
    enabled:
      previewInput.heightCm > 100 &&
      previewInput.currentWeightKg > 20 &&
      previewInput.targetWeightKg > 20 &&
      previewInput.targetWeeks > 0,
  });

  const saveM = trpc.goals.save.useMutation({
    onSuccess: () => {
      utils.goals.get.invalidate();
      toast.success("目標と減量計画を保存しました");
    },
  });

  const submit = async () => {
    if (previewInput.targetWeightKg >= previewInput.currentWeightKg) {
      toast.error("目標体重は現在の体重より低く設定してください");
      return;
    }
    await saveM.mutateAsync(previewInput);
  };

  const plan = previewQ.data;

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Page Header */}
      <div className="pt-1">
        <div className="page-label mb-1.5">GOAL</div>
        <h1 className="font-display" style={{ fontSize: "clamp(1.75rem,5vw,2.5rem)", color: "oklch(0.32 0.09 290)" }}>
          目標設定
        </h1>
      </div>

      {/* フォーム */}
      <div className="rounded-2xl px-5 py-5 space-y-4" style={GLASS}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="page-label">性別</Label>
            <Select value={gender} onValueChange={(v) => setGender(v as "male" | "female")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">男性</SelectItem>
                <SelectItem value="female">女性</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="page-label">年齢</Label>
            <Input type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="page-label">身長 (cm)</Label>
            <Input type="number" inputMode="decimal" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="page-label">現在の体重 (kg)</Label>
            <Input type="number" inputMode="decimal" value={currentWeight} onChange={(e) => setCurrentWeight(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="page-label">目標体重 (kg)</Label>
            <Input type="number" inputMode="decimal" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="page-label">期間 (週)</Label>
            <Input type="number" inputMode="numeric" value={targetWeeks} onChange={(e) => setTargetWeeks(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="page-label">活動量</Label>
          <Select value={activity} onValueChange={(v) => setActivity(v as ActivityLevel)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={submit} disabled={saveM.isPending} className="w-full rounded-xl h-11 font-medium">
          {saveM.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Target className="h-4 w-4 mr-2" />}
          目標と計画を保存
        </Button>
      </div>

      {/* 自動算出された減量計画 */}
      {plan && (
        <div className="rounded-2xl px-5 py-5 space-y-4" style={GLASS}>
          <div className="flex items-center gap-1.5 page-label">
            <Sparkles className="h-3 w-3" />
            自動算出された減量計画
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <PlanBox label="基礎代謝 (BMR)" value={plan.bmr} unit="kcal" />
            <PlanBox label="消費 (TDEE)" value={plan.tdee} unit="kcal" />
            <PlanBox label="1日の目安" value={plan.targetCalories} unit="kcal" highlight />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <PlanBox label="週間減量目標" value={plan.weeklyLossKg.toFixed(2)} unit="kg/週" />
            <PlanBox label="1日のカロリー不足" value={plan.dailyDeficit} unit="kcal" />
          </div>

          <div
            className="rounded-xl px-4 py-3"
            style={{
              background: "oklch(0.97 0.015 290 / 0.55)",
              border: "1px solid oklch(0.9 0.02 290 / 0.4)",
            }}
          >
            <div className="page-label mb-2">PFC目安（タンパク質・脂質・炭水化物）</div>
            <div className="flex gap-5">
              <PfcItem label="タンパク質" value={plan.pfc.proteinG} />
              <PfcItem label="脂質" value={plan.pfc.fatG} />
              <PfcItem label="炭水化物" value={plan.pfc.carbsG} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlanBox({ label, value, unit, highlight }: { label: string; value: number | string; unit: string; highlight?: boolean }) {
  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{
        background: highlight ? "oklch(0.93 0.06 290 / 0.35)" : "oklch(0.97 0.015 290 / 0.55)",
        border: `1px solid ${highlight ? "oklch(0.75 0.1 290 / 0.3)" : "oklch(0.9 0.02 290 / 0.4)"}`,
      }}
    >
      <div className="text-[10px] tracking-wider-jp text-muted-foreground leading-tight">{label}</div>
      <div className="font-display text-lg leading-none mt-1" style={{ color: "oklch(0.35 0.08 290)" }}>{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{unit}</div>
    </div>
  );
}

function PfcItem({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10px] tracking-wider-jp text-muted-foreground">{label}</div>
      <div className="font-display text-xl leading-none mt-0.5" style={{ color: "oklch(0.35 0.08 290)" }}>
        {value}<span className="text-xs font-sans text-muted-foreground ml-0.5">g</span>
      </div>
    </div>
  );
}
